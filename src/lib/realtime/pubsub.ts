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

function selectTransport(): RealtimeTransport {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    return new RedisTransport(new Redis({ url, token }));
  }
  return new InMemoryTransport();
}

export const transport: RealtimeTransport = selectTransport();
