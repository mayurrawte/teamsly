# Catch-up Home Implementation Plan (#93)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dead-end `/workspace` home with a catch-up-first landing — the AI digest when AI is on, an unread-across-conversations fallback when it isn't, plus a one-time first-run welcome.

**Architecture:** Extract the catch-up rendering out of `CatchUpPanel` into a shared `CatchUpContent` (panel + home reuse it). A new `WorkspaceHome` component composes a greeting, a dismissible `FirstRunWelcome` (gated on a new persisted `hasSeenWelcome` pref), and either `CatchUpContent` (AI on) or `UnreadFallback` (AI off). The unread fallback is built from the workspace store's existing `unreadCounts` (same data as the sidebar badges).

**Tech Stack:** Next.js 16 App Router, TypeScript, Zustand stores (`workspace`, `catchUp`, `preferences`), NextAuth (`useSession`), Tailwind v4 with CSS-var tokens.

> **No unit-test harness:** this repo has no test runner (`package.json` has no `test` script). Per `CLAUDE.md`, the real gate is `npm run build` (Next build enforces TS + ESLint rules-of-hooks + page-export rules). Each task is verified by `npm run build` going green plus the listed manual check in `npm run dev`.

---

## File Structure

- **Create** `src/components/ai/CatchUpContent.tsx` — tabs + window selector + `DigestView`/`ActionItemsView` + footer + refresh; the reusable catch-up body.
- **Create** `src/components/workspace/HomeTips.tsx` — the three onboarding tips (⌘K, voice, MCP); shared.
- **Create** `src/components/workspace/FirstRunWelcome.tsx` — dismissible welcome card.
- **Create** `src/components/workspace/UnreadFallback.tsx` — unread-across-conversations list / caught-up state.
- **Create** `src/components/workspace/WorkspaceHome.tsx` — composes the home.
- **Modify** `src/store/preferences.ts` — add persisted `hasSeenWelcome`.
- **Modify** `src/components/ai/CatchUpPanel.tsx` — becomes a thin shell around `CatchUpContent`.
- **Modify** `src/app/workspace/page.tsx` — render `<WorkspaceHome />`.

---

## Task 1: Add `hasSeenWelcome` to the preferences store

**Files:**
- Modify: `src/store/preferences.ts`

- [ ] **Step 1: Add the field, default, and setter by mirroring `lastMorningBriefDay`**

`lastMorningBriefDay` already appears in four places: the `Preferences` interface, the `PreferencesState` setters, the defaults object, and the store implementation. Add a parallel `hasSeenWelcome` in the same four places.

In the `Preferences` interface (next to `lastMorningBriefDay: string | null;`):

```ts
  /** Whether the first-run welcome card on the workspace home has been dismissed. */
  hasSeenWelcome: boolean;
```

In the `PreferencesState` interface (with the other `set*` declarations):

```ts
  setHasSeenWelcome: (v: boolean) => void;
```

In the defaults object (next to `lastMorningBriefDay: null,`):

```ts
  hasSeenWelcome: false,
```

In the store implementation (next to `setLastMorningBriefDay: (lastMorningBriefDay) => set({ lastMorningBriefDay }),`):

```ts
      setHasSeenWelcome: (hasSeenWelcome) => set({ hasSeenWelcome }),
```

If the `persist(...)` config has a `partialize` that whitelists fields, also add `hasSeenWelcome: state.hasSeenWelcome,` there (grep the file for `lastMorningBriefDay` — wherever it appears in `partialize`, add `hasSeenWelcome` beside it). If there is no `partialize`, the whole state persists and no extra change is needed.

- [ ] **Step 2: Verify the build passes**

Run: `npm run build`
Expected: `✓ Compiled successfully`, no TS errors.

- [ ] **Step 3: Commit**

```bash
git add src/store/preferences.ts
git commit -m "feat(prefs): add persisted hasSeenWelcome flag for the home welcome"
```

---

## Task 2: Extract `CatchUpContent` and slim down `CatchUpPanel`

**Files:**
- Create: `src/components/ai/CatchUpContent.tsx`
- Modify: `src/components/ai/CatchUpPanel.tsx`

- [ ] **Step 1: Create `CatchUpContent.tsx`**

This lifts the tab row, window selector, view area, refresh control, and footer out of the panel. It reads `window`/`tab` from the `catchUp` store, owns the transient `loading`/`meta`/`refreshNonce` state, and takes an optional `onNavigate` (the panel passes a close-then-navigate; the home omits it → plain `router.push`).

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { useCatchUpStore, type CatchUpWindow, type CatchUpTab } from "@/store/catchUp";
import { DigestView, type CatchUpMeta } from "./DigestView";
import { ActionItemsView } from "./ActionItemsView";

const WINDOW_LABELS: Record<CatchUpWindow, string> = {
  "24h": "Last 24 hours",
  "3d": "Last 3 days",
  "7d": "Last 7 days",
};

const TABS: { key: CatchUpTab; label: string }[] = [
  { key: "digest", label: "Digest" },
  { key: "actions", label: "Action items" },
];

interface Props {
  /** When provided (e.g. by the slide-in panel), used instead of router.push so the
   *  caller can close itself first. */
  onNavigate?: (href: string) => void;
  className?: string;
}

export function CatchUpContent({ onNavigate, className }: Props) {
  const { window: catchUpWindow, tab, setWindow, setTab } = useCatchUpStore();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState<CatchUpMeta | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  // Reset transient meta when the tab changes.
  useEffect(() => {
    setMeta(null);
  }, [tab]);

  const handleRefresh = useCallback(() => setRefreshNonce((n) => n + 1), []);
  const navigate = onNavigate ?? ((href: string) => router.push(href));

  const generatedTime = meta?.generatedAt
    ? new Date(meta.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className={["flex h-full flex-col", className ?? ""].join(" ")}>
      <div role="tablist" className="flex flex-shrink-0 items-center gap-1 border-b border-[var(--border)] px-4 pt-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={[
              "relative px-3 py-2 text-[13px] font-medium transition-colors",
              tab === t.key
                ? "text-[var(--text-primary)] after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-[var(--accent)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
        <button
          type="button"
          aria-label="Refresh"
          onClick={handleRefresh}
          disabled={loading}
          className="ml-auto flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] disabled:opacity-40"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="flex flex-shrink-0 gap-1.5 border-b border-[var(--border)] px-4 py-2">
        {(Object.entries(WINDOW_LABELS) as [CatchUpWindow, string][]).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setWindow(key)}
            className={[
              "rounded-full px-3 py-1 text-[12px] font-medium transition-colors",
              catchUpWindow === key
                ? "bg-[var(--accent)] text-white"
                : "bg-[var(--surface-raised)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {tab === "digest" ? (
          <DigestView
            window={catchUpWindow}
            refreshNonce={refreshNonce}
            onLoadingChange={setLoading}
            onMeta={setMeta}
          />
        ) : (
          <ActionItemsView
            window={catchUpWindow}
            refreshNonce={refreshNonce}
            onLoadingChange={setLoading}
            onMeta={setMeta}
            onNavigate={navigate}
          />
        )}
      </div>

      {!loading && generatedTime && (
        <footer className="flex flex-shrink-0 items-center justify-between border-t border-[var(--border)] px-4 py-2">
          <span className="text-[11px] text-[var(--text-muted)]">Generated at {generatedTime}</span>
          {meta?.cached && (
            <span className="rounded-full bg-[var(--surface-raised)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
              cached
            </span>
          )}
        </footer>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Replace `CatchUpPanel.tsx` body with `CatchUpContent`**

Keep the slide-in `<aside>`, overlay, Escape handler, and a header with title + Close. The refresh now lives inside `CatchUpContent`, so the header drops it. Replace the whole file with:

```tsx
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
          "transition-transform duration-[280ms] ease-[cubic-bezier(0.34,1.2,0.64,1)]",
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
```

- [ ] **Step 3: Verify the build passes**

Run: `npm run build`
Expected: `✓ Compiled successfully`, no TS/ESLint errors.

- [ ] **Step 4: Manual check (panel unchanged)**

`npm run dev`, open a chat, run `/tldr` to open the panel. Verify: Digest/Action-items tabs switch, the 24h/3d/7d window changes, the refresh icon spins + re-fetches, an action-item "jump" closes the panel and navigates, Close + Escape both dismiss.

- [ ] **Step 5: Commit**

```bash
git add src/components/ai/CatchUpContent.tsx src/components/ai/CatchUpPanel.tsx
git commit -m "refactor(catchup): extract CatchUpContent for reuse on the home"
```

---

## Task 3: Create `HomeTips`

**Files:**
- Create: `src/components/workspace/HomeTips.tsx`

- [ ] **Step 1: Create the shared tips list**

```tsx
"use client";

import { Command, Mic, Plug } from "lucide-react";

const TIPS = [
  { icon: Command, title: "Jump anywhere", body: "Press ⌘K (Ctrl+K) to search and switch conversations." },
  { icon: Mic, title: "Drop-in voice", body: "Start an ad-hoc voice room in any channel or DM." },
  { icon: Plug, title: "Use it from your AI", body: "Connect Teamsly to Claude or Cursor: npx -y @teamsly/mcp" },
] as const;

export function HomeTips() {
  return (
    <ul className="flex flex-col gap-2.5">
      {TIPS.map((tip) => (
        <li key={tip.title} className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-[var(--surface-raised)] text-[var(--accent)]">
            <tip.icon className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-[var(--text-primary)]">{tip.title}</p>
            <p className="text-[12px] text-[var(--text-secondary)]">{tip.body}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 2: Verify the build passes**

Run: `npm run build`
Expected: `✓ Compiled successfully` (confirms the `lucide-react` icon names `Command`, `Mic`, `Plug` exist).

- [ ] **Step 3: Commit**

```bash
git add src/components/workspace/HomeTips.tsx
git commit -m "feat(home): add shared HomeTips onboarding list"
```

---

## Task 4: Create `FirstRunWelcome`

**Files:**
- Create: `src/components/workspace/FirstRunWelcome.tsx`

- [ ] **Step 1: Create the dismissible welcome card**

```tsx
"use client";

import { usePreferencesStore } from "@/store/preferences";
import { HomeTips } from "./HomeTips";

export function FirstRunWelcome() {
  const hasSeenWelcome = usePreferencesStore((s) => s.hasSeenWelcome);
  const setHasSeenWelcome = usePreferencesStore((s) => s.setHasSeenWelcome);

  if (hasSeenWelcome) return null;

  return (
    <div className="mb-6 flex-shrink-0 rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold text-[var(--text-primary)]">Welcome to Teamsly 👋</h2>
          <p className="mt-1 text-[13px] text-[var(--text-secondary)]">A few things to get you started:</p>
        </div>
        <button
          type="button"
          onClick={() => setHasSeenWelcome(true)}
          className="flex-shrink-0 rounded-md px-2.5 py-1 text-[12px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
        >
          Got it
        </button>
      </div>
      <div className="mt-3">
        <HomeTips />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the build passes**

Run: `npm run build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 3: Commit**

```bash
git add src/components/workspace/FirstRunWelcome.tsx
git commit -m "feat(home): add dismissible first-run welcome card"
```

---

## Task 5: Create `UnreadFallback`

**Files:**
- Create: `src/components/workspace/UnreadFallback.tsx`

- [ ] **Step 1: Create the unread list / caught-up component**

Builds items from `unreadCounts` (DMs via `getChatLabel`; channels by scanning the `channels` Record for the owning `teamId`), sorted by count. Empty → caught-up state with `HomeTips`.

```tsx
"use client";

import { useRouter } from "next/navigation";
import { Hash } from "lucide-react";
import { useWorkspaceStore } from "@/store/workspace";
import { getChatLabel } from "@/lib/utils/chat-label";
import { HomeTips } from "./HomeTips";

interface UnreadItem {
  id: string;
  name: string;
  href: string;
  count: number;
  kind: "dm" | "channel";
}

export function UnreadFallback() {
  const router = useRouter();
  const { chats, channels, unreadCounts, currentUserId, markRead } = useWorkspaceStore();

  const items: UnreadItem[] = [];
  for (const chat of chats) {
    const count = unreadCounts[chat.id] ?? 0;
    if (count > 0) {
      items.push({
        id: chat.id,
        name: getChatLabel(chat, currentUserId ?? ""),
        href: `/workspace/dm/${chat.id}`,
        count,
        kind: "dm",
      });
    }
  }
  for (const [teamId, list] of Object.entries(channels)) {
    for (const ch of list) {
      const count = unreadCounts[ch.id] ?? 0;
      if (count > 0) {
        items.push({
          id: ch.id,
          name: ch.displayName,
          href: `/workspace/t/${teamId}/${ch.id}`,
          count,
          kind: "channel",
        });
      }
    }
  }
  items.sort((a, b) => b.count - a.count);

  function open(item: UnreadItem) {
    markRead(item.id);
    router.push(item.href);
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-start gap-5 py-2">
        <p className="text-[15px] font-medium text-[var(--text-primary)]">✨ You&apos;re all caught up</p>
        <div className="w-full max-w-md">
          <HomeTips />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        Unread across {items.length} conversation{items.length === 1 ? "" : "s"}
      </h2>
      <ul className="flex flex-col gap-1">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => open(item)}
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left transition-colors hover:bg-[var(--surface-hover)]"
            >
              {item.kind === "channel" && <Hash className="h-4 w-4 flex-shrink-0 text-[var(--text-muted)]" />}
              <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-[var(--text-primary)]">
                {item.name}
              </span>
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--accent)] px-1.5 text-[11px] font-bold text-white">
                {item.count > 99 ? "99+" : item.count}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Verify the build passes**

Run: `npm run build`
Expected: `✓ Compiled successfully` (confirms `getChatLabel`, `markRead`, and the store fields resolve).

- [ ] **Step 3: Commit**

```bash
git add src/components/workspace/UnreadFallback.tsx
git commit -m "feat(home): add unread-across-conversations fallback"
```

---

## Task 6: Create `WorkspaceHome` and wire the page

**Files:**
- Create: `src/components/workspace/WorkspaceHome.tsx`
- Modify: `src/app/workspace/page.tsx`

- [ ] **Step 1: Create `WorkspaceHome.tsx`**

Greeting is computed in a `useEffect` (client-only) to avoid an SSR/client hydration mismatch on the hour. AI branch uses the same client flag the rest of the app uses.

```tsx
"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { CatchUpContent } from "@/components/ai/CatchUpContent";
import { FirstRunWelcome } from "./FirstRunWelcome";
import { UnreadFallback } from "./UnreadFallback";

const AI_ENABLED = process.env.NEXT_PUBLIC_AI_ENABLED === "true";

export function WorkspaceHome() {
  const { data: session } = useSession();
  const firstName = session?.user?.name?.split(" ")[0];
  const [greeting, setGreeting] = useState("Welcome back");

  // Client-only so the hour doesn't cause a hydration mismatch.
  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening");
  }, []);

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col overflow-y-auto px-6 py-8">
      <header className="mb-5 flex-shrink-0">
        <h1 className="text-[20px] font-bold text-[var(--text-primary)]">
          {greeting}
          {firstName ? `, ${firstName}` : ""}
        </h1>
      </header>

      <FirstRunWelcome />

      <div className="flex min-h-0 flex-1 flex-col">
        {AI_ENABLED ? <CatchUpContent /> : <UnreadFallback />}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Replace `src/app/workspace/page.tsx`**

The current file hardcodes Slack-grey hex (`#d1d2d3` / `#ababad`). Replace the whole file — all rendering now lives in the component, so the page only exports the default:

```tsx
import { WorkspaceHome } from "@/components/workspace/WorkspaceHome";

export default function AppHome() {
  return <WorkspaceHome />;
}
```

- [ ] **Step 3: Verify the build passes**

Run: `npm run build`
Expected: `✓ Compiled successfully`, no errors. Confirm `/workspace` appears in the route output.

- [ ] **Step 4: Manual checks**

`npm run dev`, sign in, land on `/workspace`:
- First load shows the greeting + the Welcome card; "Got it" hides it and it stays hidden after a reload.
- With `NEXT_PUBLIC_AI_ENABLED=true` (in `.env.local`): the catch-up digest renders; tabs/window work; opening the side panel (`/tldr`) reflects the same window.
- Set `NEXT_PUBLIC_AI_ENABLED=false`, restart dev: the home shows the unread list (or "You're all caught up ✨" with tips when nothing is unread); clicking a row opens that conversation.

- [ ] **Step 5: Commit**

```bash
git add src/components/workspace/WorkspaceHome.tsx src/app/workspace/page.tsx
git commit -m "feat(home): make catch-up the workspace home (#93)"
```

---

## Final verification

- [ ] `npm run build` green.
- [ ] `npm run electron:compile` green (no Electron files changed, but confirms the shared tsconfig still compiles).
- [ ] The catch-up side panel still works exactly as before (Task 2 manual check).
- [ ] Open a PR with `Closes #93`.
