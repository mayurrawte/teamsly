"use client";

import { createContext, useCallback, useContext, useState } from "react";
import type { VoiceRoomTarget } from "@/lib/voice/types";
import { useToastStore } from "@/store/toasts";

interface VoiceRoomContextValue {
  active: VoiceRoomTarget | null;
  token: string | null;
  url: string | null;
  join: (target: VoiceRoomTarget) => Promise<void>;
  leave: () => void;
}

const VoiceRoomContext = createContext<VoiceRoomContextValue>({
  active: null,
  token: null,
  url: null,
  join: async () => {},
  leave: () => {},
});

export function VoiceRoomProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState<VoiceRoomTarget | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const showToast = useToastStore((s) => s.showToast);

  const join = useCallback(
    async (target: VoiceRoomTarget) => {
      try {
        const res = await fetch("/api/voice/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomName: target.name }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? "Token fetch failed");
        }
        const data = (await res.json()) as { token: string; url: string };
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
    [showToast]
  );

  const leave = useCallback(() => {
    setActive(null);
    setToken(null);
    setUrl(null);
  }, []);

  return (
    <VoiceRoomContext.Provider value={{ active, token, url, join, leave }}>
      {children}
    </VoiceRoomContext.Provider>
  );
}

export function useVoiceRoom() {
  return useContext(VoiceRoomContext);
}
