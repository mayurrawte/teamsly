"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, HelpCircle } from "lucide-react";
import { useWorkspaceStore } from "@/store/workspace";
import { mockTeams, mockChannels, mockChats, mockPresence, mockUnreadCounts } from "@/lib/mock/data";
import { DemoSidebar } from "@/components/sidebar/DemoSidebar";
import { DemoWorkspaceBar } from "@/components/sidebar/DemoWorkspaceBar";
import { LeftRail } from "@/components/layout/LeftRail";
import { MemberPanel } from "@/components/layout/MemberPanel";
import { DemoChannelView } from "@/components/messages/DemoChannelView";
import { DemoChatView } from "@/components/messages/DemoChatView";
import { JumpToSwitcher, type JumpToItem } from "@/components/modals/JumpToSwitcher";
import { Logo } from "@/components/ui/Logo";
import { ToastViewport } from "@/components/ui/ToastViewport";
import Link from "next/link";

export function DemoShell() {
  const { teams, channels, chats, setTeams, setChannels, setChats, setActiveTeam, activeTeamId, activeChannelId, activeChatId, setActiveChannel, setActiveChat, setPresenceMap, initUnreadCounts, markRead, setCurrentUser } =
    useWorkspaceStore();
  const [jumpToOpen, setJumpToOpen] = useState(false);

  useEffect(() => {
    setTeams(mockTeams);
    mockTeams.forEach((t) => setChannels(t.id, mockChannels[t.id] ?? []));
    setChats(mockChats);
    setCurrentUser({ id: "you", displayName: "You" });
    setPresenceMap(mockPresence);
    initUnreadCounts(mockUnreadCounts);
    setActiveTeam(mockTeams[0].id);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setJumpToOpen(true);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const jumpItems = useMemo<JumpToItem[]>(() => {
    const teamName = teams.find((team) => team.id === activeTeamId)?.displayName ?? "Teamsly";
    const teamChannels = activeTeamId ? (channels[activeTeamId] ?? []) : [];
    return [
      ...teamChannels.map((channel) => ({
        id: channel.id,
        type: "channel" as const,
        label: channel.displayName,
        subtitle: teamName,
        private: channel.membershipType === "private",
        onSelect: () => {
          markRead(channel.id);
          setActiveChannel(channel.id);
        },
      })),
      ...chats.map((chat) => ({
        id: chat.id,
        type: "dm" as const,
        label: chat.topic ?? chat.members?.map((member) => member.displayName).join(", ") ?? "DM",
        subtitle: chat.chatType === "group" ? "Group DM" : "Direct message",
        onSelect: () => {
          markRead(chat.id);
          setActiveChat(chat.id);
        },
      })),
    ];
  }, [activeTeamId, channels, chats, markRead, setActiveChannel, setActiveChat, teams]);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Demo banner */}
      <div className="flex items-center justify-between bg-[#0F5A8F] px-4 py-1.5 text-sm text-white">
        <span>
          <span className="font-semibold">Demo mode</span> — mock data, no Microsoft account needed
        </span>
        <Link
          href="/"
          className="rounded bg-white/20 px-3 py-0.5 text-xs font-semibold hover:bg-white/30"
        >
          Sign in with real account →
        </Link>
      </div>

      {/* Global top search bar */}
      <header className="flex h-[50px] flex-shrink-0 items-center gap-3 border-b border-[#3f4144] bg-[#19171d] px-4">
        {/* Left: logomark */}
        <div className="flex w-[56px] flex-shrink-0 items-center justify-center">
          <Logo size={22} className="text-[#4da3e0]" />
        </div>

        {/* Center: non-functional search bar (demo only) */}
        <div className="flex flex-1 items-center justify-center">
          <div
            aria-label="Search (not functional in demo)"
            className="flex h-8 w-full max-w-[480px] items-center gap-2 rounded-md border border-[#3f4144] bg-[#2b2d31] px-3 text-sm text-[#6c6f75] opacity-60 cursor-default"
          >
            <Search className="h-4 w-4 flex-shrink-0 text-[#6c6f75]" />
            <span className="flex-1 text-left">Search Teamsly</span>
          </div>
        </div>

        {/* Right: help affordance placeholder */}
        <div className="flex w-[56px] flex-shrink-0 items-center justify-end">
          <button
            type="button"
            aria-label="Help"
            title="Help"
            className="flex h-8 w-8 items-center justify-center rounded-md text-[#ababad] transition-colors hover:bg-[#2b2d31] hover:text-[#d1d2d3]"
          >
            <HelpCircle className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden bg-[#1a1d21]">
        <LeftRail />
        <DemoWorkspaceBar />
        <DemoSidebar />
        <main className="flex flex-1 flex-col overflow-hidden bg-[#222529]">
          {activeChatId ? (
            <DemoChatView chatId={activeChatId} />
          ) : activeChannelId ? (
            <DemoChannelView channelId={activeChannelId} />
          ) : (
            <EmptyState />
          )}
        </main>
        <MemberPanel />
      </div>
      <JumpToSwitcher open={jumpToOpen} onOpenChange={setJumpToOpen} items={jumpItems} />
      <ToastViewport />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2">
      <p className="text-lg font-semibold text-[#d1d2d3]">Welcome to Teamsly</p>
      <p className="text-sm text-[#6c6f75]">Pick a channel from the sidebar</p>
    </div>
  );
}
