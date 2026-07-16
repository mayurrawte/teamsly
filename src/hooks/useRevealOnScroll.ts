"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Scroll-reveal primitive for the marketing page. Attach `ref` to a container
 * and flip `revealed` to true the first time it is ≥15% visible, then stop
 * observing (the reveal is one-shot).
 *
 * SSR/no-JS note: this hook never touches the DOM on the server, and callers
 * apply the hidden `.reveal-on-scroll` class only AFTER mount (see
 * `LandingReveal`). If IntersectionObserver is unavailable, it reveals
 * immediately so content is never trapped at opacity:0.
 */
export function useRevealOnScroll<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setRevealed(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return { ref, revealed };
}
