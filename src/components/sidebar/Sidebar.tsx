"use client";

import { useWorkspaceStore } from "@/store/workspace";
import { useRouter, useParams } from "next/navigation";
import { Hash, Lock, MessageSquare, ChevronDown, ChevronRight, Plus, Search, Settings, UserPlus, Moon, LogOut, Inbox, GitBranch, Star, Check } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { UserFooter } from "./UserFooter";
import { SearchModal } from "@/components/modals/SearchModal";
import { PreferencesModal } from "@/components/modals/PreferencesModal";
import { Avatar } from "@/components/ui/Avatar";
import { PresenceDot } from "@/components/ui/PresenceDot";
import { useToastStore } from "@/store/toasts";
import { useSession } from "next-auth/react";
import { avatarInitials } from "@/lib/utils/avatar";

// localStorage keys for per-section collapsed state
const COLLAPSE_KEYS = {
  unreads: "teamsly.sidebar.unreads.collapsed",
  threads: "teamsly.sidebar.threads.collapsed",
  starred: "teamsly.sidebar.starred.collapsed",
} as const;

function writeCollapsed(key: string, collapsed: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, String(collapsed));
}

function useCollapsible(storageKey: string, defaultOpen = true): [boolean, () => void] {
  const [open, setOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return defaultOpen;
    const stored = window.localStorage.getItem(storageKey);
    if (stored === null) return defaultOpen;
    // stored is "true" when collapsed, so open = stored !== "true"
    return stored !== "true";
  });

  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      writeCollapsed(storageKey, !next);
      return next;
    });
  }, [storageKey]);

  return [open, toggle];
}

export function Sidebar() {
  const { teams, activeTeamId, activeChannelId, activeChatId, channels, chats, chatsNextLink, messages, presenceMap, unreadCounts, starredIds, currentUserId, setChats, appendChats, setActiveTeam, setActiveChannel, setActiveChat, markRead, setPresenceMap } =
    useWorkspaceStore();
  const router = useRouter();
  const params = useParams();
  const [channelsOpen, setChannelsOpen] = useState(true);
  const [dmsOpen, setDmsOpen] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loadingMoreChats, setLoadingMoreChats] = useState(false);
  const presenceErrorShownRef = useRef(false);
  const showToast = useToastStore((state) => state.showToast);
  const { data: session } = useSession();
  const sessionName = session?.user?.name ?? "User";
  const sessionEmail = session?.user?.email ?? undefined;
  const sessionInitials = avatarInitials(sessionName);

  const [unreadsOpen, toggleUnreads] = useCollapsible(COLLAPSE_KEYS.unreads, true);
  const [threadsOpen, toggleThreads] = useCollapsible(COLLAPSE_KEYS.threads, true);
  const [starredOpen, toggleStarred] = useCollapsible(COLLAPSE_KEYS.starred, true);

  const activeTeam = teams.find((t) => t.id === activeTeamId);
  const teamChannels = activeTeamId ? (channels[activeTeamId] ?? []) : [];
  const activeChannel = teamChannels.find((channel) => channel.id === activeChannelId);
  const activeChat = chats.find((chat) => chat.id === activeChatId);
  const searchGroupName = activeChannel
    ? `Messages in #${activeChannel.displayName}`
    : activeChat
      ? `Messages in ${getChatLabel(activeChat, currentUserId)}`
      : "Messages";

  // Unread items: channels + DMs with unreadCounts > 0
  const unreadChannelItems = teamChannels.filter((ch) => (unreadCounts[ch.id] ?? 0) > 0);
  const unreadChatItems = chats.filter((chat) => (unreadCounts[chat.id] ?? 0) > 0);
  const totalUnreads = unreadChannelItems.length + unreadChatItems.length;

  // Starred items: channels + DMs whose ids are in starredIds
  const starredChannelItems = teamChannels.filter((ch) => starredIds.includes(ch.id));
  const starredChatItems = chats.filter((chat) => starredIds.includes(chat.id));
  const totalStarred = starredChannelItems.length + starredChatItems.length;

  useEffect(() => {
    let cancelled = false;
    let toastShown = false;

    async function loadChats() {
      try {
        const response = await fetch("/api/chats");
        if (!response.ok) throw new Error("Failed to load chats");
        if (cancelled) return;
        const data = (await response.json()) as { chats: MSChat[]; nextLink: string | null };
        setChats(data.chats, data.nextLink);
      } catch {
        if (!cancelled && !toastShown) {
          toastShown = true;
          showToast({ title: "Could not load direct messages", tone: "error" });
        }
      }
    }

    loadChats();
    const interval = window.setInterval(loadChats, 60_000);
    function onFocus() {
      loadChats();
    }
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
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

  function switchTeam(teamId: string) {
    if (teamId === activeTeamId) return;
    setActiveTeam(teamId);
    // If channels for the team are already cached, navigate to the first one;
    // otherwise AppShell will load them and the user can pick from the list.
    const cached = channels[teamId];
    if (cached && cached.length > 0) {
      router.push(`/app/t/${teamId}/${cached[0].id}`);
    } else {
      router.push(`/app`);
    }
  }

  const sortedTeams = [...teams].sort((a, b) => a.displayName.localeCompare(b.displayName));

  return (
    <div className="flex w-[260px] flex-shrink-0 flex-col overflow-hidden bg-[var(--sidebar-bg)]">
      {/* Team name header — dropdown trigger */}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            className="flex h-[49px] w-full items-center justify-between border-b border-[var(--border)] px-4 transition-colors duration-[80ms] ease-out hover:bg-[var(--sidebar-hover)] focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
          >
            <span className="truncate text-[15px] font-black text-white">
              {activeTeam?.displayName ?? "Teamsly"}
            </span>
            <ChevronDown className="h-4 w-4 flex-shrink-0 text-[var(--text-secondary)]" />
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            sideOffset={4}
            align="start"
            className="z-50 min-w-[240px] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--modal-bg)] py-1 shadow-[0_8px_32px_rgba(0,0,0,0.55)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
          >
            {sortedTeams.length > 0 && (
              <>
                <DropdownMenu.Label className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Switch team
                </DropdownMenu.Label>
                <div className="max-h-[280px] overflow-y-auto">
                  {sortedTeams.map((team) => {
                    const isActive = team.id === activeTeamId;
                    return (
                      <DropdownMenu.Item
                        key={team.id}
                        onSelect={() => switchTeam(team.id)}
                        className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none transition-colors duration-75 data-[highlighted]:bg-[var(--accent)] data-[highlighted]:text-white"
                      >
                        <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center">
                          {isActive ? <Check className="h-3.5 w-3.5" /> : null}
                        </span>
                        <span className="truncate">{team.displayName}</span>
                      </DropdownMenu.Item>
                    );
                  })}
                </div>
                <DropdownMenu.Separator className="my-1 h-px bg-[var(--border)]" />
              </>
            )}

            <DropdownMenu.Item
              onSelect={() => setSettingsOpen(true)}
              className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none transition-colors duration-75 data-[highlighted]:bg-[var(--accent)] data-[highlighted]:text-white"
            >
              <Settings className="h-4 w-4 flex-shrink-0" />
              Preferences
            </DropdownMenu.Item>

            <DropdownMenu.Item
              onSelect={() => {
                // TODO: open invite people flow
              }}
              className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none transition-colors duration-75 data-[highlighted]:bg-[var(--accent)] data-[highlighted]:text-white"
            >
              <UserPlus className="h-4 w-4 flex-shrink-0" />
              Invite people
            </DropdownMenu.Item>

            <DropdownMenu.Item
              onSelect={() => {
                // TODO: set away / presence toggle
              }}
              className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none transition-colors duration-75 data-[highlighted]:bg-[var(--accent)] data-[highlighted]:text-white"
            >
              <Moon className="h-4 w-4 flex-shrink-0" />
              Set away
            </DropdownMenu.Item>

            <DropdownMenu.Separator className="my-1 h-px bg-[var(--border)]" />

            <DropdownMenu.Item
              onSelect={() => signOut({ callbackUrl: "/" })}
              className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none transition-colors duration-75 data-[highlighted]:bg-[#cd2553] data-[highlighted]:text-white"
            >
              <LogOut className="h-4 w-4 flex-shrink-0" />
              Sign out
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <button
        type="button"
        onClick={() => setSearchOpen(true)}
        className="mx-3 my-2 flex h-7 items-center gap-2 rounded-md border border-[var(--border-input)] bg-[var(--reaction-bg)] px-2 text-left text-[13px] text-[var(--text-secondary)] [transition:border-color_150ms_ease,background_150ms_ease] hover:border-white/50 hover:bg-[var(--sidebar-hover)] focus:border-white/50 focus:bg-[var(--sidebar-hover)] focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
      >
        <Search className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="truncate">Search...</span>
      </button>

      <div className="flex-1 overflow-y-auto pb-2">
        {/* Unreads section */}
        <div className="mb-1">
          <SectionHeader
            label="Unreads"
            icon={<Inbox className="h-3.5 w-3.5" />}
            open={unreadsOpen}
            count={totalUnreads}
            onToggle={toggleUnreads}
          />
          {unreadsOpen && (
            <>
              {unreadChannelItems.map((ch) => (
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
              {unreadChatItems.map((chat) => (
                <SidebarItem
                  key={chat.id}
                  label={getChatLabel(chat, currentUserId)}
                  icon={<ChatAvatar chat={chat} presenceMap={presenceMap} currentUserId={currentUserId} />}
                  active={params?.chatId === chat.id}
                  unreadCount={unreadCounts[chat.id] ?? 0}
                  onClick={() => goToChat(chat.id)}
                />
              ))}
              {totalUnreads === 0 && (
                <p className="px-4 py-1 text-[12px] text-[var(--text-muted)]">All caught up</p>
              )}
            </>
          )}
        </div>

        {/* Threads section */}
        <div className="mb-1">
          <SectionHeader
            label="Threads"
            icon={<GitBranch className="h-3.5 w-3.5" />}
            open={threadsOpen}
            count={0}
            onToggle={toggleThreads}
          />
          {threadsOpen && (
            <p className="px-4 py-1 text-[12px] text-[var(--text-muted)]">Coming soon</p>
          )}
        </div>

        {/* Starred section */}
        <div className="mb-1">
          <SectionHeader
            label="Starred"
            icon={<Star className="h-3.5 w-3.5" />}
            open={starredOpen}
            count={totalStarred}
            onToggle={toggleStarred}
          />
          {starredOpen && (
            <>
              {starredChannelItems.map((ch) => (
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
              {starredChatItems.map((chat) => (
                <SidebarItem
                  key={chat.id}
                  label={getChatLabel(chat, currentUserId)}
                  icon={<ChatAvatar chat={chat} presenceMap={presenceMap} currentUserId={currentUserId} />}
                  active={params?.chatId === chat.id}
                  unreadCount={unreadCounts[chat.id] ?? 0}
                  onClick={() => goToChat(chat.id)}
                />
              ))}
              {totalStarred === 0 && (
                <p className="px-4 py-1 text-[12px] text-[var(--text-muted)]">
                  Star channels and DMs to find them faster
                </p>
              )}
            </>
          )}
        </div>

        {/* Channels section */}
        <div className="mb-1">
          <button
            onClick={() => setChannelsOpen((v) => !v)}
            className="group/section flex w-full items-center justify-between px-4 py-1 text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] transition-colors duration-[80ms] ease-out hover:text-[var(--text-secondary)] focus:outline-none"
          >
            <span className="flex min-w-0 items-center gap-1">
              <ChevronRight
                className={cn(
                  "h-2.5 w-2.5 transition-transform duration-200 ease-out",
                  channelsOpen && "rotate-90"
                )}
              />
              <span className="truncate">Channels</span>
            </span>
            <Plus className="h-3 w-3 opacity-0 transition-opacity duration-150 group-hover/section:opacity-100" />
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
            className="group/section flex w-full items-center justify-between px-4 py-1 text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] transition-colors duration-[80ms] ease-out hover:text-[var(--text-secondary)] focus:outline-none"
          >
            <span className="flex min-w-0 items-center gap-1">
              <ChevronRight
                className={cn(
                  "h-2.5 w-2.5 transition-transform duration-200 ease-out",
                  dmsOpen && "rotate-90"
                )}
              />
              <span className="truncate">Direct Messages</span>
            </span>
            <Plus className="h-3 w-3 opacity-0 transition-opacity duration-150 group-hover/section:opacity-100" />
          </button>

          {dmsOpen &&
            chats.map((chat) => (
              <SidebarItem
                key={chat.id}
                label={getChatLabel(chat, currentUserId)}
                icon={<ChatAvatar chat={chat} presenceMap={presenceMap} currentUserId={currentUserId} />}
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
              className="mx-2 mt-0.5 flex h-7 w-[calc(100%-16px)] items-center gap-1.5 rounded-md px-2 text-[13px] text-[var(--text-muted)] transition-colors duration-[80ms] ease-out hover:bg-[var(--sidebar-hover)] hover:text-[var(--text-secondary)] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
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
      <PreferencesModal open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}

function SectionHeader({
  label,
  icon,
  open,
  count,
  onToggle,
}: {
  label: string;
  icon: React.ReactNode;
  open: boolean;
  count: number;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="group/section flex w-full items-center gap-1.5 px-4 py-1 text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] transition-colors duration-[80ms] ease-out hover:text-[var(--text-secondary)] focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
    >
      <ChevronRight
        className={cn(
          "h-2.5 w-2.5 flex-shrink-0 transition-transform duration-200 ease-out",
          open && "rotate-90"
        )}
      />
      <span className="flex-shrink-0 opacity-70">{icon}</span>
      <span className="truncate">{label}</span>
      {count > 0 && (
        <span className="ml-auto flex h-[15px] min-w-[15px] flex-shrink-0 items-center justify-center rounded-full bg-[#cd2553] px-[4px] text-[10px] font-bold text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
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
        "mx-2 flex h-[28px] w-[calc(100%-16px)] items-center gap-2 rounded-md px-2 text-[13px] transition-colors duration-[80ms] ease-out focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]",
        active
          ? "bg-[var(--accent)] text-white"
          : "text-[var(--text-secondary)] hover:bg-[var(--sidebar-hover)] hover:text-white"
      )}
    >
      <span className="flex-shrink-0 opacity-70">{icon}</span>
      <span className={cn("truncate", unread && "font-bold text-white")}>{label}</span>
      {unread && (
        <span className="ml-auto flex h-[16px] min-w-[16px] flex-shrink-0 scale-100 items-center justify-center rounded-full bg-[#cd2553] px-[4px] text-[10px] font-bold text-white transition-transform duration-150">
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
  currentUserId,
}: {
  chat: MSChat;
  presenceMap: Record<string, MSPresence["availability"]>;
  currentUserId: string;
}) {
  if (chat.chatType === "group") return <MessageSquare className="h-3.5 w-3.5" />;

  const members = chat.members ?? [];
  const otherMembers = members.filter((m) => (m.userId ?? m.id) !== currentUserId);
  const member = otherMembers[0] ?? members[0];
  if (!member) return <MessageSquare className="h-3.5 w-3.5" />;

  const userId = member.userId ?? member.id;
  return (
    <span className="relative flex h-6 w-6 flex-shrink-0">
      <Avatar userId={userId} displayName={member.displayName} size={24} />
      <PresenceDot availability={presenceMap[userId]} />
    </span>
  );
}
