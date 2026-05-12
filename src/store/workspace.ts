import { create } from "zustand";

interface WorkspaceState {
  teams: MSTeam[];
  activeTeamId: string | null;
  channels: Record<string, MSChannel[]>;
  activeChannelId: string | null;
  chats: MSChat[];
  chatsNextLink: string | null;
  activeChatId: string | null;
  messages: MSMessage[];
  isLoadingMessages: boolean;
  presenceMap: Record<string, MSPresence["availability"]>;
  unreadCounts: Record<string, number>;
  currentUserId: string;
  currentUserName: string;

  setTeams: (teams: MSTeam[]) => void;
  setActiveTeam: (id: string) => void;
  setChannels: (teamId: string, channels: MSChannel[]) => void;
  setActiveChannel: (id: string | null) => void;
  setChats: (chats: MSChat[], nextLink?: string | null) => void;
  appendChats: (chats: MSChat[], nextLink: string | null) => void;
  setActiveChat: (id: string | null) => void;
  setMessages: (messages: MSMessage[]) => void;
  appendMessage: (message: MSMessage) => void;
  toggleReaction: (messageId: string, reactionType: string) => void;
  setLoadingMessages: (v: boolean) => void;
  setPresenceMap: (presenceMap: Record<string, MSPresence["availability"]>) => void;
  setCurrentUser: (user: { id: string; displayName: string }) => void;
  initUnreadCounts: (counts: Record<string, number>) => void;
  setUnreadCount: (id: string, count: number) => void;
  markRead: (id: string) => void;
}

const UNREAD_STORAGE_KEY = "teamsly:unread-counts";

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  teams: [],
  activeTeamId: null,
  channels: {},
  activeChannelId: null,
  chats: [],
  chatsNextLink: null,
  activeChatId: null,
  messages: [],
  isLoadingMessages: false,
  presenceMap: {},
  unreadCounts: {},
  currentUserId: "you",
  currentUserName: "You",

  setTeams: (teams) => set({ teams }),
  setActiveTeam: (id) => set({ activeTeamId: id, activeChannelId: null, messages: [] }),
  setChannels: (teamId, channels) =>
    set((s) => ({ channels: { ...s.channels, [teamId]: channels } })),
  setActiveChannel: (id) => set({ activeChannelId: id, activeChatId: null, messages: [] }),
  setChats: (chats, nextLink = null) => set({ chats, chatsNextLink: nextLink }),
  appendChats: (incoming, nextLink) =>
    set((s) => {
      const existingIds = new Set(s.chats.map((c) => c.id));
      const deduped = incoming.filter((c) => !existingIds.has(c.id));
      return { chats: [...s.chats, ...deduped], chatsNextLink: nextLink };
    }),
  setActiveChat: (id) => set({ activeChatId: id, activeChannelId: null, messages: [] }),
  setMessages: (messages) => set({ messages }),
  appendMessage: (message) => set((s) => ({ messages: [...s.messages, message] })),
  toggleReaction: (messageId, reactionType) =>
    set((s) => ({
      messages: s.messages.map((message) => {
        if (message.id !== messageId) return message;

        const reactions = message.reactions ?? [];
        const existing = reactions.find(
          (reaction) => reaction.reactionType === reactionType && reaction.user.id === s.currentUserId
        );

        return {
          ...message,
          reactions: existing
            ? reactions.filter((reaction) => reaction !== existing)
            : [
                ...reactions,
                { reactionType, user: { id: s.currentUserId, displayName: s.currentUserName } },
              ],
        };
      }),
    })),
  setLoadingMessages: (v) => set({ isLoadingMessages: v }),
  setPresenceMap: (presenceMap) => set({ presenceMap }),
  setCurrentUser: (user) => set({ currentUserId: user.id, currentUserName: user.displayName }),
  initUnreadCounts: (counts) => {
    const stored = readUnreadCounts();
    set({ unreadCounts: stored ?? counts });
    if (!stored) writeUnreadCounts(counts);
  },
  setUnreadCount: (id, count) =>
    set((s) => {
      const next = { ...s.unreadCounts, [id]: count };
      if (count <= 0) delete next[id];
      writeUnreadCounts(next);
      return { unreadCounts: next };
    }),
  markRead: (id) =>
    set((s) => {
      if (!s.unreadCounts[id]) return s;
      const next = { ...s.unreadCounts };
      delete next[id];
      writeUnreadCounts(next);
      return { unreadCounts: next };
    }),
}));

function readUnreadCounts(): Record<string, number> | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(UNREAD_STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as Record<string, number>;
  } catch {
    return null;
  }
}

function writeUnreadCounts(counts: Record<string, number>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(UNREAD_STORAGE_KEY, JSON.stringify(counts));
}
