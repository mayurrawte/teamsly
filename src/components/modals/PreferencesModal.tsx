"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  X,
  Sun,
  Moon,
  Laptop,
  User,
  Bell,
  Palette,
  MessageSquare,
  Globe,
  Accessibility,
  Settings2,
  ChevronRight,
} from "lucide-react";
import {
  usePreferencesStore,
  ACCENT_THEMES,
  type ColorMode,
  type AccentTheme,
} from "@/store/preferences";

// ─── Nav sections ────────────────────────────────────────────────────────────

type NavSection =
  | "availability"
  | "notifications"
  | "appearance"
  | "messages"
  | "language"
  | "accessibility"
  | "advanced";

interface NavItem {
  key: NavSection;
  label: string;
  icon: React.ElementType;
}

const NAV_ITEMS: NavItem[] = [
  { key: "availability",   label: "Availability",          icon: User },
  { key: "notifications",  label: "Notifications",         icon: Bell },
  { key: "appearance",     label: "Appearance",            icon: Palette },
  { key: "messages",       label: "Messages & media",      icon: MessageSquare },
  { key: "language",       label: "Language & region",     icon: Globe },
  { key: "accessibility",  label: "Accessibility",         icon: Accessibility },
  { key: "advanced",       label: "Advanced",              icon: Settings2 },
];

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ─── Root ────────────────────────────────────────────────────────────────────

export function PreferencesModal({ open, onOpenChange }: Props) {
  const [section, setSection] = useState<NavSection>("appearance");

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-[70] flex h-[580px] w-[780px] max-w-[94vw] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-[#3f4144] bg-[#1a1d21] text-[#d1d2d3] shadow-[0_16px_64px_rgba(0,0,0,0.6)] focus:outline-none"
          aria-describedby={undefined}
        >
          <Dialog.Title className="sr-only">Preferences</Dialog.Title>

          {/* Left nav */}
          <nav className="flex w-[220px] flex-shrink-0 flex-col gap-[2px] border-r border-[#3f4144] bg-[#19171d] p-3">
            <p className="px-2 pb-2 pt-1 text-[11px] font-bold uppercase tracking-wider text-[#6c6f75]">
              Preferences
            </p>
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = section === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setSection(item.key)}
                  className={`flex items-center justify-between gap-2 rounded-md px-2 py-[7px] text-left text-[13px] transition-colors duration-100 ${
                    active
                      ? "bg-[var(--accent)] text-white"
                      : "text-[#ababad] hover:bg-[#27242c] hover:text-white"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Icon size={14} />
                    {item.label}
                  </span>
                  {active && <ChevronRight size={12} className="opacity-60" />}
                </button>
              );
            })}
          </nav>

          {/* Right pane */}
          <section className="flex flex-1 flex-col overflow-hidden">
            <header className="flex h-[49px] flex-shrink-0 items-center justify-between border-b border-[#3f4144] px-5">
              <h2 className="text-[15px] font-black text-white">
                {NAV_ITEMS.find((i) => i.key === section)?.label ?? "Preferences"}
              </h2>
              <Dialog.Close
                aria-label="Close"
                className="flex h-7 w-7 items-center justify-center rounded text-[#ababad] hover:bg-[#27292d] hover:text-white"
              >
                <X size={16} />
              </Dialog.Close>
            </header>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {section === "appearance" ? (
                <AppearancePanel />
              ) : (
                <ComingSoonPanel />
              )}
            </div>
          </section>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ─── Appearance panel ────────────────────────────────────────────────────────

function AppearancePanel() {
  const colorMode = usePreferencesStore((s) => s.colorMode);
  const accent = usePreferencesStore((s) => s.accent);
  const darkInFocusMode = usePreferencesStore((s) => s.darkInFocusMode);
  const setColorMode = usePreferencesStore((s) => s.setColorMode);
  const setAccent = usePreferencesStore((s) => s.setAccent);
  const setDarkInFocusMode = usePreferencesStore((s) => s.setDarkInFocusMode);

  return (
    <div className="flex flex-col gap-7">
      {/* Font */}
      <FieldGroup
        label="Font"
        hint="Interface typeface. More options coming soon."
      >
        <div className="flex h-9 w-64 items-center justify-between rounded-md border border-[#3f4144] bg-[#222529] px-3 text-[13px] text-[#d1d2d3] opacity-70 cursor-not-allowed select-none">
          <span>Plex Sans (Default)</span>
          <ChevronRight size={13} className="text-[#6c6f75] rotate-90" />
        </div>
      </FieldGroup>

      {/* Color mode */}
      <FieldGroup label="Color mode" hint="Choose how Teamsly looks.">
        <div className="flex gap-3">
          <ModeButton
            mode="light"
            current={colorMode}
            icon={Sun}
            label="Light"
            onSelect={setColorMode}
          />
          <ModeButton
            mode="dark"
            current={colorMode}
            icon={Moon}
            label="Dark"
            onSelect={setColorMode}
          />
          <ModeButton
            mode="system"
            current={colorMode}
            icon={Laptop}
            label="System"
            onSelect={setColorMode}
          />
        </div>
      </FieldGroup>

      {/* Accent palette */}
      <FieldGroup
        label="Accent color"
        hint="Highlights, active states, and interactive elements."
      >
        <div className="flex flex-wrap gap-3">
          {(Object.entries(ACCENT_THEMES) as [AccentTheme, { label: string; hex: string }][]).map(
            ([key, { label, hex }]) => (
              <button
                key={key}
                type="button"
                title={label}
                aria-label={label}
                aria-pressed={accent === key}
                onClick={() => setAccent(key)}
                className="group flex flex-col items-center gap-[6px]"
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full transition-all duration-150 ${
                    accent === key
                      ? "ring-2 ring-white ring-offset-2 ring-offset-[#1a1d21]"
                      : "hover:ring-2 hover:ring-white/40 hover:ring-offset-2 hover:ring-offset-[#1a1d21]"
                  }`}
                  style={{ backgroundColor: hex }}
                />
                <span
                  className={`text-[11px] transition-colors duration-100 ${
                    accent === key ? "text-white" : "text-[#6c6f75] group-hover:text-[#ababad]"
                  }`}
                >
                  {label}
                </span>
              </button>
            )
          )}
        </div>
      </FieldGroup>

      {/* Dark in focus mode */}
      <label className="flex cursor-pointer items-start gap-3">
        <span className="relative mt-[2px] flex-shrink-0">
          <input
            type="checkbox"
            className="sr-only"
            checked={darkInFocusMode}
            onChange={(e) => setDarkInFocusMode(e.target.checked)}
          />
          <span
            className={`flex h-4 w-4 items-center justify-center rounded border transition-colors duration-150 ${
              darkInFocusMode
                ? "border-[var(--accent)] bg-[var(--accent)]"
                : "border-[#565856] bg-[#222529]"
            }`}
          >
            {darkInFocusMode && (
              <svg
                viewBox="0 0 10 8"
                fill="none"
                className="h-[9px] w-[9px]"
                aria-hidden="true"
              >
                <path
                  d="M1 4l2.5 2.5L9 1"
                  stroke="white"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </span>
        </span>
        <span className="min-w-0">
          <span className="block text-[13px] font-bold text-white">
            Always use dark mode in focus mode
          </span>
          <span className="mt-[2px] block text-[12px] text-[#6c6f75]">
            When focus mode is on, override color mode and use dark. (Visual only — focus mode not yet implemented.)
          </span>
        </span>
      </label>
    </div>
  );
}

// ─── Coming soon panel ───────────────────────────────────────────────────────

function ComingSoonPanel() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
      <p className="text-[28px]">🚧</p>
      <p className="text-[15px] font-bold text-white">Coming soon</p>
      <p className="max-w-[280px] text-[13px] text-[#6c6f75]">
        This section is under construction. Check back in a future release.
      </p>
    </div>
  );
}

// ─── Shared primitives ────────────────────────────────────────────────────────

function FieldGroup({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div>
        <p className="text-[13px] font-bold text-white">{label}</p>
        {hint && <p className="text-[12px] text-[#6c6f75]">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function ModeButton({
  mode,
  current,
  icon: Icon,
  label,
  onSelect,
}: {
  mode: ColorMode;
  current: ColorMode;
  icon: React.ElementType;
  label: string;
  onSelect: (m: ColorMode) => void;
}) {
  const active = mode === current;
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => onSelect(mode)}
      className={`flex w-[90px] flex-col items-center gap-2 rounded-lg border py-3 text-[12px] font-semibold transition-colors duration-150 ${
        active
          ? "border-[var(--accent)] bg-[rgba(var(--accent-rgb,15,90,143),0.15)] text-white"
          : "border-[#3f4144] bg-[#222529] text-[#ababad] hover:border-[#565856] hover:text-white"
      }`}
    >
      <Icon
        size={18}
        className={active ? "text-[var(--accent)]" : "text-[#6c6f75]"}
      />
      {label}
    </button>
  );
}
