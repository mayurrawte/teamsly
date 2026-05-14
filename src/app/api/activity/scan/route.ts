import { auth } from "@/lib/auth/config";
import { getGraphClient } from "@/lib/graph/client";
import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Activity scan endpoint
//
// Walks the user's most-recent messages across their chats and the active
// team's channels, classifying each into one or more buckets:
//
//   - mention  : message body @mentions the current user (Graph mention list
//                OR plain-text `@{displayName}` — Teamsly's composer sends
//                mentions as plain text, not <at> markup)
//   - thread   : a reply (chat or channel) authored by anyone on a parent
//                message the current user authored
//   - reaction : someone else reacted to a message the current user authored
//
// Graph is rate-limited heavily on channel reads (1 req/sec/channel/app), so
// the loop is capped, runs in concurrent chunks (5 at a time), and any 429 /
// 5xx is caught — the partial result is returned with `partial: true`. The
// result is cached in-process for 60 s keyed by userId so the page can poll
// without hammering Graph.
// ---------------------------------------------------------------------------

export interface ActivityItem {
  id: string;
  type: "mention" | "thread" | "reaction";
  senderId: string;
  senderName: string;
  summary: string;
  timestamp: string;
  href: string;
}

interface ScanResult {
  mentions: ActivityItem[];
  threads: ActivityItem[];
  reactions: ActivityItem[];
  partial: boolean;
}

// Caps — tuned for politeness against Graph's 50 RPS global + per-channel limits.
const MAX_CHATS = 30;
const CHAT_MESSAGES_PER_CHAT = 50;
const MAX_CHANNELS = 20;
const CHANNEL_MESSAGES_PER_CHANNEL = 50;
const MAX_REPLY_LOOKUPS = 20;
const CONCURRENCY = 5;

// In-process cache: 60 s TTL. Survives across requests on a warm Vercel
// function instance; cold starts simply re-scan. Don't reach for Vercel KV
// here — STATUS notes it's deferred.
const cache = new Map<
  string,
  { data: ScanResult; expiresAt: number }
>();
const CACHE_TTL_MS = 60 * 1000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trimEnd() + "…";
}

function bodyText(message: MSMessage): string {
  const raw = message.body?.content ?? "";
  return message.body?.contentType === "html" ? stripHtml(raw) : raw;
}

function isMentionOfUser(
  message: MSMessage,
  meId: string,
  meName: string | undefined,
  rawHtml: string
): boolean {
  // Graph's structured mentions array — most reliable when Teams composed it.
  type GraphMention = {
    mentioned?: { user?: { id?: string }; conversation?: { id?: string } };
  };
  const mentions = (message as unknown as { mentions?: GraphMention[] }).mentions;
  if (Array.isArray(mentions)) {
    for (const m of mentions) {
      if (m?.mentioned?.user?.id === meId) return true;
    }
  }

  // Teamsly's composer sends `@{displayName}` as plain text without <at>
  // markup, so fall back to a case-insensitive literal match in the body.
  if (meName) {
    const needle = `@${meName}`.toLowerCase();
    if (rawHtml.toLowerCase().includes(needle)) return true;
  }

  return false;
}

function authoredByMe(message: MSMessage, meId: string): boolean {
  return message.from?.user?.id === meId;
}

function hasOtherReaction(message: MSMessage, meId: string): boolean {
  if (!message.reactions?.length) return false;
  return message.reactions.some((r) => r.user?.id && r.user.id !== meId);
}

async function runInChunks<T, R>(
  items: T[],
  worker: (item: T) => Promise<R>,
  concurrency: number
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const slice = items.slice(i, i + concurrency);
    const settled = await Promise.allSettled(slice.map(worker));
    results.push(...settled);
  }
  return results;
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accessToken = session.accessToken;
  const teamId = request.nextUrl.searchParams.get("teamId");

  const client = getGraphClient(accessToken);

  // Identify the current user — we need both id (for from/mention checks) and
  // displayName (for plain-text mention fallback).
  let meId = "";
  let meName: string | undefined;
  try {
    const me = (await client
      .api("/me")
      .select("id,displayName,userPrincipalName")
      .get()) as MSUser;
    meId = me.id;
    meName = me.displayName;
  } catch (err) {
    console.error("[activity/scan] failed to resolve /me:", err);
    return NextResponse.json(
      { error: "Could not resolve current user" },
      { status: 502 }
    );
  }

  // Serve from cache if fresh. The cache key is the userId — teamId scoping
  // is implicit because most users only have one active team and the
  // sub-60-second staleness is acceptable for an activity hub.
  const cacheKey = `${meId}::${teamId ?? "no-team"}`;
  const now = Date.now();
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return NextResponse.json(cached.data);
  }

  const mentions: ActivityItem[] = [];
  const threads: ActivityItem[] = [];
  const reactions: ActivityItem[] = [];
  let partial = false;

  // -----------------------------------------------------------------------
  // Chats — most-recent N, then per-chat last-50 messages
  // -----------------------------------------------------------------------

  let chats: MSChat[] = [];
  try {
    const res = await client
      .api("/me/chats")
      .expand("members")
      .select("id,chatType,topic,lastUpdatedDateTime")
      .top(MAX_CHATS)
      .get();
    chats = res.value as MSChat[];
  } catch (err) {
    console.error("[activity/scan] /me/chats failed:", err);
    partial = true;
  }

  type ChatMsgBundle = { chat: MSChat; messages: MSMessage[] };
  const chatResults = await runInChunks<MSChat, ChatMsgBundle>(
    chats,
    async (chat) => {
      const res = await client
        .api(`/me/chats/${chat.id}/messages`)
        .top(CHAT_MESSAGES_PER_CHAT)
        .get();
      return { chat, messages: res.value as MSMessage[] };
    },
    CONCURRENCY
  );

  for (const settled of chatResults) {
    if (settled.status === "rejected") {
      partial = true;
      continue;
    }
    const { chat, messages } = settled.value;
    const chatHref = `/app/dm/${chat.id}`;

    for (const msg of messages) {
      if (msg.deletedDateTime) continue;
      const sender = msg.from?.user;
      const rawHtml = msg.body?.content ?? "";
      const summary = truncate(bodyText(msg) || "(no content)", 140);

      // mention
      if (
        sender &&
        sender.id !== meId &&
        isMentionOfUser(msg, meId, meName, rawHtml)
      ) {
        mentions.push({
          id: `mention-chat-${chat.id}-${msg.id}`,
          type: "mention",
          senderId: sender.id,
          senderName: sender.displayName,
          summary,
          timestamp: msg.createdDateTime,
          href: chatHref,
        });
      }

      // reaction — someone else reacted to a message I authored
      if (authoredByMe(msg, meId) && hasOtherReaction(msg, meId)) {
        const reactor = msg.reactions?.find(
          (r) => r.user?.id && r.user.id !== meId
        );
        if (reactor) {
          reactions.push({
            id: `reaction-chat-${chat.id}-${msg.id}`,
            type: "reaction",
            senderId: reactor.user.id,
            senderName: reactor.user.displayName,
            summary: `Reacted ${reactor.reactionType} to "${summary}"`,
            timestamp: msg.createdDateTime,
            href: chatHref,
          });
        }
      }
    }
  }

  // -----------------------------------------------------------------------
  // Channels — only the active team's channels (N×M traversal across every
  // joined team is prohibitively expensive on Graph).
  // -----------------------------------------------------------------------

  if (teamId) {
    let channels: MSChannel[] = [];
    try {
      const res = await client
        .api(`/teams/${teamId}/channels`)
        .select("id,displayName,membershipType")
        .get();
      channels = (res.value as MSChannel[]).slice(0, MAX_CHANNELS);
    } catch (err) {
      console.error(
        `[activity/scan] /teams/${teamId}/channels failed:`,
        err
      );
      partial = true;
    }

    type ChannelMsgBundle = { channel: MSChannel; messages: MSMessage[] };
    const channelResults = await runInChunks<MSChannel, ChannelMsgBundle>(
      channels,
      async (channel) => {
        const res = await client
          .api(`/teams/${teamId}/channels/${channel.id}/messages`)
          .top(CHANNEL_MESSAGES_PER_CHANNEL)
          .get();
        return { channel, messages: res.value as MSMessage[] };
      },
      CONCURRENCY
    );

    // Collect (channel, message) tuples for the user's recent authored
    // messages so we can do a bounded thread-reply lookup afterwards.
    const myChannelMessages: Array<{
      channel: MSChannel;
      message: MSMessage;
    }> = [];

    for (const settled of channelResults) {
      if (settled.status === "rejected") {
        partial = true;
        continue;
      }
      const { channel, messages } = settled.value;
      const channelHref = `/app/t/${teamId}/${channel.id}`;

      for (const msg of messages) {
        if (msg.deletedDateTime) continue;
        const sender = msg.from?.user;
        const rawHtml = msg.body?.content ?? "";
        const summary = truncate(bodyText(msg) || "(no content)", 140);

        // mention
        if (
          sender &&
          sender.id !== meId &&
          isMentionOfUser(msg, meId, meName, rawHtml)
        ) {
          mentions.push({
            id: `mention-ch-${channel.id}-${msg.id}`,
            type: "mention",
            senderId: sender.id,
            senderName: sender.displayName,
            summary: `#${channel.displayName}: ${summary}`,
            timestamp: msg.createdDateTime,
            href: channelHref,
          });
        }

        // reaction — someone else reacted to a message I authored
        if (authoredByMe(msg, meId) && hasOtherReaction(msg, meId)) {
          const reactor = msg.reactions?.find(
            (r) => r.user?.id && r.user.id !== meId
          );
          if (reactor) {
            reactions.push({
              id: `reaction-ch-${channel.id}-${msg.id}`,
              type: "reaction",
              senderId: reactor.user.id,
              senderName: reactor.user.displayName,
              summary: `Reacted ${reactor.reactionType} in #${channel.displayName}`,
              timestamp: msg.createdDateTime,
              href: channelHref,
            });
          }
        }

        // Track my own recent channel messages for the thread-reply pass.
        if (authoredByMe(msg, meId)) {
          myChannelMessages.push({ channel, message: msg });
        }
      }
    }

    // ---------------------------------------------------------------------
    // Threads — replies on the user's most-recent authored channel messages.
    // Capped at MAX_REPLY_LOOKUPS to stay polite on Graph's per-channel
    // message read limit (1 req/sec).
    // ---------------------------------------------------------------------

    // Sort by createdDateTime desc and slice.
    myChannelMessages.sort(
      (a, b) =>
        new Date(b.message.createdDateTime).getTime() -
        new Date(a.message.createdDateTime).getTime()
    );
    const replyLookups = myChannelMessages.slice(0, MAX_REPLY_LOOKUPS);

    const replyResults = await runInChunks(
      replyLookups,
      async ({ channel, message }) => {
        const res = await client
          .api(
            `/teams/${teamId}/channels/${channel.id}/messages/${message.id}/replies`
          )
          .top(20)
          .get();
        return {
          channel,
          parent: message,
          replies: res.value as MSMessage[],
        };
      },
      CONCURRENCY
    );

    for (const settled of replyResults) {
      if (settled.status === "rejected") {
        partial = true;
        continue;
      }
      const { channel, parent, replies } = settled.value;
      const channelHref = `/app/t/${teamId}/${channel.id}`;
      const parentSummary = truncate(
        bodyText(parent) || "(no content)",
        80
      );

      for (const reply of replies) {
        if (reply.deletedDateTime) continue;
        const sender = reply.from?.user;
        if (!sender || sender.id === meId) continue;

        const replySummary = truncate(
          bodyText(reply) || "(no content)",
          120
        );

        threads.push({
          id: `thread-${channel.id}-${parent.id}-${reply.id}`,
          type: "thread",
          senderId: sender.id,
          senderName: sender.displayName,
          summary: `Replied to "${parentSummary}": ${replySummary}`,
          timestamp: reply.createdDateTime,
          href: channelHref,
        });
      }
    }
  }

  // -----------------------------------------------------------------------
  // Sort each bucket most-recent first, dedupe by id (defensive — chat-side
  // and channel-side iterations should already produce disjoint id-spaces).
  // -----------------------------------------------------------------------

  const sortDesc = (a: ActivityItem, b: ActivityItem) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();

  const dedupe = (items: ActivityItem[]): ActivityItem[] => {
    const seen = new Set<string>();
    const out: ActivityItem[] = [];
    for (const it of items) {
      if (seen.has(it.id)) continue;
      seen.add(it.id);
      out.push(it);
    }
    return out;
  };

  const result: ScanResult = {
    mentions: dedupe(mentions).sort(sortDesc),
    threads: dedupe(threads).sort(sortDesc),
    reactions: dedupe(reactions).sort(sortDesc),
    partial,
  };

  cache.set(cacheKey, { data: result, expiresAt: now + CACHE_TTL_MS });

  return NextResponse.json(result);
}
