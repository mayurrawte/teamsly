/**
 * Tiny localStorage-backed visit counter. Lets us prefetch the user's
 * top-N most-visited channels/DMs on app boot so the *first* click after
 * a cold start feels as instant as later clicks (which already paint from
 * the IDB message-cache).
 *
 * Why localStorage instead of IDB: the data is small (<10 KB even for
 * power users), synchronous reads keep the prefetch decision cheap on
 * boot, and we don't need cross-tab consistency. If it grows beyond ~100
 * entries we trim on write.
 *
 * Schema is intentionally fat enough that we don't need to re-derive
 * fetch URLs from elsewhere — the entry remembers whether it's a channel
 * or chat and carries the IDs the routes need.
 */

const STORAGE_KEY = "teamsly:visit-counter";
const MAX_ENTRIES = 100;

export type VisitTarget =
  | { kind: "channel"; teamId: string; channelId: string }
  | { kind: "chat"; chatId: string };

interface VisitEntry {
  count: number;
  lastVisitedAt: number;
  target: VisitTarget;
}

type VisitMap = Record<string, VisitEntry>;

function contextIdFor(target: VisitTarget): string {
  return target.kind === "channel" ? `${target.teamId}:${target.channelId}` : target.chatId;
}

function read(): VisitMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as VisitMap) : {};
  } catch {
    return {};
  }
}

function write(map: VisitMap): void {
  if (typeof window === "undefined") return;
  try {
    // Cap size by dropping the least-recently-visited entries.
    const entries = Object.entries(map);
    if (entries.length > MAX_ENTRIES) {
      entries.sort((a, b) => b[1].lastVisitedAt - a[1].lastVisitedAt);
      const trimmed: VisitMap = {};
      for (const [k, v] of entries.slice(0, MAX_ENTRIES)) trimmed[k] = v;
      map = trimmed;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* quota / private mode — ignore */
  }
}

export function markVisit(target: VisitTarget): void {
  const id = contextIdFor(target);
  const map = read();
  const existing = map[id];
  map[id] = {
    count: (existing?.count ?? 0) + 1,
    lastVisitedAt: Date.now(),
    target,
  };
  write(map);
}

/**
 * Top-N most-visited contexts, ranked by (count, then recency). Excludes
 * one optional contextId so we don't waste a slot on something the user
 * is already actively viewing.
 */
export function getTopVisited(n: number, excludeContextId?: string | null): VisitTarget[] {
  const map = read();
  const entries = Object.entries(map).filter(([id]) => id !== excludeContextId);
  entries.sort((a, b) => {
    if (b[1].count !== a[1].count) return b[1].count - a[1].count;
    return b[1].lastVisitedAt - a[1].lastVisitedAt;
  });
  return entries.slice(0, n).map(([, v]) => v.target);
}

export function clearAllVisits(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
