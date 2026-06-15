"use client";

import { useEffect, useState } from "react";
import { usePreferencesStore } from "@/store/preferences";
import { HomeTips } from "./HomeTips";

export function FirstRunWelcome() {
  const hasSeenWelcome = usePreferencesStore((s) => s.hasSeenWelcome);
  const setHasSeenWelcome = usePreferencesStore((s) => s.setHasSeenWelcome);
  const [visible, setVisible] = useState(false);

  // Read the persisted flag only after mount so a previously-dismissed card
  // doesn't flash in before Zustand rehydrates from localStorage (mirrors BootNudge).
  useEffect(() => {
    if (!hasSeenWelcome) setVisible(true);
  }, [hasSeenWelcome]);

  function dismiss() {
    setHasSeenWelcome(true);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="mb-6 flex-shrink-0 rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold text-[var(--text-primary)]">Welcome to Teamsly 👋</h2>
          <p className="mt-1 text-[13px] text-[var(--text-secondary)]">A few things to get you started:</p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="flex-shrink-0 rounded-md px-2.5 py-1 text-[12px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
        >
          Got it
        </button>
      </div>
      <div className="mt-3">
        <HomeTips />
      </div>
    </div>
  );
}
