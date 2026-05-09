"use client";

import { useWorkspaceStore } from "@/store/workspace";
import { useRouter, useParams } from "next/navigation";
import { Hash, Lock, MessageSquare, ChevronDown, ChevronRight, Plus, Search } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { UserFooter } from "./UserFooter";
import { SearchModal } from "@/components/modals/SearchModal";
import { Avatar } from "@/components/ui/Avatar";
import { PresenceDot } from "@/components/ui/PresenceDot";

export function Sidebar() {
  const { teams, activeTeamId, channels, chats, messages, presenceMap, setChats, setActiveChannel, setActiveChat } =
    useWorkspaceStore();
  const router = useRouter();
  const params = useParams();
  const [channelsOpen, setChannelsOpen] = useState(true);
  const [dmsOpen, setDmsOpen] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);

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
      <div className="flex h-[49px] items-center justify-between border-b border-[#3f4144] px-4 transition-colors duration-[80ms] ease-out hover:bg-[#27242c]">
        <span className="truncate text-[15px] font-black text-white">
          {activeTeam?.displayName ?? "Teamsly"}
        </span>
        <ChevronDown className="h-4 w-4 text-[#ababad]" />
      </div>

      <button
        type="button"
        onClick={() => setSearchOpen(true)}
        className="mx-3 my-2 flex h-7 items-center gap-2 rounded-md border border-[#565856] bg-[#2c2d30] px-2 text-left text-[13px] text-[#ababad] [transition:border-color_150ms_ease,background_150ms_ease] hover:border-white hover:bg-[#1a1d21] focus:border-white focus:bg-[#1a1d21] focus:outline-none"
      >
        <Search className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="truncate">Search...</span>
      </button>

      <div className="flex-1 overflow-y-auto pb-2">
        {/* Channels section */}
        <div className="mb-1">
          <button
            onClick={() => setChannelsOpen((v) => !v)}
            className="group/section flex w-full items-center justify-between px-4 py-1 text-[13px] font-bold text-[#ababad] transition-colors duration-[80ms] ease-out hover:text-white"
          >
            <span className="flex min-w-0 items-center gap-1">
              <ChevronRight
                className={cn(
                  "h-3 w-3 transition-transform duration-200 ease-out",
                  channelsOpen && "rotate-90"
                )}
              />
              <span className="truncate">Channels</span>
            </span>
            <Plus className="h-3.5 w-3.5 opacity-0 transition-opacity duration-150 group-hover/section:opacity-100" />
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
            className="group/section flex w-full items-center justify-between px-4 py-1 text-[13px] font-bold text-[#ababad] transition-colors duration-[80ms] ease-out hover:text-white"
          >
            <span className="flex min-w-0 items-center gap-1">
              <ChevronRight
                className={cn(
                  "h-3 w-3 transition-transform duration-200 ease-out",
                  dmsOpen && "rotate-90"
                )}
              />
              <span className="truncate">Direct Messages</span>
            </span>
            <Plus className="h-3.5 w-3.5 opacity-0 transition-opacity duration-150 group-hover/section:opacity-100" />
          </button>

          {dmsOpen &&
            chats.slice(0, 20).map((chat) => (
              <SidebarItem
                key={chat.id}
                label={getChatLabel(chat)}
                icon={<ChatAvatar chat={chat} presenceMap={presenceMap} />}
                active={params?.chatId === chat.id}
                onClick={() => goToChat(chat.id)}
              />
            ))}
        </div>
      </div>

      <UserFooter />
      <SearchModal
        open={searchOpen}
        onOpenChange={setSearchOpen}
        teamName={activeTeam?.displayName ?? "Teamsly"}
        channels={teamChannels}
        chats={chats}
        messages={messages}
      />
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
        "mx-2 flex h-7 w-[calc(100%-16px)] items-center gap-2 rounded-md px-2 text-[15px] transition-colors duration-[80ms] ease-out",
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

function ChatAvatar({
  chat,
  presenceMap,
}: {
  chat: MSChat;
  presenceMap: Record<string, MSPresence["availability"]>;
}) {
  if (chat.chatType === "group") return <MessageSquare className="h-3.5 w-3.5" />;

  const member = chat.members?.[0];
  if (!member) return <MessageSquare className="h-3.5 w-3.5" />;

  const userId = member.userId ?? member.id;
  return (
    <span className="relative flex h-6 w-6 flex-shrink-0">
      <Avatar userId={userId} displayName={member.displayName} size={24} />
      <PresenceDot availability={presenceMap[userId]} />
    </span>
  );
}
