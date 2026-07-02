/**
 * IndexedDB-backed store for local reminders.
 *
 * A reminder is a self-nudge: a `ReminderScheduler` tick fires a desktop
 * notification (and, for message reminders, an in-app toast) at `fireAt`, and
 * acting on it navigates to `sourceHref`. Nothing is posted to any
 * conversation. Mirrors `scheduled-messages.ts`: own object store under the
 * shared `teamsly` DB, swallowed errors, never throws.
 *
 * Two producers share this store:
 *   - AI action-items (`ActionItemsView`) — a bare `{task, sourceHref}` nudge.
 *   - Message "Remind me" (#142) — anchored to a specific message, so it also
 *     carries the message/context metadata needed to render a reminders list
 *     row and jump back to the exact message via `?anchor=`.
 * The message-context fields are optional: an action-item reminder simply
 * omits them, which is why nothing in that path had to change.
 */

import { openTeamslyDb } from "./drafts";

const STORE_NAME = "reminders";

export interface Reminder {
  /** crypto.randomUUID(). */
  id: string;
  /** The text to show in the notification/toast (action-item text, or a message-derived nudge). */
  task: string;
  /** In-app href to open when the reminder is acted on. */
  sourceHref: string;
  /** Epoch ms at which the reminder is due. */
  fireAt: number;
  /** Epoch ms the reminder was created. */
  createdAt: number;

  // --- Message-anchored reminders (#142). Absent on AI action-item reminders. ---
  /**
   * Context key of the anchored message — same shape as the bookmarks store's
   * `contextId`: `chatId` for a DM, `${teamId}:${channelId}` for a channel.
   */
  contextId?: string;
  /** Id of the anchored message; combined with `contextId` to jump via `?anchor=`. */
  messageId?: string;
  /** Whether the anchored message lives in a DM or a channel. */
  contextKind?: "chat" | "channel";
  /** First ~200 chars of the message body, for the reminders list row. */
  snippet?: string;
  /** Display name of the message author at the time the reminder was set. */
  senderName?: string;
  /** Human-readable label of where the message lives ("#general", "Alex Wu"). */
  contextLabel?: string;
  /** Optional free-text note the user attached when setting the reminder. */
  note?: string;
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
