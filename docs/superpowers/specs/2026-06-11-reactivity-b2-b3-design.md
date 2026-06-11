# Reactivity B2/B3 — push-append + adaptive poll + cheap rendering — Design

**Date:** 2026-06-11
**Status:** Approved (design)
**Issue:** #104 (subsumes #21). Native-feel audit **track B**; B1 (per-context loading + sidebar prefetch) already shipped (PR #75).

## Problem

Once the shell is fast, the remaining "feels like a refreshing web page" tells are in the message feed:

1. **Every update is a full refetch + list replace.** On mount, on a 30s safety poll, and on every realtime SSE push, `ChatView`/`ChannelView` call `load()` → `GET /api/.../messages` → `setMessages(replace)`. A push (new message from someone else) triggers a whole-list re-fetch and replace — a skeleton/flash, not an in-place append.
2. **No memoization.** `MessageItem` is a plain function and the list-replace creates all-new message objects, so **every** row re-renders on any update. Long histories get janky.
3. **No render bound.** `MessageFeed` maps every message; very long histories render every row.
4. **Always-on 30s poll** even when SSE is healthy — redundant network + the source of the periodic full-replace re-render.

## Goal & success criteria

The message view **mutates in place** instead of refetch-and-flashing:

- A realtime push updates the open conversation by **upserting the single changed message** (no list replace, no skeleton).
- The safety poll is **adaptive**: slow reconciliation when SSE is healthy, fast (today's 30s) when it isn't.
- Rendering is cheap: `MessageItem` is memoized and unchanged rows don't re-render; long histories render a **bounded slice** (last N) with a "load older" control.
- New-message auto-scroll is **smooth** (when already near the bottom); existing near-bottom anchoring + jump-to-message are preserved.
- **Correctness is never weakened**: the poll remains the backstop, so a missed/failed push is always reconciled. Behavior is identical on web and desktop.
- `npm run build` passes.

## Non-goals (YAGNI)

- No full windowing/virtualization library (render-cap instead).
- No read receipts, no new realtime event types, no change to the send path or the disappearing (4s) / scheduled (5s) sweeps.
- No offline message store changes beyond identity-preserving merge.

## Established facts (from exploration)

- SSE client already exists: `src/hooks/useRealtimeEvents.ts` (shared `EventSource` in `RealtimeEventsMount`, per-handler registration) — but it has **no health/reconnect signal**.
- `ChatView.tsx` / `ChannelView.tsx`: `load()` does a full `GET messages` → `setMessages(replace)`; called on mount, `setInterval(load, 30_000)`, and from the `useRealtimeEvents` handler (`loadRef.current()`) on a matching `chat_message`/`channel_message` event.
- Store (`src/store/workspace.ts`): has `appendMessage` + a merging `setMessages` (handles expired-filter + optimistic preservation) — but the merge takes the **fresh incoming objects** (no identity reuse).
- `MessageItem` is **not** memoized. `MessageFeed` already tracks `isNearBottom` and only auto-scrolls when near bottom (currently `"instant"`); supports anchor/jump-to-message; **no virtualization**.
- Single-message route **exists for chats** (`/api/chats/[chatId]/messages/[messageId]`) but **not for channels** — the plan adds the channel twin.

## Decisions

### A. Push → upsert one message (B2)
The SSE event carries the `messageId`. On a matching event, fetch just that message and **upsert** it into the store — add if new, replace-in-place if edited. No list replace ⇒ no flash, and every other message keeps its object reference. Falls back to the existing full `load()` if the single-message fetch fails (lossless).

### B. Identity-preserving merge (B2/B3 synergy)
Rewrite `setMessages` so an incoming message that is unchanged (same `id` + `lastModifiedDateTime`) reuses the **existing** object reference. This keeps `React.memo` effective on both the push-upsert path and the (rare) poll reconcile. The existing expired-filter and optimistic/pending preservation are retained.

### C. Adaptive poll
The `load` interval is health-aware: **120s** when SSE is healthy (recent open connection + event flow), **30s** when unhealthy/disconnected. Disappearing (4s) and scheduled (5s) sweeps are unchanged.

### D. Render-cap + memo + smooth scroll (B3)
- `React.memo(MessageItem)`; memoize the per-message link + markdown detection (`useMemo` keyed on the message body) so it isn't recomputed each render.
- `MessageFeed` renders only the most recent **N = 100** messages; a "Load older messages" control at the top raises the cap (e.g. +100) and preserves scroll position. Date dividers + grouping operate on the capped slice; `isNearBottom` anchoring and anchor/jump-to-message are preserved.
- Live near-bottom auto-scroll uses `"smooth"`.

## Architecture & data flow

```
RealtimeEventsMount (shared EventSource)
  ├─ onopen → health = healthy; onerror → health = unhealthy; record lastEventAt
  └─ dispatch event → registered handlers

ChatView / ChannelView
  ├─ useRealtimeEvents(handler):
  │     matching {chat,channel}_message → GET single message by id
  │          → upsertMessage(contextId, msg)        // in place, no flash
  │          (on fetch failure → loadRef.current())  // lossless fallback
  ├─ adaptive poll: setInterval(load, healthy ? 120_000 : 30_000)  // reconcile
  └─ load(): GET messages → setMessages (identity-preserving merge)

MessageFeed
  └─ render last N (100); "Load older" raises cap; memo'd rows;
     near-bottom → smooth auto-scroll; anchor/jump preserved
```

## Components & interfaces

### `src/hooks/useRealtimeEvents.ts` (modify)
- In `RealtimeEventsMount`, set `es.onopen`/`es.onerror` to update a module-level health state + `lastEventAt` (updated in `onmessage`).
- Export `useRealtimeHealth(): { healthy: boolean }` — `healthy` = connection open AND (an event seen recently OR connection fresh). Backed by a `useSyncExternalStore` (or a tiny zustand store) so components re-render on health change.

### `src/store/workspace.ts` (modify)
- Add `upsertMessage(contextId, message)`: replace-by-id-in-place if present (keeps array slot, re-sort only if `createdDateTime` changed), else insert in sorted position; persist; preserve optimistic messages.
- Rewrite the `setMessages` merge to reuse the existing object when `incoming.id` matches and `lastModifiedDateTime` is unchanged. Keep expired-filter + pending preservation.

### `src/app/api/teams/[teamId]/channels/[channelId]/messages/[messageId]/route.ts` (new)
- GET a single channel message by id via Graph, mirroring the existing chat single-message route (`/api/chats/[chatId]/messages/[messageId]`). Auth-gated like its siblings.

### `src/components/messages/ChatView.tsx` / `ChannelView.tsx` (modify)
- Realtime handler: on matching event, fetch the single message by id → `upsertMessage`; on failure, call `loadRef.current()`.
- Poll interval: derive from `useRealtimeHealth()` (120s healthy / 30s unhealthy). Recreate the interval when health flips.

### `src/components/messages/MessageItem.tsx` (modify)
- Wrap export in `React.memo`. Ensure callback props from parents are stable (memoized); `useMemo` the link/markdown detection keyed on the message body + id.

### `src/components/messages/MessageFeed.tsx` (modify)
- Maintain a `visibleCount` (default 100); render `messages.slice(-visibleCount)`. A top "Load older messages" button increments `visibleCount` and preserves scroll position (anchor to the previous top message). Reset `visibleCount` on `contextId` change. Live auto-scroll uses `"smooth"`.

## Error handling & edge cases

| Condition | Behavior |
|---|---|
| Single-message fetch fails on push | fall back to full `loadRef.current()` (lossless) |
| SSE drops | `onerror` → health unhealthy → poll tightens to 30s; EventSource auto-reconnects |
| Edited message pushed | upsert replaces in place (same slot) |
| Deleted message | caught by the reconcile poll (push doesn't carry deletes reliably) |
| Pending/optimistic message | never hidden by the cap (it's recent); preserved by the merge |
| Jump-to-message to an older (capped-out) message | "load older" / anchor logic raises the cap to include it (handled where the anchor effect runs) |
| Desktop (local-first) | identical — all client-side; SSE/poll unchanged by environment |

## Testing / verification

`npm run build` green (real gate; no test runner). Manual:
- Two accounts: B sends to a chat A has open → appears in-place in A, **no skeleton flash**.
- Edit from B → updates in place.
- Long history: scrolling stays smooth; "Load older" reveals history and holds scroll position.
- Force SSE off (block `/api/realtime/sse`): the 30s poll still updates the feed.
- The `useRealtimeHealth` + merge identity logic are pure-ish and unit-checkable if a runner is ever added.

## File-change summary

New:
- `src/app/api/teams/[teamId]/channels/[channelId]/messages/[messageId]/route.ts`

Modified:
- `src/hooks/useRealtimeEvents.ts` (health signal + `useRealtimeHealth`)
- `src/store/workspace.ts` (`upsertMessage` + identity-preserving `setMessages`)
- `src/components/messages/ChatView.tsx`, `ChannelView.tsx` (push→upsert, adaptive poll)
- `src/components/messages/MessageItem.tsx` (`React.memo` + memoized detection)
- `src/components/messages/MessageFeed.tsx` (render-cap + load-older + smooth scroll)
