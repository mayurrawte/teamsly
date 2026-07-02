"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useToastStore } from "@/store/toasts";

const EXIT_DURATION = 150;

export function ToastViewport() {
  const toasts = useToastStore((state) => state.toasts);
  const dismissToast = useToastStore((state) => state.dismissToast);
  const [exiting, setExiting] = useState<Set<string>>(new Set());

  if (toasts.length === 0) return null;

  function handleDismiss(id: string) {
    setExiting((prev) => new Set([...prev, id]));
    setTimeout(() => {
      dismissToast(id);
      setExiting((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, EXIT_DURATION);
  }

  return (
    <div className="fixed bottom-4 right-4 z-[200] flex w-[340px] max-w-[calc(100vw-32px)] flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`rounded-md border border-[var(--border)] bg-[var(--modal-bg)] p-3 text-[var(--text-primary)] shadow-[0_8px_32px_rgba(0,0,0,0.45)] ${exiting.has(toast.id) ? "toast-exit" : "toast-enter"}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p
                className={
                  toast.tone === "error"
                    ? "text-[13px] font-bold text-[var(--status-busy)]"
                    : "text-[13px] font-bold text-[var(--text-primary)]"
                }
              >
                {toast.title}
              </p>
              {toast.description && (
                <p className="mt-1 text-[12px] text-[var(--text-secondary)]">{toast.description}</p>
              )}
              {toast.action && (
                <button
                  type="button"
                  onClick={() => {
                    toast.action?.onClick();
                    handleDismiss(toast.id);
                  }}
                  className="mt-2 rounded-md bg-[var(--accent)] px-2.5 py-1 text-[12px] font-medium text-white transition-colors hover:opacity-90 focus-ring"
                >
                  {toast.action.label}
                </button>
              )}
            </div>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => handleDismiss(toast.id)}
              className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
