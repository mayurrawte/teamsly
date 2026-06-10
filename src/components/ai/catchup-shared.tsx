"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] p-4">
      <div className="mb-3 h-4 w-2/3 rounded bg-[var(--border)]" />
      <div className="mb-2 h-3 w-full rounded bg-[var(--border)]" />
      <div className="mb-2 h-3 w-5/6 rounded bg-[var(--border)]" />
      <div className="h-3 w-4/6 rounded bg-[var(--border)]" />
    </div>
  );
}

/** The "AI not enabled — set ANTHROPIC_API_KEY" card, shared by both tabs. */
export function NotConfiguredCard({ feature }: { feature: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    void navigator.clipboard.writeText("OPENAI_API_KEY");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] p-5">
      <p className="mb-1 text-[14px] font-semibold text-[var(--text-primary)]">AI features not enabled</p>
      <p className="mb-4 text-[13px] text-[var(--text-secondary)]">
        Add your Anthropic API key to unlock {feature}.
      </p>
      <div className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--message-bg)] px-3 py-2">
        <code className="flex-1 text-[12px] text-[var(--text-secondary)]">OPENAI_API_KEY</code>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 rounded px-2 py-0.5 text-[11px] text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="mt-3 text-[12px] text-[var(--text-muted)]">
        Set this in Vercel environment variables, then redeploy.
      </p>
    </div>
  );
}

/** Shown when the user has hit their daily AI request limit (HTTP 429). */
export function LimitReachedCard({ resetAt }: { resetAt?: number }) {
  const resetLabel = resetAt
    ? new Date(resetAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] p-5">
      <p className="mb-1 text-[14px] font-semibold text-[var(--text-primary)]">Daily AI limit reached</p>
      <p className="text-[13px] text-[var(--text-secondary)]">
        You&apos;ve used today&apos;s AI requests{resetLabel ? `. Resets at ${resetLabel}.` : "."}
      </p>
    </div>
  );
}
