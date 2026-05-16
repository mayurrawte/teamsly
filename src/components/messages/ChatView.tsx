"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

export function ChatView({ chatId }: { chatId: string }) {
  const {
    chats,
    getMessages,
    isLoadingMessages,
    currentUserId,
    currentUserName,
    setMessages,
    appendPendingMessage,
    replaceMessage,
    markMessageFailed,
    removeMessage,
    setLoadingMessages,
    toggleReaction,
    deleteMessage,
    restoreMessage,
    editMessage,
    revertMessageEdit,
  } = useWorkspaceStore();
  const [threadMessage, setThreadMessage] = useState<MSMessage | null>(null);
  const [forwardMessage, setForwardMessage] = useState<MSMessage | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("messages");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | undefined>(undefined);
  const showToast = useToastStore((state) => state.showToast);

  // Typing indicator — heuristic, opt-in via preferences
  const typingEnabled = usePreferencesStore((s) => s.typingIndicator);
  const [clockNow, setClockNow] = useState(() => Date.now());
  useEffect(() => {
    if (!typingEnabled) return;
    const id = setInterval(() => setClockNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [typingEnabled]);

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

  // On-demand members fetch: Graph's $expand=members on the chats list is
  // unreliable (some tenants omit it). Fetch directly via the dedicated
  // members endpoint whenever the store has no members for this chat.
  const [localMembers, setLocalMembers] = useState<MSChatMember[]>([]);
  const storeMembers = chat?.members ?? [];
  const members = storeMembers.length > 0 ? storeMembers : localMembers;

  useEffect(() => {
    if (storeMembers.length > 0) return;
    let cancelled = false;
    fetch(`/api/chats/${chatId}/members`)
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data: MSChatMember[]) => { if (!cancelled) setLocalMembers(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, storeMembers.length]);

  const label = getChatLabel(chat ? { ...chat, members } : undefined, currentUserId);

  // Reset tab when chat changes
  useEffect(() => {
    setActiveTab("messages");
    setLocalMembers([]);
  }, [chatId]);

  useEffect(() => {
    let cancelled = false;
    const cached = getMessages(chatId);
    const isFirstLoad = cached.length === 0;

    if (isFirstLoad) setLoadingMessages(true);

    async function load() {
      try {
        const response = await fetch(`/api/chats/${chatId}/messages`);
        if (!response.ok) throw new Error("Failed to load chat messages");
        const data = (await response.json()) as MSMessage[];
        if (!cancelled) setMessages(chatId, sortByCreated(data));
      } catch {
        if (isFirstLoad && !cancelled) showToast({ title: "Could not load messages", tone: "error" });
      } finally {
        if (!cancelled) setLoadingMessages(false);
      }
    }

    load();

    const interval = setInterval(load, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // getMessages is a stable selector — intentionally not in deps to avoid re-running on cache updates
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, setLoadingMessages, setMessages, showToast]);

  async function handleSend(
    content: string,
    options?: { mentions?: { id: string; name: string }[] }
  ) {
    const tempId = `temp-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const optimistic: MSMessage = {
      id: tempId,
      createdDateTime: now,
      body: { contentType: "html", content: textToHtml(content) },
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
          content,
          // Only include the array when the user actually @mentioned someone.
          // The server route translates this into Graph's `mentions[]` shape
          // and rewrites the body with `<at>` markup; omit otherwise to avoid
          // the round-trip cost of an extra rewrite pass.
          ...(options?.mentions?.length ? { mentions: options.mentions } : {}),
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

  // Build mention candidates — exclude current user so they don't @mention themselves
  const mentionCandidates = members
    .filter((m) => (m.userId ?? m.id) !== currentUserId)
    .map((m) => ({ id: m.userId ?? m.id, displayName: m.displayName, email: m.email }));

  // Graph often omits `email`; fall back to userId (AAD GUID → gets 8:orgid: prefix
  // in buildCallDeeplink). Only skip a member if ALL three fields are missing.
  const callIdentifiers = otherMembers
    .map((m) => m.email ?? m.userId ?? "")
    .filter(Boolean);

  // Show call/video buttons immediately for oneOnOne chats so they are always
  // visible. If identifiers haven't loaded yet (members still fetching) the
  // handlers are no-ops — they become active once members resolve.
  const isOneOnOne = chat?.chatType === "oneOnOne";
  const handleCall = isOneOnOne
    ? () => { if (callIdentifiers.length) openTeamsCall(callIdentifiers); }
    : undefined;
  const handleVideoCall = isOneOnOne
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
      />
      {activeTab === "files" ? (
        <ContextFilesTab mode={{ kind: "chat", chatId }} />
      ) : activeTab === "messages" ? (
        <>
          <MessageFeed
            messages={messages}
            loading={isLoadingMessages}
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
