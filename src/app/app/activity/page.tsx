"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useWorkspaceStore } from "@/store/workspace";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";
import { formatMessageTime } from "@/lib/utils/dates";
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getChatLabel(chat: MSChat, currentUserId: string): string {
  if (chat.topic) return chat.topic;
  const members = chat.members ?? [];
  if (members.length === 0) return "Direct Message";
  const others = members.filter((m) => (m.userId ?? m.id) !== currentUserId);
  if (others.length === 0) return members[0]?.displayName ?? "You";
  return others.map((m) => m.displayName).join(", ");
}

function getFirstOtherMember(
  chat: MSChat,
  currentUserId: string
): MSChatMember | undefined {
  const members = chat.members ?? [];
  const others = members.filter((m) => (m.userId ?? m.id) !== currentUserId);
  return others[0] ?? members[0];
}

// ---------------------------------------------------------------------------
// Tab item renderer
// ---------------------------------------------------------------------------

type TabDef = { id: ActivityTab; label: string };

const TABS: TabDef[] = [
  { id: "all", label: "All" },
  { id: "mentions", label: "Mentions" },
  { id: "threads", label: "Threads" },
  { id: "reactions", label: "Reactions" },
  { id: "dms", label: "DMs" },
];

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

function EmptyState({ tab }: { tab: ActivityTab }) {
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
      sub: "Mentions require server-side message scanning — coming in a future update.",
    },
    threads: {
      heading: "No thread activity",
      sub: "Thread tracking requires a thread model — coming in a future update.",
    },
    reactions: {
      heading: "No reactions",
      sub: "Reaction notifications require server-side scanning — coming in a future update.",
    },
  };

  const msg = messages[tab];

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 text-center">
      <CheckCheck className="h-8 w-8 text-[#3f4144]" strokeWidth={1.5} />
      <p className="text-[14px] font-semibold text-[#d1d2d3]">{msg.heading}</p>
      <p className="max-w-xs text-[12px] leading-relaxed text-[#6c6f75]">{msg.sub}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stub section (Mentions / Threads / Reactions)
// ---------------------------------------------------------------------------

function StubSection({ label }: { label: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 text-center">
      <Bell className="h-8 w-8 text-[#3f4144]" strokeWidth={1.5} />
      <p className="text-[14px] font-semibold text-[#d1d2d3]">{label}</p>
      <p className="max-w-xs text-[12px] leading-relaxed text-[#6c6f75]">
        This tab requires server-side message scanning to detect {label.toLowerCase()} —
        coming in a future update.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ActivityPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActivityTab>("all");

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

  // Build activity items from store data
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

  const visibleItems = activeTab === "dms" ? dmItems : allItems;
  const isStubTab =
    activeTab === "mentions" ||
    activeTab === "threads" ||
    activeTab === "reactions";

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-[#3f4144] px-4 pb-0 pt-4">
        <h1 className="mb-3 text-[18px] font-bold text-white">Activity</h1>

        {/* Tab row */}
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
      </div>

      {/* Feed */}
      <div
        role="tabpanel"
        className="flex flex-1 flex-col overflow-y-auto"
      >
        {isStubTab ? (
          <StubSection
            label={
              activeTab === "mentions"
                ? "Mentions"
                : activeTab === "threads"
                  ? "Thread replies"
                  : "Reactions"
            }
          />
        ) : visibleItems.length === 0 ? (
          <EmptyState tab={activeTab} />
        ) : (
          <div className="divide-y divide-[#3f4144]/50">
            {visibleItems.map((item) => (
              <ActivityRow
                key={item.id}
                item={item}
                onClick={() => navigate(item)}
              />
            ))}

            {/* Footer nudge */}
            <p className="px-4 py-3 text-center text-[11px] text-[#6c6f75]">
              Mentions, thread replies, and reactions require server-side scanning
              — coming in a future update.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
