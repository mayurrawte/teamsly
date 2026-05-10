"use client";

import { X } from "lucide-react";
import { useToastStore } from "@/store/toasts";

export function ToastViewport() {
  const toasts = useToastStore((state) => state.toasts);
  const dismissToast = useToastStore((state) => state.dismissToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[200] flex w-[340px] max-w-[calc(100vw-32px)] flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="rounded-md border border-[#3f4144] bg-[#1a1d21] p-3 text-[#d1d2d3] shadow-[0_8px_32px_rgba(0,0,0,0.45)]"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p
                className={
                  toast.tone === "error"
                    ? "text-[13px] font-bold text-[#e01e5a]"
                    : "text-[13px] font-bold text-white"
                }
              >
                {toast.title}
              </p>
              {toast.description && (
                <p className="mt-1 text-[12px] text-[#ababad]">{toast.description}</p>
              )}
            </div>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => dismissToast(toast.id)}
              className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-[#ababad] hover:bg-[#27292d] hover:text-white"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
