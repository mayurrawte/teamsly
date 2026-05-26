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
  Palette as PaletteIcon,
  MessageSquare,
  Keyboard,
  Accessibility,
  Settings2,
  ChevronRight,
  Volume2,
  Plus,
  Trash2,
  Sparkles,
} from "lucide-react";
import {
  usePreferencesStore,
  ACCENT_THEMES,
  FONT_OPTIONS,
  FONT_SCALES,
  PALETTES,
  DENSITY_LABELS,
  isValidHex,
  type ColorMode,
  type AccentTheme,
  type FontFamily,
  type FontScale,
  type SoundTheme,
  type Palette,
  type Density,
} from "@/store/preferences";
import { playNotificationTone } from "@/lib/utils/sound";

// ─── Nav sections ────────────────────────────────────────────────────────────

type NavSection =
  | "availability"
  | "notifications"
  | "appearance"
  | "messages"
  | "shortcuts"
  | "accessibility"
  | "advanced";

interface NavItem {
  key: NavSection;
  label: string;
  icon: React.ElementType;
}

const NAV_ITEMS: NavItem[] = [
  { key: "availability",   label: "Availability",     icon: User },
  { key: "notifications",  label: "Notifications",    icon: Bell },
  { key: "appearance",     label: "Appearance",       icon: PaletteIcon },
  { key: "messages",       label: "Messages & media", icon: MessageSquare },
  { key: "shortcuts",      label: "Keyboard",         icon: Keyboard },
  { key: "accessibility",  label: "Accessibility",    icon: Accessibility },
  { key: "advanced",       label: "Advanced",         icon: Settings2 },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PreferencesModal({ open, onOpenChange }: Props) {
  const [section, setSection] = useState<NavSection>("appearance");

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-[var(--modal-overlay)] backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-[70] flex h-[620px] w-[820px] max-w-[94vw] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--modal-bg)] text-[var(--text-primary)] shadow-[0_16px_64px_rgba(0,0,0,0.6)] focus:outline-none"
          aria-describedby={undefined}
        >
          <Dialog.Title className="sr-only">Preferences</Dialog.Title>

          {/* Left nav */}
          <nav className="flex w-[220px] flex-shrink-0 flex-col gap-[2px] border-r border-[var(--border)] bg-[var(--sidebar-bg)] p-3">
            <p className="px-2 pb-2 pt-1 text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
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
                  className={`flex items-center justify-between gap-2 rounded-md px-2 py-[6px] text-left text-[13px] transition-colors duration-100 focus-ring ${
                    active
                      ? "bg-[var(--accent)] text-[var(--text-white)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--text-primary)]"
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
            <header className="flex h-[49px] flex-shrink-0 items-center justify-between border-b border-[var(--border)] px-5">
              <h2 className="text-[15px] font-bold text-[var(--text-primary)]">
                {NAV_ITEMS.find((i) => i.key === section)?.label ?? "Preferences"}
              </h2>
              <Dialog.Close
                aria-label="Close"
                className="flex h-7 w-7 items-center justify-center rounded text-[var(--text-secondary)] hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)] focus-ring"
              >
                <X size={16} />
              </Dialog.Close>
            </header>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {section === "appearance" ? (
                <AppearancePanel />
              ) : section === "notifications" ? (
                <NotificationsPanel />
              ) : section === "messages" ? (
                <MessagesPanel />
              ) : section === "availability" ? (
                <AvailabilityPanel />
              ) : section === "shortcuts" ? (
                <ShortcutsPanel />
              ) : section === "accessibility" ? (
                <AccessibilityPanel />
              ) : (
                <AdvancedPanel />
              )}
            </div>
          </section>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ─── Appearance ──────────────────────────────────────────────────────────────

function AppearancePanel() {
  const colorMode = usePreferencesStore((s) => s.colorMode);
  const palette = usePreferencesStore((s) => s.palette);
  const density = usePreferencesStore((s) => s.density);
  const accent = usePreferencesStore((s) => s.accent);
  const customAccentHex = usePreferencesStore((s) => s.customAccentHex);
  const font = usePreferencesStore((s) => s.font);
  const fontScale = usePreferencesStore((s) => s.fontScale);
  const darkInFocusMode = usePreferencesStore((s) => s.darkInFocusMode);
  const setColorMode = usePreferencesStore((s) => s.setColorMode);
  const setPalette = usePreferencesStore((s) => s.setPalette);
  const setDensity = usePreferencesStore((s) => s.setDensity);
  const setAccent = usePreferencesStore((s) => s.setAccent);
  const setCustomAccentHex = usePreferencesStore((s) => s.setCustomAccentHex);
  const setFont = usePreferencesStore((s) => s.setFont);
  const setFontScale = usePreferencesStore((s) => s.setFontScale);
  const setDarkInFocusMode = usePreferencesStore((s) => s.setDarkInFocusMode);

  return (
    <div className="flex flex-col gap-7">
      <FieldGroup
        label="Theme"
        hint="Background palette. Mode-locked themes force light or dark — your color-mode preference applies to Slate and Forest."
      >
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {(Object.entries(PALETTES) as [Palette, (typeof PALETTES)[Palette]][]).map(
            ([key, info]) => {
              const active = palette === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPalette(key)}
                  aria-pressed={active}
                  title={info.description}
                  className={`group flex flex-col gap-2 rounded-md border p-2 text-left transition-colors focus-ring press-snap ${
                    active
                      ? "border-[var(--accent)] bg-[var(--accent-light)]"
                      : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-input)]"
                  }`}
                >
                  <div className="flex h-10 overflow-hidden rounded">
                    {info.swatch.map((c, i) => (
                      <span key={i} className="flex-1" style={{ backgroundColor: c }} aria-hidden />
                    ))}
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-[13px] font-semibold text-[var(--text-primary)]">{info.label}</p>
                    {info.lockedMode && (
                      <span className="rounded-sm bg-[var(--surface-raised)] px-1 text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                        {info.lockedMode}
                      </span>
                    )}
                  </div>
                </button>
              );
            }
          )}
        </div>
      </FieldGroup>

      <FieldGroup label="Density" hint="How tightly the app packs information.">
        <div className="flex flex-wrap gap-2">
          {(Object.entries(DENSITY_LABELS) as [Density, (typeof DENSITY_LABELS)[Density]][]).map(
            ([key, info]) => {
              const active = density === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setDensity(key)}
                  aria-pressed={active}
                  title={info.hint}
                  className={`flex flex-col items-start rounded-md border px-3 py-2 text-left transition-colors focus-ring press-snap ${
                    active
                      ? "border-[var(--accent)] bg-[var(--accent-light)]"
                      : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-input)]"
                  }`}
                >
                  <span className="text-[13px] font-semibold text-[var(--text-primary)]">{info.label}</span>
                  <span className="text-[11px] text-[var(--text-muted)]">{info.hint}</span>
                </button>
              );
            }
          )}
        </div>
      </FieldGroup>

      <FieldGroup label="Font" hint="Used everywhere in the app. Live preview updates as you switch.">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {(Object.entries(FONT_OPTIONS) as [FontFamily, (typeof FONT_OPTIONS)[FontFamily]][]).map(
            ([key, { label, cssVar, preview }]) => {
              const active = font === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFont(key)}
                  aria-pressed={active}
                  className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-left transition-colors focus-ring press-snap ${
                    active
                      ? "border-[var(--accent)] bg-[var(--accent-light)]"
                      : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-input)]"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-[var(--text-primary)]" style={{ fontFamily: cssVar }}>
                      {label}
                    </p>
                    <p className="truncate text-[12px] text-[var(--text-muted)]" style={{ fontFamily: cssVar }}>
                      {preview}
                    </p>
                  </div>
                  {active && (
                    <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-[var(--accent)]">
                      <svg viewBox="0 0 10 8" className="h-2 w-2" aria-hidden>
                        <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                      </svg>
                    </span>
                  )}
                </button>
              );
            }
          )}
        </div>
      </FieldGroup>

      <FieldGroup label="Reading size" hint="Scales text everywhere — sidebar, messages, composer.">
        <div className="flex gap-2">
          {(Object.entries(FONT_SCALES) as [FontScale, (typeof FONT_SCALES)[FontScale]][]).map(([key, { label }]) => {
            const active = fontScale === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setFontScale(key)}
                aria-pressed={active}
                className={`rounded-md border px-3 py-1.5 text-[13px] font-medium transition-colors focus-ring ${
                  active
                    ? "border-[var(--accent)] bg-[var(--accent-light)] text-[var(--text-primary)]"
                    : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:border-[var(--border-input)] hover:text-[var(--text-primary)]"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </FieldGroup>

      <FieldGroup label="Color mode" hint="Choose how Teamsly looks.">
        <div className="flex gap-3">
          <ModeButton mode="light" current={colorMode} icon={Sun} label="Light" onSelect={setColorMode} />
          <ModeButton mode="dark" current={colorMode} icon={Moon} label="Dark" onSelect={setColorMode} />
          <ModeButton mode="system" current={colorMode} icon={Laptop} label="System" onSelect={setColorMode} />
        </div>
      </FieldGroup>

      <FieldGroup
        label="Accent color"
        hint="Highlights, active states, and the @mention pop. Pick a preset or set your own."
      >
        <div className="flex flex-wrap gap-3">
          {(Object.entries(ACCENT_THEMES) as [Exclude<AccentTheme, "custom">, { label: string; hex: string }][]).map(
            ([key, { label, hex }]) => (
              <AccentSwatch
                key={key}
                accentKey={key}
                label={label}
                hex={hex}
                selected={accent === key}
                onClick={() => setAccent(key)}
              />
            )
          )}
          <AccentSwatch
            accentKey="custom"
            label="Custom"
            hex={isValidHex(customAccentHex) ? customAccentHex : "#6366F1"}
            selected={accent === "custom"}
            onClick={() => setAccent("custom")}
          />
        </div>
        {accent === "custom" && (
          <div className="mt-3 flex items-center gap-3">
            <input
              type="color"
              value={isValidHex(customAccentHex) ? customAccentHex : "#6366F1"}
              onChange={(e) => setCustomAccentHex(e.target.value)}
              className="h-8 w-12 cursor-pointer rounded border border-[var(--border)] bg-transparent"
              aria-label="Custom accent color"
            />
            <input
              type="text"
              value={customAccentHex}
              onChange={(e) => setCustomAccentHex(e.target.value)}
              placeholder="#aabbcc"
              className={`h-8 w-32 rounded-md border bg-[var(--surface)] px-2 font-mono text-[13px] uppercase outline-none ${
                isValidHex(customAccentHex)
                  ? "border-[var(--border)] text-[var(--text-primary)]"
                  : "border-[var(--status-busy)] text-[var(--status-busy)]"
              }`}
              spellCheck={false}
            />
            {!isValidHex(customAccentHex) && (
              <span className="text-[11px] text-[var(--status-busy)]">Invalid hex</span>
            )}
          </div>
        )}
      </FieldGroup>

      <label className="flex cursor-pointer items-start gap-3">
        <Checkbox checked={darkInFocusMode} onChange={setDarkInFocusMode} />
        <span className="min-w-0">
          <span className="block text-[13px] font-bold text-[var(--text-primary)]">
            Always use dark mode in focus mode
          </span>
          <span className="mt-[2px] block text-[12px] text-[var(--text-muted)]">
            When focus mode is on, override color mode and use dark.
          </span>
        </span>
      </label>
    </div>
  );
}

function AccentSwatch({
  accentKey,
  label,
  hex,
  selected,
  onClick,
}: {
  accentKey: AccentTheme;
  label: string;
  hex: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={selected}
      onClick={onClick}
      className="group flex flex-col items-center gap-[6px] rounded focus-ring"
    >
      <span
        className={`relative flex h-8 w-8 items-center justify-center rounded-full transition-all duration-150 ${
          selected
            ? "ring-2 ring-[var(--text-primary)] ring-offset-2 ring-offset-[var(--modal-bg)]"
            : "hover:ring-2 hover:ring-[var(--text-secondary)] hover:ring-offset-2 hover:ring-offset-[var(--modal-bg)]"
        }`}
        style={{ backgroundColor: hex }}
      >
        {accentKey === "custom" && (
          <Sparkles className="h-3 w-3 text-white" strokeWidth={2.5} aria-hidden />
        )}
      </span>
      <span
        className={`text-[11px] transition-colors duration-100 ${
          selected ? "text-[var(--text-primary)]" : "text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]"
        }`}
      >
        {label}
      </span>
    </button>
  );
}

// ─── Notifications ───────────────────────────────────────────────────────────

function NotificationsPanel() {
  const desktop = usePreferencesStore((s) => s.desktopNotifications);
  const mentionsOnly = usePreferencesStore((s) => s.mentionsOnly);
  const keywords = usePreferencesStore((s) => s.notificationKeywords);
  const soundTheme = usePreferencesStore((s) => s.soundTheme);
  const soundVolume = usePreferencesStore((s) => s.soundVolume);
  const setDesktop = usePreferencesStore((s) => s.setDesktopNotifications);
  const setMentionsOnly = usePreferencesStore((s) => s.setMentionsOnly);
  const setKeywords = usePreferencesStore((s) => s.setNotificationKeywords);
  const setSoundTheme = usePreferencesStore((s) => s.setSoundTheme);
  const setSoundVolume = usePreferencesStore((s) => s.setSoundVolume);
  const morningBriefEnabled = usePreferencesStore((s) => s.morningBriefEnabled);
  const morningBriefTime = usePreferencesStore((s) => s.morningBriefTime);
  const setMorningBriefEnabled = usePreferencesStore((s) => s.setMorningBriefEnabled);
  const setMorningBriefTime = usePreferencesStore((s) => s.setMorningBriefTime);

  return (
    <div className="flex flex-col gap-6">
      <ToggleRow
        label="Desktop notifications"
        hint="Show OS notifications when new messages arrive."
        value={desktop}
        onChange={setDesktop}
      />
      <ToggleRow
        label="Notify only on mentions"
        hint="Mute everything except direct @mentions and DMs."
        value={mentionsOnly}
        onChange={setMentionsOnly}
      />

      <FieldGroup label="Sound" hint="Tone style for incoming notifications.">
        <div className="flex gap-2">
          {(["off", "subtle", "playful"] as SoundTheme[]).map((theme) => {
            const active = soundTheme === theme;
            return (
              <button
                key={theme}
                type="button"
                onClick={() => setSoundTheme(theme)}
                aria-pressed={active}
                className={`rounded-md border px-3 py-1.5 text-[13px] font-medium capitalize transition-colors focus-ring ${
                  active
                    ? "border-[var(--accent)] bg-[var(--accent-light)] text-[var(--text-primary)]"
                    : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:border-[var(--border-input)] hover:text-[var(--text-primary)]"
                }`}
              >
                {theme}
              </button>
            );
          })}
          <button
            type="button"
            disabled={soundTheme === "off"}
            onClick={() => playNotificationTone(soundTheme, soundVolume)}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[12px] text-[var(--text-secondary)] transition-colors hover:border-[var(--border-input)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-60 focus-ring"
          >
            <Volume2 size={13} />
            Preview
          </button>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Volume2 size={14} className="text-[var(--text-muted)]" />
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={soundVolume}
            disabled={soundTheme === "off"}
            onChange={(e) => setSoundVolume(parseInt(e.target.value, 10))}
            aria-label="Notification volume"
            className="h-1.5 flex-1 max-w-[300px] cursor-pointer appearance-none rounded-full bg-[var(--border)] accent-[var(--accent)] disabled:opacity-40"
          />
          <span className="w-8 text-right font-mono text-[11px] text-[var(--text-muted)]">
            {soundVolume}
          </span>
        </div>
      </FieldGroup>

      <FieldGroup
        label="Keyword alerts"
        hint="Comma-separated words that trigger notifications (case-insensitive)."
      >
        <input
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          placeholder="launch, incident, blocker"
          className="h-8 w-full max-w-[360px] rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-[13px] text-[var(--text-primary)] outline-none transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--border-input)]"
        />
      </FieldGroup>

      <FieldGroup
        label="Morning brief"
        hint="A daily desktop notification at the time you pick, summarizing what you missed."
      >
        <div className="flex items-center gap-3">
          <ToggleRow
            label=""
            value={morningBriefEnabled}
            onChange={setMorningBriefEnabled}
          />
          <input
            type="time"
            value={morningBriefTime}
            onChange={(e) => setMorningBriefTime(e.target.value)}
            disabled={!morningBriefEnabled}
            className="h-8 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 text-[13px] text-[var(--text-primary)] outline-none disabled:opacity-50 focus:border-[var(--border-input)]"
          />
        </div>
      </FieldGroup>
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      {label && (
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-[var(--text-primary)]">{label}</p>
          {hint && <p className="mt-[2px] text-[12px] text-[var(--text-muted)]">{hint}</p>}
        </div>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={label || undefined}
        onClick={() => onChange(!value)}
        className={`relative mt-[2px] h-5 w-9 flex-shrink-0 rounded-full transition-colors duration-150 ${
          value ? "bg-[var(--accent)]" : "bg-[var(--border-input)]"
        }`}
      >
        <span
          className={`absolute top-[2px] h-4 w-4 rounded-full bg-white transition-transform duration-150 ${
            value ? "translate-x-[18px]" : "translate-x-[2px]"
          }`}
        />
      </button>
    </div>
  );
}

// ─── Messages & media ────────────────────────────────────────────────────────

function MessagesPanel() {
  const typingIndicator = usePreferencesStore((s) => s.typingIndicator);
  const setTypingIndicator = usePreferencesStore((s) => s.setTypingIndicator);
  const quickReactEmojis = usePreferencesStore((s) => s.quickReactEmojis);
  const customSlashCommands = usePreferencesStore((s) => s.customSlashCommands);
  const setCustomSlashCommand = usePreferencesStore((s) => s.setCustomSlashCommand);
  const removeCustomSlashCommand = usePreferencesStore((s) => s.removeCustomSlashCommand);

  const [newTrigger, setNewTrigger] = useState("");
  const [newExpansion, setNewExpansion] = useState("");

  function addCommand() {
    const trigger = newTrigger.trim();
    const expansion = newExpansion.trim();
    if (!trigger || !expansion) return;
    setCustomSlashCommand(trigger, expansion);
    setNewTrigger("");
    setNewExpansion("");
  }

  return (
    <div className="flex flex-col gap-7">
      <ToggleRow
        label="Show typing bubble"
        hint="Display an animated bubble when someone recently sent you a message. Heuristic only — not real-time presence data."
        value={typingIndicator}
        onChange={setTypingIndicator}
      />

      <FieldGroup
        label="Quick-react keys (1–6)"
        hint="Hover any message and press a number key to react. Bindings are fixed because Microsoft Teams only supports these six reaction types."
      >
        <div className="flex flex-wrap gap-2">
          {quickReactEmojis.slice(0, 6).map((emoji, i) => (
            <div
              key={i}
              className="flex h-9 items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 select-none"
            >
              <kbd className="inline-flex h-5 min-w-[18px] items-center justify-center rounded border border-[var(--border-input)] bg-[var(--surface-raised)] px-1 font-mono text-[11px] font-medium text-[var(--text-secondary)]">
                {i + 1}
              </kbd>
              <span className="text-[16px] leading-none">{emoji}</span>
            </div>
          ))}
        </div>
      </FieldGroup>

      <FieldGroup
        label="Custom slash commands"
        hint="Type /trigger in any composer and it expands to your text. Great for canned replies."
      >
        {Object.entries(customSlashCommands).length === 0 ? (
          <p className="text-[12px] text-[var(--text-muted)]">No custom commands yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {Object.entries(customSlashCommands).map(([trigger, expansion]) => (
              <div
                key={trigger}
                className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5"
              >
                <code className="flex-shrink-0 font-mono text-[12px] text-[var(--accent)]">/{trigger}</code>
                <span className="text-[var(--text-muted)]">→</span>
                <span className="flex-1 truncate text-[13px] text-[var(--text-primary)]">{expansion}</span>
                <button
                  type="button"
                  onClick={() => removeCustomSlashCommand(trigger)}
                  aria-label={`Delete /${trigger}`}
                  className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--status-busy)] focus-ring"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="mt-2 flex flex-col gap-2 md:flex-row">
          <input
            value={newTrigger}
            onChange={(e) => setNewTrigger(e.target.value.replace(/^\//, "").replace(/\s/g, ""))}
            placeholder="trigger (e.g. omw)"
            className="h-8 w-full max-w-[140px] rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 font-mono text-[13px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--border-input)]"
          />
          <input
            value={newExpansion}
            onChange={(e) => setNewExpansion(e.target.value)}
            placeholder="expansion text"
            className="h-8 flex-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 text-[13px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--border-input)]"
          />
          <button
            type="button"
            onClick={addCommand}
            disabled={!newTrigger || !newExpansion}
            className="inline-flex items-center gap-1.5 rounded-md bg-[var(--accent)] px-3 py-1.5 text-[13px] font-medium text-[var(--text-white)] transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50 focus-ring"
          >
            <Plus size={14} />
            Add
          </button>
        </div>
      </FieldGroup>
    </div>
  );
}

// ─── Availability ────────────────────────────────────────────────────────────

function AvailabilityPanel() {
  const autoStatusEnabled = usePreferencesStore((s) => s.autoStatusEnabled);
  const setAutoStatusEnabled = usePreferencesStore((s) => s.setAutoStatusEnabled);

  return (
    <div className="flex flex-col gap-6">
      <ToggleRow
        label="Auto status from calendar"
        hint="Sets your status to 'In a meeting' / 'Heads-down' / 'Out of office' based on your Outlook calendar. Clears automatically when each event ends. Manual status changes pause auto-status for 1 hour."
        value={autoStatusEnabled}
        onChange={setAutoStatusEnabled}
      />
    </div>
  );
}

// ─── Keyboard shortcuts (read-only reference) ───────────────────────────────

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ["⌘", "K"],         label: "Quick switcher — jump to any channel or DM" },
  { keys: ["⌘", "/"],         label: "Search messages, channels, and DMs" },
  { keys: ["?"],              label: "Open this shortcut reference" },
  { keys: ["⌘", "⇧", "F"],   label: "Toggle focus mode" },
  { keys: ["⌘", "⇧", "K"],   label: "Open catch-up digest" },
  { keys: ["Esc"],            label: "Close active modal or thread" },
  { keys: ["Hover", "1–9"],   label: "Quick-react with your top emoji" },
  { keys: ["↑", "↓"],         label: "Move selection in switcher / search" },
  { keys: ["↵"],              label: "Open the highlighted result" },
];

function ShortcutsPanel() {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[12px] text-[var(--text-muted)]">
        Custom bindings coming soon. Press these anywhere in the app.
      </p>
      <div className="flex flex-col gap-1.5">
        {SHORTCUTS.map((s, i) => (
          <div
            key={i}
            className="flex items-center justify-between rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
          >
            <span className="text-[13px] text-[var(--text-primary)]">{s.label}</span>
            <span className="flex gap-1">
              {s.keys.map((k, j) => (
                <kbd
                  key={j}
                  className="inline-flex h-6 min-w-[24px] items-center justify-center rounded border border-[var(--border-input)] bg-[var(--surface-raised)] px-1.5 font-mono text-[11px] font-medium text-[var(--text-secondary)]"
                >
                  {k}
                </kbd>
              ))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Accessibility ───────────────────────────────────────────────────────────

function AccessibilityPanel() {
  const fontScale = usePreferencesStore((s) => s.fontScale);
  const setFontScale = usePreferencesStore((s) => s.setFontScale);

  return (
    <div className="flex flex-col gap-6">
      <FieldGroup label="Reading size" hint="Also in Appearance — here for keyboard-driven accessibility.">
        <div className="flex gap-2">
          {(Object.entries(FONT_SCALES) as [FontScale, (typeof FONT_SCALES)[FontScale]][]).map(([key, { label }]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFontScale(key)}
              aria-pressed={fontScale === key}
              className={`rounded-md border px-3 py-1.5 text-[13px] font-medium transition-colors focus-ring ${
                fontScale === key
                  ? "border-[var(--accent)] bg-[var(--accent-light)] text-[var(--text-primary)]"
                  : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:border-[var(--border-input)] hover:text-[var(--text-primary)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </FieldGroup>
      <p className="text-[12px] text-[var(--text-muted)]">
        For larger reductions in motion, use your OS-level &ldquo;Reduce motion&rdquo; setting —
        Teamsly respects <code className="font-mono text-[11px]">prefers-reduced-motion</code>
        and turns off non-essential animations automatically.
      </p>
    </div>
  );
}

// ─── Advanced ────────────────────────────────────────────────────────────────

function AdvancedPanel() {
  const reset = usePreferencesStore((s) => s.reset);
  return (
    <div className="flex flex-col gap-6">
      <FieldGroup label="Reset preferences" hint="Restore all defaults. Cannot be undone.">
        <button
          type="button"
          onClick={() => {
            if (window.confirm("Reset all preferences to defaults?")) reset();
          }}
          className="w-fit rounded-md border border-[var(--status-busy)]/40 bg-[var(--status-busy)]/10 px-3 py-1.5 text-[13px] font-medium text-[var(--status-busy)] transition-colors hover:bg-[var(--status-busy)]/20 focus-ring"
        >
          Reset to defaults
        </button>
      </FieldGroup>
    </div>
  );
}

// ─── Shared primitives ───────────────────────────────────────────────────────

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
        <p className="text-[13px] font-bold text-[var(--text-primary)]">{label}</p>
        {hint && <p className="text-[12px] text-[var(--text-muted)]">{hint}</p>}
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
      className={`flex w-[90px] flex-col items-center gap-2 rounded-lg border py-3 text-[12px] font-semibold transition-colors duration-150 focus-ring ${
        active
          ? "border-[var(--accent)] bg-[var(--accent-light)] text-[var(--text-primary)]"
          : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:border-[var(--border-input)] hover:text-[var(--text-primary)]"
      }`}
    >
      <Icon size={18} className={active ? "text-[var(--accent)]" : "text-[var(--text-muted)]"} />
      {label}
    </button>
  );
}

function Checkbox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <span className="relative mt-[2px] flex-shrink-0">
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        className={`flex h-4 w-4 items-center justify-center rounded border transition-colors duration-150 ${
          checked
            ? "border-[var(--accent)] bg-[var(--accent)]"
            : "border-[var(--border-input)] bg-[var(--surface)]"
        }`}
      >
        {checked && (
          <svg viewBox="0 0 10 8" fill="none" className="h-[9px] w-[9px]" aria-hidden="true">
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
  );
}
