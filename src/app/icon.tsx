import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0d1117",
          borderRadius: 8,
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          width="26"
          height="26"
        >
          {/* Horizontal lines */}
          <line x1="2.5" y1="7" x2="12" y2="7" stroke="#38BDF8" strokeWidth="3" strokeLinecap="round" />
          <line x1="12" y1="7" x2="21.5" y2="7" stroke="#22D3EE" strokeWidth="3" strokeLinecap="round" />
          {/* Vertical line */}
          <line x1="12" y1="7" x2="12" y2="21.5" stroke="#818CF8" strokeWidth="3" strokeLinecap="round" />
          {/* Outer nodes */}
          <circle cx="2.5" cy="7" r="2.5" fill="#38BDF8" />
          <circle cx="21.5" cy="7" r="2.5" fill="#22D3EE" />
          <circle cx="12" cy="21.5" r="2.5" fill="#60A5FA" />
          {/* Central hub */}
          <circle cx="12" cy="7" r="3.5" fill="#818CF8" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
