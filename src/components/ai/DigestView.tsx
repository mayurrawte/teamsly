"use client";

import { useEffect, useState, useCallback } from "react";
import type { CatchUpWindow } from "@/store/catchUp";
import { SkeletonCard, NotConfiguredCard } from "./catchup-shared";

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

export interface CatchUpMeta {
  generatedAt?: string;
  cached: boolean;
}

export function DigestView({
  window: catchUpWindow,
  refreshNonce,
  onLoadingChange,
  onMeta,
}: {
  window: CatchUpWindow;
  refreshNonce: number;
  onLoadingChange: (loading: boolean) => void;
  onMeta: (meta: CatchUpMeta | null) => void;
}) {
  const [digest, setDigest] = useState<DigestResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchDigest = useCallback(
    async (win: CatchUpWindow) => {
      setLoading(true);
      onLoadingChange(true);
      setDigest(null);
      onMeta(null);
      try {
        const res = await fetch(`/api/ai/tldr?window=${win}`);
        const data = (await res.json()) as DigestResponse;
        setDigest(data);
        onMeta(data.status === "ok" ? { generatedAt: data.generatedAt, cached: data.cached } : null);
      } catch {
        setDigest({ status: "error", cached: false, message: "Network error — please try again." });
        onMeta(null);
      } finally {
        setLoading(false);
        onLoadingChange(false);
      }
    },
    [onLoadingChange, onMeta]
  );

  useEffect(() => {
    void fetchDigest(catchUpWindow);
  }, [catchUpWindow, refreshNonce, fetchDigest]);

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }
  if (digest?.status === "not_configured") {
    return <NotConfiguredCard feature="cross-channel AI catch-up digests" />;
  }
  if (digest?.status === "error") {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-[13px] text-red-400">
        {digest.message ?? "Something went wrong. Try refreshing."}
      </div>
    );
  }
  if (digest?.status === "ok" && digest.digest === "") {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <span className="mb-2 text-3xl">✨</span>
        <p className="text-[14px] font-semibold text-[var(--text-primary)]">All caught up</p>
        <p className="mt-1 text-[13px] text-[var(--text-muted)]">
          Nothing notable in the {WINDOW_LABELS[catchUpWindow].toLowerCase()}.
        </p>
      </div>
    );
  }
  if (digest?.status === "ok" && digest.digest) {
    return <DigestMarkdown markdown={digest.digest} />;
  }
  return null;
}

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
