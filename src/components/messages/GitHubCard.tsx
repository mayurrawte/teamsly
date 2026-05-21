"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import type { DetectedGitHubLink } from "@/lib/integrations/github-detect";
import type { GitHubPreview } from "@/app/api/integrations/github/preview/route";

type CardState =
  | { status: "loading" }
  | { status: "loaded"; data: GitHubPreview }
  | { status: "not_found" }
  | { status: "rate_limited" }
  | { status: "error" };

const STATE_COLORS: Record<GitHubPreview["state"], string> = {
  open: "border-l-green-500",
  merged: "border-l-purple-500",
  closed: "border-l-red-500",
  draft: "border-l-neutral-400",
};

const STATE_BADGE: Record<GitHubPreview["state"], { label: string; cls: string }> = {
  open: { label: "Open", cls: "bg-green-500/15 text-green-400" },
  merged: { label: "Merged", cls: "bg-purple-500/15 text-purple-400" },
  closed: { label: "Closed", cls: "bg-red-500/15 text-red-400" },
  draft: { label: "Draft", cls: "bg-neutral-500/15 text-neutral-400" },
};

export function GitHubCard({ link }: { link: DetectedGitHubLink }) {
  const [state, setState] = useState<CardState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/integrations/github/preview?url=${encodeURIComponent(link.url)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.kind === "not_found") setState({ status: "not_found" });
        else if (data.kind === "rate_limited") setState({ status: "rate_limited" });
        else if (data.kind === "pr" || data.kind === "issue") setState({ status: "loaded", data });
        else setState({ status: "error" });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => { cancelled = true; };
  }, [link.url]);

  if (state.status === "loading") {
    return (
      <div className="mt-2 max-w-[460px] animate-pulse rounded-md border border-border bg-card/50 p-3">
        <div className="mb-2 h-3 w-1/3 rounded bg-muted/40" />
        <div className="h-4 w-4/5 rounded bg-muted/40" />
      </div>
    );
  }

  if (state.status === "not_found") {
    return (
      <div className="mt-2 text-[12px] text-[var(--text-muted)]">
        GitHub:{" "}
        <a href={link.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
          {link.url}
        </a>{" "}
        (not found)
      </div>
    );
  }

  if (state.status === "rate_limited") {
    return (
      <div className="mt-2 text-[12px] text-[var(--text-muted)]">
        GitHub preview unavailable — rate limited
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="mt-2 text-[12px] text-[var(--text-muted)]">
        GitHub:{" "}
        <a href={link.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
          {link.url}
        </a>
      </div>
    );
  }

  const { data } = state;
  const badge = STATE_BADGE[data.state];
  const borderColor = STATE_COLORS[data.state];
  const relTime = data.updatedAt
    ? formatDistanceToNow(new Date(data.updatedAt), { addSuffix: true })
    : null;

  return (
    <a
      href={data.htmlUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`mt-2 block max-w-[460px] rounded-md border-l-4 border border-border bg-card/50 p-3 hover:bg-card/80 transition-colors no-underline ${borderColor}`}
    >
      <div className="mb-0.5 text-[11px] text-[var(--text-muted)]">
        {data.owner}/{data.repo} #{data.number}
      </div>
      <div className="flex items-start justify-between gap-2">
        <span className="text-[13px] font-semibold text-[var(--text-primary)] leading-snug">
          {data.title}
        </span>
        {data.authorAvatar && (
          <img
            src={data.authorAvatar}
            alt={data.authorLogin}
            title={data.authorLogin}
            className="h-5 w-5 flex-shrink-0 rounded-full"
          />
        )}
      </div>
      {data.bodyExcerpt && (
        <div className="mt-1 text-[12px] text-[var(--text-muted)] line-clamp-2">
          {data.bodyExcerpt}
        </div>
      )}
      <div className="mt-2 flex items-center gap-3">
        <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-medium ${badge.cls}`}>
          {badge.label}
        </span>
        {data.commentCount > 0 && (
          <span className="text-[11px] text-[var(--text-muted)]">
            {data.commentCount} comment{data.commentCount !== 1 ? "s" : ""}
          </span>
        )}
        {relTime && (
          <span className="text-[11px] text-[var(--text-muted)]">updated {relTime}</span>
        )}
      </div>
    </a>
  );
}
