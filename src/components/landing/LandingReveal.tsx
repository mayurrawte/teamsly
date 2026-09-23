"use client";

import { useSyncExternalStore } from "react";
import { useRevealOnScroll } from "@/hooks/useRevealOnScroll";

/**
 * Client wrapper that scroll-reveals its children while keeping the landing
 * page server-rendered and crawler-safe.
 *
 * The hidden state (`.reveal-on-scroll`, opacity:0) is the whole reason this
 * has to be careful: if it shipped in the server HTML, a crawler or a
 * JS-disabled visitor would see nothing. So we gate it on `armed`, which is
 * false on the server and during the first client render (matching the server
 * markup, no hydration mismatch) and only flips true once hydrated. From
 * that point IntersectionObserver takes over and adds `.revealed` on scroll.
 *
 * Net effect: server HTML has neither class → text is fully visible without
 * JS; the fade-in only exists once JS has run.
 */
const noopSubscribe = () => () => {};

export function LandingReveal({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { ref, revealed } = useRevealOnScroll<HTMLDivElement>();
  const armed = useSyncExternalStore(noopSubscribe, () => true, () => false);

  const classes = [armed && "reveal-on-scroll", revealed && "revealed", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={ref} className={classes}>
      {children}
    </div>
  );
}
