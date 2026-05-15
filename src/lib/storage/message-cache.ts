/**
 * IndexedDB-backed cache for the workspace store's per-context message map.
 *
 * Why IDB instead of localStorage: per-context message arrays can run into
 * hundreds of KB once HTML bodies and attachment metadata pile up — far past
 * localStorage's 5 MB hard cap and synchronous-write cost. IDB is async,
 * larger, and structured-cloneable.
 *
 * The store stays the source of truth at runtime; IDB is best-effort prefill
 * on cold start and best-effort write-through on mutations. Failures
 * (private browsing, quota, schema upgrades) are swallowed — UI must stay
 * instant.
 *
 * Optimistic messages (`__pending` / `__failed`) are stripped before write:
 * a reload should not resurrect a half-sent message and immediately mark it
 * failed.
 */

import { openTeamslyDb } from "./drafts";

const STORE_NAME = "messages-by-context";

interface ContextRecord {
  contextId: string;
  messages: MSMessage[];
  updatedAt: number;
}

// The shared `teamsly` IDB is opened from `drafts.ts` so the upgrade path
// (which adds new object stores like `drafts` and `bookmarks`) lives in
// one place. Every module here goes through openTeamslyDb to avoid racing
// open-with-different-version calls.
function openDb(): Promise<IDBDatabase | null> {
  return openTeamslyDb();
}

/**
 * Read all cached contexts. Returns an empty object on any failure
 * (including IDB unavailable). Never throws.
 */
export async function loadAllContexts(): Promise<Record<string, MSMessage[]>> {
  const db = await openDb();
  if (!db) return {};

  return new Promise<Record<string, MSMessage[]>>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => {
        const records = (request.result ?? []) as ContextRecord[];
        const out: Record<string, MSMessage[]> = {};
        for (const r of records) {
          if (r && r.contextId && Array.isArray(r.messages)) {
            out[r.contextId] = r.messages;
          }
        }
        resolve(out);
      };
      request.onerror = () => {
        console.warn("[message-cache] loadAll failed", request.error);
        resolve({});
      };
    } catch (err) {
      console.warn("[message-cache] loadAll threw", err);
      resolve({});
    }
  });
}

/**
 * Write the messages for a single context. Strips optimistic entries
 * (`__pending` / `__failed`) before write — they live only in memory.
 * Tolerates failures silently.
 */
export async function saveContext(
  contextId: string,
  messages: MSMessage[]
): Promise<void> {
  const db = await openDb();
  if (!db) return;

  const cleaned = messages.filter((m) => !m.__pending && !m.__failed);
  const record: ContextRecord = {
    contextId,
    messages: cleaned,
    updatedAt: Date.now(),
  };

  return new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => {
        console.warn("[message-cache] saveContext failed", tx.error);
        resolve();
      };
      tx.onabort = () => {
        console.warn("[message-cache] saveContext aborted", tx.error);
        resolve();
      };
    } catch (err) {
      console.warn("[message-cache] saveContext threw", err);
      resolve();
    }
  });
}

/**
 * Drop the entire cache. Called on sign-out so a previous user's messages
 * don't leak to the next sign-in on the same device.
 */
export async function clearAll(): Promise<void> {
  const db = await openDb();
  if (!db) return;

  return new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => {
        console.warn("[message-cache] clearAll failed", tx.error);
        resolve();
      };
      tx.onabort = () => {
        console.warn("[message-cache] clearAll aborted", tx.error);
        resolve();
      };
    } catch (err) {
      console.warn("[message-cache] clearAll threw", err);
      resolve();
    }
  });
}
