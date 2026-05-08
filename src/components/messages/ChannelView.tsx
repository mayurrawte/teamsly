"use client";

import { useEffect, useRef } from "react";
import { useWorkspaceStore } from "@/store/workspace";
import { MessageFeed } from "./MessageFeed";
import { MessageInput } from "./MessageInput";
import { Hash } from "lucide-react";

export function ChannelView({ teamId, channelId }: { teamId: string; channelId: string }) {
  const { teams, channels, messages, isLoadingMessages, setMessages, appendMessage, setLoadingMessages } =
    useWorkspaceStore();

  const team = teams.find((t) => t.id === teamId);
  const channel = channels[teamId]?.find((c) => c.id === channelId);

  useEffect(() => {
    setLoadingMessages(true);
    fetch(`/api/messages/${teamId}/${channelId}`)
      .then((r) => r.json())
      .then((data: MSMessage[]) => {
        setMessages([...data].reverse());
        setLoadingMessages(false);
      });

    // Poll for new messages every 5s (replace with webhooks in production)
    const interval = setInterval(() => {
      fetch(`/api/messages/${teamId}/${channelId}`)
        .then((r) => r.json())
        .then((data: MSMessage[]) => setMessages([...data].reverse()));
    }, 5000);

    return () => clearInterval(interval);
  }, [teamId, channelId]);

  async function handleSend(content: string) {
    const res = await fetch(`/api/messages/${teamId}/${channelId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    const msg = await res.json();
    appendMessage(msg);
  }

  return (
    <div className="flex h-full flex-col">
      <ChannelHeader name={channel?.displayName} teamName={team?.displayName} />
      <MessageFeed messages={messages} loading={isLoadingMessages} />
      <MessageInput
        placeholder={`Message #${channel?.displayName ?? "channel"}`}
        onSend={handleSend}
      />
    </div>
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
