import { create } from "zustand";

export type MemberPanelView = "channel-members" | "individual-profile";

interface MemberPanelState {
  open: boolean;
  view: MemberPanelView;
  selectedMember: MSChatMember | null;

  openChannelMembers: () => void;
  openMemberProfile: (member: MSChatMember) => void;
  close: () => void;
}

export const useMemberPanelStore = create<MemberPanelState>((set) => ({
  open: false,
  view: "channel-members",
  selectedMember: null,

  openChannelMembers: () =>
    set({ open: true, view: "channel-members", selectedMember: null }),

  openMemberProfile: (member) =>
    set({ open: true, view: "individual-profile", selectedMember: member }),

  close: () => set({ open: false, selectedMember: null }),
}));
