/**
 * IndexedDB-backed store for local action-item reminders.
 *
 * A reminder is a self-nudge: a `ReminderScheduler` tick fires a desktop
 * notification at `fireAt` and clicking it navigates to `sourceHref`. Nothing
 * is posted to any conversation. Mirrors `scheduled-messages.ts`: own object
 * store under the shared `teamsly` DB, swallowed errors, never throws.
 */

import { openTeamslyDb } from "./drafts";

const STORE_NAME = "reminders";

export interface Reminder {
  /** crypto.randomUUID(). */
  id: string;
  /** The action-item text to show in the notification. */
  task: string;
  /** In-app href to open when the notification is clicked. */
  sourceHref: string;
  /** Epoch ms at which the reminder is due. */
  fireAt: number;
  /** Epoch ms the reminder was created. */
  createdAt: number;
}

export async function loadAllReminders(): Promise<Reminder[]> {
  if (typeof window === "undefined") return [];
  const db = await openTeamslyDb();
  if (!db) return [];
  return new Promise<Reminder[]>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => {
        const records = (req.result ?? []) as Reminder[];
        records.sort((a, b) => a.fireAt - b.fireAt);
        resolve(records);
      };
      req.onerror = () => {
        console.warn("[reminders] loadAll failed", req.error);
        resolve([]);
      };
    } catch (err) {
      console.warn("[reminders] loadAll threw", err);
      resolve([]);
    }
  });
}

export async function addReminder(reminder: Reminder): Promise<void> {
  if (typeof window === "undefined") return;
  const db = await openTeamslyDb();
  if (!db) return;
  return new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(reminder);
      tx.oncomplete = () => resolve();
      tx.onerror = () => {
        console.warn("[reminders] add failed", tx.error);
        resolve();
      };
      tx.onabort = () => {
        console.warn("[reminders] add aborted", tx.error);
        resolve();
      };
    } catch (err) {
      console.warn("[reminders] add threw", err);
      resolve();
    }
  });
}

export async function removeReminder(id: string): Promise<void> {
  if (typeof window === "undefined") return;
  const db = await openTeamslyDb();
  if (!db) return;
  return new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => {
        console.warn("[reminders] remove failed", tx.error);
        resolve();
      };
      tx.onabort = () => {
        console.warn("[reminders] remove aborted", tx.error);
        resolve();
      };
    } catch (err) {
      console.warn("[reminders] remove threw", err);
      resolve();
    }
  });
}

export async function clearAllReminders(): Promise<void> {
  if (typeof window === "undefined") return;
  const db = await openTeamslyDb();
  if (!db) return;
  return new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => {
        console.warn("[reminders] clearAll failed", tx.error);
        resolve();
      };
      tx.onabort = () => {
        console.warn("[reminders] clearAll aborted", tx.error);
        resolve();
      };
    } catch (err) {
      console.warn("[reminders] clearAll threw", err);
      resolve();
    }
  });
}
