"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type CatchUpWindow = "24h" | "3d" | "7d";

interface CatchUpStore {
  open: boolean;
  window: CatchUpWindow;
  setOpen: (v: boolean) => void;
  setWindow: (w: CatchUpWindow) => void;
}

export const useCatchUpStore = create<CatchUpStore>()(
  persist(
    (set) => ({
      open: false,
      window: "24h",
      setOpen: (open) => set({ open }),
      setWindow: (window) => set({ window }),
    }),
    {
      name: "teamsly:catchup",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? localStorage : (undefined as unknown as Storage)
      ),
      partialize: (state) => ({ window: state.window }),
    }
  )
);
