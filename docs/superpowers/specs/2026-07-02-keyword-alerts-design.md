# Keyword alerts across conversations (#147)

**Status:** design approved 2026-07-02 · **Branch:** `feat/keyword-alerts`

## Problem

Users want to be notified when a chosen word/phrase (a project name, "prod down",
their product) appears in **any** conversation — Slack's "highlight words". Microsoft
Teams has no out-of-box equivalent; only Power Automate / Graph-subscription
workarounds exist.

## What already exists (do NOT rebuild)

- **`notificationKeywords`** preference (comma-separated string) + **`mutedKeywords`**
  (string[]), with settings UI in `PreferencesModal` and `SettingsModal`.
- **`useSmartNotifications`** — matches `notificationKeywords` against incoming
  messages and fires a desktop notification, honoring `mutedKeywords`, quiet hours,
  focus mode, snooze, and click-to-jump. **But it is fed `messages` from the
  currently-open `ChatView`/`ChannelView` only**, so it covers just the open
  conversation.
- **`/api/activity/scan`** — walks the user's recent messages across DMs + the
  **active team's** channels and classifies each into `mentions` / `threads` /
  `reactions` (`ActivityItem[]`), cached ~60s per user. Consumed by
  `src/app/workspace/activity/page.tsx`, which also feeds `scanData` to
  `useActivityNotifications` for desktop notifications.

**The gap:** cross-conversation keyword coverage + a place to browse hits.

## Approach (chosen: A)

Match keywords **server-side inside the existing activity scan** (it already walks
the messages), return a new `keywords` bucket, notify for new hits, and add a
"Keywords" tab to the Activity page. Rejected: B (return raw messages, match
client-side — bigger payload, marginal privacy gain on your own server) and C
(dedicated all-teams keyword endpoint — more Graph load, duplicated walk, YAGNI).

## Design

### 1. Scan route — `src/app/api/activity/scan/route.ts`

- Add `"keyword"` to the `ActivityItem["type"]` union.
- Add `keywords: ActivityItem[]` to the `ScanResult` interface.
- Read the keyword list from a query param `kw` (comma-joined, URL-encoded);
  parse to a lowercased, trimmed, non-empty list. Absent/empty → skip matching,
  return `keywords: []` (zero added cost).
- During the existing per-message walk (where the plain-text `summary` is already
  derived), test the message text against the keywords with a **case-insensitive
  substring match** (same semantics as `useSmartNotifications.shouldNotify`). On a
  match, push an `ActivityItem` (`type: "keyword"`, existing fields, `href` with the
  `?anchor=` deep-link the other buckets use). A message can appear in both its
  natural bucket and `keywords`.
- No new Graph calls; matching is pure string work inside the existing try/catch,
  so the existing `partial: true` degradation is unchanged.
- Cap the `keywords` bucket to the same politeness cap the other buckets use.

### 2. Activity page — `src/app/workspace/activity/page.tsx`

- Append the user's `notificationKeywords` to the existing scan-fetch query string
  (`kw=<encoded>`). Re-fetch when the keyword pref changes (add to the effect's deps).
- Add `"keywords"` to `ActivityTab`, to `TABS` (label "Keywords"), and to
  `SCAN_TABS`. Include `scanData.keywords` in the "All" aggregation and add a
  `visibleItems` branch for the keywords tab. Add an `EmptyState` entry.
- Existing "Unread only" filter, row rendering, and `?anchor=` navigation work
  unchanged (keyword items carry the same `href` shape).

### 3. Notifications — `src/hooks/useActivityNotifications.ts`

- Fold `scanData.keywords` into the scanned `allItems`, reusing the existing
  seen-id dedup, first-scan baseline seed, and quiet-hours/desktop gates.
- **Dedup with `useSmartNotifications`:** skip keyword items whose `href` points to
  the **currently-open** conversation (compare against `window.location.pathname`),
  because that hook already notifies there — prevents a double notification.
- **Apply `mutedKeywords`** to keyword *notifications* (mute wins), matching
  `useSmartNotifications`. The Keywords *tab* still lists all positive hits (mute
  only silences the ding, it doesn't hide the item).

### 4. Settings copy — `PreferencesModal` + `SettingsModal`

- Update the `notificationKeywords` field's help text to note it now watches your
  DMs + active team's channels (background), not just the open conversation. No new
  setting, no behavior change to the input itself.

## Non-goals (YAGNI)

- Coverage beyond what the scan already walks (i.e. NOT all teams' channels).
- Regex / whole-word / per-keyword matching — reuse the existing substring match.
- Per-keyword notification settings or a separate keyword store.

## Error handling

Reuses the scan's existing per-conversation 5xx catch → `partial: true`. Keyword
parsing tolerates empty/whitespace entries. No throw paths added.

## Verification

- `npm run build` must pass (Vercel enforces `react-hooks/rules-of-hooks` +
  page-export rules). No automated test suite in the repo.
- Signed-in preview check (fold into QA issue #141): set a keyword, have it appear
  in a non-open conversation, confirm a notification fires and the hit shows in the
  Keywords tab; confirm no double-ding when the keyword lands in the open chat;
  confirm a `mutedKeywords` term silences the ding but still lists in the tab.

## Files touched

- `src/app/api/activity/scan/route.ts` (type + bucket + query param + match)
- `src/app/workspace/activity/page.tsx` (qs param + tab + aggregation)
- `src/hooks/useActivityNotifications.ts` (fold in keywords + dedup + mute)
- `src/components/modals/PreferencesModal.tsx`, `SettingsModal.tsx` (help copy)
