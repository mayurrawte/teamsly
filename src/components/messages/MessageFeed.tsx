"use client";

import { useEffect, useRef } from "react";
import { MessageItem } from "./MessageItem";

interface Props {
  messages: MSMessage[];
  loading: boolean;
}

export function MessageFeed({ messages, loading }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-sm text-[#6c6f75]">Loading messages…</div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-4 py-4">
      {messages.length === 0 && (
        <div className="flex flex-1 items-center justify-center text-sm text-[#6c6f75]">
          No messages yet. Say hello!
        </div>
      )}
      {messages.map((msg) => (
        <MessageItem key={msg.id} message={msg} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
