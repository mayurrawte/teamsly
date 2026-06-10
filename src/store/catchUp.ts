"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type CatchUpWindow = "24h" | "3d" | "7d";
export type CatchUpTab = "digest" | "actions";

interface CatchUpStore {
  open: boolean;
  window: CatchUpWindow;
  tab: CatchUpTab;
  setOpen: (v: boolean) => void;
  setWindow: (w: CatchUpWindow) => void;
  setTab: (t: CatchUpTab) => void;
}

export const useCatchUpStore = create<CatchUpStore>()(
  persist(
    (set) => ({
      open: false,
      window: "24h",
      tab: "digest",
      setOpen: (open) => set({ open }),
      setWindow: (window) => set({ window }),
      setTab: (tab) => set({ tab }),
    }),
    {
      name: "teamsly:catchup",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? localStorage : (undefined as unknown as Storage)
      ),
      partialize: (state) => ({ window: state.window, tab: state.tab }),
    }
  )
);
