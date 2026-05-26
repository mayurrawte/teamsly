"use client";

/**
 * Side-effect-only component that reflects the user's preferences onto the
 * documentElement as inline CSS custom properties:
 *
 *   --font-sans   ← the active Google Font (Plex / Inter / Atkinson / JetBrains / Lora)
 *   --font-scale  ← reading-zoom multiplier (0.92 / 1 / 1.1)
 *   --accent      ← active accent color (preset or custom hex)
 *
 * Why inline-style on documentElement instead of body className: it composes
 * with the persisted hydration without flashing the wrong font/color before
 * the store rehydrates, and it works regardless of whether the user is on
 * the marketing page (no Sidebar) or the workspace (full shell).
 *
 * Also wires the color-mode preference to the `data-theme` attribute that
 * globals.css's light-theme block keys off of.
 */

import { useEffect } from "react";
import {
  FONT_OPTIONS,
  FONT_SCALES,
  resolveAccentHex,
  usePreferencesStore,
} from "@/store/preferences";

export function ThemeApplier() {
  const font = usePreferencesStore((s) => s.font);
  const fontScale = usePreferencesStore((s) => s.fontScale);
  const colorMode = usePreferencesStore((s) => s.colorMode);
  const accent = usePreferencesStore((s) => s.accent);
  const customAccentHex = usePreferencesStore((s) => s.customAccentHex);
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
    // Lighter alpha tint for selected backgrounds, derived from the accent
    // hex; keeps the 'subtle accent surface' affordance consistent.
    root.style.setProperty("--accent-light", `${hex}26`);

    // Color mode — light variant lives behind [data-theme="light"] in globals.css.
    // When focus mode is on and the user asked to force dark, keep dark even
    // if their global preference is light.
    let effectiveMode: "light" | "dark" = "dark";
    if (focusMode && darkInFocusMode) {
      effectiveMode = "dark";
    } else if (colorMode === "system") {
      effectiveMode =
        window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches
          ? "light"
          : "dark";
    } else {
      effectiveMode = colorMode;
    }

    // globals.css keys color overrides off [data-color-mode="light|dark"].
    root.setAttribute("data-color-mode", effectiveMode);

    // Focus mode is exposed as a body class so components can hide secondary
    // chrome via Tailwind's `[body.focus-mode_&]:hidden` arbitrary selectors
    // without each one wiring its own subscription to the store.
    if (focusMode) {
      document.body.classList.add("focus-mode");
    } else {
      document.body.classList.remove("focus-mode");
    }
  }, [font, fontScale, colorMode, accent, customAccentHex, focusMode, darkInFocusMode]);

  return null;
}
