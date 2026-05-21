// In-memory pub/sub per Vercel function instance.
// Multi-region fan-out via Upstash is deferred — single-region MVP only.

export type RealtimeEvent =
  | { type: "channel_message"; teamId: string; channelId: string; messageId: string }
  | { type: "noop" };

type Subscriber = { send: (event: RealtimeEvent) => void };

const subscribers = new Map<string, Set<Subscriber>>();

export function subscribe(userId: string, sub: Subscriber): () => void {
  let set = subscribers.get(userId);
  if (!set) {
    set = new Set();
    subscribers.set(userId, set);
  }
  set.add(sub);
  return () => {
    set!.delete(sub);
    if (set!.size === 0) subscribers.delete(userId);
  };
}

export function publish(userId: string, event: RealtimeEvent): void {
  const set = subscribers.get(userId);
  if (!set) return;
  for (const sub of set) sub.send(event);
}

export interface SubscriptionRecord {
  userId: string;
  resourceType: "channel_message";
  teamId: string;
  channelId: string;
  expiresAt: number;
}

const subRecords = new Map<string, SubscriptionRecord>();

export function registerSubscription(id: string, record: SubscriptionRecord): void {
  subRecords.set(id, record);
}

export function getSubscription(id: string): SubscriptionRecord | undefined {
  return subRecords.get(id);
}

export function deleteSubscription(id: string): void {
  subRecords.delete(id);
}

export function listUserSubscriptions(userId: string): Array<[string, SubscriptionRecord]> {
  const result: Array<[string, SubscriptionRecord]> = [];
  for (const [id, record] of subRecords) {
    if (record.userId === userId) result.push([id, record]);
  }
  return result;
}
