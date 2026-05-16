"use client";

import { create } from "zustand";

interface SearchState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export const useSearchStore = create<SearchState>()((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
