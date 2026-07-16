"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
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

interface Props {
  /** When provided (e.g. by the slide-in panel), used instead of router.push so the
   *  caller can close itself first. */
  onNavigate?: (href: string) => void;
  className?: string;
}

export function CatchUpContent({ onNavigate, className }: Props) {
  const { window: catchUpWindow, tab, setWindow, setTab } = useCatchUpStore();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState<CatchUpMeta | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  // Reset transient meta when the tab changes.
  useEffect(() => {
    setMeta(null);
  }, [tab]);

  const handleRefresh = useCallback(() => setRefreshNonce((n) => n + 1), []);
  const navigate = onNavigate ?? ((href: string) => router.push(href));

  const generatedTime = meta?.generatedAt
    ? new Date(meta.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className={["context-fade-in flex h-full flex-col", className ?? ""].join(" ")}>
      <div role="tablist" className="flex flex-shrink-0 items-center gap-1 border-b border-[var(--border)] px-4 pt-2">
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
        <button
          type="button"
          aria-label="Refresh"
          onClick={handleRefresh}
          disabled={loading}
          className="ml-auto flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] disabled:opacity-40"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
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
            onNavigate={navigate}
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
    </div>
  );
}
