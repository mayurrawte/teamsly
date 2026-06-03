"use client";

/**
 * PollCard — renders a reactions-as-votes poll inside the message list. Votes
 * are real Graph reactions (shared + live), but the card shows aggregate counts
 * only, never voter names — the "anonymous in Teamsly" presentation. The footer
 * states the caveat so nobody mistakes it for true anonymity.
 */

import { BarChart3 } from "lucide-react";
import type { ReactionType } from "@/lib/utils/reactions";
import { tallyVotes, type ParsedPoll } from "@/lib/polls";

// MSMessage is an ambient global type (see src/types/graph.ts), not a module export.

export function PollCard({
  poll,
  message,
  currentUserId,
  onVote,
  disabled,
}: {
  poll: ParsedPoll;
  message: MSMessage;
  currentUserId: string;
  onVote: (reactionType: ReactionType) => void;
  disabled?: boolean;
}) {
  const { counts, total, myVotes } = tallyVotes(message, poll.options, currentUserId);

  return (
    <div className="mt-1 max-w-[440px] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
      <div className="flex items-start gap-2 border-b border-[var(--border)] px-3 py-2.5">
        <BarChart3 className="mt-[1px] h-4 w-4 flex-shrink-0 text-[var(--accent)]" aria-hidden />
        <p className="text-[13.5px] font-bold leading-snug text-[var(--text-primary)]">
          {poll.question}
        </p>
      </div>

      <div className="flex flex-col gap-1.5 p-2.5">
        {poll.options.map((opt, i) => {
          const pct = total ? Math.round((counts[i] / total) * 100) : 0;
          const voted = myVotes[i];
          return (
            <button
              key={i}
              type="button"
              disabled={disabled}
              onClick={() => onVote(opt.reactionType)}
              aria-pressed={voted}
              className={`group relative flex w-full items-center gap-2.5 overflow-hidden rounded-md border px-2.5 py-1.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 focus-ring ${
                voted
                  ? "border-[var(--accent)] bg-[var(--accent)]/10"
                  : "border-[var(--border)] bg-[var(--surface-raised)] hover:border-[var(--border-input)]"
              }`}
            >
              {/* Fill bar behind the row content. */}
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 bg-[var(--accent)]/15 transition-[width] duration-300"
                style={{ width: `${pct}%` }}
              />
              <span className="relative z-[1] text-[15px] leading-none">{opt.emoji}</span>
              <span className="relative z-[1] flex-1 truncate text-[13px] text-[var(--text-primary)]">
                {opt.text}
              </span>
              <span className="relative z-[1] flex-shrink-0 tabular-nums text-[12px] text-[var(--text-muted)]">
                {pct}% · {counts[i]}
              </span>
            </button>
          );
        })}
      </div>

      <p className="px-3 pb-2.5 text-[11px] text-[var(--text-muted)]">
        {total} {total === 1 ? "vote" : "votes"} · anonymous in Teamsly
      </p>
    </div>
  );
}
