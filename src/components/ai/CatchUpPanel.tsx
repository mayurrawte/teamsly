"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { useCatchUpStore } from "@/store/catchUp";
import { CatchUpContent } from "./CatchUpContent";

export function CatchUpPanel() {
  const { open, setOpen } = useCatchUpStore();
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  function navigateAndClose(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <>
      {open && <div className="fixed inset-0 z-40" aria-hidden="true" onClick={() => setOpen(false)} />}

      <aside
        className={[
          "fixed bottom-0 right-0 top-0 z-50 flex w-full flex-col border-l border-[var(--border)] bg-[var(--content-bg)] shadow-[-4px_0_24px_rgba(0,0,0,0.3)] sm:w-[440px]",
          "transition-transform duration-[var(--motion-slow)] ease-[cubic-bezier(0.34,1.2,0.64,1)]",
          open ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
        aria-label="Catch-up panel"
        aria-hidden={!open}
      >
        <header className="flex h-[50px] flex-shrink-0 items-center justify-between border-b border-[var(--border)] px-4">
          <h2 className="text-[16px] font-bold text-[var(--text-primary)]">Catch up</h2>
          <button
            type="button"
            aria-label="Close panel"
            onClick={() => setOpen(false)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <CatchUpContent onNavigate={navigateAndClose} className="min-h-0 flex-1" />
      </aside>
    </>
  );
}
