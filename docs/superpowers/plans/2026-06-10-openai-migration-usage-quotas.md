# OpenAI migration + per-user AI usage quotas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the three AI routes from Anthropic to OpenAI `gpt-5.4-nano`, and add a per-user shared daily request quota (Upstash Redis) enforced before each model call.

**Architecture:** New shared helpers — `getRedis()`, `getOpenAI()`/`chatComplete()`, and a `usage-quota` module (`consume`/`refund`). Each route gates on `OPENAI_API_KEY`, checks its cache, consumes a quota slot on a miss (429 if over), calls `gpt-5.4-nano`, and refunds on failure. The action-items route uses OpenAI Structured Outputs (`json_schema`) in place of Claude tool-use. The quota key is `session.userId` (the Entra `token.sub`, surfaced in the auth session callback).

**Tech Stack:** Next.js App Router route handlers (Node runtime), `openai` SDK (chat completions + structured outputs), `@upstash/redis`, next-auth (Microsoft Entra), Zustand/React 19 (client cards).

---

## Testing note (read before starting)

This repo has **no test runner** (no vitest/jest). Per `CLAUDE.md`, the gate is the build. Each task verifies with:
- **Quick check:** `npx tsc --noEmit 2>&1 | grep -v "src/lib/auth/config.ts"` — expect no output (the `auth/config.ts` line is pre-existing, filtered).
- **Milestone:** `npm run build` — expect exit 0. Required after all routes are migrated (Task 6) and after the client changes (Task 7), plus once at the end.
- **Manual:** described where observable (dev server at `http://localhost:3000`).

**Commits:** Conventional Commit prefixes, imperative subject, **NO AI/agent co-author trailer** (per `CLAUDE.md`). Work happens on branch `feat/openai-migration-usage-quotas` (already created; the design spec is already committed there as `554a084`).

**Git rule for subagents:** You are already on `feat/openai-migration-usage-quotas`. Do NOT run `git checkout`/`switch`/`stash`/`reset`/`branch`. Only `git add` + `git commit`. Run `git branch --show-current` before each commit and confirm it prints `feat/openai-migration-usage-quotas`; if not, STOP and report BLOCKED.

---

## File structure

New:
- `src/lib/redis.ts` — shared Upstash client (`getRedis(): Redis | null`).
- `src/lib/ai/openai-client.ts` — `getOpenAI(): OpenAI | null`, `AI_MODEL`, `chatComplete()`.
- `src/lib/ai/usage-quota.ts` — `consume`/`refund`/`dailyLimit`/`nextUtcMidnight`.

Modified:
- `src/lib/auth/config.ts`, `src/lib/auth/types.ts` — surface `session.userId`.
- `src/app/api/ai/summary/route.ts` — OpenAI + auth + quota + content-hash cache.
- `src/app/api/ai/tldr/route.ts` — OpenAI + quota + `rate_limited` status.
- `src/app/api/ai/action-items/route.ts` — OpenAI Structured Outputs + quota + `rate_limited`.
- `src/components/ai/catchup-shared.tsx` — `NotConfiguredCard` copy → OpenAI; new `LimitReachedCard`.
- `src/components/ai/DigestView.tsx`, `src/components/ai/ActionItemsView.tsx` — handle `rate_limited`.
- `package.json` — `+ openai`, `− @anthropic-ai/sdk`.

Not edited (verified): `src/components/messages/AiSummaryBanner.tsx` — degrades to "Summary unavailable" on any non-ok.

---

## Task 1: Install `openai`; add shared Redis + OpenAI client helpers

**Files:**
- Modify: `package.json` (via npm)
- Create: `src/lib/redis.ts`
- Create: `src/lib/ai/openai-client.ts`

- [ ] **Step 1: Install the OpenAI SDK (latest — its types must include `reasoning_effort`)**

Run: `npm install openai@latest`
Expected: adds `openai` to dependencies, exit 0. (Do NOT remove `@anthropic-ai/sdk` yet — the routes still import it until Tasks 4–6.)

- [ ] **Step 2: Create `src/lib/redis.ts`**

```ts
import { Redis } from "@upstash/redis";

// Shared Upstash client. Same env-gating pubsub.ts uses: the Upstash Vercel
// integration provisions KV_REST_API_URL/TOKEN; UPSTASH_* is the native name.
// Returns null when unconfigured (callers decide fail-open vs fail-closed).
let cached: Redis | null | undefined;

export function getRedis(): Redis | null {
  if (cached !== undefined) return cached;
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  cached = url && token ? new Redis({ url, token }) : null;
  return cached;
}
```

- [ ] **Step 3: Create `src/lib/ai/openai-client.ts`**

```ts
import OpenAI from "openai";

/** gpt-5.4-nano: latest nano, $0.20/$1.25 per 1M, 400K ctx, supports Structured Outputs. */
export const AI_MODEL = "gpt-5.4-nano";

let cached: OpenAI | null | undefined;

export function getOpenAI(): OpenAI | null {
  if (cached !== undefined) return cached;
  const key = process.env.OPENAI_API_KEY;
  cached = key ? new OpenAI({ apiKey: key }) : null;
  return cached;
}

/**
 * One place for the GPT-5 reasoning-model quirks:
 * - `max_completion_tokens` (NOT `max_tokens`, which 400s on reasoning models)
 * - `reasoning_effort: "minimal"` — these are summarization/extraction tasks, not
 *   reasoning; "minimal" keeps reasoning tokens (and cost) near zero. Do NOT use
 *   "none": with max_completion_tokens it's a documented footgun (ignores the flag,
 *   burns the budget on invisible reasoning, returns "").
 * - no `temperature` (reasoning models reject non-default values).
 */
export async function chatComplete(
  client: OpenAI,
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  opts: {
    maxTokens: number;
    responseFormat?: OpenAI.Chat.Completions.ChatCompletionCreateParams["response_format"];
  }
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  return client.chat.completions.create({
    model: AI_MODEL,
    messages,
    reasoning_effort: "minimal",
    max_completion_tokens: opts.maxTokens,
    ...(opts.responseFormat ? { response_format: opts.responseFormat } : {}),
  });
}
```

- [ ] **Step 4: Quick check**

Run: `npx tsc --noEmit 2>&1 | grep -v "src/lib/auth/config.ts"`
Expected: no output. If `reasoning_effort` is flagged as an unknown property, the installed `openai` version is too old — re-run `npm install openai@latest` and re-check. If it still won't type, cast the create arg: `client.chat.completions.create({ ... } as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming)` and note it in your report.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/lib/redis.ts src/lib/ai/openai-client.ts
git commit -m "feat(ai): add openai client + shared redis helper"
```

---

## Task 2: Usage-quota module

**Files:**
- Create: `src/lib/ai/usage-quota.ts`

- [ ] **Step 1: Create `src/lib/ai/usage-quota.ts`**

```ts
import { getRedis } from "@/lib/redis";

export interface QuotaResult {
  allowed: boolean;
  used: number;
  limit: number;
  /** Epoch ms of the next UTC midnight (when the counter resets). */
  resetAt: number;
}

export function dailyLimit(): number {
  const n = parseInt(process.env.AI_DAILY_REQUEST_LIMIT ?? "50", 10);
  return Number.isFinite(n) && n > 0 ? n : 50;
}

export function nextUtcMidnight(now: Date): number {
  const d = new Date(now);
  d.setUTCHours(24, 0, 0, 0);
  return d.getTime();
}

function dayKey(userId: string, now: Date): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return `ai:quota:${userId}:${y}-${m}-${day}`;
}

/**
 * Atomically consume one daily request slot for `userId`. Fail-open: if Redis is
 * unconfigured or errors, the request is allowed. A rejected (over-limit) attempt
 * is decremented back so it doesn't permanently burn the budget.
 */
export async function consume(userId: string): Promise<QuotaResult> {
  const limit = dailyLimit();
  const now = new Date();
  const resetAt = nextUtcMidnight(now);
  const redis = getRedis();
  if (!redis || !userId) return { allowed: true, used: 0, limit, resetAt };

  const key = dayKey(userId, now);
  try {
    const used = await redis.incr(key);
    if (used === 1) {
      const ttlSec = Math.max(60, Math.ceil((resetAt - now.getTime()) / 1000));
      await redis.expire(key, ttlSec);
    }
    if (used > limit) {
      await redis.decr(key);
      return { allowed: false, used: used - 1, limit, resetAt };
    }
    return { allowed: true, used, limit, resetAt };
  } catch (err) {
    console.warn("[usage-quota] consume failed, allowing:", err);
    return { allowed: true, used: 0, limit, resetAt };
  }
}

/** Give a consumed slot back (call when the model request fails). Best-effort. */
export async function refund(userId: string): Promise<void> {
  const redis = getRedis();
  if (!redis || !userId) return;
  try {
    await redis.decr(dayKey(userId, new Date()));
  } catch (err) {
    console.warn("[usage-quota] refund failed:", err);
  }
}
```

- [ ] **Step 2: Quick check**

Run: `npx tsc --noEmit 2>&1 | grep -v "src/lib/auth/config.ts"`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/lib/ai/usage-quota.ts
git commit -m "feat(ai): add per-user daily request quota (upstash)"
```

---

## Task 3: Surface `session.userId`

**Files:**
- Modify: `src/lib/auth/config.ts`
- Modify: `src/lib/auth/types.ts`

- [ ] **Step 1: Add `userId` to the session type**

Replace the entire contents of `src/lib/auth/types.ts` with:

```ts
import "next-auth";

declare module "next-auth" {
  interface Session {
    accessToken: string;
    userId: string;
  }
}
```

- [ ] **Step 2: Set `session.userId` in the session callback**

In `src/lib/auth/config.ts`, find the `session` callback:

```ts
    async session({ session, token }) {
      session.accessToken = token.accessToken as string;
      if (token.error) {
        (session as unknown as { error?: string }).error = token.error as string;
      }
      return session;
    },
```

Add the `userId` line right after the `accessToken` line:

```ts
    async session({ session, token }) {
      session.accessToken = token.accessToken as string;
      session.userId = (token.sub as string) ?? "";
      if (token.error) {
        (session as unknown as { error?: string }).error = token.error as string;
      }
      return session;
    },
```

- [ ] **Step 3: Quick check**

Run: `npx tsc --noEmit 2>&1 | grep -v "src/lib/auth/config.ts"`
Expected: no output. (The pre-existing `auth/config.ts` tsc noise is filtered; confirm no NEW errors appear in other files referencing `session.userId`.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/auth/config.ts src/lib/auth/types.ts
git commit -m "feat(auth): expose stable session.userId (entra sub)"
```

---

## Task 4: Migrate `/api/ai/summary` to OpenAI + auth + quota + cache

**Files:**
- Modify (replace entirely): `src/app/api/ai/summary/route.ts`

- [ ] **Step 1: Replace the entire contents of `src/app/api/ai/summary/route.ts` with:**

```ts
import { auth } from "@/lib/auth/config";
import { getOpenAI, chatComplete } from "@/lib/ai/openai-client";
import { consume, refund } from "@/lib/ai/usage-quota";
import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";

const CACHE_TTL_MS = 10 * 60 * 1000;

interface CacheEntry {
  summary: string;
  expiresAt: number;
}

// Content-hash cache: AiSummaryBanner fires this automatically on every
// conversation view, so without a cache, browsing would exhaust the daily
// quota. Identical message sets reuse the summary (and don't re-consume).
const cache = new Map<string, CacheEntry>();

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!getOpenAI()) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 503 });
  }

  const body = (await req.json()) as { messages?: Array<{ author: string; content: string }> };
  const messages = body.messages?.slice(-30) ?? [];
  if (messages.length === 0) {
    return NextResponse.json({ summary: "No unread messages to summarize." });
  }

  const transcript = messages.map((m) => `${m.author}: ${m.content}`).join("\n");
  const cacheKey = createHash("sha256").update(transcript).digest("hex");

  const now = Date.now();
  const hit = cache.get(cacheKey);
  if (hit && hit.expiresAt > now) {
    return NextResponse.json({ summary: hit.summary });
  }

  const quota = await consume(session.userId);
  if (!quota.allowed) {
    return NextResponse.json(
      { error: "Daily AI limit reached", resetAt: quota.resetAt },
      { status: 429 }
    );
  }

  const client = getOpenAI()!;
  let text = "";
  try {
    const completion = await chatComplete(
      client,
      [
        {
          role: "user",
          content: `Summarize these Microsoft Teams messages as a concise unread summary. Use 2 bullets and include blockers or decisions if present.\n\n${transcript}`,
        },
      ],
      { maxTokens: 400 }
    );
    text = completion.choices[0]?.message?.content?.trim() ?? "";
  } catch (err) {
    console.error("[api/ai/summary] OpenAI request failed:", err);
    await refund(session.userId);
    return NextResponse.json({ error: "AI summary failed" }, { status: 502 });
  }

  cache.set(cacheKey, { summary: text, expiresAt: now + CACHE_TTL_MS });
  return NextResponse.json({ summary: text });
}
```

- [ ] **Step 2: Quick check**

Run: `npx tsc --noEmit 2>&1 | grep -v "src/lib/auth/config.ts"`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/ai/summary/route.ts
git commit -m "feat(ai): summary route on openai + auth + quota + cache"
```

---

## Task 5: Migrate `/api/ai/tldr` to OpenAI + quota

**Files:**
- Modify: `src/app/api/ai/tldr/route.ts`

Read the current file first. It currently: imports `Anthropic`, gates on `ANTHROPIC_API_KEY`, resolves the Graph client (named `client`) + `meId`/`meName`, caches by `meId`, gathers conversations, builds a transcript, and calls the Anthropic `messages.create` to produce `digest`. Make these surgical edits:

- [ ] **Step 1: Swap the imports**

Replace:
```ts
import Anthropic from "@anthropic-ai/sdk";
```
with:
```ts
import { getOpenAI, chatComplete } from "@/lib/ai/openai-client";
import { consume, refund } from "@/lib/ai/usage-quota";
```

- [ ] **Step 2: Add `rate_limited` + `resetAt` to the response interface**

In the `TldrResponse` interface, change the `status` union and add `resetAt`:
```ts
interface TldrResponse {
  status: "ok" | "not_configured" | "error" | "rate_limited";
  generatedAt?: string;
  since?: string;
  conversationCount?: number;
  cached: boolean;
  digest?: string;
  message?: string;
  resetAt?: number;
}
```

- [ ] **Step 3: Flip the key gate**

Replace the key-gate block:
```ts
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({
      status: "not_configured",
      cached: false,
      message: "Set ANTHROPIC_API_KEY in Vercel env to enable AI digests.",
    } satisfies TldrResponse);
  }
```
with:
```ts
  if (!getOpenAI()) {
    return NextResponse.json({
      status: "not_configured",
      cached: false,
      message: "Set OPENAI_API_KEY in Vercel env to enable AI digests.",
    } satisfies TldrResponse);
  }
```

- [ ] **Step 4: Replace the Anthropic call with the OpenAI call + quota**

Find the digest-generation block (the `try { const anthropic = new Anthropic(...); const response = await anthropic.messages.create({ model: "claude-sonnet-4-6", max_tokens: 1500, messages: [{ role: "user", content: \`...prompt...\` }] }); digest = response.content.map(...).join("").trim(); } catch (err) { ... return 502 }`).

Replace that entire `let digest = ""; try { ... } catch { ... }` block with the following. **Keep the exact prompt string** that builds `content` from `meName` + `transcript` — only the API call and the quota guard change:

```ts
  const quota = await consume(session.userId);
  if (!quota.allowed) {
    return NextResponse.json(
      {
        status: "rate_limited",
        cached: false,
        message: "You've reached today's AI limit.",
        resetAt: quota.resetAt,
      } satisfies TldrResponse,
      { status: 429 }
    );
  }

  let digest = "";
  try {
    const openai = getOpenAI()!;
    const completion = await chatComplete(
      openai,
      [
        {
          role: "user",
          content: `You are a chat catch-up assistant. The user has been away. Summarize the conversations below into a digest. For each conversation that has actionable content, output:
  - Topic: 1-line synthesis.
  - Decisions: list of any decisions made.
  - Action items: list of any todos / asks / blockers, with @mentions if attributable.
  - Mentions of ${meName}: list any direct mentions or things requiring their attention.
Skip conversations with no substantive content (small talk only).
Be concise. Use markdown. No preamble.

${transcript}`,
        },
      ],
      { maxTokens: 1800 }
    );
    digest = completion.choices[0]?.message?.content?.trim() ?? "";
  } catch (err) {
    console.error("[api/ai/tldr] OpenAI request failed:", err);
    await refund(session.userId);
    return NextResponse.json(
      { status: "error", cached: false, message: "AI digest generation failed" } satisfies TldrResponse,
      { status: 502 }
    );
  }
```

Leave everything else unchanged: the Graph `client`/`meId`/`meName` resolution, the cache check/return, the `top.length === 0` empty-and-cache path (no quota consumed there — correct, no model call), the transcript build, and the final `cache.set(...)` + success return.

- [ ] **Step 5: Quick check**

Run: `npx tsc --noEmit 2>&1 | grep -v "src/lib/auth/config.ts"`
Expected: no output. (`Anthropic` should no longer be referenced; if tsc flags an unused import, you missed removing it.)

- [ ] **Step 6: Commit**

```bash
git add src/app/api/ai/tldr/route.ts
git commit -m "feat(ai): tldr route on openai + daily quota"
```

---

## Task 6: Migrate `/api/ai/action-items` to OpenAI Structured Outputs + quota

**Files:**
- Modify: `src/app/api/ai/action-items/route.ts`

Read the current file. It imports `Anthropic`, gates on `ANTHROPIC_API_KEY`, defines `ACTION_ITEMS_TOOL` (Anthropic tool) and a `RawItem` interface, resolves Graph client + `meId`/`meName`, caches, gathers + sorts + slices conversations, builds an indexed transcript, calls Anthropic tool-use, extracts the `tool_use` block input, and maps `RawItem[]` → `ActionItem[]`. Make these edits:

- [ ] **Step 1: Swap the imports**

Replace:
```ts
import Anthropic from "@anthropic-ai/sdk";
```
with:
```ts
import { getOpenAI, chatComplete } from "@/lib/ai/openai-client";
import { consume, refund } from "@/lib/ai/usage-quota";
```

- [ ] **Step 2: Replace the Anthropic tool definition with an OpenAI strict JSON schema**

Delete the `const ACTION_ITEMS_TOOL: Anthropic.Tool = { ... } satisfies Anthropic.Tool["input_schema"];` block (the whole tool object) and replace it with this strict-mode schema constant (note `additionalProperties: false` on every object and all fields in `required`, including the nullable ones via `["string","null"]` / `["integer","null"]`):

```ts
const ACTION_ITEMS_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
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
        },
        required: ["task", "owner", "ownership", "conversationIndex", "messageIndex"],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
} as const;
```

- [ ] **Step 3: Flip the key gate**

Replace:
```ts
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({
      status: "not_configured",
      cached: false,
      message: "Set ANTHROPIC_API_KEY in Vercel env to enable AI action items.",
    } satisfies ActionItemsResponse);
  }
```
with:
```ts
  if (!getOpenAI()) {
    return NextResponse.json({
      status: "not_configured",
      cached: false,
      message: "Set OPENAI_API_KEY in Vercel env to enable AI action items.",
    } satisfies ActionItemsResponse);
  }
```

- [ ] **Step 4: Add `rate_limited` + `resetAt` to the response interface**

In `interface ActionItemsResponse`, widen the status and add `resetAt`:
```ts
interface ActionItemsResponse {
  status: "ok" | "not_configured" | "error" | "rate_limited";
  generatedAt?: string;
  since?: string;
  cached: boolean;
  items?: ActionItem[];
  message?: string;
  resetAt?: number;
}
```

- [ ] **Step 5: Replace the Anthropic call + extraction with the OpenAI call + quota**

Find the block that does `let raw: RawItem[] = []; try { const anthropic = new Anthropic(...); const response = await anthropic.messages.create({ model: "claude-sonnet-4-6", max_tokens: 2000, tools: [ACTION_ITEMS_TOOL], tool_choice: {...}, messages: [{ role: "user", content: \`...prompt...\` }] }); const toolUse = response.content.find(...); raw = ... } catch (err) { ... return 502 }`.

Replace that entire block with the following. **Keep the exact prompt string** (the `You extract concrete action items ... ${meName} ... ${meId} ... Conversations:\n\n${transcript}` text) — pass it as the user message:

```ts
  const quota = await consume(session.userId);
  if (!quota.allowed) {
    return NextResponse.json(
      {
        status: "rate_limited",
        cached: false,
        message: "You've reached today's AI limit.",
        resetAt: quota.resetAt,
      } satisfies ActionItemsResponse,
      { status: 429 }
    );
  }

  let raw: RawItem[] = [];
  try {
    const openai = getOpenAI()!;
    const completion = await chatComplete(
      openai,
      [
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
      {
        maxTokens: 2500,
        responseFormat: {
          type: "json_schema",
          json_schema: { name: "action_items", strict: true, schema: ACTION_ITEMS_SCHEMA },
        },
      }
    );
    const content = completion.choices[0]?.message?.content;
    const parsed = content ? (JSON.parse(content) as { items?: RawItem[] }) : undefined;
    raw = Array.isArray(parsed?.items) ? parsed!.items : [];
  } catch (err) {
    console.error("[api/ai/action-items] OpenAI request failed:", err);
    await refund(session.userId);
    return NextResponse.json(
      { status: "error", cached: false, message: "AI extraction failed" } satisfies ActionItemsResponse,
      { status: 502 }
    );
  }
```

Leave the `RawItem` interface, the Graph/`meId`/`meName` resolution, cache check, gather/sort/slice, `top.length === 0` empty path, indexed transcript build, and the existing `raw` → `ActionItem[]` mapping + final cache/return all unchanged.

- [ ] **Step 6: Build check (first milestone — all 3 routes now migrated)**

Run: `npm run build`
Expected: exit 0. (Compiles all three migrated routes; no `@anthropic-ai/sdk` import should remain in them.) Paste the final lines.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/ai/action-items/route.ts
git commit -m "feat(ai): action-items route on openai structured outputs + quota"
```

---

## Task 7: Client — re-label not-configured card, add limit-reached card + handling

**Files:**
- Modify: `src/components/ai/catchup-shared.tsx`
- Modify: `src/components/ai/DigestView.tsx`
- Modify: `src/components/ai/ActionItemsView.tsx`

- [ ] **Step 1: Re-label `NotConfiguredCard` to OpenAI and add `LimitReachedCard`**

In `src/components/ai/catchup-shared.tsx`:

(a) In `NotConfiguredCard`, change the clipboard write and the two visible `ANTHROPIC_API_KEY` strings to `OPENAI_API_KEY`. Specifically:
- `void navigator.clipboard.writeText("ANTHROPIC_API_KEY");` → `void navigator.clipboard.writeText("OPENAI_API_KEY");`
- the `<code ...>ANTHROPIC_API_KEY</code>` → `<code ...>OPENAI_API_KEY</code>`
(Leave the surrounding copy/markup as-is.)

(b) Append this new component at the end of the file:

```tsx
/** Shown when the user has hit their daily AI request limit (HTTP 429). */
export function LimitReachedCard({ resetAt }: { resetAt?: number }) {
  const resetLabel = resetAt
    ? new Date(resetAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] p-5">
      <p className="mb-1 text-[14px] font-semibold text-[var(--text-primary)]">Daily AI limit reached</p>
      <p className="text-[13px] text-[var(--text-secondary)]">
        You&apos;ve used today&apos;s AI requests{resetLabel ? `. Resets at ${resetLabel}.` : "."}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Handle `rate_limited` in `DigestView`**

In `src/components/ai/DigestView.tsx`:

(a) Add `rate_limited` + `resetAt` to the local `DigestResponse` interface:
```ts
interface DigestResponse {
  status: "ok" | "not_configured" | "error" | "rate_limited";
  generatedAt?: string;
  since?: string;
  conversationCount?: number;
  cached: boolean;
  digest?: string;
  message?: string;
  resetAt?: number;
}
```

(b) Update the import to include `LimitReachedCard`:
```ts
import { SkeletonCard, NotConfiguredCard, LimitReachedCard } from "./catchup-shared";
```

(c) Add a render branch right after the `not_configured` branch:
```tsx
  if (digest?.status === "rate_limited") {
    return <LimitReachedCard resetAt={digest.resetAt} />;
  }
```

- [ ] **Step 3: Handle `rate_limited` in `ActionItemsView`**

In `src/components/ai/ActionItemsView.tsx`:

(a) Add `rate_limited` + `resetAt` to the local `ActionItemsResponse` interface:
```ts
interface ActionItemsResponse {
  status: "ok" | "not_configured" | "error" | "rate_limited";
  generatedAt?: string;
  since?: string;
  cached: boolean;
  items?: ActionItem[];
  message?: string;
  resetAt?: number;
}
```

(b) Update the import to include `LimitReachedCard`:
```ts
import { SkeletonCard, NotConfiguredCard, LimitReachedCard } from "./catchup-shared";
```

(c) Add a render branch right after the `not_configured` branch:
```tsx
  if (data?.status === "rate_limited") {
    return <LimitReachedCard resetAt={data.resetAt} />;
  }
```

- [ ] **Step 4: Build check (second milestone)**

Run: `npm run build`
Expected: exit 0 (enforces `react-hooks/rules-of-hooks` + page-export rules). Paste the final lines.

- [ ] **Step 5: Manual verification (dev server)**

Start `npm run dev`. With `OPENAI_API_KEY` unset: open the Catch-up panel → both tabs show the "AI features not enabled" card naming `OPENAI_API_KEY`. With the key set and `AI_DAILY_REQUEST_LIMIT=1`: the first uncached digest/action-items call succeeds; a second (different window/refresh, cache miss) shows the "Daily AI limit reached" card.

- [ ] **Step 6: Commit**

```bash
git add src/components/ai/catchup-shared.tsx src/components/ai/DigestView.tsx src/components/ai/ActionItemsView.tsx
git commit -m "feat(ai): re-label key card to openai; add daily-limit card"
```

---

## Task 8: Remove `@anthropic-ai/sdk`; final integration

**Files:**
- Modify: `package.json` (via npm)

- [ ] **Step 1: Confirm no remaining Anthropic imports**

Run: `grep -rn "@anthropic-ai/sdk\|Anthropic(" src/`
Expected: NO output. If anything prints, that file still imports Anthropic — fix it before removing the dep.

- [ ] **Step 2: Remove the dependency**

Run: `npm uninstall @anthropic-ai/sdk`
Expected: removes it from `package.json`, exit 0.

- [ ] **Step 3: Full build + electron compile**

Run: `npm run build && npm run electron:compile`
Expected: both exit 0. Paste the final lines.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: drop unused @anthropic-ai/sdk after openai migration"
```

---

## Self-review

**Spec coverage:**
- OpenAI `gpt-5.4-nano` on all 3 routes → Tasks 4/5/6 via `chatComplete`. ✓
- Structured Outputs for action-items (json_schema, strict) → Task 6. ✓
- Shared daily request quota, env limit, UTC reset, Upstash → Tasks 1/2 + consumed in 4/5/6. ✓
- 429 + limit card; cache hits free; refund on failure → Tasks 4/5/6 (consume on miss, refund on error) + Task 7 (card). ✓
- `OPENAI_API_KEY` gating + re-labeled card → Tasks 4/5/6 + 7. ✓
- `/summary` gets `auth()` + content-hash cache → Task 4. ✓
- `session.userId` quota key → Task 3. ✓
- `AiSummaryBanner` unchanged (degrades gracefully) → confirmed, no task. ✓
- Remove `@anthropic-ai/sdk` → Task 8. ✓
- Verification via build (no test runner) → testing note + per-task checks. ✓

**Placeholder scan:** No TBD/TODO; every code step has complete code. The one conditional ("if `reasoning_effort` won't type, upgrade openai / cast") is an explicit instruction with the exact fallback, not a placeholder. ✓

**Type consistency:** `getOpenAI`/`AI_MODEL`/`chatComplete` defined in Task 1, used in 4/5/6. `consume`/`refund`/`QuotaResult` defined in Task 2, used in 4/5/6. `getRedis` defined in Task 1, used in Task 2. `session.userId` defined in Task 3, used in 4/5/6. `LimitReachedCard` defined in Task 7 Step 1, imported in Steps 2–3. `ACTION_ITEMS_SCHEMA`/`RawItem`/`ActionItem` consistent within Task 6. Response `status` union extended consistently across routes (Tasks 5/6) and client interfaces (Task 7). ✓

**Note on `reasoning_effort` typing:** depends on the installed `openai` SDK version typing it (Task 1 installs latest). Fallback cast documented in Task 1 Step 4.
