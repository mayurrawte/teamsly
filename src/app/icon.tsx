/**
 * Next.js App Router dynamic favicon.
 * Rendered at /favicon.ico and /icon via the ImageResponse API.
 * Mirrors the Teamsly logomark: chat-bubble outline + >_ terminal glyph + branch-node flourish.
 */

import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  // Indigo brand colour used as the rendered stroke colour.
  const color = "#2E2A6F";

  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          width="28"
          height="28"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Speech bubble */}
          <path d="M3 21 L4 18 L4 8 A3 3 0 0 1 7 5 L19 5 A3 3 0 0 1 22 8 L22 15 A3 3 0 0 1 19 18 L6 18 Z" />

          {/* Chevron > */}
          <polyline points="8.5,10.5 10.5,12 8.5,13.5" strokeWidth="1.8" />

          {/* Underscore _ */}
          <line x1="12" y1="13.5" x2="15.5" y2="13.5" strokeWidth="1.8" />

          {/* Branch-node connector */}
          <line x1="1.5" y1="4" x2="3.5" y2="6.5" strokeWidth="1.2" stroke={color} />

          {/* Branch-node circles */}
          <circle cx="1.5" cy="4" r="1.2" fill={color} stroke="none" />
          <circle cx="3.5" cy="6.5" r="1.2" fill={color} stroke="none" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
