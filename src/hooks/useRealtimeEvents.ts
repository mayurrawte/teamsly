"use client";

import { useEffect } from "react";
import type { RealtimeEvent } from "@/lib/realtime/pubsub";

type Handler = (event: RealtimeEvent) => void;

// Module-level set so all hook instances share one EventSource connection
// created by RealtimeEventsMount. Handlers are registered/deregistered per
// component lifecycle without tearing down the underlying SSE stream.
const handlers = new Set<Handler>();

export function useRealtimeEvents(handler: Handler) {
  useEffect(() => {
    handlers.add(handler);
    return () => { handlers.delete(handler); };
  }, [handler]);
}

export function RealtimeEventsMount() {
  useEffect(() => {
    const es = new EventSource("/api/realtime/sse");
    es.onmessage = (e) => {
      let event: RealtimeEvent;
      try {
        event = JSON.parse(e.data as string) as RealtimeEvent;
      } catch {
        return;
      }
      for (const h of handlers) h(event);
    };
    return () => { es.close(); };
  }, []);
  return null;
}
