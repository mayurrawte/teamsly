import React from "react";

export interface LogoProps {
  /** Rendered width and height in px. Default: 32 */
  size?: number;
  className?: string;
  /** Accessible label. Default: "Teamsly" */
  title?: string;
}

/**
 * Teamsly logomark — git-branch graph with four nodes.
 * Three branch nodes (left, right, bottom) connect to a central hub node,
 * evoking open-source collaboration and the Teams graph topology.
 * Colors use Teamsly's blue palette + Microsoft Teams purple (#5B5FC7).
 */
export function Logo({ size = 32, className, title = "Teamsly" }: LogoProps) {
  const id = React.useId();
  const titleId = `logo-title-${id}`;
  const gLeft = `logo-gl-${id}`;
  const gRight = `logo-gr-${id}`;
  const gBottom = `logo-gb-${id}`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-labelledby={titleId}
      role="img"
      className={className}
    >
      <title id={titleId}>{title}</title>
      <defs>
        <linearGradient id={gLeft} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#818CF8" />
        </linearGradient>
        <linearGradient id={gRight} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#818CF8" />
          <stop offset="100%" stopColor="#22D3EE" />
        </linearGradient>
        <linearGradient id={gBottom} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#818CF8" />
          <stop offset="100%" stopColor="#38BDF8" />
        </linearGradient>
      </defs>

      {/* Branch lines */}
      <line x1="4.8" y1="5.7" x2="12" y2="5.7" stroke={`url(#${gLeft})`} strokeWidth="2.2" strokeLinecap="round" />
      <line x1="12" y1="5.7" x2="19.2" y2="5.7" stroke={`url(#${gRight})`} strokeWidth="2.2" strokeLinecap="round" />
      <line x1="12" y1="18.3" x2="12" y2="5.7" stroke={`url(#${gBottom})`} strokeWidth="2.2" strokeLinecap="round" />

      {/* Outer nodes */}
      <circle cx="4.8" cy="5.7" r="2" fill="#38BDF8" />
      <circle cx="19.2" cy="5.7" r="2" fill="#22D3EE" />
      <circle cx="12" cy="18.3" r="2" fill="#38BDF8" />

      {/* Central hub node */}
      <circle cx="12" cy="5.7" r="2.6" fill="#818CF8" />
    </svg>
  );
}

export interface LogoWithWordmarkProps extends LogoProps {
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
