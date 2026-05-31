/**
 * IndexedDB-backed queue for "send later" / scheduled messages.
 *
 * Why this exists: New Teams has no client-side scheduled-send and Graph
 * doesn't expose a server-side one we can drive without our own backend.
 * We hold the composed message client-side and POST it to the existing
 * `/api/chats/{chatId}/messages` endpoint once its `scheduleTime` is due —
 * a due-sweep runs in ChatView (current chat) and Sidebar (all DMs) on the
 * same cadence as the disappearing-message sweep.
 *
 * Schema: keyed by the composite `[contextId, id]` (contextId = chatId,
 * id = a per-message UUID) so the same chat can hold many pending sends and
 * each is removed cleanly once delivered. A `scheduleTime` secondary index
 * lets the sweep find due entries cheaply.
 *
 * Scope: DMs only (1:1 + group chats), not channels.
 *
 * Mirrors `bookmarks.ts`'s patterns: own object store under the shared
 * `teamsly` DB, swallow errors, console.warn on failure. UI stays instant.
 */

import { openTeamslyDb } from "./drafts";

const STORE_NAME = "scheduled-messages";

export interface ScheduledMessage {
  /** Chat id the message will be sent to. */
  contextId: string;
  /** Per-message UUID (crypto.randomUUID()). */
  id: string;
  /** HTML body, already rendered the way handleSend produces it. */
  content: string;
  /** Structured @mentions, same shape the send handler expects. */
  mentions?: { id: string; name: string }[];
  /** Set when the scheduled message should also disappear after sending. */
  disappearMs?: number;
  /** Epoch ms at which the message becomes due to send. */
  scheduleTime: number;
  /**
   * AAD user id of a 1:1 DM recipient to gate delivery on presence instead of
   * time ("send when free"). When set, the due-sweep delivers the message once
   * `presenceMap[releaseWhenAvailable]` is "Available" rather than when
   * `scheduleTime` passes; `scheduleTime` is set to the queue time so the
   * existing sort/index keep working.
   */
  releaseWhenAvailable?: string;
  /** Recipient display name, cached for the pending banner. */
  releaseTargetName?: string;
  /** Epoch ms the schedule was created. */
  createdAt: number;
  status: "pending" | "failed";
}

function openDb(): Promise<IDBDatabase | null> {
  return openTeamslyDb();
}

/**
 * Read every scheduled message, soonest-first. Returns `[]` on any failure
 * or if IDB is unavailable. Never throws.
 */
export async function loadAllScheduled(): Promise<ScheduledMessage[]> {
  if (typeof window === "undefined") return [];
  const db = await openDb();
  if (!db) return [];

  return new Promise<ScheduledMessage[]>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => {
        const records = (request.result ?? []) as ScheduledMessage[];
        // Soonest-due first — sizes are small (a handful per user) so a
        // single in-memory sort is simpler than cursoring the index.
        records.sort((a, b) => a.scheduleTime - b.scheduleTime);
        resolve(records);
      };
      request.onerror = () => {
        console.warn("[scheduled] loadAll failed", request.error);
        resolve([]);
      };
    } catch (err) {
      console.warn("[scheduled] loadAll threw", err);
      resolve([]);
    }
  });
}

/**
 * Add (or overwrite) a single scheduled message. Tolerates failures silently.
 */
export async function addScheduled(message: ScheduledMessage): Promise<void> {
  if (typeof window === "undefined") return;
  const db = await openDb();
  if (!db) return;

  return new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.put(message);
      tx.oncomplete = () => resolve();
      tx.onerror = () => {
        console.warn("[scheduled] add failed", tx.error);
        resolve();
      };
      tx.onabort = () => {
        console.warn("[scheduled] add aborted", tx.error);
        resolve();
      };
    } catch (err) {
      console.warn("[scheduled] add threw", err);
      resolve();
    }
  });
}

/**
 * Remove a single scheduled message by its composite key.
 */
export async function removeScheduled(
  contextId: string,
  id: string
): Promise<void> {
  if (typeof window === "undefined") return;
  const db = await openDb();
  if (!db) return;

  return new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.delete([contextId, id]);
      tx.oncomplete = () => resolve();
      tx.onerror = () => {
        console.warn("[scheduled] remove failed", tx.error);
        resolve();
      };
      tx.onabort = () => {
        console.warn("[scheduled] remove aborted", tx.error);
        resolve();
      };
    } catch (err) {
      console.warn("[scheduled] remove threw", err);
      resolve();
    }
  });
}

/**
 * Drop every scheduled message. Called on sign-out alongside the message
 * cache, drafts, and bookmarks clear so a previous user's queued sends
 * don't leak to the next sign-in on the same device.
 */
export async function clearAllScheduled(): Promise<void> {
  if (typeof window === "undefined") return;
  const db = await openDb();
  if (!db) return;

  return new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => {
        console.warn("[scheduled] clearAll failed", tx.error);
        resolve();
      };
      tx.onabort = () => {
        console.warn("[scheduled] clearAll aborted", tx.error);
        resolve();
      };
    } catch (err) {
      console.warn("[scheduled] clearAll threw", err);
      resolve();
    }
  });
}
