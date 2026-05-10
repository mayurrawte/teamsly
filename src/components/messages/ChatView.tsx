"use client";

import { useEffect, useState } from "react";
import { useWorkspaceStore } from "@/store/workspace";
import { MessageFeed } from "./MessageFeed";
import { MessageInput } from "./MessageInput";
import { ThreadPanel } from "./ThreadPanel";
import { MessageSquare } from "lucide-react";
import { reactionEmoji, type ReactionType } from "@/lib/utils/reactions";
import { useToastStore } from "@/store/toasts";

export function ChatView({ chatId }: { chatId: string }) {
  const { chats, messages, isLoadingMessages, currentUserId, setMessages, appendMessage, setLoadingMessages, toggleReaction } =
    useWorkspaceStore();
  const [threadMessage, setThreadMessage] = useState<MSMessage | null>(null);
  const showToast = useToastStore((state) => state.showToast);

  const chat = chats.find((c) => c.id === chatId);
  const label = chat?.topic ?? chat?.members?.map((m) => m.displayName).join(", ") ?? "Direct Message";

  useEffect(() => {
    let cancelled = false;

    async function loadInitialMessages() {
      setLoadingMessages(true);
      try {
        const response = await fetch(`/api/chats/${chatId}/messages`);
        if (!response.ok) throw new Error("Failed to load chat messages");
        const data = (await response.json()) as MSMessage[];
        if (!cancelled) setMessages([...data].reverse());
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
        if (!cancelled) setMessages([...data].reverse());
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

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <div className="flex h-[49px] items-center gap-2 border-b border-[#3f4144] px-4 shadow-sm">
        <MessageSquare className="h-4 w-4 text-[#ababad]" />
        <span className="font-bold text-white">{label}</span>
      </div>
      <MessageFeed
        messages={messages}
        loading={isLoadingMessages}
        contextName={label}
        onReplyInThread={setThreadMessage}
        onToggleReaction={handleToggleReaction}
      />
      <MessageInput placeholder={`Message ${label}`} onSend={handleSend} />
      <ThreadPanel
        open={Boolean(threadMessage)}
        message={threadMessage}
        onClose={() => setThreadMessage(null)}
        onSendReply={handleThreadReply}
      />
    </div>
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
