"use client";

import { useEffect } from "react";
import { usePreferencesStore } from "@/store/preferences";
import { useWorkspaceStore } from "@/store/workspace";
import { fireDesktopNotification } from "@/lib/utils/desktop-notification";

function localDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Fires the opt-in daily "morning brief" desktop notification once per local
 * day at the configured time. Client-side: if the app isn't open at that
 * moment, the brief fires on the next launch that day. Reads/writes prefs
 * imperatively so the 60s tick never carries a stale closure.
 */
export function MorningBriefScheduler() {
  useEffect(() => {
    function check() {
      const prefs = usePreferencesStore.getState();
      if (!prefs.morningBriefEnabled) return;

      const now = new Date();
      const todayKey = localDayKey(now);
      if (prefs.lastMorningBriefDay === todayKey) return; // already fired today

      const [hh, mm] = prefs.morningBriefTime.split(":").map((n) => parseInt(n, 10));
      if (Number.isNaN(hh) || Number.isNaN(mm)) return;
      const target = new Date(now);
      target.setHours(hh, mm, 0, 0);
      if (now < target) return; // not time yet

      const counts = useWorkspaceStore.getState().unreadCounts;
      const values = Object.values(counts).filter((c) => c > 0);
      const convos = values.length;
      const total = values.reduce((a, c) => a + c, 0);
      const body =
        total > 0
          ? `${total} unread message${total === 1 ? "" : "s"} across ${convos} conversation${convos === 1 ? "" : "s"}.`
          : "You're all caught up. Have a great day!";

      fireDesktopNotification("Good morning 👋", body, {
        tag: "teamsly-morning-brief",
        onclick: () => {
          try {
            window.focus();
          } catch {
            /* no-op */
          }
        },
      });
      prefs.setLastMorningBriefDay(todayKey);
    }

    check(); // immediate check covers the app being opened after the brief time
    const id = window.setInterval(check, 60_000);
    return () => window.clearInterval(id);
  }, []);

  return null;
}
