"use client";

import { useWorkspaceStore } from "@/store/workspace";
import { useRouter, useParams } from "next/navigation";
import { Hash, Lock, MessageSquare, ChevronDown, ChevronRight } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { UserFooter } from "./UserFooter";

export function Sidebar() {
  const { teams, activeTeamId, channels, chats, setChats, setActiveChannel, setActiveChat } =
    useWorkspaceStore();
  const router = useRouter();
  const params = useParams();
  const [channelsOpen, setChannelsOpen] = useState(true);
  const [dmsOpen, setDmsOpen] = useState(true);

  const activeTeam = teams.find((t) => t.id === activeTeamId);
  const teamChannels = activeTeamId ? (channels[activeTeamId] ?? []) : [];

  useEffect(() => {
    fetch("/api/chats")
      .then((r) => r.json())
      .then((data: MSChat[]) => setChats(data));
  }, []);

  function goToChannel(channelId: string) {
    if (!activeTeamId) return;
    setActiveChannel(channelId);
    router.push(`/app/t/${activeTeamId}/${channelId}`);
  }

  function goToChat(chatId: string) {
    setActiveChat(chatId);
    router.push(`/app/dm/${chatId}`);
  }

  return (
    <div className="flex w-[260px] flex-shrink-0 flex-col overflow-hidden bg-[#19171d]">
      {/* Team name header */}
      <div className="flex h-[49px] items-center justify-between px-4 shadow-sm">
        <span className="truncate text-[15px] font-bold text-white">
          {activeTeam?.displayName ?? "Teamsly"}
        </span>
        <ChevronDown className="h-4 w-4 text-[#ababad]" />
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {/* Channels section */}
        <div className="mb-1">
          <button
            onClick={() => setChannelsOpen((v) => !v)}
            className="flex w-full items-center gap-1 px-4 py-1 text-[13px] font-semibold text-[#ababad] hover:text-white"
          >
            {channelsOpen ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            Channels
          </button>

          {channelsOpen &&
            teamChannels.map((ch) => (
              <SidebarItem
                key={ch.id}
                label={ch.displayName}
                icon={
                  ch.membershipType === "private" ? (
                    <Lock className="h-3.5 w-3.5" />
                  ) : (
                    <Hash className="h-3.5 w-3.5" />
                  )
                }
                active={params?.channelId === ch.id}
                onClick={() => goToChannel(ch.id)}
              />
            ))}
        </div>

        {/* DMs section */}
        <div className="mt-3">
          <button
            onClick={() => setDmsOpen((v) => !v)}
            className="flex w-full items-center gap-1 px-4 py-1 text-[13px] font-semibold text-[#ababad] hover:text-white"
          >
            {dmsOpen ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            Direct Messages
          </button>

          {dmsOpen &&
            chats.slice(0, 20).map((chat) => (
              <SidebarItem
                key={chat.id}
                label={getChatLabel(chat)}
                icon={<MessageSquare className="h-3.5 w-3.5" />}
                active={params?.chatId === chat.id}
                onClick={() => goToChat(chat.id)}
              />
            ))}
        </div>
      </div>

      <UserFooter />
    </div>
  );
}

function SidebarItem({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 px-4 py-1 text-[15px] transition",
        active
          ? "bg-[#1164a3] text-white"
          : "text-[#ababad] hover:bg-[#27292d] hover:text-white"
      )}
    >
      <span className="flex-shrink-0 opacity-70">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}

function getChatLabel(chat: MSChat): string {
  if (chat.topic) return chat.topic;
  const members = chat.members ?? [];
  if (members.length > 0) return members.map((m) => m.displayName).join(", ");
  return "Direct Message";
}
