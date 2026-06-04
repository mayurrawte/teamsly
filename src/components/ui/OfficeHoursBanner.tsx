"use client";

/**
 * OfficeHoursBanner — a self-facing nudge shown when the user is currently
 * OUTSIDE their configured office hours. Pure work/life-balance play: a gentle
 * "you're off the clock" reminder, never shown to teammates (office-hours prefs
 * are local-only).
 *
 * Dismissal parks the banner until the next boundary (the next office-hours
 * start) so it can't re-nag during the same off-period, and survives reloads
 * via `officeHoursDismissedUntil` in prefs. It re-arms naturally once the user
 * is back within hours.
 */

import { Moon, X } from "lucide-react";
import { usePreferencesStore } from "@/store/preferences";
import { useOfficeHours } from "@/hooks/useOfficeHours";

export function OfficeHoursBanner() {
  const { enabled, withinHours, nextBoundary, label } = useOfficeHours();
  const dismissedUntil = usePreferencesStore((s) => s.officeHoursDismissedUntil);
  const setDismissedUntil = usePreferencesStore((s) => s.setOfficeHoursDismissedUntil);

  const dismissed = dismissedUntil !== null && Date.now() < dismissedUntil;
  if (!enabled || withinHours || dismissed) return null;

  function dismiss() {
    // Park until we'd next be within hours; fall back to 1h if no boundary.
    setDismissedUntil(nextBoundary ?? Date.now() + 60 * 60 * 1000);
  }

  return (
    <div
      role="status"
      className="boot-nudge pointer-events-auto fixed top-4 left-1/2 z-40 flex max-w-[460px] -translate-x-1/2 items-start gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3.5 py-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.35)]"
    >
      <Moon className="mt-[2px] h-3.5 w-3.5 flex-shrink-0 text-[var(--accent)]" aria-hidden />
      <p className="flex-1 text-[12.5px] leading-snug text-[var(--text-primary)]">
        You&rsquo;re outside your office hours
        <span className="text-[var(--text-muted)]"> · {label}</span>
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss office-hours reminder"
        className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] focus-ring"
      >
        <X size={12} />
      </button>
    </div>
  );
}
