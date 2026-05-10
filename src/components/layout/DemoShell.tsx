"use client";

import { useEffect, useMemo, useState } from "react";
import { useWorkspaceStore } from "@/store/workspace";
import { mockTeams, mockChannels, mockChats, mockPresence, mockUnreadCounts } from "@/lib/mock/data";
import { DemoSidebar } from "@/components/sidebar/DemoSidebar";
import { DemoWorkspaceBar } from "@/components/sidebar/DemoWorkspaceBar";
import { DemoChannelView } from "@/components/messages/DemoChannelView";
import { DemoChatView } from "@/components/messages/DemoChatView";
import { JumpToSwitcher, type JumpToItem } from "@/components/modals/JumpToSwitcher";
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
      <JumpToSwitcher open={jumpToOpen} onOpenChange={setJumpToOpen} items={jumpItems} />
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
