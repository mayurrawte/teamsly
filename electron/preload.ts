import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  /** Push the total unread count into the main process for tray tooltip / dock badge. */
  setUnreadCount: (n: number): void => {
    ipcRenderer.send('unread-count', n);
  },
  /** Renderer can call this to detect it's running inside Electron. */
  isElectron: (): true => true,
});
