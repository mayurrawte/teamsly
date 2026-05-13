// Lazily created singleton so we don't create a new element on every call.
let audio: HTMLAudioElement | null = null;
let lastPlayedAt = 0;
const DEBOUNCE_MS = 1500;

/**
 * Plays the notification chime at most once per DEBOUNCE_MS window.
 * Safe to call on the server (no-ops if window is unavailable).
 * Autoplay errors are swallowed so they never appear in the console.
 */
export function playNotificationSound(): void {
  if (typeof window === "undefined") return;

  const now = Date.now();
  if (now - lastPlayedAt < DEBOUNCE_MS) return;
  lastPlayedAt = now;

  if (!audio) {
    audio = new Audio("/sounds/notify.wav");
    audio.volume = 0.6;
  }

  // Reset position before replaying in case the previous play is still in progress.
  audio.currentTime = 0;
  audio.play().catch(() => {
    // Browser autoplay policy may block playback before the first user gesture.
    // Swallow silently — the preference will work as soon as interaction occurs.
  });
}
