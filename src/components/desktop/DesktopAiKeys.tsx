"use client";

import { useEffect, useState } from "react";

// Mirrors electron/secrets.ts BYO_KEYS. Each field is write-only from the UI;
// we only learn whether a key is set, never its value.
const FIELDS: { key: string; label: string; placeholder: string }[] = [
  { key: "OPENAI_API_KEY", label: "OpenAI / Azure key", placeholder: "sk-… or Azure key" },
  { key: "OPENAI_BASE_URL", label: "OpenAI base URL (optional)", placeholder: "https://….openai.azure.com/openai/v1/" },
  { key: "LIVEKIT_API_KEY", label: "LiveKit API key", placeholder: "API…" },
  { key: "LIVEKIT_API_SECRET", label: "LiveKit API secret", placeholder: "secret…" },
  { key: "NEXT_PUBLIC_LIVEKIT_URL", label: "LiveKit URL", placeholder: "wss://….livekit.cloud" },
];

type DesktopApi = {
  getByoStatus: () => Promise<Record<string, boolean>>;
  setByoKeys: (partial: Record<string, string>) => Promise<Record<string, boolean>>;
};

function desktopApi(): DesktopApi | null {
  const w = window as unknown as { electron?: Partial<DesktopApi> & { isDesktop?: () => boolean } };
  if (!w.electron?.isDesktop?.() || !w.electron.getByoStatus || !w.electron.setByoKeys) return null;
  return w.electron as DesktopApi;
}

export function DesktopAiKeys() {
  const [api, setApi] = useState<DesktopApi | null>(null);
  const [status, setStatus] = useState<Record<string, boolean>>({});
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const a = desktopApi();
    setApi(a);
    if (a) void a.getByoStatus().then(setStatus);
  }, []);

  if (!api) return null; // web build / non-desktop: render nothing

  async function save() {
    const next = await api!.setByoKeys(draft);
    setStatus(next);
    setDraft({});
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">AI &amp; voice keys</h3>
        <p className="text-[12px] text-[var(--text-muted)]">
          Stored encrypted on this device and used only by the local app. Changes apply on next launch.
        </p>
      </div>
      {FIELDS.map((f) => (
        <label key={f.key} className="flex flex-col gap-1 text-[12px] text-[var(--text-secondary)]">
          <span>
            {f.label} {status[f.key] ? <span className="text-[var(--accent)]">• set</span> : null}
          </span>
          <input
            type="password"
            autoComplete="off"
            placeholder={status[f.key] ? "•••••••• (leave blank to keep)" : f.placeholder}
            value={draft[f.key] ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
            className="rounded border border-[var(--border)] bg-[var(--message-bg)] px-2 py-1.5 text-[13px] text-[var(--text-primary)]"
          />
        </label>
      ))}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void save()}
          className="rounded bg-[var(--accent)] px-3 py-1.5 text-[12px] font-medium text-white"
        >
          Save keys
        </button>
        {saved && <span className="text-[12px] text-[var(--text-muted)]">Saved — relaunch to apply</span>}
      </div>
    </section>
  );
}
