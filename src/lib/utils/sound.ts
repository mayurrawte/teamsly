/**
 * Web-Audio one-shot tones used by the notification sound preference.
 *
 * We use synthesized tones rather than audio files for two reasons:
 *  1. Adds 0 bytes to the bundle, no `/public/sounds/*.wav` shipping.
 *  2. Volume + theme are real-time variable — a single AudioContext
 *     produces a different pitch envelope per theme, scaled by the
 *     user's volume slider, without re-decoding anything.
 *
 * The AudioContext is created lazily on first call and reused. Browsers
 * require a user gesture before the context can produce sound; the first
 * mute/unmute, message-send, or button click in the page satisfies this
 * automatically, so we don't manage it explicitly.
 */

import type { SoundTheme } from "@/store/preferences";

let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    return ctx;
  } catch {
    return null;
  }
}

interface Beep {
  /** Hz */
  freq: number;
  /** seconds */
  duration: number;
  /** seconds — offset from the tone start */
  delay: number;
  /** 0..1 peak gain before user-volume scaling */
  peak: number;
  /** oscillator type — sine is gentlest, triangle slightly brighter */
  type?: OscillatorType;
}

const THEMES: Record<Exclude<SoundTheme, "off">, Beep[]> = {
  // Subtle: a single short, soft pop at A5. Hardly registers in a room.
  subtle: [
    { freq: 880, duration: 0.08, delay: 0, peak: 0.18, type: "sine" },
  ],
  // Playful: a two-note rise — C6 → E6, a tiny "chime" without being
  // saccharine. Triangle wave adds a touch of brightness.
  playful: [
    { freq: 1046, duration: 0.07, delay: 0,    peak: 0.18, type: "triangle" },
    { freq: 1318, duration: 0.10, delay: 0.07, peak: 0.18, type: "triangle" },
  ],
};

/**
 * Play the notification tone for the given theme at the given volume.
 * No-ops on the server, in browsers without Web Audio, or when theme is
 * "off". Errors are swallowed — sound is never load-bearing.
 */
export function playNotificationTone(theme: SoundTheme, volumePct: number): void {
  if (theme === "off") return;
  const context = getContext();
  if (!context) return;

  const volume = Math.max(0, Math.min(1, volumePct / 100));
  if (volume === 0) return;

  // Some browsers leave the AudioContext suspended until a user gesture
  // observably "happens"; even with a real gesture earlier this can still
  // fail right after page load. resume() is safe to call repeatedly.
  if (context.state === "suspended") {
    void context.resume().catch(() => {});
  }

  const now = context.currentTime;
  const beeps = THEMES[theme];

  for (const beep of beeps) {
    try {
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = beep.type ?? "sine";
      osc.frequency.value = beep.freq;
      // Quick attack, exponential decay — avoids the audible "click" of a
      // hard envelope edge.
      const start = now + beep.delay;
      const end = start + beep.duration;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(beep.peak * volume, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      osc.connect(gain);
      gain.connect(context.destination);
      osc.start(start);
      osc.stop(end + 0.02);
    } catch {
      // best-effort
    }
  }
}
