"use client";

import { signIn } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, GitFork, Database } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { adminConsentUrl, isConsentError } from "@/lib/auth/consent";

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
  const [authError, setAuthError] = useState<string | null>(null);
  const [showAdminHelp, setShowAdminHelp] = useState(false);
  const [consentUrl, setConsentUrl] = useState<string | null>(null);
  useEffect(() => {
    const err = new URLSearchParams(window.location.search).get("error");
    setAuthError(err);
    setConsentUrl(adminConsentUrl(process.env.NEXT_PUBLIC_AZURE_AD_CLIENT_ID, `${window.location.origin}/login`));
    if (isConsentError(err)) setShowAdminHelp(true);
  }, []);
  const copyConsentLink = async () => {
    if (consentUrl) await navigator.clipboard.writeText(consentUrl);
  };
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
              "radial-gradient(ellipse 80% 60% at 20% 40%, rgba(99,102,241,0.18) 0%, transparent 70%), radial-gradient(ellipse 60% 80% at 80% 80%, rgba(129,140,248,0.10) 0%, transparent 70%)",
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
        <div className="relative flex items-center gap-3" style={{ color: "#2E2A6F" }}>
          <Logo size={36} className="text-white" />
          <span className="text-[17px] font-bold tracking-tight">
            <span style={{ color: "#818CF8" }}>Teams</span>
            <span className="text-white">ly</span>
          </span>
        </div>

        {/* Centre copy */}
        <div className="relative flex flex-col gap-10">
          <div className="flex flex-col gap-4">
            <p
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: "#818CF8" }}
            >
              Microsoft Teams client
            </p>
            <h1 className="text-4xl font-black leading-[1.15] tracking-tight text-white lg:text-5xl">
              A calmer way to work<br />
              <span style={{ color: "#6366F1" }}>inside Teams.</span>
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
                  style={{ background: "rgba(99,102,241,0.18)" }}
                >
                  <Icon size={16} style={{ color: "#818CF8" }} strokeWidth={1.8} />
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
            <Logo size={56} className="text-white" />
          </div>

          <h2 className="mb-1 text-center text-xl font-bold text-white">
            Sign in to Teamsly
          </h2>
          <p className="mb-8 text-center text-[13px] text-[#8b9ab0]">
            Use your Microsoft 365 account to continue.
          </p>

          {authError && !isConsentError(authError) && (
            <div className="mb-4 w-full rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-center text-[13px] text-red-300">
              Sign-in failed: <span className="font-mono font-semibold">{authError}</span>
            </div>
          )}
          {showAdminHelp && (
            <div
              data-testid="admin-consent-help"
              className="mb-4 w-full rounded-lg border px-4 py-3 text-[13px] leading-relaxed text-[#c7d0dd]"
              style={{ borderColor: "rgba(129,140,248,0.4)", background: "rgba(99,102,241,0.08)" }}
            >
              <p className="mb-2 font-semibold text-white">
                {isConsentError(authError) ? "Your organisation needs to approve Teamsly first." : "Company account says “Need admin approval”?"}
              </p>
              <p className="mb-2">
                Most Microsoft 365 tenants block users from approving third-party apps. An IT admin can
                approve Teamsly for everyone in one click — send them this link:
              </p>
              {consentUrl ? (
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={consentUrl}
                    className="min-w-0 flex-1 rounded-md bg-black/30 px-2 py-1.5 font-mono text-[11px] text-[#8b9ab0]"
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  <button
                    type="button"
                    onClick={copyConsentLink}
                    className="rounded-md px-3 py-1.5 text-[12px] font-semibold text-white"
                    style={{ background: "rgba(99,102,241,0.6)" }}
                  >
                    Copy
                  </button>
                </div>
              ) : (
                <p className="text-[#8b9ab0]">
                  This instance has not published its app id. Ask its operator, or{" "}
                  <a className="underline" href="https://github.com/mayurrawte/teamsly/blob/main/SELF_HOSTING.md" target="_blank" rel="noopener">
                    self-host under your own Azure app
                  </a>{" "}
                  so your admin approves it once.
                </p>
              )}
              <p className="mt-2 text-[12px] text-[#8b9ab0]">
                Teamsly stores nothing — messages and files stay in Microsoft 365 and are read live via the official Graph API.
              </p>
            </div>
          )}

          <button
            onClick={() => signIn("microsoft-entra-id", { callbackUrl: "/workspace" })}
            className="group flex w-full items-center justify-center gap-3 rounded-xl px-5 py-3 text-sm font-semibold text-white transition-all duration-[var(--motion-fast)] active:scale-[0.98]"
            style={{
              background: "linear-gradient(135deg, #6366F1 0%, #818CF8 100%)",
              boxShadow: "0 0 0 1px rgba(99,102,241,0.6)",
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
            className="flex w-full items-center justify-center gap-1 rounded-xl border px-5 py-3 text-sm font-medium text-[#8b9ab0] transition-colors duration-[var(--motion-fast)] hover:border-[#6366F1] hover:text-white"
            style={{ borderColor: "rgba(255,255,255,0.09)" }}
          >
            Preview UI without signing in
            <span aria-hidden="true" className="ml-0.5">→</span>
          </Link>

          {!showAdminHelp && (
            <button
              type="button"
              onClick={() => setShowAdminHelp(true)}
              className="mt-4 w-full text-center text-[12px] text-[#5b6b82] underline-offset-2 hover:text-[#8b9ab0] hover:underline"
            >
              Work account blocked by “Need admin approval”?
            </button>
          )}
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
