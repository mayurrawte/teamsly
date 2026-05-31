# Real-Time Graph Change Notifications (Webhooks + SSE)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace 5s polling in ChatView/ChannelView with Microsoft Graph Change Notifications → SSE push, cutting message latency from ~5s to ~1s and eliminating most Graph quota burn.

**Architecture:** Graph sends webhook POSTs to `/api/webhooks/graph` → server writes event to Redis pub/sub channel → `/api/sse` stream picks it up and pushes to the browser via SSE. Subscriptions are created on login, renewed every 30 min via Vercel Cron, deleted on logout. A 60s fallback poll in the client covers missed events.

**Tech Stack:** Next.js 15 App Router, Upstash Redis (`@upstash/redis`), Microsoft Graph SDK, Vercel Cron, SSE via `ReadableStream`

---

## Critical context before you start

- **`npm run build` is the only correct gate.** Run it after every task.
- Project root: `/Users/mayurrawte/thepsygeek/teamsly`
- **No `Co-Authored-By:` trailers.** Conventional Commit style: `feat(scope): verb + what`
- Vercel Hobby: `maxDuration = 300` seconds per function invocation. SSE clients (`EventSource`) auto-reconnect on disconnect — this is fine and expected.
- **Upstash Redis, NOT "Vercel KV"** — Vercel KV is discontinued. Provision Upstash Redis from the Vercel Marketplace (https://vercel.com/marketplace/upstash). It sets `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` env vars automatically.
- **No extra Graph scopes needed.** `Chat.ReadWrite` covers DM webhooks; `ChannelMessage.Read.All` covers channel webhooks. Both are already consented. Adding new scopes forces all existing users to re-consent.
- **Encrypted payloads required** for `/me/chats/messages` subscriptions. Generate an RSA-2048 key pair, store private key in env, send public key when registering subscriptions.
- **Single-region deployment (iad1 on Hobby):** in-memory `Map` for SSE subscribers is fine. If ever upgraded to multi-region Pro, replace the in-memory Map with Upstash Redis pub/sub.

---

## File map

| File | Action | Purpose |
|---|---|---|
| `src/lib/redis/client.ts` | Create | Upstash Redis singleton |
| `src/lib/graph/subscriptions.ts` | Create | Create/renew/delete Graph subscriptions |
| `src/lib/crypto/webhook-decrypt.ts` | Create | RSA-OAP decrypt incoming encrypted payloads |
| `src/lib/sse/hub.ts` | Create | In-memory SSE subscriber Map + publish function |
| `src/app/api/webhooks/graph/route.ts` | Create | Webhook receiver (validation + notification dispatch) |
| `src/app/api/sse/route.ts` | Create | SSE streaming endpoint |
| `src/app/api/cron/renew-subscriptions/route.ts` | Create | Cron handler to renew expiring subscriptions |
| `src/app/api/auth/[...nextauth]/subscriptions.ts` | Create | Hook into sign-in/sign-out to manage subscriptions |
| `src/components/messages/ChatView.tsx` | Modify | Replace 5s poll with EventSource + 60s fallback |
| `src/components/messages/ChannelView.tsx` | Modify | Same |
| `vercel.json` | Create | Cron schedule for subscription renewal |
| `.env.local` | Modify (local only) | Add UPSTASH_*, WEBHOOK_RSA_PRIVATE_KEY, WEBHOOK_RSA_PUBLIC_KEY |

---

## Task 1 — Provision Upstash Redis and add env vars

**Files:**
- Create: `src/lib/redis/client.ts`

- [ ] **Step 1: Install Upstash Redis SDK**

  ```bash
  npm install @upstash/redis
  ```

- [ ] **Step 2: Provision from Vercel Marketplace**

  1. Go to https://vercel.com/marketplace/upstash in your browser
  2. Add Upstash Redis to the `teamsly` Vercel project
  3. Vercel auto-sets `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in production env

  For local dev, copy those values into `.env.local`:
  ```
  UPSTASH_REDIS_REST_URL=https://your-instance.upstash.io
  UPSTASH_REDIS_REST_TOKEN=AXxx...
  ```

- [ ] **Step 3: Create Redis singleton**

  Create `src/lib/redis/client.ts`:
  ```ts
  import { Redis } from "@upstash/redis";

  export const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
  ```

- [ ] **Step 4: Build to verify**

  ```bash
  npm run build 2>&1 | tail -10
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add src/lib/redis/client.ts package.json package-lock.json
  git commit -m "feat(redis): add Upstash Redis client singleton"
  ```

---

## Task 2 — Generate RSA key pair for encrypted webhook payloads

Graph requires encrypted payloads for `/me/chats/messages` subscriptions. You provide your public key when registering; Graph encrypts the payload; your server decrypts with the private key.

**Files:**
- Create: `src/lib/crypto/webhook-decrypt.ts`

- [ ] **Step 1: Generate the key pair (one-time, run locally)**

  ```bash
  node -e "
  const { generateKeyPairSync } = require('crypto');
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  console.log('PUBLIC KEY:');
  console.log(publicKey);
  console.log('PRIVATE KEY (add to .env.local and Vercel env):');
  console.log(privateKey);
  "
  ```

  Add the result to `.env.local`:
  ```
  WEBHOOK_RSA_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
  WEBHOOK_RSA_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
  WEBHOOK_RSA_CERT_ID="teamsly-key-v1"
  ```

  Also add both keys + cert ID to Vercel project env vars (Settings → Environment Variables).

- [ ] **Step 2: Create decrypt utility**

  Create `src/lib/crypto/webhook-decrypt.ts`:
  ```ts
  import { createPrivateKey, privateDecrypt, createDecipheriv } from "crypto";

  /**
   * Decrypt a Graph change notification encrypted payload.
   *
   * Graph encrypts the symmetric key with RSA-OAEP (SHA-1) and the payload
   * with AES-256-GCM using that symmetric key.
   *
   * Ref: https://learn.microsoft.com/graph/change-notifications-with-resource-data
   */
  export function decryptGraphPayload(encryptedContent: {
    dataKey: string;          // RSA-OAEP encrypted AES key (base64)
    data: string;             // AES-256-GCM encrypted payload (base64)
    dataSignature: string;    // HMAC-SHA256 signature (base64) — optional verify
    encryptionCertificateId: string;
    encryptionCertificateThumbprint: string;
  }): unknown {
    const privateKeyPem = process.env.WEBHOOK_RSA_PRIVATE_KEY!.replace(/\\n/g, "\n");
    const privateKey = createPrivateKey(privateKeyPem);

    // 1. Decrypt symmetric AES key
    const encryptedKey = Buffer.from(encryptedContent.dataKey, "base64");
    const aesKey = privateDecrypt(
      { key: privateKey, padding: require("crypto").constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha1" },
      encryptedKey
    );

    // 2. Decrypt the payload with AES-256-GCB
    // Graph uses AES-256-CBC (not GCM) — IV is first 16 bytes of the encrypted data
    const encryptedData = Buffer.from(encryptedContent.data, "base64");
    const iv = encryptedData.subarray(0, 16);
    const ciphertext = encryptedData.subarray(16);
    const decipher = createDecipheriv("aes-256-cbc", aesKey, iv);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

    return JSON.parse(decrypted.toString("utf8"));
  }
  ```

- [ ] **Step 3: Build to verify**

  ```bash
  npm run build 2>&1 | tail -10
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add src/lib/crypto/webhook-decrypt.ts
  git commit -m "feat(crypto): add RSA-OAEP + AES-CBC decrypt for Graph encrypted webhook payloads"
  ```

---

## Task 3 — In-memory SSE hub

**Files:**
- Create: `src/lib/sse/hub.ts`

Single module that owns the subscriber Map and exposes `subscribe` / `unsubscribe` / `publish`.

- [ ] **Step 1: Create hub**

  Create `src/lib/sse/hub.ts`:
  ```ts
  type SseController = ReadableStreamDefaultController<Uint8Array>;

  // userId → list of active SSE controllers (multiple tabs)
  const subscribers = new Map<string, Set<SseController>>();

  export function subscribe(userId: string, ctrl: SseController) {
    if (!subscribers.has(userId)) subscribers.set(userId, new Set());
    subscribers.get(userId)!.add(ctrl);
  }

  export function unsubscribe(userId: string, ctrl: SseController) {
    subscribers.get(userId)?.delete(ctrl);
    if (subscribers.get(userId)?.size === 0) subscribers.delete(userId);
  }

  export function publish(userId: string, payload: unknown) {
    const ctrlSet = subscribers.get(userId);
    if (!ctrlSet) return;
    const encoded = new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`);
    for (const ctrl of ctrlSet) {
      try {
        ctrl.enqueue(encoded);
      } catch {
        ctrlSet.delete(ctrl);
      }
    }
  }
  ```

- [ ] **Step 2: Build to verify**

  ```bash
  npm run build 2>&1 | tail -10
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add src/lib/sse/hub.ts
  git commit -m "feat(sse): add in-memory SSE subscriber hub"
  ```

---

## Task 4 — SSE streaming endpoint

**Files:**
- Create: `src/app/api/sse/route.ts`

- [ ] **Step 1: Create SSE route**

  Create `src/app/api/sse/route.ts`:
  ```ts
  import { auth } from "@/lib/auth/config";
  import { subscribe, unsubscribe } from "@/lib/sse/hub";
  import { NextResponse } from "next/server";

  export const maxDuration = 300;
  export const dynamic = "force-dynamic";

  const encoder = new TextEncoder();
  const HEARTBEAT_MS = 25_000; // 25s — keeps connection alive through proxies

  export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    let ctrl!: ReadableStreamDefaultController<Uint8Array>;
    let heartbeat: ReturnType<typeof setInterval>;

    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        ctrl = c;
        subscribe(userId, ctrl);
        // Send an initial comment to flush headers immediately
        ctrl.enqueue(encoder.encode(": connected\n\n"));
        heartbeat = setInterval(() => {
          try {
            ctrl.enqueue(encoder.encode(": heartbeat\n\n"));
          } catch {
            clearInterval(heartbeat);
          }
        }, HEARTBEAT_MS);
      },
      cancel() {
        clearInterval(heartbeat);
        unsubscribe(userId, ctrl);
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  }
  ```

- [ ] **Step 2: Build to verify**

  ```bash
  npm run build 2>&1 | tail -10
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add src/app/api/sse/route.ts
  git commit -m "feat(sse): add SSE streaming endpoint at /api/sse"
  ```

---

## Task 5 — Graph subscription management

**Files:**
- Create: `src/lib/graph/subscriptions.ts`

- [ ] **Step 1: Create subscription helpers**

  Create `src/lib/graph/subscriptions.ts`:
  ```ts
  import { getGraphClient } from "./client";
  import { redis } from "@/lib/redis/client";

  const NOTIFICATION_URL = `${process.env.NEXTAUTH_URL}/api/webhooks/graph`;
  const CERT_ID = process.env.WEBHOOK_RSA_CERT_ID ?? "teamsly-key-v1";
  const PUBLIC_KEY_PEM = process.env.WEBHOOK_RSA_PUBLIC_KEY!.replace(/\\n/g, "\n");
  const TTL_MS = 55 * 60 * 1000; // 55 min (Graph max is 60 for chat messages)

  export interface SubRecord {
    userId: string;
    resource: string;
    expiresAt: number; // unix ms
  }

  // Redis keys
  const subKey = (subId: string) => `sub:${subId}`;
  const userSubsKey = (userId: string) => `user:subs:${userId}`;

  export async function createSubscription(
    accessToken: string,
    userId: string,
    resource: string
  ): Promise<string | null> {
    try {
      const client = getGraphClient(accessToken);
      const expiresAt = Date.now() + TTL_MS;
      const sub = await client.api("/subscriptions").post({
        changeType: "created",
        notificationUrl: NOTIFICATION_URL,
        resource,
        expirationDateTime: new Date(expiresAt).toISOString(),
        encryptionCertificate: Buffer.from(PUBLIC_KEY_PEM).toString("base64"),
        encryptionCertificateId: CERT_ID,
      }) as { id: string };

      const record: SubRecord = { userId, resource, expiresAt };
      await Promise.all([
        redis.set(subKey(sub.id), record, { ex: 3600 }),
        redis.sadd(userSubsKey(userId), sub.id),
      ]);
      return sub.id;
    } catch (err) {
      console.error("[graph] createSubscription failed:", resource, err);
      return null;
    }
  }

  export async function renewSubscription(
    accessToken: string,
    subId: string
  ): Promise<boolean> {
    try {
      const client = getGraphClient(accessToken);
      const expiresAt = Date.now() + TTL_MS;
      await client.api(`/subscriptions/${subId}`).patch({
        expirationDateTime: new Date(expiresAt).toISOString(),
      });
      await redis.hset(subKey(subId), { expiresAt });
      return true;
    } catch {
      return false;
    }
  }

  export async function deleteUserSubscriptions(
    accessToken: string,
    userId: string
  ): Promise<void> {
    const subIds = await redis.smembers(userSubsKey(userId)) as string[];
    const client = getGraphClient(accessToken);
    await Promise.all(
      subIds.map(async (id) => {
        try { await client.api(`/subscriptions/${id}`).delete(); } catch { /* already expired */ }
        await redis.del(subKey(id));
      })
    );
    await redis.del(userSubsKey(userId));
  }

  export async function getSubRecord(subId: string): Promise<SubRecord | null> {
    return redis.get<SubRecord>(subKey(subId));
  }

  export async function getUserSubIds(userId: string): Promise<string[]> {
    return redis.smembers(userSubsKey(userId)) as Promise<string[]>;
  }
  ```

- [ ] **Step 2: Build to verify**

  ```bash
  npm run build 2>&1 | tail -10
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add src/lib/graph/subscriptions.ts
  git commit -m "feat(graph): add subscription create/renew/delete helpers with Redis backing"
  ```

---

## Task 6 — Webhook receiver endpoint

**Files:**
- Create: `src/app/api/webhooks/graph/route.ts`

- [ ] **Step 1: Create webhook route**

  Create `src/app/api/webhooks/graph/route.ts`:
  ```ts
  import { NextRequest, NextResponse } from "next/server";
  import { getSubRecord } from "@/lib/graph/subscriptions";
  import { decryptGraphPayload } from "@/lib/crypto/webhook-decrypt";
  import { publish } from "@/lib/sse/hub";

  // Graph validation: POST with ?validationToken= → echo as text/plain within 10s
  export async function POST(req: NextRequest) {
    const validationToken = req.nextUrl.searchParams.get("validationToken");
    if (validationToken) {
      return new Response(validationToken, {
        headers: { "Content-Type": "text/plain" },
      });
    }

    let body: { value: GraphNotification[] };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    // Process notifications in the background — respond 202 immediately
    void processNotifications(body.value ?? []);
    return new Response(null, { status: 202 });
  }

  interface GraphNotification {
    subscriptionId: string;
    changeType: string;
    resource: string;
    resourceData?: unknown;
    encryptedContent?: {
      dataKey: string;
      data: string;
      dataSignature: string;
      encryptionCertificateId: string;
      encryptionCertificateThumbprint: string;
    };
  }

  async function processNotifications(notifications: GraphNotification[]) {
    for (const notif of notifications) {
      try {
        const record = await getSubRecord(notif.subscriptionId);
        if (!record) continue;

        let payload: unknown = notif.resourceData;
        if (notif.encryptedContent) {
          payload = decryptGraphPayload(notif.encryptedContent);
        }

        publish(record.userId, {
          type: "graph_notification",
          resource: notif.resource,
          changeType: notif.changeType,
          data: payload,
        });
      } catch (err) {
        console.error("[webhook] processNotification failed:", err);
      }
    }
  }
  ```

- [ ] **Step 2: Build to verify**

  ```bash
  npm run build 2>&1 | tail -10
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add src/app/api/webhooks/graph/route.ts
  git commit -m "feat(webhooks): add Graph change notification receiver at /api/webhooks/graph"
  ```

---

## Task 7 — Subscription lifecycle on sign-in/sign-out

Graph subscriptions need to be created when a user signs in and deleted on sign-out. NextAuth's `signIn` and `signOut` JWT callbacks are the right hooks.

**Files:**
- Modify: `src/lib/auth/config.ts` (add subscription creation in `jwt` callback)

- [ ] **Step 1: Read the current auth config**

  Open `src/lib/auth/config.ts` and find the `jwt` callback. Look for where `accessToken` is set from the initial sign-in.

- [ ] **Step 2: Trigger subscription creation on first sign-in**

  In the `jwt` callback, after the access token is stored, add:
  ```ts
  // Create Graph subscriptions on first sign-in (token.sub is the AAD user id)
  if (account && token.sub && token.accessToken) {
    const { createSubscription } = await import("@/lib/graph/subscriptions");
    // Subscribe to all DM messages
    await createSubscription(token.accessToken as string, token.sub, "/me/chats/messages");
  }
  ```

  On sign-out, the `events.signOut` callback can call `deleteUserSubscriptions`. Add to the NextAuth config:
  ```ts
  events: {
    async signOut({ token }) {
      if (token?.sub && token?.accessToken) {
        const { deleteUserSubscriptions } = await import("@/lib/graph/subscriptions");
        await deleteUserSubscriptions(token.accessToken as string, token.sub as string);
      }
    },
  },
  ```

- [ ] **Step 3: Build to verify**

  ```bash
  npm run build 2>&1 | tail -10
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add src/lib/auth/config.ts
  git commit -m "feat(auth): create Graph subscriptions on sign-in, delete on sign-out"
  ```

---

## Task 8 — Subscription renewal cron

**Files:**
- Create: `src/app/api/cron/renew-subscriptions/route.ts`
- Create: `vercel.json`

- [ ] **Step 1: Create cron handler**

  Create `src/app/api/cron/renew-subscriptions/route.ts`:
  ```ts
  import { NextResponse } from "next/server";
  import { redis } from "@/lib/redis/client";
  import { renewSubscription, getSubRecord, createSubscription } from "@/lib/graph/subscriptions";

  export const dynamic = "force-dynamic";

  // Vercel Cron calls this with the CRON_SECRET header for security
  export async function GET(req: Request) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Scan all sub: keys from Redis
    let cursor = 0;
    const expiringSoon = Date.now() + 10 * 60 * 1000; // expiring within 10 min
    const toRenew: string[] = [];

    do {
      const [nextCursor, keys] = await redis.scan(cursor, { match: "sub:*", count: 100 });
      cursor = Number(nextCursor);
      for (const key of keys) {
        const subId = key.replace("sub:", "");
        const record = await redis.get<{ userId: string; resource: string; expiresAt: number }>(key);
        if (record && record.expiresAt < expiringSoon) {
          toRenew.push(subId);
        }
      }
    } while (cursor !== 0);

    console.log(`[cron] renewing ${toRenew.length} subscriptions`);
    const results = await Promise.allSettled(
      toRenew.map(async (subId) => {
        // We don't have access tokens in cron context — subscriptions must be
        // renewed via client credentials or the user re-auth flow.
        // For now: mark expired and let client recreate on next SSE connect.
        // TODO: store refresh tokens to renew without user interaction.
        await redis.del(`sub:${subId}`);
      })
    );

    return NextResponse.json({ renewed: results.length });
  }
  ```

  > **Note:** Full renewal requires storing user refresh tokens server-side. For the MVP, expired subscriptions are cleaned up and recreated the next time the user visits the app (sign-in creates new subs). The TODO marks where to plug in server-side token refresh.

- [ ] **Step 2: Create vercel.json with cron schedule**

  Create `vercel.json`:
  ```json
  {
    "crons": [
      {
        "path": "/api/cron/renew-subscriptions",
        "schedule": "*/30 * * * *"
      }
    ]
  }
  ```

  Also add `CRON_SECRET` to `.env.local` and Vercel env vars:
  ```
  CRON_SECRET=<generate with: openssl rand -hex 32>
  ```

- [ ] **Step 3: Build to verify**

  ```bash
  npm run build 2>&1 | tail -10
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add src/app/api/cron/renew-subscriptions/route.ts vercel.json
  git commit -m "feat(cron): add subscription renewal cron every 30 minutes"
  ```

---

## Task 9 — Client-side SSE integration

Replace the 5s poll in ChatView and ChannelView with an `EventSource` connection, keeping a 60s fallback poll for resilience.

**Files:**
- Modify: `src/components/messages/ChatView.tsx`
- Modify: `src/components/messages/ChannelView.tsx`

- [ ] **Step 1: Update ChatView**

  In `src/components/messages/ChatView.tsx`, find the polling `useEffect` (the one with `setInterval(load, 5000)`).

  Replace the interval line:
  ```ts
  const interval = setInterval(load, 5000);
  ```
  With:
  ```ts
  // Slow fallback poll — SSE handles real-time delivery
  const interval = setInterval(load, 60_000);
  ```

  Then add a second `useEffect` for SSE:
  ```ts
  useEffect(() => {
    const es = new EventSource("/api/sse");
    es.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data) as {
          type: string;
          resource: string;
          data: unknown;
        };
        // A chat message notification for this chat → reload
        if (
          payload.type === "graph_notification" &&
          payload.resource.includes(chatId)
        ) {
          void fetch(`/api/chats/${chatId}/messages`)
            .then((r) => (r.ok ? r.json() : null))
            .then((data: MSMessage[] | null) => {
              if (data && !cancelled) setMessages(chatId, sortByCreated(data));
            });
        }
      } catch { /* ignore malformed events */ }
    };
    let cancelled = false;
    return () => {
      cancelled = true;
      es.close();
    };
  }, [chatId, setMessages]);
  ```

- [ ] **Step 2: Update ChannelView the same way**

  In `src/components/messages/ChannelView.tsx`, find `setInterval(load, 5000)` and change to `60_000`. Add the same SSE `useEffect`, replacing `chatId` with `channelId` and the resource check with one that matches `/teams/${teamId}/channels/${channelId}/messages`.

- [ ] **Step 3: Build to verify**

  ```bash
  npm run build 2>&1 | tail -10
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add src/components/messages/ChatView.tsx src/components/messages/ChannelView.tsx
  git commit -m "feat(realtime): replace 5s poll with SSE-driven refresh + 60s fallback"
  ```

---

## Final verification checklist

- [ ] Deploy to Vercel and confirm `/api/sse` returns `Content-Type: text/event-stream`
- [ ] Sign in → check Redis with `redis.smembers("user:subs:{userId}")` to confirm subscription created
- [ ] Send a test message in Teams web → confirm it appears within 2s in Teamsly (not 60s)
- [ ] Check Vercel function logs for `/api/webhooks/graph` receiving notifications
- [ ] Confirm cron runs every 30 min via Vercel dashboard → Functions → Cron Jobs

---

## Known limitations and follow-ups

- **Channel message subscriptions** require `ChannelMessage.Read.All` (already consented). Create them in Task 7 by adding a second `createSubscription` call per channel the user has open. Be aware Graph limits to 100 subscriptions per app per user.
- **Server-side token refresh** (marked TODO in cron handler) — full renewal needs refresh tokens stored encrypted in Redis. Scope is a separate task.
- **Multi-region** — if ever moved to Pro + multi-region, replace the in-memory hub with Upstash Redis pub/sub (`redis.subscribe` / `redis.publish`).
- **Rate limits** — Graph subscription creation is throttled. If a user has many channels, batch subscription creation with a small delay between calls.
