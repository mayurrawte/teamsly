# Reactivity B2/B3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the message feed update in place — push upserts the single changed message (no refetch/flash), an SSE-health-aware poll only reconciles, message rows are memoized, and long histories render a bounded slice — so it feels like a native app, not a refreshing web page.

**Architecture:** Add a single-message GET route, an SSE health signal, an identity-preserving store (`upsertMessage` + reuse-on-unchanged `setMessages`), then rewire ChatView/ChannelView to upsert-on-push + poll adaptively, and make MessageItem memoized + MessageFeed render-capped.

**Tech Stack:** Next.js route handlers, Microsoft Graph, React 19 (`React.memo`, `useMemo`, `useSyncExternalStore`), Zustand, the existing SSE transport (`useRealtimeEvents`).

---

## Testing note
No test runner in this repo; the gate is the build. Per task: `npx tsc --noEmit 2>&1 | grep -v "src/lib/auth/config.ts"` (expect empty); `npm run build` at the milestones noted. Runtime behavior (two-account push, scroll) is verified manually — flagged where it applies. **Commits:** Conventional, **no AI/agent trailer** (per CLAUDE.md). Branch `feat/reactivity-b2-b3` (already created; spec committed). Subagents: stay on this branch, `git add`+`git commit` only, confirm `git branch --show-current` before each commit.

## File structure
New: `src/app/api/teams/[teamId]/channels/[channelId]/messages/[messageId]/route.ts` (single channel message GET).
Modified: `src/app/api/chats/[chatId]/messages/[messageId]/route.ts` (+GET) · `src/hooks/useRealtimeEvents.ts` (health) · `src/store/workspace.ts` (`upsertMessage` + identity merge) · `src/components/messages/ChatView.tsx`, `ChannelView.tsx` (push→upsert, adaptive poll) · `src/components/messages/MessageItem.tsx` (memo) · `src/components/messages/MessageFeed.tsx` (render-cap).

---

## Task 1: Single-message GET routes

**Files:**
- Modify: `src/app/api/chats/[chatId]/messages/[messageId]/route.ts`
- Create: `src/app/api/teams/[teamId]/channels/[channelId]/messages/[messageId]/route.ts`

- [ ] **Step 1: Add a GET handler to the chat route**

In `src/app/api/chats/[chatId]/messages/[messageId]/route.ts`, add (the file already imports `auth` and `NextResponse` and defines `type Params = Promise<{ chatId: string; messageId: string }>`):

```ts
export async function GET(_req: Request, { params }: { params: Params }) {
  const session = await auth();
  if (!session?.accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { chatId, messageId } = await params;
  try {
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/chats/${chatId}/messages/${messageId}`,
      { headers: { Authorization: `Bearer ${session.accessToken}` } }
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("Graph get chat message failed", res.status, text);
      return NextResponse.json({ error: "Graph get failed" }, { status: 502 });
    }
    return NextResponse.json(await res.json());
  } catch (err) {
    console.error("Graph get chat message error", err);
    return NextResponse.json({ error: "Graph get failed" }, { status: 502 });
  }
}
```

- [ ] **Step 2: Create the channel single-message route**

Create `src/app/api/teams/[teamId]/channels/[channelId]/messages/[messageId]/route.ts`:

```ts
import { auth } from "@/lib/auth/config";
import { NextResponse } from "next/server";

type Params = Promise<{ teamId: string; channelId: string; messageId: string }>;

export async function GET(_req: Request, { params }: { params: Params }) {
  const session = await auth();
  if (!session?.accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { teamId, channelId, messageId } = await params;
  try {
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/teams/${teamId}/channels/${channelId}/messages/${messageId}`,
      { headers: { Authorization: `Bearer ${session.accessToken}` } }
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("Graph get channel message failed", res.status, text);
      return NextResponse.json({ error: "Graph get failed" }, { status: 502 });
    }
    return NextResponse.json(await res.json());
  } catch (err) {
    console.error("Graph get channel message error", err);
    return NextResponse.json({ error: "Graph get failed" }, { status: 502 });
  }
}
```

- [ ] **Step 3: Verify** — `npx tsc --noEmit 2>&1 | grep -v "src/lib/auth/config.ts"` → no output.
- [ ] **Step 4: Commit**
```bash
git add "src/app/api/chats/[chatId]/messages/[messageId]/route.ts" "src/app/api/teams/[teamId]/channels/[channelId]/messages/[messageId]/route.ts"
git commit -m "feat(api): single-message GET for chats + channels"
```

---

## Task 2: SSE health signal

**Files:**
- Modify: `src/hooks/useRealtimeEvents.ts`

- [ ] **Step 1: Add connection-health tracking + `useRealtimeHealth`**

Replace the contents of `src/hooks/useRealtimeEvents.ts` with:

```ts
"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { RealtimeEvent } from "@/lib/realtime/pubsub";

type Handler = (event: RealtimeEvent) => void;

const handlers = new Set<Handler>();

// ---- Health (so views can slow their reconcile poll when push is live) ------
let connected = false;
let lastEventAt = 0;
const healthListeners = new Set<() => void>();

function emitHealth() {
  for (const l of healthListeners) l();
}
function setConnected(v: boolean) {
  if (connected !== v) { connected = v; emitHealth(); }
}

// "Healthy" = SSE connection is open. (Push delivery is best-effort; the
// reconcile poll is the backstop, so open-connection is a sufficient signal
// to slow the poll.)
function isHealthy(): boolean {
  return connected;
}

export function useRealtimeHealth(): boolean {
  return useSyncExternalStore(
    (cb) => { healthListeners.add(cb); return () => healthListeners.delete(cb); },
    isHealthy,
    () => false, // SSR: assume unhealthy → views use the fast poll until hydrated
  );
}

export function useRealtimeEvents(handler: Handler) {
  useEffect(() => {
    handlers.add(handler);
    return () => { handlers.delete(handler); };
  }, [handler]);
}

export function RealtimeEventsMount() {
  useEffect(() => {
    const es = new EventSource("/api/realtime/sse");
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false); // EventSource auto-reconnects; onopen flips back
    es.onmessage = (e) => {
      lastEventAt = Date.now();
      let event: RealtimeEvent;
      try {
        event = JSON.parse(e.data as string) as RealtimeEvent;
      } catch {
        return;
      }
      for (const h of handlers) h(event);
    };
    return () => { es.close(); setConnected(false); };
  }, []);
  return null;
}
```
(`lastEventAt` is recorded for future tuning; health is connection-based for now — simple and sufficient.)

- [ ] **Step 2: Verify** — `npx tsc --noEmit 2>&1 | grep -v "src/lib/auth/config.ts"` → no output.
- [ ] **Step 3: Commit**
```bash
git add src/hooks/useRealtimeEvents.ts
git commit -m "feat(realtime): expose SSE connection health (useRealtimeHealth)"
```

---

## Task 3: Store — `upsertMessage` + identity-preserving merge

**Files:**
- Modify: `src/store/workspace.ts`

- [ ] **Step 1: Add `upsertMessage` to the interface**

In the store's state interface (near `appendMessage: (contextId: string, message: MSMessage) => void;`), add:
```ts
  /** Add a single message if new, or replace it in place if it already exists
   * (by id). Preserves the array slot + every other message's object identity
   * so memoized rows don't re-render. Used by the realtime push path. */
  upsertMessage: (contextId: string, message: MSMessage) => void;
```

- [ ] **Step 2: Make `setMessages` reuse unchanged objects**

Replace the `merged` computation inside `setMessages` so unchanged incoming messages reuse the existing object reference. Replace this line:
```ts
          const merged = trimToMax(sortByCreatedDateTime([...filtered, ...uniquePending]));
```
with:
```ts
          // Reuse the existing object for any message whose id + lastModified
          // are unchanged, so React.memo'd rows don't re-render on reconcile.
          const byId = new Map(existing.map((m) => [m.id, m]));
          const reused = filtered.map((m) => {
            const prev = byId.get(m.id);
            return prev && prev.lastModifiedDateTime === m.lastModifiedDateTime ? prev : m;
          });
          const merged = trimToMax(sortByCreatedDateTime([...reused, ...uniquePending]));
```

- [ ] **Step 3: Implement `upsertMessage`**

Add the action next to `appendMessage`:
```ts
      upsertMessage: (contextId, message) =>
        set((s) => {
          if (s.expiredMessageIds.has(message.id)) return s;
          const existing = s.messagesByContext[contextId] ?? [];
          const idx = existing.findIndex((m) => m.id === message.id);
          let next: MSMessage[];
          if (idx >= 0) {
            if (existing[idx].lastModifiedDateTime === message.lastModifiedDateTime) return s;
            next = [...existing];
            next[idx] = message;
            next = sortByCreatedDateTime(next);
          } else {
            next = trimToMax(sortByCreatedDateTime([...existing, message]));
          }
          persistContext(contextId, next);
          return { messagesByContext: { ...s.messagesByContext, [contextId]: next } };
        }),
```

- [ ] **Step 4: Verify** — `npx tsc --noEmit 2>&1 | grep -v "src/lib/auth/config.ts"` → no output.
- [ ] **Step 5: Commit**
```bash
git add src/store/workspace.ts
git commit -m "feat(store): upsertMessage + identity-preserving setMessages merge"
```

---

## Task 4: ChatView + ChannelView — push→upsert + adaptive poll

**Files:**
- Modify: `src/components/messages/ChatView.tsx`
- Modify: `src/components/messages/ChannelView.tsx`

Read both. They share the same shape: a `load()` full-refetch, `setInterval(load, 30_000)`, a `useRealtimeEvents` handler that calls `loadRef.current()` on a matching event, and a `loadRef`.

- [ ] **Step 1 (ChatView): pull in `upsertMessage` + health**

Add to the workspace-store destructure the `upsertMessage` action (alongside `setMessages`/`getMessages`):
```ts
  const upsertMessage = useWorkspaceStore((s) => s.upsertMessage);
```
Import the health hook (next to the `useRealtimeEvents` import):
```ts
import { useRealtimeEvents, useRealtimeHealth } from "@/hooks/useRealtimeEvents";
```
And read it in the component body:
```ts
  const sseHealthy = useRealtimeHealth();
```

- [ ] **Step 2 (ChatView): push → upsert single message (lossless fallback)**

Replace the realtime handler body (the `if (event.type === "chat_message" && event.chatId === chatId) { void loadRef.current(); }`) with:
```ts
        if (event.type === "chat_message" && event.chatId === chatId) {
          fetch(`/api/chats/${chatId}/messages/${event.messageId}`)
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
            .then((msg: MSMessage) => upsertMessage(chatId, msg))
            .catch(() => void loadRef.current()); // fallback: full refetch, lossless
        }
```
Add `upsertMessage` to that `useRealtimeEvents` callback's dependency array (so it's captured) — keep the handler wrapped in `useCallback` as it already is; add `upsertMessage` and `chatId` to its deps.

- [ ] **Step 3 (ChatView): adaptive poll interval**

Replace `const interval = setInterval(load, 30_000);` with:
```ts
    // Reconcile poll: slow when SSE push is live, fast when it isn't.
    const interval = setInterval(load, sseHealthy ? 120_000 : 30_000);
```
Add `sseHealthy` to that effect's dependency array so the interval is recreated when health flips. (The effect already re-runs on `chatId`; adding `sseHealthy` is safe — `load` is re-created each run via `loadRef`.)

- [ ] **Step 4 (ChannelView): mirror Steps 1–3**

Apply the identical changes in `ChannelView.tsx`: import `useRealtimeHealth`, read `sseHealthy`, grab `upsertMessage`; in the realtime handler, on `event.type === "channel_message" && event.teamId === teamId && event.channelId === channelId`, fetch `/api/teams/${teamId}/channels/${channelId}/messages/${event.messageId}` → `upsertMessage(contextId, msg)` with the same `.catch(() => void loadRef.current())` fallback (`contextId` here is the `${teamId}:${channelId}` key already used by ChannelView); and make the poll interval `sseHealthy ? 120_000 : 30_000` with `sseHealthy` in deps.

- [ ] **Step 5: Build check (milestone)** — `npm run build` → exit 0 (catches hooks-rules). Paste final lines.
- [ ] **Step 6: Commit**
```bash
git add src/components/messages/ChatView.tsx src/components/messages/ChannelView.tsx
git commit -m "feat(messages): upsert on realtime push; adaptive reconcile poll"
```

---

## Task 5: Memoize MessageItem

**Files:**
- Modify: `src/components/messages/MessageItem.tsx`

- [ ] **Step 1: Memoize the link/markdown detection**

Inside the component, the GitHub/rich-link/body rendering currently runs every render. Wrap the detection in `useMemo` keyed on the body + id. Find where `detectGitHubLinks`, `detectRichLinks`, and `renderMessageBody`/`messagePlainText` are called and hoist them into:
```ts
  const content = message.body?.content ?? "";
  const detection = useMemo(
    () => ({
      github: detectGitHubLinks(content),
      richLinks: detectRichLinks(content),
    }),
    [content, message.id]
  );
```
Then use `detection.github` / `detection.richLinks` at the call sites (replace the inline `detectGitHubLinks(...)` / `detectRichLinks(...)` calls). (`useMemo` is already importable from React — add it to the `import { ... } from "react"` line.)

- [ ] **Step 2: Wrap the export in `React.memo` with an id+mtime comparator**

Rename the function to `MessageItemImpl` (i.e., `function MessageItemImpl({ ... }: Props) {`), and at the bottom of the file add:
```ts
function propsEqual(a: Props, b: Props): boolean {
  return (
    a.message.id === b.message.id &&
    a.message.lastModifiedDateTime === b.message.lastModifiedDateTime &&
    a.message.__pending === b.message.__pending &&
    a.message.__failed === b.message.__failed &&
    a.isGroupHead === b.isGroupHead &&
    a.contextId === b.contextId &&
    a.contextLabel === b.contextLabel
  );
  // Callback props are intentionally ignored: their behavior is row-independent,
  // so a new closure identity from the parent must not force a re-render.
}

export const MessageItem = memo(MessageItemImpl, propsEqual);
```
Add `memo` to the React import: `import { memo, useState, useEffect, useRef, useMemo, type KeyboardEvent } from "react";` (keep whatever else was imported). Remove the `export` keyword from the (now `Impl`) function declaration.

- [ ] **Step 3: Build check** — `npm run build` → exit 0 (the `MessageItem` named export must still resolve in MessageFeed). Paste final lines.
- [ ] **Step 4: Commit**
```bash
git add src/components/messages/MessageItem.tsx
git commit -m "perf(messages): memoize MessageItem + link/markdown detection"
```

---

## Task 6: MessageFeed — render-cap + load-older + smooth scroll

**Files:**
- Modify: `src/components/messages/MessageFeed.tsx`

- [ ] **Step 1: Add a visible-count cap + the visible slice**

After the existing `const [newMessagesCount, setNewMessagesCount] = useState(0);`, add:
```ts
  const INITIAL_CAP = 100;
  const CAP_STEP = 100;
  const [visibleCount, setVisibleCount] = useState(INITIAL_CAP);
```
Replace `const meta = useMemo(() => computeMeta(messages), [messages]);` with a slice + meta over the slice:
```ts
  const visible = useMemo(
    () => (messages.length > visibleCount ? messages.slice(-visibleCount) : messages),
    [messages, visibleCount]
  );
  const meta = useMemo(() => computeMeta(visible), [visible]);
  const hasOlder = messages.length > visible.length;
```

- [ ] **Step 2: Render the slice + a "load older" control (with scroll preservation)**

In the render, change `{messages.map((msg, idx) => (` to `{visible.map((msg, idx) => (`. Immediately before that map (after the `messages.length === 0` empty block), add the load-older button:
```tsx
        {hasOlder && (
          <button
            type="button"
            onClick={() => {
              const el = scrollRef.current;
              const before = el?.scrollHeight ?? 0;
              setVisibleCount((c) => c + CAP_STEP);
              // Preserve scroll position: after the older rows mount, keep the
              // previously-visible top in place instead of jumping.
              requestAnimationFrame(() => {
                const el2 = scrollRef.current;
                if (el2) el2.scrollTop += el2.scrollHeight - before;
              });
            }}
            className="mx-auto my-2 rounded-full border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-1 text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            Load older messages
          </button>
        )}
```

- [ ] **Step 3: Reset the cap on context change**

In the existing `useEffect(() => { ... }, [contextId]);` that resets scroll state, add:
```ts
    setVisibleCount(INITIAL_CAP);
```

- [ ] **Step 4: Raise the cap when an anchored message is below it**

In the anchor effect, before the `scroll.querySelector` lookup, ensure the anchored message is within the rendered slice — if it exists in `messages` but is older than the cap, raise the cap so the row mounts. Add right after `if (!scroll) return;`:
```ts
    const fullIdx = messages.findIndex((m) => m.id === anchorMessageId);
    if (fullIdx >= 0 && messages.length - fullIdx > visibleCount) {
      setVisibleCount(messages.length - fullIdx + 10);
      return; // re-runs after the slice grows (messages.length dep) and the row mounts
    }
```
Add `visibleCount` to that effect's dependency array.

- [ ] **Step 5: Smooth scroll on live arrival**

In the "React to new messages arriving" effect, change the near-bottom branch from `scrollToBottom("instant");` to `scrollToBottom("smooth");`. (Leave the initial-load scroll at `"instant"` — no animation on first open.)

- [ ] **Step 6: Build check (milestone)** — `npm run build` → exit 0. Paste final lines.
- [ ] **Step 7: Commit**
```bash
git add src/components/messages/MessageFeed.tsx
git commit -m "perf(messages): render-cap long histories + load-older; smooth live scroll"
```

---

## Task 7: Final integration

- [ ] **Step 1: Full build + electron compile** — `npm run build && npm run electron:compile` → both exit 0.
- [ ] **Step 2: Manual verification (two accounts / your machine)**
  - B sends to a chat A has open → message appears **in place**, no skeleton flash; same for a channel.
  - B edits a message → updates in place.
  - Long history: scrolling stays smooth; "Load older messages" reveals history and holds scroll position.
  - Block `/api/realtime/sse` (devtools) → the 30s poll still updates the feed (health falls back).
  - Jump-to-message (search → result older than 100) scrolls to it (cap auto-raises).
- [ ] **Step 3: Push + finish the branch** (`finishing-a-development-branch`).

---

## Self-review

**Spec coverage:**
- Push → upsert single message → Task 4 (Steps 2/4) + the GET routes (Task 1) + `upsertMessage` (Task 3). ✓
- Identity-preserving merge → Task 3 Step 2. ✓
- Adaptive poll (120s healthy / 30s unhealthy) → Task 2 (health) + Task 4 Steps 3/4. ✓
- `React.memo` + memoized detection → Task 5. ✓
- Render-cap (N=100) + load-older + scroll preservation → Task 6 Steps 1–3. ✓
- Cap-raises-for-anchor → Task 6 Step 4. ✓
- Smooth live scroll (#21) → Task 6 Step 5. ✓
- Lossless push fallback → Task 4 Step 2 (`.catch(loadRef.current)`). ✓
- Channel single-message route added → Task 1 Step 2. ✓ (chat GET added too — the chat route had only PATCH/DELETE.)
- Correctness backstop (poll) unchanged in spirit → poll retained, only its cadence is health-gated. ✓

**Placeholder scan:** No TBD/TODO; every code step has complete code. The ChannelView mirror (Task 4 Step 4) describes exact changes referencing the ChatView code shown — acceptable (same code, different identifiers), not a "see Task N" dodge.

**Type/name consistency:** `upsertMessage(contextId, message)` defined in Task 3, used in Task 4. `useRealtimeHealth(): boolean` defined in Task 2, used in Task 4. `MessageItem` stays a named export (Task 5 keeps the name via `export const MessageItem = memo(...)`), so MessageFeed's `import { MessageItem }` still resolves. `visible`/`visibleCount`/`hasOlder`/`INITIAL_CAP`/`CAP_STEP` consistent within Task 6. The GET routes return the raw Graph message which the client treats as `MSMessage` (same shape the list route returns).

**Note:** `MSMessage.lastModifiedDateTime` is used for change-detection in Tasks 3 & 5 — it's a standard Graph chatMessage field; if a message lacks it, `undefined === undefined` makes upsert treat same-id as unchanged (safe — the reconcile poll still catches genuine edits).
