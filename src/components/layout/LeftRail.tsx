"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  MessageSquare,
  Bell,
  Calendar,
  FolderOpen,
  Clock,
  MoreHorizontal,
  Settings,
  Info,
  MessageCircleQuestion,
  LogOut,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut } from "next-auth/react";
import { clearAll as clearMessageCache } from "@/lib/storage/message-cache";
import { clearAll as clearDraftsCache } from "@/lib/storage/drafts";
import { clearAll as clearBookmarksCache } from "@/lib/storage/bookmarks";
import { PreferencesModal } from "@/components/modals/PreferencesModal";
import { FeedbackModal } from "@/components/modals/FeedbackModal";
import { useWorkspaceStore } from "@/store/workspace";
import { useBookmarksStore } from "@/store/bookmarks";
import { useSearchStore } from "@/store/search";

async function handleSignOut() {
  // Drop the IDB caches before redirect so a previous user's messages,
  // drafts, and saved bookmarks don't leak to the next sign-in on the
  // same device.
  await Promise.all([clearMessageCache(), clearDraftsCache(), clearBookmarksCache()]);
  await signOut({ callbackUrl: "/" });
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  matchPrefix?: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/app", icon: Home, matchPrefix: "/app/t" },
  { label: "DMs", href: "/app/dm", icon: MessageSquare, matchPrefix: "/app/dm" },
  { label: "Activity", href: "/app/activity", icon: Bell, matchPrefix: "/app/activity" },
  { label: "Calendar", href: "/app/meetings", icon: Calendar, matchPrefix: "/app/meetings" },
  { label: "Files", href: "/app/files", icon: FolderOpen, matchPrefix: "/app/files" },
  { label: "Later", href: "/app/later", icon: Clock, matchPrefix: "/app/later" },
];

function isActive(pathname: string, item: NavItem): boolean {
  if (item.label === "Home") {
    // Active on /app exactly or /app/t/... (channel routes)
    return pathname === "/app" || pathname.startsWith("/app/t");
  }
  if (item.matchPrefix) {
    return pathname.startsWith(item.matchPrefix);
  }
  return pathname === item.href;
}

export function LeftRail() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  const openSearch = useSearchStore((s) => s.open);

  // Cmd+K global shortcut for search
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openSearch();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openSearch]);

  // Unread badge: sum of all unread channels + unread DMs
  const unreadCounts = useWorkspaceStore((s) => s.unreadCounts);
  const totalUnread = Object.values(unreadCounts).reduce((sum, n) => sum + n, 0);
  // Saved-message count for the Later rail badge. Subscribing to length only
  // means an unrelated bookmark mutation doesn't re-render the whole rail.
  const savedCount = useBookmarksStore((s) => s.bookmarks.length);

  // Close popover when clicking outside
  useEffect(() => {
    if (!moreOpen) return;
    function handleClick(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [moreOpen]);

  return (
    <nav
      aria-label="Primary navigation"
      className="flex w-[56px] flex-shrink-0 flex-col items-center bg-[#19171d] py-2"
    >
      {/* Top nav items */}
      <div className="flex flex-1 flex-col items-center gap-1 pt-1">
        {/* Search button — opens search modal from anywhere */}
        <button
          type="button"
          onClick={openSearch}
          aria-label="Search (Cmd+K)"
          title="Search (Cmd+K)"
          className="group flex w-full flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-medium transition-colors focus-ring text-[#a0a3a8] hover:text-[#d1d2d3]"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors group-hover:bg-white/8">
            <Search size={18} strokeWidth={1.8} className="text-[#a0a3a8] group-hover:text-[#d1d2d3]" />
          </span>
          <span className="leading-none text-[#a0a3a8] group-hover:text-[#d1d2d3]">Search</span>
        </button>

        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item);
          const Icon = item.icon;
          const activityBadge = item.label === "Activity" && totalUnread > 0 && !active;
          const laterBadge = item.label === "Later" && savedCount > 0 && !active;
          const showBadge = activityBadge || laterBadge;
          const badgeCount = activityBadge ? totalUnread : savedCount;
          return (
            <Link
              key={item.label}
              href={item.href}
              aria-label={
                showBadge
                  ? `${item.label}, ${badgeCount} ${activityBadge ? "unread" : "saved"}`
                  : item.label
              }
              title={item.label}
              className={cn(
                "group relative flex w-full flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-medium transition-colors focus-ring",
                active
                  ? "text-white"
                  : "text-[#a0a3a8] hover:text-[#d1d2d3]"
              )}
            >
              {/* Left border accent for active state */}
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-[#0F5A8F]"
                />
              )}
              {/* Icon container with hover/active fill */}
              <span className="relative">
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                    active
                      ? "bg-[#0F5A8F]/20"
                      : "group-hover:bg-white/8"
                  )}
                >
                  <Icon
                    size={18}
                    strokeWidth={active ? 2.2 : 1.8}
                    className={cn(
                      active ? "text-[#4da3e0]" : "text-[#a0a3a8] group-hover:text-[#d1d2d3]"
                    )}
                  />
                </span>
                {showBadge && (
                  <span
                    aria-hidden="true"
                    className="absolute -right-1 -top-1 flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-[#cd2553] px-[3px] text-[9px] font-bold leading-none text-white"
                  >
                    {badgeCount > 99 ? "99+" : badgeCount}
                  </span>
                )}
              </span>
              <span
                className={cn(
                  "leading-none",
                  active ? "text-white" : "text-[#a0a3a8] group-hover:text-[#d1d2d3]"
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Bottom: More */}
      <div ref={moreRef} className="relative mb-2 w-full">
        <button
          onClick={() => setMoreOpen((v) => !v)}
          aria-label="More options"
          title="More"
          aria-expanded={moreOpen}
          className={cn(
            "group flex w-full flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-medium transition-colors focus-ring",
            moreOpen ? "text-white" : "text-[#a0a3a8] hover:text-[#d1d2d3]"
          )}
        >
          <span
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
              moreOpen ? "bg-[#0F5A8F]/20" : "group-hover:bg-white/8"
            )}
          >
            <MoreHorizontal
              size={18}
              strokeWidth={moreOpen ? 2.2 : 1.8}
              className={moreOpen ? "text-[#4da3e0]" : "text-[#a0a3a8] group-hover:text-[#d1d2d3]"}
            />
          </span>
          <span className={moreOpen ? "text-white" : "text-[#a0a3a8] group-hover:text-[#d1d2d3] leading-none"}>
            More
          </span>
        </button>

        {/* Popover */}
        {moreOpen && (
          <div
            role="menu"
            aria-label="More options menu"
            className="absolute bottom-full left-full z-[200] mb-1 ml-1 w-48 overflow-hidden rounded-lg border border-white/10 bg-[#1e2027] py-1 shadow-xl"
          >
            <button
              role="menuitem"
              onClick={() => {
                setMoreOpen(false);
                setPrefsOpen(true);
              }}
              className="flex w-full items-center gap-3 px-3 py-2 text-sm text-[#d1d2d3] transition-colors hover:bg-white/8 focus-ring"
            >
              <Settings size={15} strokeWidth={1.8} className="shrink-0 text-[#a0a3a8]" />
              Preferences
            </button>
            <button
              role="menuitem"
              onClick={() => {
                setMoreOpen(false);
                setFeedbackOpen(true);
              }}
              className="flex w-full items-center gap-3 px-3 py-2 text-sm text-[#d1d2d3] transition-colors hover:bg-white/8 focus-ring"
            >
              <MessageCircleQuestion size={15} strokeWidth={1.8} className="shrink-0 text-[#a0a3a8]" />
              Send feedback…
            </button>
            <button
              role="menuitem"
              onClick={() => setMoreOpen(false)}
              className="flex w-full items-center gap-3 px-3 py-2 text-sm text-[#d1d2d3] transition-colors hover:bg-white/8 focus-ring"
            >
              <Info size={15} strokeWidth={1.8} className="shrink-0 text-[#a0a3a8]" />
              About Teamsly
            </button>
            <hr className="my-1 border-white/10" />
            <button
              role="menuitem"
              onClick={() => {
                setMoreOpen(false);
                void handleSignOut();
              }}
              className="flex w-full items-center gap-3 px-3 py-2 text-sm text-[#e8534a] transition-colors hover:bg-white/8 focus-ring"
            >
              <LogOut size={15} strokeWidth={1.8} className="shrink-0 text-[#e8534a]" />
              Sign out
            </button>
          </div>
        )}
      </div>

      <PreferencesModal open={prefsOpen} onOpenChange={setPrefsOpen} />
      <FeedbackModal open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </nav>
  );
}
