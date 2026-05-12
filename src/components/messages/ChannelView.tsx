"use client";

import { useEffect, useState } from "react";
import { useWorkspaceStore } from "@/store/workspace";
import { MessageFeed } from "./MessageFeed";
import { MessageInput } from "./MessageInput";
import { ThreadPanel } from "./ThreadPanel";
import { ChannelMessageHeader, type Tab } from "./MessageHeader";
import { ChannelIntroCard } from "./IntroCard";
import { reactionEmoji, type ReactionType } from "@/lib/utils/reactions";
import { useToastStore } from "@/store/toasts";

export function ChannelView({ teamId, channelId }: { teamId: string; channelId: string }) {
  const { teams, channels, messages, isLoadingMessages, currentUserId, setMessages, appendMessage, setLoadingMessages, toggleReaction } =
    useWorkspaceStore();
  const [threadMessage, setThreadMessage] = useState<MSMessage | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("messages");
  const showToast = useToastStore((state) => state.showToast);

  const team = teams.find((t) => t.id === teamId);
  const channel = channels[teamId]?.find((c) => c.id === channelId);

  // Reset tab when channel changes
  useEffect(() => {
    setActiveTab("messages");
  }, [channelId]);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialMessages() {
      setLoadingMessages(true);
      try {
        const response = await fetch(`/api/messages/${teamId}/${channelId}`);
        if (!response.ok) throw new Error("Failed to load messages");
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
        const response = await fetch(`/api/messages/${teamId}/${channelId}`);
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

  const introCard = channel ? (
    <ChannelIntroCard
      channelName={channel.displayName}
      description={channel.description}
    />
  ) : null;

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <ChannelMessageHeader
        name={channel?.displayName}
        description={channel?.description}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      {activeTab === "messages" ? (
        <>
          <MessageFeed
            messages={messages}
            loading={isLoadingMessages}
            contextName={channel?.displayName ? `#${channel.displayName}` : "Channel"}
            introCard={introCard}
            onReplyInThread={setThreadMessage}
            onToggleReaction={handleToggleReaction}
          />
          <MessageInput
            placeholder={`Message #${channel?.displayName ?? "channel"}`}
            onSend={handleSend}
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
