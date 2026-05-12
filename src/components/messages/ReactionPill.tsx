"use client";

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
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex h-[26px] items-center gap-1 rounded-full border px-2 text-[13px] transition-colors duration-150",
        active
          ? "border-[#0F5A8F] bg-[rgba(15,90,143,0.2)] text-[#d1d2d3]"
          : "border-[#3f4144] bg-[#2c2d30] text-[#ababad] hover:border-[#0F5A8F] hover:bg-[rgba(15,90,143,0.1)]",
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
        className="inline-flex h-[26px] items-center rounded-full border border-[#3f4144] bg-[#2c2d30] px-2 text-[#ababad] transition-colors duration-150 hover:border-[#0F5A8F] hover:bg-[rgba(15,90,143,0.1)] hover:text-white"
      >
        <Plus size={13} />
      </button>
    </EmojiPicker>
  );
}
