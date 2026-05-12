"use client";

import { useEffect, useState } from "react";
import { useWorkspaceStore } from "@/store/workspace";
import { mockMessages } from "@/lib/mock/data";
import { MessageFeed } from "./MessageFeed";
import { MessageInput } from "./MessageInput";
import { ThreadPanel } from "./ThreadPanel";
import { ChannelMessageHeader, type Tab } from "./MessageHeader";
import { ChannelIntroCard } from "./IntroCard";

export function DemoChannelView({ channelId }: { channelId: string }) {
  const { activeTeamId, channels, messages, setMessages, appendMessage, toggleReaction } = useWorkspaceStore();
  const [threadMessage, setThreadMessage] = useState<MSMessage | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("messages");
  const teamChannels = activeTeamId ? (channels[activeTeamId] ?? []) : [];
  const channel = teamChannels.find((c) => c.id === channelId);

  useEffect(() => {
    const msgs = mockMessages[channelId] ?? [];
    setMessages(msgs);
    setActiveTab("messages");
  }, [channelId]);

  async function handleSend(content: string) {
    const newMsg: MSMessage = {
      id: `demo-${Date.now()}`,
      createdDateTime: new Date().toISOString(),
      body: { contentType: "text", content },
      from: { user: { id: "you", displayName: "You" } },
      reactions: [],
    };
    appendMessage(newMsg);
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
        name={channel?.displayName ?? channelId}
        description={channel?.description}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      {activeTab === "messages" ? (
        <>
          <MessageFeed
            messages={messages}
            loading={false}
            contextName={channel?.displayName ? `#${channel.displayName}` : "Channel"}
            introCard={introCard}
            onReplyInThread={setThreadMessage}
            onToggleReaction={toggleReaction}
          />
          <MessageInput
            placeholder={`Message #${channel?.displayName ?? "channel"}`}
            onSend={handleSend}
          />
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center text-sm text-[#6c6f75]">
          {activeTab === "files" ? "Files" : "About"} — coming soon
        </div>
      )}
      <ThreadPanel
        open={Boolean(threadMessage)}
        message={threadMessage}
        onClose={() => setThreadMessage(null)}
      />
    </div>
  );
}
