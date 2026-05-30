import { create } from "zustand";
import {
  addScheduled as addScheduledToIdb,
  clearAllScheduled as clearAllScheduledFromIdb,
  loadAllScheduled,
  removeScheduled as removeScheduledFromIdb,
  type ScheduledMessage,
} from "@/lib/storage/scheduled-messages";

export type { ScheduledMessage } from "@/lib/storage/scheduled-messages";

interface ScheduledState {
  scheduled: ScheduledMessage[];
  /**
   * Best-effort prefill from IndexedDB. Called once on AppShell mount,
   * mirroring the bookmarks/drafts hydration.
   */
  hydrate: () => Promise<void>;
  /** Queue a new scheduled message — used by ChatView's handleSend. */
  addScheduled: (message: ScheduledMessage) => void;
  removeScheduled: (contextId: string, id: string) => void;
  /** Flip a due send that failed to POST so the sweep won't keep retrying. */
  markFailed: (contextId: string, id: string) => void;
  clearAll: () => void;
}

function sortBySoonest(list: ScheduledMessage[]): ScheduledMessage[] {
  return [...list].sort((a, b) => a.scheduleTime - b.scheduleTime);
}

export const useScheduledStore = create<ScheduledState>((set) => ({
  scheduled: [],

  hydrate: async () => {
    const fromIdb = await loadAllScheduled();
    set((s) => {
      // Merge by composite key — anything already in-memory (e.g. a message
      // scheduled between mount and hydration) wins over IDB so a race
      // doesn't lose a queued send.
      const keyed = new Map<string, ScheduledMessage>();
      for (const m of fromIdb) keyed.set(`${m.contextId}::${m.id}`, m);
      for (const m of s.scheduled) keyed.set(`${m.contextId}::${m.id}`, m);
      return { scheduled: sortBySoonest([...keyed.values()]) };
    });
  },

  addScheduled: (message) => {
    set((s) => {
      // Replace any existing entry with the same composite key.
      const without = s.scheduled.filter(
        (m) => !(m.contextId === message.contextId && m.id === message.id)
      );
      return { scheduled: sortBySoonest([message, ...without]) };
    });
    void addScheduledToIdb(message);
  },

  removeScheduled: (contextId, id) => {
    set((s) => ({
      scheduled: s.scheduled.filter(
        (m) => !(m.contextId === contextId && m.id === id)
      ),
    }));
    void removeScheduledFromIdb(contextId, id);
  },

  markFailed: (contextId, id) => {
    set((s) => ({
      scheduled: s.scheduled.map((m) =>
        m.contextId === contextId && m.id === id
          ? { ...m, status: "failed" as const }
          : m
      ),
    }));
    void (async () => {
      const target = useScheduledStore
        .getState()
        .scheduled.find((m) => m.contextId === contextId && m.id === id);
      if (target) await addScheduledToIdb(target);
    })();
  },

  clearAll: () => {
    set({ scheduled: [] });
    void clearAllScheduledFromIdb();
  },
}));
