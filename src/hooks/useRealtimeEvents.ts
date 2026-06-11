"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { RealtimeEvent } from "@/lib/realtime/pubsub";

type Handler = (event: RealtimeEvent) => void;

const handlers = new Set<Handler>();

// ---- Health (so views can slow their reconcile poll when push is live) ------
let connected = false;
const healthListeners = new Set<() => void>();

function emitHealth() {
  for (const l of healthListeners) l();
}
function setConnected(v: boolean) {
  if (connected !== v) { connected = v; emitHealth(); }
}

// "Healthy" = SSE connection is open. Push delivery is best-effort; the
// reconcile poll is the backstop, so open-connection is a sufficient signal
// to slow the poll.
function isHealthy(): boolean {
  return connected;
}

export function useRealtimeHealth(): boolean {
  return useSyncExternalStore(
    (cb) => { healthListeners.add(cb); return () => healthListeners.delete(cb); },
    isHealthy,
    () => false, // SSR: assume unhealthy → views use the fast poll until hydrated
  );
}

export function useRealtimeEvents(handler: Handler) {
  useEffect(() => {
    handlers.add(handler);
    return () => { handlers.delete(handler); };
  }, [handler]);
}

export function RealtimeEventsMount() {
  useEffect(() => {
    const es = new EventSource("/api/realtime/sse");
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false); // EventSource auto-reconnects; onopen flips back
    es.onmessage = (e) => {
      let event: RealtimeEvent;
      try {
        event = JSON.parse(e.data as string) as RealtimeEvent;
      } catch {
        return;
      }
      for (const h of handlers) h(event);
    };
    return () => { es.close(); setConnected(false); };
  }, []);
  return null;
}
