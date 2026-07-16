"use client";

import { create } from "zustand";

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  tone?: "error" | "info";
  /**
   * Optional primary action rendered as a button in the toast. Used by
   * reminder toasts to offer a "View message" jump. Selecting it dismisses
   * the toast. Kept out of the auto-dismiss path — the timer still fires.
   */
  action?: { label: string; onClick: () => void };
}

interface ToastState {
  toasts: ToastMessage[];
  showToast: (toast: Omit<ToastMessage, "id">) => void;
  dismissToast: (id: string) => void;
}

// Auto-dismiss timers, keyed by toast id, so a manual dismiss can cancel the
// pending timeout instead of leaving it to fire later as a dangling no-op.
const dismissTimers = new Map<string, ReturnType<typeof setTimeout>>();

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  showToast: (toast) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
    const timer = setTimeout(() => {
      dismissTimers.delete(id);
      set((state) => ({ toasts: state.toasts.filter((item) => item.id !== id) }));
    }, 5000);
    dismissTimers.set(id, timer);
  },
  dismissToast: (id) => {
    const timer = dismissTimers.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      dismissTimers.delete(id);
    }
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }));
  },
}));
