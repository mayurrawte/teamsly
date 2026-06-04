"use client";

/**
 * useOfficeHours — pure, client-only computation of the user's personal
 * office-hours state from their prefs plus a 1-minute clock tick (so the
 * `withinHours` flag flips at the window boundaries even while the tab stays
 * open). No network, no Graph: office-hours prefs never leave the browser.
 */

import { useEffect, useState } from "react";
import { usePreferencesStore } from "@/store/preferences";

export interface OfficeHoursState {
  enabled: boolean;
  /** True when today is an enabled weekday and start ≤ now < end. */
  withinHours: boolean;
  /** Epoch ms of the next transition: today's end if within, else the next
   *  enabled day's start (searched up to 7 days out). null if no enabled days. */
  nextBoundary: number | null;
  /** Human label, e.g. "9:00 AM – 5:00 PM · Mon–Fri". */
  label: string;
}

const TICK_MS = 60_000;
const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "HH:MM" → minutes since midnight, or null if malformed. */
function parseHM(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function formatHM(value: string): string {
  const mins = parseHM(value);
  if (mins === null) return value;
  const d = new Date();
  d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(d);
}

function formatDays(days: number[]): string {
  const set = [...new Set(days)].sort((a, b) => a - b);
  if (set.length === 0) return "No days";
  if (set.length === 7) return "Every day";
  if (set.length === 5 && set.join() === "1,2,3,4,5") return "Mon–Fri";
  if (set.length === 2 && set.join() === "0,6") return "Weekends";
  return set.map((d) => SHORT_DAYS[d]).join(", ");
}

/** epoch ms for the start-of-day `dayOffset` days from `from`, at `minutes`. */
function dayAt(from: Date, dayOffset: number, minutes: number): number {
  const d = new Date(from);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return d.getTime();
}

function compute(
  enabled: boolean,
  start: string,
  end: string,
  days: number[],
): OfficeHoursState {
  const startMin = parseHM(start);
  const endMin = parseHM(end);
  const label = `${formatHM(start)} – ${formatHM(end)} · ${formatDays(days)}`;

  // Malformed or zero-width/inverted window → never "within"; no boundary.
  if (!enabled || startMin === null || endMin === null || startMin >= endMin) {
    return { enabled, withinHours: false, nextBoundary: null, label };
  }

  const now = new Date();
  const today = now.getDay();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const isWorkday = days.includes(today);
  const withinHours = isWorkday && nowMin >= startMin && nowMin < endMin;

  let nextBoundary: number | null = null;
  if (withinHours) {
    nextBoundary = dayAt(now, 0, endMin); // today's end
  } else {
    // Next enabled day's start, scanning today (if start still ahead) → +7 days.
    for (let offset = 0; offset <= 7; offset++) {
      const weekday = (today + offset) % 7;
      if (!days.includes(weekday)) continue;
      const candidate = dayAt(now, offset, startMin);
      if (candidate > now.getTime()) {
        nextBoundary = candidate;
        break;
      }
    }
  }

  return { enabled, withinHours, nextBoundary, label };
}

export function useOfficeHours(): OfficeHoursState {
  const enabled = usePreferencesStore((s) => s.officeHoursEnabled);
  const start = usePreferencesStore((s) => s.officeHoursStart);
  const end = usePreferencesStore((s) => s.officeHoursEnd);
  const days = usePreferencesStore((s) => s.officeHoursDays);

  const [state, setState] = useState<OfficeHoursState>(() =>
    compute(enabled, start, end, days),
  );

  useEffect(() => {
    setState(compute(enabled, start, end, days));
    if (!enabled) return;
    const id = setInterval(() => setState(compute(enabled, start, end, days)), TICK_MS);
    return () => clearInterval(id);
  }, [enabled, start, end, days]);

  return state;
}
