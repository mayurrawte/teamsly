"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { ShieldCheck, GitFork, Database } from "lucide-react";

const features = [
  {
    icon: ShieldCheck,
    title: "Your data, your cloud",
    description: "All messages and files are fetched live from Microsoft Graph. Teamsly stores nothing.",
  },
  {
    icon: GitFork,
    title: "Open source · AGPL-3.0",
    description: "Inspect the code, self-host on your own infrastructure, or contribute upstream.",
  },
  {
    icon: Database,
    title: "Built on Microsoft Graph API",
    description: "First-class Microsoft 365 integration — real-time presence, rich text, and file previews.",
  },
];

export function SignInPage() {
  return (
    <div className="flex min-h-screen bg-[#0d1117] text-white">
      {/* Left panel — hero */}
      <div className="relative flex w-full flex-col justify-between overflow-hidden px-10 py-12 lg:w-1/2">
        {/* Subtle background mesh */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(ellipse 80% 60% at 20% 40%, rgba(15,90,143,0.18) 0%, transparent 70%), radial-gradient(ellipse 60% 80% at 80% 80%, rgba(11,123,168,0.10) 0%, transparent 70%)",
          }}
        />
        {/* Faint dot-grid */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "radial-gradient(circle, #8ba8c4 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />

        {/* Wordmark */}
        <div className="relative flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl text-[17px] font-black tracking-tight text-white"
            style={{
              background: "linear-gradient(135deg, #0F5A8F 0%, #0B7BA8 100%)",
              boxShadow: "0 0 0 1px rgba(15,90,143,0.6)",
            }}
          >
            T
          </div>
          <span className="text-[17px] font-semibold tracking-tight text-white">
            Teamsly
          </span>
        </div>

        {/* Centre copy */}
        <div className="relative flex flex-col gap-10">
          <div className="flex flex-col gap-4">
            <p
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: "#0B7BA8" }}
            >
              Microsoft Teams client
            </p>
            <h1 className="text-4xl font-black leading-[1.15] tracking-tight text-white lg:text-5xl">
              A calmer way to work<br />
              <span style={{ color: "#0F5A8F" }}>inside Teams.</span>
            </h1>
            <p className="max-w-sm text-[15px] leading-relaxed text-[#8b9ab0]">
              The Microsoft Teams client built for focus — fast navigation, clean
              typography, and no distractions.
            </p>
          </div>

          <ul className="flex flex-col gap-5">
            {features.map(({ icon: Icon, title, description }) => (
              <li key={title} className="flex items-start gap-4">
                <div
                  className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                  style={{ background: "rgba(15,90,143,0.18)" }}
                >
                  <Icon size={16} style={{ color: "#0B7BA8" }} strokeWidth={1.8} />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-[#e2e8f0]">{title}</p>
                  <p className="text-[12px] leading-relaxed text-[#8b9ab0]">{description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <p className="relative text-[11px] text-[#3d4a5c]">
          Open source · AGPL-3.0 · Built on Microsoft Graph API
        </p>
      </div>

      {/* Right panel — sign-in card */}
      <div className="flex w-full items-center justify-center px-8 py-12 lg:w-1/2">
        <div
          className="w-full max-w-sm rounded-2xl p-8"
          style={{
            background: "#111827",
            border: "1px solid rgba(255,255,255,0.07)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.45)",
          }}
        >
          {/* Logomark */}
          <div className="mb-8 flex justify-center">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-2xl text-2xl font-black tracking-tight text-white"
              style={{
                background: "linear-gradient(135deg, #0F5A8F 0%, #0B7BA8 100%)",
                boxShadow:
                  "0 0 0 1px rgba(15,90,143,0.5), 0 8px 24px rgba(15,90,143,0.30)",
              }}
            >
              T
            </div>
          </div>

          <h2 className="mb-1 text-center text-xl font-bold text-white">
            Sign in to Teamsly
          </h2>
          <p className="mb-8 text-center text-[13px] text-[#8b9ab0]">
            Use your Microsoft 365 account to continue.
          </p>

          <button
            onClick={() => signIn("microsoft-entra-id", { callbackUrl: "/app" })}
            className="group flex w-full items-center justify-center gap-3 rounded-xl px-5 py-3 text-sm font-semibold text-white transition-all duration-150 active:scale-[0.98]"
            style={{
              background: "linear-gradient(135deg, #0F5A8F 0%, #0B7BA8 100%)",
              boxShadow: "0 0 0 1px rgba(15,90,143,0.6)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.filter = "brightness(1.1)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.filter = "";
            }}
          >
            <MicrosoftIcon />
            Sign in with Microsoft
          </button>

          <div className="relative my-6 flex items-center gap-3">
            <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.07)" }} />
            <span className="text-[11px] text-[#3d4a5c]">or</span>
            <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.07)" }} />
          </div>

          <Link
            href="/demo"
            className="flex w-full items-center justify-center gap-1 rounded-xl border px-5 py-3 text-sm font-medium text-[#8b9ab0] transition-colors duration-150 hover:border-[#0F5A8F] hover:text-white"
            style={{ borderColor: "rgba(255,255,255,0.09)" }}
          >
            Preview UI without signing in
            <span aria-hidden="true" className="ml-0.5">→</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

function MicrosoftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 21 21" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}
