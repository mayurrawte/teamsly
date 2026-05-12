"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type Density = "comfortable" | "compact";
export type ColorMode = "light" | "dark" | "system";
export type AccentTheme = "slate" | "ocean" | "forest" | "ember" | "graphite" | "mist";

export const ACCENT_THEMES: Record<AccentTheme, { label: string; hex: string }> = {
  slate:    { label: "Slate",    hex: "#0F5A8F" },
  ocean:    { label: "Ocean",    hex: "#0B7BA8" },
  forest:   { label: "Forest",   hex: "#2D6A4F" },
  ember:    { label: "Ember",    hex: "#C1521F" },
  graphite: { label: "Graphite", hex: "#424B54" },
  mist:     { label: "Mist",     hex: "#7B8FA3" },
};

export interface Preferences {
  density: Density;
  desktopNotifications: boolean;
  notificationSound: boolean;
  mentionsOnly: boolean;
  notificationKeywords: string;
  colorMode: ColorMode;
  accent: AccentTheme;
  darkInFocusMode: boolean;
}

interface PreferencesState extends Preferences {
  setDensity: (d: Density) => void;
  setDesktopNotifications: (v: boolean) => void;
  setNotificationSound: (v: boolean) => void;
  setMentionsOnly: (v: boolean) => void;
  setNotificationKeywords: (v: string) => void;
  setColorMode: (m: ColorMode) => void;
  setAccent: (a: AccentTheme) => void;
  setDarkInFocusMode: (v: boolean) => void;
  reset: () => void;
}

const DEFAULTS: Preferences = {
  density: "comfortable",
  desktopNotifications: true,
  notificationSound: true,
  mentionsOnly: false,
  notificationKeywords: "",
  colorMode: "dark",
  accent: "slate",
  darkInFocusMode: false,
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
      setColorMode: (colorMode) => set({ colorMode }),
      setAccent: (accent) => set({ accent }),
      setDarkInFocusMode: (darkInFocusMode) => set({ darkInFocusMode }),
      reset: () => set(DEFAULTS),
    }),
    {
      name: "teamsly:prefs",
      storage: createJSONStorage(() => (typeof window !== "undefined" ? localStorage : undefined as unknown as Storage)),
    },
  ),
);
