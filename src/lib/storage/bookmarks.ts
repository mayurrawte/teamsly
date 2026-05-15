/**
 * IndexedDB-backed cache for the user's saved-message bookmarks.
 *
 * Why this exists: "Saved Messages" was removed in New Teams and users
 * miss it. We surface a Bookmark button on the message hover toolbar and
 * render the saved entries under `/app/later`. The data lives entirely
 * client-side — Graph doesn't expose a savedMessages API and we don't
 * want to spin up our own backend just for this.
 *
 * Schema: keyed by the composite `[contextId, messageId]` so we can
 * dedupe per-message and remove cleanly. A `savedAt` secondary index
 * lets us read the list back newest-first cheaply.
 *
 * Mirrors `message-cache.ts`'s patterns: own object store, swallow
 * errors, console.warn on failure. UI must stay instant.
 */

import { openTeamslyDb } from "./drafts";

const STORE_NAME = "bookmarks";

export interface Bookmark {
  contextId: string;
  messageId: string;
  savedAt: number;
  /** First ~200 chars of the message's plain-text body, for the list row. */
  snippet: string;
  /** Display name of the original author at the time of save. */
  senderName: string;
  /** Human-readable label of where the message lives ("#general", "Alex Wu"). */
  contextLabel: string;
}

function openDb(): Promise<IDBDatabase | null> {
  return openTeamslyDb();
}

/**
 * Read every bookmark, newest-first. Returns `[]` on any failure or if
 * IDB is unavailable. Never throws.
 */
export async function loadAllBookmarks(): Promise<Bookmark[]> {
  const db = await openDb();
  if (!db) return [];

  return new Promise<Bookmark[]>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => {
        const records = (request.result ?? []) as Bookmark[];
        // Sort newest-first — the savedAt index would let us do this in
        // the cursor but for the expected sizes (tens, not thousands) a
        // single in-memory sort is simpler.
        records.sort((a, b) => b.savedAt - a.savedAt);
        resolve(records);
      };
      request.onerror = () => {
        console.warn("[bookmarks] loadAll failed", request.error);
        resolve([]);
      };
    } catch (err) {
      console.warn("[bookmarks] loadAll threw", err);
      resolve([]);
    }
  });
}

/**
 * Add (or overwrite) a single bookmark. Tolerates failures silently.
 */
export async function addBookmark(bookmark: Bookmark): Promise<void> {
  const db = await openDb();
  if (!db) return;

  return new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.put(bookmark);
      tx.oncomplete = () => resolve();
      tx.onerror = () => {
        console.warn("[bookmarks] add failed", tx.error);
        resolve();
      };
      tx.onabort = () => {
        console.warn("[bookmarks] add aborted", tx.error);
        resolve();
      };
    } catch (err) {
      console.warn("[bookmarks] add threw", err);
      resolve();
    }
  });
}

/**
 * Remove a single bookmark by its composite key.
 */
export async function removeBookmark(
  contextId: string,
  messageId: string
): Promise<void> {
  const db = await openDb();
  if (!db) return;

  return new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.delete([contextId, messageId]);
      tx.oncomplete = () => resolve();
      tx.onerror = () => {
        console.warn("[bookmarks] remove failed", tx.error);
        resolve();
      };
      tx.onabort = () => {
        console.warn("[bookmarks] remove aborted", tx.error);
        resolve();
      };
    } catch (err) {
      console.warn("[bookmarks] remove threw", err);
      resolve();
    }
  });
}

/**
 * Drop every bookmark. Called on sign-out alongside the message cache
 * and drafts clear so a previous user's saves don't leak to the next
 * sign-in on the same device.
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
        console.warn("[bookmarks] clearAll failed", tx.error);
        resolve();
      };
      tx.onabort = () => {
        console.warn("[bookmarks] clearAll aborted", tx.error);
        resolve();
      };
    } catch (err) {
      console.warn("[bookmarks] clearAll threw", err);
      resolve();
    }
  });
}
