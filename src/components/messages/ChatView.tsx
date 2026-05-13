"use client";

import { useEffect, useState } from "react";
import { useWorkspaceStore } from "@/store/workspace";
import { MessageFeed } from "./MessageFeed";
import { MessageInput } from "./MessageInput";
import { ThreadPanel } from "./ThreadPanel";
import { DmMessageHeader, type Tab } from "./MessageHeader";
import { DmIntroCard } from "./IntroCard";
import { reactionEmoji, type ReactionType } from "@/lib/utils/reactions";
import { useToastStore } from "@/store/toasts";

export function ChatView({ chatId }: { chatId: string }) {
  const { chats, messages, isLoadingMessages, currentUserId, setMessages, appendMessage, setLoadingMessages, toggleReaction } =
    useWorkspaceStore();
  const [threadMessage, setThreadMessage] = useState<MSMessage | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("messages");
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

  async function handleThreadReply(messageId: string, content: string) {
    const res = await fetch(`/api/chats/${chatId}/messages/${messageId}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) throw new Error("Failed to send chat reply");
    return (await res.json()) as MSMessage;
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
          />
          <MessageInput placeholder={`Message ${label}`} onSend={handleSend} />
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
