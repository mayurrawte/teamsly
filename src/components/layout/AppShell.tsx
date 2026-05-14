"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, HelpCircle } from "lucide-react";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { LeftRail } from "@/components/layout/LeftRail";
import { MemberPanel } from "@/components/layout/MemberPanel";
import { JumpToSwitcher, type JumpToItem } from "@/components/modals/JumpToSwitcher";
import { SearchModal } from "@/components/modals/SearchModal";
import { Logo } from "@/components/ui/Logo";
import { useWorkspaceStore } from "@/store/workspace";
import { ToastViewport } from "@/components/ui/ToastViewport";
import { useToastStore } from "@/store/toasts";
import { sendUnreadCount } from "@/lib/electron-bridge";

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { teams, activeTeamId, channels, chats, messages, setTeams, setActiveTeam, setChannels, setActiveChannel, setActiveChat, markRead, setCurrentUser } = useWorkspaceStore();
  const unreadCounts = useWorkspaceStore((s) => s.unreadCounts);
  const showToast = useToastStore((state) => state.showToast);
  const [jumpToOpen, setJumpToOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    fetch("/api/me")
      .then((response) => (response.ok ? response.json() : null))
      .then((user: MSUser | null) => {
        if (user) setCurrentUser({ id: user.id, displayName: user.displayName });
        else showToast({ title: "Could not load your profile", tone: "error" });
      })
      .catch(() => {
        showToast({ title: "Could not load your profile", tone: "error" });
      });
  }, [setCurrentUser, showToast]);

  // Load joined teams (previously done by WorkspaceBar). Auto-select the first
  // team only if no team is currently active in the persisted store.
  useEffect(() => {
    async function loadTeams() {
      try {
        const response = await fetch("/api/teams");
        if (!response.ok) throw new Error("Failed to load teams");
        const data = (await response.json()) as MSTeam[];
        const sorted = [...data].sort((a, b) => a.displayName.localeCompare(b.displayName));
        setTeams(sorted);
        if (sorted.length > 0 && !useWorkspaceStore.getState().activeTeamId) {
          setActiveTeam(sorted[0].id);
        }
      } catch {
        showToast({ title: "Could not load teams", tone: "error" });
      }
    }
    loadTeams();
  }, [setActiveTeam, setTeams, showToast]);

  // Load channels whenever the active team changes.
  useEffect(() => {
    if (!activeTeamId) return;
    const teamId = activeTeamId;
    async function loadChannels() {
      try {
        const response = await fetch(`/api/channels/${teamId}`);
        if (!response.ok) throw new Error("Failed to load channels");
        const data = (await response.json()) as MSChannel[];
        setChannels(teamId, data);
      } catch {
        showToast({ title: "Could not load channels", tone: "error" });
      }
    }
    loadChannels();
  }, [activeTeamId, setChannels, showToast]);

  // Push total unread count into the Electron main process for tray tooltip
  // and macOS dock badge. No-op in a plain browser.
  useEffect(() => {
    const total = Object.values(unreadCounts).reduce((sum, n) => sum + n, 0);
    sendUnreadCount(total);
    return () => {
      sendUnreadCount(0);
    };
  }, [unreadCounts]);

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

  const teamName = teams.find((t) => t.id === activeTeamId)?.displayName ?? "Teamsly";
  const teamChannels = activeTeamId ? (channels[activeTeamId] ?? []) : [];

  function handleSelectChannel(channelId: string) {
    if (!activeTeamId) return;
    markRead(channelId);
    setActiveChannel(channelId);
    router.push(`/app/t/${activeTeamId}/${channelId}`);
  }

  function handleSelectChat(chatId: string) {
    markRead(chatId);
    setActiveChat(chatId);
    router.push(`/app/dm/${chatId}`);
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--content-bg)]">
      {/* Global top search bar */}
      <header className="flex h-[50px] flex-shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--sidebar-bg)] px-4">
        {/* Left: logomark */}
        <div className="flex w-[56px] flex-shrink-0 items-center justify-center">
          <Logo size={22} className="text-[#4da3e0]" />
        </div>

        {/* Center: search input */}
        <div className="flex flex-1 items-center justify-center">
          <button
            type="button"
            aria-label="Open search"
            onClick={() => setSearchOpen(true)}
            className="flex h-8 w-full max-w-[480px] items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface-raised)] px-3 text-[13px] text-[var(--text-muted)] transition-colors hover:border-[var(--text-muted)] hover:bg-[var(--surface-hover)] focus-ring"
          >
            <Search className="h-3.5 w-3.5 flex-shrink-0 text-[var(--text-muted)]" />
            <span className="flex-1 text-left">Search Teamsly</span>
          </button>
        </div>

        {/* Right: help affordance placeholder */}
        <div className="flex w-[56px] flex-shrink-0 items-center justify-end">
          <button
            type="button"
            aria-label="Help"
            title="Help"
            className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)] focus-ring"
          >
            <HelpCircle className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Main shell row */}
      <div className="flex flex-1 overflow-hidden">
        <LeftRail />
        <Sidebar />
        <main className="flex flex-1 flex-col overflow-hidden bg-[var(--message-bg)]">
          {children}
        </main>
        <MemberPanel />
      </div>

      <JumpToSwitcher open={jumpToOpen} onOpenChange={setJumpToOpen} items={items} />
      <SearchModal
        open={searchOpen}
        onOpenChange={setSearchOpen}
        teamName={teamName}
        channels={teamChannels}
        chats={chats}
        messages={messages}
        onSelectChannel={handleSelectChannel}
        onSelectChat={handleSelectChat}
      />
      <ToastViewport />
    </div>
  );
}
