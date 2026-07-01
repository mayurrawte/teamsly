"use client";

import { createContext, useCallback, useContext, useState } from "react";
import type { VoiceRoomTarget } from "@/lib/voice/types";
import { useToastStore } from "@/store/toasts";

interface VoiceRoomContextValue {
  active: VoiceRoomTarget | null;
  token: string | null;
  url: string | null;
  join: (target: VoiceRoomTarget) => Promise<void>;
  /** Re-fetch a token for the active room without losing the target.
   *  Used by the widget's "Retry" affordance after a LiveKit error. */
  rejoin: () => Promise<void>;
  leave: () => void;
}

const VoiceRoomContext = createContext<VoiceRoomContextValue>({
  active: null,
  token: null,
  url: null,
  join: async () => {},
  rejoin: async () => {},
  leave: () => {},
});

export function VoiceRoomProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState<VoiceRoomTarget | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const showToast = useToastStore((s) => s.showToast);

  const fetchTokenFor = useCallback(
    async (target: VoiceRoomTarget) => {
      const res = await fetch("/api/voice/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomName: target.name,
          chatId: target.chatId,
          teamId: target.teamId,
          channelId: target.channelId,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Token fetch failed (${res.status})`);
      }
      return (await res.json()) as { token: string; url: string };
    },
    [],
  );

  const join = useCallback(
    async (target: VoiceRoomTarget) => {
      try {
        const data = await fetchTokenFor(target);
        setToken(data.token);
        setUrl(data.url);
        setActive(target);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Could not join voice room";
        showToast({ title: msg, tone: "error" });
        setActive(null);
        setToken(null);
        setUrl(null);
      }
    },
    [fetchTokenFor, showToast],
  );

  const rejoin = useCallback(async () => {
    if (!active) return;
    try {
      const data = await fetchTokenFor(active);
      // Clear token first so LiveKitRoom remounts cleanly with the new token.
      setToken(null);
      setUrl(null);
      // Re-set on next tick.
      window.setTimeout(() => {
        setToken(data.token);
        setUrl(data.url);
      }, 0);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not rejoin voice room";
      showToast({ title: msg, tone: "error" });
    }
  }, [active, fetchTokenFor, showToast]);

  const leave = useCallback(() => {
    setActive(null);
    setToken(null);
    setUrl(null);
  }, []);

  return (
    <VoiceRoomContext.Provider value={{ active, token, url, join, rejoin, leave }}>
      {children}
    </VoiceRoomContext.Provider>
  );
}

export function useVoiceRoom() {
  return useContext(VoiceRoomContext);
}
