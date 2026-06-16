# Chat Task Deadlines — Design (minimal)

**Goal:** Pull natural-language deadlines out of the existing AI action-item extraction. Each detected task that states an explicit deadline ("get this done by tomorrow", "next week") gets a parsed due date, shown as a chip in the action-items view — which is the workspace home (#93) — soonest-first. **Detect + display only.**

**Why:** Assigned tasks with deadlines stated in chat get missed. The action-item extractor already finds the tasks but ignores the *deadline* — the part that actually matters for "I missed it." Adding the deadline, surfaced on the screen users now land on, closes that gap at ~zero added cost (one extra field on the existing AI call, on the existing quota).

**Non-goals (explicit, per the 2026-06-15 competitive review):**
- No Microsoft To Do / Planner push; no new Graph scope; no re-consent.
- No persistence, no "my tasks" store/board.
- No reminders or notifications wired to the due date (the existing "remind me" stays exactly as-is).
- No background scanning. Detection remains the existing on-demand extraction.

## Approach

Extend the existing on-demand action-item extraction; add no new pipeline, endpoint, or storage.

1. **Type** — `ActionItem` gains `dueDate: string | null`: an ISO `YYYY-MM-DD` (date only) when the message states an explicit deadline directed at the current user, else `null`.
2. **Extraction** — the action-items route's structured-output schema gains a `dueDate` property; the prompt is given "today" (see below) and instructed to resolve relative deadlines to a concrete ISO date, returning `null` unless there is an explicit, real deadline. **Precision over recall** — do not invent deadlines that aren't stated.
3. **Display** — `ActionItemRow` renders a due-date chip when `dueDate` is set, humanized relative to the viewer's local today ("Due today" / "Due tomorrow" / "Due Mon" / "Due Jun 24"), with emphasis for overdue/today/tomorrow. Within each ownership group, dated items sort soonest-first ahead of undated ones.

## "Today" / timezone

Day-granular deadlines must resolve in the *viewer's* timezone, not the server's UTC.
- `ActionItemsView` already calls `/api/ai/action-items?window=...`; it additionally sends `&today=YYYY-MM-DD` computed from the client's local date.
- The route uses that `today` in the prompt (validated as an ISO date; falls back to the server's date if missing/invalid).
- The chip's humanization ("today"/"tomorrow") is computed client-side against the client's local today, so it always reads correctly for the viewer.

## Deadline resolution rules (stated in the prompt, to avoid ambiguity)

Given `today`, the model returns a concrete ISO date using these conventions:
- "tomorrow" → today + 1 day.
- a weekday name ("by Friday") → the next occurrence of that weekday (today if it *is* that weekday and the message implies end-of-day).
- "end of week" → the coming Friday; "next week" → the coming Monday.
- a vague horizon with no resolvable date ("soon", "later", "when you get a chance") → `null`.
- no deadline mentioned → `null`.

## Data flow

catch-up home / panel → existing `/api/ai/action-items?window=&today=` → AI returns items now including `dueDate` → `ActionItemsView` orders + renders chips. No new endpoints, storage, or external calls.

## Files

- **Modify** `src/lib/ai/conversation-gather.ts` — `ActionItem` += `dueDate: string | null`.
- **Modify** `src/app/api/ai/action-items/route.ts` — add `dueDate` to `ACTION_ITEMS_SCHEMA` (+ `required`); read the `today` query param (validated, server-date fallback) and inject it + the resolution rules into the prompt; map/validate `dueDate` in the response (coerce non-ISO to `null`).
- **Modify** `src/components/ai/ActionItemsView.tsx` — send `&today=`; sort each ownership group's items soonest-first (dated before undated); render the due-date chip in `ActionItemRow`.

## Edge cases

- Model returns a non-ISO or nonsensical `dueDate` → coerce to `null` (defensive parse; no chip).
- Model resolves a date before `today` → still shown, emphasized as **overdue**.
- No deadline → no chip; row renders as it does today.
- A cached digest generated before this change has no `dueDate` → treated as `null` (no chip). The prompt change rotates the content-hash cache key anyway, so fresh requests get dates.

## Testing

- `npm run build` green (Next 16 / Turbopack).
- Manual:
  - A chat with "can you send the report by tomorrow?" → the action item shows a **Due tomorrow** chip.
  - "let's sync next week" with no actual task → no spurious task and no deadline (precision).
  - An item with no deadline → no chip, renders normally.
  - A past deadline → overdue emphasis.
  - Items within a group are ordered soonest-due first.
