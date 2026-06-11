"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useWorkspaceStore } from "@/store/workspace";
import { MessageFeed } from "./MessageFeed";
import { MessageInput } from "./MessageInput";
import { ThreadPanel } from "./ThreadPanel";
import { ChannelMessageHeader, type Tab } from "./MessageHeader";
import { ChannelIntroCard } from "./IntroCard";
import { ContextFilesTab } from "./ContextFilesTab";
import { ForwardMessageModal, type ForwardDestination } from "@/components/modals/ForwardMessageModal";
import { reactionEmoji, type ReactionType } from "@/lib/utils/reactions";
import { useToastStore } from "@/store/toasts";
import { textToHtml, messagePlainText } from "@/lib/utils/render-message";
import { useMemberPanelStore } from "@/store/memberPanel";
import { openTeamsChannelMeeting } from "@/lib/utils/teams-deeplink";
import { markdownToHtml } from "@/lib/utils/markdown-to-html";
import { VoiceTrigger } from "@/components/voice/VoiceTrigger";
import { useRealtimeEvents, useRealtimeHealth } from "@/hooks/useRealtimeEvents";
import { isDisappearing, unwrapMessage, wrapMessage, UNDECODABLE_BLOB_GRACE_MS } from "@/lib/utils/disappear";

export function ChannelView({ teamId, channelId }: { teamId: string; channelId: string }) {
  const {
    teams,
    channels,
    getMessages,
    currentUserId,
    currentUserName,
    setMessages,
    appendPendingMessage,
    replaceMessage,
    markMessageFailed,
    removeMessage,
    expireMessage,
    setContextLoading,
    toggleReaction,
  } = useWorkspaceStore();
  const isHydrated = useWorkspaceStore((s) => s.isHydrated);
  // First-load flag for THIS channel only — a cached channel never shows the skeleton.
  const loadingThisChannel = useWorkspaceStore(
    (s) => s.loadingContexts[`${teamId}:${channelId}`] ?? false,
  );
  const upsertMessage = useWorkspaceStore((s) => s.upsertMessage);
  const sseHealthy = useRealtimeHealth();
  const [threadMessage, setThreadMessage] = useState<MSMessage | null>(null);
  const [forwardMessage, setForwardMessage] = useState<MSMessage | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("messages");
  const [uploading, setUploading] = useState(false);
  const showToast = useToastStore((state) => state.showToast);
  const openChannelMembers = useMemberPanelStore((s) => s.openChannelMembers);
  const handleOpenMembers = () => openChannelMembers(teamId, channelId);

  // Search jump-to-message: read `?anchor=` from the URL and forward it to
  // MessageFeed. We clear the param once the anchor effect has run (or
  // timed out) so the URL doesn't keep that anchor across later navigations.
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const anchorMessageId = searchParams.get("anchor") ?? undefined;
  const handleAnchorConsumed = useCallback(() => {
    if (!anchorMessageId) return;
    router.replace(pathname);
  }, [anchorMessageId, pathname, router]);

  // Stable context key for this channel's message cache
  const contextId = `${teamId}:${channelId}`;
  const messages = getMessages(contextId);

  const team = teams.find((t) => t.id === teamId);
  const channel = channels[teamId]?.find((c) => c.id === channelId);

  // Reset tab when channel changes
  useEffect(() => {
    setActiveTab("messages");
  }, [channelId]);

  // loadRef lets the realtime handler trigger a fetch without becoming a
  // dependency of the SSE event callback (which would re-register on every render).
  const loadRef = useRef<() => Promise<void>>(async () => {});

  // Sweep expired disappearing messages we sent — only the author can
  // softDelete a channel message (Graph 403s otherwise). Receivers just hide
  // them locally via the per-message timer (onExpire below). Defined before the
  // load effect that calls it.
  const sweepExpired = useCallback(async (msgs: MSMessage[]) => {
    const now = Date.now();
    for (const m of msgs) {
      if (m.__pending || m.__failed) continue;
      if (m.from?.user?.id !== currentUserId) continue;
      if (!isDisappearing(m.body.content)) continue;
      const payload = await unwrapMessage(contextId, m.body.content);
      if (payload) {
        if (payload.disappearAt > now) continue;
      } else if (now - new Date(m.createdDateTime).getTime() < UNDECODABLE_BLOB_GRACE_MS) {
        continue;
      }
      try {
        const res = await fetch(
          `/api/messages/${teamId}/${channelId}/${encodeURIComponent(m.id)}`,
          { method: "DELETE" }
        );
        if (res.ok) removeMessage(contextId, m.id);
      } catch {
        /* best-effort; retried on next sweep */
      }
    }
  }, [teamId, channelId, contextId, currentUserId, removeMessage]);

  useEffect(() => {
    let cancelled = false;
    const cached = getMessages(contextId);
    const isFirstLoad = cached.length === 0 && isHydrated;

    if (isFirstLoad) setContextLoading(contextId, true);

    async function load() {
      try {
        const response = await fetch(`/api/messages/${teamId}/${channelId}`);
        if (!response.ok) throw new Error("Failed to load messages");
        const data = (await response.json()) as MSMessage[];
        if (!cancelled) {
          const sorted = sortByCreated(data);
          setMessages(contextId, sorted);
          void sweepExpired(sorted);
        }
      } catch {
        if (isFirstLoad && !cancelled) showToast({ title: "Could not load messages", tone: "error" });
      } finally {
        if (!cancelled) setContextLoading(contextId, false);
      }
    }

    loadRef.current = load;
    load();

    // Webhook push is primary; when SSE is healthy, poll less frequently (2 min)
    // and fall back to 30 s when SSE is degraded.
    const interval = setInterval(load, sseHealthy ? 120_000 : 30_000);

    // Disappearing-message sweep on a fast cadence (network-free unless one of
    // our own messages has actually expired) — matches the DM view's behavior.
    const sweep = setInterval(() => void sweepExpired(getMessages(contextId)), 4000);

    // Fire-and-forget: create a Graph change notification subscription so the
    // webhook endpoint can push new messages via SSE instead of waiting for poll.
    fetch("/api/realtime/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId, channelId }),
    }).catch(() => { /* subscription is best-effort; poll is the fallback */ });

    // Re-subscribe before the 55-min Graph TTL so long-open views stay live.
    const resubscribe = setInterval(() => {
      fetch("/api/realtime/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, channelId }),
      }).catch(() => { /* best-effort */ });
    }, 45 * 60 * 1000);

    return () => {
      cancelled = true;
      clearInterval(interval);
      clearInterval(sweep);
      clearInterval(resubscribe);
    };
    // getMessages is a stable selector — intentionally not in deps to avoid re-running on cache updates
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, channelId, contextId, isHydrated, sseHealthy, setContextLoading, setMessages, showToast, sweepExpired]);

  useRealtimeEvents(
    useCallback(
      (event) => {
        if (
          event.type === "channel_message" &&
          event.teamId === teamId &&
          event.channelId === channelId
        ) {
          fetch(`/api/teams/${teamId}/channels/${channelId}/messages/${encodeURIComponent(event.messageId)}`)
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
            .then((msg: MSMessage) => upsertMessage(contextId, msg))
            .catch(() => void loadRef.current());
        }
      },
      [teamId, channelId, contextId, upsertMessage]
    )
  );

  async function handleSend(
    content: string,
    options?: { mentions?: { id: string; name: string }[]; disappearMs?: number }
  ) {
    const tempId = `temp-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    // Disappearing messages: wrap the body into the opaque blob and send it as
    // "text" so Graph stores it verbatim (same as DMs). The contextId key must
    // match what MessageItem decodes with (bookmarkContextId = contextId).
    const outgoing = options?.disappearMs
      ? await wrapMessage(contextId, content, Date.now() + options.disappearMs)
      : content;
    const optimistic: MSMessage = {
      id: tempId,
      createdDateTime: now,
      body: options?.disappearMs
        ? { contentType: "text", content: outgoing }
        : { contentType: "html", content: textToHtml(content) },
      from: { user: { id: currentUserId, displayName: currentUserName } },
      reactions: [],
      attachments: [],
      __pending: true,
      __originalText: content,
    };
    appendPendingMessage(contextId, optimistic);

    try {
      const res = await fetch(`/api/messages/${teamId}/${channelId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: outgoing,
          // Server route turns this into Graph's `mentions[]` array and
          // wraps each `@Name` in the body with `<at id="i">…</at>` markup.
          ...(options?.mentions?.length ? { mentions: options.mentions } : {}),
          ...(options?.disappearMs ? { contentType: "text" } : {}),
        }),
      });
      if (!res.ok) throw new Error("Failed to send message");
      const serverMsg = (await res.json()) as MSMessage;
      replaceMessage(contextId, tempId, serverMsg);
    } catch {
      markMessageFailed(contextId, tempId);
      showToast({ title: "Could not send message", tone: "error" });
    }
  }

  // Called by MessageItem when a disappearing message's countdown hits zero:
  // hide it locally now, and softDelete server-side for our own messages.
  const handleMessageExpire = useCallback((messageId: string) => {
    const msg = getMessages(contextId).find((m) => m.id === messageId);
    const isOwn = msg?.from?.user?.id === currentUserId;
    expireMessage(contextId, messageId);
    if (isOwn) {
      void fetch(`/api/messages/${teamId}/${channelId}/${encodeURIComponent(messageId)}`, {
        method: "DELETE",
      });
    }
  }, [teamId, channelId, contextId, currentUserId, getMessages, expireMessage]);

  function handleAttachAndSend(content: string, file: File): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      setUploading(true);

      const form = new FormData();
      form.append("file", file);

      const xhr = new XMLHttpRequest();

      xhr.onload = async () => {
        setUploading(false);

        if (xhr.status < 200 || xhr.status >= 300) {
          let errMsg = "Upload failed";
          try {
            const errBody = JSON.parse(xhr.responseText) as { error?: string };
            if (errBody.error) errMsg = errBody.error;
          } catch {
            // ignore parse errors
          }
          showToast({ title: errMsg, tone: "error" });
          reject(new Error(errMsg));
          return;
        }

        const driveItem = JSON.parse(xhr.responseText) as { name: string; webUrl: string };

        // Build an HTML body embedding the file as a clickable link.
        // Channel attachments via Graph require SharePoint references; we use
        // the OneDrive sharing link instead to avoid that complexity.
        const trimmed = content.trim();
        const fileLink = `<a href="${driveItem.webUrl}">${driveItem.name}</a>`;
        const htmlBody = trimmed
          ? `${markdownToHtml(trimmed)}<br/>${fileLink}`
          : fileLink;

        // Build and register the optimistic message directly (bypassing
        // handleSend) so the HTML body is stored as-is rather than escaped.
        const tempId = `temp-${crypto.randomUUID()}`;
        const now = new Date().toISOString();
        const optimistic: MSMessage = {
          id: tempId,
          createdDateTime: now,
          body: { contentType: "html", content: htmlBody },
          from: { user: { id: currentUserId, displayName: currentUserName } },
          reactions: [],
          attachments: [],
          __pending: true,
        };
        appendPendingMessage(contextId, optimistic);

        try {
          const res = await fetch(`/api/messages/${teamId}/${channelId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: htmlBody }),
          });
          if (!res.ok) throw new Error("Failed to send message with attachment");
          const serverMsg = (await res.json()) as MSMessage;
          replaceMessage(contextId, tempId, serverMsg);
          resolve();
        } catch {
          // File already uploaded; mark failed (discard-only, no re-upload needed).
          markMessageFailed(contextId, tempId);
          showToast({ title: "Could not send message", tone: "error" });
          reject(new Error("Send failed"));
        }
      };

      xhr.onerror = () => {
        setUploading(false);
        showToast({ title: "Upload failed", tone: "error" });
        reject(new Error("Upload failed"));
      };

      xhr.open("POST", "/api/files/upload");
      xhr.send(form);
    });
  }

  function handleRetry(originalText: string) {
    const failedMsg = messages.find(
      (m) =>
        m.__failed &&
        (m.__originalText === originalText ||
          messagePlainText(m.body.content, m.body.contentType) === originalText)
    );
    if (failedMsg) removeMessage(contextId, failedMsg.id);
    void handleSend(originalText);
  }

  function handleDiscard(messageId: string) {
    removeMessage(contextId, messageId);
  }

  // Forward a channel message to either another chat or another channel.
  // Mirrors handleForward in ChatView — writes an optimistic entry into the
  // destination's per-context cache, then POSTs to the matching endpoint.
  async function handleForward(destination: ForwardDestination, htmlBody: string) {
    const tempId = `temp-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const destContextId = destination.kind === "chat"
      ? destination.chatId
      : `${destination.teamId}:${destination.channelId}`;

    const optimistic: MSMessage = {
      id: tempId,
      createdDateTime: now,
      body: { contentType: "html", content: htmlBody },
      from: { user: { id: currentUserId, displayName: currentUserName } },
      reactions: [],
      attachments: [],
      __pending: true,
    };
    appendPendingMessage(destContextId, optimistic);

    try {
      const url = destination.kind === "chat"
        ? `/api/chats/${destination.chatId}/messages`
        : `/api/messages/${destination.teamId}/${destination.channelId}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: htmlBody }),
      });
      if (!res.ok) throw new Error("Forward failed");
      const serverMsg = (await res.json()) as MSMessage;
      replaceMessage(destContextId, tempId, serverMsg);
      showToast({ title: `Forwarded to ${destination.label}` });
    } catch {
      markMessageFailed(destContextId, tempId);
      showToast({ title: `Could not forward to ${destination.label}`, tone: "error" });
      throw new Error("Forward failed");
    }
  }

  async function handleThreadReply(messageId: string, content: string) {
    const res = await fetch(`/api/messages/${teamId}/${channelId}/${messageId}/replies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) throw new Error("Failed to send thread reply");
    return (await res.json()) as MSMessage;
  }

  async function handleToggleReaction(messageId: string, reactionType: ReactionType) {
    const action = hasReacted(messages, messageId, reactionType, currentUserId) ? "unset" : "set";
    toggleReaction(contextId, messageId, reactionType);
    try {
      const res = await fetch(`/api/messages/${teamId}/${channelId}/${messageId}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reactionType, action }),
      });
      if (!res.ok) throw new Error("Failed to update reaction");
    } catch {
      toggleReaction(contextId, messageId, reactionType);
      showToast({ title: "Could not update reaction", tone: "error" });
    }
  }

  const introCard = channel ? (
    <ChannelIntroCard
      channelName={channel.displayName}
      description={channel.description}
    />
  ) : null;

  return (
    <div key={channelId} className="context-fade-in relative flex h-full flex-col overflow-hidden">
      <ChannelMessageHeader
        name={channel?.displayName}
        description={channel?.description}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenMembers={handleOpenMembers}
        onMeetNow={() =>
          openTeamsChannelMeeting(
            channel?.displayName
              ? `${team?.displayName ?? "Channel"} — ${channel.displayName}`
              : team?.displayName ?? "Meeting"
          )
        }
        onVideoMeetNow={() =>
          openTeamsChannelMeeting(
            channel?.displayName
              ? `${team?.displayName ?? "Channel"} — ${channel.displayName}`
              : team?.displayName ?? "Meeting"
          )
        }
        voiceTrigger={
          <VoiceTrigger
            roomName={`channel-${teamId}-${channelId}`}
            displayName={channel?.displayName ? `#${channel.displayName}` : "Channel voice"}
          />
        }
      />
      {activeTab === "files" ? (
        <ContextFilesTab mode={{ kind: "channel", teamId, channelId }} />
      ) : activeTab === "messages" ? (
        <>
          <MessageFeed
            messages={messages}
            loading={loadingThisChannel}
            contextName={channel?.displayName ? `#${channel.displayName}` : "Channel"}
            bookmarkContextId={contextId}
            contextLabel={channel?.displayName ? `#${channel.displayName}` : "Channel"}
            contextId={`${teamId}/${channelId}`}
            contextKind="channel"
            currentUserId={currentUserId}
            introCard={introCard}
            anchorMessageId={anchorMessageId}
            onAnchorConsumed={handleAnchorConsumed}
            onReplyInThread={setThreadMessage}
            onForward={setForwardMessage}
            onToggleReaction={handleToggleReaction}
            onRetry={handleRetry}
            onDiscard={handleDiscard}
            onExpire={handleMessageExpire}
          />
          <MessageInput
            placeholder={`Message #${channel?.displayName ?? "channel"}`}
            onSend={handleSend}
            onAttachAndSend={handleAttachAndSend}
            uploading={uploading}
            contextId={contextId}
            allowEveryone
            allowDisappearing
            currentUserId={currentUserId}
            currentUserName={currentUserName}
          />
        </>
      ) : (
        <ComingSoonPanel label="About" />
      )}
      <ThreadPanel
        open={Boolean(threadMessage)}
        message={threadMessage}
        onClose={() => setThreadMessage(null)}
        onSendReply={handleThreadReply}
        onForward={setForwardMessage}
      />
      <ForwardMessageModal
        open={Boolean(forwardMessage)}
        onOpenChange={(next) => { if (!next) setForwardMessage(null); }}
        message={forwardMessage}
        onForward={handleForward}
      />
    </div>
  );
}

function ComingSoonPanel({ label }: { label: string }) {
  return (
    <div className="flex flex-1 items-center justify-center text-sm text-[#6c6f75]">
      {label} — coming soon
    </div>
  );
}

function sortByCreated(messages: MSMessage[]): MSMessage[] {
  return [...messages].sort(
    (a, b) => new Date(a.createdDateTime).getTime() - new Date(b.createdDateTime).getTime()
  );
}

function hasReacted(
  messages: MSMessage[],
  messageId: string,
  reactionType: ReactionType,
  currentUserId: string
): boolean {
  const message = messages.find((item) => item.id === messageId);
  const unicodeReaction = reactionEmoji(reactionType);
  return Boolean(
    message?.reactions?.some(
      (reaction) =>
        reaction.user.id === currentUserId &&
        (reaction.reactionType === reactionType || reaction.reactionType === unicodeReaction)
    )
  );
}
