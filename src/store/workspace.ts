import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

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
  statusMessageMap: Record<string, MSPresence["statusMessage"]>;
  unreadCounts: Record<string, number>;
  currentUserId: string;
  currentUserName: string;
  starredIds: string[];

  setTeams: (teams: MSTeam[]) => void;
  setActiveTeam: (id: string) => void;
  setChannels: (teamId: string, channels: MSChannel[]) => void;
  setActiveChannel: (id: string | null) => void;
  setChats: (chats: MSChat[], nextLink?: string | null) => void;
  appendChats: (chats: MSChat[], nextLink: string | null) => void;
  setActiveChat: (id: string | null) => void;
  setMessages: (messages: MSMessage[]) => void;
  appendMessage: (message: MSMessage) => void;
  // Optimistic-send actions — operate on the local message list only.
  appendPendingMessage: (message: MSMessage) => void;
  replaceMessage: (tempId: string, serverMessage: MSMessage) => void;
  markMessageFailed: (tempId: string) => void;
  removeMessage: (messageId: string) => void;
  toggleReaction: (messageId: string, reactionType: string) => void;
  deleteMessage: (messageId: string) => { message: MSMessage; index: number } | null;
  restoreMessage: (message: MSMessage, index: number) => void;
  editMessage: (messageId: string, newContent: string) => { previousContent: string; previousContentType: MSMessage["body"]["contentType"]; index: number } | null;
  revertMessageEdit: (messageId: string, previousContent: string, previousContentType: MSMessage["body"]["contentType"]) => void;
  setLoadingMessages: (v: boolean) => void;
  setPresenceMap: (presenceMap: Record<string, MSPresence["availability"]>) => void;
  setStatusMessage: (userId: string, statusMessage: MSPresence["statusMessage"]) => void;
  setCurrentUser: (user: { id: string; displayName: string }) => void;
  initUnreadCounts: (counts: Record<string, number>) => void;
  setUnreadCount: (id: string, count: number) => void;
  markRead: (id: string) => void;
  toggleStar: (id: string) => void;
}

const UNREAD_STORAGE_KEY = "teamsly:unread-counts";

// Graph's `chat.lastUpdatedDateTime` only changes on rename / membership changes,
// not on new messages. The reliable "most recent activity" field is
// `lastMessagePreview.createdDateTime`. Fall back to `lastUpdatedDateTime`
// only when the preview is missing (older persisted state, edge cases).
function chatActivityTime(chat: MSChat): number {
  const previewTime = chat.lastMessagePreview?.createdDateTime;
  if (previewTime) return new Date(previewTime).getTime();
  if (chat.lastUpdatedDateTime) return new Date(chat.lastUpdatedDateTime).getTime();
  return 0;
}

function sortChatsByActivity(chats: MSChat[]): MSChat[] {
  return [...chats].sort((a, b) => chatActivityTime(b) - chatActivityTime(a));
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
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
      statusMessageMap: {},
      unreadCounts: {},
      currentUserId: "you",
      currentUserName: "You",
      starredIds: [],

      setTeams: (teams) => set({ teams }),
      setActiveTeam: (id) => set({ activeTeamId: id, activeChannelId: null, messages: [] }),
      setChannels: (teamId, channels) =>
        set((s) => ({ channels: { ...s.channels, [teamId]: channels } })),
      setActiveChannel: (id) => set({ activeChannelId: id, activeChatId: null, messages: [] }),
      setChats: (chats, nextLink = null) =>
        set({ chats: sortChatsByActivity(chats), chatsNextLink: nextLink }),
      appendChats: (incoming, nextLink) =>
        set((s) => {
          const existingIds = new Set(s.chats.map((c) => c.id));
          const deduped = incoming.filter((c) => !existingIds.has(c.id));
          return {
            chats: sortChatsByActivity([...s.chats, ...deduped]),
            chatsNextLink: nextLink,
          };
        }),
      setActiveChat: (id) => set({ activeChatId: id, activeChannelId: null, messages: [] }),
      setMessages: (messages) => set({ messages }),
      appendMessage: (message) => set((s) => ({ messages: [...s.messages, message] })),
      // Append an optimistic message that visually appears before server confirms it.
      appendPendingMessage: (message) =>
        set((s) => ({ messages: [...s.messages, { ...message, __pending: true }] })),
      replaceMessage: (tempId, serverMessage) =>
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === tempId
              ? { ...serverMessage, __pending: undefined, __failed: undefined }
              : m
          ),
        })),
      markMessageFailed: (tempId) =>
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === tempId ? { ...m, __pending: undefined, __failed: true } : m
          ),
        })),
      removeMessage: (messageId) =>
        set((s) => ({ messages: s.messages.filter((m) => m.id !== messageId) })),
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
      deleteMessage: (messageId) => {
        let result: { message: MSMessage; index: number } | null = null;
        set((s) => {
          const index = s.messages.findIndex((m) => m.id === messageId);
          if (index === -1) return s;
          result = { message: s.messages[index], index };
          const next = [...s.messages];
          next.splice(index, 1);
          return { messages: next };
        });
        return result;
      },
      restoreMessage: (message, index) =>
        set((s) => {
          const next = [...s.messages];
          next.splice(index, 0, message);
          return { messages: next };
        }),
      editMessage: (messageId, newContent) => {
        let result: { previousContent: string; previousContentType: MSMessage["body"]["contentType"]; index: number } | null = null;
        set((s) => {
          const index = s.messages.findIndex((m) => m.id === messageId);
          if (index === -1) return s;
          const msg = s.messages[index];
          result = { previousContent: msg.body.content, previousContentType: msg.body.contentType, index };
          const next = [...s.messages];
          next[index] = { ...msg, body: { contentType: "html", content: newContent } };
          return { messages: next };
        });
        return result;
      },
      revertMessageEdit: (messageId, previousContent, previousContentType) =>
        set((s) => {
          const index = s.messages.findIndex((m) => m.id === messageId);
          if (index === -1) return s;
          const next = [...s.messages];
          next[index] = { ...next[index], body: { contentType: previousContentType, content: previousContent } };
          return { messages: next };
        }),
      setLoadingMessages: (v) => set({ isLoadingMessages: v }),
      setPresenceMap: (presenceMap) => set({ presenceMap }),
      setStatusMessage: (userId, statusMessage) =>
        set((s) => ({ statusMessageMap: { ...s.statusMessageMap, [userId]: statusMessage } })),
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
      toggleStar: (id) =>
        set((s) => {
          const next = s.starredIds.includes(id)
            ? s.starredIds.filter((sid) => sid !== id)
            : [...s.starredIds, id];
          return { starredIds: next };
        }),
    }),
    {
      name: "teamsly:workspace",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? localStorage : (undefined as unknown as Storage)
      ),
      version: 1,
      migrate: (persistedState, _version) => {
        // Placeholder: return persisted state as-is for future schema migrations.
        return persistedState as WorkspaceState;
      },
      partialize: (state) => ({
        teams: state.teams,
        channels: state.channels,
        chats: state.chats,
        chatsNextLink: state.chatsNextLink,
        currentUserId: state.currentUserId,
        currentUserName: state.currentUserName,
        starredIds: state.starredIds,
      }),
    }
  )
);

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
