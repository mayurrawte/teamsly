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
          className="z-[120] h-[420px] w-[360px] rounded-lg border border-[#3f4144] bg-[#1a1d21] p-3 text-[#d1d2d3] shadow-[0_8px_32px_rgba(0,0,0,0.5)] outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <div className="mb-3 flex h-7 items-center gap-2 rounded-md border border-[#565856] bg-[#2c2d30] px-2 text-[#ababad] focus-within:border-white focus-within:bg-[#1a1d21]">
            <Search className="h-3.5 w-3.5" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search emoji"
              className="min-w-0 flex-1 bg-transparent text-[13px] text-[#d1d2d3] outline-none placeholder:text-[#ababad]"
            />
          </div>

          <section className="mb-4">
            <h3 className="mb-2 text-[12px] font-bold uppercase tracking-wide text-[#6c6f75]">Frequently used</h3>
            <div className="grid grid-cols-9 gap-1">
              {REACTION_TYPES.map((type) => (
                <EmojiButton key={type} type={type} onSelect={onSelect} />
              ))}
            </div>
          </section>

          <div className="mb-3 flex gap-1 overflow-hidden text-[11px] font-bold text-[#ababad]">
            {["Smileys", "People", "Nature", "Food"].map((label, index) => (
              <span
                key={label}
                className={`rounded px-2 py-1 ${index === 0 ? "bg-[#27292d] text-white" : "text-[#6c6f75]"}`}
              >
                {label}
              </span>
            ))}
          </div>

          <section>
            <h3 className="mb-2 text-[12px] font-bold uppercase tracking-wide text-[#6c6f75]">Teams reactions</h3>
            <div className="grid grid-cols-9 gap-1">
              {filtered.map((type) => (
                <EmojiButton key={type} type={type} onSelect={onSelect} />
              ))}
            </div>
            {filtered.length === 0 && (
              <p className="px-1 py-4 text-center text-[13px] text-[#6c6f75]">No matching reactions</p>
            )}
          </section>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function EmojiButton({ type, onSelect }: { type: ReactionType; onSelect: (reaction: ReactionType) => void }) {
  return (
    <Popover.Close asChild>
      <button
        type="button"
        aria-label={type}
        title={type}
        onClick={() => onSelect(type)}
        className="flex h-9 w-9 items-center justify-center rounded-md text-[22px] transition-colors duration-150 hover:bg-[#27292d]"
      >
        {REACTION_EMOJI[type]}
      </button>
    </Popover.Close>
  );
}
