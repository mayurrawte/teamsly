"use client";

import { useMemo, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Search } from "lucide-react";
import { REACTION_EMOJI, REACTION_TYPES, type ReactionType } from "@/lib/utils/reactions";

interface EmojiPickerProps {
  children: React.ReactNode;
  onSelect: (reaction: ReactionType) => void;
}

export function EmojiPicker({ children, onSelect }: EmojiPickerProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return REACTION_TYPES;
    return REACTION_TYPES.filter((type) => type.includes(normalized));
  }, [query]);

  return (
    <Popover.Root>
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          align="end"
          sideOffset={8}
          className="z-[120] h-[420px] w-[360px] rounded-lg border border-[var(--border)] bg-[var(--modal-bg)] p-3 text-[var(--text-primary)] shadow-[0_8px_32px_rgba(0,0,0,0.5)] outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <div className="mb-3 flex h-7 items-center gap-2 rounded-md border border-[var(--border-input)] bg-[var(--surface)] px-2 text-[var(--text-secondary)] focus-within:border-[var(--text-primary)] focus-within:bg-[var(--modal-bg)]">
            <Search className="h-3.5 w-3.5" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search emoji"
              className="min-w-0 flex-1 bg-transparent text-[13px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-secondary)]"
            />
          </div>

          <section className="mb-4">
            <h3 className="mb-2 text-[12px] font-bold uppercase tracking-wide text-[var(--text-muted)]">Frequently used</h3>
            <div className="grid grid-cols-9 gap-1">
              {REACTION_TYPES.map((type, index) => (
                <EmojiButton key={type} type={type} index={index} onSelect={onSelect} />
              ))}
            </div>
          </section>

          <div className="mb-3 flex gap-1 overflow-hidden text-[11px] font-bold text-[var(--text-secondary)]">
            {["Smileys", "People", "Nature", "Food"].map((label, index) => (
              <span
                key={label}
                className={`rounded px-2 py-1 ${index === 0 ? "bg-[var(--surface-raised)] text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}
              >
                {label}
              </span>
            ))}
          </div>

          <section>
            <h3 className="mb-2 text-[12px] font-bold uppercase tracking-wide text-[var(--text-muted)]">Teams reactions</h3>
            <div className="grid grid-cols-9 gap-1">
              {filtered.map((type, index) => (
                <EmojiButton key={type} type={type} index={index} onSelect={onSelect} />
              ))}
            </div>
            {filtered.length === 0 && (
              <p className="px-1 py-4 text-center text-[13px] text-[var(--text-muted)]">No matching reactions</p>
            )}
          </section>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function EmojiButton({
  type,
  index,
  onSelect,
}: {
  type: ReactionType;
  index: number;
  onSelect: (reaction: ReactionType) => void;
}) {
  return (
    <Popover.Close asChild>
      <button
        type="button"
        aria-label={type}
        title={type}
        onClick={() => onSelect(type)}
        // motion-fade-up staggers the picker's open entrance (capped at index 20
        // so a long filtered list doesn't trail on forever); the hover/focus pop
        // is a separate transform-only affordance for picking an emoji. Combined
        // into one arbitrary `transition` property — two separate Tailwind
        // transition-property utilities (transition-colors + transition-transform)
        // would collide via tailwind-merge and silently drop the color fade.
        className="motion-fade-up flex h-9 w-9 items-center justify-center rounded-md text-[22px] [transition:background-color_150ms_ease,transform_var(--motion-fast)_var(--ease-snap)] hover:scale-125 hover:bg-[var(--surface-hover)] focus-visible:scale-125"
        style={{ animationDelay: `${Math.min(index, 20) * 12}ms` }}
      >
        {REACTION_EMOJI[type]}
      </button>
    </Popover.Close>
  );
}
