import { create } from "zustand";
import { useMemberPanelStore } from "@/store/memberPanel";

interface FilePreviewState {
  open: boolean;
  file: MSFilePreview | null;

  openPreview: (file: MSFilePreview) => void;
  close: () => void;
}

export const useFilePreviewStore = create<FilePreviewState>((set) => ({
  open: false,
  file: null,

  // Right-side panels are mutually exclusive — opening the preview must close
  // the MemberPanel so we don't stack two 300-360px panels and shove the main
  // content into a sliver.
  openPreview: (file) => {
    useMemberPanelStore.getState().close();
    set({ open: true, file });
  },

  close: () => set({ open: false, file: null }),
}));

// Mirror in the other direction: when the MemberPanel opens, close the
// preview. Subscribing once here keeps the dependency one-way at type level
// (memberPanel store knows nothing about files).
useMemberPanelStore.subscribe((state, prev) => {
  if (state.open && !prev.open) {
    useFilePreviewStore.setState({ open: false, file: null });
  }
});
