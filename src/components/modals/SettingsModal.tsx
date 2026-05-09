"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, User, Bell, Palette, Info, LogOut } from "lucide-react";
import { usePreferencesStore, type Density } from "@/store/preferences";

type TabKey = "account" | "notifications" | "appearance" | "about";

interface AccountInfo {
  name: string;
  email?: string;
  initials: string;
  badge?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: AccountInfo;
  onSignOut?: () => void;
}

export function SettingsModal({ open, onOpenChange, account, onSignOut }: Props) {
  const [tab, setTab] = useState<TabKey>("account");

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-[70] flex h-[540px] w-[720px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-[#3f4144] bg-[#1a1d21] text-[#d1d2d3] shadow-[0_16px_64px_rgba(0,0,0,0.6)] focus:outline-none"
          aria-describedby={undefined}
        >
          <Dialog.Title className="sr-only">Settings</Dialog.Title>

          <nav className="flex w-[200px] flex-shrink-0 flex-col gap-1 border-r border-[#3f4144] bg-[#19171d] p-3">
            <p className="px-2 pb-2 pt-1 text-[11px] font-bold uppercase tracking-wider text-[#6c6f75]">
              Settings
            </p>
            <TabButton icon={User} label="Account" active={tab === "account"} onClick={() => setTab("account")} />
            <TabButton icon={Bell} label="Notifications" active={tab === "notifications"} onClick={() => setTab("notifications")} />
            <TabButton icon={Palette} label="Appearance" active={tab === "appearance"} onClick={() => setTab("appearance")} />
            <TabButton icon={Info} label="About" active={tab === "about"} onClick={() => setTab("about")} />
          </nav>

          <section className="flex flex-1 flex-col overflow-hidden">
            <header className="flex h-[49px] flex-shrink-0 items-center justify-between border-b border-[#3f4144] px-5">
              <h2 className="text-[15px] font-black text-white">{TAB_TITLES[tab]}</h2>
              <Dialog.Close
                aria-label="Close"
                className="flex h-7 w-7 items-center justify-center rounded text-[#ababad] hover:bg-[#27292d] hover:text-white"
              >
                <X size={16} />
              </Dialog.Close>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {tab === "account" && <AccountPanel account={account} onSignOut={onSignOut} />}
              {tab === "notifications" && <NotificationsPanel />}
              {tab === "appearance" && <AppearancePanel />}
              {tab === "about" && <AboutPanel />}
            </div>
          </section>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

const TAB_TITLES: Record<TabKey, string> = {
  account: "Account",
  notifications: "Notifications",
  appearance: "Appearance",
  about: "About Teamsly",
};

function TabButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof User;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-md px-2 py-[6px] text-left text-[14px] transition-colors duration-100 ${
        active ? "bg-[#1164a3] text-white" : "text-[#ababad] hover:bg-[#27242c] hover:text-white"
      }`}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}

function AccountPanel({ account, onSignOut }: { account: AccountInfo; onSignOut?: () => void }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded bg-[#1164a3] text-[16px] font-bold text-white">
          {account.initials}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-black text-white">{account.name}</p>
          {account.email && <p className="truncate text-[13px] text-[#ababad]">{account.email}</p>}
          {account.badge && (
            <p className="mt-1 inline-block rounded bg-[#27292d] px-2 py-[2px] text-[11px] font-bold uppercase tracking-wide text-[#ababad]">
              {account.badge}
            </p>
          )}
        </div>
      </div>

      <FieldGroup label="Signed in via" hint="Microsoft 365 (read-only)">
        <p className="text-[13px] text-[#ababad]">All data lives in Microsoft Graph. Teamsly never stores messages, files, or credentials locally.</p>
      </FieldGroup>

      {onSignOut && (
        <button
          type="button"
          onClick={onSignOut}
          className="inline-flex w-fit items-center gap-2 rounded-md border border-[#3f4144] bg-transparent px-3 py-[6px] text-[13px] font-bold text-[#d1d2d3] hover:border-[#cd2553] hover:bg-[rgba(205,37,83,0.1)] hover:text-[#cd2553]"
        >
          <LogOut size={14} />
          Sign out
        </button>
      )}
    </div>
  );
}

function NotificationsPanel() {
  const desktop = usePreferencesStore((s) => s.desktopNotifications);
  const sound = usePreferencesStore((s) => s.notificationSound);
  const mentionsOnly = usePreferencesStore((s) => s.mentionsOnly);
  const keywords = usePreferencesStore((s) => s.notificationKeywords);
  const setDesktop = usePreferencesStore((s) => s.setDesktopNotifications);
  const setSound = usePreferencesStore((s) => s.setNotificationSound);
  const setMentionsOnly = usePreferencesStore((s) => s.setMentionsOnly);
  const setKeywords = usePreferencesStore((s) => s.setNotificationKeywords);

  return (
    <div className="flex flex-col gap-4">
      <ToggleRow
        label="Desktop notifications"
        hint="Show OS notifications when new messages arrive."
        value={desktop}
        onChange={setDesktop}
      />
      <ToggleRow
        label="Notification sound"
        hint="Play a sound for new messages."
        value={sound}
        onChange={setSound}
      />
      <ToggleRow
        label="Notify only on mentions"
        hint="Mute everything except direct @mentions and DMs."
        value={mentionsOnly}
        onChange={setMentionsOnly}
      />
      <FieldGroup label="Keyword alerts" hint="Comma-separated words that can trigger smart notifications.">
        <input
          value={keywords}
          onChange={(event) => setKeywords(event.target.value)}
          placeholder="launch, incident, blocker"
          className="h-8 rounded-md border border-[#3f4144] bg-[#222529] px-3 text-[13px] text-[#d1d2d3] outline-none transition-colors duration-150 placeholder:text-[#6c6f75] focus:border-white"
        />
      </FieldGroup>
      <p className="mt-2 text-[12px] text-[#6c6f75]">
        Smart notifications use the Browser Notification API when Pro is enabled.
      </p>
    </div>
  );
}

function AppearancePanel() {
  const density = usePreferencesStore((s) => s.density);
  const setDensity = usePreferencesStore((s) => s.setDensity);

  return (
    <div className="flex flex-col gap-5">
      <FieldGroup label="Theme" hint="Light theme is on the roadmap.">
        <div className="flex flex-col gap-2">
          <RadioRow checked label="Dark" description="Slack-style dark theme" onClick={() => undefined} />
          <RadioRow checked={false} disabled label="Light" description="Coming soon" onClick={() => undefined} />
          <RadioRow checked={false} disabled label="Sync with OS" description="Coming soon" onClick={() => undefined} />
        </div>
      </FieldGroup>

      <FieldGroup label="Message density" hint="Affects vertical spacing in the message feed.">
        <div className="flex flex-col gap-2">
          <RadioRow
            checked={density === "comfortable"}
            label="Comfortable"
            description="Default — generous padding around each message"
            onClick={() => setDensity("comfortable" as Density)}
          />
          <RadioRow
            checked={density === "compact"}
            label="Compact"
            description="Tighter rows — fits more on screen"
            onClick={() => setDensity("compact" as Density)}
          />
        </div>
      </FieldGroup>
    </div>
  );
}

function AboutPanel() {
  return (
    <div className="flex flex-col gap-3 text-[13px] text-[#d1d2d3]">
      <p className="text-[15px] font-black text-white">Teamsly</p>
      <p className="text-[#ababad]">Open-source Slack-style UI for Microsoft Teams. All data stays in Microsoft Graph — Teamsly stores nothing.</p>
      <dl className="grid grid-cols-[100px_1fr] gap-y-1 text-[12px]">
        <dt className="text-[#6c6f75]">Version</dt>
        <dd className="text-[#d1d2d3]">0.1.0</dd>
        <dt className="text-[#6c6f75]">License</dt>
        <dd className="text-[#d1d2d3]">AGPL-3.0</dd>
        <dt className="text-[#6c6f75]">Source</dt>
        <dd>
          <a
            href="https://github.com/mayurrawte/teamsly"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#1d9bd1] hover:underline"
          >
            github.com/mayurrawte/teamsly
          </a>
        </dd>
      </dl>
    </div>
  );
}

function FieldGroup({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
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
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-md border border-[#3f4144] bg-[#222529] px-3 py-2 hover:border-[#565856]">
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-bold text-white">{label}</span>
        {hint && <span className="mt-[2px] block text-[12px] text-[#6c6f75]">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative mt-[2px] h-5 w-9 flex-shrink-0 rounded-full transition-colors duration-150 ${
          value ? "bg-[#007a5a]" : "bg-[#565856]"
        }`}
      >
        <span
          className={`absolute top-[2px] h-4 w-4 rounded-full bg-white transition-transform duration-150 ${
            value ? "translate-x-[18px]" : "translate-x-[2px]"
          }`}
        />
      </button>
    </label>
  );
}

function RadioRow({
  checked,
  label,
  description,
  disabled,
  onClick,
}: {
  checked: boolean;
  label: string;
  description?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`flex items-start gap-3 rounded-md border px-3 py-2 text-left transition-colors duration-100 ${
        checked
          ? "border-[#1164a3] bg-[rgba(17,100,163,0.15)]"
          : "border-[#3f4144] bg-[#222529]"
      } ${disabled ? "cursor-not-allowed opacity-50" : "hover:border-[#565856]"}`}
    >
      <span
        className={`mt-[2px] flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-2 ${
          checked ? "border-[#1164a3]" : "border-[#565856]"
        }`}
      >
        {checked && <span className="h-2 w-2 rounded-full bg-[#1164a3]" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-bold text-white">{label}</span>
        {description && <span className="mt-[2px] block text-[12px] text-[#6c6f75]">{description}</span>}
      </span>
    </button>
  );
}
