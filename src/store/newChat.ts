"use client";

import { create } from "zustand";

interface NewChatState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export const useNewChatStore = create<NewChatState>()((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
