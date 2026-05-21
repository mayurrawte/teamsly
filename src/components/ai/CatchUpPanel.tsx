"use client";

import { useEffect, useState, useCallback } from "react";
import { X, RefreshCw, Copy, Check } from "lucide-react";
import { useCatchUpStore, type CatchUpWindow } from "@/store/catchUp";

interface DigestResponse {
  status: "ok" | "not_configured" | "error";
  generatedAt?: string;
  since?: string;
  conversationCount?: number;
  cached: boolean;
  digest?: string;
  message?: string;
}

const WINDOW_LABELS: Record<CatchUpWindow, string> = {
  "24h": "Last 24 hours",
  "3d": "Last 3 days",
  "7d": "Last 7 days",
};

function DigestMarkdown({ markdown }: { markdown: string }) {
  const html = renderDigestMarkdown(markdown);
  return (
    <div
      className="prose-digest text-[14px] leading-relaxed text-[var(--text-primary)]"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function renderDigestMarkdown(input: string): string {
  const lines = input.split("\n");
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("## ")) {
      out.push(`<h2 class="catch-up-h2">${escMd(line.slice(3))}</h2>`);
      i++;
      continue;
    }

    if (line.startsWith("### ")) {
      out.push(`<h3 class="catch-up-h3">${escMd(line.slice(4))}</h3>`);
      i++;
      continue;
    }

    if (/^- /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^- /.test(lines[i])) {
        items.push(`<li>${inlineMd(lines[i].slice(2))}</li>`);
        i++;
      }
      out.push(`<ul class="catch-up-ul">${items.join("")}</ul>`);
      continue;
    }

    if (line === "") {
      out.push("<br>");
      i++;
      continue;
    }

    out.push(`<p class="catch-up-p">${inlineMd(line)}</p>`);
    i++;
  }

  return out.join("");
}

function inlineMd(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function escMd(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] p-4">
      <div className="mb-3 h-4 w-2/3 rounded bg-[var(--border)]" />
      <div className="mb-2 h-3 w-full rounded bg-[var(--border)]" />
      <div className="mb-2 h-3 w-5/6 rounded bg-[var(--border)]" />
      <div className="h-3 w-4/6 rounded bg-[var(--border)]" />
    </div>
  );
}

export function CatchUpPanel() {
  const { open, window: catchUpWindow, setOpen, setWindow } = useCatchUpStore();
  const [digest, setDigest] = useState<DigestResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchDigest = useCallback(async (win: CatchUpWindow) => {
    setLoading(true);
    setDigest(null);
    try {
      const res = await fetch(`/api/ai/tldr?window=${win}`);
      const data = (await res.json()) as DigestResponse;
      setDigest(data);
    } catch {
      setDigest({ status: "error", cached: false, message: "Network error — please try again." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      void fetchDigest(catchUpWindow);
    }
  }, [open, catchUpWindow, fetchDigest]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  function handleWindowChange(w: CatchUpWindow) {
    setWindow(w);
    void fetchDigest(w);
  }

  function handleRefresh() {
    void fetchDigest(catchUpWindow);
  }

  function handleCopyEnvVar() {
    void navigator.clipboard.writeText("ANTHROPIC_API_KEY");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const generatedTime = digest?.generatedAt
    ? new Date(digest.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40"
          aria-hidden="true"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={[
          "fixed bottom-0 right-0 top-0 z-50 flex w-full flex-col border-l border-[var(--border)] bg-[var(--content-bg)] shadow-[-4px_0_24px_rgba(0,0,0,0.3)] sm:w-[440px]",
          "transition-transform duration-[280ms] ease-[cubic-bezier(0.34,1.2,0.64,1)]",
          open ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
        aria-label="Catch-up digest panel"
        aria-hidden={!open}
      >
        <header className="flex h-[50px] flex-shrink-0 items-center justify-between border-b border-[var(--border)] px-4">
          <h2 className="text-[16px] font-bold text-[var(--text-primary)]">Catch up</h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Refresh digest"
              onClick={handleRefresh}
              disabled={loading}
              className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] disabled:opacity-40"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              type="button"
              aria-label="Close panel"
              onClick={() => setOpen(false)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="flex flex-shrink-0 gap-1.5 border-b border-[var(--border)] px-4 py-2">
          {(Object.entries(WINDOW_LABELS) as [CatchUpWindow, string][]).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => handleWindowChange(key)}
              className={[
                "rounded-full px-3 py-1 text-[12px] font-medium transition-colors",
                catchUpWindow === key
                  ? "bg-[var(--accent)] text-white"
                  : "bg-[var(--surface-raised)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {loading && (
            <div className="flex flex-col gap-3">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          )}

          {!loading && digest?.status === "not_configured" && (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] p-5">
              <p className="mb-1 text-[14px] font-semibold text-[var(--text-primary)]">
                AI digests not enabled
              </p>
              <p className="mb-4 text-[13px] text-[var(--text-secondary)]">
                Add your Anthropic API key to unlock cross-channel AI catch-up digests.
              </p>
              <div className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--message-bg)] px-3 py-2">
                <code className="flex-1 text-[12px] text-[var(--text-secondary)]">
                  ANTHROPIC_API_KEY
                </code>
                <button
                  type="button"
                  onClick={handleCopyEnvVar}
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
          )}

          {!loading && digest?.status === "error" && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-[13px] text-red-400">
              {digest.message ?? "Something went wrong. Try refreshing."}
            </div>
          )}

          {!loading && digest?.status === "ok" && digest.digest === "" && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <span className="mb-2 text-3xl">✨</span>
              <p className="text-[14px] font-semibold text-[var(--text-primary)]">All caught up</p>
              <p className="mt-1 text-[13px] text-[var(--text-muted)]">
                Nothing notable in the {WINDOW_LABELS[catchUpWindow].toLowerCase()}.
              </p>
            </div>
          )}

          {!loading && digest?.status === "ok" && digest.digest && (
            <DigestMarkdown markdown={digest.digest} />
          )}
        </div>

        {!loading && generatedTime && (
          <footer className="flex flex-shrink-0 items-center justify-between border-t border-[var(--border)] px-4 py-2">
            <span className="text-[11px] text-[var(--text-muted)]">Generated at {generatedTime}</span>
            {digest?.cached && (
              <span className="rounded-full bg-[var(--surface-raised)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
                cached
              </span>
            )}
          </footer>
        )}
      </aside>

      <style>{`
        .catch-up-h2 {
          font-size: 13px;
          font-weight: 700;
          color: var(--text-primary);
          margin: 20px 0 6px;
          padding-bottom: 4px;
          border-bottom: 1px solid var(--border);
        }
        .catch-up-h2:first-child { margin-top: 0; }
        .catch-up-h3 {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-secondary);
          margin: 12px 0 4px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .catch-up-ul {
          margin: 4px 0 8px 16px;
          list-style: disc;
        }
        .catch-up-ul li {
          margin-bottom: 3px;
          font-size: 13px;
          color: var(--text-secondary);
          line-height: 1.5;
        }
        .catch-up-p {
          margin: 4px 0;
          font-size: 13px;
          color: var(--text-secondary);
          line-height: 1.5;
        }
        .prose-digest strong { color: var(--text-primary); }
        .prose-digest code {
          background: var(--surface-raised);
          border-radius: 3px;
          padding: 1px 4px;
          font-size: 12px;
        }
      `}</style>
    </>
  );
}
