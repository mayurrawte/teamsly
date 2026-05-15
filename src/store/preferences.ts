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
  /**
   * Negative keyword list. If a message body contains any of these
   * substrings (case-insensitive), notifications are suppressed. Mute
   * wins over the positive keywordAlerts list. Not Pro-gated.
   */
  mutedKeywords: string[];
  /** Suppress notifications inside a recurring time window (wraps overnight). */
  quietHoursEnabled: boolean;
  /** HH:MM 24-hour. */
  quietHoursStart: string;
  /** HH:MM 24-hour. Wraps around midnight when start > end (e.g. 22:00 → 08:00). */
  quietHoursEnd: string;
  colorMode: ColorMode;
  accent: AccentTheme;
  darkInFocusMode: boolean;
  /** Activity hub: when true, filter the feed to items with active unread state. */
  activityUnreadOnly: boolean;
}

interface PreferencesState extends Preferences {
  setDensity: (d: Density) => void;
  setDesktopNotifications: (v: boolean) => void;
  setNotificationSound: (v: boolean) => void;
  setMentionsOnly: (v: boolean) => void;
  setNotificationKeywords: (v: string) => void;
  setMutedKeywords: (keywords: string[]) => void;
  setQuietHoursEnabled: (v: boolean) => void;
  setQuietHoursStart: (v: string) => void;
  setQuietHoursEnd: (v: string) => void;
  setColorMode: (m: ColorMode) => void;
  setAccent: (a: AccentTheme) => void;
  setDarkInFocusMode: (v: boolean) => void;
  setActivityUnreadOnly: (v: boolean) => void;
  reset: () => void;
}

const DEFAULTS: Preferences = {
  density: "comfortable",
  desktopNotifications: true,
  notificationSound: true,
  mentionsOnly: false,
  notificationKeywords: "",
  mutedKeywords: [],
  quietHoursEnabled: false,
  quietHoursStart: "22:00",
  quietHoursEnd: "08:00",
  colorMode: "dark",
  accent: "slate",
  darkInFocusMode: false,
  activityUnreadOnly: true,
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
      setMutedKeywords: (mutedKeywords) => set({ mutedKeywords }),
      setQuietHoursEnabled: (quietHoursEnabled) => set({ quietHoursEnabled }),
      setQuietHoursStart: (quietHoursStart) => set({ quietHoursStart }),
      setQuietHoursEnd: (quietHoursEnd) => set({ quietHoursEnd }),
      setColorMode: (colorMode) => set({ colorMode }),
      setAccent: (accent) => set({ accent }),
      setDarkInFocusMode: (darkInFocusMode) => set({ darkInFocusMode }),
      setActivityUnreadOnly: (activityUnreadOnly) => set({ activityUnreadOnly }),
      reset: () => set(DEFAULTS),
    }),
    {
      name: "teamsly:prefs",
      // Bumped from implicit 0 to 1 when adding mutedKeywords / quiet hours /
      // activityUnreadOnly. Zustand persist's default merge already grafts
      // missing fields onto the rehydrated state from the in-code DEFAULTS,
      // so no explicit migrate function is needed — listed here so future
      // bumps have a place to plug into.
      version: 1,
      storage: createJSONStorage(() => (typeof window !== "undefined" ? localStorage : undefined as unknown as Storage)),
    },
  ),
);
