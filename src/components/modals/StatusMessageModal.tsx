"use client";

import { useState, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import TextareaAutosize from "react-textarea-autosize";
import { X } from "lucide-react";
import { useWorkspaceStore } from "@/store/workspace";
import { useToastStore } from "@/store/toasts";

const MAX_CHARS = 280;

type ExpiryPreset = "never" | "30m" | "1h" | "4h" | "today" | "week" | "custom";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function computeExpiryISO(preset: ExpiryPreset, custom: string): string | undefined {
  const now = new Date();

  if (preset === "never" || preset === "custom") {
    if (preset === "custom" && custom) return new Date(custom).toISOString();
    return undefined;
  }

  if (preset === "30m") {
    return new Date(now.getTime() + 30 * 60_000).toISOString();
  }
  if (preset === "1h") {
    return new Date(now.getTime() + 60 * 60_000).toISOString();
  }
  if (preset === "4h") {
    return new Date(now.getTime() + 4 * 60 * 60_000).toISOString();
  }
  if (preset === "today") {
    const end = new Date(now);
    end.setHours(23, 59, 59, 0);
    return end.toISOString();
  }
  if (preset === "week") {
    // Next Sunday at 17:00
    const end = new Date(now);
    const daysUntilSunday = (7 - end.getDay()) % 7 || 7;
    end.setDate(end.getDate() + daysUntilSunday);
    end.setHours(17, 0, 0, 0);
    return end.toISOString();
  }
}

export function StatusMessageModal({ open, onOpenChange }: Props) {
  const currentUserId = useWorkspaceStore((s) => s.currentUserId);
  const existingStatusMessage = useWorkspaceStore(
    (s) => s.statusMessageMap[s.currentUserId]
  );
  const setStatusMessage = useWorkspaceStore((s) => s.setStatusMessage);
  const showToast = useToastStore((s) => s.showToast);

  const existingContent = existingStatusMessage?.message?.content ?? "";
  const hasExisting = existingContent.length > 0;

  const [text, setText] = useState(existingContent);
  const [preset, setPreset] = useState<ExpiryPreset>("never");
  const [custom, setCustom] = useState("");
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);

  // Re-initialise form when modal opens
  useEffect(() => {
    if (open) {
      setText(existingContent);
      setPreset("never");
      setCustom("");
    }
  }, [open, existingContent]);

  async function handleSave() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setSaving(true);

    const expiryISO = computeExpiryISO(preset, custom);

    try {
      const res = await fetch("/api/presence/setStatusMessage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, expiryISO }),
      });

      if (!res.ok) {
        showToast({ title: "Could not set status", tone: "error" });
        return;
      }

      // Optimistic update
      setStatusMessage(currentUserId, {
        message: { content: trimmed, contentType: "text" },
        expiryDateTime: expiryISO
          ? { dateTime: expiryISO.replace(/Z$/, ""), timeZone: "UTC" }
          : undefined,
      });

      showToast({ title: "Status set" });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleClear() {
    setClearing(true);
    try {
      const res = await fetch("/api/presence/setStatusMessage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clear: true }),
      });

      if (!res.ok) {
        showToast({ title: "Could not clear status", tone: "error" });
        return;
      }

      setStatusMessage(currentUserId, null);
      showToast({ title: "Status cleared" });
      onOpenChange(false);
    } finally {
      setClearing(false);
    }
  }

  const remaining = MAX_CHARS - text.length;
  const overLimit = remaining < 0;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-[70] w-[460px] max-w-[94vw] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--modal-bg)] text-[var(--text-primary)] shadow-[0_16px_64px_rgba(0,0,0,0.6)] focus:outline-none"
          aria-describedby={undefined}
        >
          <Dialog.Title className="sr-only">Set a status message</Dialog.Title>

          <header className="flex h-[49px] items-center justify-between border-b border-[var(--border)] px-5">
            <h2 className="text-[15px] font-bold text-white">Set a status message</h2>
            <Dialog.Close
              aria-label="Close"
              className="flex h-7 w-7 items-center justify-center rounded text-[var(--text-secondary)] hover:bg-[var(--surface-raised)] hover:text-white focus-ring"
            >
              <X size={16} />
            </Dialog.Close>
          </header>

          <div className="flex flex-col gap-4 px-5 py-5">
            {/* Textarea */}
            <div className="relative">
              <TextareaAutosize
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="What's your status?"
                minRows={3}
                maxRows={6}
                className="w-full resize-none rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none transition-colors duration-150 placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]"
              />
              <span
                className={`absolute bottom-2 right-3 text-[11px] tabular-nums ${
                  overLimit ? "text-[#cd2553]" : "text-[var(--text-muted)]"
                }`}
              >
                {remaining}
              </span>
            </div>

            {/* Clear after select */}
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-semibold text-[var(--text-secondary)]">
                Clear after
              </label>
              <select
                value={preset}
                onChange={(e) => setPreset(e.target.value as ExpiryPreset)}
                className="h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
              >
                <option value="never">Never</option>
                <option value="30m">30 minutes</option>
                <option value="1h">1 hour</option>
                <option value="4h">4 hours</option>
                <option value="today">Today (end of day)</option>
                <option value="week">This week (Sunday 5 pm)</option>
                <option value="custom">Custom...</option>
              </select>
            </div>

            {/* Custom datetime picker */}
            {preset === "custom" && (
              <div className="flex flex-col gap-1">
                <label className="text-[12px] font-semibold text-[var(--text-secondary)]">
                  Expiry date and time
                </label>
                <input
                  type="datetime-local"
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  className="h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                />
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                disabled={!hasExisting || clearing}
                onClick={handleClear}
                className="rounded-md border border-[var(--border)] px-3 py-[6px] text-[13px] font-semibold text-[var(--text-secondary)] transition-colors hover:border-[#cd2553] hover:text-[#cd2553] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {clearing ? "Clearing..." : "Clear status"}
              </button>

              <button
                type="button"
                disabled={text.trim().length === 0 || overLimit || saving}
                onClick={handleSave}
                className="rounded-md bg-[var(--accent)] px-4 py-[6px] text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
