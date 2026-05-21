"use client";

import "@livekit/components-styles";
import { LiveKitRoom, RoomAudioRenderer, useLocalParticipant, useParticipants } from "@livekit/components-react";
import { Mic, MicOff, PhoneOff } from "lucide-react";
import { useVoiceRoom } from "./VoiceRoomProvider";

export function VoiceRoomWidget() {
  const { active, token, url, leave } = useVoiceRoom();

  if (!active || !token || !url) return null;

  return (
    <div className="pointer-events-auto fixed bottom-4 right-4 z-50 w-80 rounded-lg border border-border bg-card shadow-xl">
      <LiveKitRoom
        token={token}
        serverUrl={url}
        connect={true}
        audio={false}
        video={false}
        onDisconnected={leave}
      >
        <RoomAudioRenderer />
        <WidgetInner displayName={active.displayName} onLeave={leave} />
      </LiveKitRoom>
    </div>
  );
}

function WidgetInner({ displayName, onLeave }: { displayName: string; onLeave: () => void }) {
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const participants = useParticipants();

  function toggleMic() {
    void localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
  }

  return (
    <div className="p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-card-foreground">{displayName}</span>
        <button
          type="button"
          onClick={onLeave}
          title="Leave voice room"
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/20 hover:text-destructive"
        >
          <PhoneOff className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-3 max-h-40 overflow-y-auto space-y-1">
        {participants.map((p) => (
          <div key={p.identity} className="flex items-center gap-2 rounded px-2 py-1">
            <span
              className={`h-2 w-2 rounded-full flex-shrink-0 ${
                p.isSpeaking ? "bg-green-500" : "bg-muted"
              }`}
            />
            <span className="flex-1 truncate text-xs text-card-foreground">
              {p.name ?? p.identity}
            </span>
            {!p.isMicrophoneEnabled && (
              <MicOff className="h-3 w-3 flex-shrink-0 text-destructive" />
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={toggleMic}
        title={isMicrophoneEnabled ? "Mute mic" : "Unmute mic"}
        className={`flex w-full items-center justify-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
          isMicrophoneEnabled
            ? "bg-primary text-primary-foreground hover:bg-primary/90"
            : "bg-muted text-muted-foreground hover:bg-muted/80"
        }`}
      >
        {isMicrophoneEnabled ? (
          <>
            <Mic className="h-3.5 w-3.5" />
            Mute
          </>
        ) : (
          <>
            <MicOff className="h-3.5 w-3.5" />
            Unmute
          </>
        )}
      </button>
    </div>
  );
}
