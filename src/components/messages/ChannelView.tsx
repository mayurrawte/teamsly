"use client";

import { useEffect, useState } from "react";
import { useWorkspaceStore } from "@/store/workspace";
import { MessageFeed } from "./MessageFeed";
import { MessageInput } from "./MessageInput";
import { ThreadPanel } from "./ThreadPanel";
import { ChannelMessageHeader, type Tab } from "./MessageHeader";
import { ChannelIntroCard } from "./IntroCard";
import { ContextFilesTab } from "./ContextFilesTab";
import { reactionEmoji, type ReactionType } from "@/lib/utils/reactions";
import { useToastStore } from "@/store/toasts";
import { textToHtml, messagePlainText } from "@/lib/utils/render-message";
import { useMemberPanelStore } from "@/store/memberPanel";

export function ChannelView({ teamId, channelId }: { teamId: string; channelId: string }) {
  const {
    teams,
    channels,
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
  } = useWorkspaceStore();
  const [threadMessage, setThreadMessage] = useState<MSMessage | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("messages");
  const showToast = useToastStore((state) => state.showToast);
  const openChannelMembers = useMemberPanelStore((s) => s.openChannelMembers);
  const handleOpenMembers = () => openChannelMembers(teamId, channelId);

  // Stable context key for this channel's message cache
  const contextId = `${teamId}:${channelId}`;
  const messages = getMessages(contextId);

  const team = teams.find((t) => t.id === teamId);
  const channel = channels[teamId]?.find((c) => c.id === channelId);

  // Reset tab when channel changes
  useEffect(() => {
    setActiveTab("messages");
  }, [channelId]);

  useEffect(() => {
    let cancelled = false;
    const cached = getMessages(contextId);
    const isFirstLoad = cached.length === 0;

    if (isFirstLoad) setLoadingMessages(true);

    async function load() {
      try {
        const response = await fetch(`/api/messages/${teamId}/${channelId}`);
        if (!response.ok) throw new Error("Failed to load messages");
        const data = (await response.json()) as MSMessage[];
        if (!cancelled) setMessages(contextId, sortByCreated(data));
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
  }, [teamId, channelId, contextId, setLoadingMessages, setMessages, showToast]);

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
    appendPendingMessage(contextId, optimistic);

    try {
      const res = await fetch(`/api/messages/${teamId}/${channelId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error("Failed to send message");
      const serverMsg = (await res.json()) as MSMessage;
      replaceMessage(contextId, tempId, serverMsg);
    } catch {
      markMessageFailed(contextId, tempId);
      showToast({ title: "Could not send message", tone: "error" });
    }
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
    <div className="relative flex h-full flex-col overflow-hidden">
      <ChannelMessageHeader
        name={channel?.displayName}
        description={channel?.description}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenMembers={handleOpenMembers}
      />
      {activeTab === "files" ? (
        <ContextFilesTab mode={{ kind: "channel", teamId, channelId }} />
      ) : activeTab === "messages" ? (
        <>
          <MessageFeed
            messages={messages}
            loading={isLoadingMessages}
            contextName={channel?.displayName ? `#${channel.displayName}` : "Channel"}
            introCard={introCard}
            onReplyInThread={setThreadMessage}
            onToggleReaction={handleToggleReaction}
            onRetry={handleRetry}
            onDiscard={handleDiscard}
          />
          <MessageInput
            placeholder={`Message #${channel?.displayName ?? "channel"}`}
            onSend={handleSend}
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
