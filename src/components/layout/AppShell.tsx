"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { WorkspaceBar } from "@/components/sidebar/WorkspaceBar";
import { JumpToSwitcher, type JumpToItem } from "@/components/modals/JumpToSwitcher";
import { useWorkspaceStore } from "@/store/workspace";

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { teams, activeTeamId, channels, chats, setActiveChannel, setActiveChat, markRead } = useWorkspaceStore();
  const [jumpToOpen, setJumpToOpen] = useState(false);

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

  const items = useMemo<JumpToItem[]>(() => {
    const teamName = teams.find((team) => team.id === activeTeamId)?.displayName ?? "Teamsly";
    const teamChannels = activeTeamId ? (channels[activeTeamId] ?? []) : [];
    const channelItems = teamChannels.map((channel) => ({
      id: channel.id,
      type: "channel" as const,
      label: channel.displayName,
      subtitle: teamName,
      private: channel.membershipType === "private",
      onSelect: () => {
        if (!activeTeamId) return;
        markRead(channel.id);
        setActiveChannel(channel.id);
        router.push(`/app/t/${activeTeamId}/${channel.id}`);
      },
    }));
    const chatItems = chats.map((chat) => ({
      id: chat.id,
      type: "dm" as const,
      label: chat.topic ?? chat.members?.map((member) => member.displayName).join(", ") ?? "Direct Message",
      subtitle: chat.chatType === "group" ? "Group DM" : "Direct message",
      onSelect: () => {
        markRead(chat.id);
        setActiveChat(chat.id);
        router.push(`/app/dm/${chat.id}`);
      },
    }));
    return [...channelItems, ...chatItems];
  }, [activeTeamId, channels, chats, markRead, router, setActiveChannel, setActiveChat, teams]);

  return (
    <div className="flex h-screen overflow-hidden bg-[#1a1d21]">
      <WorkspaceBar />
      <Sidebar />
      <main className="flex flex-1 flex-col overflow-hidden bg-[#222529]">
        {children}
      </main>
      <JumpToSwitcher open={jumpToOpen} onOpenChange={setJumpToOpen} items={items} />
    </div>
  );
}
