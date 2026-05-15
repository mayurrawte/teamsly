/**
 * IndexedDB-backed cache for unsent composer drafts.
 *
 * Mirrors the pattern in `message-cache.ts`: own object store under the
 * shared `teamsly` DB, fire-and-forget writes, swallowed errors. The store
 * is the source of truth at runtime; IDB is best-effort prefill on cold
 * start and best-effort write-through on `setDraft`/`clearDraft`.
 *
 * Why this exists: Microsoft is shipping a Central Draft Manager in 2026
 * because users lose unsent messages all the time. Without this, switching
 * chats or reloading drops whatever's in `MessageInput`'s local state.
 *
 * Keyed by `contextId` — same key shape as `messages-by-context` so the
 * two stores line up for the same chat/channel.
 */

const DB_NAME = "teamsly";
const DB_VERSION = 2;
const MESSAGE_CACHE_STORE = "messages-by-context";
const DRAFTS_STORE = "drafts";
const BOOKMARKS_STORE = "bookmarks";

interface DraftRecord {
  contextId: string;
  text: string;
  updatedAt: number;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

/**
 * Open (and migrate) the shared Teamsly IDB database. The same DB is used
 * by message-cache.ts and bookmarks.ts — they share this `openDb` indirectly
 * via this module's `openDb`, so the version bump and upgrade path live
 * here. Callers across modules each call their own `openDb` but they all
 * resolve to the same `IDBDatabase` once any one of them has triggered
 * the upgrade.
 */
function openDb(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || typeof indexedDB === "undefined") {
    return Promise.resolve(null);
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(MESSAGE_CACHE_STORE)) {
          db.createObjectStore(MESSAGE_CACHE_STORE, { keyPath: "contextId" });
        }
        if (!db.objectStoreNames.contains(DRAFTS_STORE)) {
          db.createObjectStore(DRAFTS_STORE, { keyPath: "contextId" });
        }
        if (!db.objectStoreNames.contains(BOOKMARKS_STORE)) {
          const store = db.createObjectStore(BOOKMARKS_STORE, {
            keyPath: ["contextId", "messageId"],
          });
          store.createIndex("savedAt", "savedAt");
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        console.warn("[drafts] open failed", request.error);
        resolve(null);
      };
      request.onblocked = () => {
        console.warn("[drafts] open blocked");
        resolve(null);
      };
    } catch (err) {
      console.warn("[drafts] open threw", err);
      resolve(null);
    }
  });

  return dbPromise;
}

// Exported so sibling stores (bookmarks) can reuse the same upgrade-aware
// connection without re-declaring the DB version.
export function openTeamslyDb(): Promise<IDBDatabase | null> {
  return openDb();
}

// Cap on each draft body. Pasting a novel into the composer shouldn't
// blow up IDB; trim anything beyond.
const MAX_DRAFT_BYTES = 16 * 1024;

/**
 * Read every persisted draft. Returns `{}` on any failure or if IDB is
 * unavailable. Never throws.
 */
export async function loadAllDrafts(): Promise<Record<string, string>> {
  const db = await openDb();
  if (!db) return {};

  return new Promise<Record<string, string>>((resolve) => {
    try {
      const tx = db.transaction(DRAFTS_STORE, "readonly");
      const store = tx.objectStore(DRAFTS_STORE);
      const request = store.getAll();
      request.onsuccess = () => {
        const records = (request.result ?? []) as DraftRecord[];
        const out: Record<string, string> = {};
        for (const r of records) {
          if (r && typeof r.contextId === "string" && typeof r.text === "string") {
            out[r.contextId] = r.text;
          }
        }
        resolve(out);
      };
      request.onerror = () => {
        console.warn("[drafts] loadAll failed", request.error);
        resolve({});
      };
    } catch (err) {
      console.warn("[drafts] loadAll threw", err);
      resolve({});
    }
  });
}

/**
 * Write a single context's draft. Strips drafts longer than the
 * 16 KB cap (no point persisting a pasted essay). Tolerates failures
 * silently.
 */
export async function saveDraft(contextId: string, text: string): Promise<void> {
  const db = await openDb();
  if (!db) return;

  // Cap the body — pasted novels just get dropped beyond the limit.
  const trimmed = text.length > MAX_DRAFT_BYTES ? text.slice(0, MAX_DRAFT_BYTES) : text;
  const record: DraftRecord = {
    contextId,
    text: trimmed,
    updatedAt: Date.now(),
  };

  return new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(DRAFTS_STORE, "readwrite");
      const store = tx.objectStore(DRAFTS_STORE);
      store.put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => {
        console.warn("[drafts] saveDraft failed", tx.error);
        resolve();
      };
      tx.onabort = () => {
        console.warn("[drafts] saveDraft aborted", tx.error);
        resolve();
      };
    } catch (err) {
      console.warn("[drafts] saveDraft threw", err);
      resolve();
    }
  });
}

/**
 * Remove a single context's draft. Called after a successful send so the
 * draft doesn't reappear next time the user opens the chat.
 */
export async function clearDraft(contextId: string): Promise<void> {
  const db = await openDb();
  if (!db) return;

  return new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(DRAFTS_STORE, "readwrite");
      const store = tx.objectStore(DRAFTS_STORE);
      store.delete(contextId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => {
        console.warn("[drafts] clearDraft failed", tx.error);
        resolve();
      };
      tx.onabort = () => {
        console.warn("[drafts] clearDraft aborted", tx.error);
        resolve();
      };
    } catch (err) {
      console.warn("[drafts] clearDraft threw", err);
      resolve();
    }
  });
}

/**
 * Drop the entire drafts store. Called on sign-out so a previous user's
 * unsent messages don't leak to the next sign-in on the same device.
 */
export async function clearAll(): Promise<void> {
  const db = await openDb();
  if (!db) return;

  return new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(DRAFTS_STORE, "readwrite");
      const store = tx.objectStore(DRAFTS_STORE);
      store.clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => {
        console.warn("[drafts] clearAll failed", tx.error);
        resolve();
      };
      tx.onabort = () => {
        console.warn("[drafts] clearAll aborted", tx.error);
        resolve();
      };
    } catch (err) {
      console.warn("[drafts] clearAll threw", err);
      resolve();
    }
  });
}
