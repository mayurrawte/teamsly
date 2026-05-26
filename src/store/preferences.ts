"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type Density = "comfortable" | "compact" | "cozy";
export type ColorMode = "light" | "dark" | "system";
export type AccentTheme = "slate" | "ocean" | "forest" | "ember" | "graphite" | "mist" | "plum" | "sand" | "custom";
export type FontFamily = "plex" | "inter" | "atkinson" | "jetbrains" | "lora";
export type FontScale = "sm" | "md" | "lg";
export type SoundTheme = "off" | "subtle" | "playful";
/**
 * Palette is the *background + neutrals* dimension of the theme system.
 * Independent from accent (highlight color) and font (typography). Some
 * palettes are mode-locked: midnight → dark only, sepia → light only.
 * The ThemeApplier resolves any conflicts so the user can't end up with
 * "sepia + dark" rendering as a broken hybrid.
 */
export type Palette = "slate" | "midnight" | "sepia" | "forest";

export const PALETTES: Record<Palette, { label: string; description: string; lockedMode: "light" | "dark" | null; swatch: string[] }> = {
  slate:    { label: "Slate",    description: "Calm, professional. Works in light + dark.", lockedMode: null,    swatch: ["#19171d", "#1a1d21", "#222529", "#d1d2d3"] },
  midnight: { label: "Midnight", description: "True-black OLED. Always dark.",              lockedMode: "dark",  swatch: ["#000000", "#060608", "#141416", "#e8e8ea"] },
  sepia:    { label: "Sepia",    description: "Warm cream. Easier on the eyes.",            lockedMode: "light", swatch: ["#e8dec7", "#efe8d4", "#f5efe2", "#3d2c20"] },
  forest:   { label: "Forest",   description: "Low-saturation greens. Both modes.",         lockedMode: null,    swatch: ["#131816", "#1c241f", "#232c26", "#d8dcd6"] },
};

export const DENSITY_LABELS: Record<Density, { label: string; hint: string }> = {
  comfortable: { label: "Comfortable", hint: "Spacious — Slack-feeling. Default." },
  compact:     { label: "Compact",     hint: "Tighter rows, smaller avatars — Linear/Discord-feeling." },
  cozy:        { label: "Cozy",        hint: "Generous padding, larger text — Notion-feeling." },
};

export const ACCENT_THEMES: Record<Exclude<AccentTheme, "custom">, { label: string; hex: string }> = {
  slate:    { label: "Slate",    hex: "#0F5A8F" },
  ocean:    { label: "Ocean",    hex: "#0B7BA8" },
  forest:   { label: "Forest",   hex: "#2D6A4F" },
  ember:    { label: "Ember",    hex: "#C1521F" },
  graphite: { label: "Graphite", hex: "#424B54" },
  mist:     { label: "Mist",     hex: "#7B8FA3" },
  plum:     { label: "Plum",     hex: "#7C3AED" },
  sand:     { label: "Sand",     hex: "#B45309" },
};

export const FONT_OPTIONS: Record<FontFamily, { label: string; cssVar: string; preview: string }> = {
  plex:      { label: "IBM Plex Sans",        cssVar: "var(--font-plex)",      preview: "Clean, technical default" },
  inter:     { label: "Inter",                cssVar: "var(--font-inter)",     preview: "Crisp UI workhorse" },
  atkinson:  { label: "Atkinson Hyperlegible", cssVar: "var(--font-atkinson)", preview: "Designed for legibility" },
  jetbrains: { label: "JetBrains Mono",       cssVar: "var(--font-jetbrains)", preview: "Monospace, for keyboard people" },
  lora:      { label: "Lora",                 cssVar: "var(--font-lora)",      preview: "Warm, reading-friendly serif" },
};

export const FONT_SCALES: Record<FontScale, { label: string; multiplier: number }> = {
  sm: { label: "Small",  multiplier: 0.92 },
  md: { label: "Medium", multiplier: 1 },
  lg: { label: "Large",  multiplier: 1.1 },
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
  /** Background + neutrals choice. Orthogonal to accent. Some palettes
   *  force a specific color mode (see PALETTES.lockedMode). */
  palette: Palette;
  accent: AccentTheme;
  /** Required when accent === 'custom'. Hex like '#aabbcc'. Ignored otherwise. */
  customAccentHex: string;
  font: FontFamily;
  fontScale: FontScale;
  soundTheme: SoundTheme;
  /** 0..100, applied to the notification tone. */
  soundVolume: number;
  darkInFocusMode: boolean;
  /** Activity hub: when true, filter the feed to items with active unread state. */
  activityUnreadOnly: boolean;
  /** Show a heuristic typing indicator when another user sent a message in the last 30 s. */
  typingIndicator: boolean;
  autoStatusEnabled: boolean;
  autoStatusLastSetSignature: string | null;
  manualStatusOverrideUntil: number | null;
  /** Whole-app focus mode — hides activity/member/file panels + dims unread badges
   *  unless they're @-mentions. Toggled by Cmd+Shift+F. */
  focusMode: boolean;
  /** Per-context snooze. expiresAt is epoch ms. Cleared lazily on read. */
  snoozedContexts: Record<string, number>;
  /** Top emoji shortcuts surfaced by quick-react number keys (1-9 over hovered message). */
  quickReactEmojis: string[];
  /** User-defined slash commands → expansion text. e.g. /omw → "On my way!" */
  customSlashCommands: Record<string, string>;
  /** Daily 'morning brief' notification — fires once per local day at briefTime
   *  with a /tldr digest. Opt-in. */
  morningBriefEnabled: boolean;
  /** HH:MM local time. */
  morningBriefTime: string;
  /** Last day (YYYY-MM-DD) the boot nudge was shown. Used so each tip
   *  appears at most once per local day. */
  lastNudgeDay: string | null;
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
  setPalette: (p: Palette) => void;
  setAccent: (a: AccentTheme) => void;
  setCustomAccentHex: (hex: string) => void;
  setFont: (f: FontFamily) => void;
  setFontScale: (s: FontScale) => void;
  setSoundTheme: (t: SoundTheme) => void;
  setSoundVolume: (v: number) => void;
  setDarkInFocusMode: (v: boolean) => void;
  setActivityUnreadOnly: (v: boolean) => void;
  setTypingIndicator: (v: boolean) => void;
  setAutoStatusEnabled: (v: boolean) => void;
  setAutoStatusSignature: (sig: string | null) => void;
  setManualOverrideUntil: (ts: number | null) => void;
  setFocusMode: (v: boolean) => void;
  toggleFocusMode: () => void;
  snoozeContext: (contextId: string, expiresAt: number) => void;
  unsnoozeContext: (contextId: string) => void;
  setQuickReactEmojis: (emojis: string[]) => void;
  setCustomSlashCommand: (trigger: string, expansion: string) => void;
  removeCustomSlashCommand: (trigger: string) => void;
  setMorningBriefEnabled: (v: boolean) => void;
  setMorningBriefTime: (t: string) => void;
  setLastNudgeDay: (day: string | null) => void;
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
  palette: "slate",
  accent: "slate",
  customAccentHex: "#6366F1",
  font: "plex",
  fontScale: "md",
  soundTheme: "subtle",
  soundVolume: 60,
  darkInFocusMode: false,
  activityUnreadOnly: true,
  typingIndicator: false,
  autoStatusEnabled: false,
  autoStatusLastSetSignature: null,
  manualStatusOverrideUntil: null,
  focusMode: false,
  snoozedContexts: {},
  // Display labels for the 6 number-key slots. The actual reaction sent to
  // Graph is fixed (one of REACTION_TYPES) — slot N maps to REACTION_TYPES[N-1].
  quickReactEmojis: ["👍", "❤️", "😂", "😮", "😢", "😡"],
  customSlashCommands: {},
  morningBriefEnabled: false,
  morningBriefTime: "09:00",
  lastNudgeDay: null,
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
      setPalette: (palette) => set({ palette }),
      setAccent: (accent) => set({ accent }),
      setCustomAccentHex: (customAccentHex) => set({ customAccentHex }),
      setFont: (font) => set({ font }),
      setFontScale: (fontScale) => set({ fontScale }),
      setSoundTheme: (soundTheme) => set({ soundTheme }),
      setSoundVolume: (soundVolume) => set({ soundVolume: Math.max(0, Math.min(100, soundVolume)) }),
      setDarkInFocusMode: (darkInFocusMode) => set({ darkInFocusMode }),
      setActivityUnreadOnly: (activityUnreadOnly) => set({ activityUnreadOnly }),
      setTypingIndicator: (typingIndicator) => set({ typingIndicator }),
      setAutoStatusEnabled: (autoStatusEnabled) => set({ autoStatusEnabled }),
      setAutoStatusSignature: (autoStatusLastSetSignature) => set({ autoStatusLastSetSignature }),
      setManualOverrideUntil: (manualStatusOverrideUntil) => set({ manualStatusOverrideUntil }),
      setFocusMode: (focusMode) => set({ focusMode }),
      toggleFocusMode: () => set((s) => ({ focusMode: !s.focusMode })),
      snoozeContext: (contextId, expiresAt) =>
        set((s) => ({ snoozedContexts: { ...s.snoozedContexts, [contextId]: expiresAt } })),
      unsnoozeContext: (contextId) =>
        set((s) => {
          const next = { ...s.snoozedContexts };
          delete next[contextId];
          return { snoozedContexts: next };
        }),
      setQuickReactEmojis: (quickReactEmojis) => set({ quickReactEmojis: quickReactEmojis.slice(0, 9) }),
      setCustomSlashCommand: (trigger, expansion) =>
        set((s) => ({
          customSlashCommands: { ...s.customSlashCommands, [trigger.replace(/^\//, "").toLowerCase()]: expansion },
        })),
      removeCustomSlashCommand: (trigger) =>
        set((s) => {
          const key = trigger.replace(/^\//, "").toLowerCase();
          const next = { ...s.customSlashCommands };
          delete next[key];
          return { customSlashCommands: next };
        }),
      setMorningBriefEnabled: (morningBriefEnabled) => set({ morningBriefEnabled }),
      setMorningBriefTime: (morningBriefTime) => set({ morningBriefTime }),
      setLastNudgeDay: (lastNudgeDay) => set({ lastNudgeDay }),
      reset: () => set(DEFAULTS),
    }),
    {
      name: "teamsly:prefs",
      // v2 (2026-05-26): adds font/fontScale/customAccentHex/soundTheme/soundVolume,
      // focusMode, snoozedContexts, quickReactEmojis, customSlashCommands,
      // morningBrief*, lastNudgeDay.
      // v3 (2026-05-26 later): adds palette field, extends density to 3 values
      // (comfortable | compact | cozy). Zustand's persist default merge grafts
      // new fields from in-code DEFAULTS, so no explicit migrate is required;
      // existing `density: "comfortable" | "compact"` values remain valid under
      // the wider union.
      version: 3,
      storage: createJSONStorage(() => (typeof window !== "undefined" ? localStorage : undefined as unknown as Storage)),
    },
  ),
);

/** True if a custom hex is valid; lenient — accepts #abc or #aabbcc. */
export function isValidHex(input: string): boolean {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(input.trim());
}

/** Returns the effective hex for the current accent. Custom validates;
 *  falls back to slate if the custom hex is junk. */
export function resolveAccentHex(accent: AccentTheme, customHex: string): string {
  if (accent === "custom") {
    return isValidHex(customHex) ? customHex : ACCENT_THEMES.slate.hex;
  }
  return ACCENT_THEMES[accent].hex;
}
