"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { usePreferencesStore } from "@/store/preferences";

// Deterministic particle set — no Math.random / Date.now, so a given index
// always drifts the same way (keeps the effect reproducible + test-friendly).
const PARTICLE_COUNT = 24;
// Existing app hues only. NO Slack-palette values (see BRAND.md).
const COLORS = ["var(--accent)", "#f0b429", "#57bb8a", "#cd5b45", "#818CF8"];
// Fallback teardown, slightly above --motion-slower (480ms), so the overlay
// never lingers if onAnimationEnd doesn't fire for every particle (e.g. the
// var is zeroed under reduced motion, or a particle unmounts mid-flight).
const TEARDOWN_MS = 600;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

interface Props {
  /** Plays a burst once per distinct, non-empty value seen during this mount. */
  playKey?: string;
}

/**
 * Confetti overlay for "earned" celebration moments. Renders nothing unless a
 * fresh (unseen this mount) non-empty `playKey` arrives AND the user's
 * celebrationEffects preference is on. The overlay is pointer-events-none and
 * absolutely positioned, so it never affects feed layout or scroll behavior.
 */
export function CelebrationBurst({ playKey }: Props) {
  const celebrationEffects = usePreferencesStore((s) => s.celebrationEffects);
  const [currentKey, setCurrentKey] = useState<string | null>(null);
  // The keyframes live only under (prefers-reduced-motion: no-preference), so
  // under reduced motion the particles would render statically instead of
  // animating. Bail out entirely so reduced-motion users see nothing at all.
  const [reducedMotion, setReducedMotion] = useState(prefersReducedMotion);
  const seenRef = useRef<Set<string>>(new Set());
  const endedRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Start a burst only for a non-empty key we haven't played this mount.
  useEffect(() => {
    if (!playKey) return;
    if (seenRef.current.has(playKey)) return;
    seenRef.current.add(playKey);
    setCurrentKey(playKey);
  }, [playKey]);

  // Reset the animation-end counter and arm a teardown fallback for each burst.
  // A new distinct key that arrives mid-burst re-runs this effect (and remounts
  // the particles via the wrapper key below), so the burst replays cleanly.
  useEffect(() => {
    if (!currentKey) return;
    endedRef.current = 0;
    const t = window.setTimeout(() => setCurrentKey(null), TEARDOWN_MS);
    return () => window.clearTimeout(t);
  }, [currentKey]);

  if (!celebrationEffects) return null;
  if (reducedMotion) return null;
  if (!currentKey) return null;

  const handleAnimationEnd = () => {
    endedRef.current += 1;
    if (endedRef.current >= PARTICLE_COUNT) setCurrentKey(null);
  };

  return (
    <div
      key={currentKey}
      className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
      aria-hidden="true"
    >
      {Array.from({ length: PARTICLE_COUNT }, (_, i) => {
        const x = (i % 8 - 3.5) * 28;
        const y = 120 + (i % 5) * 40;
        const r = (i % 2 ? 1 : -1) * (180 + i * 20);
        const color = COLORS[i % COLORS.length];
        const style = {
          backgroundColor: color,
          // Deterministic per-index drift consumed by the confetti-fall
          // keyframes in globals.css.
          "--cf-x": `${x}px`,
          "--cf-y": `${y}px`,
          "--cf-r": `${r}deg`,
        } as CSSProperties;
        return (
          <span
            key={i}
            className="confetti-particle absolute left-1/2 top-1/3 h-[10px] w-[6px] rounded-[2px]"
            style={style}
            onAnimationEnd={handleAnimationEnd}
          />
        );
      })}
    </div>
  );
}
