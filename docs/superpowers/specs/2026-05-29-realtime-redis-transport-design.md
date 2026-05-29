# Reliable Cross-Instance Realtime via an Optional Redis Transport

**Date:** 2026-05-29
**Status:** Design approved, pending spec review
**Branch:** `feat/dm-realtime-push` (builds on the DM-push work already committed there)

## Problem

Teamsly pushes new messages to the browser via Microsoft Graph change
notifications → a webhook → an in-memory pub/sub → SSE. Two pieces of state in
`src/lib/realtime/pubsub.ts` live in **module-level `Map`s** and therefore do
not survive across Vercel function instances:

1. **`subRecords`** — the subscription registry (Graph `subscriptionId` →
   user + context). The webhook reads this. If the webhook POST lands on a
   different instance than the one that created the subscription, the lookup
   returns `undefined` and the notification is dropped.
2. **`subscribers`** — live SSE `ReadableStream` controllers (userId →
   controllers). `publish()` only reaches controllers on the *same* instance,
   so a webhook on instance A cannot deliver to an SSE connection on instance B.

The result: realtime push is "usually instant on a warm single instance,
guaranteed only by the 30s fallback poll." On Vercel this is genuinely
best-effort. This affects **both** channel messages (shipped) and DM messages
(just added on this branch).

## Goal

Make webhook notifications reliably reach the correct SSE connection across
instances, **without** adding infrastructure that must be babysat. Constraints,
in priority order:

1. **$0 at this app's scale.** OSS project, only cost today is the domain.
2. **Near-zero ops.** No server to run/patch; degrade gracefully if the
   dependency hiccups.
3. **OSS-friendly.** Forks and self-hosters must get working software with
   **no required external dependency**.

## Non-goals (YAGNI)

- No Vercel Cron renewal job.
- No encrypted refresh-token storage.
- No persistent Redis Stream with consumer-position tracking (would *guarantee*
  delivery but adds trimming + position state to maintain — not worth it).
- No multi-region work beyond what pub/sub already provides.
- No PATCH-based subscription renewal (recreate-near-expiry instead).

## What this explicitly does NOT promise

Redis here makes push **reliably-usually-instant across instances**, not
**guaranteed sub-second**. Redis pub/sub has no persistence: a message
published while a subscriber is momentarily disconnected (instance recycle, SSE
reconnect gap) is simply lost. **The 30s client poll remains the correctness
floor**, exactly as today. We are raising the *common-case* reliability of the
fast path, not replacing the fallback.

## Approach: an optional transport abstraction

Put a thin `RealtimeTransport` interface in front of both responsibilities, and
select the implementation **once at module load** by checking for
`UPSTASH_REDIS_REST_URL`:

- Env var present → `RedisTransport`.
- Env var absent → `InMemoryTransport` (today's behavior, byte-for-byte).

The webhook, SSE, and subscribe routes call the interface and never know which
backend is live. This is the key to the OSS/optional requirement: setting two
env vars on the production deploy turns on reliable push; a fork that sets
nothing keeps working on the in-memory + poll path.

### Interface

```ts
interface RealtimeTransport {
  // registry
  findActiveSub(userId: string, resourceKey: string):
    Promise<{ subId: string; expiresAt: number } | null>;
  saveSub(
    subId: string,
    record: SubscriptionRecord,
    resourceKey: string,
    ttlSec: number,
  ): Promise<void>;
  getSub(subId: string): Promise<SubscriptionRecord | null>;

  // fan-out
  publish(userId: string, event: RealtimeEvent): Promise<void>;
  subscribe(userId: string, onEvent: (e: RealtimeEvent) => void):
    Promise<() => void>; // resolves to an unsubscribe fn
}
```

`pubsub.ts` is reduced to: the `RealtimeEvent` and `SubscriptionRecord` types,
plus an exported `transport` singleton (the selected implementation).

### `resourceKey`

A single helper derives the dedup key from a subscription target:

- DM: `chat:{chatId}`
- Channel: `channel:{teamId}:{channelId}`

Used by both `findActiveSub` (idempotent reuse) and the Redis index key.

## Data model (Redis, all TTL'd)

| Key | Value | Read by | TTL |
|---|---|---|---|
| `subrec:{subId}` | `SubscriptionRecord` JSON | webhook (`getSub`) | sub TTL (55 min) |
| `subidx:{userId}:{resourceKey}` | `{ subId, expiresAt }` | subscribe route (`findActiveSub`) | sub TTL (55 min) |
| channel `realtime:{userId}` | `RealtimeEvent` JSON | SSE route (`subscribe`) | n/a (pub/sub) |

TTLs equal the subscription lifetime, so expired records auto-evict — no
cleanup code, no leaked keys. Total footprint: a few hundred bytes per active
subscription. Far inside the Upstash free tier (256 MB / 500K commands/mo);
publishes happen only on real new messages.

## Component changes

### `src/lib/realtime/pubsub.ts`
- Keep `RealtimeEvent` (already has `channel_message` | `chat_message` | `noop`)
  and `SubscriptionRecord` (discriminated union) types.
- Add `RealtimeTransport` interface, `InMemoryTransport` (wrap existing maps),
  `RedisTransport`, the `resourceKey` helper, and the env-gated `transport`
  singleton.
- `InMemoryTransport.findActiveSub` reuses the existing `listUserSubscriptions`
  logic; `subscribe`/`publish` reuse the existing in-memory map.

### `RedisTransport`
- Registry: `redis.set/get` on `subrec:` and `subidx:` with `{ ex: ttlSec }`.
- `publish`: `redis.publish('realtime:'+userId, JSON.stringify(event))`.
- `subscribe`: open one `redis.subscribe('realtime:'+userId)` HTTP stream;
  on message → `JSON.parse` → `onEvent`; return a cleanup that closes the
  stream. **(Highest-risk piece — see Validation Spike.)**
- Every Redis call wrapped in try/catch; on error, log and no-op so the poll
  fallback takes over (never throw into a route handler).

### `src/app/api/webhooks/graph/route.ts`
- `await transport.getSub(subId)` instead of in-memory `getSubscription`.
- Same chat-vs-channel branch already on the branch.
- `await transport.publish(record.userId, event)`.

### `src/app/api/realtime/sse/route.ts`
- `const unsubscribe = await transport.subscribe(userId, enqueue)` in the
  stream `start`.
- Close it on `req.signal` abort alongside the existing keepalive cleanup.
- Set `export const maxDuration = 300` so the connection (and its Redis
  subscribe stream) is allowed to live the full window before EventSource
  auto-reconnects.

### `src/app/api/realtime/subscribe/route.ts`
- `findActiveSub(userId, resourceKey)`:
  - exists and `expiresAt - now > 15 min` → reuse, no Graph call.
  - otherwise → create a fresh Graph subscription, `saveSub`. The old
    near-expiry sub self-expires within ~15 min; a brief double-notification
    window is harmless (client re-fetch is idempotent against the store).
- Existing chat/channel request-body branching stays.

### Client — `ChatView.tsx` + `ChannelView.tsx`
- Add a **~45-min re-subscribe interval** that re-POSTs `/api/realtime/subscribe`
  with the same body, so a view left open past the 55-min TTL stays live.
  Combined with the server's ">15 min" rule, the 45-min tick always lands in
  the recreate window. Clear on unmount.
- No other client change beyond what is already committed on the branch.

## Validation spike (implementation step 0 — gates the rest)

Before refactoring the real routes, write a ~20-line throwaway spike to confirm
the one uncertain dependency:

1. A route that `redis.publish`es on each call.
2. A streamed route that `redis.subscribe`es and logs received messages.
3. Confirm: messages arrive across the two; the subscribe stream survives a
   normal idle period; `unsubscribe`/close tears down cleanly on client
   disconnect; and **observe the Upstash command/billing meter** to confirm an
   idle open subscribe is cheap (cost was the deciding factor for pub/sub over
   polling).

**If the spike fails** (flaky stream, or billing worse than polling): keep the
entire design and swap only `RedisTransport`'s fan-out to the poll-a-list
variant — webhook `LPUSH events:{userId}`; SSE route drains via `LRANGE`/`LPOP`
on a ~1-2s tick. The interface, registry, routes, and client are unchanged.

## Error handling & degradation

- Missing/invalid Upstash config → `InMemoryTransport` selected; identical to
  today.
- Redis call throws at runtime → caught, logged, no-op; the 30s poll delivers.
- SSE subscribe stream dies mid-connection → EventSource reconnects (≤300s),
  re-subscribes; poll covers the gap.

## Testing

- **Unit:** `InMemoryTransport` (round-trip save/get/find, reuse threshold),
  the `resourceKey` helper, and the subscribe-route reuse-vs-recreate decision.
- **Manual (Redis path):** provision Upstash, set env, open the same DM in two
  browsers, confirm sub-second arrival; force the 45-min renewal (temporarily
  shorten the interval) and confirm a new sub is created and push continues.
- `npm run build` is the required gate after each task (per CLAUDE.md).

## Provisioning hand-off (manual, you)

1. Add Upstash Redis from the Vercel Marketplace to the `teamsly` project. It
   auto-sets `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` across envs.
2. Copy both into `.env.local` for local dev (Graph still can't reach
   localhost — use `ngrok` + `GRAPH_WEBHOOK_BASE_URL` to exercise the webhook).
3. Until done, everything runs on the in-memory path with the poll fallback.

## File map

| File | Action |
|---|---|
| `src/lib/realtime/pubsub.ts` | Add transport interface, two impls, `resourceKey`, env-gated singleton |
| `src/app/api/webhooks/graph/route.ts` | Use `transport.getSub` + `transport.publish` |
| `src/app/api/realtime/sse/route.ts` | Use `transport.subscribe`; add `maxDuration = 300` |
| `src/app/api/realtime/subscribe/route.ts` | `findActiveSub` reuse/recreate via transport |
| `src/components/messages/ChatView.tsx` | ~45-min re-subscribe interval |
| `src/components/messages/ChannelView.tsx` | ~45-min re-subscribe interval |
| `package.json` | Add `@upstash/redis` |
| `.env.example` | Document optional `UPSTASH_REDIS_REST_URL` / `_TOKEN` |
