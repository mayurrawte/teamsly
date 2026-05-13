"use client";

import { useEffect, useState } from "react";
import { useWorkspaceStore } from "@/store/workspace";
import { MessageFeed } from "./MessageFeed";
import { MessageInput } from "./MessageInput";
import { ThreadPanel } from "./ThreadPanel";
import { DmMessageHeader, type Tab } from "./MessageHeader";
import { DmIntroCard } from "./IntroCard";
import { reactionEmoji, type ReactionType } from "@/lib/utils/reactions";
import { textToHtml } from "@/lib/utils/render-message";
import { useToastStore } from "@/store/toasts";
import { openTeamsCall } from "@/lib/utils/teams-deeplink";

export function ChatView({ chatId }: { chatId: string }) {
  const { chats, messages, isLoadingMessages, currentUserId, setMessages, appendMessage, setLoadingMessages, toggleReaction, deleteMessage, restoreMessage, editMessage, revertMessageEdit } =
    useWorkspaceStore();
  const [threadMessage, setThreadMessage] = useState<MSMessage | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("messages");
  const [uploading, setUploading] = useState(false);
  const showToast = useToastStore((state) => state.showToast);

  const chat = chats.find((c) => c.id === chatId);
  const label = getChatLabel(chat, currentUserId);
  const members = chat?.members ?? [];

  // Reset tab when chat changes
  useEffect(() => {
    setActiveTab("messages");
  }, [chatId]);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialMessages() {
      setLoadingMessages(true);
      try {
        const response = await fetch(`/api/chats/${chatId}/messages`);
        if (!response.ok) throw new Error("Failed to load chat messages");
        const data = (await response.json()) as MSMessage[];
        if (!cancelled) setMessages(sortByCreated(data));
      } catch {
        if (!cancelled) showToast({ title: "Could not load messages", tone: "error" });
      } finally {
        if (!cancelled) setLoadingMessages(false);
      }
    }

    async function pollMessages() {
      try {
        const response = await fetch(`/api/chats/${chatId}/messages`);
        if (!response.ok) return;
        const data = (await response.json()) as MSMessage[];
        if (!cancelled) setMessages(sortByCreated(data));
      } catch {
        // Avoid noisy repeated toasts during background polling.
      }
    }

    loadInitialMessages();

    const interval = setInterval(pollMessages, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [chatId, setLoadingMessages, setMessages, showToast]);

  async function handleSend(content: string) {
    try {
      const res = await fetch(`/api/chats/${chatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error("Failed to send chat message");
      const msg = (await res.json()) as MSMessage;
      appendMessage(msg);
    } catch {
      showToast({ title: "Could not send message", tone: "error" });
      throw new Error("Failed to send message");
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

    // Step 2: send chat message with attachment reference
    const attachmentId = crypto.randomUUID();
    // Anchor tag lets Teams' renderer render the file card inline
    const htmlBody = `${content}<attachment id="${attachmentId}"></attachment>`.trim();
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
      const msg = (await res.json()) as MSMessage;
      appendMessage(msg);
    } catch (err) {
      showToast({ title: "Could not send message", tone: "error" });
      setUploading(false);
      throw err;
    }

    setUploading(false);
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
    const snapshot = deleteMessage(messageId);
    try {
      const res = await fetch(`/api/chats/${chatId}/messages/${messageId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Graph delete failed");
    } catch {
      if (snapshot) restoreMessage(snapshot.message, snapshot.index);
      showToast({ title: "Could not delete message", tone: "error" });
    }
  }

  async function handleEdit(messageId: string, newContent: string) {
    const snapshot = editMessage(messageId, textToHtml(newContent));
    try {
      const res = await fetch(`/api/chats/${chatId}/messages/${messageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newContent }),
      });
      if (!res.ok) throw new Error("Graph patch failed");
    } catch {
      if (snapshot) revertMessageEdit(messageId, snapshot.previousContent, snapshot.previousContentType);
      showToast({ title: "Could not edit message", tone: "error" });
    }
  }

  async function handleToggleReaction(messageId: string, reactionType: ReactionType) {
    const action = hasReacted(messages, messageId, reactionType, currentUserId) ? "unset" : "set";
    toggleReaction(messageId, reactionType);
    try {
      const res = await fetch(`/api/chats/${chatId}/messages/${messageId}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reactionType, action }),
      });
      if (!res.ok) throw new Error("Failed to update reaction");
    } catch {
      toggleReaction(messageId, reactionType);
      showToast({ title: "Could not update reaction", tone: "error" });
    }
  }

  // Detect self-DM: no other members or the only member is current user
  const otherMembers = members.filter((m) => (m.userId ?? m.id) !== currentUserId);
  const isSelfDm = otherMembers.length === 0;

  const callEmails = otherMembers.map((m) => m.email ?? "").filter(Boolean);

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
        {...(callEmails.length > 0 && {
          onCall: () => openTeamsCall(callEmails),
          onVideoCall: () => openTeamsCall(callEmails, { withVideo: true }),
        })}
      />
      {activeTab === "messages" ? (
        <>
          <MessageFeed
            messages={messages}
            loading={isLoadingMessages}
            contextName={label}
            introCard={introCard}
            onReplyInThread={setThreadMessage}
            onToggleReaction={handleToggleReaction}
            onDelete={handleDelete}
            onEdit={handleEdit}
          />
          <MessageInput
            placeholder={`Message ${label}`}
            onSend={handleSend}
            onAttachAndSend={handleAttachAndSend}
            uploading={uploading}
          />
        </>
      ) : (
        <ComingSoonPanel label={activeTab === "files" ? "Files" : "About"} />
      )}
      <ThreadPanel
        open={Boolean(threadMessage)}
        message={threadMessage}
        onClose={() => setThreadMessage(null)}
        onSendReply={handleThreadReply}
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

function getChatLabel(chat: MSChat | undefined, currentUserId: string): string {
  if (!chat) return "Direct Message";
  if (chat.topic) return chat.topic;

  const members = chat.members ?? [];
  if (members.length === 0) return "Direct Message";

  const otherMembers = members.filter((m) => (m.userId ?? m.id) !== currentUserId);

  if (otherMembers.length === 0) {
    const currentUserName = members[0]?.displayName ?? "You";
    return `${currentUserName} (you)`;
  }

  return otherMembers.map((m) => m.displayName).join(", ");
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
