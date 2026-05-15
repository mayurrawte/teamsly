import { create } from "zustand";
import {
  clearAll as clearAllDraftsFromIdb,
  clearDraft as clearDraftFromIdb,
  loadAllDrafts,
  saveDraft as saveDraftToIdb,
} from "@/lib/storage/drafts";

// Cap each draft body at 16 KB. Past this the user probably pasted a novel
// and we have no business persisting it. Mirrored in `saveDraft` in
// `lib/storage/drafts.ts` — kept on both sides so the in-memory store
// doesn't balloon either.
const MAX_DRAFT_BYTES = 16 * 1024;

interface DraftsState {
  drafts: Record<string, string>;
  /**
   * Best-effort prefill from IndexedDB. Called once on AppShell mount,
   * mirroring `hydrateMessageCache`. Existing in-memory drafts take
   * precedence so a draft typed before hydration completes isn't clobbered.
   */
  hydrate: () => Promise<void>;
  /**
   * Persist a single context's draft. Fire-and-forget IDB write — the
   * in-memory store is the source of truth, IDB is best-effort.
   */
  setDraft: (contextId: string, text: string) => void;
  /**
   * Drop a single context's draft. Called by `MessageInput` after a
   * successful send so the draft doesn't reappear next time.
   */
  clearDraft: (contextId: string) => void;
  /**
   * Wipe every draft. Called on sign-out so a previous user's unsent
   * messages don't leak to the next sign-in on the same device.
   */
  clearAll: () => void;
}

export const useDraftsStore = create<DraftsState>((set) => ({
  drafts: {},

  hydrate: async () => {
    const fromIdb = await loadAllDrafts();
    set((s) => {
      // Merge: anything already typed in-session wins over IDB. Same
      // pattern as workspace.ts:hydrateMessageCache.
      const merged: Record<string, string> = { ...fromIdb };
      for (const [k, v] of Object.entries(s.drafts)) {
        merged[k] = v;
      }
      return { drafts: merged };
    });
  },

  setDraft: (contextId, text) => {
    const trimmed = text.length > MAX_DRAFT_BYTES ? text.slice(0, MAX_DRAFT_BYTES) : text;
    set((s) => {
      // If the draft is now empty, drop the key entirely so the IDB
      // delete and the in-memory state stay in sync.
      if (trimmed.length === 0) {
        if (!(contextId in s.drafts)) return s;
        const next = { ...s.drafts };
        delete next[contextId];
        return { drafts: next };
      }
      if (s.drafts[contextId] === trimmed) return s;
      return { drafts: { ...s.drafts, [contextId]: trimmed } };
    });
    // Fire-and-forget IDB write/delete.
    if (trimmed.length === 0) {
      void clearDraftFromIdb(contextId);
    } else {
      void saveDraftToIdb(contextId, trimmed);
    }
  },

  clearDraft: (contextId) => {
    set((s) => {
      if (!(contextId in s.drafts)) return s;
      const next = { ...s.drafts };
      delete next[contextId];
      return { drafts: next };
    });
    void clearDraftFromIdb(contextId);
  },

  clearAll: () => {
    set({ drafts: {} });
    void clearAllDraftsFromIdb();
  },
}));
