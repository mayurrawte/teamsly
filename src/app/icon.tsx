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
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          width="30"
          height="30"
        >
          {/* Branch lines */}
          <line x1="4.8" y1="5.7" x2="12" y2="5.7" stroke="#38BDF8" strokeWidth="2.2" strokeLinecap="round" />
          <line x1="12" y1="5.7" x2="19.2" y2="5.7" stroke="#22D3EE" strokeWidth="2.2" strokeLinecap="round" />
          <line x1="12" y1="18.3" x2="12" y2="5.7" stroke="#38BDF8" strokeWidth="2.2" strokeLinecap="round" />

          {/* Outer nodes */}
          <circle cx="4.8" cy="5.7" r="2" fill="#38BDF8" />
          <circle cx="19.2" cy="5.7" r="2" fill="#22D3EE" />
          <circle cx="12" cy="18.3" r="2" fill="#38BDF8" />

          {/* Central hub */}
          <circle cx="12" cy="5.7" r="2.6" fill="#818CF8" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
