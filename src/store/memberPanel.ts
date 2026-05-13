import { create } from "zustand";

export type MemberPanelView = "channel-members" | "individual-profile";

interface MemberPanelState {
  open: boolean;
  view: MemberPanelView;
  selectedMember: MSChatMember | null;
  currentTeamId: string | null;
  currentChannelId: string | null;

  openChannelMembers: (teamId: string, channelId: string) => void;
  openMemberProfile: (member: MSChatMember) => void;
  close: () => void;
}

export const useMemberPanelStore = create<MemberPanelState>((set) => ({
  open: false,
  view: "channel-members",
  selectedMember: null,
  currentTeamId: null,
  currentChannelId: null,

  openChannelMembers: (teamId, channelId) =>
    set({
      open: true,
      view: "channel-members",
      selectedMember: null,
      currentTeamId: teamId,
      currentChannelId: channelId,
    }),

  openMemberProfile: (member) =>
    set({ open: true, view: "individual-profile", selectedMember: member }),

  close: () => set({ open: false, selectedMember: null }),
}));
