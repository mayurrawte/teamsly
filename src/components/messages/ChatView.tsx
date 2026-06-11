"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useWorkspaceStore } from "@/store/workspace";
import { usePreferencesStore } from "@/store/preferences";
import { MessageFeed } from "./MessageFeed";
import { MessageInput } from "./MessageInput";
import { ThreadPanel } from "./ThreadPanel";
import { DmMessageHeader, type Tab } from "./MessageHeader";
import { DmIntroCard } from "./IntroCard";
import { ContextFilesTab } from "./ContextFilesTab";
import { ForwardMessageModal, type ForwardDestination } from "@/components/modals/ForwardMessageModal";
import { reactionEmoji, type ReactionType } from "@/lib/utils/reactions";
import { textToHtml, messagePlainText } from "@/lib/utils/render-message";
import { useToastStore } from "@/store/toasts";
import { openTeamsCall } from "@/lib/utils/teams-deeplink";
import { getChatLabel } from "@/lib/utils/chat-label";
import { VoiceTrigger } from "@/components/voice/VoiceTrigger";
import { isDisappearing, unwrapMessage, wrapMessage, UNDECODABLE_BLOB_GRACE_MS } from "@/lib/utils/disappear";
import { useRealtimeEvents, useRealtimeHealth } from "@/hooks/useRealtimeEvents";
import { useScheduledStore } from "@/store/scheduled";

export function ChatView({ chatId }: { chatId: string }) {
  const {
    chats,
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
    deleteMessage,
    restoreMessage,
    editMessage,
    revertMessageEdit,
    patchChat,
    patchChatMembers,
  } = useWorkspaceStore();
  const isHydrated = useWorkspaceStore((s) => s.isHydrated);
  // First-load flag for THIS chat only — a cached chat never shows the skeleton.
  const loadingThisChat = useWorkspaceStore((s) => s.loadingContexts[chatId] ?? false);
  const upsertMessage = useWorkspaceStore((s) => s.upsertMessage);
  const sseHealthy = useRealtimeHealth();
  const scheduledMessages = useScheduledStore((s) => s.scheduled);
  const addScheduled = useScheduledStore((s) => s.addScheduled);
  const removeScheduled = useScheduledStore((s) => s.removeScheduled);
  const markScheduledFailed = useScheduledStore((s) => s.markFailed);
  const [threadMessage, setThreadMessage] = useState<MSMessage | null>(null);
  const [forwardMessage, setForwardMessage] = useState<MSMessage | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("messages");
  const [scheduledBannerOpen, setScheduledBannerOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | undefined>(undefined);
  const showToast = useToastStore((state) => state.showToast);

  // Typing indicator — heuristic, opt-in via preferences
  const typingEnabled = usePreferencesStore((s) => s.typingIndicator);
  const [clockNow, setClockNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setClockNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Search jump-to-message: pull `?anchor=` off the URL and forward to
  // MessageFeed. Cleared via router.replace once consumed so back/forward
  // navigation doesn't re-flash a stale row.
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const anchorMessageId = searchParams.get("anchor") ?? undefined;
  const handleAnchorConsumed = useCallback(() => {
    if (!anchorMessageId) return;
    router.replace(pathname);
  }, [anchorMessageId, pathname, router]);

  const messages = getMessages(chatId);
  const chat = chats.find((c) => c.id === chatId);

  // Pending scheduled ("send later") messages for this chat, soonest-first.
  const pendingScheduled = useMemo(
    () =>
      scheduledMessages
        .filter((m) => m.contextId === chatId && m.status === "pending")
        .sort((a, b) => a.scheduleTime - b.scheduleTime),
    [scheduledMessages, chatId]
  );

  // loadRef lets the realtime handler trigger a fetch without becoming a
  // dependency of the polling effect (which would re-run it on every change).
  const loadRef = useRef<() => Promise<void>>(async () => {});

  // Sweep expired disappearing messages that we sent — only the sender can
  // DELETE via Graph (403 for anyone else). Receivers hide locally instead.
  const sweepExpired = useCallback(async (msgs: MSMessage[]) => {
    const now = Date.now();
    for (const m of msgs) {
      if (m.__pending || m.__failed) continue;
      if (m.from?.user?.id !== currentUserId) continue; // only delete our own (Graph 403s otherwise)
      if (!isDisappearing(m.body.content)) continue;
      const payload = await unwrapMessage(chatId, m.body.content);
      if (payload) {
        if (payload.disappearAt > now) continue; // decoded but not yet expired
      } else if (now - new Date(m.createdDateTime).getTime() < UNDECODABLE_BLOB_GRACE_MS) {
        continue; // undecodable but recent — skip until it's clearly orphaned
      }
      try {
        const res = await fetch(
          `/api/chats/${chatId}/messages/${encodeURIComponent(m.id)}`,
          { method: "DELETE" }
        );
        if (res.ok) removeMessage(chatId, m.id);
      } catch {
        /* best-effort; retried on next poll */
      }
    }
  }, [chatId, currentUserId, removeMessage]);

  // Deliver any due scheduled ("send later") messages for this chat. Reads
  // the queue from the store imperatively so it isn't a dependency of the
  // polling effect. POSTs to the same endpoint as handleSend; on success we
  // drop the queue entry and reload so the message appears, on failure we
  // mark it failed so the sweep stops retrying it.
  const sweepScheduled = useCallback(async () => {
    const now = Date.now();
    const presence = useWorkspaceStore.getState().presenceMap;
    const due = useScheduledStore
      .getState()
      .scheduled.filter(
        (m) =>
          m.contextId === chatId &&
          m.status === "pending" &&
          // "Send when free" entries are gated on the recipient's presence;
          // time-based ones release once scheduleTime passes.
          (m.releaseWhenAvailable
            ? presence[m.releaseWhenAvailable] === "Available"
            : m.scheduleTime <= now)
      );
    for (const m of due) {
      let outgoing = m.content;
      if (m.disappearMs) {
        outgoing = await wrapMessage(chatId, m.content, Date.now() + m.disappearMs);
      }
      try {
        const res = await fetch(`/api/chats/${chatId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: outgoing,
            ...(m.mentions?.length ? { mentions: m.mentions } : {}),
            ...(m.disappearMs ? { contentType: "text" } : {}),
          }),
        });
        if (!res.ok) throw new Error("Failed to send scheduled message");
        removeScheduled(chatId, m.id);
        void loadRef.current();
      } catch {
        markScheduledFailed(chatId, m.id);
      }
    }
  }, [chatId, removeScheduled, markScheduledFailed]);

  // Compute typing indicator visibility — recalculates whenever clockNow ticks
  const { showTypingIndicator, typingPersonName } = useMemo(() => {
    if (!typingEnabled) return { showTypingIndicator: false, typingPersonName: "" };
    const last = messages[messages.length - 1];
    if (!last) return { showTypingIndicator: false, typingPersonName: "" };
    const senderId = last.from?.user?.id;
    if (!senderId || senderId === currentUserId) return { showTypingIndicator: false, typingPersonName: "" };
    const age = clockNow - new Date(last.createdDateTime).getTime();
    if (age > 30_000) return { showTypingIndicator: false, typingPersonName: "" };
    return {
      showTypingIndicator: true,
      typingPersonName: last.from?.user?.displayName ?? "Someone",
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typingEnabled, messages, currentUserId, clockNow]);

  // When the user navigates directly to a chat URL before the sidebar has
  // polled, `chat` is undefined. Fetch the single chat so we get chatType
  // (needed for call buttons) and topic (needed for the header label).
  useEffect(() => {
    if (chat) return;
    let cancelled = false;
    fetch(`/api/chats/${encodeURIComponent(chatId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: MSChat | null) => { if (!cancelled && data) patchChat(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, chat]);

  // On-demand members fetch: Graph's $expand=members on the chats list is
  // unreliable (some tenants omit it). Fetch directly via the dedicated
  // members endpoint whenever the store has no members for this chat.
  const [localMembers, setLocalMembers] = useState<MSChatMember[]>([]);
  const storeMembers = chat?.members ?? [];
  const members = storeMembers.length > 0 ? storeMembers : localMembers;

  useEffect(() => {
    if (storeMembers.length > 0) return;
    let cancelled = false;
    fetch(`/api/chats/${encodeURIComponent(chatId)}/members`)
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data: MSChatMember[]) => {
        if (!cancelled) {
          setLocalMembers(data);
          patchChatMembers(chatId, data);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, storeMembers.length]);

  const label = getChatLabel(chat ? { ...chat, members } : undefined, currentUserId);
  const voiceRoomName = `chat-${chatId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;

  // Reset tab when chat changes
  useEffect(() => {
    setActiveTab("messages");
    setLocalMembers([]);
  }, [chatId]);

  useEffect(() => {
    let cancelled = false;
    const cached = getMessages(chatId);
    const isFirstLoad = cached.length === 0 && isHydrated;

    if (isFirstLoad) setContextLoading(chatId, true);

    async function load() {
      try {
        const response = await fetch(`/api/chats/${chatId}/messages`);
        if (!response.ok) throw new Error("Failed to load chat messages");
        const data = (await response.json()) as MSMessage[];
        const sorted = sortByCreated(data);
        if (!cancelled) {
          setMessages(chatId, sorted);
          void sweepExpired(sorted);
        }
      } catch {
        if (isFirstLoad && !cancelled) showToast({ title: "Could not load messages", tone: "error" });
      } finally {
        if (!cancelled) setContextLoading(chatId, false);
      }
    }

    loadRef.current = load;
    load();

    // Webhook push is primary; when SSE is healthy, poll less frequently (2 min)
    // and fall back to 30 s when SSE is degraded.
    const interval = setInterval(load, sseHealthy ? 120_000 : 30_000);

    // Disappearing-message sweep stays on a fast cadence, decoupled from the
    // message fetch. It's network-free unless one of our own messages has
    // actually expired, so running it every 4s is cheap and preserves the
    // ~4s auto-delete latency the feature shipped with.
    const sweep = setInterval(() => void sweepExpired(getMessages(chatId)), 4000);

    // Scheduled ("send later") due-sweep — independent cadence, network-free
    // unless a queued message has actually come due.
    void sweepScheduled();
    const scheduleSweep = setInterval(() => void sweepScheduled(), 5000);

    // Fire-and-forget: create a Graph change notification subscription so the
    // webhook endpoint can push new DM messages via SSE instead of waiting for poll.
    fetch("/api/realtime/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId }),
    }).catch(() => { /* subscription is best-effort; poll is the fallback */ });

    // Re-subscribe before the 55-min Graph TTL so long-open views stay live.
    const resubscribe = setInterval(() => {
      fetch("/api/realtime/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId }),
      }).catch(() => { /* best-effort */ });
    }, 45 * 60 * 1000);

    return () => {
      cancelled = true;
      clearInterval(interval);
      clearInterval(sweep);
      clearInterval(scheduleSweep);
      clearInterval(resubscribe);
    };
    // getMessages is a stable selector — intentionally not in deps to avoid re-running on cache updates
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, isHydrated, sseHealthy, setContextLoading, setMessages, showToast, sweepExpired, sweepScheduled]);

  useRealtimeEvents(
    useCallback(
      (event) => {
        if (event.type === "chat_message" && event.chatId === chatId) {
          fetch(`/api/chats/${chatId}/messages/${event.messageId}`)
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
            .then((msg: MSMessage) => upsertMessage(chatId, msg))
            .catch(() => void loadRef.current());
        }
      },
      [chatId, upsertMessage]
    )
  );

  async function handleSend(
    content: string,
    options?: {
      mentions?: { id: string; name: string }[];
      disappearMs?: number;
      scheduleTime?: number;
      releaseWhenAvailable?: string;
      releaseTargetName?: string;
    }
  ) {
    // Send when free: queue the message and gate delivery on the recipient's
    // presence rather than a time. scheduleTime is set to now so the existing
    // sort/index keep working; the due-sweep checks presenceMap instead.
    if (options?.releaseWhenAvailable) {
      addScheduled({
        contextId: chatId,
        id: crypto.randomUUID(),
        content,
        ...(options.mentions?.length ? { mentions: options.mentions } : {}),
        ...(options.disappearMs ? { disappearMs: options.disappearMs } : {}),
        scheduleTime: Date.now(),
        releaseWhenAvailable: options.releaseWhenAvailable,
        releaseTargetName: options.releaseTargetName,
        createdAt: Date.now(),
        status: "pending",
      });
      showToast({
        title: `Will send when ${options.releaseTargetName ?? "they"} is free`,
      });
      return;
    }

    // Send later: queue the message client-side instead of POSTing now. The
    // due-sweep (here + Sidebar) delivers it once scheduleTime arrives. The
    // composer already cleared the draft before calling us.
    if (options?.scheduleTime && options.scheduleTime > Date.now()) {
      addScheduled({
        contextId: chatId,
        id: crypto.randomUUID(),
        content,
        ...(options.mentions?.length ? { mentions: options.mentions } : {}),
        ...(options.disappearMs ? { disappearMs: options.disappearMs } : {}),
        scheduleTime: options.scheduleTime,
        createdAt: Date.now(),
        status: "pending",
      });
      showToast({
        title: `Scheduled for ${new Date(options.scheduleTime).toLocaleString()}`,
      });
      return;
    }

    const tempId = `temp-${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    let outgoing = content;
    if (options?.disappearMs) {
      outgoing = await wrapMessage(chatId, content, Date.now() + options.disappearMs);
    }

    const optimistic: MSMessage = {
      id: tempId,
      createdDateTime: now,
      body: {
        contentType: options?.disappearMs ? "text" : "html",
        content: options?.disappearMs ? outgoing : textToHtml(content),
      },
      from: { user: { id: currentUserId, displayName: currentUserName } },
      reactions: [],
      attachments: [],
      __pending: true,
      __originalText: content,
    };
    appendPendingMessage(chatId, optimistic);

    try {
      const res = await fetch(`/api/chats/${chatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: outgoing,
          // Only include the array when the user actually @mentioned someone.
          // The server route translates this into Graph's `mentions[]` shape
          // and rewrites the body with `<at>` markup; omit otherwise to avoid
          // the round-trip cost of an extra rewrite pass.
          ...(options?.mentions?.length ? { mentions: options.mentions } : {}),
          // Disappearing messages must be stored as plain text so Graph doesn't
          // wrap the encrypted blob in HTML tags, which would break isDisappearing().
          ...(options?.disappearMs ? { contentType: "text" } : {}),
        }),
      });
      if (!res.ok) throw new Error("Failed to send chat message");
      const serverMsg = (await res.json()) as MSMessage;
      replaceMessage(chatId, tempId, serverMsg);
    } catch {
      markMessageFailed(chatId, tempId);
      showToast({ title: "Could not send message", tone: "error" });
    }
  }

  function handleAttachAndSend(content: string, file: File): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      setUploading(true);
      setUploadProgress(0);

      const form = new FormData();
      form.append("file", file);

      const xhr = new XMLHttpRequest();

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setUploadProgress(Math.round((e.loaded / e.total) * 100));
        }
      };

      xhr.onload = async () => {
        setUploadProgress(undefined);
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

        const driveItem = JSON.parse(xhr.responseText) as { id: string; name: string; webUrl: string };

        // Step 2: send chat message with attachment reference — show optimistically
        const attachmentId = crypto.randomUUID();
        // Anchor tag lets Teams' renderer render the file card inline
        const htmlBody = `${content}<attachment id="${attachmentId}"></attachment>`.trim();
        const tempId = `temp-${crypto.randomUUID()}`;
        const now = new Date().toISOString();
        const optimistic: MSMessage = {
          id: tempId,
          createdDateTime: now,
          body: { contentType: "html", content: htmlBody },
          from: { user: { id: currentUserId, displayName: currentUserName } },
          reactions: [],
          attachments: [
            {
              id: attachmentId,
              contentType: "reference",
              contentUrl: driveItem.webUrl,
              name: driveItem.name,
            },
          ],
          __pending: true,
          // Attachment messages: retry is discard-only; upload is already done.
        };
        appendPendingMessage(chatId, optimistic);

        try {
          const res = await fetch(`/api/chats/${chatId}/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              content: htmlBody,
              attachments: [
                {
                  id: attachmentId,
                  contentType: "reference",
                  contentUrl: driveItem.webUrl,
                  name: driveItem.name,
                },
              ],
            }),
          });
          if (!res.ok) throw new Error("Failed to send message with attachment");
          const serverMsg = (await res.json()) as MSMessage;
          replaceMessage(chatId, tempId, serverMsg);
          resolve();
        } catch {
          // File is already uploaded; mark failed — discard-only (no retry button
          // since we'd need to re-POST the same driveItem URL which is already there).
          markMessageFailed(chatId, tempId);
          showToast({ title: "Could not send message", tone: "error" });
          reject(new Error("Send failed"));
        }
      };

      xhr.onerror = () => {
        setUploadProgress(undefined);
        setUploading(false);
        showToast({ title: "Upload failed", tone: "error" });
        reject(new Error("Upload failed"));
      };

      xhr.open("POST", "/api/files/upload");
      xhr.send(form);
    });
  }

  async function handleThreadReply(messageId: string, content: string) {
    const res = await fetch(`/api/chats/${chatId}/messages/${messageId}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) throw new Error("Failed to send chat reply");
    return (await res.json()) as MSMessage;
  }

  async function handleDelete(messageId: string) {
    if (!window.confirm("Delete this message? This cannot be undone.")) return;
    const snapshot = deleteMessage(chatId, messageId);
    try {
      const res = await fetch(`/api/chats/${chatId}/messages/${messageId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Graph delete failed");
    } catch {
      if (snapshot) restoreMessage(chatId, snapshot.message, snapshot.index);
      showToast({ title: "Could not delete message", tone: "error" });
    }
  }

  async function handleEdit(messageId: string, newContent: string) {
    const snapshot = editMessage(chatId, messageId, textToHtml(newContent));
    try {
      const res = await fetch(`/api/chats/${chatId}/messages/${messageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newContent }),
      });
      if (!res.ok) throw new Error("Graph patch failed");
    } catch {
      if (snapshot)
        revertMessageEdit(chatId, messageId, snapshot.previousContent, snapshot.previousContentType);
      showToast({ title: "Could not edit message", tone: "error" });
    }
  }

  function handleRetry(originalText: string) {
    // Drop the failed message then re-fire the send with the original text.
    // handleSend will create a fresh optimistic entry.
    const failedMsg = messages.find(
      (m) =>
        m.__failed &&
        (m.__originalText === originalText ||
          messagePlainText(m.body.content, m.body.contentType) === originalText)
    );
    if (failedMsg) removeMessage(chatId, failedMsg.id);
    void handleSend(originalText);
  }

  function handleDiscard(messageId: string) {
    removeMessage(chatId, messageId);
  }

  // Called by MessageItem when a disappearing message's countdown reaches zero.
  // Removes the message from local state immediately so it vanishes from the UI.
  // For own messages the background sweep (sweepExpired) handles the Graph DELETE;
  // for received messages no Graph action is needed (only the sender can delete).
  const handleMessageExpire = useCallback((messageId: string) => {
    // Look up ownership BEFORE tombstoning removes the message from the store.
    const msg = getMessages(chatId).find((m) => m.id === messageId);
    const isOwn = msg?.from?.user?.id === currentUserId;
    // Tombstone so the 4s poll can't resurrect it (Graph still holds received msgs).
    expireMessage(chatId, messageId);
    // For our own messages, also delete server-side so the recipient stops
    // seeing it too. Received messages can't be deleted (Graph 403s) — the
    // local tombstone is all we can do.
    if (isOwn) {
      void fetch(`/api/chats/${chatId}/messages/${encodeURIComponent(messageId)}`, {
        method: "DELETE",
      });
    }
  }, [chatId, currentUserId, getMessages, expireMessage]);

  // Forward — optimistically append to the destination's cache and send via
  // the same /api/chats/{id}/messages or /api/messages/{teamId}/{channelId}
  // endpoints used by handleSend. We never mutate the destination's view
  // directly (the user may not be viewing it), so the optimistic entry is
  // written through the workspace store. The toast is the only feedback the
  // user sees when forwarding to a different context.
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

  async function handleToggleReaction(messageId: string, reactionType: ReactionType) {
    const action = hasReacted(messages, messageId, reactionType, currentUserId) ? "unset" : "set";
    toggleReaction(chatId, messageId, reactionType);
    try {
      const res = await fetch(`/api/chats/${chatId}/messages/${messageId}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reactionType, action }),
      });
      if (!res.ok) throw new Error("Failed to update reaction");
    } catch {
      toggleReaction(chatId, messageId, reactionType);
      showToast({ title: "Could not update reaction", tone: "error" });
    }
  }

  // Detect self-DM: no other members or the only member is current user
  const otherMembers = members.filter((m) => (m.userId ?? m.id) !== currentUserId);
  const isSelfDm = otherMembers.length === 0;

  // "Send when free" only makes sense for a 1:1 DM with a single, non-self
  // recipient — we need exactly one presence to watch.
  const whenFreeTarget =
    otherMembers.length === 1 && !isSelfDm
      ? {
          id: otherMembers[0].userId ?? otherMembers[0].id,
          name: otherMembers[0].displayName ?? "them",
        }
      : undefined;

  // Build mention candidates — exclude current user so they don't @mention themselves
  const mentionCandidates = members
    .filter((m) => (m.userId ?? m.id) !== currentUserId)
    .map((m) => ({ id: m.userId ?? m.id, displayName: m.displayName, email: m.email }));

  // Graph often omits `email`; fall back to userId (AAD GUID → gets 8:orgid: prefix
  // in buildCallDeeplink). Only skip a member if ALL three fields are missing.
  const callIdentifiers = otherMembers
    .map((m) => m.email ?? m.userId ?? "")
    .filter(Boolean);

  // Show call/video buttons for oneOnOne chats. While chatType hasn't loaded
  // yet (chat undefined or chatType null), default to showing them so the
  // buttons don't disappear and reappear — they become functional once
  // callIdentifiers resolves. Hide only when confirmed group/meeting.
  const chatType = chat?.chatType;
  const showCallButtons = chatType !== "group" && chatType !== "meeting";
  const handleCall = showCallButtons
    ? () => { if (callIdentifiers.length) openTeamsCall(callIdentifiers); }
    : undefined;
  const handleVideoCall = showCallButtons
    ? () => { if (callIdentifiers.length) openTeamsCall(callIdentifiers, { withVideo: true }); }
    : undefined;

  const introCard = (
    <DmIntroCard
      label={label}
      members={members}
      currentUserId={currentUserId}
      isSelfDm={isSelfDm}
    />
  );

  return (
    <div key={chatId} className="context-fade-in relative flex h-full flex-col overflow-hidden">
      <DmMessageHeader
        label={label}
        members={members}
        currentUserId={currentUserId}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenMembers={undefined}
        onCall={handleCall}
        onVideoCall={handleVideoCall}
        voiceTrigger={
          <VoiceTrigger
            roomName={voiceRoomName}
            displayName={label}
          />
        }
      />
      {activeTab === "files" ? (
        <ContextFilesTab mode={{ kind: "chat", chatId }} />
      ) : activeTab === "messages" ? (
        <>
          {pendingScheduled.length > 0 && (
            <div className="border-b border-[var(--border)] bg-[var(--surface)] text-[13px] text-[var(--text-secondary)]">
              <button
                type="button"
                onClick={() => setScheduledBannerOpen((v) => !v)}
                className="flex w-full items-center gap-2 px-4 py-1.5 text-left hover:text-[var(--text-primary)]"
                aria-expanded={scheduledBannerOpen}
              >
                <span aria-hidden="true">📅</span>
                <span className="font-medium text-[var(--text-primary)]">
                  {pendingScheduled.length} scheduled
                </span>
                <span className="text-[var(--text-muted)]">
                  {scheduledBannerOpen ? "Hide" : "Show"}
                </span>
              </button>
              {scheduledBannerOpen && (
                <ul className="border-t border-[var(--border)]">
                  {pendingScheduled.map((m) => (
                    <li
                      key={m.id}
                      className="flex items-center gap-3 px-4 py-1.5"
                    >
                      <span className="min-w-0 flex-1 truncate text-[var(--text-primary)]">
                        {messagePlainText(m.content, "html") || "(empty message)"}
                      </span>
                      <span className="flex-shrink-0 text-[12px] text-[var(--text-muted)]">
                        {m.releaseWhenAvailable
                          ? m.releaseTargetName
                            ? `Sends when ${m.releaseTargetName} is free`
                            : "Sends when they're free"
                          : new Date(m.scheduleTime).toLocaleString()}
                      </span>
                      <button
                        type="button"
                        aria-label="Cancel scheduled message"
                        title="Cancel scheduled message"
                        onClick={() => removeScheduled(chatId, m.id)}
                        className="flex-shrink-0 rounded p-0.5 text-[var(--text-secondary)] transition-colors duration-100 hover:bg-[var(--surface-hover)] hover:text-[var(--accent)]"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <MessageFeed
            messages={messages}
            loading={loadingThisChat}
            contextName={label}
            bookmarkContextId={chatId}
            contextLabel={label}
            contextId={chatId}
            contextKind="chat"
            currentUserId={currentUserId}
            introCard={introCard}
            anchorMessageId={anchorMessageId}
            onAnchorConsumed={handleAnchorConsumed}
            onReplyInThread={setThreadMessage}
            onForward={setForwardMessage}
            onToggleReaction={handleToggleReaction}
            onDelete={handleDelete}
            onEdit={handleEdit}
            onRetry={handleRetry}
            onDiscard={handleDiscard}
            onExpire={handleMessageExpire}
          />
          {typingEnabled && showTypingIndicator && (
            <TypingIndicator name={typingPersonName} />
          )}
          <MessageInput
            placeholder={`Message ${label}`}
            onSend={handleSend}
            onAttachAndSend={handleAttachAndSend}
            uploading={uploading}
            uploadProgress={uploadProgress}
            mentionCandidates={mentionCandidates}
            contextId={chatId}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
            channelMembers={mentionCandidates}
            allowDisappearing
            allowSchedule
            whenFreeTarget={whenFreeTarget}
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

function TypingIndicator({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-2 px-4 pb-1">
      <div className="flex h-8 items-end gap-1 rounded-2xl bg-[var(--surface)] px-3 py-2">
        <span
          className="h-1.5 w-1.5 rounded-full bg-[var(--text-muted)]"
          style={{ animation: "typing-dot 1.2s ease-in-out infinite" }}
        />
        <span
          className="h-1.5 w-1.5 rounded-full bg-[var(--text-muted)]"
          style={{ animation: "typing-dot 1.2s ease-in-out 0.2s infinite" }}
        />
        <span
          className="h-1.5 w-1.5 rounded-full bg-[var(--text-muted)]"
          style={{ animation: "typing-dot 1.2s ease-in-out 0.4s infinite" }}
        />
      </div>
      <span className="text-[12px] text-[var(--text-muted)]">{name}</span>
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
