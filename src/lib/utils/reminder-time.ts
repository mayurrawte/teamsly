/**
 * Reminder-time helpers shared by the message "Remind me" menu (#142).
 *
 * The quick presets are the core of the feature; a native `datetime-local`
 * input covers arbitrary times. A best-effort natural-language parser
 * ("in 3h", "tomorrow 9am") runs entirely client-side so it works offline and
 * costs nothing — the AI endpoint is only a fallback for phrasings this can't
 * handle (see `/api/ai/parse-time`). All times are resolved against the
 * viewer's local clock.
 */

export interface RemindPreset {
  label: string;
  fireAt: number;
}

const MIN = 60 * 1000;
const HOUR = 60 * MIN;

/**
 * Quick presets, recomputed at open so they're always relative to "now".
 * "Tomorrow 9am" is dropped down to a plain time so it reads naturally.
 */
export function remindPresets(now: Date = new Date()): RemindPreset[] {
  const out: RemindPreset[] = [
    { label: "In 20 minutes", fireAt: now.getTime() + 20 * MIN },
    { label: "In 1 hour", fireAt: now.getTime() + HOUR },
    { label: "In 3 hours", fireAt: now.getTime() + 3 * HOUR },
  ];

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  out.push({ label: "Tomorrow 9am", fireAt: tomorrow.getTime() });

  return out;
}

/**
 * Best-effort natural-language time parser. Returns an epoch-ms timestamp in
 * the future, or `null` if the phrase isn't understood or resolves to the
 * past. Deliberately small and offline: handles the common Slack-style
 * phrasings. Anything richer falls through to the AI endpoint.
 *
 * Supported:
 *   - "in 30m" / "in 3 hours" / "in 2 days" / "in 1 week"
 *   - "tomorrow" (defaults to 9am) / "tomorrow 3pm" / "tomorrow at 15:30"
 *   - "today 5pm" / "at 5pm" (today, or tomorrow if already past)
 *   - "next monday" / "monday 9am" (next occurrence of that weekday)
 */
export function parseNaturalTime(input: string, now: Date = new Date()): number | null {
  const text = input.trim().toLowerCase();
  if (!text) return null;

  // "in <n> <unit>"
  const rel = /^in\s+(\d+)\s*(m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days|w|week|weeks)$/.exec(text);
  if (rel) {
    const n = parseInt(rel[1], 10);
    const unit = rel[2];
    let ms = 0;
    if (/^m/.test(unit)) ms = n * MIN;
    else if (/^h/.test(unit)) ms = n * HOUR;
    else if (/^d/.test(unit)) ms = n * 24 * HOUR;
    else if (/^w/.test(unit)) ms = n * 7 * 24 * HOUR;
    const at = now.getTime() + ms;
    return at > now.getTime() ? at : null;
  }

  // Pull an optional clock time ("3pm", "at 15:30", "9am") out of the phrase.
  const time = extractClockTime(text);
  const hh = time?.hours ?? 9;
  const mm = time?.minutes ?? 0;

  if (/\btomorrow\b/.test(text)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    d.setHours(hh, mm, 0, 0);
    return d.getTime();
  }

  if (/\btoday\b/.test(text) || (time && /^(at\s+)?[\d:apm\s]+$/.test(text))) {
    const d = new Date(now);
    d.setHours(hh, mm, 0, 0);
    // "5pm" already gone today → bump to tomorrow so it's always in the future.
    if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1);
    return d.getTime();
  }

  const weekday = extractWeekday(text);
  if (weekday !== null) {
    const d = new Date(now);
    d.setHours(hh, mm, 0, 0);
    const cur = d.getDay();
    let delta = (weekday - cur + 7) % 7;
    // Same weekday: if the time already passed, jump a full week; "next X"
    // always means at least the coming one.
    if (delta === 0 && (d.getTime() <= now.getTime() || /\bnext\b/.test(text))) delta = 7;
    d.setDate(d.getDate() + delta);
    return d.getTime();
  }

  return null;
}

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function extractWeekday(text: string): number | null {
  for (let i = 0; i < WEEKDAYS.length; i++) {
    const name = WEEKDAYS[i];
    if (text.includes(name) || text.includes(name.slice(0, 3))) return i;
  }
  return null;
}

function extractClockTime(text: string): { hours: number; minutes: number } | null {
  // "3pm", "3:30pm", "at 15:30", "9 am"
  const m = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/.exec(text);
  if (!m) return null;
  let hours = parseInt(m[1], 10);
  const minutes = m[2] ? parseInt(m[2], 10) : 0;
  const suffix = m[3];
  if (hours > 23 || minutes > 59) return null;
  if (suffix === "pm" && hours < 12) hours += 12;
  if (suffix === "am" && hours === 12) hours = 0;
  // A bare "9" with no am/pm and no colon is too ambiguous to be a time.
  if (!suffix && !m[2] && !/:/.test(text)) return null;
  return { hours, minutes };
}
