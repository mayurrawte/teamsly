"use client";

import { useEffect, useState } from "react";
import { useWorkspaceStore } from "@/store/workspace";
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
  const showToast = useToastStore((state) => state.showToast);

  const messages = getMessages(chatId);
  const chat = chats.find((c) => c.id === chatId);
  const label = getChatLabel(chat, currentUserId);
  const members = chat?.members ?? [];

  // Reset tab when chat changes
  useEffect(() => {
    setActiveTab("messages");
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

    const interval = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // getMessages is a stable selector — intentionally not in deps to avoid re-running on cache updates
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, setLoadingMessages, setMessages, showToast]);

  async function handleSend(content: string) {
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
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error("Failed to send chat message");
      const serverMsg = (await res.json()) as MSMessage;
      replaceMessage(chatId, tempId, serverMsg);
    } catch {
      markMessageFailed(chatId, tempId);
      showToast({ title: "Could not send message", tone: "error" });
    }
  }

  async function handleAttachAndSend(content: string, file: File) {
    setUploading(true);

    // Step 1: upload file to OneDrive via /me/drive/root:/Apps/Teamsly/{name}
    let driveItem: { id: string; name: string; webUrl: string };
    try {
      const form = new FormData();
      form.append("file", file);
      const uploadRes = await fetch("/api/files/upload", { method: "POST", body: form });
      if (!uploadRes.ok) {
        const err = (await uploadRes.json()) as { error?: string };
        throw new Error(err.error ?? "Upload failed");
      }
      driveItem = (await uploadRes.json()) as { id: string; name: string; webUrl: string };
    } catch (err) {
      showToast({ title: err instanceof Error ? err.message : "Upload failed", tone: "error" });
      setUploading(false);
      throw err;
    }

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
    setUploading(false);

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
    } catch {
      // File is already uploaded; mark failed — discard-only (no retry button
      // since we'd need to re-POST the same driveItem URL which is already there).
      markMessageFailed(chatId, tempId);
      showToast({ title: "Could not send message", tone: "error" });
    }
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

  // Graph often omits `email` on chat members; fall back to userId so the
  // deeplink still resolves. Teams' `users=` param accepts UPN/GUID/email.
  const callIdentifiers = otherMembers
    .map((m) => m.email ?? m.userId ?? m.id ?? "")
    .filter(Boolean);

  const introCard = (
    <DmIntroCard
      label={label}
      members={members}
      currentUserId={currentUserId}
      isSelfDm={isSelfDm}
    />
  );

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <DmMessageHeader
        label={label}
        members={members}
        currentUserId={currentUserId}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenMembers={undefined}
        {...(callIdentifiers.length > 0 && {
          onCall: () => openTeamsCall(callIdentifiers),
          onVideoCall: () => openTeamsCall(callIdentifiers, { withVideo: true }),
        })}
      />
      {activeTab === "files" ? (
        <ContextFilesTab mode={{ kind: "chat", chatId }} />
      ) : activeTab === "messages" ? (
        <>
          <MessageFeed
            messages={messages}
            loading={isLoadingMessages}
            contextName={label}
            contextId={chatId}
            contextKind="chat"
            introCard={introCard}
            onReplyInThread={setThreadMessage}
            onForward={setForwardMessage}
            onToggleReaction={handleToggleReaction}
            onDelete={handleDelete}
            onEdit={handleEdit}
            onRetry={handleRetry}
            onDiscard={handleDiscard}
          />
          <MessageInput
            placeholder={`Message ${label}`}
            onSend={handleSend}
            onAttachAndSend={handleAttachAndSend}
            uploading={uploading}
            mentionCandidates={mentionCandidates}
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
