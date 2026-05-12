"use client";

import { useWorkspaceStore } from "@/store/workspace";
import { useRouter, useParams } from "next/navigation";
import { Hash, Lock, MessageSquare, ChevronDown, ChevronRight, Plus, Search } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { UserFooter } from "./UserFooter";
import { SearchModal } from "@/components/modals/SearchModal";
import { Avatar } from "@/components/ui/Avatar";
import { PresenceDot } from "@/components/ui/PresenceDot";
import { useToastStore } from "@/store/toasts";

export function Sidebar() {
  const { teams, activeTeamId, activeChannelId, activeChatId, channels, chats, chatsNextLink, messages, presenceMap, unreadCounts, currentUserId, setChats, appendChats, setActiveChannel, setActiveChat, markRead, setPresenceMap } =
    useWorkspaceStore();
  const router = useRouter();
  const params = useParams();
  const [channelsOpen, setChannelsOpen] = useState(true);
  const [dmsOpen, setDmsOpen] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [loadingMoreChats, setLoadingMoreChats] = useState(false);
  const presenceErrorShownRef = useRef(false);
  const showToast = useToastStore((state) => state.showToast);

  const activeTeam = teams.find((t) => t.id === activeTeamId);
  const teamChannels = activeTeamId ? (channels[activeTeamId] ?? []) : [];
  const activeChannel = teamChannels.find((channel) => channel.id === activeChannelId);
  const activeChat = chats.find((chat) => chat.id === activeChatId);
  const searchGroupName = activeChannel
    ? `Messages in #${activeChannel.displayName}`
    : activeChat
      ? `Messages in ${getChatLabel(activeChat, currentUserId)}`
      : "Messages";

  useEffect(() => {
    async function loadChats() {
      try {
        const response = await fetch("/api/chats");
        if (!response.ok) throw new Error("Failed to load chats");
        const data = (await response.json()) as { chats: MSChat[]; nextLink: string | null };
        setChats(data.chats, data.nextLink);
      } catch {
        showToast({ title: "Could not load direct messages", tone: "error" });
      }
    }

    loadChats();
  }, [setChats, showToast]);

  async function loadMoreChats() {
    if (!chatsNextLink || loadingMoreChats) return;
    setLoadingMoreChats(true);
    try {
      const url = `/api/chats?next=${encodeURIComponent(chatsNextLink)}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to load more chats");
      const data = (await response.json()) as { chats: MSChat[]; nextLink: string | null };
      appendChats(data.chats, data.nextLink);
    } catch {
      showToast({ title: "Could not load older direct messages", tone: "error" });
    } finally {
      setLoadingMoreChats(false);
    }
  }

  useEffect(() => {
    const userIds = [
      currentUserId,
      ...chats.flatMap((chat) => chat.members?.map((member) => member.userId ?? member.id) ?? []),
    ].filter(Boolean);
    if (userIds.length === 0) return;

    let cancelled = false;
    async function loadPresence() {
      try {
        const res = await fetch("/api/presence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userIds }),
        });
        if (!res.ok || cancelled) throw new Error("Failed to load presence");

        const presence = (await res.json()) as MSPresence[];
        setPresenceMap(
          Object.fromEntries(presence.map((item) => [item.id, item.availability]))
        );
      } catch {
        if (!cancelled && !presenceErrorShownRef.current) {
          presenceErrorShownRef.current = true;
          showToast({ title: "Could not load presence", tone: "error" });
        }
      }
    }

    loadPresence();
    const interval = window.setInterval(loadPresence, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [chats, currentUserId, setPresenceMap, showToast]);

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

  function goToChannel(channelId: string) {
    if (!activeTeamId) return;
    markRead(channelId);
    setActiveChannel(channelId);
    router.push(`/app/t/${activeTeamId}/${channelId}`);
  }

  function goToChat(chatId: string) {
    markRead(chatId);
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
                unreadCount={unreadCounts[ch.id] ?? 0}
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
            chats.map((chat) => (
              <SidebarItem
                key={chat.id}
                label={getChatLabel(chat, currentUserId)}
                icon={<ChatAvatar chat={chat} presenceMap={presenceMap} />}
                active={params?.chatId === chat.id}
                unreadCount={unreadCounts[chat.id] ?? 0}
                onClick={() => goToChat(chat.id)}
              />
            ))}

          {dmsOpen && chatsNextLink && (
            <button
              type="button"
              disabled={loadingMoreChats}
              onClick={loadMoreChats}
              className="mx-2 mt-0.5 flex h-7 w-[calc(100%-16px)] items-center gap-1.5 rounded-md px-2 text-[13px] text-[#6c6f75] transition-colors duration-[80ms] ease-out hover:bg-[#27292d] hover:text-[#ababad] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronDown className="h-3 w-3 flex-shrink-0" />
              <span>{loadingMoreChats ? "Loading..." : "Show older chats"}</span>
            </button>
          )}
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
        messageGroupName={searchGroupName}
        onSelectChannel={(channelId) => goToChannel(channelId)}
        onSelectChat={(chatId) => goToChat(chatId)}
        onSelectMessage={() => {
          // Messages shown are from the current view; closing the modal
          // is sufficient since the user is already in that conversation.
        }}
      />
    </div>
  );
}

function SidebarItem({
  label,
  icon,
  active,
  unreadCount = 0,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  unreadCount?: number;
  onClick: () => void;
}) {
  const unread = unreadCount > 0 && !active;

  return (
    <button
      onClick={onClick}
      className={cn(
        "mx-2 flex h-7 w-[calc(100%-16px)] items-center gap-2 rounded-md px-2 text-[15px] transition-colors duration-[80ms] ease-out",
        active
          ? "bg-[#0F5A8F] text-white"
          : "text-[#ababad] hover:bg-[#27292d] hover:text-white"
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

function getChatLabel(chat: MSChat, currentUserId: string): string {
  if (chat.topic) return chat.topic;

  const members = chat.members ?? [];
  if (members.length === 0) return "Direct Message";

  const otherMembers = members.filter((m) => (m.userId ?? m.id) !== currentUserId);

  if (otherMembers.length === 0) {
    const currentUserName = members[0]?.displayName ?? "You";
    return `${currentUserName} (you)`;
  }

  return otherMembers.map((m) => m.displayName).join(", ");
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
