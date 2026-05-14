declare global {
  interface Window {
    electron?: {
      setUnreadCount: (n: number) => void;
      isElectron: () => boolean;
    };
  }
}

export {};
