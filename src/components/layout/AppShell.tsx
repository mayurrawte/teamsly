"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signIn, signOut } from "next-auth/react";
import { Search, HelpCircle, RotateCw, Sparkles } from "lucide-react";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { LeftRail } from "@/components/layout/LeftRail";
import { MemberPanel } from "@/components/layout/MemberPanel";
import { FilePreviewPanel } from "@/components/files/FilePreviewPanel";
import { JumpToSwitcher, type JumpToItem } from "@/components/modals/JumpToSwitcher";
import { SearchModal, type SearchMessageOrigin, type SearchPerson } from "@/components/modals/SearchModal";
import { Logo } from "@/components/ui/Logo";
import { EMPTY_MESSAGES, useWorkspaceStore } from "@/store/workspace";
import { useDraftsStore } from "@/store/drafts";
import { useBookmarksStore } from "@/store/bookmarks";
import { useScheduledStore } from "@/store/scheduled";
import { ToastViewport } from "@/components/ui/ToastViewport";
import { useToastStore } from "@/store/toasts";
import { sendUnreadCount } from "@/lib/electron-bridge";
import { getChatLabel } from "@/lib/utils/chat-label";
import { RealtimeEventsMount } from "@/hooks/useRealtimeEvents";
import { MorningBriefScheduler } from "@/components/MorningBriefScheduler";
import { CatchUpPanel } from "@/components/ai/CatchUpPanel";
import { useCatchUpStore } from "@/store/catchUp";
import { useSearchStore } from "@/store/search";
import { markVisit } from "@/lib/storage/visit-counter";
import { warmTopVisited } from "@/lib/storage/prefetch";
import { BootNudge } from "@/components/ui/BootNudge";
import { OfficeHoursBanner } from "@/components/ui/OfficeHoursBanner";
import { usePreferencesStore } from "@/store/preferences";

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

  // Session expired mid-use: sign out so the user lands on a clean login page
  // rather than seeing cascading API errors.
  useEffect(() => {
    if (session.status === "unauthenticated") {
      signOut({ callbackUrl: "/login" });
    }
  }, [session.status]);
  const { teams, activeTeamId, activeChannelId, activeChatId, channels, chats, currentUserId, setTeams, setActiveTeam, setChannels, setActiveChannel, setActiveChat, markRead, setCurrentUser, hydrateMessageCache, patchChat } = useWorkspaceStore();
  const unreadCounts = useWorkspaceStore((s) => s.unreadCounts);
  // Pull the active context's messages so SearchModal can find matches in the
  // currently open chat/channel. Empty array when nothing is open.
  const activeContextId = activeChannelId && activeTeamId
    ? `${activeTeamId}:${activeChannelId}`
    : activeChatId ?? null;
  const activeMessages = useWorkspaceStore((s) =>
    activeContextId ? (s.messagesByContext[activeContextId] ?? EMPTY_MESSAGES) : EMPTY_MESSAGES
  );
  const openCatchUp = useCatchUpStore((s) => s.setOpen);
  const showToast = useToastStore((state) => state.showToast);
  const [jumpToOpen, setJumpToOpen] = useState(false);
  const searchOpen = useSearchStore((s) => s.isOpen);
  const closeSearch = useSearchStore((s) => s.close);
  const toggleFocusMode = usePreferencesStore((s) => s.toggleFocusMode);
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // Don't hijack shortcuts while the user is typing in a field.
      const target = event.target as HTMLElement | null;
      const inTextInput =
        target && (target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA");

      // Cmd/Ctrl+K → quick switcher. Allowed even in text inputs — common Slack/Teams muscle memory.
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setJumpToOpen(true);
        return;
      }

      // Cmd/Ctrl+Shift+F → toggle focus mode.
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "f") {
        if (inTextInput) return; // don't override browser's find-in-text shortcut
        event.preventDefault();
        toggleFocusMode();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleFocusMode]);

  // Hydrate the per-context message cache from IndexedDB once on mount, so
  // ChannelView/ChatView's first render can return cached messages immediately
  // instead of waiting on Graph. Fire-and-forget — IDB is best-effort.
  useEffect(() => {
    (async () => {
      await hydrateMessageCache();
      // After hydrate, kick off background fetches for the top-3 most-visited
      // contexts that hydrate didn't already fill. This makes the user's *first*
      // click after a cold start feel as fast as later clicks. We exclude the
      // currently-active context — its own view will fetch on mount anyway.
      const state = useWorkspaceStore.getState();
      const activeId = state.activeChannelId && state.activeTeamId
        ? `${state.activeTeamId}:${state.activeChannelId}`
        : state.activeChatId ?? null;
      void warmTopVisited(3, activeId);
    })();
    // Same pattern for composer drafts and saved-message bookmarks — both
    // are also IDB-backed so they survive reloads. Hydration completes well
    // after the first render but that's fine: stores merge IDB into any
    // already-in-memory state so a quick draft typed during boot isn't lost.
    void useDraftsStore.getState().hydrate();
    void useBookmarksStore.getState().hydrate();
    void useScheduledStore.getState().hydrate();
  }, [hydrateMessageCache]);

  // Record visits so the next cold-start prefetch knows what to warm. We watch
  // the active-context derived id rather than each setActive* call so any
  // navigation path (sidebar click, search, deep link) gets counted equally.
  useEffect(() => {
    if (activeChannelId && activeTeamId) {
      markVisit({ kind: "channel", teamId: activeTeamId, channelId: activeChannelId });
    } else if (activeChatId) {
      markVisit({ kind: "chat", chatId: activeChatId });
    }
  }, [activeTeamId, activeChannelId, activeChatId]);

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
        router.push(`/workspace/t/${activeTeamId}/${channel.id}`);
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
        router.push(`/workspace/dm/${chat.id}`);
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
    router.push(`/workspace/t/${activeTeamId}/${channelId}`);
  }

  function handleSelectChat(chatId: string) {
    markRead(chatId);
    setActiveChat(chatId);
    router.push(`/workspace/dm/${chatId}`);
  }

  // Compute SearchModal context — group name + origin used when a message
  // result is picked. Origin is what powers the jump-to-message anchor.
  const activeChannel = activeTeamId ? channels[activeTeamId]?.find((c) => c.id === activeChannelId) : undefined;
  const activeChat = chats.find((c) => c.id === activeChatId);
  const searchGroupName = activeChannel
    ? `Messages in #${activeChannel.displayName}`
    : activeChat
      ? `Messages in ${getChatLabel(activeChat, currentUserId)}`
      : "Messages";
  const searchMessageOrigin: SearchMessageOrigin | undefined = activeChannel && activeTeamId
    ? { kind: "channel", teamId: activeTeamId, channelId: activeChannel.id }
    : activeChat
      ? { kind: "chat", chatId: activeChat.id }
      : undefined;

  function handleSelectMessage(message: MSMessage, origin: SearchMessageOrigin) {
    // Navigate to the matched message's context with `?anchor=` so the
    // destination view scrolls + highlights that row. ChannelView/ChatView
    // read this param and clear it after the anchor effect fires.
    if (origin.kind === "channel") {
      markRead(origin.channelId);
      setActiveChannel(origin.channelId);
      router.push(`/workspace/t/${origin.teamId}/${origin.channelId}?anchor=${encodeURIComponent(message.id)}`);
    } else {
      markRead(origin.chatId);
      setActiveChat(origin.chatId);
      router.push(`/workspace/dm/${origin.chatId}?anchor=${encodeURIComponent(message.id)}`);
    }
  }

  // Picked someone from org-directory search: find-or-create the 1:1 chat,
  // seed it into the store so the sidebar shows it, and navigate to the DM.
  async function handleSelectPerson(person: SearchPerson) {
    try {
      const res = await fetch("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: person.id }),
      });
      if (!res.ok) throw new Error("create chat failed");
      const chat = (await res.json()) as MSChat;
      patchChat(chat);
      markRead(chat.id);
      setActiveChat(chat.id);
      router.push(`/workspace/dm/${chat.id}`);
    } catch {
      showToast({ title: `Could not open a chat with ${person.displayName}`, tone: "error" });
    }
  }

  const autoInstallSupported =
    typeof window !== 'undefined' && (window.electron?.isAutoInstallSupported?.() ?? false);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--content-bg)]">
      {/* Electron auto-update banner — shown above the reconnect banner */}
      {updateStatus.kind === 'available' && (
        <div className="flex flex-shrink-0 items-center justify-center gap-3 border-b border-[var(--accent)]/40 bg-[var(--accent-light)] px-4 py-2 text-[13px] text-[var(--text-primary)]">
          <span>Teamsly v{updateStatus.version} is available — downloading…</span>
        </div>
      )}
      {updateStatus.kind === 'downloading' && (
        <div className="flex flex-shrink-0 items-center justify-center gap-3 border-b border-[var(--accent)]/40 bg-[var(--accent-light)] px-4 py-2 text-[13px] text-[var(--text-primary)]">
          <span>Downloading update… {updateStatus.percent ?? 0}%</span>
        </div>
      )}
      {updateStatus.kind === 'downloaded' && (
        <div className="flex flex-shrink-0 items-center justify-center gap-3 border-b border-[var(--accent)]/40 bg-[var(--accent-light)] px-4 py-2 text-[13px] text-[var(--text-primary)]">
          <span>Update ready — v{updateStatus.version}.</span>
          {autoInstallSupported ? (
            <button
              type="button"
              onClick={() => window.electron?.installUpdate()}
              className="rounded bg-[var(--accent)] px-2.5 py-0.5 text-[12px] font-semibold text-white transition-colors hover:opacity-90"
            >
              Restart &amp; install
            </button>
          ) : (
            <button
              type="button"
              onClick={() => window.electron?.openReleasesPage()}
              className="rounded bg-[var(--accent)] px-2.5 py-0.5 text-[12px] font-semibold text-white transition-colors hover:opacity-90"
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
          <Logo size={22} className="text-[var(--accent)]" />
        </div>

        {/* Center: search input */}
        <div className="flex flex-1 items-center justify-center">
          <button
            type="button"
            aria-label="Open search"
            onClick={() => useSearchStore.getState().open()}
            className="press-snap flex h-8 w-full max-w-[480px] items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface-raised)] px-3 text-[13px] text-[var(--text-muted)] transition-colors [transition-duration:var(--motion-fast)] hover:border-[var(--text-muted)] hover:bg-[var(--surface-hover)] focus-ring"
          >
            <Search className="h-3.5 w-3.5 flex-shrink-0 text-[var(--text-muted)]" />
            <span className="flex-1 text-left">Search Teamsly</span>
          </button>
        </div>

        {/* Right: catch-up button + help */}
        <div className="flex flex-shrink-0 items-center gap-2">
          <button
            type="button"
            aria-label="Open catch-up digest"
            onClick={() => openCatchUp(true)}
            className="press-snap inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)]/15 px-3 py-1.5 text-[13px] font-medium text-[var(--accent)] transition-colors [transition-duration:var(--motion-fast)] hover:bg-[var(--accent)]/25"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Catch up
          </button>
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
        <FilePreviewPanel />
      </div>

      <JumpToSwitcher open={jumpToOpen} onOpenChange={setJumpToOpen} items={items} />
      <SearchModal
        open={searchOpen}
        onOpenChange={(v) => { if (!v) closeSearch(); }}
        teamName={teamName}
        channels={teamChannels}
        chats={chats}
        messages={activeMessages}
        messageGroupName={searchGroupName}
        messageOrigin={searchMessageOrigin}
        onSelectChannel={handleSelectChannel}
        onSelectChat={handleSelectChat}
        onSelectMessage={handleSelectMessage}
        onSelectPerson={handleSelectPerson}
      />
      <ToastViewport />
      <RealtimeEventsMount />
      <CatchUpPanel />
      <BootNudge />
      <OfficeHoursBanner />
      <MorningBriefScheduler />
    </div>
  );
}
