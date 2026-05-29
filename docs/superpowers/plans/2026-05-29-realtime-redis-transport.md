# Optional Redis Transport for Cross-Instance Realtime — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Microsoft Graph webhook notifications reliably reach the correct SSE connection across Vercel function instances, by putting an env-gated transport (in-memory by default, Upstash Redis when configured) in front of the realtime registry and fan-out.

**Architecture:** A `RealtimeTransport` interface abstracts two jobs — the subscription registry (subId → user/context) and pub/sub fan-out (userId → SSE). One implementation wraps today's in-memory `Map`s; another uses Upstash Redis (KV for the registry, pub/sub for fan-out). The implementation is selected once at module load by the presence of `UPSTASH_REDIS_REST_URL`. The webhook, SSE, and subscribe routes call the interface and never know which backend is live. The 30s client poll remains the correctness floor.

**Tech Stack:** Next.js 15 App Router, `@upstash/redis` (REST + HTTP-streaming pub/sub), Microsoft Graph change notifications, SSE via `ReadableStream`.

---

## Critical context before you start

- **`npm run build` is the only correct gate.** Run it after every task (per `CLAUDE.md`). `npx tsc --noEmit` is insufficient. Filter the known pre-existing error: `npm run build 2>&1 | tail -20`.
- **No test framework exists in this repo** and we are not adding one. Pure-logic tasks include a throwaway `npx tsx` assertion script (create → run → delete in the same task). I/O-bound routes are verified by `npm run build` + manual browser testing in the final task.
- **No `Co-Authored-By:` trailers.** Conventional Commit style, imperative subject, body explains *why*.
- Branch: `feat/dm-realtime-push` (this builds on the DM-push work already committed there: `8e6525e`, plus the design `feea728`).
- Project root: `/Users/mayurrawte/thepsygeek/teamsly`.
- **Redis is optional everywhere.** Every Redis call is wrapped in try/catch and degrades to a no-op (the poll covers it). Never let a Redis error throw into a route handler.
- Current `src/lib/realtime/pubsub.ts` exports: types `RealtimeEvent`, `SubscriptionRecord`; functions `subscribe`, `publish`, `registerSubscription`, `getSubscription`, `deleteSubscription`, `listUserSubscriptions`. After this plan, the named functions are replaced by an exported `transport` singleton; the types stay.
- Consumers to migrate: `src/app/api/webhooks/graph/route.ts`, `src/app/api/realtime/sse/route.ts`, `src/app/api/realtime/subscribe/route.ts`.

---

## File map

| File | Action | Responsibility |
|---|---|---|
| `src/lib/realtime/pubsub.ts` | Modify | Types + `resourceKey` helper + `RealtimeTransport` interface + `InMemoryTransport` + `RedisTransport` + env-gated `transport` singleton |
| `src/app/api/webhooks/graph/route.ts` | Modify | `transport.getSub` + `transport.publish` |
| `src/app/api/realtime/sse/route.ts` | Modify | `transport.subscribe` + `maxDuration = 300` |
| `src/app/api/realtime/subscribe/route.ts` | Modify | `findActiveSub` reuse-or-recreate via transport |
| `src/components/messages/ChatView.tsx` | Modify | ~45-min re-subscribe interval |
| `src/components/messages/ChannelView.tsx` | Modify | ~45-min re-subscribe interval |
| `package.json` | Modify | Add `@upstash/redis` |
| `.env.example` | Modify | Document optional `UPSTASH_*` vars |

---

## Task 0 — Validation spike (GATES THE REST)

Confirm the one uncertain dependency — `@upstash/redis` HTTP-streaming `subscribe` working inside a Vercel/Next function, with clean teardown and acceptable cost — before refactoring real routes. This task produces throwaway code that is deleted at the end.

**Requires:** Upstash provisioned (see "Provisioning hand-off" at the bottom). If Upstash is not yet available, STOP and ask the user to complete provisioning first.

**Files:**
- Create (throwaway): `src/app/api/_spike/pub/route.ts`
- Create (throwaway): `src/app/api/_spike/sub/route.ts`

- [ ] **Step 1: Install the client** (also needed by later tasks)

  Run: `npm install @upstash/redis`
  Expected: adds `@upstash/redis` to `dependencies`.

- [ ] **Step 2: Write the publish spike route**

  Create `src/app/api/_spike/pub/route.ts`:
  ```ts
  import { Redis } from "@upstash/redis";

  export const dynamic = "force-dynamic";

  export async function GET() {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
    const receivers = await redis.publish(
      "spike",
      JSON.stringify({ at: "published", n: 1 })
    );
    return Response.json({ receivers });
  }
  ```

- [ ] **Step 3: Write the subscribe spike route**

  Create `src/app/api/_spike/sub/route.ts`:
  ```ts
  import { Redis } from "@upstash/redis";

  export const dynamic = "force-dynamic";
  export const maxDuration = 300;

  export async function GET(req: Request) {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
    const enc = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const sub = redis.subscribe("spike");
        sub.on("message", ({ message }: { message: unknown }) => {
          try {
            controller.enqueue(enc.encode(`data: ${JSON.stringify(message)}\n\n`));
          } catch { /* closed */ }
        });
        controller.enqueue(enc.encode(": spike-connected\n\n"));
        req.signal.addEventListener("abort", () => {
          void sub.unsubscribe();
          try { controller.close(); } catch { /* already closed */ }
        });
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }
  ```

- [ ] **Step 4: Build**

  Run: `npm run build 2>&1 | tail -20`
  Expected: `✓ Compiled successfully`, with `/api/_spike/pub` and `/api/_spike/sub` listed.

- [ ] **Step 5: Run the spike manually**

  In one terminal: `npm run dev`
  In a second terminal, open the stream: `curl -N http://localhost:3000/api/_spike/sub`
  In a third terminal, publish: `curl http://localhost:3000/api/_spike/pub`

  Expected:
  - `pub` returns `{"receivers":1}` (the open `sub` stream is the 1 receiver).
  - The `curl -N` stream prints `: spike-connected` then `data: {"at":"published","n":1}`.
  - Ctrl-C the `curl -N`; confirm the dev-server logs no unhandled error (clean teardown).
  - Open the [Upstash console](https://console.upstash.com) → your DB → confirm an idle open subscribe is not burning commands at a steady rate (only the publish + connect register).

- [ ] **Step 6: Record the result and decide**

  - **If the spike passed** (messages flow, teardown clean, idle cost ~0): proceed to Task 1. The `RedisTransport.subscribe` in Task 3 uses exactly this `subscribe(...).on("message", ...)` + `unsubscribe()` shape.
  - **If the spike failed** (flaky stream, or steady idle cost): note it in the commit message and switch `RedisTransport`'s fan-out (Task 3) to the poll-a-list variant — webhook `redis.lpush("events:"+userId, ...)`, SSE route drains via `redis.lrange` + `redis.ltrim` (or `lpop`) on a ~1.5s tick. Everything else in this plan is unchanged. Tell the user before proceeding.

- [ ] **Step 7: Delete the spike routes**

  Run: `rm -rf src/app/api/_spike`

- [ ] **Step 8: Commit the dependency add**

  ```bash
  git add package.json package-lock.json
  git commit -m "chore(realtime): add @upstash/redis dependency

  For the optional Redis-backed realtime transport. Validated the
  HTTP-streaming subscribe path with a throwaway spike before wiring it in."
  ```

---

## Task 1 — Document the optional env vars

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Read the current example file**

  Run: `cat .env.example`

- [ ] **Step 2: Append the optional Upstash block**

  Add to the end of `.env.example`:
  ```
  # --- Optional: Upstash Redis (Vercel Marketplace) -----------------------------
  # When set, realtime push (channels + DMs) works reliably across Vercel
  # function instances. When unset, the app falls back to an in-memory transport
  # plus the 30s poll — fully functional, just best-effort across instances.
  # UPSTASH_REDIS_REST_URL=
  # UPSTASH_REDIS_REST_TOKEN=
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add .env.example
  git commit -m "docs(env): document optional Upstash Redis vars for realtime"
  ```

---

## Task 2 — Transport interface, `resourceKey`, and `InMemoryTransport`

Refactor `pubsub.ts` to keep the types, add the interface + `resourceKey` helper + the in-memory implementation, and export a `transport` singleton that (for now) is always in-memory. The Redis implementation is added in Task 3.

**Files:**
- Modify: `src/lib/realtime/pubsub.ts`

- [ ] **Step 1: Replace the body of `pubsub.ts`**

  Replace the entire file with (types unchanged from current; functions replaced by classes + singleton):
  ```ts
  // Realtime transport: subscription registry + pub/sub fan-out.
  // Selected once at module load — Redis when configured, in-memory otherwise.
  import { Redis } from "@upstash/redis";

  export type RealtimeEvent =
    | { type: "channel_message"; teamId: string; channelId: string; messageId: string }
    | { type: "chat_message"; chatId: string; messageId: string }
    | { type: "noop" };

  export type SubscriptionRecord =
    | {
        userId: string;
        resourceType: "channel_message";
        teamId: string;
        channelId: string;
        expiresAt: number;
      }
    | {
        userId: string;
        resourceType: "chat_message";
        chatId: string;
        expiresAt: number;
      };

  // Dedup/index key for a subscription target. One source of truth.
  export type SubTarget =
    | { kind: "chat"; chatId: string }
    | { kind: "channel"; teamId: string; channelId: string };

  export function resourceKey(target: SubTarget): string {
    return target.kind === "chat"
      ? `chat:${target.chatId}`
      : `channel:${target.teamId}:${target.channelId}`;
  }

  export interface RealtimeTransport {
    findActiveSub(
      userId: string,
      resourceKey: string
    ): Promise<{ subId: string; expiresAt: number } | null>;
    saveSub(
      subId: string,
      record: SubscriptionRecord,
      resourceKey: string,
      ttlSec: number
    ): Promise<void>;
    getSub(subId: string): Promise<SubscriptionRecord | null>;
    publish(userId: string, event: RealtimeEvent): Promise<void>;
    subscribe(
      userId: string,
      onEvent: (event: RealtimeEvent) => void
    ): Promise<() => void>;
  }

  // ---- In-memory (default; single-instance, lost on cold start) ---------------
  class InMemoryTransport implements RealtimeTransport {
    private subscribers = new Map<string, Set<(e: RealtimeEvent) => void>>();
    private records = new Map<string, { record: SubscriptionRecord; resourceKey: string }>();
    private index = new Map<string, string>(); // `${userId}|${resourceKey}` -> subId

    async findActiveSub(userId: string, rkey: string) {
      const subId = this.index.get(`${userId}|${rkey}`);
      if (!subId) return null;
      const entry = this.records.get(subId);
      if (!entry) return null;
      return { subId, expiresAt: entry.record.expiresAt };
    }

    async saveSub(subId: string, record: SubscriptionRecord, rkey: string) {
      const idxKey = `${record.userId}|${rkey}`;
      const old = this.index.get(idxKey);
      if (old && old !== subId) this.records.delete(old);
      this.records.set(subId, { record, resourceKey: rkey });
      this.index.set(idxKey, subId);
    }

    async getSub(subId: string) {
      return this.records.get(subId)?.record ?? null;
    }

    async publish(userId: string, event: RealtimeEvent) {
      const set = this.subscribers.get(userId);
      if (!set) return;
      for (const fn of set) fn(event);
    }

    async subscribe(userId: string, onEvent: (e: RealtimeEvent) => void) {
      let set = this.subscribers.get(userId);
      if (!set) {
        set = new Set();
        this.subscribers.set(userId, set);
      }
      set.add(onEvent);
      return () => {
        set!.delete(onEvent);
        if (set!.size === 0) this.subscribers.delete(userId);
      };
    }
  }

  // RedisTransport is added in Task 3.

  function selectTransport(): RealtimeTransport {
    return new InMemoryTransport();
  }

  export const transport: RealtimeTransport = selectTransport();
  ```

- [ ] **Step 2: Build**

  Run: `npm run build 2>&1 | tail -20`
  Expected: `✓ Compiled successfully`. (The three routes still import the old named functions and will FAIL to build here — that is expected; they are migrated in Tasks 4–6. If you are running tasks in order, the build fails until Task 6. To keep the build green per-task, do Steps 3–4 of Tasks 4, 5, and 6 immediately after this task; see note below.)

  > **Build-ordering note:** Tasks 2, 4, 5, 6 are a single atomic refactor of `pubsub.ts` and its three consumers — the build is only green once all four are done. Execute Tasks 2→4→5→6 as one unit and run the build once at the end of Task 6. Tasks 3, 1, 7 are independent and build green on their own. Commit each task's files separately as written, but expect the intermediate builds in 2/4/5 to fail with "X is not exported from pubsub".

- [ ] **Step 3: Verify the pure logic with a throwaway assertion script**

  Create `scripts/check-transport.ts`:
  ```ts
  import { resourceKey } from "../src/lib/realtime/pubsub";
  import assert from "node:assert";

  assert.equal(resourceKey({ kind: "chat", chatId: "19:abc@x" }), "chat:19:abc@x");
  assert.equal(
    resourceKey({ kind: "channel", teamId: "t1", channelId: "c1" }),
    "channel:t1:c1"
  );
  console.log("resourceKey OK");
  ```

  Run: `npx tsx scripts/check-transport.ts`
  Expected: prints `resourceKey OK`, exits 0.

- [ ] **Step 4: Delete the script and commit `pubsub.ts`**

  ```bash
  rm scripts/check-transport.ts
  git add src/lib/realtime/pubsub.ts
  git commit -m "refactor(realtime): add transport interface + in-memory impl

  Replaces the free-standing in-memory pub/sub + registry functions with a
  RealtimeTransport interface and an InMemoryTransport that preserves current
  behavior. Adds a resourceKey helper as the single source of truth for the
  dedup/index key. Redis impl and route migration follow."
  ```

---

## Task 3 — `RedisTransport`

Add the Redis-backed implementation and switch `selectTransport` to choose it when configured.

**Files:**
- Modify: `src/lib/realtime/pubsub.ts`

- [ ] **Step 1: Add the `RedisTransport` class** (insert where the `// RedisTransport is added in Task 3.` comment is)

  ```ts
  // ---- Redis (optional; reliable across instances) ----------------------------
  const TTL_SEC = 55 * 60;

  class RedisTransport implements RealtimeTransport {
    constructor(private redis: Redis) {}

    async findActiveSub(userId: string, rkey: string) {
      try {
        return await this.redis.get<{ subId: string; expiresAt: number }>(
          `subidx:${userId}:${rkey}`
        );
      } catch (err) {
        console.error("[redis] findActiveSub failed:", err);
        return null;
      }
    }

    async saveSub(
      subId: string,
      record: SubscriptionRecord,
      rkey: string,
      ttlSec: number
    ) {
      try {
        await Promise.all([
          this.redis.set(`subrec:${subId}`, record, { ex: ttlSec }),
          this.redis.set(
            `subidx:${record.userId}:${rkey}`,
            { subId, expiresAt: record.expiresAt },
            { ex: ttlSec }
          ),
        ]);
      } catch (err) {
        console.error("[redis] saveSub failed:", err);
      }
    }

    async getSub(subId: string) {
      try {
        return await this.redis.get<SubscriptionRecord>(`subrec:${subId}`);
      } catch (err) {
        console.error("[redis] getSub failed:", err);
        return null;
      }
    }

    async publish(userId: string, event: RealtimeEvent) {
      try {
        await this.redis.publish(`realtime:${userId}`, JSON.stringify(event));
      } catch (err) {
        console.error("[redis] publish failed:", err);
      }
    }

    async subscribe(userId: string, onEvent: (e: RealtimeEvent) => void) {
      const sub = this.redis.subscribe(`realtime:${userId}`);
      sub.on("message", ({ message }: { message: unknown }) => {
        try {
          const event =
            typeof message === "string"
              ? (JSON.parse(message) as RealtimeEvent)
              : (message as RealtimeEvent);
          onEvent(event);
        } catch {
          /* ignore malformed payloads */
        }
      });
      return () => {
        void sub.unsubscribe();
      };
    }
  }
  ```

  > If the Task 0 spike failed, implement `publish`/`subscribe` with the list-poll variant instead (lpush / lrange+ltrim on a ~1.5s tick); keep the registry methods as above.

- [ ] **Step 2: Switch `selectTransport` to env-gate**

  Replace the `selectTransport` function:
  ```ts
  function selectTransport(): RealtimeTransport {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (url && token) {
      return new RedisTransport(new Redis({ url, token }));
    }
    return new InMemoryTransport();
  }
  ```

- [ ] **Step 3: Build**

  Run: `npm run build 2>&1 | tail -20`
  Expected: `✓ Compiled successfully` (no env vars locally → in-memory path selected; Redis code still type-checks).

- [ ] **Step 4: Commit**

  ```bash
  git add src/lib/realtime/pubsub.ts
  git commit -m "feat(realtime): add Redis transport, env-gated selection

  Registry via Redis KV with TTL; fan-out via pub/sub. Selected only when
  UPSTASH_REDIS_REST_URL + _TOKEN are present, else in-memory. All Redis calls
  are wrapped so failures degrade to the poll fallback."
  ```

---

## Task 4 — Migrate the webhook route

**Files:**
- Modify: `src/app/api/webhooks/graph/route.ts`

- [ ] **Step 1: Replace the import and the dispatch loop body**

  Change the import line:
  ```ts
  import { getSubscription, publish } from "@/lib/realtime/pubsub";
  ```
  to:
  ```ts
  import { transport } from "@/lib/realtime/pubsub";
  ```

  Replace the `for (const notification of payload.value ?? [])` loop body with:
  ```ts
  for (const notification of payload.value ?? []) {
    const record = await transport.getSub(notification.subscriptionId);
    if (!record) {
      console.warn("[webhooks/graph] unknown subscriptionId", notification.subscriptionId);
      continue;
    }
    const messageId = notification.resourceData?.id;
    if (!messageId) continue;
    if (record.resourceType === "chat_message") {
      await transport.publish(record.userId, {
        type: "chat_message",
        chatId: record.chatId,
        messageId,
      });
    } else {
      await transport.publish(record.userId, {
        type: "channel_message",
        teamId: record.teamId,
        channelId: record.channelId,
        messageId,
      });
    }
  }
  ```

- [ ] **Step 2: Commit** (build is run at the end of Task 6 — see Task 2 build-ordering note)

  ```bash
  git add src/app/api/webhooks/graph/route.ts
  git commit -m "refactor(webhooks): resolve + publish via realtime transport"
  ```

---

## Task 5 — Migrate the SSE route

**Files:**
- Modify: `src/app/api/realtime/sse/route.ts`

- [ ] **Step 1: Replace the file**

  Replace `src/app/api/realtime/sse/route.ts` with:
  ```ts
  import { auth } from "@/lib/auth/config";
  import { transport } from "@/lib/realtime/pubsub";
  import type { RealtimeEvent } from "@/lib/realtime/pubsub";

  export const dynamic = "force-dynamic";
  export const maxDuration = 300;

  export async function GET(req: Request) {
    const session = await auth();
    if (!session?.user?.id) {
      return new Response("Unauthorized", { status: 401 });
    }

    const userId = session.user.id;

    const stream = new ReadableStream({
      async start(controller) {
        const enc = new TextEncoder();

        function enqueue(event: RealtimeEvent) {
          try {
            controller.enqueue(enc.encode(`data: ${JSON.stringify(event)}\n\n`));
          } catch {
            // connection already closed
          }
        }

        const unsubscribe = await transport.subscribe(userId, enqueue);

        const keepAlive = setInterval(() => {
          try {
            controller.enqueue(enc.encode(": ping\n\n"));
          } catch {
            clearInterval(keepAlive);
          }
        }, 25_000);

        req.signal.addEventListener("abort", () => {
          clearInterval(keepAlive);
          unsubscribe();
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        });
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }
  ```

- [ ] **Step 2: Commit** (build at end of Task 6)

  ```bash
  git add src/app/api/realtime/sse/route.ts
  git commit -m "refactor(sse): subscribe via realtime transport; allow 300s lifetime"
  ```

---

## Task 6 — Migrate the subscribe route (reuse-or-recreate)

**Files:**
- Modify: `src/app/api/realtime/subscribe/route.ts`

- [ ] **Step 1: Replace the file**

  Replace `src/app/api/realtime/subscribe/route.ts` with:
  ```ts
  import { auth } from "@/lib/auth/config";
  import { NextResponse } from "next/server";
  import { transport, resourceKey, type SubscriptionRecord } from "@/lib/realtime/pubsub";

  const URL_SAFE = /^[A-Za-z0-9_-]+$/;
  // Teams chat IDs look like 19:xxx_yyy@unq.gbl.spaces — allow :, @, . in addition.
  const CHAT_ID_SAFE = /^[A-Za-z0-9_@.:-]+$/;
  const TTL_MS = 55 * 60 * 1000;
  const TTL_SEC = TTL_MS / 1000;
  const REUSE_IF_REMAINING_MS = 15 * 60 * 1000;

  export async function POST(req: Request) {
    const session = await auth();
    if (!session?.accessToken || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as {
      teamId?: string;
      channelId?: string;
      chatId?: string;
    };
    const { teamId, channelId, chatId } = body;
    const userId = session.user.id;
    const now = Date.now();

    let rkey: string;
    let resource: string;
    let makeRecord: (expiresAt: number) => SubscriptionRecord;

    if (chatId) {
      if (!CHAT_ID_SAFE.test(chatId)) {
        return NextResponse.json({ error: "Invalid chatId" }, { status: 400 });
      }
      rkey = resourceKey({ kind: "chat", chatId });
      resource = `/chats/${chatId}/messages`;
      makeRecord = (expiresAt) => ({
        userId,
        resourceType: "chat_message",
        chatId,
        expiresAt,
      });
    } else if (teamId && channelId && URL_SAFE.test(teamId) && URL_SAFE.test(channelId)) {
      rkey = resourceKey({ kind: "channel", teamId, channelId });
      resource = `/teams/${teamId}/channels/${channelId}/messages`;
      makeRecord = (expiresAt) => ({
        userId,
        resourceType: "channel_message",
        teamId,
        channelId,
        expiresAt,
      });
    } else {
      return NextResponse.json(
        { error: "Provide a valid chatId, or teamId and channelId" },
        { status: 400 }
      );
    }

    // Reuse an existing subscription unless it's within the recreate window.
    const existing = await transport.findActiveSub(userId, rkey);
    if (existing && existing.expiresAt - now > REUSE_IF_REMAINING_MS) {
      return NextResponse.json({
        subscriptionId: existing.subId,
        expiresAt: existing.expiresAt,
      });
    }

    const expiresAt = now + TTL_MS;
    const expirationDateTime = new Date(expiresAt).toISOString();

    const webhookBase =
      process.env.GRAPH_WEBHOOK_BASE_URL ||
      process.env.NEXTAUTH_URL ||
      "https://teamsly.vercel.app";
    const notificationUrl = `${webhookBase}/api/webhooks/graph`;

    const subBody = {
      changeType: "created,updated",
      notificationUrl,
      resource,
      // No resource data → no encryption certificate required. The notification
      // carries the message id; the client re-fetches the message content.
      includeResourceData: false,
      expirationDateTime,
      clientState: Array.from(crypto.getRandomValues(new Uint8Array(8)))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(""),
    };

    const res = await fetch("https://graph.microsoft.com/v1.0/subscriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(subBody),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[realtime/subscribe] Graph subscription failed:", text);
      return NextResponse.json({ error: text }, { status: 502 });
    }

    const sub = (await res.json()) as { id: string };
    await transport.saveSub(sub.id, makeRecord(expiresAt), rkey, TTL_SEC);

    return NextResponse.json({ subscriptionId: sub.id, expiresAt });
  }
  ```

- [ ] **Step 2: Build the whole refactor (Tasks 2→6)**

  Run: `npm run build 2>&1 | tail -20`
  Expected: `✓ Compiled successfully`, all routes listed. This is the first green build since Task 2.

- [ ] **Step 3: Commit**

  ```bash
  git add src/app/api/realtime/subscribe/route.ts
  git commit -m "refactor(realtime): reuse-or-recreate subscriptions via transport

  findActiveSub reuses a subscription while >15 min remain, otherwise creates a
  fresh Graph subscription. Drops the ReturnType/Parameters closure indirection."
  ```

---

## Task 7 — Client re-subscribe interval (keeps long-open views live past 55 min)

**Files:**
- Modify: `src/components/messages/ChatView.tsx`
- Modify: `src/components/messages/ChannelView.tsx`

- [ ] **Step 1: ChatView — add the re-subscribe interval**

  In `src/components/messages/ChatView.tsx`, find the fire-and-forget subscribe block inside the load `useEffect`:
  ```ts
    fetch("/api/realtime/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId }),
    }).catch(() => { /* subscription is best-effort; poll is the fallback */ });
  ```
  Immediately after it (still inside the effect, before `return () => {`), add:
  ```ts
    // Re-subscribe before the 55-min Graph TTL so long-open views stay live.
    const resubscribe = setInterval(() => {
      fetch("/api/realtime/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId }),
      }).catch(() => { /* best-effort */ });
    }, 45 * 60 * 1000);
  ```
  Then add `clearInterval(resubscribe);` to the effect's cleanup, alongside the existing `clearInterval(interval); clearInterval(sweep);`:
  ```ts
    return () => {
      cancelled = true;
      clearInterval(interval);
      clearInterval(sweep);
      clearInterval(resubscribe);
    };
  ```

- [ ] **Step 2: ChannelView — add the re-subscribe interval**

  In `src/components/messages/ChannelView.tsx`, find the subscribe block inside the load `useEffect`:
  ```ts
    fetch("/api/realtime/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId, channelId }),
    }).catch(() => { /* subscription is best-effort; poll is the fallback */ });
  ```
  Immediately after it, add:
  ```ts
    // Re-subscribe before the 55-min Graph TTL so long-open views stay live.
    const resubscribe = setInterval(() => {
      fetch("/api/realtime/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, channelId }),
      }).catch(() => { /* best-effort */ });
    }, 45 * 60 * 1000);
  ```
  Then add `clearInterval(resubscribe);` to that effect's cleanup `return () => { ... }` alongside the existing `clearInterval(interval);`.

- [ ] **Step 3: Build**

  Run: `npm run build 2>&1 | tail -20`
  Expected: `✓ Compiled successfully`.

- [ ] **Step 4: Commit**

  ```bash
  git add src/components/messages/ChatView.tsx src/components/messages/ChannelView.tsx
  git commit -m "feat(realtime): re-subscribe every 45 min to outlast the Graph TTL"
  ```

---

## Task 8 — Manual end-to-end verification (with Upstash configured)

No code changes — confirm the Redis path actually works in a deployed/tunnel context. Requires Upstash provisioned and env vars set locally + on Vercel.

- [ ] **Step 1: Confirm env selection**

  With `UPSTASH_REDIS_REST_URL` + `_TOKEN` in `.env.local`, run `npm run dev`. Add a temporary `console.log` in `selectTransport` if needed to confirm the Redis branch is taken (remove it after). Expected: Redis transport selected.

- [ ] **Step 2: Expose the webhook to Graph**

  Run `ngrok http 3000`; set `GRAPH_WEBHOOK_BASE_URL=https://<your>.ngrok-free.app` in `.env.local`; restart dev. (Graph cannot reach `localhost`.)

- [ ] **Step 3: Two-browser DM test**

  Sign in as two different accounts in two browsers; open the same DM in both. Send from account A. Expected: the message appears in account B in ~1-2s (not 30s). Check the dev/ngrok logs for a `POST /api/webhooks/graph` and no "unknown subscriptionId".

- [ ] **Step 4: Channel test**

  Open a channel in both; post a message. Expected: same sub-second arrival.

- [ ] **Step 5: Renewal smoke test**

  Temporarily change the `45 * 60 * 1000` interval in `ChatView.tsx` to `60 * 1000` (1 min). Keep a DM open >1 min; confirm a second `POST /api/realtime/subscribe` fires and (because >15 min still remain) returns the SAME `subscriptionId` (reuse path). Then confirm a fresh sub is created if you also lower `REUSE_IF_REMAINING_MS`. Revert both values when done.

- [ ] **Step 6: Fallback test**

  Comment out `UPSTASH_REDIS_REST_URL` in `.env.local`, restart, repeat Step 3. Expected: still works via in-memory + the 30s poll (latency may be up to 30s on a cold/second instance, but no errors). Restore the env var.

- [ ] **Step 7: Final build + push**

  ```bash
  npm run build 2>&1 | tail -20
  git push -u origin feat/dm-realtime-push
  ```

---

## Provisioning hand-off (manual, user — do before Task 0)

1. Add **Upstash Redis** from the Vercel Marketplace to the `teamsly` project. Vercel auto-sets `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` across Production/Preview/Development.
2. Copy both values into `.env.local` for local dev.
3. Until this is done, the app runs on the in-memory transport + poll (no errors), so Tasks 1–7 can be written and committed without it — but **Task 0 (spike) and Task 8 (e2e) require it**.

---

## Known limitations / follow-ups (intentionally out of scope)

- Pub/sub has no persistence: a publish during an SSE reconnect gap is lost; the 30s poll is the floor. (Documented in the design.)
- No server-side renewal cron / refresh-token storage — client re-subscribe covers open views only.
- In-memory transport (fallback) still loses records on cold start and is single-instance — by design.
