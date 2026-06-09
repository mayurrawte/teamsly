# AI action-item extractor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Action items" tab to the existing Catch-up panel that extracts a structured, cross-conversation list of action items grouped by ownership, where each item can be jumped-to or turned into a local reminder.

**Architecture:** A new `GET /api/ai/action-items` route mirrors `/api/ai/tldr` (auth + key gate, Graph conversation-gathering, cache, rate-limit) but uses an Anthropic **tool-use** call to return typed JSON instead of prose. Shared gather logic is lifted into `src/lib/ai/conversation-gather.ts`. The client renders the items in a new tab inside `CatchUpPanel`; reminders use a new IDB-backed store + a `ReminderScheduler` that mirrors `MorningBriefScheduler`.

**Tech Stack:** Next.js App Router (route handlers), `@anthropic-ai/sdk` ^0.100.1 (tool-use), Microsoft Graph (`@microsoft/microsoft-graph-client` via `getGraphClient`), Zustand, IndexedDB, React 19.

---

## Testing note (read before starting)

This repo has **no test runner** (no vitest/jest, zero test files). Per `CLAUDE.md`, the verification gate is the build, not unit tests. Introducing a test framework for one feature would violate the established pattern and YAGNI. So each task verifies with:

- **Quick check (per step):** `npx tsc --noEmit 2>&1 | grep -v "src/lib/auth/config.ts"` — expect no output (the `auth/config.ts` error is pre-existing and filtered per `CLAUDE.md`).
- **Milestone check:** `npm run build` — expect exit 0. Required after the API is complete and after the UI is complete (and once at the end). `next build` is the only gate that catches `react-hooks/rules-of-hooks` and page-export errors that `tsc` misses.
- **Manual verification:** described per task where behavior is observable (dev server at `http://localhost:3000`).

**Commits:** Conventional Commit prefixes, imperative subject, **no AI/agent co-author trailer** (per `CLAUDE.md`). Work happens on branch `feat/ai-action-items` (created in Task 0). Never mention AI/agent in commit messages.

---

## File structure

New:
- `src/lib/ai/conversation-gather.ts` — shared Graph gather + text helpers (extracted from `/tldr`).
- `src/app/api/ai/action-items/route.ts` — the structured extraction endpoint.
- `src/lib/storage/reminders.ts` — IDB store for local reminders.
- `src/store/reminders.ts` — Zustand store for reminders.
- `src/components/ReminderScheduler.tsx` — 60s tick that fires due reminders.
- `src/components/ai/catchup-shared.tsx` — `SkeletonCard` + `NotConfiguredCard`, shared by both Catch-up views.
- `src/components/ai/DigestView.tsx` — the existing digest body, lifted out of `CatchUpPanel`.
- `src/components/ai/ActionItemsView.tsx` — the new tab body.

Modified:
- `src/app/api/ai/tldr/route.ts` — import the shared gather helpers (behavior unchanged).
- `src/lib/storage/drafts.ts` — bump `DB_VERSION` 3→4, create the `reminders` object store.
- `src/store/catchUp.ts` — add `tab` field + `setTab`, persist it.
- `src/components/ai/CatchUpPanel.tsx` — tab switcher; delegate body to `DigestView` / `ActionItemsView`.
- `src/components/layout/AppShell.tsx` — mount `ReminderScheduler`, hydrate reminders store.
- `src/components/sidebar/Sidebar.tsx`, `src/components/sidebar/UserFooter.tsx`, `src/components/layout/LeftRail.tsx` — add `clearAllReminders()` to the sign-out clears.

---

## Task 0: Branch

- [ ] **Step 1: Create the feature branch**

```bash
git checkout main && git pull --ff-only
git checkout -b feat/ai-action-items
```

- [ ] **Step 2: Commit the already-written design spec**

```bash
git add docs/superpowers/specs/2026-06-09-ai-action-items-design.md docs/superpowers/plans/2026-06-09-ai-action-items.md
git commit -m "docs: add AI action-item extractor design + plan (#35)"
```

---

## Task 1: Shared conversation-gather helper + refactor `/tldr`

**Files:**
- Create: `src/lib/ai/conversation-gather.ts`
- Modify: `src/app/api/ai/tldr/route.ts`

The `MSMessage`, `MSChat`, `MSTeam`, `MSChannel` types are ambient globals (used un-imported in `tldr/route.ts` today) — use them the same way here.

- [ ] **Step 1: Create the shared helper**

Create `src/lib/ai/conversation-gather.ts`:

```ts
import { getGraphClient } from "@/lib/graph/client";

const MESSAGES_PER_CONVERSATION = 30;
const MAX_BODY_CHARS = 200;

export interface ConvBundle {
  /** Human label, e.g. "#dev (Platform)" or "Direct Message". */
  label: string;
  /** chatId for chats; `${teamId}:${channelId}` for channels. */
  contextId: string;
  contextKind: "chat" | "channel";
  /** Messages within the window, sorted oldest-first. */
  messages: MSMessage[];
  count: number;
}

export type Ownership = "you" | "waiting" | "team";

/** The client-facing action item (shared by the route and the UI). */
export interface ActionItem {
  task: string;
  owner: string | null;
  ownership: Ownership;
  sourceLabel: string;
  contextId: string;
  contextKind: "chat" | "channel";
  messageId: string | null;
}

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export function messageText(msg: MSMessage): string {
  const raw = msg.body?.content ?? "";
  const plain = msg.body?.contentType === "html" ? stripHtml(raw) : raw;
  return plain.length > MAX_BODY_CHARS ? plain.slice(0, MAX_BODY_CHARS - 1) + "…" : plain;
}

export function sinceWindow(window: string): Date {
  const now = new Date();
  if (window === "3d") now.setDate(now.getDate() - 3);
  else if (window === "7d") now.setDate(now.getDate() - 7);
  else now.setHours(now.getHours() - 24);
  return now;
}

function sortOldestFirst(messages: MSMessage[]): MSMessage[] {
  return messages
    .slice()
    .sort((a, b) => new Date(a.createdDateTime).getTime() - new Date(b.createdDateTime).getTime());
}

/**
 * Fetch the user's recent chats + top teams' channels, returning one bundle
 * per conversation that has at least one message within the window. Messages
 * are sorted oldest-first so callers can index into them stably. Never throws;
 * partial failures are skipped.
 */
export async function gatherConversations(
  client: ReturnType<typeof getGraphClient>,
  sinceDate: Date
): Promise<ConvBundle[]> {
  const conversations: ConvBundle[] = [];

  try {
    const chatsRes = await client
      .api("/me/chats")
      .select("id,chatType,topic,lastUpdatedDateTime")
      .top(30)
      .get();
    const chats = (chatsRes.value as MSChat[]).filter(
      (c) => !c.lastUpdatedDateTime || new Date(c.lastUpdatedDateTime) >= sinceDate
    );

    const chatBundles = await Promise.allSettled(
      chats.slice(0, 20).map(async (chat) => {
        const res = await client.api(`/me/chats/${chat.id}/messages`).top(MESSAGES_PER_CONVERSATION).get();
        const messages = sortOldestFirst(
          (res.value as MSMessage[]).filter(
            (m) => !m.deletedDateTime && new Date(m.createdDateTime) >= sinceDate
          )
        );
        const label = chat.topic || (chat.chatType === "oneOnOne" ? "Direct Message" : "Group Chat");
        return {
          label,
          contextId: chat.id,
          contextKind: "chat" as const,
          messages,
          count: messages.length,
        };
      })
    );

    for (const result of chatBundles) {
      if (result.status === "fulfilled" && result.value.count > 0) conversations.push(result.value);
    }
  } catch (err) {
    console.error("[ai/gather] chats fetch failed:", err);
  }

  try {
    const teamsRes = await client.api("/me/joinedTeams").select("id,displayName").get();
    const teams = (teamsRes.value as MSTeam[]).slice(0, 3);

    for (const team of teams) {
      try {
        const chRes = await client.api(`/teams/${team.id}/channels`).select("id,displayName").get();
        const channels = (chRes.value as MSChannel[]).slice(0, 8);

        const channelBundles = await Promise.allSettled(
          channels.map(async (channel) => {
            const res = await client
              .api(`/teams/${team.id}/channels/${channel.id}/messages`)
              .top(MESSAGES_PER_CONVERSATION)
              .get();
            const messages = sortOldestFirst(
              (res.value as MSMessage[]).filter(
                (m) => !m.deletedDateTime && new Date(m.createdDateTime) >= sinceDate
              )
            );
            return {
              label: `#${channel.displayName} (${team.displayName})`,
              contextId: `${team.id}:${channel.id}`,
              contextKind: "channel" as const,
              messages,
              count: messages.length,
            };
          })
        );

        for (const result of channelBundles) {
          if (result.status === "fulfilled" && result.value.count > 0) conversations.push(result.value);
        }
      } catch {
        // continue with next team
      }
    }
  } catch (err) {
    console.error("[ai/gather] teams fetch failed:", err);
  }

  return conversations;
}
```

- [ ] **Step 2: Refactor `/tldr` to import the helpers**

In `src/app/api/ai/tldr/route.ts`:

1. Add at the top of the imports:

```ts
import { gatherConversations, messageText, sinceWindow, type ConvBundle } from "@/lib/ai/conversation-gather";
```

2. Delete the now-duplicated local declarations: the `MAX_BODY_CHARS` const, `stripHtml()`, `messageText()`, `sinceWindow()`, and the `MESSAGES_PER_CONVERSATION` const (only the gather used it). Keep `MAX_CONVERSATIONS`, `CACHE_TTL_MS`, `RATE_LIMIT_MS`.

3. Replace the entire conversation-gathering block (the `type ConvBundle = ...` line and both `try { ... }` blocks that build `conversations`) with:

```ts
  const conversations: ConvBundle[] = await gatherConversations(client, sinceDate);
```

   Leave the subsequent `conversations.sort(...)`, `top` slice, transcript building, and Anthropic call exactly as they are. The transcript builder's `.slice().sort(...)` still works (now redundant but harmless on already-sorted messages).

- [ ] **Step 3: Quick check**

Run: `npx tsc --noEmit 2>&1 | grep -v "src/lib/auth/config.ts"`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/lib/ai/conversation-gather.ts src/app/api/ai/tldr/route.ts
git commit -m "refactor(ai): extract shared conversation-gather helper from tldr"
```

---

## Task 2: `/api/ai/action-items` route

**Files:**
- Create: `src/app/api/ai/action-items/route.ts`

The model returns integer indices (not GUIDs); the route maps them back to real ids. This is the robust pattern — the model can't reliably echo long Graph GUIDs.

- [ ] **Step 1: Create the route**

Create `src/app/api/ai/action-items/route.ts`:

```ts
import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/lib/auth/config";
import { getGraphClient } from "@/lib/graph/client";
import {
  gatherConversations,
  messageText,
  sinceWindow,
  type ActionItem,
  type Ownership,
} from "@/lib/ai/conversation-gather";
import { NextRequest, NextResponse } from "next/server";

const MAX_CONVERSATIONS = 12;
const CACHE_TTL_MS = 10 * 60 * 1000;

interface ActionItemsResponse {
  status: "ok" | "not_configured" | "error";
  generatedAt?: string;
  since?: string;
  cached: boolean;
  items?: ActionItem[];
  message?: string;
}

interface CacheEntry {
  data: ActionItemsResponse;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

/** Shape the model returns via tool-use — indices reference the transcript. */
interface RawItem {
  task: string;
  owner: string | null;
  ownership: Ownership;
  conversationIndex: number;
  messageIndex: number | null;
}

const ACTION_ITEMS_TOOL: Anthropic.Tool = {
  name: "report_action_items",
  description:
    "Report the action items extracted from the conversations. Reference each item's source by the integer indices shown in the transcript.",
  input_schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            task: { type: "string", description: "The action, phrased imperatively and concisely." },
            owner: {
              type: ["string", "null"],
              description: "Display name of who owns it, or null if unassigned.",
            },
            ownership: {
              type: "string",
              enum: ["you", "waiting", "team"],
              description:
                "'you' = the current user must do it; 'waiting' = the current user is blocked on / delegated it to someone else; 'team' = a general team task with no clear owner.",
            },
            conversationIndex: {
              type: "integer",
              description: "Index of the conversation (the [Conversation N] header) the item came from.",
            },
            messageIndex: {
              type: ["integer", "null"],
              description: "Index of the specific source message within that conversation, or null.",
            },
          },
          required: ["task", "owner", "ownership", "conversationIndex", "messageIndex"],
        },
      },
    },
    required: ["items"],
  },
};

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({
      status: "not_configured",
      cached: false,
      message: "Set ANTHROPIC_API_KEY in Vercel env to enable AI action items.",
    } satisfies ActionItemsResponse);
  }

  const windowParam = request.nextUrl.searchParams.get("window") ?? "24h";
  const sinceDate = sinceWindow(windowParam);
  const sinceIso = sinceDate.toISOString();

  const client = getGraphClient(session.accessToken);

  let meId = "";
  let meName = "";
  try {
    const me = (await client.api("/me").select("id,displayName").get()) as MSUser;
    meId = me.id;
    meName = me.displayName ?? "the current user";
  } catch (err) {
    console.error("[api/ai/action-items] /me failed:", err);
    return NextResponse.json(
      { status: "error", cached: false, message: "Could not resolve current user" } satisfies ActionItemsResponse,
      { status: 502 }
    );
  }

  const cacheKey = `${meId}::${windowParam}::${sinceIso.slice(0, 13)}`;
  const now = Date.now();
  const hit = cache.get(cacheKey);
  if (hit && hit.expiresAt > now) {
    return NextResponse.json({ ...hit.data, cached: true } satisfies ActionItemsResponse);
  }

  const conversations = await gatherConversations(client, sinceDate);
  conversations.sort((a, b) => b.count - a.count);
  const top = conversations.slice(0, MAX_CONVERSATIONS);

  if (top.length === 0) {
    const empty: ActionItemsResponse = {
      status: "ok",
      cached: false,
      generatedAt: new Date().toISOString(),
      since: sinceIso,
      items: [],
    };
    cache.set(cacheKey, { data: empty, expiresAt: now + CACHE_TTL_MS });
    return NextResponse.json(empty);
  }

  const transcript = top
    .map((conv, ci) => {
      const lines = conv.messages
        .map((m, mi) => `  [${mi}] ${m.from?.user?.displayName ?? "Unknown"}: ${messageText(m)}`)
        .join("\n");
      return `[Conversation ${ci}] ${conv.label}\n${lines}`;
    })
    .join("\n\n");

  let raw: RawItem[] = [];
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      tools: [ACTION_ITEMS_TOOL],
      tool_choice: { type: "tool", name: "report_action_items" },
      messages: [
        {
          role: "user",
          content: `You extract concrete action items from Microsoft Teams conversations for ${meName} (user id ${meId}).

Rules:
- Only real, actionable tasks: asks, todos, commitments, blockers, follow-ups. Ignore small talk, FYIs, and resolved items.
- Set ownership relative to ${meName}: "you" if ${meName} must do it; "waiting" if ${meName} is waiting on or delegated it to someone else; "team" if it's a general task with no clear single owner.
- Set owner to the responsible person's display name when clear, else null.
- Reference the source with conversationIndex (the [Conversation N] header) and messageIndex (the [N] within that conversation). Use the message that best represents the task; null messageIndex if none fits.
- If there are no action items, return an empty items array.

Conversations:

${transcript}`,
        },
      ],
    });

    const toolUse = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );
    const input = toolUse?.input as { items?: RawItem[] } | undefined;
    raw = Array.isArray(input?.items) ? input!.items : [];
  } catch (err) {
    console.error("[api/ai/action-items] Anthropic request failed:", err);
    return NextResponse.json(
      { status: "error", cached: false, message: "AI extraction failed" } satisfies ActionItemsResponse,
      { status: 502 }
    );
  }

  const items: ActionItem[] = raw
    .filter((r) => r && typeof r.task === "string" && r.task.trim().length > 0)
    .map((r) => {
      const conv = top[r.conversationIndex];
      if (!conv) return null;
      const msg =
        r.messageIndex != null && r.messageIndex >= 0 ? conv.messages[r.messageIndex] : undefined;
      const ownership: Ownership =
        r.ownership === "you" || r.ownership === "waiting" || r.ownership === "team" ? r.ownership : "team";
      return {
        task: r.task.trim(),
        owner: typeof r.owner === "string" && r.owner.trim() ? r.owner.trim() : null,
        ownership,
        sourceLabel: conv.label,
        contextId: conv.contextId,
        contextKind: conv.contextKind,
        messageId: msg?.id ?? null,
      } satisfies ActionItem;
    })
    .filter((x): x is ActionItem => x !== null);

  const data: ActionItemsResponse = {
    status: "ok",
    cached: false,
    generatedAt: new Date().toISOString(),
    since: sinceIso,
    items,
  };
  cache.set(cacheKey, { data, expiresAt: now + CACHE_TTL_MS });
  return NextResponse.json(data);
}
```

- [ ] **Step 2: Build check (first milestone)**

Run: `npm run build`
Expected: exit 0 (route compiles; App Router picks up the new route handler).

- [ ] **Step 3: Manual verification of the gate (only if you have a way to run without the key)**

If `ANTHROPIC_API_KEY` is unset in your local `.env`, start `npm run dev`, sign in, and hit `http://localhost:3000/api/ai/action-items?window=24h`. Expected JSON: `{"status":"not_configured",...}`. If the key IS set locally, expect `{"status":"ok","items":[...]}`. Either confirms the route is wired. (If you can't run locally, the build + the shared logic with `/tldr` is sufficient confidence.)

- [ ] **Step 4: Commit**

```bash
git add src/app/api/ai/action-items/route.ts
git commit -m "feat(ai): add structured action-item extraction endpoint (#35)"
```

---

## Task 3: Reminders IDB storage + DB version bump

**Files:**
- Modify: `src/lib/storage/drafts.ts`
- Create: `src/lib/storage/reminders.ts`

- [ ] **Step 1: Bump the DB version and add the store**

In `src/lib/storage/drafts.ts`:

1. Change `const DB_VERSION = 3;` to `const DB_VERSION = 4;`.
2. Add a constant beside the others: `const REMINDERS_STORE = "reminders";`.
3. Inside `onupgradeneeded`, after the `SCHEDULED_STORE` block, add:

```ts
        if (!db.objectStoreNames.contains(REMINDERS_STORE)) {
          const store = db.createObjectStore(REMINDERS_STORE, { keyPath: "id" });
          store.createIndex("fireAt", "fireAt");
        }
```

- [ ] **Step 2: Create the reminders storage module**

Create `src/lib/storage/reminders.ts`:

```ts
/**
 * IndexedDB-backed store for local action-item reminders.
 *
 * A reminder is a self-nudge: a `ReminderScheduler` tick fires a desktop
 * notification at `fireAt` and clicking it navigates to `sourceHref`. Nothing
 * is posted to any conversation. Mirrors `scheduled-messages.ts`: own object
 * store under the shared `teamsly` DB, swallowed errors, never throws.
 */

import { openTeamslyDb } from "./drafts";

const STORE_NAME = "reminders";

export interface Reminder {
  /** crypto.randomUUID(). */
  id: string;
  /** The action-item text to show in the notification. */
  task: string;
  /** In-app href to open when the notification is clicked. */
  sourceHref: string;
  /** Epoch ms at which the reminder is due. */
  fireAt: number;
  /** Epoch ms the reminder was created. */
  createdAt: number;
}

export async function loadAllReminders(): Promise<Reminder[]> {
  if (typeof window === "undefined") return [];
  const db = await openTeamslyDb();
  if (!db) return [];
  return new Promise<Reminder[]>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => {
        const records = (req.result ?? []) as Reminder[];
        records.sort((a, b) => a.fireAt - b.fireAt);
        resolve(records);
      };
      req.onerror = () => {
        console.warn("[reminders] loadAll failed", req.error);
        resolve([]);
      };
    } catch (err) {
      console.warn("[reminders] loadAll threw", err);
      resolve([]);
    }
  });
}

export async function addReminder(reminder: Reminder): Promise<void> {
  if (typeof window === "undefined") return;
  const db = await openTeamslyDb();
  if (!db) return;
  return new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(reminder);
      tx.oncomplete = () => resolve();
      tx.onerror = () => {
        console.warn("[reminders] add failed", tx.error);
        resolve();
      };
      tx.onabort = () => {
        console.warn("[reminders] add aborted", tx.error);
        resolve();
      };
    } catch (err) {
      console.warn("[reminders] add threw", err);
      resolve();
    }
  });
}

export async function removeReminder(id: string): Promise<void> {
  if (typeof window === "undefined") return;
  const db = await openTeamslyDb();
  if (!db) return;
  return new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => {
        console.warn("[reminders] remove failed", tx.error);
        resolve();
      };
      tx.onabort = () => {
        console.warn("[reminders] remove aborted", tx.error);
        resolve();
      };
    } catch (err) {
      console.warn("[reminders] remove threw", err);
      resolve();
    }
  });
}

export async function clearAllReminders(): Promise<void> {
  if (typeof window === "undefined") return;
  const db = await openTeamslyDb();
  if (!db) return;
  return new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => {
        console.warn("[reminders] clearAll failed", tx.error);
        resolve();
      };
      tx.onabort = () => {
        console.warn("[reminders] clearAll aborted", tx.error);
        resolve();
      };
    } catch (err) {
      console.warn("[reminders] clearAll threw", err);
      resolve();
    }
  });
}
```

- [ ] **Step 3: Quick check**

Run: `npx tsc --noEmit 2>&1 | grep -v "src/lib/auth/config.ts"`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/lib/storage/drafts.ts src/lib/storage/reminders.ts
git commit -m "feat(storage): add IDB reminders store (DB v4)"
```

---

## Task 4: Reminders Zustand store

**Files:**
- Create: `src/store/reminders.ts`

- [ ] **Step 1: Create the store**

Create `src/store/reminders.ts`:

```ts
import { create } from "zustand";
import {
  addReminder as addToIdb,
  clearAllReminders as clearAllFromIdb,
  loadAllReminders,
  removeReminder as removeFromIdb,
  type Reminder,
} from "@/lib/storage/reminders";

export type { Reminder } from "@/lib/storage/reminders";

interface ReminderState {
  reminders: Reminder[];
  /** Best-effort prefill from IndexedDB; called once on AppShell mount. */
  hydrate: () => Promise<void>;
  add: (reminder: Reminder) => void;
  remove: (id: string) => void;
  clearAll: () => void;
}

function sortBySoonest(list: Reminder[]): Reminder[] {
  return [...list].sort((a, b) => a.fireAt - b.fireAt);
}

export const useRemindersStore = create<ReminderState>((set) => ({
  reminders: [],

  hydrate: async () => {
    const fromIdb = await loadAllReminders();
    set((s) => {
      const keyed = new Map<string, Reminder>();
      for (const r of fromIdb) keyed.set(r.id, r);
      for (const r of s.reminders) keyed.set(r.id, r);
      return { reminders: sortBySoonest([...keyed.values()]) };
    });
  },

  add: (reminder) => {
    set((s) => ({ reminders: sortBySoonest([reminder, ...s.reminders.filter((r) => r.id !== reminder.id)]) }));
    void addToIdb(reminder);
  },

  remove: (id) => {
    set((s) => ({ reminders: s.reminders.filter((r) => r.id !== id) }));
    void removeFromIdb(id);
  },

  clearAll: () => {
    set({ reminders: [] });
    void clearAllFromIdb();
  },
}));
```

- [ ] **Step 2: Quick check**

Run: `npx tsc --noEmit 2>&1 | grep -v "src/lib/auth/config.ts"`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/store/reminders.ts
git commit -m "feat(store): add reminders zustand store"
```

---

## Task 5: ReminderScheduler + AppShell wiring + sign-out clears

**Files:**
- Create: `src/components/ReminderScheduler.tsx`
- Modify: `src/components/layout/AppShell.tsx`
- Modify: `src/components/sidebar/Sidebar.tsx`, `src/components/sidebar/UserFooter.tsx`, `src/components/layout/LeftRail.tsx`

- [ ] **Step 1: Create the scheduler**

Create `src/components/ReminderScheduler.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRemindersStore } from "@/store/reminders";
import { fireDesktopNotification } from "@/lib/utils/desktop-notification";

/**
 * Fires due action-item reminders as desktop notifications. Client-side and
 * best-effort: if the app isn't open when a reminder comes due, it fires on
 * the next 60s tick after the app reopens. Clicking a notification focuses the
 * window and navigates to the reminder's source conversation. Mirrors
 * MorningBriefScheduler — reads store state imperatively so the tick never
 * carries a stale closure.
 */
export function ReminderScheduler() {
  const router = useRouter();

  useEffect(() => {
    function check() {
      const { reminders, remove } = useRemindersStore.getState();
      const now = Date.now();
      for (const r of reminders) {
        if (r.fireAt > now) continue;
        fireDesktopNotification("Reminder", r.task, {
          tag: `teamsly-reminder-${r.id}`,
          onclick: () => {
            try {
              window.focus();
            } catch {
              /* no-op */
            }
            router.push(r.sourceHref);
          },
        });
        remove(r.id);
      }
    }

    check();
    const id = window.setInterval(check, 60_000);
    return () => window.clearInterval(id);
  }, [router]);

  return null;
}
```

- [ ] **Step 2: Mount it + hydrate the store in AppShell**

In `src/components/layout/AppShell.tsx`:

1. Add an import next to the other component imports (near line 23):

```tsx
import { ReminderScheduler } from "@/components/ReminderScheduler";
```

2. Add the reminders-store hydrate beside the existing hydrate calls (the block around lines 134-136 that calls `useDraftsStore.getState().hydrate()` etc.):

```tsx
    void useRemindersStore.getState().hydrate();
```

   and import it at the top beside the other store imports:

```tsx
import { useRemindersStore } from "@/store/reminders";
```

3. Mount the scheduler beside `<MorningBriefScheduler />` (around line 446):

```tsx
      <MorningBriefScheduler />
      <ReminderScheduler />
```

- [ ] **Step 3: Add `clearAllReminders` to the three sign-out clear sites**

In each of the three files, import `clearAllReminders` and add `clearAllReminders()` to the `Promise.all([...])` clear array:

`src/components/sidebar/Sidebar.tsx` (line ~12 import; line ~95 clear):
```ts
import { clearAllReminders } from "@/lib/storage/reminders";
```
```ts
  await Promise.all([clearMessageCache(), clearDraftsCache(), clearBookmarksCache(), clearAllScheduled(), clearAllReminders()]);
```

`src/components/sidebar/UserFooter.tsx` (line ~12 import; line ~20 clear):
```ts
import { clearAllReminders } from "@/lib/storage/reminders";
```
```ts
  await Promise.all([clearMessageCache(), clearDraftsCache(), clearBookmarksCache(), clearAllReminders()]);
```

`src/components/layout/LeftRail.tsx` (line ~22 import; line ~35 clear):
```ts
import { clearAllReminders } from "@/lib/storage/reminders";
```
```ts
  await Promise.all([clearMessageCache(), clearDraftsCache(), clearBookmarksCache(), clearAllReminders()]);
```

- [ ] **Step 4: Quick check**

Run: `npx tsc --noEmit 2>&1 | grep -v "src/lib/auth/config.ts"`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add src/components/ReminderScheduler.tsx src/components/layout/AppShell.tsx src/components/sidebar/Sidebar.tsx src/components/sidebar/UserFooter.tsx src/components/layout/LeftRail.tsx
git commit -m "feat(reminders): fire due reminders via scheduler; clear on sign-out"
```

---

## Task 6: Catch-up store `tab` field

**Files:**
- Modify: `src/store/catchUp.ts`

- [ ] **Step 1: Add the tab field**

Replace the contents of `src/store/catchUp.ts` with:

```ts
"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type CatchUpWindow = "24h" | "3d" | "7d";
export type CatchUpTab = "digest" | "actions";

interface CatchUpStore {
  open: boolean;
  window: CatchUpWindow;
  tab: CatchUpTab;
  setOpen: (v: boolean) => void;
  setWindow: (w: CatchUpWindow) => void;
  setTab: (t: CatchUpTab) => void;
}

export const useCatchUpStore = create<CatchUpStore>()(
  persist(
    (set) => ({
      open: false,
      window: "24h",
      tab: "digest",
      setOpen: (open) => set({ open }),
      setWindow: (window) => set({ window }),
      setTab: (tab) => set({ tab }),
    }),
    {
      name: "teamsly:catchup",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? localStorage : (undefined as unknown as Storage)
      ),
      partialize: (state) => ({ window: state.window, tab: state.tab }),
    }
  )
);
```

- [ ] **Step 2: Quick check**

Run: `npx tsc --noEmit 2>&1 | grep -v "src/lib/auth/config.ts"`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/store/catchUp.ts
git commit -m "feat(catchup): add persisted tab field to store"
```

---

## Task 7: Extract shared Catch-up UI + DigestView (no behavior change)

**Files:**
- Create: `src/components/ai/catchup-shared.tsx`
- Create: `src/components/ai/DigestView.tsx`
- Modify: `src/components/ai/CatchUpPanel.tsx`

This is a pure refactor: move the digest fetch + render out of `CatchUpPanel` into `DigestView`, and share `SkeletonCard` + `NotConfiguredCard`. `CatchUpPanel` will be rewritten in Task 8; this task just prepares the pieces so the digest still renders identically.

- [ ] **Step 1: Create the shared pieces**

Create `src/components/ai/catchup-shared.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] p-4">
      <div className="mb-3 h-4 w-2/3 rounded bg-[var(--border)]" />
      <div className="mb-2 h-3 w-full rounded bg-[var(--border)]" />
      <div className="mb-2 h-3 w-5/6 rounded bg-[var(--border)]" />
      <div className="h-3 w-4/6 rounded bg-[var(--border)]" />
    </div>
  );
}

/** The "AI not enabled — set ANTHROPIC_API_KEY" card, shared by both tabs. */
export function NotConfiguredCard({ feature }: { feature: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    void navigator.clipboard.writeText("ANTHROPIC_API_KEY");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] p-5">
      <p className="mb-1 text-[14px] font-semibold text-[var(--text-primary)]">AI features not enabled</p>
      <p className="mb-4 text-[13px] text-[var(--text-secondary)]">
        Add your Anthropic API key to unlock {feature}.
      </p>
      <div className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--message-bg)] px-3 py-2">
        <code className="flex-1 text-[12px] text-[var(--text-secondary)]">ANTHROPIC_API_KEY</code>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 rounded px-2 py-0.5 text-[11px] text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="mt-3 text-[12px] text-[var(--text-muted)]">
        Set this in Vercel environment variables, then redeploy.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Create DigestView**

Create `src/components/ai/DigestView.tsx` by moving the digest logic out of the current `CatchUpPanel.tsx`. It owns its own fetch keyed on `window` + `refreshNonce`, and reports `generatedAt`/`cached` up via `onMeta` so the panel footer can show them.

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import type { CatchUpWindow } from "@/store/catchUp";
import { SkeletonCard, NotConfiguredCard } from "./catchup-shared";

interface DigestResponse {
  status: "ok" | "not_configured" | "error";
  generatedAt?: string;
  since?: string;
  conversationCount?: number;
  cached: boolean;
  digest?: string;
  message?: string;
}

const WINDOW_LABELS: Record<CatchUpWindow, string> = {
  "24h": "Last 24 hours",
  "3d": "Last 3 days",
  "7d": "Last 7 days",
};

export interface CatchUpMeta {
  generatedAt?: string;
  cached: boolean;
}

export function DigestView({
  window: catchUpWindow,
  refreshNonce,
  onLoadingChange,
  onMeta,
}: {
  window: CatchUpWindow;
  refreshNonce: number;
  onLoadingChange: (loading: boolean) => void;
  onMeta: (meta: CatchUpMeta | null) => void;
}) {
  const [digest, setDigest] = useState<DigestResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchDigest = useCallback(
    async (win: CatchUpWindow) => {
      setLoading(true);
      onLoadingChange(true);
      setDigest(null);
      onMeta(null);
      try {
        const res = await fetch(`/api/ai/tldr?window=${win}`);
        const data = (await res.json()) as DigestResponse;
        setDigest(data);
        onMeta(data.status === "ok" ? { generatedAt: data.generatedAt, cached: data.cached } : null);
      } catch {
        setDigest({ status: "error", cached: false, message: "Network error — please try again." });
        onMeta(null);
      } finally {
        setLoading(false);
        onLoadingChange(false);
      }
    },
    [onLoadingChange, onMeta]
  );

  useEffect(() => {
    void fetchDigest(catchUpWindow);
  }, [catchUpWindow, refreshNonce, fetchDigest]);

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }
  if (digest?.status === "not_configured") {
    return <NotConfiguredCard feature="cross-channel AI catch-up digests" />;
  }
  if (digest?.status === "error") {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-[13px] text-red-400">
        {digest.message ?? "Something went wrong. Try refreshing."}
      </div>
    );
  }
  if (digest?.status === "ok" && digest.digest === "") {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <span className="mb-2 text-3xl">✨</span>
        <p className="text-[14px] font-semibold text-[var(--text-primary)]">All caught up</p>
        <p className="mt-1 text-[13px] text-[var(--text-muted)]">
          Nothing notable in the {WINDOW_LABELS[catchUpWindow].toLowerCase()}.
        </p>
      </div>
    );
  }
  if (digest?.status === "ok" && digest.digest) {
    return <DigestMarkdown markdown={digest.digest} />;
  }
  return null;
}

function DigestMarkdown({ markdown }: { markdown: string }) {
  const html = renderDigestMarkdown(markdown);
  return (
    <div
      className="prose-digest text-[14px] leading-relaxed text-[var(--text-primary)]"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function renderDigestMarkdown(input: string): string {
  const lines = input.split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("## ")) {
      out.push(`<h2 class="catch-up-h2">${escMd(line.slice(3))}</h2>`);
      i++;
      continue;
    }
    if (line.startsWith("### ")) {
      out.push(`<h3 class="catch-up-h3">${escMd(line.slice(4))}</h3>`);
      i++;
      continue;
    }
    if (/^- /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^- /.test(lines[i])) {
        items.push(`<li>${inlineMd(lines[i].slice(2))}</li>`);
        i++;
      }
      out.push(`<ul class="catch-up-ul">${items.join("")}</ul>`);
      continue;
    }
    if (line === "") {
      out.push("<br>");
      i++;
      continue;
    }
    out.push(`<p class="catch-up-p">${inlineMd(line)}</p>`);
    i++;
  }
  return out.join("");
}

function inlineMd(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function escMd(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
```

- [ ] **Step 3: Quick check**

Run: `npx tsc --noEmit 2>&1 | grep -v "src/lib/auth/config.ts"`
Expected: no output (these new files are self-contained; `CatchUpPanel` still has its own copy until Task 8).

- [ ] **Step 4: Commit**

```bash
git add src/components/ai/catchup-shared.tsx src/components/ai/DigestView.tsx
git commit -m "refactor(catchup): extract DigestView + shared catch-up cards"
```

---

## Task 8: ActionItemsView + tab switcher in CatchUpPanel

**Files:**
- Create: `src/components/ai/ActionItemsView.tsx`
- Modify: `src/components/ai/CatchUpPanel.tsx`

- [ ] **Step 1: Create ActionItemsView**

Create `src/components/ai/ActionItemsView.tsx`:

```tsx
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { ArrowUpRight, Clock } from "lucide-react";
import type { CatchUpWindow } from "@/store/catchUp";
import type { ActionItem } from "@/lib/ai/conversation-gather";
import { useRemindersStore } from "@/store/reminders";
import { SkeletonCard, NotConfiguredCard } from "./catchup-shared";
import type { CatchUpMeta } from "./DigestView";

interface ActionItemsResponse {
  status: "ok" | "not_configured" | "error";
  generatedAt?: string;
  since?: string;
  cached: boolean;
  items?: ActionItem[];
  message?: string;
}

type Ownership = ActionItem["ownership"];

const GROUPS: { key: Ownership; title: string }[] = [
  { key: "you", title: "For you" },
  { key: "waiting", title: "Waiting on others" },
  { key: "team", title: "Team / unassigned" },
];

function hrefForItem(item: ActionItem): string {
  const base =
    item.contextKind === "chat"
      ? `/workspace/dm/${item.contextId}`
      : `/workspace/t/${item.contextId.replace(":", "/")}`;
  return item.messageId ? `${base}?anchor=${encodeURIComponent(item.messageId)}` : base;
}

/** Reminder time presets, recomputed at render. Past presets are dropped. */
function remindPresets(): { label: string; fireAt: number }[] {
  const now = new Date();
  const out: { label: string; fireAt: number }[] = [
    { label: "In 1 hour", fireAt: now.getTime() + 60 * 60 * 1000 },
  ];
  const evening = new Date(now);
  evening.setHours(18, 0, 0, 0);
  if (evening.getTime() > now.getTime() + 10 * 60 * 1000) {
    out.push({ label: "This evening", fireAt: evening.getTime() });
  }
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  out.push({ label: "Tomorrow 9am", fireAt: tomorrow.getTime() });
  return out;
}

export function ActionItemsView({
  window: catchUpWindow,
  refreshNonce,
  onLoadingChange,
  onMeta,
  onNavigate,
}: {
  window: CatchUpWindow;
  refreshNonce: number;
  onLoadingChange: (loading: boolean) => void;
  onMeta: (meta: CatchUpMeta | null) => void;
  onNavigate: (href: string) => void;
}) {
  const [data, setData] = useState<ActionItemsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const addReminder = useRemindersStore((s) => s.add);

  const fetchItems = useCallback(
    async (win: CatchUpWindow) => {
      setLoading(true);
      onLoadingChange(true);
      setData(null);
      onMeta(null);
      try {
        const res = await fetch(`/api/ai/action-items?window=${win}`);
        const json = (await res.json()) as ActionItemsResponse;
        setData(json);
        onMeta(json.status === "ok" ? { generatedAt: json.generatedAt, cached: json.cached } : null);
      } catch {
        setData({ status: "error", cached: false, message: "Network error — please try again." });
        onMeta(null);
      } finally {
        setLoading(false);
        onLoadingChange(false);
      }
    },
    [onLoadingChange, onMeta]
  );

  useEffect(() => {
    void fetchItems(catchUpWindow);
  }, [catchUpWindow, refreshNonce, fetchItems]);

  function handleRemind(item: ActionItem, fireAt: number) {
    addReminder({
      id: crypto.randomUUID(),
      task: item.task,
      sourceHref: hrefForItem(item),
      fireAt,
      createdAt: Date.now(),
    });
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }
  if (data?.status === "not_configured") {
    return <NotConfiguredCard feature="structured action-item extraction" />;
  }
  if (data?.status === "error") {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-[13px] text-red-400">
        {data.message ?? "Something went wrong. Try refreshing."}
      </div>
    );
  }
  const items = data?.status === "ok" ? data.items ?? [] : [];
  if (data?.status === "ok" && items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <span className="mb-2 text-3xl">✅</span>
        <p className="text-[14px] font-semibold text-[var(--text-primary)]">No action items</p>
        <p className="mt-1 text-[13px] text-[var(--text-muted)]">Nothing needs your attention right now.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {GROUPS.map((group) => {
        const groupItems = items.filter((i) => i.ownership === group.key);
        if (groupItems.length === 0) return null;
        return (
          <section key={group.key}>
            <h3 className="catch-up-h3 mb-2">{group.title}</h3>
            <ul className="flex flex-col gap-1.5">
              {groupItems.map((item, idx) => (
                <ActionItemRow
                  key={`${group.key}-${idx}`}
                  item={item}
                  onJump={() => onNavigate(hrefForItem(item))}
                  onRemind={(fireAt) => handleRemind(item, fireAt)}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function ActionItemRow({
  item,
  onJump,
  onRemind,
}: {
  item: ActionItem;
  onJump: () => void;
  onRemind: (fireAt: number) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [reminded, setReminded] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  function pick(fireAt: number) {
    onRemind(fireAt);
    setMenuOpen(false);
    setReminded(true);
    setTimeout(() => setReminded(false), 2000);
  }

  return (
    <li className="group flex items-start gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] p-3">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] leading-snug text-[var(--text-primary)]">{item.task}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[var(--text-muted)]">
          {item.owner && (
            <span className="rounded-full bg-[var(--message-bg)] px-1.5 py-0.5 text-[var(--text-secondary)]">
              @{item.owner}
            </span>
          )}
          <span className="truncate">{item.sourceLabel}</span>
        </div>
      </div>
      <div className="flex flex-shrink-0 items-center gap-0.5">
        <button
          type="button"
          aria-label="Jump to source"
          onClick={onJump}
          className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
        >
          <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
        <div ref={menuRef} className="relative">
          <button
            type="button"
            aria-label="Remind me"
            onClick={() => setMenuOpen((v) => !v)}
            className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] ${
              reminded ? "text-[var(--accent)]" : "text-[var(--text-muted)]"
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-8 z-10 w-40 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--content-bg)] py-1 shadow-lg">
              {remindPresets().map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => pick(p.fireAt)}
                  className="block w-full px-3 py-1.5 text-left text-[12px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                >
                  {p.label}
                </button>
              ))}
              <CustomRemind onPick={pick} />
            </div>
          )}
        </div>
      </div>
      {reminded && <span className="sr-only">Reminder set</span>}
    </li>
  );
}

function CustomRemind({ onPick }: { onPick: (fireAt: number) => void }) {
  const [value, setValue] = useState("");
  return (
    <div className="border-t border-[var(--border)] px-3 py-1.5">
      <label className="mb-1 block text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Custom</label>
      <input
        type="datetime-local"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          const t = new Date(e.target.value).getTime();
          if (!Number.isNaN(t) && t > Date.now()) onPick(t);
        }}
        className="w-full rounded border border-[var(--border)] bg-[var(--message-bg)] px-1.5 py-1 text-[11px] text-[var(--text-primary)]"
      />
    </div>
  );
}
```

- [ ] **Step 2: Rewrite CatchUpPanel to host both tabs**

Replace the entire contents of `src/components/ai/CatchUpPanel.tsx` with:

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { X, RefreshCw } from "lucide-react";
import { useCatchUpStore, type CatchUpWindow, type CatchUpTab } from "@/store/catchUp";
import { DigestView, type CatchUpMeta } from "./DigestView";
import { ActionItemsView } from "./ActionItemsView";

const WINDOW_LABELS: Record<CatchUpWindow, string> = {
  "24h": "Last 24 hours",
  "3d": "Last 3 days",
  "7d": "Last 7 days",
};

const TABS: { key: CatchUpTab; label: string }[] = [
  { key: "digest", label: "Digest" },
  { key: "actions", label: "Action items" },
];

export function CatchUpPanel() {
  const { open, window: catchUpWindow, tab, setOpen, setWindow, setTab } = useCatchUpStore();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState<CatchUpMeta | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  // Reset transient view state whenever the panel opens or the tab changes.
  useEffect(() => {
    setMeta(null);
  }, [tab, open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  const handleRefresh = useCallback(() => setRefreshNonce((n) => n + 1), []);

  function navigateAndClose(href: string) {
    setOpen(false);
    router.push(href);
  }

  const generatedTime = meta?.generatedAt
    ? new Date(meta.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <>
      {open && <div className="fixed inset-0 z-40" aria-hidden="true" onClick={() => setOpen(false)} />}

      <aside
        className={[
          "fixed bottom-0 right-0 top-0 z-50 flex w-full flex-col border-l border-[var(--border)] bg-[var(--content-bg)] shadow-[-4px_0_24px_rgba(0,0,0,0.3)] sm:w-[440px]",
          "transition-transform duration-[280ms] ease-[cubic-bezier(0.34,1.2,0.64,1)]",
          open ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
        aria-label="Catch-up panel"
        aria-hidden={!open}
      >
        <header className="flex h-[50px] flex-shrink-0 items-center justify-between border-b border-[var(--border)] px-4">
          <h2 className="text-[16px] font-bold text-[var(--text-primary)]">Catch up</h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Refresh"
              onClick={handleRefresh}
              disabled={loading}
              className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] disabled:opacity-40"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              type="button"
              aria-label="Close panel"
              onClick={() => setOpen(false)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="flex flex-shrink-0 gap-1 border-b border-[var(--border)] px-4 pt-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={[
                "relative px-3 py-2 text-[13px] font-medium transition-colors",
                tab === t.key
                  ? "text-[var(--text-primary)] after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-[var(--accent)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
              ].join(" ")}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex flex-shrink-0 gap-1.5 border-b border-[var(--border)] px-4 py-2">
          {(Object.entries(WINDOW_LABELS) as [CatchUpWindow, string][]).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setWindow(key)}
              className={[
                "rounded-full px-3 py-1 text-[12px] font-medium transition-colors",
                catchUpWindow === key
                  ? "bg-[var(--accent)] text-white"
                  : "bg-[var(--surface-raised)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {tab === "digest" ? (
            <DigestView
              window={catchUpWindow}
              refreshNonce={refreshNonce}
              onLoadingChange={setLoading}
              onMeta={setMeta}
            />
          ) : (
            <ActionItemsView
              window={catchUpWindow}
              refreshNonce={refreshNonce}
              onLoadingChange={setLoading}
              onMeta={setMeta}
              onNavigate={navigateAndClose}
            />
          )}
        </div>

        {!loading && generatedTime && (
          <footer className="flex flex-shrink-0 items-center justify-between border-t border-[var(--border)] px-4 py-2">
            <span className="text-[11px] text-[var(--text-muted)]">Generated at {generatedTime}</span>
            {meta?.cached && (
              <span className="rounded-full bg-[var(--surface-raised)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
                cached
              </span>
            )}
          </footer>
        )}
      </aside>

      <style>{`
        .catch-up-h2 {
          font-size: 13px; font-weight: 700; color: var(--text-primary);
          margin: 20px 0 6px; padding-bottom: 4px; border-bottom: 1px solid var(--border);
        }
        .catch-up-h2:first-child { margin-top: 0; }
        .catch-up-h3 {
          font-size: 12px; font-weight: 600; color: var(--text-secondary);
          margin: 12px 0 4px; text-transform: uppercase; letter-spacing: 0.04em;
        }
        .catch-up-ul { margin: 4px 0 8px 16px; list-style: disc; }
        .catch-up-ul li { margin-bottom: 3px; font-size: 13px; color: var(--text-secondary); line-height: 1.5; }
        .catch-up-p { margin: 4px 0; font-size: 13px; color: var(--text-secondary); line-height: 1.5; }
        .prose-digest strong { color: var(--text-primary); }
        .prose-digest code { background: var(--surface-raised); border-radius: 3px; padding: 1px 4px; font-size: 12px; }
      `}</style>
    </>
  );
}
```

Note: the `.catch-up-h3` style is now also used by the action-items group headings — it already lives in this shared `<style>` block, so both views pick it up.

- [ ] **Step 3: Build check (second milestone)**

Run: `npm run build`
Expected: exit 0. This is the gate that catches `react-hooks/rules-of-hooks` and any page-export issues `tsc` misses.

- [ ] **Step 4: Manual verification (dev server)**

Run `npm run dev`, open the workspace, open the Catch-up panel. Verify:
- Two tabs (Digest / Action items); switching tabs refetches; the active tab persists across reload.
- Window pills + refresh affect the active tab.
- With no key: both tabs show the "AI features not enabled" card.
- With key: Action items shows grouped items; clicking jump (↗) closes the panel and navigates (and anchors when a message id is present); clicking the clock opens the preset menu and "In 1 hour" sets a reminder (the clock briefly turns accent-colored).

- [ ] **Step 5: Commit**

```bash
git add src/components/ai/ActionItemsView.tsx src/components/ai/CatchUpPanel.tsx
git commit -m "feat(catchup): add action-items tab with jump + remind (#35)"
```

---

## Task 9: Final integration check

- [ ] **Step 1: Full build + electron compile**

Run: `npm run build && npm run electron:compile`
Expected: both exit 0.

- [ ] **Step 2: Lint sanity (optional, ignore worktree noise)**

Run: `npx tsc --noEmit 2>&1 | grep -v "src/lib/auth/config.ts"`
Expected: no output.

- [ ] **Step 3: Push + open PR**

```bash
git push -u origin feat/ai-action-items
gh pr create --title "feat: AI action-item extractor" --body "Closes #35

Adds an 'Action items' tab to the Catch-up panel: a new GET /api/ai/action-items endpoint extracts structured, cross-conversation action items (grouped For you / Waiting on others / Team) via Anthropic tool-use, reusing the gather/cache/key-gate machinery shared with /tldr. Each item can jump to its source conversation (anchored to the message when known) or be turned into a local desktop-notification reminder (new IDB reminders store + ReminderScheduler, mirroring MorningBriefScheduler).

Gated on ANTHROPIC_API_KEY (same key /tldr already uses); shows the not-configured card until it's set."
```

   (User merges manually per the repo workflow. Do not mention AI/agent anywhere in the PR.)

---

## Self-review

**Spec coverage:**
- Two-tab Catch-up panel (Digest unchanged + Action items) → Tasks 6, 7, 8. ✓
- Ownership groups (For you / Waiting / Team) → Task 8 `GROUPS`. ✓
- Item fields (task, owner, sourceLabel, jump) → Task 2 `ActionItem` + Task 8 rendering. ✓
- Server-side `/api/ai/action-items` mirroring `/tldr` (gate/gather/cache/window) → Task 2. ✓
- Shared gather helper in `src/lib/ai/` → Task 1. ✓
- Structured tool-use output → Task 2 `ACTION_ITEMS_TOOL`. ✓
- Jump to source w/ best-effort anchor → Task 8 `hrefForItem`. ✓
- Remind via local desktop notification → Tasks 3, 4, 5, 8. ✓
- not_configured / error / empty states → Tasks 7, 8. ✓
- Sign-out clears reminders → Task 5. ✓
- Verification via build (no test runner) → testing note + per-task checks. ✓

**Placeholder scan:** No TBD/TODO; every code step contains complete code. ✓

**Type consistency:** `ActionItem`/`Ownership` are defined once in `src/lib/ai/conversation-gather.ts` (Task 1) and imported by both the route (Task 2) and `ActionItemsView` (Task 8) — no client→route-module import. `CatchUpMeta` defined in `DigestView` (Task 7), imported by `ActionItemsView` + `CatchUpPanel` (Task 8). `Reminder` defined in Task 3, re-exported by the store (Task 4), consumed in Tasks 5/8. `CatchUpTab` defined in Task 6, used in Task 8. `gatherConversations`/`messageText`/`sinceWindow`/`ConvBundle` defined in Task 1, imported in the Task 1 refactor + Task 2. All consistent. ✓
