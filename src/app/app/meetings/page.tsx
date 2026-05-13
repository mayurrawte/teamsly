"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  format,
  isToday,
  isTomorrow,
  startOfDay,
  endOfDay,
  addDays,
  endOfWeek,
  parseISO,
  differenceInMinutes,
  differenceInHours,
} from "date-fns";
import {
  RefreshCw,
  Video,
  ExternalLink,
  CalendarX,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// URL safety guard — mirrors AttachmentCard's safeAttachmentHref
// ---------------------------------------------------------------------------

function safeUrl(url?: string | null): string | null {
  if (!url) return null;
  if (/^https:\/\//i.test(url)) return url;
  return null;
}

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

type MeetingTab = "today" | "this_week" | "next_7";

const TABS: { id: MeetingTab; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "this_week", label: "This week" },
  { id: "next_7", label: "Next 7 days" },
];

function getTabWindow(tab: MeetingTab): { from: Date; to: Date } {
  const now = new Date();
  switch (tab) {
    case "today":
      return { from: startOfDay(now), to: endOfDay(now) };
    case "this_week":
      // today through end of Sunday (local tz)
      return { from: startOfDay(now), to: endOfWeek(now, { weekStartsOn: 1 }) };
    case "next_7":
      return { from: startOfDay(now), to: endOfDay(addDays(now, 7)) };
  }
}

// ---------------------------------------------------------------------------
// Time / duration helpers
// ---------------------------------------------------------------------------

function parseEventDate(dateTime: string): Date | null {
  try {
    // Graph returns "2025-05-13T10:00:00.0000000" — not a UTC ISO string;
    // treat it as local time by appending no 'Z'. parseISO handles both forms.
    const d = parseISO(dateTime);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function formatTimeRange(start: Date, end: Date): string {
  return `${format(start, "HH:mm")} – ${format(end, "HH:mm")}`;
}

function formatDuration(start: Date, end: Date): string {
  const mins = differenceInMinutes(end, start);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function dayLabel(date: Date): string {
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  return format(date, "EEEE, MMM d");
}

// ---------------------------------------------------------------------------
// Join eligibility: online meeting AND (start within ±15 min of now OR
// started up to 24 h ago)
// ---------------------------------------------------------------------------

function shouldShowJoin(event: MSCalendarEvent): boolean {
  if (!event.isOnlineMeeting) return false;
  if (!safeUrl(event.onlineMeeting?.joinUrl)) return false;
  const start = parseEventDate(event.start.dateTime);
  if (!start) return false;
  const now = new Date();
  const diffMins = differenceInMinutes(now, start); // positive = past
  // within 15 min before start or up to 24 h after start
  return diffMins >= -15 && differenceInHours(now, start) < 24;
}

// ---------------------------------------------------------------------------
// Grouping
// ---------------------------------------------------------------------------

interface DayGroup {
  label: string;
  date: Date;
  events: MSCalendarEvent[];
}

function groupByDay(events: MSCalendarEvent[]): DayGroup[] {
  const map = new Map<string, DayGroup>();
  for (const ev of events) {
    const start = parseEventDate(ev.start.dateTime);
    if (!start) continue; // defensive: skip malformed
    const key = format(start, "yyyy-MM-dd");
    if (!map.has(key)) {
      map.set(key, { label: dayLabel(start), date: start, events: [] });
    }
    map.get(key)!.events.push(ev);
  }
  return Array.from(map.values()).sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function MeetingsSkeleton() {
  return (
    <div role="status" aria-label="Loading calendar" aria-busy="true" className="flex flex-col gap-2 px-4 py-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 rounded-lg px-3 py-3">
          <div className="flex w-14 flex-shrink-0 flex-col gap-1.5 pt-0.5">
            <div className="skeleton h-3 w-12" />
            <div className="skeleton h-2.5 w-8" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="skeleton mb-1.5 h-3.5" style={{ width: `${50 + (i % 4) * 12}%` }} />
            <div className="skeleton h-3" style={{ width: `${30 + (i % 3) * 10}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single event row
// ---------------------------------------------------------------------------

function EventRow({ event }: { event: MSCalendarEvent }) {
  const start = parseEventDate(event.start.dateTime);
  const end = parseEventDate(event.end.dateTime);
  const cancelled = !!event.isCancelled;
  const joinable = shouldShowJoin(event);
  const joinUrl = safeUrl(event.onlineMeeting?.joinUrl);
  const webLink = safeUrl(event.webLink);

  function handleJoin() {
    if (joinUrl) window.open(joinUrl, "_blank", "noopener,noreferrer");
  }

  function handleOpen() {
    if (webLink) window.open(webLink, "_blank", "noopener,noreferrer");
  }

  return (
    <div
      className={cn(
        "group flex items-start gap-3 rounded-lg px-3 py-3 transition-colors duration-[80ms] hover:bg-white/5",
        cancelled && "opacity-60"
      )}
    >
      {/* Time column */}
      <div className="flex w-14 flex-shrink-0 flex-col items-start gap-0.5 pt-0.5">
        {event.isAllDay ? (
          <span className="text-[11px] font-medium text-[#ababad]">All day</span>
        ) : start && end ? (
          <>
            <span className="text-[11px] font-medium leading-tight text-[#ababad]">
              {formatTimeRange(start, end)}
            </span>
            <span className="text-[10px] text-[#6c6f75]">{formatDuration(start, end)}</span>
          </>
        ) : null}
      </div>

      {/* Main body */}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-[13px] font-semibold text-[#d1d2d3]",
            cancelled && "line-through"
          )}
        >
          {event.subject ?? "(No title)"}
        </p>
        {event.organizer?.emailAddress?.name && (
          <p className="truncate text-[11px] text-[#6c6f75]">
            {event.organizer.emailAddress.name}
          </p>
        )}
        {event.location?.displayName && (
          <p className="truncate text-[11px] text-[#6c6f75]">
            {event.location.displayName}
          </p>
        )}
        {event.bodyPreview && (
          <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-[#6c6f75]">
            {event.bodyPreview}
          </p>
        )}
      </div>

      {/* Action button */}
      <div className="flex flex-shrink-0 items-start pt-0.5">
        {joinable && joinUrl ? (
          <button
            type="button"
            onClick={handleJoin}
            title="Join meeting"
            className="flex items-center gap-1.5 rounded-md bg-[#0F5A8F] px-2.5 py-1.5 text-[12px] font-medium text-white transition-colors duration-[80ms] hover:bg-[#1470b0] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#0F5A8F]"
          >
            <Video size={13} />
            Join
          </button>
        ) : webLink ? (
          <button
            type="button"
            onClick={handleOpen}
            title="Open in Outlook"
            className="flex items-center justify-center rounded-md p-1.5 text-[#6c6f75] transition-colors duration-[80ms] hover:bg-white/8 hover:text-[#ababad] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#0F5A8F]"
          >
            <ExternalLink size={14} />
          </button>
        ) : (
          <span className="w-[30px]" aria-hidden="true" />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function MeetingsPage() {
  const [items, setItems] = useState<MSCalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeTab, setActiveTab] = useState<MeetingTab>("today");

  const fetchMeetings = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const now = new Date();
      const end = addDays(now, 14);
      const url = `/api/meetings?start=${encodeURIComponent(now.toISOString())}&end=${encodeURIComponent(end.toISOString())}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { items?: MSCalendarEvent[] };
      setItems(data.items ?? []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + 5-minute poll
  useEffect(() => {
    fetchMeetings();
    const intervalId = setInterval(fetchMeetings, 5 * 60 * 1000);
    return () => clearInterval(intervalId);
  }, [fetchMeetings]);

  // Filter items to the active tab window
  const filtered = useMemo(() => {
    const { from, to } = getTabWindow(activeTab);
    return items.filter((ev) => {
      const start = parseEventDate(ev.start.dateTime);
      if (!start) return false;
      return start >= from && start <= to;
    });
  }, [items, activeTab]);

  const groups = useMemo(() => groupByDay(filtered), [filtered]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-[#3f4144] px-4 pb-0 pt-4">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-[18px] font-bold text-white">Calendar</h1>
          <button
            type="button"
            onClick={fetchMeetings}
            disabled={loading}
            title="Refresh calendar"
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium text-[#ababad] transition-colors duration-[80ms] hover:bg-white/8 hover:text-[#d1d2d3] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#0F5A8F] disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {/* Tab row */}
        <div className="flex gap-0" role="tablist" aria-label="Calendar view">
          {TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "relative px-3 pb-2.5 pt-1 text-[13px] font-medium transition-colors duration-[80ms] ease-out focus:outline-none focus-visible:ring-1 focus-visible:ring-[#0F5A8F]",
                  active ? "text-white" : "text-[#ababad] hover:text-[#d1d2d3]"
                )}
              >
                {tab.label}
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t-full bg-[#0F5A8F]"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <MeetingsSkeleton />
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <CalendarX size={36} className="text-[#6c6f75]" />
            <p className="text-[13px] text-[#ababad]">Couldn&apos;t load your calendar</p>
            <button
              type="button"
              onClick={fetchMeetings}
              className="flex items-center gap-1.5 rounded-md border border-[#3f4144] px-3 py-1.5 text-[13px] text-[#d1d2d3] transition-colors duration-[80ms] hover:bg-[#27292d]"
            >
              <RefreshCw size={13} />
              Retry
            </button>
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <CalendarX size={36} className="text-[#6c6f75]" />
            <p className="text-[13px] text-[#ababad]">
              Nothing on your calendar — enjoy the quiet.
            </p>
          </div>
        ) : (
          <div className="px-2 py-2">
            {groups.map((group) => (
              <div key={group.label} className="mb-4">
                <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wide text-[#6c6f75]">
                  {group.label}
                </p>
                <div className="divide-y divide-[#3f4144]/40">
                  {group.events.map((ev) => (
                    <EventRow key={ev.id} event={ev} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
