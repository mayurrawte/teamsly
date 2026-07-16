"use client";

import { useEffect, useRef } from "react";
import { usePreferencesStore } from "@/store/preferences";
import { inQuietHours } from "@/hooks/useSmartNotifications";
import { fireDesktopNotification } from "@/lib/utils/desktop-notification";
import { sameDecodedPath } from "@/lib/realtime/ids";

interface ActivityItem {
  id: string;
  type: "dm" | "channel_unread" | "mention" | "thread" | "reaction" | "keyword";
  senderName: string;
  summary: string;
  href: string;
  matchedKeyword?: string;
}

interface ActivityScanResult {
  mentions: ActivityItem[];
  threads: ActivityItem[];
  reactions: ActivityItem[];
  keywords?: ActivityItem[];
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
    case "keyword":
      return `Keyword match from ${item.senderName}`;
    case "dm":
      return `New DM from ${item.senderName}`;
    default:
      return item.senderName;
  }
}

/**
 * True if `href` is the conversation the user is currently viewing. Compared
 * with percent-encoding normalized away: scan hrefs embed raw Graph ids while
 * location.pathname carries the encoded route param.
 */
function isViewingHref(href: string): boolean {
  if (typeof window === "undefined") return false;
  return sameDecodedPath(window.location.pathname, href);
}

/**
 * Mute wins when the matched keyword itself is muted (exact, case-insensitive)
 * or a muted term appears in the summary. The keyword check runs against the
 * server-side match on the full message body — the summary alone is truncated
 * and `#channel:`-prefixed, so it can both miss and over-match.
 */
function isMutedKeywordItem(item: { matchedKeyword?: string; summary: string }, mutedKeywords: string[]): boolean {
  if (!mutedKeywords || mutedKeywords.length === 0) return false;
  const matched = item.matchedKeyword?.toLowerCase();
  const s = item.summary.toLowerCase();
  return mutedKeywords.some((raw) => {
    const k = raw.trim().toLowerCase();
    return k ? k === matched || s.includes(k) : false;
  });
}

export function useActivityNotifications(scanData: ActivityScanResult | undefined): void {
  const desktopNotifications = usePreferencesStore((s) => s.desktopNotifications);
  const quietHoursEnabled = usePreferencesStore((s) => s.quietHoursEnabled);
  const quietHoursStart = usePreferencesStore((s) => s.quietHoursStart);
  const quietHoursEnd = usePreferencesStore((s) => s.quietHoursEnd);
  const mutedKeywords = usePreferencesStore((s) => s.mutedKeywords);

  const seenIds = useRef<Set<string>>(new Set());
  const isFirstScan = useRef(true);

  useEffect(() => {
    if (!scanData) return;

    const allItems: ActivityItem[] = [
      ...(scanData.mentions ?? []),
      ...(scanData.threads ?? []),
      ...(scanData.reactions ?? []),
      ...(scanData.keywords ?? []),
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

      // Keyword hits: useSmartNotifications already notifies for the open
      // conversation (skip to avoid a double ding), and muted keywords win.
      if (
        item.type === "keyword" &&
        (isViewingHref(item.href) || isMutedKeywordItem(item, mutedKeywords))
      ) {
        continue;
      }

      const href = item.href;
      fireDesktopNotification(notificationTitle(item), item.summary, {
        tag: item.id,
        onclick: () => {
          window.focus();
          window.location.href = href;
        },
      });
    }
  }, [scanData, desktopNotifications, quietHoursEnabled, quietHoursStart, quietHoursEnd, mutedKeywords]);
}
