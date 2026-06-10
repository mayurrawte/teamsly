"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { X, RefreshCw } from "lucide-react";
import { useCatchUpStore, type CatchUpWindow, type CatchUpTab } from "@/store/catchUp";
import { DigestView, type CatchUpMeta } from "./DigestView";
import { ActionItemsView } from "./ActionItemsView";

const WINDOW_LABELS: Record<CatchUpWindow, string> = {
  "24h": "Last 24 hours",
  "3d": "Last 3 days",
  "7d": "Last 7 days",
};

const TABS: { key: CatchUpTab; label: string }[] = [
  { key: "digest", label: "Digest" },
  { key: "actions", label: "Action items" },
];

export function CatchUpPanel() {
  const { open, window: catchUpWindow, tab, setOpen, setWindow, setTab } = useCatchUpStore();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState<CatchUpMeta | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  // Reset transient view state whenever the panel opens or the tab changes.
  useEffect(() => {
    setMeta(null);
  }, [tab, open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  const handleRefresh = useCallback(() => setRefreshNonce((n) => n + 1), []);

  function navigateAndClose(href: string) {
    setOpen(false);
    router.push(href);
  }

  const generatedTime = meta?.generatedAt
    ? new Date(meta.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <>
      {open && <div className="fixed inset-0 z-40" aria-hidden="true" onClick={() => setOpen(false)} />}

      <aside
        className={[
          "fixed bottom-0 right-0 top-0 z-50 flex w-full flex-col border-l border-[var(--border)] bg-[var(--content-bg)] shadow-[-4px_0_24px_rgba(0,0,0,0.3)] sm:w-[440px]",
          "transition-transform duration-[280ms] ease-[cubic-bezier(0.34,1.2,0.64,1)]",
          open ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
        aria-label="Catch-up panel"
        aria-hidden={!open}
      >
        <header className="flex h-[50px] flex-shrink-0 items-center justify-between border-b border-[var(--border)] px-4">
          <h2 className="text-[16px] font-bold text-[var(--text-primary)]">Catch up</h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Refresh"
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

        <div role="tablist" className="flex flex-shrink-0 gap-1 border-b border-[var(--border)] px-4 pt-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={[
                "relative px-3 py-2 text-[13px] font-medium transition-colors",
                tab === t.key
                  ? "text-[var(--text-primary)] after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-[var(--accent)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
              ].join(" ")}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex flex-shrink-0 gap-1.5 border-b border-[var(--border)] px-4 py-2">
          {(Object.entries(WINDOW_LABELS) as [CatchUpWindow, string][]).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setWindow(key)}
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
          {tab === "digest" ? (
            <DigestView
              window={catchUpWindow}
              refreshNonce={refreshNonce}
              onLoadingChange={setLoading}
              onMeta={setMeta}
            />
          ) : (
            <ActionItemsView
              window={catchUpWindow}
              refreshNonce={refreshNonce}
              onLoadingChange={setLoading}
              onMeta={setMeta}
              onNavigate={navigateAndClose}
            />
          )}
        </div>

        {!loading && generatedTime && (
          <footer className="flex flex-shrink-0 items-center justify-between border-t border-[var(--border)] px-4 py-2">
            <span className="text-[11px] text-[var(--text-muted)]">Generated at {generatedTime}</span>
            {meta?.cached && (
              <span className="rounded-full bg-[var(--surface-raised)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
                cached
              </span>
            )}
          </footer>
        )}
      </aside>
    </>
  );
}
