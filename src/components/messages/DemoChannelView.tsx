"use client";

import { useEffect, useState } from "react";
import { useWorkspaceStore } from "@/store/workspace";
import { mockMessages, mockChannels } from "@/lib/mock/data";
import { MessageFeed } from "./MessageFeed";
import { MessageInput } from "./MessageInput";
import { Hash, Lock } from "lucide-react";

export function DemoChannelView({ channelId }: { channelId: string }) {
  const { activeTeamId, channels, messages, setMessages, appendMessage } = useWorkspaceStore();
  const teamChannels = activeTeamId ? (channels[activeTeamId] ?? []) : [];
  const channel = teamChannels.find((c) => c.id === channelId);

  useEffect(() => {
    const msgs = mockMessages[channelId] ?? [];
    setMessages(msgs);
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

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-[49px] items-center gap-2 border-b border-[#3f4144] px-4 shadow-sm">
        {channel?.membershipType === "private" ? (
          <Lock className="h-4 w-4 text-[#ababad]" />
        ) : (
          <Hash className="h-4 w-4 text-[#ababad]" />
        )}
        <span className="font-bold text-white">{channel?.displayName ?? channelId}</span>
        <span className="text-sm text-[#6c6f75]">— demo mode</span>
      </div>
      <MessageFeed messages={messages} loading={false} />
      <MessageInput
        placeholder={`Message #${channel?.displayName ?? "channel"}`}
        onSend={handleSend}
      />
    </div>
  );
}
