"use client";

import { useSession, signIn } from "next-auth/react";
import { ShieldCheck } from "lucide-react";
import { FEATURE_LABELS, FEATURE_SCOPES, missingScopesFor, unionScopes, type Feature } from "@/lib/auth/scopes";

/**
 * Incremental consent gate. Renders children when the session already has the
 * feature's Graph scopes; otherwise a one-step "connect" card that re-runs
 * Microsoft sign-in asking for the union of granted + missing scopes. Entra
 * remembers earlier grants, so the user only sees the new permissions.
 */
export function ScopeGate({ feature, children }: { feature: Feature; children: React.ReactNode }) {
  const { data: session, status } = useSession();
  if (status === "loading") return null;
  const missing = missingScopesFor(session?.scopes, feature);
  if (missing.length === 0) return <>{children}</>;

  const { title, why } = FEATURE_LABELS[feature];
  const connect = () =>
    signIn(
      "microsoft-entra-id",
      { callbackUrl: window.location.href },
      { scope: unionScopes(session?.scopes, FEATURE_SCOPES[feature]) },
    );

  return (
    <div className="flex h-full items-center justify-center p-8" data-testid={`scope-gate-${feature}`}>
      <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
        <ShieldCheck className="mx-auto mb-3 text-[#818CF8]" size={28} />
        <h2 className="mb-1 text-lg font-semibold">Connect {title}</h2>
        <p className="mb-4 text-sm text-[var(--text-muted)]">
          Teamsly asks for permissions only when you use a feature. To {why}, it needs:
        </p>
        <ul className="mb-5 space-y-1 text-left text-[13px]">
          {missing.map((s) => (
            <li key={s} className="rounded-md bg-black/5 px-3 py-1.5 font-mono dark:bg-white/5">{s}</li>
          ))}
        </ul>
        <button
          type="button"
          onClick={connect}
          className="w-full rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
          style={{ background: "linear-gradient(135deg, #6366F1 0%, #818CF8 100%)" }}
        >
          Approve with Microsoft
        </button>
        <p className="mt-3 text-[12px] text-[var(--text-muted)]">
          If Microsoft says “Need admin approval”, send your admin the link on{" "}
          <a className="underline" href="/for-admins" target="_blank" rel="noopener">teamsly.app/for-admins</a>.
        </p>
      </div>
    </div>
  );
}
