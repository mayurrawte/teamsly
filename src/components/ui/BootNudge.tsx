"use client";

/**
 * BootNudge — a small "tip of the day" banner shown at most once per local
 * day. Pure Hooked-loop variable-reward play: every cold boot might surface
 * something new and useful, so launching the app feels rewarding rather
 * than rote.
 *
 * Tips rotate deterministically by date so different users see different
 * tips on the same day but everyone sees the same tip on the same day
 * (predictable for the user, easy to debug for us).
 *
 * Dismissal updates `lastNudgeDay` so the next mount on the same day is
 * silent. No "snooze forever" yet — the rotation is the snooze.
 */

import { useEffect, useState } from "react";
import { X, Sparkles } from "lucide-react";
import { usePreferencesStore } from "@/store/preferences";

const TIPS = [
  "Press ⌘K from anywhere to jump to a channel or DM.",
  "Hover a message and press 1–6 to react instantly.",
  "Hit the Sparkles button (top-right) to get an AI catch-up on what you missed.",
  "Type / in the composer for slash commands. Roll dice, post a poll, summon a GIF.",
  "Out of office? Auto-status syncs your status from your Outlook calendar.",
  "Paste a GitHub PR/issue URL and Teamsly renders a live preview card.",
  "Press Esc to close any modal. Press it twice to bail out of nested ones.",
  "Click the mic on a channel header to start a Discord-style voice room.",
  "Make your own slash commands in Preferences → Messages & media.",
  "Light mode, dark mode, custom accent hex — Preferences → Appearance.",
  "Drafts survive reloads. Type, refresh, your half-message is still there.",
  "Use mute keywords in Preferences → Notifications to filter out the noise.",
  "Save a message for later with the bookmark icon — find it under Later in the sidebar.",
  "Cmd+Shift+F toggles focus mode. Sidebar quiets down, only @mentions break through.",
];

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function tipForDay(day: string): string {
  // Hash YYYY-MM-DD into a stable index. Same day → same tip across users.
  let hash = 0;
  for (let i = 0; i < day.length; i++) hash = (hash * 31 + day.charCodeAt(i)) | 0;
  const index = Math.abs(hash) % TIPS.length;
  return TIPS[index];
}

export function BootNudge() {
  const lastNudgeDay = usePreferencesStore((s) => s.lastNudgeDay);
  const setLastNudgeDay = usePreferencesStore((s) => s.setLastNudgeDay);
  const [visible, setVisible] = useState(false);
  const [tip, setTip] = useState<string>("");

  useEffect(() => {
    const today = todayKey();
    if (lastNudgeDay !== today) {
      setTip(tipForDay(today));
      // Defer briefly so the banner fades in after the initial layout
      // settles — otherwise it visibly snaps into place on cold boot.
      const t = window.setTimeout(() => setVisible(true), 600);
      return () => window.clearTimeout(t);
    }
  }, [lastNudgeDay]);

  function dismiss() {
    setVisible(false);
    setLastNudgeDay(todayKey());
  }

  if (!visible || !tip) return null;

  return (
    <div
      role="status"
      className="boot-nudge pointer-events-auto fixed bottom-4 left-1/2 z-40 flex max-w-[460px] -translate-x-1/2 items-start gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3.5 py-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.35)]"
    >
      <Sparkles className="mt-[2px] h-3.5 w-3.5 flex-shrink-0 text-[var(--accent)]" aria-hidden />
      <p className="flex-1 text-[12.5px] leading-snug text-[var(--text-primary)]">{tip}</p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss tip"
        className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] focus-ring"
      >
        <X size={12} />
      </button>
    </div>
  );
}
