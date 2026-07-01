"use client";

import { useEffect, useState } from "react";
import { Mic } from "lucide-react";
import { useVoiceRoom } from "./VoiceRoomProvider";

interface VoiceTriggerProps {
  roomName: string;
  displayName: string;
  className?: string;
  /** Resource this room belongs to — forwarded so the server can verify membership. */
  chatId?: string;
  teamId?: string;
  channelId?: string;
}

export function VoiceTrigger({ roomName, displayName, className, chatId, teamId, channelId }: VoiceTriggerProps) {
  const { active, join } = useVoiceRoom();
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/voice/active/${encodeURIComponent(roomName)}`);
        if (!res.ok) return;
        const data = (await res.json()) as { participants: unknown[] };
        if (!cancelled) setCount(data.participants.length);
      } catch {
        // ignore — room may not exist yet
      }
    }

    poll();
    const id = setInterval(poll, 15_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [roomName]);

  const isInThisRoom = active?.name === roomName;

  return (
    <button
      type="button"
      disabled={isInThisRoom}
      onClick={() => { void join({ name: roomName, displayName, chatId, teamId, channelId }); }}
      title={isInThisRoom ? "Already in voice room" : count > 0 ? `Join voice (${count} in room)` : "Start voice room"}
      className={`flex items-center gap-1 rounded p-1.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)] focus-ring disabled:cursor-default disabled:opacity-60 ${className ?? ""}`}
    >
      <Mic className="h-4 w-4" />
      {count > 0 && !isInThisRoom && (
        <span className="text-xs font-medium">{count}</span>
      )}
      {isInThisRoom && (
        <span className="text-xs font-medium">Live</span>
      )}
    </button>
  );
}
