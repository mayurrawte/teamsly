import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { loadAllContexts, saveContext } from "@/lib/storage/message-cache";

// Cap each context's persisted+in-memory array. Graph pages are 50; 200
// covers a couple of "Load more" jumps without unbounded growth.
const MAX_MESSAGES_PER_CONTEXT = 200;
export const EMPTY_MESSAGES: MSMessage[] = [];

function trimToMax(messages: MSMessage[]): MSMessage[] {
  if (messages.length <= MAX_MESSAGES_PER_CONTEXT) return messages;
  return messages.slice(messages.length - MAX_MESSAGES_PER_CONTEXT);
}

function persistContext(contextId: string, messages: MSMessage[]) {
  // Fire-and-forget; saveContext swallows its own errors and strips
  // optimistic (__pending/__failed) entries before write.
  void saveContext(contextId, messages);
}

interface WorkspaceState {
  teams: MSTeam[];
  activeTeamId: string | null;
  channels: Record<string, MSChannel[]>;
  activeChannelId: string | null;
  chats: MSChat[];
  chatsNextLink: string | null;
  activeChatId: string | null;
  // Per-context message cache: keyed by chatId or channelId.
  // Preserved across navigation so re-visiting a context doesn't show a spinner.
  messagesByContext: Record<string, MSMessage[]>;
  isLoadingMessages: boolean;
  presenceMap: Record<string, MSPresence["availability"]>;
  statusMessageMap: Record<string, MSPresence["statusMessage"]>;
  unreadCounts: Record<string, number>;
  currentUserId: string;
  currentUserName: string;
  starredIds: string[];
  /**
   * Transient anchor target used by demo-mode search-jump-to-message. Real
   * mode passes the anchor via `?anchor=` URL param so back/forward works;
   * demo mode doesn't use URL routing (DemoShell renders by active*Id from
   * the store), so the anchor has to live somewhere shared. Cleared by the
   * receiving view after the scroll-and-flash effect runs.
   */
  pendingAnchorMessageId: string | null;

  setTeams: (teams: MSTeam[]) => void;
  setActiveTeam: (id: string) => void;
  setChannels: (teamId: string, channels: MSChannel[]) => void;
  setActiveChannel: (id: string | null) => void;
  setChats: (chats: MSChat[], nextLink?: string | null) => void;
  appendChats: (chats: MSChat[], nextLink: string | null) => void;
  patchChatMembers: (chatId: string, members: MSChatMember[]) => void;
  setActiveChat: (id: string | null) => void;
  /** Selector — returns the cached message list for a context, or []. */
  getMessages: (contextId: string) => MSMessage[];
  /**
   * Best-effort prefill of `messagesByContext` from IndexedDB. Called once
   * on AppShell mount. Existing in-memory entries take precedence — IDB is
   * only used to fill gaps so a reload restores the cache without flicker.
   */
  hydrateMessageCache: () => Promise<void>;
  /**
   * Replace the server-fetched message list for a context.
   * Preserves any optimistic (pending/failed) messages that the server response
   * won't include — merges them back in after applying the server array.
   */
  setMessages: (contextId: string, messages: MSMessage[]) => void;
  appendMessage: (contextId: string, message: MSMessage) => void;
  appendPendingMessage: (contextId: string, message: MSMessage) => void;
  replaceMessage: (contextId: string, tempId: string, serverMessage: MSMessage) => void;
  markMessageFailed: (contextId: string, tempId: string) => void;
  removeMessage: (contextId: string, messageId: string) => void;
  toggleReaction: (contextId: string, messageId: string, reactionType: string) => void;
  deleteMessage: (contextId: string, messageId: string) => { message: MSMessage; index: number } | null;
  restoreMessage: (contextId: string, message: MSMessage, index: number) => void;
  editMessage: (contextId: string, messageId: string, newContent: string) => { previousContent: string; previousContentType: MSMessage["body"]["contentType"]; index: number } | null;
  revertMessageEdit: (contextId: string, messageId: string, previousContent: string, previousContentType: MSMessage["body"]["contentType"]) => void;
  setLoadingMessages: (v: boolean) => void;
  setPresenceMap: (presenceMap: Record<string, MSPresence["availability"]>) => void;
  setStatusMessage: (userId: string, statusMessage: MSPresence["statusMessage"]) => void;
  setCurrentUser: (user: { id: string; displayName: string }) => void;
  initUnreadCounts: (counts: Record<string, number>) => void;
  setUnreadCount: (id: string, count: number) => void;
  markRead: (id: string) => void;
  toggleStar: (id: string) => void;
  setPendingAnchorMessageId: (id: string | null) => void;
}

const UNREAD_STORAGE_KEY = "teamsly:unread-counts";

function sortByCreatedDateTime(messages: MSMessage[]): MSMessage[] {
  return [...messages].sort(
    (a, b) => new Date(a.createdDateTime).getTime() - new Date(b.createdDateTime).getTime()
  );
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      teams: [],
      activeTeamId: null,
      channels: {},
      activeChannelId: null,
      chats: [],
      chatsNextLink: null,
      activeChatId: null,
      messagesByContext: {},
      isLoadingMessages: false,
      presenceMap: {},
      statusMessageMap: {},
      unreadCounts: {},
      currentUserId: "you",
      currentUserName: "You",
      starredIds: [],
      pendingAnchorMessageId: null,

      setTeams: (teams) => set({ teams }),
      setActiveTeam: (id) => set({ activeTeamId: id, activeChannelId: null }),
      setChannels: (teamId, channels) =>
        set((s) => ({ channels: { ...s.channels, [teamId]: channels } })),
      setActiveChannel: (id) => set({ activeChannelId: id, activeChatId: null }),
      setChats: (chats, nextLink = null) =>
        set({ chats, chatsNextLink: nextLink }),
      appendChats: (incoming, nextLink) =>
        set((s) => {
          const existingIds = new Set(s.chats.map((c) => c.id));
          const deduped = incoming.filter((c) => !existingIds.has(c.id));
          return {
            chats: [...s.chats, ...deduped],
            chatsNextLink: nextLink,
          };
        }),
      patchChatMembers: (chatId, members) =>
        set((s) => ({
          chats: s.chats.map((c) => (c.id === chatId ? { ...c, members } : c)),
        })),
      setActiveChat: (id) => set({ activeChatId: id, activeChannelId: null }),

      getMessages: (contextId) => get().messagesByContext[contextId] ?? EMPTY_MESSAGES,

      setMessages: (contextId, incoming) =>
        set((s) => {
          const existing = s.messagesByContext[contextId] ?? [];
          // Preserve optimistic (pending/failed) messages that the server response
          // won't contain — they live only in local state until confirmed or failed.
          const pending = existing.filter((m) => m.__pending || m.__failed);
          const serverIds = new Set(incoming.map((m) => m.id));
          const uniquePending = pending.filter((m) => !serverIds.has(m.id));
          const merged = trimToMax(sortByCreatedDateTime([...incoming, ...uniquePending]));
          persistContext(contextId, merged);
          return {
            messagesByContext: { ...s.messagesByContext, [contextId]: merged },
          };
        }),

      hydrateMessageCache: async () => {
        const cached = await loadAllContexts();
        set((s) => {
          // Don't clobber any in-memory entries that already exist — IDB is
          // best-effort prefill, not a source of truth.
          const merged: Record<string, MSMessage[]> = { ...cached };
          for (const [k, v] of Object.entries(s.messagesByContext)) {
            merged[k] = v;
          }
          return { messagesByContext: merged };
        });
      },

      appendMessage: (contextId, message) =>
        set((s) => {
          const existing = s.messagesByContext[contextId] ?? [];
          const next = trimToMax([...existing, message]);
          persistContext(contextId, next);
          return {
            messagesByContext: { ...s.messagesByContext, [contextId]: next },
          };
        }),

      appendPendingMessage: (contextId, message) =>
        set((s) => {
          const existing = s.messagesByContext[contextId] ?? [];
          const next = trimToMax([...existing, { ...message, __pending: true }]);
          // saveContext strips pending entries internally, so this still writes
          // the acked tail to IDB.
          persistContext(contextId, next);
          return {
            messagesByContext: {
              ...s.messagesByContext,
              [contextId]: next,
            },
          };
        }),

      replaceMessage: (contextId, tempId, serverMessage) =>
        set((s) => {
          const existing = s.messagesByContext[contextId] ?? [];
          const next = existing.map((m) =>
            m.id === tempId
              ? { ...serverMessage, __pending: undefined, __failed: undefined }
              : m
          );
          persistContext(contextId, next);
          return {
            messagesByContext: {
              ...s.messagesByContext,
              [contextId]: next,
            },
          };
        }),

      markMessageFailed: (contextId, tempId) =>
        set((s) => {
          const existing = s.messagesByContext[contextId] ?? [];
          const next = existing.map((m) =>
            m.id === tempId ? { ...m, __pending: undefined, __failed: true } : m
          );
          persistContext(contextId, next);
          return {
            messagesByContext: {
              ...s.messagesByContext,
              [contextId]: next,
            },
          };
        }),

      removeMessage: (contextId, messageId) =>
        set((s) => {
          const existing = s.messagesByContext[contextId] ?? [];
          const next = existing.filter((m) => m.id !== messageId);
          persistContext(contextId, next);
          return {
            messagesByContext: {
              ...s.messagesByContext,
              [contextId]: next,
            },
          };
        }),

      toggleReaction: (contextId, messageId, reactionType) =>
        set((s) => {
          const existing = s.messagesByContext[contextId] ?? [];
          const next = existing.map((message) => {
            if (message.id !== messageId) return message;
            const reactions = message.reactions ?? [];
            const reaction = reactions.find(
              (r) => r.reactionType === reactionType && r.user.id === s.currentUserId
            );
            return {
              ...message,
              reactions: reaction
                ? reactions.filter((r) => r !== reaction)
                : [
                    ...reactions,
                    { reactionType, user: { id: s.currentUserId, displayName: s.currentUserName } },
                  ],
            };
          });
          persistContext(contextId, next);
          return {
            messagesByContext: {
              ...s.messagesByContext,
              [contextId]: next,
            },
          };
        }),

      deleteMessage: (contextId, messageId) => {
        let result: { message: MSMessage; index: number } | null = null;
        set((s) => {
          const existing = s.messagesByContext[contextId] ?? [];
          const index = existing.findIndex((m) => m.id === messageId);
          if (index === -1) return s;
          result = { message: existing[index], index };
          const next = [...existing];
          next.splice(index, 1);
          persistContext(contextId, next);
          return {
            messagesByContext: { ...s.messagesByContext, [contextId]: next },
          };
        });
        return result;
      },

      restoreMessage: (contextId, message, index) =>
        set((s) => {
          const existing = s.messagesByContext[contextId] ?? [];
          const next = [...existing];
          next.splice(index, 0, message);
          persistContext(contextId, next);
          return {
            messagesByContext: { ...s.messagesByContext, [contextId]: next },
          };
        }),

      editMessage: (contextId, messageId, newContent) => {
        let result: {
          previousContent: string;
          previousContentType: MSMessage["body"]["contentType"];
          index: number;
        } | null = null;
        set((s) => {
          const existing = s.messagesByContext[contextId] ?? [];
          const index = existing.findIndex((m) => m.id === messageId);
          if (index === -1) return s;
          const msg = existing[index];
          result = {
            previousContent: msg.body.content,
            previousContentType: msg.body.contentType,
            index,
          };
          const next = [...existing];
          next[index] = { ...msg, body: { contentType: "html", content: newContent } };
          persistContext(contextId, next);
          return {
            messagesByContext: { ...s.messagesByContext, [contextId]: next },
          };
        });
        return result;
      },

      revertMessageEdit: (contextId, messageId, previousContent, previousContentType) =>
        set((s) => {
          const existing = s.messagesByContext[contextId] ?? [];
          const index = existing.findIndex((m) => m.id === messageId);
          if (index === -1) return s;
          const next = [...existing];
          next[index] = {
            ...next[index],
            body: { contentType: previousContentType, content: previousContent },
          };
          persistContext(contextId, next);
          return {
            messagesByContext: { ...s.messagesByContext, [contextId]: next },
          };
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
      setPendingAnchorMessageId: (id) => set({ pendingAnchorMessageId: id }),
    }),
    {
      name: "teamsly:workspace",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? localStorage : (undefined as unknown as Storage)
      ),
      version: 2,
      migrate: (persistedState, _version) => {
        // v1 → v2: messages flat array dropped; messagesByContext map introduced.
        // Discard any persisted message state — it will be re-fetched on mount.
        const s = persistedState as Record<string, unknown>;
        delete s.messages;
        if (!s.messagesByContext) s.messagesByContext = {};
        return s as unknown as WorkspaceState;
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
