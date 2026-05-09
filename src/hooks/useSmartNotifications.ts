"use client";

import { useEffect, useRef } from "react";
import { usePreferencesStore } from "@/store/preferences";
import { messagePlainText } from "@/lib/utils/render-message";

interface UseSmartNotificationsOptions {
  messages: MSMessage[];
  contextName?: string;
}

export function useSmartNotifications({ messages, contextName = "Teamsly" }: UseSmartNotificationsOptions) {
  const desktopNotifications = usePreferencesStore((state) => state.desktopNotifications);
  const mentionsOnly = usePreferencesStore((state) => state.mentionsOnly);
  const notificationKeywords = usePreferencesStore((state) => state.notificationKeywords);
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

    if (process.env.NEXT_PUBLIC_PRO !== "true") return;
    if (!desktopNotifications || typeof window === "undefined" || !("Notification" in window)) return;
    if (latest.from?.user?.id === "you") return;

    const author = latest.from?.user?.displayName ?? "Unknown";
    const text = messagePlainText(latest.body.content, latest.body.contentType);
    if (!shouldNotify(text, mentionsOnly, notificationKeywords)) return;

    if (Notification.permission === "granted") {
      new Notification(`${author} in ${contextName}`, { body: text.slice(0, 160) });
    } else if (Notification.permission === "default") {
      Notification.requestPermission().then((permission) => {
        if (permission === "granted") {
          new Notification(`${author} in ${contextName}`, { body: text.slice(0, 160) });
        }
      });
    }
  }, [contextName, desktopNotifications, mentionsOnly, messages, notificationKeywords]);
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
