# AI action-item extractor — Design

**Date:** 2026-06-09
**Status:** Approved (design)
**Issue:** #35 (P2, feature)
**Builds on:** the existing AI catch-up infrastructure (`/api/ai/tldr`, `CatchUpPanel`).

## Problem

The product can already summarize conversations two ways: `/api/ai/summary` (a 2-bullet per-conversation unread summary) and `/api/ai/tldr` (a cross-channel "catch-up" digest). The `/tldr` prompt *already* emits an "Action items" section — but as **prose, buried inside a multi-conversation digest**. There is no way to see "what's actually on my plate" as a discrete, scannable, actionable list, and no way to act on a single item.

Issue #35 asks to "extract action items from a conversation." The differentiated value over `/tldr` is **structure and actionability**: a typed list grouped by who owns each item, where each item can be jumped-to and turned into a reminder.

## Goal & success criteria

A new **"Action items" tab inside the existing Catch-up panel** that extracts a structured, cross-conversation list of action items and lets the user act on each one.

Success means:

- The Catch-up panel has two tabs: **Digest** (the existing `/tldr` view, unchanged) and **Action items** (new). The window pills (24h / 3d / 7d) and refresh control are shared.
- The Action items tab shows items in three ownership groups: **For you**, **Waiting on others**, **Team / unassigned**.
- Each item shows: the task (imperative, concise), an owner chip (when attributable), and the source conversation label.
- Each item supports two actions: **jump to source** (navigate to the source conversation, anchored to the source message when known) and **remind me** (schedule a local desktop-notification nudge whose click jumps to the source).
- With no `ANTHROPIC_API_KEY` set, the tab shows the existing "not configured" state (verifiable in prod today). With the key set, both `/tldr` and this feature light up together.
- `npm run build` passes.

## Non-goals (YAGNI)

- **No check-off / dismiss.** The tab is a *live* "what's on my plate right now" view regenerated on demand, not a persistent todo manager. The way you "act" on an item is to jump to it or set a reminder.
- **No copy / copy-all.**
- **No cross-device reminder sync and no server-side reminder delivery.** Reminders are local-only and best-effort, exactly like the morning brief.
- **No new Graph permissions.** Reuses the same conversation reads `/tldr` already performs.
- **No new top-level UI surface.** Everything lives inside the Catch-up panel that already exists.

## Decisions

### A. Extraction runs server-side via a new `/api/ai/action-items` endpoint

A new `GET /api/ai/action-items` route, structurally a sibling of `tldr/route.ts`. It reuses `/tldr`'s proven machinery:

- `auth()` + `ANTHROPIC_API_KEY` gate returning the same `status: "not_configured"` payload.
- The same Graph conversation-gathering (top chats + top teams × channels) and the same `24h/3d/7d` window resolution.
- The same in-memory cache + soft rate-limit shape.

The one substantive difference: instead of a prose prompt, it calls Claude (`claude-sonnet-4-6`) with a **tool definition** whose `input_schema` forces structured JSON output. This is more reliable than asking for JSON in free text and avoids brittle prose-parsing.

Rejected alternative: have the client gather messages and POST them to a thin endpoint like `/api/ai/summary`. This duplicates the gathering logic client-side and pushes more Graph plumbing into the browser. `/tldr` already does this well server-side; mirror it.

### B. Shared gather helpers extracted to `src/lib/ai/`

`/tldr`'s `stripHtml`, `messageText`, `sinceWindow`, and the chat+channel gathering loop are lifted into a new `src/lib/ai/conversation-gather.ts` and imported by both routes, so there is one copy rather than two diverging ones. `tldr/route.ts` is refactored to import from it (behavior unchanged).

### C. "Remind me" is a local desktop-notification reminder, not a posted message

The existing `scheduled-messages` store *posts a real message to a conversation* at a due time — that is "send later," not a self-nudge. A reminder about an action item should not post anything anywhere. Instead it mirrors `MorningBriefScheduler`: a local record fires a `fireDesktopNotification` when due, and clicking the notification navigates to the source conversation.

Rejected alternative: schedule a self-DM via the send-later pipeline — pollutes a chat with reminder text and depends on a usable self-chat.

## Architecture & data flow

```
CatchUpPanel
  ├─ Tabs: [Digest] [Action items]   (window pills + refresh shared)
  │
  ├─ Digest tab → GET /api/ai/tldr        (unchanged)
  └─ Action items tab → GET /api/ai/action-items?window=24h
        ├─ auth() + ANTHROPIC_API_KEY gate          (shared shape with /tldr)
        ├─ gatherConversations(client, sinceDate)    (src/lib/ai/conversation-gather.ts)
        ├─ Anthropic tool-use → ActionItem[]
        └─ { status, generatedAt, since, cached, items }
              │
              ▼  grouped client-side by item.ownership
        For you / Waiting on others / Team
              each row → [jump ↗] [remind ⏰]
                 jump   → router.push(hrefFor(item) [+ ?anchor=messageId])
                 remind → useRemindersStore.add(...) → IDB
                                                  │
                                                  ▼
                              ReminderScheduler (60s tick, mounted in AppShell)
                                 due → fireDesktopNotification(task, { onclick → navigate(sourceHref) })
                                     → useRemindersStore.remove(...)
```

## Components & interfaces

### `src/lib/ai/conversation-gather.ts` (new)
- `stripHtml(html)`, `messageText(msg)`, `sinceWindow(window)` — moved verbatim from `tldr/route.ts`.
- `gatherConversations(client, sinceDate): Promise<ConvBundle[]>` — the chat + channel fetch loop, returning `{ label, contextId, contextKind, messages, count }[]`. (`/tldr` currently only needs `label`/`messages`/`count`; the added `contextId`/`contextKind` are needed by the new route to build jump hrefs and are harmless to `/tldr`.)

### `src/app/api/ai/action-items/route.ts` (new)
- Mirrors `tldr/route.ts` for gate / window / cache / rate-limit.
- Builds a transcript per conversation (reusing the gather output, including each message's id so the model can attribute a `messageId`).
- Calls Claude with a tool whose `input_schema` is the `ActionItem[]` shape below; the current user's id + display name are passed in the prompt so `ownership` is resolved relative to them.
- Returns `ActionItemsResponse`.

```ts
type Ownership = "you" | "waiting" | "team";
type ContextKind = "chat" | "channel";

interface ActionItem {
  task: string;            // imperative, concise
  owner: string | null;    // display name when attributable, else null
  ownership: Ownership;    // relative to the current user
  sourceLabel: string;     // e.g. "#dev (Platform)" or "Direct Message"
  contextId: string;       // chatId, or "teamId:channelId" for channels
  contextKind: ContextKind;
  messageId: string | null;// best-effort anchor; null → conversation-level jump
}

interface ActionItemsResponse {
  status: "ok" | "not_configured" | "error";
  generatedAt?: string;
  since?: string;
  cached: boolean;
  items?: ActionItem[];
  message?: string;
}
```

### `CatchUpPanel.tsx` (edited)
- Add a 2-tab switcher row (Digest / Action items). The active tab persists in the existing `catchUp` store (new `tab` field, default `"digest"`).
- Extract the existing digest body into a `DigestView` (no behavior change) and add a sibling `ActionItemsView`.
- `ActionItemsView` reuses the existing `SkeletonCard`, `not_configured` card, `error` card, and empty-state markup, then renders the three ownership groups. Each row renders task + owner chip + source label + a jump button and a remind button. The remind button opens a small menu: **in 1h · this evening · tomorrow 9am · custom** (custom = a time input).
- Jump uses the same href construction the sidebar/AppShell already use: `/workspace/dm/{chatId}` or `/workspace/t/{teamId}/{channelId}`, appending `?anchor={messageId}` when present.

### Reminders subsystem (new, small)
- `src/lib/storage/reminders.ts` — IDB store mirroring `scheduled-messages.ts` patterns (own object store under the shared `teamsly` DB, swallow errors). Record: `{ id, task, sourceHref, fireAt, createdAt }`. Functions: `loadAllReminders`, `addReminder`, `removeReminder`, `clearAllReminders` (the last called on sign-out alongside the other per-user clears).
- `src/store/reminders.ts` — Zustand store mirroring `scheduled.ts`: `{ reminders, hydrate, add, remove }`. Hydrated on AppShell mount like the other IDB-backed stores.
- `src/components/ReminderScheduler.tsx` — mirrors `MorningBriefScheduler`: a 60s `setInterval` checks for due reminders, fires `fireDesktopNotification(task, { tag, onclick })` where `onclick` focuses the window and navigates to `sourceHref`, then removes the fired reminder. Missed reminders (app closed at fire time) fire on the next tick after the app reopens. Mounted in `AppShell` next to `MorningBriefScheduler`.

## Error handling & edge cases

- **No API key** → `status: "not_configured"`; the tab renders the existing copy-env-var card.
- **Anthropic / tool-call failure or malformed tool input** → `status: "error"` with the existing retry affordance. Tool-use makes malformed output unlikely; the route still guard-parses the tool input and treats a parse failure as `error`.
- **Zero items** → existing "All caught up ✨" empty state.
- **`messageId` not attributable** → jump falls back to conversation-level navigation (no `?anchor`).
- **Reminders** are local-only/best-effort and documented as such, matching the morning brief's semantics.

## Testing / verification

- `npm run build` passes (the real gate per CLAUDE.md — `next build` enforces ESLint hooks rules and page-export restrictions that `tsc` misses).
- Without `ANTHROPIC_API_KEY`, both Catch-up tabs show the not-configured card.
- Reminder fire path is unit-testable via the store + a mocked clock; the tab render is verifiable against a stubbed endpoint response.

## File-change summary

New:
- `src/lib/ai/conversation-gather.ts`
- `src/app/api/ai/action-items/route.ts`
- `src/lib/storage/reminders.ts`
- `src/store/reminders.ts`
- `src/components/ReminderScheduler.tsx`

Edited:
- `src/app/api/ai/tldr/route.ts` (import shared gather helpers; behavior unchanged)
- `src/components/ai/CatchUpPanel.tsx` (tabs + ActionItemsView)
- `src/store/catchUp.ts` (add `tab` field)
- `src/components/layout/AppShell.tsx` (mount `ReminderScheduler`, hydrate reminders store; wire sign-out clear)
