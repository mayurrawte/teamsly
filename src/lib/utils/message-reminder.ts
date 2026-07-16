/**
 * Helpers for message-anchored "Remind me" reminders (#142).
 *
 * A message reminder reuses the shared `Reminder` store/schema (see
 * `lib/storage/reminders.ts`); these helpers translate a message + its
 * context into a persisted reminder and back into a jump-to-message href.
 * The context id shape matches the bookmarks store: `chatId` for a DM,
 * `${teamId}:${channelId}` for a channel — so the same `?anchor=` deep-link
 * the search/action-items paths already use resurfaces the exact message.
 */

import type { Reminder } from "@/lib/storage/reminders";
import { messagePlainText } from "@/lib/utils/render-message";

const MAX_SNIPPET = 200;

export interface MessageReminderContext {
  /** Bookmark-shape context id: `chatId` or `${teamId}:${channelId}`. */
  contextId: string;
  kind: "chat" | "channel";
  /** Human-readable label, e.g. "#general" or the DM partner's name. */
  contextLabel: string;
}

/**
 * Build the in-app href that resurfaces a reminder's source message. Mirrors
 * the bookmark/action-item routing: a channel id splits on ":" into the
 * team/channel path, everything else is treated as a DM chat id. The
 * `?anchor=` param is consumed by ChatView/ChannelView to scroll + flash.
 */
export function hrefForMessageReminder(reminder: Reminder): string {
  const { contextId, messageId } = reminder;
  if (!contextId) return reminder.sourceHref || "/workspace";
  let base: string;
  if (reminder.contextKind === "channel" || contextId.includes(":")) {
    const [teamId, channelId] = contextId.split(":");
    base = `/workspace/t/${teamId}/${channelId}`;
  } else {
    base = `/workspace/dm/${contextId}`;
  }
  return messageId ? `${base}?anchor=${encodeURIComponent(messageId)}` : base;
}

/** Compact the message body to a list-friendly snippet. */
export function snippetForMessage(message: MSMessage): string {
  const text = messagePlainText(message.body.content, message.body.contentType);
  return text.length > MAX_SNIPPET ? `${text.slice(0, MAX_SNIPPET)}…` : text;
}

/**
 * Assemble a persisted `Reminder` from a message, its context, and a due time.
 * `task` is the notification/toast body; we fall back to the sender name when
 * the message has no text (e.g. an attachment-only message).
 */
export function buildMessageReminder(
  message: MSMessage,
  ctx: MessageReminderContext,
  fireAt: number
): Reminder {
  const senderName = message.from?.user?.displayName ?? "Someone";
  const snippet = snippetForMessage(message);
  const task = snippet
    ? `${senderName} in ${ctx.contextLabel}: ${snippet}`
    : `Message from ${senderName} in ${ctx.contextLabel}`;

  const reminder: Reminder = {
    id: crypto.randomUUID(),
    task,
    // sourceHref is set from the same builder so action-only consumers
    // (the desktop-notification click) still have a valid target.
    sourceHref: "",
    fireAt,
    createdAt: Date.now(),
    contextId: ctx.contextId,
    messageId: message.id,
    contextKind: ctx.kind,
    snippet,
    senderName,
    contextLabel: ctx.contextLabel,
  };
  reminder.sourceHref = hrefForMessageReminder(reminder);
  return reminder;
}
