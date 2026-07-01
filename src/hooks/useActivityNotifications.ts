"use client";

import { useEffect, useRef } from "react";
import { usePreferencesStore } from "@/store/preferences";
import { inQuietHours } from "@/hooks/useSmartNotifications";
import { fireDesktopNotification } from "@/lib/utils/desktop-notification";

interface ActivityItem {
  id: string;
  type: "dm" | "channel_unread" | "mention" | "thread" | "reaction";
  senderName: string;
  summary: string;
  href: string;
}

interface ActivityScanResult {
  mentions: ActivityItem[];
  threads: ActivityItem[];
  reactions: ActivityItem[];
  partial?: boolean;
}

function notificationTitle(item: ActivityItem): string {
  switch (item.type) {
    case "mention":
      return `@mention from ${item.senderName}`;
    case "thread":
      return `Reply from ${item.senderName}`;
    case "reaction":
      return `${item.senderName} reacted to your message`;
    case "dm":
      return `New DM from ${item.senderName}`;
    default:
      return item.senderName;
  }
}

export function useActivityNotifications(scanData: ActivityScanResult | undefined): void {
  const desktopNotifications = usePreferencesStore((s) => s.desktopNotifications);
  const quietHoursEnabled = usePreferencesStore((s) => s.quietHoursEnabled);
  const quietHoursStart = usePreferencesStore((s) => s.quietHoursStart);
  const quietHoursEnd = usePreferencesStore((s) => s.quietHoursEnd);

  const seenIds = useRef<Set<string>>(new Set());
  const isFirstScan = useRef(true);

  useEffect(() => {
    if (!scanData) return;

    const allItems: ActivityItem[] = [
      ...(scanData.mentions ?? []),
      ...(scanData.threads ?? []),
      ...(scanData.reactions ?? []),
    ];

    // Always establish the baseline on the first scan — even when notifications
    // are off or we're in quiet hours — so items already present at load aren't
    // later mistaken for "new" once the gate lifts.
    if (isFirstScan.current) {
      for (const item of allItems) seenIds.current.add(item.id);
      isFirstScan.current = false;
      return;
    }

    const suppressed =
      !desktopNotifications ||
      (quietHoursEnabled && inQuietHours(new Date(), quietHoursStart, quietHoursEnd));

    for (const item of allItems) {
      if (seenIds.current.has(item.id)) continue;
      seenIds.current.add(item.id);
      if (suppressed) continue; // record as seen but don't notify while gated

      const href = item.href;
      fireDesktopNotification(notificationTitle(item), item.summary, {
        tag: item.id,
        onclick: () => {
          window.focus();
          window.location.href = href;
        },
      });
    }
  }, [scanData, desktopNotifications, quietHoursEnabled, quietHoursStart, quietHoursEnd]);
}
