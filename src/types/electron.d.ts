/** Discriminated union emitted by window.electron.onUpdateEvent */
type UpdateEvent =
  | { kind: 'available';     version: string }
  | { kind: 'not-available' }
  | { kind: 'error';         message: string }
  | { kind: 'downloading';   percent: number }
  | { kind: 'downloaded';    version: string };

declare global {
  interface Window {
    electron?: {
      setUnreadCount: (n: number) => void;
      isElectron: () => boolean;
      // Auto-update
      checkForUpdates: () => void;
      installUpdate: () => void;
      openReleasesPage: () => void;
      onUpdateEvent: (callback: (event: UpdateEvent) => void) => () => void;
      isAutoInstallSupported: () => boolean;
    };
  }
}

export {};
