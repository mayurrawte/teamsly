"use client";

import { useEffect } from "react";
import { usePreferencesStore, ACCENT_THEMES, type ColorMode } from "@/store/preferences";

/** Resolves "system" to the actual OS preference. */
function resolveMode(mode: ColorMode): "light" | "dark" {
  if (mode !== "system") return mode;
  if (typeof window !== "undefined") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "dark";
}

function applyTheme(mode: ColorMode, accent: string) {
  const root = document.documentElement;
  root.setAttribute("data-color-mode", resolveMode(mode));
  root.style.setProperty("--accent", accent);
  // Also update hover/light variants derived from the same accent
  // (simple approach: rely on components using --accent directly)
}

/**
 * ThemeSync — a zero-render client component that watches preference changes
 * and applies them to document.documentElement.
 * Mount once in the app shell or Providers.
 */
export function ThemeSync() {
  const colorMode = usePreferencesStore((s) => s.colorMode);
  const accent = usePreferencesStore((s) => s.accent);

  useEffect(() => {
    applyTheme(colorMode, ACCENT_THEMES[accent].hex);

    // For "system" mode, also listen to OS changes
    if (colorMode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system", ACCENT_THEMES[accent].hex);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [colorMode, accent]);

  return null;
}
