"use client";

import { useState, useEffect, useRef } from "react";
import { Plus } from "lucide-react";
import { EmojiPicker } from "./EmojiPicker";
import { reactionEmoji, type ReactionType } from "@/lib/utils/reactions";

interface ReactionPillProps {
  reactionType: string;
  count: number;
  active?: boolean;
  onClick: () => void;
}

export function ReactionPill({ reactionType, count, active, onClick }: ReactionPillProps) {
  const [bursting, setBursting] = useState(false);
  const [showPlusOne, setShowPlusOne] = useState(false);
  const prevCountRef = useRef(count);
  const prevActiveRef = useRef(active);
  const burstTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const plusOneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const countIncreased = count > prevCountRef.current;
    const justActivated = active && !prevActiveRef.current;

    if (countIncreased || justActivated) {
      setBursting(false);
      // Force a re-render cycle so re-adding the class re-triggers the animation
      requestAnimationFrame(() => {
        setBursting(true);
        if (burstTimerRef.current) clearTimeout(burstTimerRef.current);
        burstTimerRef.current = setTimeout(() => setBursting(false), 360);
      });

      if (justActivated) {
        setShowPlusOne(true);
        if (plusOneTimerRef.current) clearTimeout(plusOneTimerRef.current);
        plusOneTimerRef.current = setTimeout(() => setShowPlusOne(false), 620);
      }
    }

    prevCountRef.current = count;
    prevActiveRef.current = active;
  }, [count, active]);

  useEffect(() => {
    return () => {
      if (burstTimerRef.current) clearTimeout(burstTimerRef.current);
      if (plusOneTimerRef.current) clearTimeout(plusOneTimerRef.current);
    };
  }, []);

  function handleClick() {
    onClick();
  }

  return (
    <span className="relative inline-flex">
      {showPlusOne && (
        <span
          aria-hidden="true"
          className="react-plus-one pointer-events-none absolute bottom-full left-1/2 z-10 text-[11px] font-bold text-[var(--accent)]"
        >
          +1
        </span>
      )}
      <button
        type="button"
        onClick={handleClick}
        className={[
          "inline-flex h-6 items-center gap-1 rounded-md border px-2 py-0.5 text-[12px] transition-colors duration-150 focus-ring",
          bursting ? "react-burst" : "",
          active
            ? "border-[var(--accent)] bg-[var(--reaction-active-bg)] text-[var(--text-primary)]"
            : "border-[var(--reaction-border)] bg-[var(--reaction-bg)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:bg-[var(--reaction-active-bg)]",
        ].join(" ")}
      >
        <span>{reactionEmoji(reactionType)}</span>
        <span>{count}</span>
      </button>
    </span>
  );
}

export function AddReactionPill({ onSelect }: { onSelect: (reaction: ReactionType) => void }) {
  return (
    <EmojiPicker onSelect={onSelect}>
      <button
        type="button"
        aria-label="Add reaction"
        className="inline-flex h-6 items-center rounded-md border border-[var(--reaction-border)] bg-[var(--reaction-bg)] px-2 py-0.5 text-[var(--text-secondary)] transition-colors duration-150 hover:border-[var(--accent)] hover:bg-[var(--reaction-active-bg)] hover:text-[var(--text-primary)] focus-ring"
      >
        <Plus size={13} />
      </button>
    </EmojiPicker>
  );
}
