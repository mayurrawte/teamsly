/**
 * Teamsly logomark — chat-bubble outline with terminal >_ glyph and branch-node flourish.
 *
 * Design:
 *  - A rounded-rectangle speech bubble (stroke only) with a small triangular tail at the
 *    bottom-left corner.
 *  - Inside the bubble: a CLI prompt rendered as a chevron ">" followed by an underscore "_",
 *    both stroke-only at the same weight as the bubble outline.
 *  - Outside the bubble at the top-left: a small branch-node motif — two filled circles
 *    connected by a thin angled line, evoking a git graph / node edge.
 *  - All drawn in a 24×24 viewBox with stroke-width ~2. Uses `currentColor` so the consumer
 *    controls colour via CSS. Standalone default colour is #2E2A6F (deep indigo).
 */

import React from "react";

export interface LogoProps {
  /** Rendered width and height in px. Default: 32 */
  size?: number;
  className?: string;
  /** Accessible label. Default: "Teamsly" */
  title?: string;
}

export function Logo({ size = 32, className, title = "Teamsly" }: LogoProps) {
  const id = React.useId();
  const titleId = `logo-title-${id}`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-labelledby={titleId}
      role="img"
      className={className}
    >
      <title id={titleId}>{title}</title>

      {/* ── Speech bubble (rounded rect body) ── */}
      {/*
        Bubble occupies roughly x 4-22, y 5-18 with rx=3.
        Tail: a small triangular notch pointing down-left at the bottom-left corner.
        We draw the whole outline as a single <path> so the tail merges seamlessly.

        Path walkthrough (clockwise from bottom-left tail tip):
          Start at tail tip (3, 21)
          → line to where tail meets bubble bottom edge (4, 18)
          → along bottom edge rightward to (19, 18)
          → arc to (22, 15)  [bottom-right corner, rx=3]
          → up right edge to (22, 8)
          → arc to (19, 5)   [top-right corner, rx=3]
          → along top edge leftward to (7, 5)
          → arc to (4, 8)    [top-left corner, rx=3]
          → down left edge to (4, 18) tail re-entry … but we already placed the tail
          So we close cleanly: down to (4, 18) then diagonal back to (3, 21) Z.
      */}
      <path
        d="M3 21 L4 18 L4 8 A3 3 0 0 1 7 5 L19 5 A3 3 0 0 1 22 8 L22 15 A3 3 0 0 1 19 18 L6 18 Z"
        fill="none"
      />

      {/* ── Terminal prompt: chevron > ── */}
      {/*
        ">" drawn as two short strokes meeting at a point, centred around x=10, y=12.
        Left tip at (8.5, 10.5), apex at (10.5, 12), bottom-left at (8.5, 13.5).
      */}
      <polyline points="8.5,10.5 10.5,12 8.5,13.5" fill="none" strokeWidth="1.8" />

      {/* ── Terminal prompt: underscore _ ── */}
      {/*
        A short horizontal stroke at y=13.5 (baseline), from x=12 to x=15.5.
      */}
      <line x1="12" y1="13.5" x2="15.5" y2="13.5" strokeWidth="1.8" />

      {/* ── Branch-node motif (top-left, outside bubble) ── */}
      {/*
        Two small filled circles connected by a thin line.
        Lower node sits just outside the bubble corner at (3.5, 6.5).
        Upper node is up-right at (1.5, 4).
        The connector line runs between their centres.
        Circles use fill="currentColor" and no stroke to read as solid nodes.
      */}
      <line
        x1="1.5"
        y1="4"
        x2="3.5"
        y2="6.5"
        strokeWidth="1.2"
        stroke="currentColor"
      />
      <circle cx="1.5" cy="4" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="3.5" cy="6.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * The full wordmark: Teamsly logo icon followed by the brand name in IBM Plex Sans.
 */
export interface LogoWithWordmarkProps extends LogoProps {
  /** Font size for the wordmark text. Defaults to ~1.1× the icon size. */
  textSize?: number | string;
}

export function LogoWithWordmark({
  size = 32,
  className,
  title = "Teamsly",
  textSize,
}: LogoWithWordmarkProps) {
  const resolvedTextSize = textSize ?? Math.round(size * 0.55);

  return (
    <span
      className={`inline-flex items-center gap-2 font-sans${className ? ` ${className}` : ""}`}
      aria-label={title}
    >
      <Logo size={size} title={title} aria-hidden="true" />
      <span
        style={{
          fontSize: typeof resolvedTextSize === "number" ? `${resolvedTextSize}px` : resolvedTextSize,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          lineHeight: 1,
        }}
      >
        {title}
      </span>
    </span>
  );
}
