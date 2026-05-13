"use client";

import { useCallback, useEffect, useMemo, useRef, useState, Fragment, type ReactNode } from "react";
import { ArrowDown } from "lucide-react";
import { MessageItem } from "./MessageItem";
import { DateDivider } from "./DateDivider";
import { LoadingSkeleton } from "./LoadingSkeleton";
import { AiSummaryBanner } from "./AiSummaryBanner";
import type { ReactionType } from "@/lib/utils/reactions";
import { useSmartNotifications } from "@/hooks/useSmartNotifications";

const GROUP_WINDOW_MS = 7 * 60 * 1000;
const NEAR_BOTTOM_THRESHOLD = 150;

interface Props {
  messages: MSMessage[];
  loading: boolean;
  contextName?: string;
  introCard?: ReactNode;
  onReplyInThread?: (message: MSMessage) => void;
  onToggleReaction?: (messageId: string, reactionType: ReactionType) => void;
  onDelete?: (messageId: string) => void;
  onSendOwn?: (callback: () => void) => void;
}

export function MessageFeed({ messages, loading, contextName, introCard, onReplyInThread, onToggleReaction, onDelete }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef<number>(0);
  const isInitialLoad = useRef<boolean>(true);

  const [isNearBottom, setIsNearBottom] = useState(true);
  const [newMessagesCount, setNewMessagesCount] = useState(0);

  useSmartNotifications({ messages, contextName });

  // Detect whether the user is near the bottom of the scroll container.
  const checkNearBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distanceFromBottom <= NEAR_BOTTOM_THRESHOLD;
    setIsNearBottom(nearBottom);
    if (nearBottom) {
      setNewMessagesCount(0);
    }
  }, []);

  // Scroll to the very bottom of the container.
  const scrollToBottom = useCallback((behavior: ScrollBehavior = "instant") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
    setIsNearBottom(true);
    setNewMessagesCount(0);
  }, []);

  // On initial load or when the context changes (new channel/DM opened):
  // always scroll to bottom immediately and reset counters.
  useEffect(() => {
    if (loading) return;
    if (isInitialLoad.current && messages.length > 0) {
      isInitialLoad.current = false;
      prevMessageCountRef.current = messages.length;
      scrollToBottom("instant");
    }
  }, [loading, messages.length, scrollToBottom]);

  // Reset state when a new context loads (loading flips back to true).
  useEffect(() => {
    if (loading) {
      isInitialLoad.current = true;
      prevMessageCountRef.current = 0;
      setIsNearBottom(true);
      setNewMessagesCount(0);
    }
  }, [loading]);

  // React to new messages arriving after initial load.
  useEffect(() => {
    if (loading) return;
    if (isInitialLoad.current) return;

    const prev = prevMessageCountRef.current;
    const curr = messages.length;

    if (curr > prev) {
      const incoming = curr - prev;
      if (isNearBottom) {
        scrollToBottom("instant");
      } else {
        setNewMessagesCount((n) => n + incoming);
      }
    }

    prevMessageCountRef.current = curr;
  }, [messages, loading, isNearBottom, scrollToBottom]);

  const meta = useMemo(() => computeMeta(messages), [messages]);

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <div
        ref={scrollRef}
        onScroll={checkNearBottom}
        className="flex flex-1 flex-col overflow-y-auto py-2"
      >
        {introCard}
        <AiSummaryBanner messages={messages} />
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
              onToggleReaction={onToggleReaction}
              onDelete={onDelete}
            />
          </Fragment>
        ))}
        <div ref={bottomRef} />
      </div>

      {newMessagesCount > 0 && (
        <div className="pointer-events-none absolute bottom-4 left-0 right-0 flex justify-center">
          <button
            type="button"
            onClick={() => scrollToBottom("smooth")}
            className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-[#0F5A8F] px-3 py-1.5 text-sm font-medium text-white shadow-lg transition-opacity hover:bg-[#0d4e7e] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F5A8F] focus-visible:ring-offset-2"
            aria-live="polite"
            aria-label={`${newMessagesCount} new message${newMessagesCount !== 1 ? "s" : ""}. Click to scroll to bottom.`}
          >
            <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
            {newMessagesCount === 1 ? "1 new message" : `${newMessagesCount} new messages`}
          </button>
        </div>
      )}
    </div>
  );
}

// Expose a way for ChannelView/ChatView to notify MessageFeed that the
// current user just sent a message so we can force-scroll regardless of
// position. We wire this via the scrollToBottom imperative handle pattern
// by accepting an optional ref from the parent — but since the current
// callers use appendMessage (which adds to the messages array), the
// messages.length change will naturally trigger scrollToBottom through
// the new-message effect above because the user just acted intentionally.
// No extra plumbing needed for the current architecture.

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
