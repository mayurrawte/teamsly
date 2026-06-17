import type { Client } from "@microsoft/microsoft-graph-client";

const MESSAGES_PER_CONVERSATION = 30;
const MAX_BODY_CHARS = 200;

export interface ConvBundle {
  /** Human label, e.g. "#dev (Platform)" or "Direct Message". */
  label: string;
  /** chatId for chats; `${teamId}:${channelId}` for channels. */
  contextId: string;
  contextKind: "chat" | "channel";
  /** Messages within the window, sorted oldest-first. */
  messages: MSMessage[];
  count: number;
}

export type Ownership = "you" | "waiting" | "team";

/** The client-facing action item (shared by the route and the UI). */
export interface ActionItem {
  task: string;
  owner: string | null;
  ownership: Ownership;
  sourceLabel: string;
  contextId: string;
  contextKind: "chat" | "channel";
  messageId: string | null;
  /** ISO date (YYYY-MM-DD) of an explicit deadline stated in chat, or null. */
  dueDate: string | null;
}

export function stripHtml(html: string): string {
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

export function messageText(msg: MSMessage): string {
  const raw = msg.body?.content ?? "";
  const plain = msg.body?.contentType === "html" ? stripHtml(raw) : raw;
  return plain.length > MAX_BODY_CHARS ? plain.slice(0, MAX_BODY_CHARS - 1) + "…" : plain;
}

export function sinceWindow(windowParam: string): Date {
  const now = new Date();
  if (windowParam === "3d") now.setDate(now.getDate() - 3);
  else if (windowParam === "7d") now.setDate(now.getDate() - 7);
  else now.setHours(now.getHours() - 24);
  return now;
}

function sortOldestFirst(messages: MSMessage[]): MSMessage[] {
  return messages
    .slice()
    .sort((a, b) => new Date(a.createdDateTime).getTime() - new Date(b.createdDateTime).getTime());
}

/**
 * Fetch the user's recent chats + top teams' channels, returning one bundle
 * per conversation that has at least one message within the window. Messages
 * are sorted oldest-first so callers can index into them stably. Never throws;
 * partial failures are skipped.
 */
export async function gatherConversations(
  client: Client,
  sinceDate: Date
): Promise<ConvBundle[]> {
  const conversations: ConvBundle[] = [];

  try {
    const chatsRes = await client
      .api("/me/chats")
      .select("id,chatType,topic,lastUpdatedDateTime")
      .top(30)
      .get();
    const chats = (chatsRes.value as MSChat[]).filter(
      (c) => !c.lastUpdatedDateTime || new Date(c.lastUpdatedDateTime) >= sinceDate
    );

    const chatBundles = await Promise.allSettled(
      chats.slice(0, 20).map(async (chat) => {
        const res = await client.api(`/me/chats/${chat.id}/messages`).top(MESSAGES_PER_CONVERSATION).get();
        const messages = sortOldestFirst(
          (res.value as MSMessage[]).filter(
            (m) => !m.deletedDateTime && new Date(m.createdDateTime) >= sinceDate
          )
        );
        const label = chat.topic || (chat.chatType === "oneOnOne" ? "Direct Message" : "Group Chat");
        return {
          label,
          contextId: chat.id,
          contextKind: "chat" as const,
          messages,
          count: messages.length,
        };
      })
    );

    for (const result of chatBundles) {
      if (result.status === "fulfilled" && result.value.count > 0) conversations.push(result.value);
    }
  } catch (err) {
    console.error("[ai/gather] chats fetch failed:", err);
  }

  try {
    const teamsRes = await client.api("/me/joinedTeams").select("id,displayName").get();
    const teams = (teamsRes.value as MSTeam[]).slice(0, 3);

    for (const team of teams) {
      try {
        const chRes = await client.api(`/teams/${team.id}/channels`).select("id,displayName").get();
        const channels = (chRes.value as MSChannel[]).slice(0, 8);

        const channelBundles = await Promise.allSettled(
          channels.map(async (channel) => {
            const res = await client
              .api(`/teams/${team.id}/channels/${channel.id}/messages`)
              .top(MESSAGES_PER_CONVERSATION)
              .get();
            const messages = sortOldestFirst(
              (res.value as MSMessage[]).filter(
                (m) => !m.deletedDateTime && new Date(m.createdDateTime) >= sinceDate
              )
            );
            return {
              label: `#${channel.displayName} (${team.displayName})`,
              contextId: `${team.id}:${channel.id}`,
              contextKind: "channel" as const,
              messages,
              count: messages.length,
            };
          })
        );

        for (const result of channelBundles) {
          if (result.status === "fulfilled" && result.value.count > 0) conversations.push(result.value);
        }
      } catch {
        // continue with next team
      }
    }
  } catch (err) {
    console.error("[ai/gather] teams fetch failed:", err);
  }

  return conversations;
}
