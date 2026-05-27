"use client";

import { useWorkspaceStore } from "@/store/workspace";
import { useRouter, useParams } from "next/navigation";
import { Hash, Lock, MessageSquare, ChevronDown, ChevronRight, Plus, Search, Settings, UserPlus, Moon, LogOut, Inbox, GitBranch, Star, Check, Circle, CircleDot, BellOff, Clock, CircleOff, Smile, MessageCircleQuestion } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { signOut } from "next-auth/react";
import { clearAll as clearMessageCache } from "@/lib/storage/message-cache";
import { clearAll as clearDraftsCache } from "@/lib/storage/drafts";
import { clearAll as clearBookmarksCache } from "@/lib/storage/bookmarks";
import { cn } from "@/lib/utils";
import { isDisappearing, unwrapMessage } from "@/lib/utils/disappear";

async function sweepAllDms(
  chatIds: string[],
  getMessages: (id: string) => MSMessage[],
  removeMessage: (ctx: string, id: string) => void,
  currentUserId: string
) {
  const now = Date.now();
  for (const chatId of chatIds) {
    for (const m of getMessages(chatId)) {
      if (m.__pending || m.__failed) continue;
      if (m.from?.user?.id !== currentUserId) continue; // only delete our own (Graph 403s otherwise)
      if (!isDisappearing(m.body.content)) continue;
      const payload = await unwrapMessage(chatId, m.body.content);
      if (!payload || payload.disappearAt > now) continue;
      try {
        const res = await fetch(
          `/api/chats/${chatId}/messages/${encodeURIComponent(m.id)}`,
          { method: "DELETE" }
        );
        if (res.ok) removeMessage(chatId, m.id);
      } catch {
        /* best-effort */
      }
    }
  }
}

async function handleSignOut() {
  // Drop the IDB caches before redirect so a previous user's messages,
  // drafts, and saved bookmarks don't leak to the next sign-in on the
  // same device.
  await Promise.all([clearMessageCache(), clearDraftsCache(), clearBookmarksCache()]);
  await signOut({ callbackUrl: "/" });
}
import { UserFooter } from "./UserFooter";
import { PreferencesModal } from "@/components/modals/PreferencesModal";
import { StatusMessageModal } from "@/components/modals/StatusMessageModal";
import { FeedbackModal } from "@/components/modals/FeedbackModal";
import { Avatar } from "@/components/ui/Avatar";
import { PresenceDot } from "@/components/ui/PresenceDot";
import { useToastStore } from "@/store/toasts";
import { getChatLabel } from "@/lib/utils/chat-label";
import { useSearchStore } from "@/store/search";

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
  const { teams, activeTeamId, activeChannelId, activeChatId, channels, chats, chatsNextLink, presenceMap, unreadCounts, starredIds, currentUserId, setChats, appendChats, patchChatMembers, setActiveTeam, setActiveChannel, setActiveChat, markRead, setPresenceMap } =
    useWorkspaceStore();
  const router = useRouter();
  const params = useParams();
  const [channelsOpen, setChannelsOpen] = useState(true);
  const [dmsOpen, setDmsOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [loadingMoreChats, setLoadingMoreChats] = useState(false);
  const membersFetchedRef = useRef(new Set<string>());
  const presenceErrorShownRef = useRef(false);
  const showToast = useToastStore((state) => state.showToast);

  const [unreadsOpen, toggleUnreads] = useCollapsible(COLLAPSE_KEYS.unreads, true);
  const [threadsOpen, toggleThreads] = useCollapsible(COLLAPSE_KEYS.threads, true);
  const [starredOpen, toggleStarred] = useCollapsible(COLLAPSE_KEYS.starred, true);
  const [voiceCounts, setVoiceCounts] = useState<Record<string, number>>({});

  const activeTeam = teams.find((t) => t.id === activeTeamId);
  const teamChannels = activeTeamId ? (channels[activeTeamId] ?? []) : [];
  const activeChannel = teamChannels.find((channel) => channel.id === activeChannelId);
  const activeChat = chats.find((chat) => chat.id === activeChatId);
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
        const ws = useWorkspaceStore.getState();
        void sweepAllDms(
          data.chats.map((c) => c.id),
          ws.getMessages,
          ws.removeMessage,
          ws.currentUserId
        );
      } catch {
        if (!cancelled && !toastShown) {
          toastShown = true;
          showToast({ title: "Could not load direct messages", tone: "error" });
        }
      }
    }

    loadChats();
    const interval = window.setInterval(loadChats, 15_000);
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

  useEffect(() => {
    const toFetch = chats.filter(
      (chat) =>
        (!chat.members || chat.members.length === 0) &&
        !membersFetchedRef.current.has(chat.id)
    );
    for (const chat of toFetch) {
      membersFetchedRef.current.add(chat.id);
      fetch(`/api/chats/${encodeURIComponent(chat.id)}/members`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((members: MSChatMember[]) => {
          if (members.length > 0) patchChatMembers(chat.id, members);
        })
        .catch(() => {
          membersFetchedRef.current.delete(chat.id);
        });
    }
  }, [chats, patchChatMembers]);

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

  // Previous voiceCounts kept in a ref so we can detect 0→N+ transitions
  // and fire a "voice room just opened" toast without re-toasting on every
  // poll. Updated *after* each successful poll. First poll seeds the ref
  // without any notifications so we don't surface rooms that were already
  // active before the user opened the app.
  const prevVoiceCountsRef = useRef<Record<string, number> | null>(null);

  useEffect(() => {
    const channelRooms = activeTeamId
      ? teamChannels.map((ch) => ({ id: ch.id, room: `channel-${activeTeamId}-${ch.id}`, label: `#${ch.displayName}` }))
      : [];
    const chatRooms = chats.map((chat) => ({
      id: chat.id,
      room: `chat-${chat.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`,
      label: getChatLabel(chat, currentUserId),
    }));
    const allRooms = [...channelRooms, ...chatRooms];
    if (allRooms.length === 0) return;

    let cancelled = false;

    async function pollVoice() {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/voice/active-batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomNames: allRooms.map((r) => r.room) }),
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { counts: Record<string, number> };
        if (cancelled) return;
        const mapped: Record<string, number> = {};
        for (const { id, room } of allRooms) {
          const n = data.counts[room] ?? 0;
          if (n > 0) mapped[id] = n;
        }
        // Detect 0→N transitions and notify. Skip on the very first poll
        // (prev ref is null) so we don't toast every pre-existing room
        // when the user first lands.
        const prev = prevVoiceCountsRef.current;
        if (prev) {
          for (const { id, label } of allRooms) {
            const before = prev[id] ?? 0;
            const after = mapped[id] ?? 0;
            if (before === 0 && after > 0) {
              showToast({
                title: `Voice room active in ${label}`,
                description: `${after} ${after === 1 ? "person" : "people"} talking`,
                tone: "info",
              });
            }
          }
        }
        prevVoiceCountsRef.current = mapped;
        setVoiceCounts(mapped);
      } catch {
        // ignore — voice service may be unavailable
      }
    }

    pollVoice();
    const id = window.setInterval(pollVoice, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [activeTeamId, teamChannels, chats, currentUserId, showToast]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        useSearchStore.getState().open();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function goToChannel(channelId: string) {
    if (!activeTeamId) return;
    markRead(channelId);
    setActiveChannel(channelId);
    router.push(`/workspace/t/${activeTeamId}/${channelId}`);
  }

  function goToChat(chatId: string) {
    markRead(chatId);
    setActiveChat(chatId);
    router.push(`/workspace/dm/${chatId}`);
  }

  function switchTeam(teamId: string) {
    if (teamId === activeTeamId) return;
    setActiveTeam(teamId);
    // If channels for the team are already cached, navigate to the first one.
    // setActiveChannel must be called so activeChannelId stays in sync with the
    // URL (e.g. search modal context label reads it from the store).
    const cached = channels[teamId];
    if (cached && cached.length > 0) {
      setActiveChannel(cached[0].id);
      router.push(`/workspace/t/${teamId}/${cached[0].id}`);
    } else {
      router.push(`/workspace`);
    }
  }

  const sortedTeams = [...teams].sort((a, b) => a.displayName.localeCompare(b.displayName));

  async function setPresence(availability: MSPresence["availability"], activity: string) {
    const res = await fetch("/api/presence/setUserPreferredPresence", {
      method: "POST",
      body: JSON.stringify({ availability, activity }),
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) {
      showToast({ title: "Could not update status", tone: "error" });
    } else {
      setPresenceMap({ ...presenceMap, [currentUserId]: availability });
      showToast({ title: `Status set to ${availability}` });
    }
  }

  async function resetPresence() {
    const res = await fetch("/api/presence/setUserPreferredPresence", {
      method: "POST",
      body: JSON.stringify({ clear: true }),
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) {
      showToast({ title: "Could not reset status", tone: "error" });
    } else {
      showToast({ title: "Status reset" });
    }
  }

  const currentAvailability = presenceMap[currentUserId];

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

            <DropdownMenu.Sub>
              <DropdownMenu.SubTrigger className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none transition-colors duration-75 data-[highlighted]:bg-[var(--accent)] data-[highlighted]:text-white data-[state=open]:bg-[var(--accent)] data-[state=open]:text-white">
                <Moon className="h-4 w-4 flex-shrink-0" />
                {currentAvailability ? `Status: ${currentAvailability}` : "Set status"}
                <ChevronRight className="ml-auto h-3.5 w-3.5 flex-shrink-0" />
              </DropdownMenu.SubTrigger>
              <DropdownMenu.Portal>
                <DropdownMenu.SubContent
                  sideOffset={4}
                  className="z-50 min-w-[200px] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--modal-bg)] py-1 shadow-[0_8px_32px_rgba(0,0,0,0.55)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
                >
                  <DropdownMenu.Item
                    onSelect={() => setPresence("Available", "Available")}
                    className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none transition-colors duration-75 data-[highlighted]:bg-[var(--accent)] data-[highlighted]:text-white"
                  >
                    <Circle className="h-4 w-4 flex-shrink-0 text-green-500" />
                    Available
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    onSelect={() => setPresence("Busy", "Busy")}
                    className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none transition-colors duration-75 data-[highlighted]:bg-[var(--accent)] data-[highlighted]:text-white"
                  >
                    <CircleDot className="h-4 w-4 flex-shrink-0 text-red-500" />
                    Busy
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    onSelect={() => setPresence("DoNotDisturb", "DoNotDisturb")}
                    className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none transition-colors duration-75 data-[highlighted]:bg-[var(--accent)] data-[highlighted]:text-white"
                  >
                    <BellOff className="h-4 w-4 flex-shrink-0 text-red-600" />
                    Do not disturb
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    onSelect={() => setPresence("BeRightBack", "BeRightBack")}
                    className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none transition-colors duration-75 data-[highlighted]:bg-[var(--accent)] data-[highlighted]:text-white"
                  >
                    <Clock className="h-4 w-4 flex-shrink-0 text-yellow-500" />
                    Be right back
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    onSelect={() => setPresence("Away", "Away")}
                    className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none transition-colors duration-75 data-[highlighted]:bg-[var(--accent)] data-[highlighted]:text-white"
                  >
                    <Moon className="h-4 w-4 flex-shrink-0 text-yellow-400" />
                    Away
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    onSelect={() => setPresence("Offline", "OffWork")}
                    className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none transition-colors duration-75 data-[highlighted]:bg-[var(--accent)] data-[highlighted]:text-white"
                  >
                    <CircleOff className="h-4 w-4 flex-shrink-0 text-[var(--text-muted)]" />
                    Offline
                  </DropdownMenu.Item>
                  <DropdownMenu.Separator className="my-1 h-px bg-[var(--border)]" />
                  <DropdownMenu.Item
                    onSelect={resetPresence}
                    className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none transition-colors duration-75 data-[highlighted]:bg-[var(--accent)] data-[highlighted]:text-white"
                  >
                    Reset to default
                  </DropdownMenu.Item>
                </DropdownMenu.SubContent>
              </DropdownMenu.Portal>
            </DropdownMenu.Sub>

            <DropdownMenu.Item
              onSelect={() => setStatusModalOpen(true)}
              className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none transition-colors duration-75 data-[highlighted]:bg-[var(--accent)] data-[highlighted]:text-white"
            >
              <Smile className="h-4 w-4 flex-shrink-0" />
              Set a status...
            </DropdownMenu.Item>

            <DropdownMenu.Item
              onSelect={() => setFeedbackOpen(true)}
              className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none transition-colors duration-75 data-[highlighted]:bg-[var(--accent)] data-[highlighted]:text-white"
            >
              <MessageCircleQuestion className="h-4 w-4 flex-shrink-0" />
              Send feedback…
            </DropdownMenu.Item>

            <DropdownMenu.Separator className="my-1 h-px bg-[var(--border)]" />

            <DropdownMenu.Item
              onSelect={() => void handleSignOut()}
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
        onClick={() => useSearchStore.getState().open()}
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
          <div
            className={cn(
              "grid transition-[grid-template-rows] duration-200 ease-out",
              unreadsOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
            )}
          >
            <div className="overflow-hidden min-h-0">
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
                  voiceCount={voiceCounts[ch.id] ?? 0}
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
                  voiceCount={voiceCounts[chat.id] ?? 0}
                  onClick={() => goToChat(chat.id)}
                />
              ))}
              {totalUnreads === 0 && (
                <p className="px-4 py-1 text-[12px] text-[var(--text-muted)]">All caught up</p>
              )}
            </div>
          </div>
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
          <div
            className={cn(
              "grid transition-[grid-template-rows] duration-200 ease-out",
              threadsOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
            )}
          >
            <div className="overflow-hidden min-h-0">
              <p className="px-4 py-1 text-[12px] text-[var(--text-muted)]">Coming soon</p>
            </div>
          </div>
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
          <div
            className={cn(
              "grid transition-[grid-template-rows] duration-200 ease-out",
              starredOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
            )}
          >
            <div className="overflow-hidden min-h-0">
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
                  voiceCount={voiceCounts[ch.id] ?? 0}
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
                  voiceCount={voiceCounts[chat.id] ?? 0}
                  onClick={() => goToChat(chat.id)}
                />
              ))}
              {totalStarred === 0 && (
                <p className="px-4 py-1 text-[12px] text-[var(--text-muted)]">
                  Star channels and DMs to find them faster
                </p>
              )}
            </div>
          </div>
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

          <div
            className={cn(
              "grid transition-[grid-template-rows] duration-200 ease-out",
              channelsOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
            )}
          >
            <div className="overflow-hidden min-h-0">
              {teamChannels.map((ch) => (
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
                  voiceCount={voiceCounts[ch.id] ?? 0}
                  onClick={() => goToChannel(ch.id)}
                />
              ))}
            </div>
          </div>
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

          <div
            className={cn(
              "grid transition-[grid-template-rows] duration-200 ease-out",
              dmsOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
            )}
          >
            <div className="overflow-hidden min-h-0">
              {chats.map((chat) => (
                <SidebarItem
                  key={chat.id}
                  label={getChatLabel(chat, currentUserId)}
                  icon={<ChatAvatar chat={chat} presenceMap={presenceMap} currentUserId={currentUserId} />}
                  active={params?.chatId === chat.id}
                  unreadCount={unreadCounts[chat.id] ?? 0}
                  voiceCount={voiceCounts[chat.id] ?? 0}
                  onClick={() => goToChat(chat.id)}
                />
              ))}
              {chatsNextLink && (
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
        </div>
      </div>

      <UserFooter />
      <PreferencesModal open={settingsOpen} onOpenChange={setSettingsOpen} />
      <StatusMessageModal open={statusModalOpen} onOpenChange={setStatusModalOpen} />
      <FeedbackModal open={feedbackOpen} onOpenChange={setFeedbackOpen} />
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
  voiceCount = 0,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  unreadCount?: number;
  voiceCount?: number;
  onClick: () => void;
}) {
  const unread = unreadCount > 0 && !active;
  const [pulsing, setPulsing] = useState(false);
  const prevCountRef = useRef(unreadCount);

  useEffect(() => {
    if (unreadCount > prevCountRef.current) {
      setPulsing(true);
      const t = setTimeout(() => setPulsing(false), 300);
      return () => clearTimeout(t);
    }
    prevCountRef.current = unreadCount;
  }, [unreadCount]);

  return (
    <button
      onClick={onClick}
      style={{
        paddingTop: "var(--density-sidebar-row-py)",
        paddingBottom: "var(--density-sidebar-row-py)",
        fontSize: "var(--density-sidebar-font-size)",
      }}
      className={cn(
        "press-snap mx-2 flex w-[calc(100%-16px)] items-center gap-2 rounded-md px-2 transition-colors [transition-duration:var(--motion-fast)] [transition-timing-function:var(--ease-out-soft)] focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]",
        active
          ? "bg-[var(--accent)] text-[var(--text-white)]"
          : "text-[var(--text-secondary)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--text-primary)]"
      )}
    >
      <span className="flex-shrink-0 opacity-70">{icon}</span>
      <span className={cn("truncate", unread && "font-bold text-white")}>{label}</span>
      {voiceCount > 0 && (
        <span className={cn(
          "ml-auto inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium",
          active
            ? "bg-white/20 text-white"
            : "bg-emerald-500/15 text-emerald-400"
        )}>
          🎙 {voiceCount}
        </span>
      )}
      {unread && (
        <span
          className={cn(
            "flex h-[16px] min-w-[16px] flex-shrink-0 items-center justify-center rounded-full bg-[#cd2553] px-[4px] text-[10px] font-bold text-white",
            voiceCount > 0 ? "ml-1" : "ml-auto"
          )}
          style={pulsing ? { animation: 'badge-pulse 300ms ease-out' } : undefined}
        >
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </button>
  );
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
  const members = chat.members ?? [];
  const otherMembers = members.filter((m) => (m.userId ?? m.id) !== currentUserId);
  // Treat as a group when Graph says so OR when there's more than one other
  // member — some tenants omit chatType on the list response, and without this
  // a group would fall through and render a single member's photo.
  if (chat.chatType === "group" || otherMembers.length > 1) {
    return <MessageSquare className="h-3.5 w-3.5" />;
  }

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
