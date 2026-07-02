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
  /** Stable bookmark key for this feed — chatId or ${teamId}:${channelId}. */
  bookmarkContextId?: string;
  /** Human-readable label of where these messages live ("#general", "Alex Wu"). */
  contextLabel?: string;
  /** Identifier passed through to useSmartNotifications for the de-dupe guard. */
  contextId?: string;
  /** Tells the notification guard which URL pattern to compare against. */
  contextKind?: "chat" | "channel";
  /** Current user's Graph id — own messages are suppressed from notifications. */
  currentUserId?: string;
  introCard?: ReactNode;
  /**
   * If set, the feed scroll-anchors to the message with this id and flashes
   * the row briefly (~1.5s). Re-runs when the id changes or when the target
   * message first appears in `messages` (handles the case where polling
   * hasn't fetched it yet on navigation).
   *
   * Trade-off: we don't fetch surrounding messages on demand. Microsoft
   * Graph's chat-messages endpoint doesn't support `$skipToken`-based
   * positioning around a specific message id well enough to justify a new
   * route. The per-context cache (F51/F67) plus the 5s polling in
   * ChannelView/ChatView normally has the message within a few seconds; if
   * the message is older than the loaded window (max 200 entries per
   * context — see workspace store), the anchor effect waits silently until
   * the row mounts, which may never happen. The feed still renders the
   * window normally — we don't blank out.
   */
  anchorMessageId?: string;
  /**
   * Called after the anchor has been scrolled into view + flashed, so the
   * parent can clear the URL `?anchor=` param (or the demo store hint).
   */
  onAnchorConsumed?: () => void;
  onReplyInThread?: (message: MSMessage) => void;
  onForward?: (message: MSMessage) => void;
  onRemind?: (message: MSMessage, fireAt: number) => void;
  onToggleReaction?: (messageId: string, reactionType: ReactionType) => void;
  onDelete?: (messageId: string) => void;
  onEdit?: (messageId: string, newContent: string) => Promise<void> | void;
  onRetry?: (originalText: string) => void;
  onDiscard?: (messageId: string) => void;
  onSendOwn?: (callback: () => void) => void;
  onExpire?: (messageId: string) => void;
}

// How long to leave the flash highlight on the anchored row before fading.
const ANCHOR_FLASH_MS = 1500;
// Fallback: if the anchor message never shows up (older than the loaded
// window, or wrong context), give up and clear the hint after this long so
// the URL doesn't keep stale state.
const ANCHOR_GIVE_UP_MS = 4000;

export function MessageFeed({ messages, loading, contextName, bookmarkContextId, contextLabel, contextId, contextKind, currentUserId, introCard, anchorMessageId, onAnchorConsumed, onReplyInThread, onForward, onRemind, onToggleReaction, onDelete, onEdit, onRetry, onDiscard, onExpire }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef<number>(0);
  const prevLastIdRef = useRef<string | null>(null);
  const isInitialLoad = useRef<boolean>(true);
  // The user's *intent* to stay glued to the newest message. Kept in a ref
  // (updated synchronously on scroll) so the ResizeObserver below reads it
  // without re-subscribing; mirrored in isNearBottom state for rendering.
  const pinnedRef = useRef(true);

  const [isNearBottom, setIsNearBottom] = useState(true);
  const [newMessagesCount, setNewMessagesCount] = useState(0);

  const INITIAL_CAP = 100;
  const CAP_STEP = 100;
  const [visibleCount, setVisibleCount] = useState(INITIAL_CAP);

  useSmartNotifications({ messages, contextName, contextId, contextKind, currentUserId });

  // Detect whether the user is near the bottom of the scroll container.
  const checkNearBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distanceFromBottom <= NEAR_BOTTOM_THRESHOLD;
    pinnedRef.current = nearBottom; // sync, so the ResizeObserver never acts on stale intent
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
    pinnedRef.current = true;
    setIsNearBottom(true);
    setNewMessagesCount(0);
  }, []);

  // Stay glued to the newest message while the user is pinned to the bottom.
  // Scroll effects alone aren't enough: images, GIFs, link previews and cards
  // load after the effect ran and grow the feed, leaving the view stranded
  // short of the latest message. Any content growth while pinned re-snaps.
  // Re-runs when the skeleton gives way to the real feed — on first render the
  // early return below means the refs aren't attached yet.
  const showSkeleton = loading && messages.length === 0;
  useEffect(() => {
    if (showSkeleton) return;
    const content = contentRef.current;
    const el = scrollRef.current;
    if (!content || !el) return;
    const ro = new ResizeObserver(() => {
      if (pinnedRef.current) {
        el.scrollTop = el.scrollHeight;
      }
    });
    ro.observe(content);
    return () => ro.disconnect();
  }, [showSkeleton]);

  // Reset scroll state whenever the open context changes (channel/DM switch).
  // We key on contextId rather than the `loading` flag because a *cached*
  // context never flips loading true — so relying on loading meant opening a
  // cached chat left the feed wherever it was instead of pinned to the latest
  // message. Defined before the scroll-to-bottom effect so the ref is reset
  // first within the same commit.
  useEffect(() => {
    isInitialLoad.current = true;
    prevMessageCountRef.current = 0;
    prevLastIdRef.current = null;
    pinnedRef.current = true;
    setIsNearBottom(true);
    setNewMessagesCount(0);
    setVisibleCount(INITIAL_CAP);
  }, [contextId]);

  // On initial load or context change: once messages are present and not
  // loading, scroll straight to the latest message.
  useEffect(() => {
    if (loading) return;
    if (isInitialLoad.current && messages.length > 0) {
      isInitialLoad.current = false;
      prevMessageCountRef.current = messages.length;
      prevLastIdRef.current = messages[messages.length - 1]?.id ?? null;
      scrollToBottom("instant");
    }
  }, [loading, messages, scrollToBottom, contextId]);

  // React to new messages arriving after initial load. A new tail is detected
  // by the last message id changing, not just count growth — the store caps
  // each context (old entries evicted as new ones arrive), so count alone
  // misses arrivals once a conversation is at the cap.
  useEffect(() => {
    if (loading) return;
    if (isInitialLoad.current) return;

    const prev = prevMessageCountRef.current;
    const curr = messages.length;
    const last = messages[curr - 1];
    const lastId = last?.id ?? null;
    const newTail = lastId !== null && lastId !== prevLastIdRef.current;

    if (curr > prev || newTail) {
      const ownMessage = !!currentUserId && last?.from?.user?.id === currentUserId;
      if (ownMessage) {
        // Sending always returns you to the bottom, even if you were scrolled
        // up reading history — never show a "new message" badge for yourself.
        scrollToBottom("instant");
      } else if (isNearBottom) {
        // Instant, not smooth: the ResizeObserver re-snaps as async content
        // grows, and a smooth animation would fight it (and rapid arrivals).
        scrollToBottom("instant");
      } else {
        setNewMessagesCount((n) => n + Math.max(curr - prev, 1));
      }
    }

    prevMessageCountRef.current = curr;
    prevLastIdRef.current = lastId;
  }, [messages, loading, isNearBottom, scrollToBottom, currentUserId]);

  // Track which anchor request we've already handled so polling refetches
  // don't re-flash the row every 5s. We tag each request with the current
  // anchor id; selecting the *same* message again from search produces a
  // fresh effect cycle (anchorMessageId goes undefined → set after the
  // parent clears + the user re-clicks), and the previous-anchor reset
  // below keeps us responsive in that case.
  const consumedAnchorRef = useRef<string | null>(null);
  const lastAnchorRef = useRef<string | null>(null);

  useEffect(() => {
    // Reset the consumed marker whenever the requested anchor changes,
    // including back to the same id after a falsy gap — otherwise picking
    // the same message twice would silently no-op the second time.
    if (lastAnchorRef.current !== (anchorMessageId ?? null)) {
      lastAnchorRef.current = anchorMessageId ?? null;
      consumedAnchorRef.current = null;
    }
    if (!anchorMessageId) return;
    if (consumedAnchorRef.current === anchorMessageId) return;
    // Wait until messages have rendered — during the LoadingSkeleton phase
    // there is no scroll container to query.
    if (loading) return;

    // Try to find the row. Re-fires when messages.length changes (polling
    // pulled the target into the window) — DM/channel views use 5s polling
    // (F51) that can blow away pending messages; this effect tolerates the
    // array changing under it.
    const scroll = scrollRef.current;
    if (!scroll) return;

    const fullIdx = messages.findIndex((m) => m.id === anchorMessageId);
    if (fullIdx >= 0 && messages.length - fullIdx > visibleCount) {
      setVisibleCount(messages.length - fullIdx + 10);
      return; // re-runs after the slice grows (messages.length / visibleCount dep) and the row mounts
    }

    const node = scroll.querySelector<HTMLElement>(
      `[data-message-id="${cssEscape(anchorMessageId)}"]`
    );

    if (node) {
      consumedAnchorRef.current = anchorMessageId;
      node.scrollIntoView({ behavior: "smooth", block: "center" });
      node.classList.add("message-anchor-flash");
      const t = window.setTimeout(() => {
        node.classList.remove("message-anchor-flash");
        onAnchorConsumed?.();
      }, ANCHOR_FLASH_MS);
      return () => window.clearTimeout(t);
    }

    // Anchor not present yet — schedule a fallback so we don't loop forever.
    // If polling never brings the row in (older than the loaded window), we
    // give up after ANCHOR_GIVE_UP_MS so the URL anchor doesn't stick.
    const giveUp = window.setTimeout(() => {
      // Mark consumed to stop retrying; let the parent clear its hint.
      consumedAnchorRef.current = anchorMessageId;
      onAnchorConsumed?.();
    }, ANCHOR_GIVE_UP_MS);
    return () => window.clearTimeout(giveUp);
    // Re-run when the array length changes so we re-try once the target row
    // is added by a polling refetch.
  }, [anchorMessageId, loading, messages, messages.length, onAnchorConsumed, visibleCount]);

  const visible = useMemo(
    () => (messages.length > visibleCount ? messages.slice(-visibleCount) : messages),
    [messages, visibleCount]
  );
  const meta = useMemo(() => computeMeta(visible), [visible]);
  const hasOlder = messages.length > visible.length;

  // Show skeleton only on first load (no messages yet). During background
  // polling refreshes (loading=true but messages already present) keep the
  // existing message list visible so the UI doesn't flash.
  if (showSkeleton) return <LoadingSkeleton />;

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <div
        ref={scrollRef}
        onScroll={checkNearBottom}
        className="flex flex-1 flex-col overflow-y-auto py-2"
      >
        {/* Single wrapper so the stick-to-bottom ResizeObserver sees every
            content change; min-h-full keeps the empty state centered. */}
        <div ref={contentRef} className="flex min-h-full flex-col">
        {introCard}
        <AiSummaryBanner messages={messages} />
        {messages.length === 0 && (
          <div className="flex flex-1 items-center justify-center text-sm text-[#6c6f75]">
            No messages yet. Say hello!
          </div>
        )}
        {hasOlder && (
          <button
            type="button"
            onClick={() => {
              const el = scrollRef.current;
              const before = el?.scrollHeight ?? 0;
              setVisibleCount((c) => c + CAP_STEP);
              requestAnimationFrame(() => {
                const el2 = scrollRef.current;
                if (el2) el2.scrollTop += el2.scrollHeight - before;
              });
            }}
            className="mx-auto my-2 rounded-full border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-1 text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            Load older messages
          </button>
        )}
        {visible.map((msg, idx) => (
          <Fragment key={msg.id}>
            {meta[idx].showDivider && <DateDivider date={msg.createdDateTime} />}
            <MessageItem
              message={msg}
              isGroupHead={meta[idx].isGroupHead}
              contextId={bookmarkContextId}
              contextLabel={contextLabel}
              onReplyInThread={onReplyInThread}
              onForward={onForward}
              onRemind={onRemind}
              onToggleReaction={onToggleReaction}
              onDelete={onDelete}
              onEdit={onEdit}
              onRetry={onRetry}
              onDiscard={onDiscard}
              onExpire={onExpire}
            />
          </Fragment>
        ))}
        <div ref={bottomRef} />
        </div>
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

// Own sends are force-scrolled by the new-message effect above (the last
// message's author is the current user), so no imperative handle from
// ChannelView/ChatView is needed.

// CSS.escape is supported in every browser we ship to (Electron 28+, modern
// evergreens). Tiny wrapper so the call site is readable.
function cssEscape(value: string): string {
  if (typeof window !== "undefined" && typeof window.CSS?.escape === "function") {
    return window.CSS.escape(value);
  }
  // Fallback — escape characters that would terminate an attribute selector.
  return value.replace(/(["\\])/g, "\\$1");
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
