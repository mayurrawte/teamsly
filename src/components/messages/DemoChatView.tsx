"use client";

import { useEffect, useState } from "react";
import { useWorkspaceStore } from "@/store/workspace";
import { mockChatMessages } from "@/lib/mock/data";
import { MessageFeed } from "./MessageFeed";
import { MessageInput } from "./MessageInput";
import { ThreadPanel } from "./ThreadPanel";
import { MessageSquare } from "lucide-react";

export function DemoChatView({ chatId }: { chatId: string }) {
  const { chats, messages, setMessages, appendMessage } = useWorkspaceStore();
  const [threadMessage, setThreadMessage] = useState<MSMessage | null>(null);
  const chat = chats.find((c) => c.id === chatId);
  const label = chat?.topic ?? chat?.members?.map((m) => m.displayName).join(", ") ?? "DM";

  useEffect(() => {
    setMessages(mockChatMessages[chatId] ?? []);
  }, [chatId]);

  async function handleSend(content: string) {
    appendMessage({
      id: `demo-dm-${Date.now()}`,
      createdDateTime: new Date().toISOString(),
      body: { contentType: "text", content },
      from: { user: { id: "you", displayName: "You" } },
      reactions: [],
    });
  }

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <div className="flex h-[49px] items-center gap-2 border-b border-[#3f4144] px-4 shadow-sm">
        <MessageSquare className="h-4 w-4 text-[#ababad]" />
        <span className="font-bold text-white">{label}</span>
        <span className="text-sm text-[#6c6f75]">— demo mode</span>
      </div>
      <MessageFeed messages={messages} loading={false} onReplyInThread={setThreadMessage} />
      <MessageInput placeholder={`Message ${label}`} onSend={handleSend} />
      <ThreadPanel
        open={Boolean(threadMessage)}
        message={threadMessage}
        onClose={() => setThreadMessage(null)}
      />
    </div>
  );
}
