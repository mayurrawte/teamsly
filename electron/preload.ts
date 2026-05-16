import { contextBridge, ipcRenderer } from 'electron';

/** Discriminated union emitted over the update-event IPC channels. */
type UpdateEvent =
  | { kind: 'available';     version: string }
  | { kind: 'not-available' }
  | { kind: 'error';         message: string }
  | { kind: 'downloading';   percent: number }
  | { kind: 'downloaded';    version: string };

// macOS unsigned builds cannot auto-install — Gatekeeper rejects unsigned zips.
// Linux (AppImage) and Windows (NSIS) support auto-install.
const AUTO_INSTALL_SUPPORTED = process.platform === 'linux' || process.platform === 'win32';

contextBridge.exposeInMainWorld('electron', {
  /** Push the total unread count into the main process for tray tooltip / dock badge. */
  setUnreadCount: (n: number): void => {
    ipcRenderer.send('unread-count', n);
  },
  /** Renderer can call this to detect it's running inside Electron. */
  isElectron: (): true => true,
  /** OS platform string so the renderer can adapt layout (e.g. macOS traffic light inset). */
  platform: process.platform as string,
  /**
   * Synchronous BrowserWindow focus check. Backs the smart-notification
   * de-dupe guard so notifications don't double-fire when the desktop window
   * is focused and a browser tab is also visible.
   */
  isFocused: (): boolean => {
    return ipcRenderer.sendSync('window-is-focused') === true;
  },

  // ─── Auto-update ──────────────────────────────────────────────────────────

  /** Trigger a manual update check (user-initiated). */
  checkForUpdates: (): void => {
    ipcRenderer.send('update-check');
  },
  /** Restart and install a downloaded update (only valid when auto-install is supported). */
  installUpdate: (): void => {
    ipcRenderer.send('update-install');
  },
  /** Open the GitHub releases page in the system browser. */
  openReleasesPage: (): void => {
    ipcRenderer.send('update-open-releases');
  },
  /**
   * Register a callback for all update lifecycle events. Returns an
   * unsubscribe function the caller should invoke on component unmount.
   */
  onUpdateEvent: (callback: (event: UpdateEvent) => void): (() => void) => {
    // Each IPC payload contains only the data fields (no 'kind' — we inject that here).
    type VersionPayload   = { version: string };
    type ErrorPayload     = { message: string };
    type ProgressPayload  = { percent: number };

    const handlers: Array<[string, (_e: Electron.IpcRendererEvent, ...args: unknown[]) => void]> = [
      [
        'update-available',
        (_e, p) => {
          const { version } = p as VersionPayload;
          callback({ kind: 'available', version });
        },
      ],
      [
        'update-not-available',
        (_e) => callback({ kind: 'not-available' }),
      ],
      [
        'update-error',
        (_e, p) => {
          const { message } = p as ErrorPayload;
          callback({ kind: 'error', message });
        },
      ],
      [
        'update-download-progress',
        (_e, p) => {
          const { percent } = p as ProgressPayload;
          callback({ kind: 'downloading', percent });
        },
      ],
      [
        'update-downloaded',
        (_e, p) => {
          const { version } = p as VersionPayload;
          callback({ kind: 'downloaded', version });
        },
      ],
    ];

    for (const [ch, fn] of handlers) ipcRenderer.on(ch, fn);
    return () => {
      for (const [ch, fn] of handlers) ipcRenderer.removeListener(ch, fn);
    };
  },
  /** Whether this platform supports silent auto-install (false on unsigned macOS). */
  isAutoInstallSupported: (): boolean => AUTO_INSTALL_SUPPORTED,
});
