"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Hash, Lock, MessageSquare, Search, X } from "lucide-react";

export interface JumpToItem {
  id: string;
  type: "channel" | "dm";
  label: string;
  subtitle: string;
  private?: boolean;
  onSelect: () => void;
}

interface JumpToSwitcherProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: JumpToItem[];
}

export function JumpToSwitcher({ open, onOpenChange, items }: JumpToSwitcherProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const source = normalized
      ? items.filter((item) => `${item.label} ${item.subtitle}`.toLowerCase().includes(normalized))
      : items;
    return source.slice(0, 12);
  }, [items, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  function selectItem(item: JumpToItem | undefined) {
    if (!item) return;
    item.onSelect();
    setQuery("");
    onOpenChange(false);
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) setQuery("");
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="search-modal-overlay fixed inset-0 z-[60] bg-[rgba(0,0,0,0.7)] backdrop-blur-[2px]" />
        <Dialog.Content
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            inputRef.current?.focus();
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActiveIndex((index) => Math.min(index + 1, filtered.length - 1));
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((index) => Math.max(index - 1, 0));
            }
            if (event.key === "Enter") {
              event.preventDefault();
              selectItem(filtered[activeIndex]);
            }
          }}
          className="search-modal-content fixed left-1/2 top-1/2 z-[70] flex max-h-[70vh] w-[640px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-[#3f4144] bg-[#1a1d21] text-[#d1d2d3] shadow-[0_16px_64px_rgba(0,0,0,0.6)] outline-none"
        >
          <Dialog.Title className="sr-only">Jump to</Dialog.Title>
          <div className="flex items-center border-b border-[#3f4144]">
            <Search className="ml-5 h-5 w-5 flex-shrink-0 text-[#ababad]" />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Jump to..."
              className="h-[58px] min-w-0 flex-1 bg-transparent px-3 text-[18px] text-[#d1d2d3] outline-none placeholder:text-[#6c6f75]"
            />
            <Dialog.Close
              aria-label="Close jump to"
              className="mr-3 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-[#ababad] transition-colors duration-150 hover:bg-[#27292d] hover:text-white"
            >
              <X size={16} />
            </Dialog.Close>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            <h3 className="px-3 pb-2 text-[12px] font-bold uppercase tracking-wide text-[#6c6f75]">
              {query.trim() ? "Results" : "Recent"}
            </h3>
            {filtered.length === 0 ? (
              <p className="px-3 py-8 text-center text-[13px] text-[#6c6f75]">No matching channels or DMs</p>
            ) : (
              <div className="flex flex-col gap-1">
                {filtered.map((item, index) => (
                  <button
                    key={`${item.type}-${item.id}`}
                    type="button"
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => selectItem(item)}
                    className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors duration-[80ms] ${
                      index === activeIndex ? "bg-[#1164a3] text-white" : "text-[#d1d2d3] hover:bg-[#27292d]"
                    }`}
                  >
                    <span
                      className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded ${
                        index === activeIndex ? "bg-white/15 text-white" : "bg-[#2c2d30] text-[#ababad]"
                      }`}
                    >
                      {item.type === "channel" ? (
                        item.private ? <Lock size={14} /> : <Hash size={14} />
                      ) : (
                        <MessageSquare size={14} />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-bold">{item.label}</span>
                      <span className={`block truncate text-[12px] ${index === activeIndex ? "text-white/75" : "text-[#6c6f75]"}`}>
                        {item.subtitle}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
