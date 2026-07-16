"use client";

import { useState, type ReactNode } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { remindPresets, parseNaturalTime } from "@/lib/utils/reminder-time";

interface Props {
  /** Rendered as the Radix trigger (the toolbar clock button). */
  children: ReactNode;
  /** Called with the chosen due time (epoch ms). Parent creates the reminder. */
  onPick: (fireAt: number) => void;
}

/**
 * "Remind me" dropdown for a message: quick presets, a natural-language box,
 * and a native datetime fallback. Radix gives outside-click/Escape dismissal
 * and keyboard nav for free. NL parsing is fully client-side (`parseNaturalTime`)
 * — phrases it can't resolve get a hint pointing at the presets/date picker.
 */
export function RemindMeMenu({ children, onPick }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>{children}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="bottom"
          align="end"
          sideOffset={4}
          className="z-[200] w-[220px] rounded-md border border-[var(--border)] bg-[#1a1d21] py-1 shadow-[0_4px_16px_rgba(0,0,0,0.4)]"
        >
          <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Remind me
          </div>
          {remindPresets().map((preset) => (
            <DropdownMenu.Item
              key={preset.label}
              onSelect={() => onPick(preset.fireAt)}
              className="flex cursor-pointer items-center px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none hover:bg-[var(--surface-hover)] focus:bg-[var(--surface-hover)]"
            >
              {preset.label}
            </DropdownMenu.Item>
          ))}

          <DropdownMenu.Separator className="my-1 h-px bg-[var(--border)]" />

          {/* Keep focus inside the input rather than letting Radix's typeahead
              steal keystrokes; stop selection from closing the menu on Enter. */}
          <div
            className="px-3 py-1.5"
            onKeyDown={(e) => e.stopPropagation()}
          >
            <NaturalLanguageRow onPick={(at) => { onPick(at); setOpen(false); }} />
            <CustomTimeRow onPick={(at) => { onPick(at); setOpen(false); }} />
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function NaturalLanguageRow({ onPick }: { onPick: (fireAt: number) => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const phrase = value.trim();
    if (!phrase) return;
    const parsed = parseNaturalTime(phrase);
    if (parsed) {
      onPick(parsed);
      return;
    }
    setError("Couldn't read that time — try a preset or pick below.");
  }

  return (
    <div className="mb-2">
      <label htmlFor="remind-nl" className="mb-1 block text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
        Or type a time
      </label>
      <div className="flex gap-1">
        <input
          id="remind-nl"
          type="text"
          value={value}
          placeholder="in 3h, tomorrow 9am…"
          onChange={(e) => { setValue(e.target.value); setError(null); }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
          className="min-w-0 flex-1 rounded border border-[var(--border)] bg-[var(--message-bg)] px-1.5 py-1 text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus-ring"
        />
        <button
          type="button"
          disabled={!value.trim()}
          onClick={submit}
          className="rounded bg-[var(--accent)] px-2 py-1 text-[11px] font-medium text-white transition-colors disabled:opacity-40"
        >
          Set
        </button>
      </div>
      {error && <p className="mt-1 text-[10px] text-[var(--status-busy)]">{error}</p>}
    </div>
  );
}

function CustomTimeRow({ onPick }: { onPick: (fireAt: number) => void }) {
  const [value, setValue] = useState("");
  const parsed = new Date(value).getTime();
  const valid = !Number.isNaN(parsed) && parsed > Date.now();
  return (
    <div>
      <label htmlFor="remind-custom" className="mb-1 block text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
        Or pick a date &amp; time
      </label>
      <div className="flex gap-1">
        <input
          id="remind-custom"
          type="datetime-local"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="min-w-0 flex-1 rounded border border-[var(--border)] bg-[var(--message-bg)] px-1.5 py-1 text-[11px] text-[var(--text-primary)] focus-ring"
        />
        <button
          type="button"
          disabled={!valid}
          onClick={() => { if (valid) onPick(parsed); }}
          className="rounded bg-[var(--accent)] px-2 py-1 text-[11px] font-medium text-white transition-colors disabled:opacity-40"
        >
          Set
        </button>
      </div>
    </div>
  );
}
