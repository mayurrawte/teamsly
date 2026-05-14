"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import { Search, HelpCircle, RotateCw } from "lucide-react";
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
import { getChatLabel } from "@/lib/utils/chat-label";

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const session = useSession();

  // ── Electron auto-update banner state ────────────────────────────────────
  const [updateStatus, setUpdateStatus] = useState<{
    kind: 'idle' | 'available' | 'downloading' | 'downloaded' | 'error' | 'not-available';
    version?: string;
    percent?: number;
    message?: string;
  }>({ kind: 'idle' });

  useEffect(() => {
    if (!window.electron?.onUpdateEvent) return;
    const unsub = window.electron.onUpdateEvent((ev) => {
      if (ev.kind === 'not-available') {
        setUpdateStatus({ kind: 'not-available' });
        const t = setTimeout(() => setUpdateStatus({ kind: 'idle' }), 4000);
        return () => clearTimeout(t);
      }
      setUpdateStatus(ev);
    });
    return unsub;
  }, []);
  // After ~1h the access token expires. If refresh fails (usually because new
  // scopes were added since last sign-in), useSession still reports
  // authenticated but every Graph call 401s. Show a recovery banner instead
  // of cascading "Could not load" toasts.
  const sessionError =
    (session.data as { error?: string } | null | undefined)?.error;
  const needsReauth = sessionError === "RefreshAccessTokenError";
  const { teams, activeTeamId, channels, chats, currentUserId, setTeams, setActiveTeam, setChannels, setActiveChannel, setActiveChat, markRead, setCurrentUser, hydrateMessageCache } = useWorkspaceStore();
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

  // Hydrate the per-context message cache from IndexedDB once on mount, so
  // ChannelView/ChatView's first render can return cached messages immediately
  // instead of waiting on Graph. Fire-and-forget — IDB is best-effort.
  useEffect(() => {
    void hydrateMessageCache();
  }, [hydrateMessageCache]);

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
      label: getChatLabel(chat, currentUserId),
      subtitle: chat.chatType === "group" ? "Group DM" : "Direct message",
      onSelect: () => {
        markRead(chat.id);
        setActiveChat(chat.id);
        router.push(`/app/dm/${chat.id}`);
      },
    }));
    return [...channelItems, ...chatItems];
  }, [activeTeamId, channels, chats, currentUserId, markRead, router, setActiveChannel, setActiveChat, teams]);

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

  const autoInstallSupported =
    typeof window !== 'undefined' && (window.electron?.isAutoInstallSupported?.() ?? false);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--content-bg)]">
      {/* Electron auto-update banner — shown above the reconnect banner */}
      {updateStatus.kind === 'available' && (
        <div className="flex flex-shrink-0 items-center justify-center gap-3 border-b border-[#0F5A8F]/40 bg-[#0F5A8F]/15 px-4 py-2 text-[13px] text-blue-200">
          <span>Teamsly v{updateStatus.version} is available — downloading…</span>
        </div>
      )}
      {updateStatus.kind === 'downloading' && (
        <div className="flex flex-shrink-0 items-center justify-center gap-3 border-b border-[#0F5A8F]/40 bg-[#0F5A8F]/15 px-4 py-2 text-[13px] text-blue-200">
          <span>Downloading update… {updateStatus.percent ?? 0}%</span>
        </div>
      )}
      {updateStatus.kind === 'downloaded' && (
        <div className="flex flex-shrink-0 items-center justify-center gap-3 border-b border-[#0F5A8F]/40 bg-[#0F5A8F]/15 px-4 py-2 text-[13px] text-blue-200">
          <span>Update ready — v{updateStatus.version}.</span>
          {autoInstallSupported ? (
            <button
              type="button"
              onClick={() => window.electron?.installUpdate()}
              className="rounded bg-[#0F5A8F] px-2.5 py-0.5 text-[12px] font-semibold text-white transition-colors hover:bg-[#0d4f7d]"
            >
              Restart &amp; install
            </button>
          ) : (
            <button
              type="button"
              onClick={() => window.electron?.openReleasesPage()}
              className="rounded bg-[#0F5A8F] px-2.5 py-0.5 text-[12px] font-semibold text-white transition-colors hover:bg-[#0d4f7d]"
            >
              Open release page
            </button>
          )}
        </div>
      )}
      {updateStatus.kind === 'error' && (
        <div className="flex flex-shrink-0 items-center justify-center gap-3 border-b border-red-500/40 bg-red-500/10 px-4 py-2 text-[13px] text-red-300">
          <span>Update check failed: {updateStatus.message}</span>
          <button
            type="button"
            onClick={() => window.electron?.openReleasesPage()}
            className="rounded bg-red-500 px-2.5 py-0.5 text-[12px] font-semibold text-white transition-colors hover:bg-red-400"
          >
            Open release page
          </button>
        </div>
      )}
      {updateStatus.kind === 'not-available' && (
        <div className="flex flex-shrink-0 items-center justify-center gap-3 border-b border-green-500/40 bg-green-500/10 px-4 py-2 text-[13px] text-green-300">
          <span>You&apos;re on the latest version.</span>
        </div>
      )}
      {needsReauth && (
        <div className="flex flex-shrink-0 items-center justify-center gap-3 border-b border-amber-500/40 bg-amber-500/10 px-4 py-2 text-[13px] text-amber-200">
          <RotateCw className="h-3.5 w-3.5" />
          <span>Your session has expired. Reconnect to keep loading messages.</span>
          <button
            type="button"
            onClick={() => signIn("microsoft-entra-id")}
            className="rounded bg-amber-400 px-2.5 py-0.5 text-[12px] font-semibold text-[#1a1d21] transition-colors hover:bg-amber-300"
          >
            Reconnect
          </button>
        </div>
      )}
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
        messages={[]}
        onSelectChannel={handleSelectChannel}
        onSelectChat={handleSelectChat}
      />
      <ToastViewport />
    </div>
  );
}
