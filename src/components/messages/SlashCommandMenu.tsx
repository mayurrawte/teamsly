"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { SLASH_COMMANDS, type SlashCommand } from "@/lib/slash-commands";
import type { KeyboardEvent } from "react";

function filterCommands(query: string): SlashCommand[] {
  if (!query) return SLASH_COMMANDS.slice(0, 8);
  const q = query.toLowerCase();
  return SLASH_COMMANDS.filter(
    (c) =>
      c.name.startsWith(q) ||
      (c.aliases ?? []).some((a) => a.startsWith(q))
  ).slice(0, 8);
}

interface MenuProps {
  filtered: SlashCommand[];
  selectedIdx: number;
  onHover: (idx: number) => void;
  onPick: (cmd: SlashCommand) => void;
  open: boolean;
}

export function SlashCommandMenu({ filtered, selectedIdx, onHover, onPick, open }: MenuProps) {
  const [entering, setEntering] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      setEntering(true);
      timerRef.current = setTimeout(() => setEntering(false), 200);
    } else {
      if (timerRef.current) clearTimeout(timerRef.current);
      setEntering(false);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [open]);

  if (!open || filtered.length === 0) return null;

  return (
    <div
      role="listbox"
      aria-label="Slash command suggestions"
      className={cn(
        "absolute bottom-full left-0 z-[120] mb-1 w-80 overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface)] shadow-lg",
        entering && "slash-menu-enter"
      )}
    >
      <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        Commands
      </div>
      {filtered.map((cmd, idx) => (
        <button
          key={cmd.name}
          role="option"
          aria-selected={idx === selectedIdx}
          type="button"
          onMouseEnter={() => onHover(idx)}
          onMouseDown={(e) => {
            e.preventDefault();
            onPick(cmd);
          }}
          className={cn(
            "flex w-full items-baseline gap-2 px-3 py-1.5 text-left transition-colors duration-100",
            idx === selectedIdx
              ? "bg-[var(--surface-hover)]"
              : "hover:bg-[var(--surface-hover)]"
          )}
        >
          <span className="w-24 flex-shrink-0 font-mono text-[13px] font-medium text-[var(--accent)]">
            /{cmd.name}
          </span>
          <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--text-primary)]">
            {cmd.description}
          </span>
          <span className="flex-shrink-0 font-mono text-[10px] text-[var(--text-muted)]">
            {cmd.usage.replace(`/${cmd.name}`, "").trim()}
          </span>
        </button>
      ))}
    </div>
  );
}

export function useSlashMenu({
  open,
  query,
  onSelect,
  onClose,
}: {
  open: boolean;
  query: string;
  onSelect: (cmd: SlashCommand) => void;
  onClose: () => void;
}) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const filtered = filterCommands(query);

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  function handleKey(e: KeyboardEvent): boolean {
    if (!open || filtered.length === 0) return false;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => (i + 1) % filtered.length);
      return true;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => (i - 1 + filtered.length) % filtered.length);
      return true;
    }
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      onSelect(filtered[selectedIdx]);
      return true;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return true;
    }
    return false;
  }

  return { filtered, selectedIdx, setSelectedIdx, handleKey };
}
