"use client";

import { useWorkspaceStore } from "@/store/workspace";
import { Hash, Lock, MessageSquare, ChevronDown, ChevronRight, Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { SearchModal } from "@/components/modals/SearchModal";
import { Avatar } from "@/components/ui/Avatar";
import { PresenceDot } from "@/components/ui/PresenceDot";
import { DemoUserFooter } from "./DemoUserFooter";

export function DemoSidebar() {
  const { teams, activeTeamId, channels, chats, presenceMap, unreadCounts, setActiveChannel, setActiveChat, activeChannelId, activeChatId, markRead } =
    useWorkspaceStore();
  const [channelsOpen, setChannelsOpen] = useState(true);
  const [dmsOpen, setDmsOpen] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);

  const activeTeam = teams.find((t) => t.id === activeTeamId);
  const teamChannels = activeTeamId ? (channels[activeTeamId] ?? []) : [];
  const activeChannel = teamChannels.find((channel) => channel.id === activeChannelId);
  const activeChat = chats.find((chat) => chat.id === activeChatId);
  const searchGroupName = activeChannel
    ? `Messages in #${activeChannel.displayName}`
    : activeChat
      ? `Messages in ${activeChat.topic ?? activeChat.members?.map((member) => member.displayName).join(", ") ?? "DM"}`
      : "Messages";

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        setSearchOpen(true);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="flex w-[260px] flex-shrink-0 flex-col overflow-hidden bg-[#19171d]">
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
                active={activeChannelId === ch.id}
                unreadCount={unreadCounts[ch.id] ?? 0}
                onClick={() => {
                  markRead(ch.id);
                  setActiveChannel(ch.id);
                }}
              />
            ))}
        </div>

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
            chats.map((chat) => {
              const label =
                chat.topic ?? chat.members?.map((m) => m.displayName).join(", ") ?? "DM";
              return (
                <SidebarItem
                  key={chat.id}
                  label={label}
                  icon={<ChatAvatar chat={chat} presenceMap={presenceMap} />}
                  active={activeChatId === chat.id}
                  unreadCount={unreadCounts[chat.id] ?? 0}
                  onClick={() => {
                    markRead(chat.id);
                    setActiveChat(chat.id);
                  }}
                />
              );
            })}
        </div>
      </div>

      <DemoUserFooter availability={presenceMap.you ?? "Available"} />
      <SearchModal
        open={searchOpen}
        onOpenChange={setSearchOpen}
        teamName={activeTeam?.displayName ?? "Teamsly"}
        channels={teamChannels}
        chats={chats}
        messages={[]}
        messageGroupName={searchGroupName}
        onSelectChannel={(channelId) => {
          markRead(channelId);
          setActiveChannel(channelId);
        }}
        onSelectChat={(chatId) => {
          markRead(chatId);
          setActiveChat(chatId);
        }}
        onSelectMessage={() => {
          // Messages shown are from the current view; closing the modal
          // is sufficient since the user is already in that conversation.
        }}
      />
    </div>
  );
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

function SidebarItem({
  label, icon, active, unreadCount = 0, onClick,
}: {
  label: string; icon: React.ReactNode; active: boolean; unreadCount?: number; onClick: () => void;
}) {
  const unread = unreadCount > 0 && !active;

  return (
    <button
      onClick={onClick}
      className={cn(
        "mx-2 flex h-7 w-[calc(100%-16px)] items-center gap-2 rounded-md px-2 text-[15px] transition-colors duration-[80ms] ease-out",
        active ? "bg-[#0F5A8F] text-white" : "text-[#ababad] hover:bg-[#27292d] hover:text-white"
      )}
    >
      <span className="flex-shrink-0 opacity-70">{icon}</span>
      <span className={cn("truncate", unread && "font-black text-white")}>{label}</span>
      {unread && (
        <span className="ml-auto flex h-[18px] min-w-[18px] flex-shrink-0 scale-100 items-center justify-center rounded-full bg-[#cd2553] px-[5px] text-[11px] font-bold text-white transition-transform duration-150">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </button>
  );
}
