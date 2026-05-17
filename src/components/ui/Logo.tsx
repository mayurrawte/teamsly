import React from "react";

export interface LogoProps {
  size?: number;
  className?: string;
  title?: string;
}

export function Logo({ size = 32, className, title = "Teamsly" }: LogoProps) {
  const raw = React.useId();
  const uid = raw.replace(/:/g, "");
  const titleId = `lt-${uid}`;
  const gL = `gl-${uid}`;
  const gR = `gr-${uid}`;
  const gB = `gb-${uid}`;

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
        {/* gradientUnits="userSpaceOnUse" so gradients work on zero-height lines */}
        <linearGradient id={gL} x1="2.5" y1="7" x2="12" y2="7" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#818CF8" />
        </linearGradient>
        <linearGradient id={gR} x1="12" y1="7" x2="21.5" y2="7" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#818CF8" />
          <stop offset="100%" stopColor="#22D3EE" />
        </linearGradient>
        <linearGradient id={gB} x1="12" y1="7" x2="12" y2="21.5" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#818CF8" />
          <stop offset="100%" stopColor="#60A5FA" />
        </linearGradient>
      </defs>

      {/* Horizontal bar: left node → center → right node */}
      <line x1="2.5" y1="7" x2="12" y2="7" stroke={`url(#${gL})`} strokeWidth="3" strokeLinecap="round" />
      <line x1="12" y1="7" x2="21.5" y2="7" stroke={`url(#${gR})`} strokeWidth="3" strokeLinecap="round" />

      {/* Vertical bar: center → bottom node */}
      <line x1="12" y1="7" x2="12" y2="21.5" stroke={`url(#${gB})`} strokeWidth="3" strokeLinecap="round" />

      {/* Outer nodes */}
      <circle cx="2.5" cy="7" r="2.5" fill="#38BDF8" />
      <circle cx="21.5" cy="7" r="2.5" fill="#22D3EE" />
      <circle cx="12" cy="21.5" r="2.5" fill="#60A5FA" />

      {/* Central hub — larger, purple */}
      <circle cx="12" cy="7" r="3.5" fill="#818CF8" />
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
        <span style={{ color: "#818CF8" }}>Teams</span>
        <span style={{ color: "white" }}>ly</span>
      </span>
    </span>
  );
}
