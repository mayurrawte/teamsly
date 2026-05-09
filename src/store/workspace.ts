import { create } from "zustand";

interface WorkspaceState {
  teams: MSTeam[];
  activeTeamId: string | null;
  channels: Record<string, MSChannel[]>;
  activeChannelId: string | null;
  chats: MSChat[];
  activeChatId: string | null;
  messages: MSMessage[];
  isLoadingMessages: boolean;
  presenceMap: Record<string, MSPresence["availability"]>;

  setTeams: (teams: MSTeam[]) => void;
  setActiveTeam: (id: string) => void;
  setChannels: (teamId: string, channels: MSChannel[]) => void;
  setActiveChannel: (id: string | null) => void;
  setChats: (chats: MSChat[]) => void;
  setActiveChat: (id: string | null) => void;
  setMessages: (messages: MSMessage[]) => void;
  appendMessage: (message: MSMessage) => void;
  toggleReaction: (messageId: string, reactionType: string) => void;
  setLoadingMessages: (v: boolean) => void;
  setPresenceMap: (presenceMap: Record<string, MSPresence["availability"]>) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  teams: [],
  activeTeamId: null,
  channels: {},
  activeChannelId: null,
  chats: [],
  activeChatId: null,
  messages: [],
  isLoadingMessages: false,
  presenceMap: {},

  setTeams: (teams) => set({ teams }),
  setActiveTeam: (id) => set({ activeTeamId: id, activeChannelId: null, messages: [] }),
  setChannels: (teamId, channels) =>
    set((s) => ({ channels: { ...s.channels, [teamId]: channels } })),
  setActiveChannel: (id) => set({ activeChannelId: id, activeChatId: null, messages: [] }),
  setChats: (chats) => set({ chats }),
  setActiveChat: (id) => set({ activeChatId: id, activeChannelId: null, messages: [] }),
  setMessages: (messages) => set({ messages }),
  appendMessage: (message) => set((s) => ({ messages: [...s.messages, message] })),
  toggleReaction: (messageId, reactionType) =>
    set((s) => ({
      messages: s.messages.map((message) => {
        if (message.id !== messageId) return message;

        const reactions = message.reactions ?? [];
        const existing = reactions.find(
          (reaction) => reaction.reactionType === reactionType && reaction.user.id === "you"
        );

        return {
          ...message,
          reactions: existing
            ? reactions.filter((reaction) => reaction !== existing)
            : [
                ...reactions,
                { reactionType, user: { id: "you", displayName: "You" } },
              ],
        };
      }),
    })),
  setLoadingMessages: (v) => set({ isLoadingMessages: v }),
  setPresenceMap: (presenceMap) => set({ presenceMap }),
}));
