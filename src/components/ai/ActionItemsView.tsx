"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { ArrowUpRight, Clock } from "lucide-react";
import type { CatchUpWindow } from "@/store/catchUp";
import type { ActionItem } from "@/lib/ai/conversation-gather";
import { useRemindersStore } from "@/store/reminders";
import { SkeletonCard, NotConfiguredCard, LimitReachedCard } from "./catchup-shared";
import type { CatchUpMeta } from "./DigestView";

interface ActionItemsResponse {
  status: "ok" | "not_configured" | "error" | "rate_limited";
  generatedAt?: string;
  since?: string;
  cached: boolean;
  items?: ActionItem[];
  message?: string;
  resetAt?: number;
}

type Ownership = ActionItem["ownership"];

const GROUPS: { key: Ownership; title: string }[] = [
  { key: "you", title: "For you" },
  { key: "waiting", title: "Waiting on others" },
  { key: "team", title: "Team / unassigned" },
];

function hrefForItem(item: ActionItem): string {
  const base =
    item.contextKind === "chat"
      ? `/workspace/dm/${item.contextId}`
      : `/workspace/t/${item.contextId.replace(":", "/")}`;
  return item.messageId ? `${base}?anchor=${encodeURIComponent(item.messageId)}` : base;
}

/** Reminder time presets, recomputed at render. Past presets are dropped. */
function remindPresets(): { label: string; fireAt: number }[] {
  const now = new Date();
  const out: { label: string; fireAt: number }[] = [
    { label: "In 1 hour", fireAt: now.getTime() + 60 * 60 * 1000 },
  ];
  const evening = new Date(now);
  evening.setHours(18, 0, 0, 0);
  if (evening.getTime() > now.getTime() + 10 * 60 * 1000) {
    out.push({ label: "This evening", fireAt: evening.getTime() });
  }
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  out.push({ label: "Tomorrow 9am", fireAt: tomorrow.getTime() });
  return out;
}

export function ActionItemsView({
  window: catchUpWindow,
  refreshNonce,
  onLoadingChange,
  onMeta,
  onNavigate,
}: {
  window: CatchUpWindow;
  refreshNonce: number;
  onLoadingChange: (loading: boolean) => void;
  onMeta: (meta: CatchUpMeta | null) => void;
  onNavigate: (href: string) => void;
}) {
  const [data, setData] = useState<ActionItemsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const addReminder = useRemindersStore((s) => s.add);

  const fetchItems = useCallback(
    async (win: CatchUpWindow) => {
      setLoading(true);
      onLoadingChange(true);
      setData(null);
      onMeta(null);
      try {
        const res = await fetch(`/api/ai/action-items?window=${win}`);
        const json = (await res.json()) as ActionItemsResponse;
        setData(json);
        onMeta(json.status === "ok" ? { generatedAt: json.generatedAt, cached: json.cached } : null);
      } catch {
        setData({ status: "error", cached: false, message: "Network error — please try again." });
        onMeta(null);
      } finally {
        setLoading(false);
        onLoadingChange(false);
      }
    },
    [onLoadingChange, onMeta]
  );

  useEffect(() => {
    void fetchItems(catchUpWindow);
  }, [catchUpWindow, refreshNonce, fetchItems]);

  function handleRemind(item: ActionItem, fireAt: number) {
    addReminder({
      id: crypto.randomUUID(),
      task: item.task,
      sourceHref: hrefForItem(item),
      fireAt,
      createdAt: Date.now(),
    });
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }
  if (data?.status === "not_configured") {
    return <NotConfiguredCard feature="structured action-item extraction" />;
  }
  if (data?.status === "rate_limited") {
    return <LimitReachedCard resetAt={data.resetAt} />;
  }
  if (data?.status === "error") {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-[13px] text-red-400">
        {data.message ?? "Something went wrong. Try refreshing."}
      </div>
    );
  }
  const items = data?.status === "ok" ? data.items ?? [] : [];
  if (data?.status === "ok" && items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <span className="mb-2 text-3xl">✅</span>
        <p className="text-[14px] font-semibold text-[var(--text-primary)]">No action items</p>
        <p className="mt-1 text-[13px] text-[var(--text-muted)]">Nothing needs your attention right now.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {GROUPS.map((group) => {
        const groupItems = items.filter((i) => i.ownership === group.key);
        if (groupItems.length === 0) return null;
        return (
          <section key={group.key}>
            <h3 className="catch-up-h3 mb-2">{group.title}</h3>
            <ul className="flex flex-col gap-1.5">
              {groupItems.map((item, idx) => (
                <ActionItemRow
                  key={`${group.key}-${idx}`}
                  item={item}
                  onJump={() => onNavigate(hrefForItem(item))}
                  onRemind={(fireAt) => handleRemind(item, fireAt)}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function ActionItemRow({
  item,
  onJump,
  onRemind,
}: {
  item: ActionItem;
  onJump: () => void;
  onRemind: (fireAt: number) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [reminded, setReminded] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  function pick(fireAt: number) {
    onRemind(fireAt);
    setMenuOpen(false);
    setReminded(true);
    setTimeout(() => setReminded(false), 2000);
  }

  return (
    <li className="group flex items-start gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] p-3">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] leading-snug text-[var(--text-primary)]">{item.task}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[var(--text-muted)]">
          {item.owner && (
            <span className="rounded-full bg-[var(--message-bg)] px-1.5 py-0.5 text-[var(--text-secondary)]">
              @{item.owner}
            </span>
          )}
          <span className="truncate">{item.sourceLabel}</span>
        </div>
      </div>
      <div className="flex flex-shrink-0 items-center gap-0.5">
        <button
          type="button"
          aria-label="Jump to source"
          onClick={onJump}
          className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
        >
          <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
        <div ref={menuRef} className="relative">
          <button
            type="button"
            aria-label="Remind me"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] ${
              reminded ? "text-[var(--accent)]" : "text-[var(--text-muted)]"
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-8 z-10 w-40 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--content-bg)] py-1 shadow-lg">
              {remindPresets().map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => pick(p.fireAt)}
                  className="block w-full px-3 py-1.5 text-left text-[12px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                >
                  {p.label}
                </button>
              ))}
              <CustomRemind onPick={pick} />
            </div>
          )}
        </div>
      </div>
      {reminded && <span className="sr-only">Reminder set</span>}
    </li>
  );
}

function CustomRemind({ onPick }: { onPick: (fireAt: number) => void }) {
  const [value, setValue] = useState("");
  const parsed = new Date(value).getTime();
  const valid = !Number.isNaN(parsed) && parsed > Date.now();
  return (
    <div className="border-t border-[var(--border)] px-3 py-1.5">
      <label
        htmlFor="custom-remind-dt"
        className="mb-1 block text-[10px] uppercase tracking-wide text-[var(--text-muted)]"
      >
        Custom
      </label>
      <div className="flex gap-1">
        <input
          id="custom-remind-dt"
          type="datetime-local"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="min-w-0 flex-1 rounded border border-[var(--border)] bg-[var(--message-bg)] px-1.5 py-1 text-[11px] text-[var(--text-primary)]"
        />
        <button
          type="button"
          disabled={!valid}
          onClick={() => {
            if (valid) onPick(parsed);
          }}
          className="rounded bg-[var(--accent)] px-2 py-1 text-[11px] font-medium text-white transition-colors disabled:opacity-40"
        >
          Set
        </button>
      </div>
    </div>
  );
}
