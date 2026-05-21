import { useEffect, useRef } from "react";
import { usePreferencesStore } from "@/store/preferences";

interface AutoStatusResponse {
  presence: "Busy" | "Available" | "Away" | "DoNotDisturb" | null;
  message: string | null;
  source: "meeting" | "focus" | "ooo" | "none";
  expiresAt: string | null;
}

const POLL_INTERVAL_MS = 60_000;

export function useAutoStatus() {
  const autoStatusEnabled = usePreferencesStore((s) => s.autoStatusEnabled);
  const autoStatusLastSetSignature = usePreferencesStore((s) => s.autoStatusLastSetSignature);
  const manualStatusOverrideUntil = usePreferencesStore((s) => s.manualStatusOverrideUntil);
  const setAutoStatusSignature = usePreferencesStore((s) => s.setAutoStatusSignature);

  const sigRef = useRef(autoStatusLastSetSignature);
  const overrideRef = useRef(manualStatusOverrideUntil);

  useEffect(() => {
    sigRef.current = autoStatusLastSetSignature;
  }, [autoStatusLastSetSignature]);

  useEffect(() => {
    overrideRef.current = manualStatusOverrideUntil;
  }, [manualStatusOverrideUntil]);

  useEffect(() => {
    if (!autoStatusEnabled) return;

    async function tick() {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;

      const override = overrideRef.current;
      if (override !== null && Date.now() < override) return;

      try {
        const res = await fetch("/api/calendar/auto-status");
        if (!res.ok) return;

        const data: AutoStatusResponse = await res.json();
        const signature = `${data.source}|${data.presence ?? ""}|${data.expiresAt ?? ""}`;

        if (signature === sigRef.current) return;

        if (data.source === "none") {
          const prevSig = sigRef.current;
          if (prevSig !== null && prevSig !== "none||") {
            await Promise.allSettled([
              fetch("/api/presence/setStatusMessage", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ clear: true }),
              }),
              fetch("/api/presence/setUserPreferredPresence", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ clear: true }),
              }),
            ]);
          }
          setAutoStatusSignature("none||");
          sigRef.current = "none||";
          return;
        }

        const presenceMap: Record<string, { availability: string; activity: string }> = {
          Busy: { availability: "Busy", activity: "Busy" },
          Away: { availability: "Away", activity: "Away" },
          DoNotDisturb: { availability: "DoNotDisturb", activity: "DoNotDisturb" },
          Available: { availability: "Available", activity: "Available" },
        };

        const presenceBody = data.presence ? presenceMap[data.presence] : null;

        const displayMessage = data.message && data.expiresAt
          ? `${data.message} until ${new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(data.expiresAt))}`
          : data.message;

        await Promise.allSettled([
          displayMessage
            ? fetch("/api/presence/setStatusMessage", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  message: displayMessage,
                  expiryISO: data.expiresAt ?? undefined,
                }),
              })
            : Promise.resolve(),
          presenceBody
            ? fetch("/api/presence/setUserPreferredPresence", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(presenceBody),
              })
            : Promise.resolve(),
        ]);

        setAutoStatusSignature(signature);
        sigRef.current = signature;
      } catch (err) {
        console.error("[auto-status] poll error:", err);
      }
    }

    tick();
    const id = setInterval(tick, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [autoStatusEnabled, setAutoStatusSignature]);
}
