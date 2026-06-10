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
