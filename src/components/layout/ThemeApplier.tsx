"use client";

/**
 * Side-effect-only component that reflects the user's preferences onto the
 * documentElement as inline CSS custom properties + data-attributes:
 *
 *   --font-sans       ← active Google Font CSS-var pointer
 *   --font-scale      ← 0.92 / 1 / 1.1 reading-zoom multiplier
 *   --accent          ← active accent color (preset or custom hex)
 *   --accent-light    ← derived 15%-alpha tint of the accent
 *
 *   data-color-mode   ← "light" | "dark" — drives the globals.css light block
 *   data-palette      ← "slate" | "midnight" | "sepia" | "forest" — palette overlay
 *   data-density      ← "comfortable" | "compact" | "cozy" — drives density vars
 *
 *   body.focus-mode   ← class toggled by Cmd+Shift+F. Components opt into
 *                       hiding chrome via the `.focus-mode-hide` utility.
 *
 * Palette / color-mode interaction: some palettes are mode-locked (midnight
 * is always dark, sepia is always light). When the user picks one, the
 * effective color-mode is overridden to match — preserves the user's
 * preferred mode for other palettes (slate, forest) but keeps mode-locked
 * palettes from rendering as broken hybrids.
 */

import { useEffect } from "react";
import {
  FONT_OPTIONS,
  FONT_SCALES,
  PALETTES,
  resolveAccentHex,
  usePreferencesStore,
} from "@/store/preferences";

export function ThemeApplier() {
  const font = usePreferencesStore((s) => s.font);
  const fontScale = usePreferencesStore((s) => s.fontScale);
  const colorMode = usePreferencesStore((s) => s.colorMode);
  const palette = usePreferencesStore((s) => s.palette);
  const accent = usePreferencesStore((s) => s.accent);
  const customAccentHex = usePreferencesStore((s) => s.customAccentHex);
  const density = usePreferencesStore((s) => s.density);
  const focusMode = usePreferencesStore((s) => s.focusMode);
  const darkInFocusMode = usePreferencesStore((s) => s.darkInFocusMode);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;

    // Font family — fall back to plex when an unknown value somehow lands.
    const fontVar = FONT_OPTIONS[font]?.cssVar ?? FONT_OPTIONS.plex.cssVar;
    root.style.setProperty("--font-sans", fontVar);

    // Font scale — applied by components that use clamp(... * var(--font-scale)).
    const scale = FONT_SCALES[fontScale]?.multiplier ?? 1;
    root.style.setProperty("--font-scale", String(scale));

    // Accent — preset or custom hex. resolveAccentHex hardens the custom path.
    const hex = resolveAccentHex(accent, customAccentHex);
    root.style.setProperty("--accent", hex);
    root.style.setProperty("--accent-light", `${hex}26`);

    // Color mode. The user's pref is the baseline, but:
    //   - if the active palette is mode-locked, force its mode
    //   - if focus mode is on and the user asked to force dark, use dark
    let effectiveMode: "light" | "dark";
    const locked = PALETTES[palette]?.lockedMode ?? null;
    if (locked) {
      effectiveMode = locked;
    } else if (focusMode && darkInFocusMode) {
      effectiveMode = "dark";
    } else if (colorMode === "system") {
      effectiveMode =
        window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches
          ? "light"
          : "dark";
    } else {
      effectiveMode = colorMode;
    }

    root.setAttribute("data-color-mode", effectiveMode);
    root.setAttribute("data-palette", palette);
    root.setAttribute("data-density", density);

    if (focusMode) {
      document.body.classList.add("focus-mode");
    } else {
      document.body.classList.remove("focus-mode");
    }
  }, [font, fontScale, colorMode, palette, accent, customAccentHex, density, focusMode, darkInFocusMode]);

  return null;
}
