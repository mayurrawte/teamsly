"use client";

import { useEffect } from "react";
import { useWorkspaceStore } from "@/store/workspace";
import { MessageFeed } from "./MessageFeed";
import { MessageInput } from "./MessageInput";
import { MessageSquare } from "lucide-react";

export function ChatView({ chatId }: { chatId: string }) {
  const { chats, messages, isLoadingMessages, setMessages, appendMessage, setLoadingMessages } =
    useWorkspaceStore();

  const chat = chats.find((c) => c.id === chatId);
  const label = chat?.topic ?? chat?.members?.map((m) => m.displayName).join(", ") ?? "Direct Message";

  useEffect(() => {
    setLoadingMessages(true);
    fetch(`/api/chats/${chatId}/messages`)
      .then((r) => r.json())
      .then((data: MSMessage[]) => {
        setMessages([...data].reverse());
        setLoadingMessages(false);
      });

    const interval = setInterval(() => {
      fetch(`/api/chats/${chatId}/messages`)
        .then((r) => r.json())
        .then((data: MSMessage[]) => setMessages([...data].reverse()));
    }, 5000);

    return () => clearInterval(interval);
  }, [chatId]);

  async function handleSend(content: string) {
    const res = await fetch(`/api/chats/${chatId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    const msg = await res.json();
    appendMessage(msg);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-[49px] items-center gap-2 border-b border-[#3f4144] px-4 shadow-sm">
        <MessageSquare className="h-4 w-4 text-[#ababad]" />
        <span className="font-bold text-white">{label}</span>
      </div>
      <MessageFeed messages={messages} loading={isLoadingMessages} />
      <MessageInput placeholder={`Message ${label}`} onSend={handleSend} />
    </div>
  );
}
