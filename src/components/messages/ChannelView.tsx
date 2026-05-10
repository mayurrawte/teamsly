"use client";

import { useEffect, useState } from "react";
import { useWorkspaceStore } from "@/store/workspace";
import { MessageFeed } from "./MessageFeed";
import { MessageInput } from "./MessageInput";
import { ThreadPanel } from "./ThreadPanel";
import { Hash } from "lucide-react";
import { reactionEmoji, type ReactionType } from "@/lib/utils/reactions";
import { useToastStore } from "@/store/toasts";

export function ChannelView({ teamId, channelId }: { teamId: string; channelId: string }) {
  const { teams, channels, messages, isLoadingMessages, currentUserId, setMessages, appendMessage, setLoadingMessages, toggleReaction } =
    useWorkspaceStore();
  const [threadMessage, setThreadMessage] = useState<MSMessage | null>(null);
  const showToast = useToastStore((state) => state.showToast);

  const team = teams.find((t) => t.id === teamId);
  const channel = channels[teamId]?.find((c) => c.id === channelId);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialMessages() {
      setLoadingMessages(true);
      try {
        const response = await fetch(`/api/messages/${teamId}/${channelId}`);
        if (!response.ok) throw new Error("Failed to load messages");
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
        const response = await fetch(`/api/messages/${teamId}/${channelId}`);
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
  }, [teamId, channelId, setLoadingMessages, setMessages, showToast]);

  async function handleSend(content: string) {
    try {
      const res = await fetch(`/api/messages/${teamId}/${channelId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error("Failed to send message");
      const msg = (await res.json()) as MSMessage;
      appendMessage(msg);
    } catch {
      showToast({ title: "Could not send message", tone: "error" });
      throw new Error("Failed to send message");
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
    toggleReaction(messageId, reactionType);
    try {
      const res = await fetch(`/api/messages/${teamId}/${channelId}/${messageId}/reactions`, {
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
      <ChannelHeader name={channel?.displayName} teamName={team?.displayName} />
      <MessageFeed
        messages={messages}
        loading={isLoadingMessages}
        contextName={channel?.displayName ? `#${channel.displayName}` : "Channel"}
        onReplyInThread={setThreadMessage}
        onToggleReaction={handleToggleReaction}
      />
      <MessageInput
        placeholder={`Message #${channel?.displayName ?? "channel"}`}
        onSend={handleSend}
      />
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

function ChannelHeader({ name, teamName }: { name?: string; teamName?: string }) {
  return (
    <div className="flex h-[49px] items-center gap-2 border-b border-[#3f4144] px-4 shadow-sm">
      <Hash className="h-4 w-4 text-[#ababad]" />
      <span className="font-bold text-white">{name}</span>
      {teamName && <span className="text-sm text-[#6c6f75]">· {teamName}</span>}
    </div>
  );
}
