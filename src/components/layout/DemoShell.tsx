"use client";

import { useEffect } from "react";
import { useWorkspaceStore } from "@/store/workspace";
import { mockTeams, mockChannels, mockChats } from "@/lib/mock/data";
import { DemoSidebar } from "@/components/sidebar/DemoSidebar";
import { DemoWorkspaceBar } from "@/components/sidebar/DemoWorkspaceBar";
import { DemoChannelView } from "@/components/messages/DemoChannelView";
import { DemoChatView } from "@/components/messages/DemoChatView";
import Link from "next/link";

export function DemoShell() {
  const { setTeams, setChannels, setChats, setActiveTeam, activeTeamId, activeChannelId, activeChatId } =
    useWorkspaceStore();

  useEffect(() => {
    setTeams(mockTeams);
    mockTeams.forEach((t) => setChannels(t.id, mockChannels[t.id] ?? []));
    setChats(mockChats);
    setActiveTeam(mockTeams[0].id);
  }, []);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Demo banner */}
      <div className="flex items-center justify-between bg-[#1164a3] px-4 py-1.5 text-sm text-white">
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

      <div className="flex flex-1 overflow-hidden bg-[#1a1d21]">
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
      </div>
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
