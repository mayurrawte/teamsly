# OpenAI migration + per-user AI usage quotas — Design

**Date:** 2026-06-10
**Status:** Approved (design)
**Supersedes provider choice in:** the AI features shipped under #35 (action items) and the existing `/tldr` + `/summary` routes.

## Problem

All three AI routes (`/api/ai/tldr`, `/api/ai/action-items`, `/api/ai/summary`) call a single shared server-side Anthropic key with **no per-user usage control** — one user can consume unbounded spend on the shared key, and the only cost gates are per-instance in-memory caches (best-effort on serverless). Separately, the owner has decided to run these summarization/extraction features on **OpenAI** instead of Anthropic.

Two changes, done together because they touch the same routes:
1. **Migrate the three AI routes from Anthropic to OpenAI** (`gpt-5.4-nano`).
2. **Add a per-user daily request quota** so usage can be capped per person.

## Goal & success criteria

- All three AI routes call OpenAI `gpt-5.4-nano` (confirmed June 2026: $0.20/$1M in, $1.25/$1M out, 400K context, supports Structured Outputs + function calling). No Anthropic SDK usage remains.
- The action-items route still returns the same typed `ActionItem[]`, via OpenAI Structured Outputs (`response_format: json_schema`) instead of Claude tool-use. Its index→id mapping is unchanged.
- Each authenticated user gets a **shared daily request budget** across all three features (default 50/day, env-tunable), enforced server-side, resetting at UTC midnight, backed by Upstash Redis.
- Going over the quota returns HTTP 429 and a clear "daily AI limit reached" card in the UI; cache hits do not consume quota; failed model calls refund the consumed slot.
- With no `OPENAI_API_KEY`, all routes show the existing not-configured card (now naming `OPENAI_API_KEY`).
- `npm run build` passes.

## Non-goals (YAGNI)

- No per-feature caps (one shared pool).
- No token/cost accounting — quota is **request count**, not tokens or dollars. (Each route caps output tokens, so per-request cost is bounded.)
- No admin dashboard, no quota-remaining counter in the UI (just the reached-state card).
- No provider-abstraction layer — direct OpenAI SDK; we are committing to OpenAI.
- No change to the reminders feature or the Catch-up panel layout.

## Decisions

### A. Quota model: consume-on-miss, refund-on-failure

Cache hits cost nothing. On a cache miss the route atomically `INCR`s the user's daily counter **before** the OpenAI call:
- If the new count exceeds the limit → `DECR` (so a rejected attempt doesn't burn the quota) → return 429.
- If the OpenAI call then errors → `DECR` to refund.

Net: the counter equals the number of *successful* AI calls. (Rejected alternative: check-then-increment — wider race window.)

### B. Quota key: `session.userId` from `token.sub`

next-auth already carries the stable Microsoft Entra user id in `token.sub`. Surface it once as `session.userId` in the session callback and use it as the quota key in all three routes — uniform, and no extra Graph `/me` call (which `/summary` would otherwise need). The value need not match Graph's `/me` id; it only needs to be stable per user, which `token.sub` is.

### C. Redis access + fail-open

A new shared `src/lib/redis.ts` exposes `getRedis(): Redis | null` using the same env-gating `pubsub.ts` already uses (`UPSTASH_REDIS_REST_URL`/`TOKEN` || `KV_REST_API_URL`/`TOKEN`). `pubsub.ts` keeps its own transport selection (not touched). If Redis is unconfigured, the quota **fails open** (allows the request, logs a warn) — consistent with the realtime in-memory fallback and keeps local dev working without Redis.

## Architecture & data flow

```
Client (DigestView / ActionItemsView / summary consumer)
  └─ GET/POST /api/ai/{tldr,action-items,summary}
        ├─ auth() → 401 if no session
        ├─ getOpenAI() → not_configured (200) if OPENAI_API_KEY unset
        ├─ cache hit? → return cached (NO quota consumed)
        ├─ consume(session.userId)            [src/lib/ai/usage-quota.ts → Redis INCR]
        │     └─ over limit → 429 { status:"rate_limited", message, resetAt }
        ├─ OpenAI gpt-5.4-nano call
        │     ├─ /summary, /tldr → chat.completions → text
        │     └─ /action-items → chat.completions + response_format json_schema → JSON
        │     └─ on error → refund(userId) + 502 { status:"error" }
        └─ cache + return { status:"ok", ... }
```

## Components & interfaces

### `src/lib/redis.ts` (new)
```ts
import { Redis } from "@upstash/redis";
let cached: Redis | null | undefined;
export function getRedis(): Redis | null {
  if (cached !== undefined) return cached;
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  cached = url && token ? new Redis({ url, token }) : null;
  return cached;
}
```

### `src/lib/ai/openai-client.ts` (new)
```ts
import OpenAI from "openai";
let cached: OpenAI | null | undefined;
export function getOpenAI(): OpenAI | null {
  if (cached !== undefined) return cached;
  const key = process.env.OPENAI_API_KEY;
  cached = key ? new OpenAI({ apiKey: key }) : null;
  return cached;
}
export const AI_MODEL = "gpt-5.4-nano";
```

### `src/lib/ai/usage-quota.ts` (new)
```ts
export interface QuotaResult { allowed: boolean; used: number; limit: number; resetAt: number; }
export function dailyLimit(): number   // parseInt(process.env.AI_DAILY_REQUEST_LIMIT ?? "50", 10)
export function nextUtcMidnight(now: Date): number   // epoch ms
export async function consume(userId: string): Promise<QuotaResult>  // INCR + first-incr EXPIRE; DECR if over
export async function refund(userId: string): Promise<void>          // DECR (model-call failure)
```
- Key: `ai:quota:{userId}:{YYYY-MM-DD-UTC}`. TTL on first incr = `ceil((nextUtcMidnight - now)/1000)` seconds.
- `getRedis()` null → `consume` returns `{ allowed:true, used:0, limit, resetAt }` (fail-open); `refund` no-ops.

### Route changes (`tldr`, `action-items`, `summary`)
- Replace `Anthropic` import/usage with `getOpenAI()` + `AI_MODEL`.
- Key gate: `OPENAI_API_KEY` (drop `ANTHROPIC_API_KEY`).
- Insert the cache-check → `consume` → 429 → call → refund-on-error flow.
- `/summary`: add `auth()` (currently unauthenticated); use `session.userId` for quota. **Add an in-memory content-hash cache** (it currently has none): key on a hash of the posted `{author, content}` messages so the banner's *automatic* per-conversation firing does not re-consume quota when nothing changed. Consume quota only on a cache miss. Response shape stays `{ summary }` on success; no `status` union (see Client section).
- `/action-items`: swap Claude tool-use for `response_format: { type:"json_schema", json_schema:{ name:"action_items", strict:true, schema } }`; `JSON.parse` the message content; keep the existing index→id mapping and validation. Strict-mode schema: every property in `required`, `additionalProperties:false`, nullable via `["string","null"]` / `["integer","null"]`.
- New response status `"rate_limited"` added to the `/tldr` and `/action-items` response unions only (these render rich status cards). `/summary` uses HTTP status codes instead (see below).

**Why `/summary` is cached:** unlike `/tldr` and `/action-items` (user-initiated when the Catch-up panel opens), `AiSummaryBanner` fires `/summary` automatically on every qualifying conversation view. Without a cache, browsing would exhaust the daily quota almost immediately. The content-hash cache makes repeat views of an unchanged conversation free.

### Auth (`src/lib/auth/config.ts`, `src/lib/auth/types.ts`)
- `session` callback: `session.userId = (token.sub as string) ?? "";`
- `types.ts`: add `userId: string` to the `Session` interface.

### Client (`src/components/ai/catchup-shared.tsx`, `DigestView.tsx`, `ActionItemsView.tsx`)
- `NotConfiguredCard`: copy text and the copy-button value `ANTHROPIC_API_KEY` → `OPENAI_API_KEY`.
- New `LimitReachedCard({ resetAt }: { resetAt?: number })` in `catchup-shared.tsx`: "Daily AI limit reached" + "Resets at HH:MM". Rendered when a view sees `status === "rate_limited"`.
- `DigestView` / `ActionItemsView`: handle the new `rate_limited` status → render `LimitReachedCard`.
- **`AiSummaryBanner.tsx` is NOT changed.** It already treats any non-ok response as "Summary unavailable" and only fetches `data.summary`, so the 503/429/502 codes degrade gracefully with no new UX. (Pre-existing, out of scope: the banner uses hardcoded Slack-family hex colors and is gated behind a separate `NEXT_PUBLIC_AI_ENABLED` build flag — left as-is.)

### Dependencies (`package.json`)
- Add `openai`. Remove `@anthropic-ai/sdk` (verify no remaining imports first — only the 3 routes used it; the MCP server does not).

## Error handling & edge cases

| Condition | Response |
|---|---|
| No session | 401 `{ error:"Unauthorized" }` |
| No `OPENAI_API_KEY` | 200 `{ status:"not_configured" }` → not-configured card |
| Over daily quota | 429 — `/tldr` & `/action-items`: `{ status:"rate_limited", message, resetAt }` → limit card; `/summary`: HTTP 429, banner shows "Summary unavailable" |
| OpenAI / JSON-parse failure | 502 (`{ status:"error" }` for the two panel routes), quota refunded |
| Cache hit | served free, quota untouched (all three routes, incl. `/summary`'s new content-hash cache) |
| Redis unconfigured | fail-open (request allowed, warn logged) |

## Testing / verification

- `npm run build` passes (the real gate; catches hooks/page-export issues tsc misses).
- No `OPENAI_API_KEY` → all three routes return `not_configured`; UI shows the (re-labeled) card.
- `AI_DAILY_REQUEST_LIMIT=1` locally → first uncached call succeeds, second same-day call returns the limit card; a cached re-fetch does not consume.
- Quota helpers (`consume`/`refund`/`nextUtcMidnight`/`dailyLimit`) are verifiable against a mocked Redis + a fixed clock.

## File-change summary

New:
- `src/lib/redis.ts`
- `src/lib/ai/openai-client.ts`
- `src/lib/ai/usage-quota.ts`

Edited:
- `src/app/api/ai/tldr/route.ts`, `src/app/api/ai/action-items/route.ts`, `src/app/api/ai/summary/route.ts` (OpenAI + quota; `/summary` also gains `auth()` + a content-hash cache)
- `src/lib/auth/config.ts`, `src/lib/auth/types.ts`
- `src/components/ai/catchup-shared.tsx`, `src/components/ai/DigestView.tsx`, `src/components/ai/ActionItemsView.tsx`
- `package.json` (+ `openai`, − `@anthropic-ai/sdk`)

Not edited (verified): `src/components/messages/AiSummaryBanner.tsx` — degrades gracefully on any non-ok response.

## Owner note (not code)
Set `OPENAI_API_KEY` (and optionally `AI_DAILY_REQUEST_LIMIT`) in Vercel for all 3 envs. `ANTHROPIC_API_KEY` becomes unused. The quota requires Upstash Redis (already provisioned via `KV_REST_API_*`).
