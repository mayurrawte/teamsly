"use client";

import { useEffect, useMemo, useRef, Fragment } from "react";
import { MessageItem } from "./MessageItem";
import { DateDivider } from "./DateDivider";
import { LoadingSkeleton } from "./LoadingSkeleton";

const GROUP_WINDOW_MS = 7 * 60 * 1000;

interface Props {
  messages: MSMessage[];
  loading: boolean;
  onReplyInThread?: (message: MSMessage) => void;
}

export function MessageFeed({ messages, loading, onReplyInThread }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const meta = useMemo(() => computeMeta(messages), [messages]);

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="flex flex-1 flex-col overflow-y-auto py-2">
      {messages.length === 0 && (
        <div className="flex flex-1 items-center justify-center text-sm text-[#6c6f75]">
          No messages yet. Say hello!
        </div>
      )}
      {messages.map((msg, idx) => (
        <Fragment key={msg.id}>
          {meta[idx].showDivider && <DateDivider date={msg.createdDateTime} />}
          <MessageItem
            message={msg}
            isGroupHead={meta[idx].isGroupHead}
            onReplyInThread={onReplyInThread}
          />
        </Fragment>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

interface MessageMeta {
  isGroupHead: boolean;
  showDivider: boolean;
}

function computeMeta(messages: MSMessage[]): MessageMeta[] {
  return messages.map((msg, idx) => {
    if (idx === 0) {
      return { isGroupHead: true, showDivider: true };
    }
    const prev = messages[idx - 1];
    const dayChanged =
      new Date(msg.createdDateTime).toDateString() !== new Date(prev.createdDateTime).toDateString();
    if (dayChanged) {
      return { isGroupHead: true, showDivider: true };
    }
    const prevId = prev.from?.user?.id;
    const currId = msg.from?.user?.id;
    if (!prevId || !currId || prevId !== currId) {
      return { isGroupHead: true, showDivider: false };
    }
    const dt = new Date(msg.createdDateTime).getTime() - new Date(prev.createdDateTime).getTime();
    if (dt > GROUP_WINDOW_MS) {
      return { isGroupHead: true, showDivider: false };
    }
    return { isGroupHead: false, showDivider: false };
  });
}
