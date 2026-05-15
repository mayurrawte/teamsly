"use client";

import { useEffect, useRef } from "react";
import { usePreferencesStore } from "@/store/preferences";
import { messagePlainText } from "@/lib/utils/render-message";
import { playNotificationSound } from "@/lib/utils/notification-sound";

interface UseSmartNotificationsOptions {
  messages: MSMessage[];
  contextName?: string;
  /**
   * Identifier for the current context — `chatId` for DMs, `${teamId}/${channelId}` for channels.
   * When provided, we cross-check against `window.location.pathname` and suppress
   * notifications when the user is already looking at this conversation.
   */
  contextId?: string;
  /** "chat" or "channel" — used to pick the URL pattern to compare against. */
  contextKind?: "chat" | "channel";
  /** Current user's Graph id — messages authored by this user are never notified. */
  currentUserId?: string;
}

export function useSmartNotifications({
  messages,
  contextName = "Teamsly",
  contextId,
  contextKind,
  currentUserId,
}: UseSmartNotificationsOptions) {
  const desktopNotifications = usePreferencesStore((state) => state.desktopNotifications);
  const notificationSound = usePreferencesStore((state) => state.notificationSound);
  const mentionsOnly = usePreferencesStore((state) => state.mentionsOnly);
  const notificationKeywords = usePreferencesStore((state) => state.notificationKeywords);
  const mutedKeywords = usePreferencesStore((state) => state.mutedKeywords);
  const quietHoursEnabled = usePreferencesStore((state) => state.quietHoursEnabled);
  const quietHoursStart = usePreferencesStore((state) => state.quietHoursStart);
  const quietHoursEnd = usePreferencesStore((state) => state.quietHoursEnd);
  const lastMessageId = useRef<string | null>(null);

  useEffect(() => {
    const latest = messages[messages.length - 1];
    if (!latest) return;

    if (!lastMessageId.current) {
      lastMessageId.current = latest.id;
      return;
    }
    if (lastMessageId.current === latest.id) return;
    lastMessageId.current = latest.id;

    // Ignore messages sent by the current user (real mode: compare GUID; demo mode: id === "you").
    const senderId = latest.from?.user?.id;
    if (senderId === "you") return;
    if (currentUserId && senderId === currentUserId) return;

    const author = latest.from?.user?.displayName ?? "Unknown";
    const text = messagePlainText(latest.body.content, latest.body.contentType);

    // 1. Mute keywords win over everything else (positive keywords + mentions).
    if (isMuted(text, mutedKeywords)) return;

    // 2. Standard mention / positive-keyword gating.
    if (!shouldNotify(text, mentionsOnly, notificationKeywords)) return;

    // 3. Quiet hours window — skip both sound and OS notifications.
    if (quietHoursEnabled && inQuietHours(new Date(), quietHoursStart, quietHoursEnd)) return;

    // 4. Focus / de-dupe guards.
    //    Skip when the renderer process is focused AND the user is on the
    //    page rendering this exact conversation. The Electron preload now
    //    exposes `isFocused()` (BrowserWindow.isFocused()); when running in
    //    a plain browser tab we fall back to `document.visibilityState`,
    //    which is a slightly weaker signal (a tab can be visible but
    //    inactive) but the worst case there is one extra ding, not silence.
    if (isViewingContext(contextId, contextKind) && isAppFocused()) return;

    // Sound is a basic preference — not gated by Pro.
    if (notificationSound) {
      playNotificationSound();
    }

    // Desktop OS notifications are a Pro feature.
    if (process.env.NEXT_PUBLIC_PRO !== "true") return;
    if (!desktopNotifications || typeof window === "undefined" || !("Notification" in window)) return;

    if (Notification.permission === "granted") {
      new Notification(`${author} in ${contextName}`, { body: text.slice(0, 160) });
    } else if (Notification.permission === "default") {
      Notification.requestPermission().then((permission) => {
        if (permission === "granted") {
          new Notification(`${author} in ${contextName}`, { body: text.slice(0, 160) });
        }
      });
    }
  }, [
    contextName,
    contextId,
    contextKind,
    currentUserId,
    desktopNotifications,
    mentionsOnly,
    messages,
    notificationKeywords,
    notificationSound,
    mutedKeywords,
    quietHoursEnabled,
    quietHoursStart,
    quietHoursEnd,
  ]);
}

function shouldNotify(text: string, mentionsOnly: boolean, notificationKeywords: string): boolean {
  const normalized = text.toLowerCase();
  const hasMention = /@(?:here|channel|everyone|you)\b/i.test(text);
  const keywords = notificationKeywords
    .split(",")
    .map((keyword) => keyword.trim().toLowerCase())
    .filter(Boolean);

  if (mentionsOnly) return hasMention || keywords.some((keyword) => normalized.includes(keyword));
  if (keywords.length === 0) return true;
  return hasMention || keywords.some((keyword) => normalized.includes(keyword));
}

/** Case-insensitive substring match against the negative keyword list. */
function isMuted(text: string, mutedKeywords: string[]): boolean {
  if (!mutedKeywords || mutedKeywords.length === 0) return false;
  const normalized = text.toLowerCase();
  return mutedKeywords.some((raw) => {
    const k = raw.trim().toLowerCase();
    if (!k) return false;
    return normalized.includes(k);
  });
}

/**
 * Returns true if the user is currently on the page that renders the message's
 * conversation. Path layout from the app router:
 *   - chats:    /app/dm/{chatId}
 *   - channels: /app/t/{teamId}/{channelId}
 */
function isViewingContext(contextId?: string, contextKind?: "chat" | "channel"): boolean {
  if (!contextId || !contextKind) return false;
  if (typeof window === "undefined") return false;
  const path = window.location.pathname;
  if (contextKind === "chat") return path === `/app/dm/${contextId}`;
  // channel contextId is "{teamId}/{channelId}"
  return path === `/app/t/${contextId}`;
}

/**
 * Combined focus check.
 * - In Electron, `window.electron.isFocused()` reflects BrowserWindow focus.
 * - In a browser tab, no equivalent — `document.visibilityState === "visible"`
 *   is the best signal we have, with the known caveat that a visible-but-blurred
 *   tab will be treated as focused. The cost of getting that wrong is one
 *   redundant notification ding, never a missed alert, so we accept it.
 */
function isAppFocused(): boolean {
  if (typeof document === "undefined") return false;
  const visible = document.visibilityState === "visible";
  if (!visible) return false;
  if (typeof window === "undefined") return false;
  const electronFocused = window.electron?.isFocused?.();
  if (typeof electronFocused === "boolean") return electronFocused;
  return true;
}

/**
 * "HH:MM" → minutes since midnight. Returns NaN for unparseable input —
 * callers should treat NaN as "skip quiet hours suppression".
 */
function parseHHMM(value: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!m) return Number.NaN;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return Number.NaN;
  return h * 60 + min;
}

export function inQuietHours(now: Date, startHHMM: string, endHHMM: string): boolean {
  const start = parseHHMM(startHHMM);
  const end = parseHHMM(endHHMM);
  if (Number.isNaN(start) || Number.isNaN(end)) return false;
  if (start === end) return false;
  const cur = now.getHours() * 60 + now.getMinutes();
  if (start < end) {
    // Same-day window — e.g. 09:00–17:00.
    return cur >= start && cur < end;
  }
  // Wrap window — e.g. 22:00–08:00.
  return cur >= start || cur < end;
}
