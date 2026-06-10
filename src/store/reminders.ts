import { create } from "zustand";
import {
  addReminder as addToIdb,
  clearAllReminders as clearAllFromIdb,
  loadAllReminders,
  removeReminder as removeFromIdb,
  type Reminder,
} from "@/lib/storage/reminders";

export type { Reminder } from "@/lib/storage/reminders";

interface ReminderState {
  reminders: Reminder[];
  /** Best-effort prefill from IndexedDB; called once on AppShell mount. */
  hydrate: () => Promise<void>;
  add: (reminder: Reminder) => void;
  remove: (id: string) => void;
  clearAll: () => void;
}

function sortBySoonest(list: Reminder[]): Reminder[] {
  return [...list].sort((a, b) => a.fireAt - b.fireAt);
}

export const useRemindersStore = create<ReminderState>((set) => ({
  reminders: [],

  hydrate: async () => {
    const fromIdb = await loadAllReminders();
    set((s) => {
      const keyed = new Map<string, Reminder>();
      for (const r of fromIdb) keyed.set(r.id, r);
      for (const r of s.reminders) keyed.set(r.id, r);
      return { reminders: sortBySoonest([...keyed.values()]) };
    });
  },

  add: (reminder) => {
    set((s) => ({ reminders: sortBySoonest([reminder, ...s.reminders.filter((r) => r.id !== reminder.id)]) }));
    void addToIdb(reminder);
  },

  remove: (id) => {
    set((s) => ({ reminders: s.reminders.filter((r) => r.id !== id) }));
    void removeFromIdb(id);
  },

  clearAll: () => {
    set({ reminders: [] });
    void clearAllFromIdb();
  },
}));
