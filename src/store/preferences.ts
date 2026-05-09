"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type Density = "comfortable" | "compact";

export interface Preferences {
  density: Density;
  desktopNotifications: boolean;
  notificationSound: boolean;
  mentionsOnly: boolean;
  notificationKeywords: string;
}

interface PreferencesState extends Preferences {
  setDensity: (d: Density) => void;
  setDesktopNotifications: (v: boolean) => void;
  setNotificationSound: (v: boolean) => void;
  setMentionsOnly: (v: boolean) => void;
  setNotificationKeywords: (v: string) => void;
  reset: () => void;
}

const DEFAULTS: Preferences = {
  density: "comfortable",
  desktopNotifications: true,
  notificationSound: true,
  mentionsOnly: false,
  notificationKeywords: "",
};

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      setDensity: (density) => set({ density }),
      setDesktopNotifications: (desktopNotifications) => set({ desktopNotifications }),
      setNotificationSound: (notificationSound) => set({ notificationSound }),
      setMentionsOnly: (mentionsOnly) => set({ mentionsOnly }),
      setNotificationKeywords: (notificationKeywords) => set({ notificationKeywords }),
      reset: () => set(DEFAULTS),
    }),
    {
      name: "teamsly:prefs",
      storage: createJSONStorage(() => (typeof window !== "undefined" ? localStorage : undefined as unknown as Storage)),
    },
  ),
);
