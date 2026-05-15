"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useWorkspaceStore } from "@/store/workspace";
import { useToastStore } from "@/store/toasts";
import { usePreferencesStore } from "@/store/preferences";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";
import { formatMessageTime } from "@/lib/utils/dates";
import { getChatLabel, getFirstOtherMember } from "@/lib/utils/chat-label";
import {
  MessageSquare,
  CheckCheck,
  AtSign,
  GitBranch,
  Smile,
  Bell,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ActivityTab = "all" | "mentions" | "threads" | "reactions" | "dms";

interface ActivityItem {
  id: string;
  type: "dm" | "channel_unread" | "mention" | "thread" | "reaction";
  senderId: string;
  senderName: string;
  summary: string;
  timestamp: string;
  href: string;
}

interface ScanResponse {
  mentions: ActivityItem[];
  threads: ActivityItem[];
  reactions: ActivityItem[];
  partial?: boolean;
}

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

type TabDef = { id: ActivityTab; label: string };

const TABS: TabDef[] = [
  { id: "all", label: "All" },
  { id: "mentions", label: "Mentions" },
  { id: "threads", label: "Threads" },
  { id: "reactions", label: "Reactions" },
  { id: "dms", label: "DMs" },
];

const SCAN_TABS: ActivityTab[] = ["all", "mentions", "threads", "reactions"];
const SCAN_POLL_MS = 60 * 1000;

// ---------------------------------------------------------------------------
// Icon for activity type
// ---------------------------------------------------------------------------

function ActivityTypeIcon({ type }: { type: ActivityItem["type"] }) {
  const cls = "h-3.5 w-3.5 flex-shrink-0";
  switch (type) {
    case "dm":
      return <MessageSquare className={cn(cls, "text-[#4da3e0]")} />;
    case "channel_unread":
      return <Bell className={cn(cls, "text-[#4da3e0]")} />;
    case "mention":
      return <AtSign className={cn(cls, "text-[#f0b429]")} />;
    case "thread":
      return <GitBranch className={cn(cls, "text-[#57bb8a]")} />;
    case "reaction":
      return <Smile className={cn(cls, "text-[#cd5b45]")} />;
  }
}

// ---------------------------------------------------------------------------
// Single activity row
// ---------------------------------------------------------------------------

function ActivityRow({
  item,
  onClick,
}: {
  item: ActivityItem;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors duration-[80ms] ease-out hover:bg-white/5 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#0F5A8F]"
    >
      {/* Avatar */}
      <div className="relative mt-0.5 flex-shrink-0">
        <Avatar userId={item.senderId} displayName={item.senderName} size={36} />
        <span className="absolute -bottom-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-[#222529] p-[3px]">
          <ActivityTypeIcon type={item.type} />
        </span>
      </div>

      {/* Body */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[13px] font-semibold text-[#d1d2d3] group-hover:text-white">
            {item.senderName}
          </span>
          <span className="flex-shrink-0 text-[11px] text-[#6c6f75]">
            {formatMessageTime(item.timestamp)}
          </span>
        </div>
        <p className="mt-0.5 truncate text-[12px] text-[#ababad]">{item.summary}</p>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ tab, unreadOnly }: { tab: ActivityTab; unreadOnly: boolean }) {
  const messages: Record<ActivityTab, { heading: string; sub: string }> = {
    all: {
      heading: "All caught up",
      sub: "No new activity. Check back after some conversations heat up.",
    },
    dms: {
      heading: "No unread DMs",
      sub: "You have read all your direct messages.",
    },
    mentions: {
      heading: "No mentions",
      sub: "Nobody @-mentioned you in your recent chats or channels.",
    },
    threads: {
      heading: "No thread activity",
      sub: "No replies on your recent channel messages.",
    },
    reactions: {
      heading: "No reactions",
      sub: "Nobody reacted to your recent messages.",
    },
  };

  const msg = messages[tab];

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 text-center">
      <CheckCheck className="h-8 w-8 text-[#3f4144]" strokeWidth={1.5} />
      <p className="text-[14px] font-semibold text-[#d1d2d3]">{msg.heading}</p>
      <p className="max-w-xs text-[12px] leading-relaxed text-[#6c6f75]">{msg.sub}</p>
      {unreadOnly && (
        <p className="mt-1 max-w-xs text-[11px] text-[#6c6f75]">
          “Unread only” is on — turn it off to see read items.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton — 6 rows
// ---------------------------------------------------------------------------

function ScanSkeleton() {
  return (
    <div className="flex flex-1 flex-col">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex items-start gap-3 px-4 py-3"
          aria-hidden="true"
        >
          <div className="skeleton h-9 w-9 flex-shrink-0 rounded-md" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="skeleton h-3 w-1/3 rounded" />
            <div className="skeleton h-3 w-3/4 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

/**
 * Pull the underlying chat or channel id out of an activity item so we can
 * cross-reference `unreadCounts` for the Unread-only filter.
 *
 *   /app/dm/{chatId}             → { kind: "chat",    id: chatId }
 *   /app/t/{teamId}/{channelId}  → { kind: "channel", id: channelId }
 *
 * Returns null for malformed hrefs so the filter falls back to "include".
 */
function unreadKeyFromHref(href: string): { kind: "chat" | "channel"; id: string } | null {
  const dmMatch = /^\/app\/dm\/([^/]+)$/.exec(href);
  if (dmMatch) return { kind: "chat", id: dmMatch[1] };
  const chMatch = /^\/app\/t\/[^/]+\/([^/]+)$/.exec(href);
  if (chMatch) return { kind: "channel", id: chMatch[1] };
  return null;
}

export default function ActivityPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActivityTab>("all");
  const showToast = useToastStore((s) => s.showToast);
  const unreadOnly = usePreferencesStore((s) => s.activityUnreadOnly);
  const setUnreadOnly = usePreferencesStore((s) => s.setActivityUnreadOnly);

  const {
    chats,
    unreadCounts,
    channels,
    activeTeamId,
    teams,
    currentUserId,
    markRead,
    setActiveChat,
    setActiveChannel,
  } = useWorkspaceStore();

  // -----------------------------------------------------------------------
  // Scan state — fetched on demand when a scan tab is selected.
  //
  // The endpoint walks the user's recent chat + channel messages so it's
  // Graph-throttle-heavy. We rely on its 60s server-side cache + a matching
  // 60s client poll so re-renders / tab switches are cheap.
  // -----------------------------------------------------------------------

  const [scanData, setScanData] = useState<ScanResponse | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const scanLoadedRef = useRef(false);

  // Reset cached state when the active team changes so the next visit
  // refetches against the new scope.
  useEffect(() => {
    scanLoadedRef.current = false;
    setScanData(null);
  }, [activeTeamId]);

  const fetchScan = useCallback(
    async (signal?: AbortSignal) => {
      const isFirstLoad = !scanLoadedRef.current;
      if (isFirstLoad) setScanLoading(true);
      try {
        const qs = activeTeamId
          ? `?teamId=${encodeURIComponent(activeTeamId)}`
          : "";
        const res = await fetch(`/api/activity/scan${qs}`, { signal });
        if (res.status === 401) {
          // The reconnect banner in AppShell already handles refresh-token
          // failure visually — don't pile on with a toast.
          return;
        }
        if (!res.ok) {
          throw new Error(`scan failed: ${res.status}`);
        }
        const data = (await res.json()) as ScanResponse;
        setScanData(data);
        scanLoadedRef.current = true;
      } catch (err) {
        if (signal?.aborted) return;
        console.error("[activity] scan failed:", err);
        if (isFirstLoad) {
          showToast({
            title: "Could not load activity",
            description: "Try again in a moment.",
            tone: "error",
          });
        }
      } finally {
        if (isFirstLoad) setScanLoading(false);
      }
    },
    [activeTeamId, showToast]
  );

  const isScanTab = SCAN_TABS.includes(activeTab);

  // Fetch on entering a scan tab + every 60s while we're on one.
  useEffect(() => {
    if (!isScanTab) return;
    const controller = new AbortController();
    fetchScan(controller.signal);
    const interval = window.setInterval(() => {
      fetchScan(controller.signal);
    }, SCAN_POLL_MS);
    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [isScanTab, fetchScan]);

  // -----------------------------------------------------------------------
  // Build store-driven items (All + DMs)
  // -----------------------------------------------------------------------

  const allItems = useMemo<ActivityItem[]>(() => {
    const items: ActivityItem[] = [];

    // Unread DMs
    for (const chat of chats) {
      const count = unreadCounts[chat.id] ?? 0;
      if (count === 0) continue;

      const label = getChatLabel(chat, currentUserId);
      const other = getFirstOtherMember(chat, currentUserId);
      const senderId = other ? (other.userId ?? other.id) : chat.id;
      const senderName = other ? other.displayName : label;

      items.push({
        id: `dm-${chat.id}`,
        type: "dm",
        senderId,
        senderName,
        summary: `${count} unread message${count > 1 ? "s" : ""}`,
        timestamp: chat.lastUpdatedDateTime,
        href: `/app/dm/${chat.id}`,
      });
    }

    // Unread channels
    const teamChannels = activeTeamId ? (channels[activeTeamId] ?? []) : [];
    for (const ch of teamChannels) {
      const count = unreadCounts[ch.id] ?? 0;
      if (count === 0) continue;

      const team = teams.find((t) => t.id === activeTeamId);
      items.push({
        id: `ch-${ch.id}`,
        type: "channel_unread",
        senderId: ch.id,
        senderName: ch.displayName,
        summary: `${count} unread message${count > 1 ? "s" : ""} in #${ch.displayName}${team ? ` · ${team.displayName}` : ""}`,
        // channels don't carry a timestamp in our model; use now
        timestamp: new Date().toISOString(),
        href: activeTeamId ? `/app/t/${activeTeamId}/${ch.id}` : "/app",
      });
    }

    // Sort most-recent first — DMs have a real timestamp; channels use now
    items.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return items;
  }, [chats, unreadCounts, channels, activeTeamId, teams, currentUserId]);

  const dmItems = useMemo(
    () => allItems.filter((i) => i.type === "dm"),
    [allItems]
  );

  function navigate(item: ActivityItem) {
    if (item.type === "dm") {
      const chatId = item.id.replace("dm-", "");
      markRead(chatId);
      setActiveChat(chatId);
    } else if (item.type === "channel_unread") {
      const channelId = item.id.replace("ch-", "");
      markRead(channelId);
      setActiveChannel(channelId);
    }
    router.push(item.href);
  }

  // -----------------------------------------------------------------------
  // Resolve visible items per tab
  // -----------------------------------------------------------------------

  let visibleItems: ActivityItem[] = [];
  if (activeTab === "all") {
    // Merge store-driven unreads with scan results, sort newest first.
    const scanItems: ActivityItem[] = [
      ...(scanData?.mentions ?? []),
      ...(scanData?.threads ?? []),
      ...(scanData?.reactions ?? []),
    ];
    const merged = [...allItems, ...scanItems];
    const seen = new Set<string>();
    visibleItems = merged.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
    visibleItems.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  } else if (activeTab === "dms") {
    visibleItems = dmItems;
  } else if (activeTab === "mentions") {
    visibleItems = scanData?.mentions ?? [];
  } else if (activeTab === "threads") {
    visibleItems = scanData?.threads ?? [];
  } else if (activeTab === "reactions") {
    visibleItems = scanData?.reactions ?? [];
  }

  // Unread-only filter — applies to every tab.
  //
  // For `all` / `dms` / `channel_unread` items: those are *built* from
  // unreadCounts already, so the filter is effectively idempotent — keeping
  // it here keeps the behaviour consistent and lets the user notice the
  // filter is "on" even when there's nothing to filter out.
  //
  // For scan-tab items (mentions / threads / reactions): items don't carry
  // their own unread state, so we look up the parent chat/channel via the
  // item's `href`. An item is "unread" iff its parent has unreadCounts > 0.
  if (unreadOnly) {
    visibleItems = visibleItems.filter((item) => {
      if (item.type === "dm") {
        const chatId = item.id.replace("dm-", "");
        return (unreadCounts[chatId] ?? 0) > 0;
      }
      if (item.type === "channel_unread") {
        const channelId = item.id.replace("ch-", "");
        return (unreadCounts[channelId] ?? 0) > 0;
      }
      // mention / thread / reaction — derive id from href.
      const key = unreadKeyFromHref(item.href);
      if (!key) return true; // malformed href → don't hide it
      return (unreadCounts[key.id] ?? 0) > 0;
    });
  }

  const showSkeleton = isScanTab && scanLoading && !scanLoadedRef.current;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-[#3f4144] px-4 pb-0 pt-4">
        <h1 className="mb-3 text-[18px] font-bold text-white">Activity</h1>

        {/* Tab row + Unread-only toggle */}
        <div className="flex items-end justify-between gap-2">
          <div className="flex gap-0" role="tablist" aria-label="Activity filters">
            {TABS.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "relative px-3 pb-2.5 pt-1 text-[13px] font-medium transition-colors duration-[80ms] ease-out focus:outline-none focus-visible:ring-1 focus-visible:ring-[#0F5A8F]",
                    active
                      ? "text-white"
                      : "text-[#ababad] hover:text-[#d1d2d3]"
                  )}
                >
                  {tab.label}
                  {active && (
                    <span
                      aria-hidden="true"
                      className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t-full bg-[#0F5A8F]"
                    />
                  )}
                </button>
              );
            })}
          </div>
          <label className="mb-2 flex cursor-pointer select-none items-center gap-2 text-[12px] text-[#ababad] hover:text-[#d1d2d3]">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(event) => setUnreadOnly(event.target.checked)}
              className="h-3.5 w-3.5 cursor-pointer accent-[#0F5A8F]"
            />
            Unread only
          </label>
        </div>
      </div>

      {/* Feed */}
      <div
        role="tabpanel"
        className="flex flex-1 flex-col overflow-y-auto"
      >
        {showSkeleton ? (
          <ScanSkeleton />
        ) : visibleItems.length === 0 ? (
          <EmptyState tab={activeTab} unreadOnly={unreadOnly} />
        ) : (
          <div className="divide-y divide-[#3f4144]/50">
            {visibleItems.map((item) => (
              <ActivityRow
                key={item.id}
                item={item}
                onClick={() => navigate(item)}
              />
            ))}

            {isScanTab && scanData?.partial && (
              <p className="px-4 py-3 text-center text-[11px] text-[#6c6f75]">
                Showing partial results — Microsoft Graph throttled the scan.
                Refreshing in 60 s.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
