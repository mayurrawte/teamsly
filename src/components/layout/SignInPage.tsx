"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";

export function SignInPage() {
  return (
    <div className="flex h-screen items-center justify-center bg-[#1a1d21]">
      <div className="flex flex-col items-center gap-8 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1164a3] text-3xl font-bold text-white">
            T
          </div>
          <h1 className="text-3xl font-bold text-white">Teamsly</h1>
          <p className="max-w-xs text-[#ababad]">
            Slack-like experience for Microsoft Teams. Sign in with your Microsoft account to get started.
          </p>
        </div>

        <button
          onClick={() => signIn("microsoft-entra-id", { callbackUrl: "/app" })}
          className="flex items-center gap-3 rounded-lg bg-[#1164a3] px-8 py-3 text-sm font-semibold text-white transition hover:bg-[#0b4f8a] active:scale-95"
        >
          <MicrosoftIcon />
          Sign in with Microsoft
        </button>

        <Link
          href="/demo"
          className="text-sm text-[#ababad] underline underline-offset-2 hover:text-white"
        >
          Preview UI without signing in →
        </Link>

        <p className="text-xs text-[#6c6f75]">
          Open source · AGPL-3.0 · Built on Microsoft Graph API
        </p>
      </div>
    </div>
  );
}

function MicrosoftIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 21 21" fill="none">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}
