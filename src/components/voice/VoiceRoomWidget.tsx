"use client";

import "@livekit/components-styles";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useConnectionState,
  useLocalParticipant,
  useParticipants,
} from "@livekit/components-react";
import { ConnectionState } from "livekit-client";
import { useCallback, useState } from "react";
import { AlertTriangle, Loader2, Mic, MicOff, PhoneOff, RotateCw } from "lucide-react";
import { useVoiceRoom } from "./VoiceRoomProvider";
import { useToastStore } from "@/store/toasts";

/**
 * Floating audio-call widget. The previous version hid every failure mode —
 * if LiveKit could not connect we just unmounted, so the user saw nothing.
 *
 * Now the shell renders as long as we have a token; the inner shows
 * Connecting / Live / Reconnecting / Failed states so problems are visible,
 * and "Failed" gives the user a retry button instead of forcing them back
 * through the trigger.
 */
export function VoiceRoomWidget() {
  const { active, token, url, leave, rejoin } = useVoiceRoom();
  const [fatalError, setFatalError] = useState<string | null>(null);

  if (!active || !token || !url) return null;

  return (
    <div className="pointer-events-auto fixed bottom-4 right-4 z-50 w-80 rounded-lg border border-[var(--border)] bg-[var(--modal-bg)] shadow-[0_8px_32px_rgba(0,0,0,0.45)]">
      {fatalError ? (
        <FailedState
          message={fatalError}
          onRetry={() => {
            setFatalError(null);
            void rejoin();
          }}
          onLeave={leave}
        />
      ) : (
        <LiveKitRoom
          token={token}
          serverUrl={url}
          connect={true}
          audio={false}
          video={false}
          onDisconnected={leave}
          onError={(err) => setFatalError(err.message)}
        >
          <RoomAudioRenderer />
          <WidgetInner displayName={active.displayName} onLeave={leave} />
        </LiveKitRoom>
      )}
    </div>
  );
}

function WidgetInner({ displayName, onLeave }: { displayName: string; onLeave: () => void }) {
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const participants = useParticipants();
  const state = useConnectionState();
  const showToast = useToastStore((s) => s.showToast);

  const toggleMic = useCallback(async () => {
    try {
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
    } catch (err) {
      const msg =
        err instanceof Error && /permission|denied/i.test(err.message)
          ? "Microphone access denied — check your browser permissions"
          : "Could not toggle microphone";
      showToast({ title: msg, tone: "error" });
    }
  }, [isMicrophoneEnabled, localParticipant, showToast]);

  const isConnecting = state === ConnectionState.Connecting;
  const isReconnecting = state === ConnectionState.Reconnecting;
  const isConnected = state === ConnectionState.Connected;

  return (
    <div className="p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`h-2 w-2 flex-shrink-0 rounded-full ${
              isConnected ? "bg-[var(--status-online)]" : isReconnecting ? "bg-[var(--status-away)]" : "bg-[var(--text-muted)]"
            }`}
            aria-hidden
          />
          <span className="truncate text-sm font-semibold text-[var(--text-primary)]" title={displayName}>
            {displayName}
          </span>
        </div>
        <button
          type="button"
          onClick={onLeave}
          title="Leave voice room"
          aria-label="Leave voice room"
          className="rounded p-1 text-[var(--text-secondary)] transition-colors hover:bg-[var(--status-busy)]/20 hover:text-[var(--status-busy)] focus-ring"
        >
          <PhoneOff className="h-4 w-4" />
        </button>
      </div>

      {(isConnecting || isReconnecting) && (
        <div className="mb-2 flex items-center gap-1.5 rounded bg-[var(--surface-raised)] px-2 py-1 text-[11px] text-[var(--text-secondary)]">
          <Loader2 className="h-3 w-3 animate-spin" />
          {isReconnecting ? "Reconnecting to room…" : "Connecting…"}
        </div>
      )}

      <div className="mb-3 max-h-40 space-y-1 overflow-y-auto">
        {participants.length === 0 ? (
          <p className="px-2 py-1 text-[11px] text-[var(--text-muted)]">No one else here yet</p>
        ) : (
          participants.map((p) => (
            <div key={p.identity} className="flex items-center gap-2 rounded px-2 py-1">
              <span
                className={`h-2 w-2 flex-shrink-0 rounded-full ${
                  p.isSpeaking ? "bg-[var(--status-online)]" : "bg-[var(--text-muted)]"
                }`}
              />
              <span className="flex-1 truncate text-xs text-[var(--text-primary)]">
                {p.name ?? p.identity}
              </span>
              {!p.isMicrophoneEnabled && (
                <MicOff className="h-3 w-3 flex-shrink-0 text-[var(--status-busy)]" />
              )}
            </div>
          ))
        )}
      </div>

      <button
        type="button"
        onClick={() => void toggleMic()}
        disabled={!isConnected}
        title={isMicrophoneEnabled ? "Mute mic" : "Unmute mic"}
        className={`flex w-full items-center justify-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors focus-ring disabled:cursor-not-allowed disabled:opacity-60 ${
          isMicrophoneEnabled
            ? "bg-[var(--accent)] text-[var(--text-white)] hover:bg-[var(--accent-hover)]"
            : "bg-[var(--surface-raised)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
        }`}
      >
        {isMicrophoneEnabled ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />}
        {isMicrophoneEnabled ? "Mute" : "Unmute"}
      </button>
    </div>
  );
}

function FailedState({
  message,
  onRetry,
  onLeave,
}: {
  message: string;
  onRetry: () => void;
  onLeave: () => void;
}) {
  return (
    <div className="p-3">
      <div className="mb-2 flex items-center gap-2 text-[var(--status-busy)]">
        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
        <span className="text-sm font-semibold">Voice connection failed</span>
      </div>
      <p className="mb-3 truncate text-[11px] text-[var(--text-muted)]" title={message}>
        {message}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onRetry}
          className="flex flex-1 items-center justify-center gap-1.5 rounded bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-[var(--text-white)] transition-colors hover:bg-[var(--accent-hover)] focus-ring"
        >
          <RotateCw className="h-3.5 w-3.5" />
          Retry
        </button>
        <button
          type="button"
          onClick={onLeave}
          className="flex flex-1 items-center justify-center gap-1.5 rounded bg-[var(--surface-raised)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] focus-ring"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
