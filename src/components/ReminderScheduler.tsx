"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRemindersStore } from "@/store/reminders";
import { fireDesktopNotification } from "@/lib/utils/desktop-notification";

/**
 * Fires due action-item reminders as desktop notifications. Client-side and
 * best-effort: if the app isn't open when a reminder comes due, it fires on
 * the next 60s tick after the app reopens. Clicking a notification focuses the
 * window and navigates to the reminder's source conversation. Mirrors
 * MorningBriefScheduler — reads store state imperatively so the tick never
 * carries a stale closure.
 */
export function ReminderScheduler() {
  const router = useRouter();

  useEffect(() => {
    function check() {
      const { reminders, remove } = useRemindersStore.getState();
      const now = Date.now();
      for (const r of reminders) {
        if (r.fireAt > now) continue;
        fireDesktopNotification("Reminder", r.task, {
          tag: `teamsly-reminder-${r.id}`,
          onclick: () => {
            try {
              window.focus();
            } catch {
              /* no-op */
            }
            router.push(r.sourceHref);
          },
        });
        remove(r.id);
      }
    }

    check();
    const id = window.setInterval(check, 60_000);
    return () => window.clearInterval(id);
    // `router` is referenced in the notification onclick, so it's a dep. App
    // Router's instance is stable, so this effect doesn't actually re-run; and
    // even if it did, fired reminders are removed from the store immediately,
    // so a re-run's catch-up check() can't re-fire an already-fired reminder.
  }, [router]);

  return null;
}
