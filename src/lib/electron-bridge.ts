/**
 * Thin bridge to the Electron preload API.
 * All functions are no-ops when running in a plain browser (teamsly.vercel.app).
 */

/** Send the current total unread count to the main process. */
export function sendUnreadCount(n: number): void {
  if (typeof window !== 'undefined') {
    window.electron?.setUnreadCount(n);
  }
}

/** Returns true when running inside the Electron wrapper. */
export function isDesktop(): boolean {
  return Boolean(
    typeof window !== 'undefined' && window.electron?.isElectron?.()
  );
}
