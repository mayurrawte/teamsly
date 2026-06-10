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
