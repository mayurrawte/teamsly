import { format, isToday, isYesterday, isSameYear, isSameDay } from "date-fns";

function toDate(input: string | Date): Date {
  return input instanceof Date ? input : new Date(input);
}

/**
 * Slack-style timestamp shown next to author name.
 *   Today      -> "Today at 2:34 PM"
 *   Yesterday  -> "Yesterday at 11:20 AM"
 *   Same year  -> "May 6th at 3:00 PM"
 *   Other year -> "May 6th, 2024 at 3:00 PM"
 */
export function formatMessageTime(input: string | Date, now: Date = new Date()): string {
  const d = toDate(input);
  if (isToday(d)) return `Today at ${format(d, "h:mm a")}`;
  if (isYesterday(d)) return `Yesterday at ${format(d, "h:mm a")}`;
  if (isSameYear(d, now)) return format(d, "MMM do 'at' h:mm a");
  return format(d, "MMM do, yyyy 'at' h:mm a");
}

/**
 * Compact time-only string used on hover for grouped continuation messages.
 *   "2:34 PM"
 */
export function formatMessageTimeShort(input: string | Date): string {
  return format(toDate(input), "h:mm a");
}

/**
 * Label shown in the date divider between days.
 *   Today      -> "Today"
 *   Yesterday  -> "Yesterday"
 *   Same year  -> "Wednesday, May 6th"
 *   Other year -> "Wednesday, May 6th, 2024"
 */
export function formatDateDivider(input: string | Date, now: Date = new Date()): string {
  const d = toDate(input);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  if (isSameYear(d, now)) return format(d, "EEEE, MMM do");
  return format(d, "EEEE, MMM do, yyyy");
}

/**
 * True when two messages were sent on different calendar days.
 */
export function isDifferentDay(a: string | Date, b: string | Date): boolean {
  return !isSameDay(toDate(a), toDate(b));
}

/**
 * Full ISO-ish tooltip timestamp, e.g. "Wednesday, May 6th, 2026 2:34:08 PM".
 */
export function formatFullTimestamp(input: string | Date): string {
  return format(toDate(input), "EEEE, MMMM do, yyyy 'at' h:mm:ss a");
}
