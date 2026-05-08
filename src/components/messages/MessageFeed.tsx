"use client";

import { useEffect, useMemo, useRef } from "react";
import { MessageItem } from "./MessageItem";

const GROUP_WINDOW_MS = 7 * 60 * 1000;

interface Props {
  messages: MSMessage[];
  loading: boolean;
}

export function MessageFeed({ messages, loading }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const groupHeads = useMemo(() => computeGroupHeads(messages), [messages]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-sm text-[#6c6f75]">Loading messages…</div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto py-2">
      {messages.length === 0 && (
        <div className="flex flex-1 items-center justify-center text-sm text-[#6c6f75]">
          No messages yet. Say hello!
        </div>
      )}
      {messages.map((msg, idx) => (
        <MessageItem key={msg.id} message={msg} isGroupHead={groupHeads[idx]} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

function computeGroupHeads(messages: MSMessage[]): boolean[] {
  return messages.map((msg, idx) => {
    if (idx === 0) return true;
    const prev = messages[idx - 1];
    const prevId = prev.from?.user?.id;
    const currId = msg.from?.user?.id;
    if (!prevId || !currId || prevId !== currId) return true;
    const dt = new Date(msg.createdDateTime).getTime() - new Date(prev.createdDateTime).getTime();
    if (dt > GROUP_WINDOW_MS) return true;
    if (new Date(msg.createdDateTime).toDateString() !== new Date(prev.createdDateTime).toDateString()) {
      return true;
    }
    return false;
  });
}
