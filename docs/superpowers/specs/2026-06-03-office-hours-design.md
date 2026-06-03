# Office Hours mode — design (#38)

**Date:** 2026-06-03
**Scope:** Small. Fully client-side. No API, no Graph, no status push.

## What it is

A personal work/life-balance feature. You define your working hours; when you're
**outside** them, Teamsly shows you a dismissible banner reminding you you're off
the clock. Purely self-facing — your office-hours prefs live in your browser's
localStorage, so this is about *your* hours shown to *you*, not a teammate-visible
status.

Decided against (this iteration): auto-replies, pushing a status message to Teams,
forcing presence, per-conversation overrides. Distinct from **quiet hours** (mutes
notifications) and **calendar auto-status** (drives presence from Outlook).

## Components

### 1. Preferences (`src/store/preferences.ts`) — persist v3 → v4
New fields + setters (mirroring the existing `quietHours*` shape):
- `officeHoursEnabled: boolean` (default `false`)
- `officeHoursStart: string` — `"HH:MM"` 24h (default `"09:00"`)
- `officeHoursEnd: string` — `"HH:MM"` 24h (default `"17:00"`)
- `officeHoursDays: number[]` — JS weekday indices 0=Sun..6=Sat (default `[1,2,3,4,5]` Mon–Fri)
- `officeHoursDismissedUntil: number | null` — epoch ms; banner stays hidden while `now < this` (default `null`)

Zustand persist default-merge grafts new fields, so no explicit `migrate`. Bump
`version` to 4 and extend the version comment.

### 2. `useOfficeHours()` (`src/hooks/useOfficeHours.ts`)
Pure computation from prefs + a 60s clock tick (so state flips at boundaries even
if the user leaves the tab open). Returns:
- `enabled: boolean`
- `withinHours: boolean` — true when today is an enabled day and `start ≤ now < end`
  (same-day window; if `start ≥ end` the window is treated as never-within)
- `nextBoundary: number | null` — epoch ms of the next transition (today's end if
  within; otherwise the next enabled day's start, searched up to 7 days ahead)
- `label: string` — e.g. `"9:00 AM – 5:00 PM · Mon–Fri"` (times via `Intl.DateTimeFormat`;
  days rendered as "Every day" / "Mon–Fri" / an explicit short list)

No network. `"use client"`.

### 3. `OfficeHoursBanner` (`src/components/ui/OfficeHoursBanner.tsx`)
Mounted in `AppShell` next to `<BootNudge />`. Visible when
`enabled && !withinHours && !(dismissedUntil && now < dismissedUntil)`.
Styled to match BootNudge but pinned **top-center** (BootNudge is bottom-center)
to avoid overlap. Copy: *"You're outside your office hours · {label}"*. Dismiss
sets `officeHoursDismissedUntil = nextBoundary` so it won't re-nag this off-period
(survives reload), then naturally re-arms once you're back within hours.

### 4. Preferences UI (`AvailabilityPanel` in `PreferencesModal.tsx`)
Below the existing "Auto status from calendar" row, a new `FieldGroup` "Office hours":
- enable `ToggleRow`
- two `type="time"` inputs (start / end), disabled when off — same styling as the
  morning-brief time input
- a 7-chip day selector (S M T W T F S), toggling membership in `officeHoursDays`,
  disabled when off

## Testing / verification
No test framework in repo. Bar = `npm run build` green (type + ESLint rules-of-hooks
+ Next page-export checks). Manual: set hours to exclude "now", confirm banner shows;
dismiss → stays gone; set hours to include "now" → no banner.
