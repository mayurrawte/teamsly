"use client";

import { useState } from "react";
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
  const [animating, setAnimating] = useState(false);

  function handleClick() {
    setAnimating(true);
    setTimeout(() => setAnimating(false), 200);
    onClick();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      style={{ animation: animating ? "reaction-pop 200ms ease-out" : undefined }}
      className={[
        "inline-flex h-[24px] items-center gap-1 rounded-full border px-2 text-[12px] transition-colors duration-150 focus-ring",
        active
          ? "border-[var(--accent)] bg-[var(--reaction-active-bg)] text-[var(--text-primary)]"
          : "border-[var(--reaction-border)] bg-[var(--reaction-bg)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:bg-[var(--reaction-active-bg)]",
      ].join(" ")}
    >
      <span>{reactionEmoji(reactionType)}</span>
      <span>{count}</span>
    </button>
  );
}

export function AddReactionPill({ onSelect }: { onSelect: (reaction: ReactionType) => void }) {
  return (
    <EmojiPicker onSelect={onSelect}>
      <button
        type="button"
        aria-label="Add reaction"
        className="inline-flex h-[24px] items-center rounded-full border border-[var(--reaction-border)] bg-[var(--reaction-bg)] px-2 text-[var(--text-secondary)] transition-colors duration-150 hover:border-[var(--accent)] hover:bg-[var(--reaction-active-bg)] hover:text-white focus-ring"
      >
        <Plus size={13} />
      </button>
    </EmojiPicker>
  );
}
