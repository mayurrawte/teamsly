# Chat Task Deadlines Implementation Plan (minimal)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a parsed `dueDate` to the existing AI action-item extraction and show a due-date chip (soonest-first) in the action-items view. Detect + display only.

**Architecture:** Extend the existing `/api/ai/action-items` extraction with one `dueDate` field resolved against the viewer's local "today" (passed as a query param, precision-biased in the prompt). `ActionItemsView` sends its local date, sorts dated items first, and renders a humanized due chip. No new endpoints, scopes, storage, or external calls.

**Tech Stack:** Next.js 16 route handler, OpenAI structured outputs (`json_schema`), TypeScript, React client component, Tailwind v4 CSS-var tokens.

> **No unit-test harness:** this repo has no `npm test`. Per `CLAUDE.md` the gate is `npm run build` (Next 16 / Turbopack); it must stay green after each task, plus the listed manual check. `node_modules` is already installed — do not reinstall. Work on branch `feat/task-deadlines`; do NOT switch branches. Commits: Conventional, **no AI/agent co-author trailer** (repo rule).

---

## File Structure

- **Modify** `src/lib/ai/conversation-gather.ts` — `ActionItem` interface gains `dueDate: string | null`.
- **Modify** `src/app/api/ai/action-items/route.ts` — `RawItem` + schema gain `dueDate`; read+validate a `today` query param; inject today + resolution rules into the prompt; map/validate `dueDate`; add `today` to the cache key.
- **Modify** `src/components/ai/ActionItemsView.tsx` — send `&today=`; sort each ownership group soonest-due first; render a `DueChip`.

---

## Task 1: Add `dueDate` to the `ActionItem` type

**Files:**
- Modify: `src/lib/ai/conversation-gather.ts`

- [ ] **Step 1: Add the field**

In the `ActionItem` interface, add `dueDate` after `messageId`. Replace:

```ts
export interface ActionItem {
  task: string;
  owner: string | null;
  ownership: Ownership;
  sourceLabel: string;
  contextId: string;
  contextKind: "chat" | "channel";
  messageId: string | null;
}
```

with:

```ts
export interface ActionItem {
  task: string;
  owner: string | null;
  ownership: Ownership;
  sourceLabel: string;
  contextId: string;
  contextKind: "chat" | "channel";
  messageId: string | null;
  /** ISO date (YYYY-MM-DD) of an explicit deadline stated in chat, or null. */
  dueDate: string | null;
}
```

- [ ] **Step 2: Verify the build**

Run: `npm run build`
Expected: it FAILS in `src/app/api/ai/action-items/route.ts` — the object built there no longer satisfies `ActionItem` (missing `dueDate`). This is expected; Task 2 fixes it. (If you prefer a green build between tasks, do Task 1 and Task 2 back-to-back before building — they're a single logical change split for readability.)

> Note: Tasks 1 and 2 together form one compilable unit. Implement both, then build once at the end of Task 2.

---

## Task 2: Extract `dueDate` in the action-items route

**Files:**
- Modify: `src/app/api/ai/action-items/route.ts`

- [ ] **Step 1: Add `dueDate` to `RawItem`**

Replace:

```ts
interface RawItem {
  task: string;
  owner: string | null;
  ownership: Ownership;
  conversationIndex: number;
  messageIndex: number | null;
}
```

with:

```ts
interface RawItem {
  task: string;
  owner: string | null;
  ownership: Ownership;
  conversationIndex: number;
  messageIndex: number | null;
  dueDate: string | null;
}
```

- [ ] **Step 2: Add an ISO-date guard (module scope, above `ACTION_ITEMS_SCHEMA`)**

```ts
/** True for a strict YYYY-MM-DD calendar date. */
function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}
```

- [ ] **Step 3: Add `dueDate` to the schema**

In `ACTION_ITEMS_SCHEMA`, add the property after `messageIndex` and add `"dueDate"` to the item's `required` array. The item `properties` block becomes:

```ts
        properties: {
          task: { type: "string", description: "The action, phrased imperatively and concisely." },
          owner: { type: ["string", "null"], description: "Display name of who owns it, or null." },
          ownership: {
            type: "string",
            enum: ["you", "waiting", "team"],
            description:
              "'you' = the current user must do it; 'waiting' = the user is blocked on / delegated it to someone else; 'team' = a general task with no clear owner.",
          },
          conversationIndex: { type: "integer", description: "Index of the [Conversation N] header." },
          messageIndex: { type: ["integer", "null"], description: "Index of the source message [N], or null." },
          dueDate: {
            type: ["string", "null"],
            description: "Explicit deadline as an ISO date YYYY-MM-DD, or null if none is stated.",
          },
        },
        required: ["task", "owner", "ownership", "conversationIndex", "messageIndex", "dueDate"],
        additionalProperties: false,
```

- [ ] **Step 4: Read + validate the `today` query param**

Right after the existing `windowParam` line (`const windowParam = request.nextUrl.searchParams.get("window") ?? "24h";`), add:

```ts
  const todayParam = request.nextUrl.searchParams.get("today");
  const today = isIsoDate(todayParam) ? todayParam : new Date().toISOString().slice(0, 10);
```

- [ ] **Step 5: Put `today` in the cache key**

Replace:

```ts
  const cacheKey = `${meId}::${windowParam}::${sinceIso.slice(0, 13)}`;
```

with:

```ts
  const cacheKey = `${meId}::${windowParam}::${today}::${sinceIso.slice(0, 13)}`;
```

- [ ] **Step 6: Add today + deadline rules to the prompt**

Replace the prompt's `Rules:` block. The existing content is:

```ts
          content: `You extract concrete action items from Microsoft Teams conversations for ${meName} (user id ${meId}).

Rules:
- Only real, actionable tasks: asks, todos, commitments, blockers, follow-ups. Ignore small talk, FYIs, and resolved items.
- Set ownership relative to ${meName}: "you" if ${meName} must do it; "waiting" if ${meName} is waiting on or delegated it to someone else; "team" if it's a general task with no clear single owner.
- Set owner to the responsible person's display name when clear, else null.
- Reference the source with conversationIndex (the [Conversation N] header) and messageIndex (the [N] within that conversation). Use the message that best represents the task; null messageIndex if none fits.
- If there are no action items, return an empty items array.

Conversations:

${transcript}`,
```

Replace it with (adds the deadline rule; everything else unchanged):

```ts
          content: `You extract concrete action items from Microsoft Teams conversations for ${meName} (user id ${meId}).

Rules:
- Only real, actionable tasks: asks, todos, commitments, blockers, follow-ups. Ignore small talk, FYIs, and resolved items.
- Set ownership relative to ${meName}: "you" if ${meName} must do it; "waiting" if ${meName} is waiting on or delegated it to someone else; "team" if it's a general task with no clear single owner.
- Set owner to the responsible person's display name when clear, else null.
- Reference the source with conversationIndex (the [Conversation N] header) and messageIndex (the [N] within that conversation). Use the message that best represents the task; null messageIndex if none fits.
- Today is ${today}. Set dueDate to a concrete ISO date (YYYY-MM-DD) ONLY when the message states an explicit deadline, resolved against today: "tomorrow" = today + 1 day; a weekday name (e.g. "by Friday") = its next occurrence; "end of week" = the coming Friday; "next week" = the coming Monday. If no explicit, resolvable deadline is stated, set dueDate to null. Never invent a deadline.
- If there are no action items, return an empty items array.

Conversations:

${transcript}`,
```

- [ ] **Step 7: Map + validate `dueDate` in the response**

In the `.map((r) => { ... })` that builds `ActionItem`s, add `dueDate` to the returned object. Replace:

```ts
      return {
        task: r.task.trim(),
        owner: typeof r.owner === "string" && r.owner.trim() ? r.owner.trim() : null,
        ownership,
        sourceLabel: conv.label,
        contextId: conv.contextId,
        contextKind: conv.contextKind,
        messageId: msg?.id ?? null,
      } satisfies ActionItem;
```

with:

```ts
      return {
        task: r.task.trim(),
        owner: typeof r.owner === "string" && r.owner.trim() ? r.owner.trim() : null,
        ownership,
        sourceLabel: conv.label,
        contextId: conv.contextId,
        contextKind: conv.contextKind,
        messageId: msg?.id ?? null,
        dueDate: isIsoDate(r.dueDate) ? r.dueDate : null,
      } satisfies ActionItem;
```

- [ ] **Step 8: Verify the build (covers Task 1 + Task 2)**

Run: `npm run build`
Expected: `✓ Compiled successfully`, no TS errors. `/api/ai/action-items` appears in the route output.

- [ ] **Step 9: Commit (Task 1 + Task 2 together)**

```bash
git add src/lib/ai/conversation-gather.ts src/app/api/ai/action-items/route.ts
git commit -m "feat(ai): extract task deadlines (dueDate) in action items"
```

---

## Task 3: Show the due-date chip in `ActionItemsView`

**Files:**
- Modify: `src/components/ai/ActionItemsView.tsx`

- [ ] **Step 1: Send the client's local date to the route**

Replace the fetch URL:

```ts
        const res = await fetch(`/api/ai/action-items?window=${win}`);
```

with:

```ts
        const d = new Date();
        const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const res = await fetch(`/api/ai/action-items?window=${win}&today=${today}`);
```

- [ ] **Step 2: Add the due-date humanizer + chip (module scope, e.g. above `ActionItemsView`)**

```tsx
/** Humanize a YYYY-MM-DD deadline relative to the viewer's local today. */
function formatDue(dueDate: string): { label: string; tone: "overdue" | "soon" | "normal" } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dueDate);
  if (!m) return null;
  const due = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return { label: "Overdue", tone: "overdue" };
  if (diff === 0) return { label: "Due today", tone: "soon" };
  if (diff === 1) return { label: "Due tomorrow", tone: "soon" };
  if (diff < 7) return { label: `Due ${due.toLocaleDateString([], { weekday: "short" })}`, tone: "normal" };
  return { label: `Due ${due.toLocaleDateString([], { month: "short", day: "numeric" })}`, tone: "normal" };
}

function DueChip({ dueDate }: { dueDate: string }) {
  const due = formatDue(dueDate);
  if (!due) return null;
  const tone =
    due.tone === "overdue"
      ? "bg-red-500/15 text-red-400"
      : due.tone === "soon"
        ? "bg-[var(--message-bg)] text-[var(--accent)]"
        : "bg-[var(--message-bg)] text-[var(--text-secondary)]";
  return <span className={`rounded-full px-1.5 py-0.5 font-medium ${tone}`}>{due.label}</span>;
}
```

- [ ] **Step 3: Sort each ownership group soonest-due first**

In the `GROUPS.map(...)`, replace:

```tsx
        const groupItems = items.filter((i) => i.ownership === group.key);
        if (groupItems.length === 0) return null;
```

with:

```tsx
        const groupItems = items
          .filter((i) => i.ownership === group.key)
          .sort((a, b) => {
            if (a.dueDate && b.dueDate) return a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0;
            if (a.dueDate) return -1; // dated items first
            if (b.dueDate) return 1;
            return 0;
          });
        if (groupItems.length === 0) return null;
```

- [ ] **Step 4: Render the chip in `ActionItemRow`**

In `ActionItemRow`, the metadata row currently is:

```tsx
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[var(--text-muted)]">
          {item.owner && (
            <span className="rounded-full bg-[var(--message-bg)] px-1.5 py-0.5 text-[var(--text-secondary)]">
              @{item.owner}
            </span>
          )}
          <span className="truncate">{item.sourceLabel}</span>
        </div>
```

Add the `DueChip` as the first child:

```tsx
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[var(--text-muted)]">
          {item.dueDate && <DueChip dueDate={item.dueDate} />}
          {item.owner && (
            <span className="rounded-full bg-[var(--message-bg)] px-1.5 py-0.5 text-[var(--text-secondary)]">
              @{item.owner}
            </span>
          )}
          <span className="truncate">{item.sourceLabel}</span>
        </div>
```

- [ ] **Step 5: Verify the build**

Run: `npm run build`
Expected: `✓ Compiled successfully`, no TS/ESLint errors.

- [ ] **Step 6: Manual check**

`npm run dev`, sign in, open a conversation that contains a deadline ("can you send the report by tomorrow?"), then open catch-up / the home → the **Action items** tab. Verify:
- The task shows a **Due tomorrow** chip; an item with no deadline shows no chip.
- Items within "For you" are ordered soonest-due first.
- A message with no real task ("let's sync next week") does not produce a spurious task/deadline.

- [ ] **Step 7: Commit**

```bash
git add src/components/ai/ActionItemsView.tsx
git commit -m "feat(ai): show due-date chips on action items, soonest first"
```

---

## Final verification

- [ ] `npm run build` green.
- [ ] The "remind me" + jump-to-source on action items still work unchanged (no regression).
- [ ] Open a PR with `Closes #` referencing the task-deadlines issue (or note this rides #35 if no separate issue exists).
