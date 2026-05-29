# Teamsly UI/UX Polish Audit — 2026-05-29

Goal: make Teamsly **feel better than the native MS Teams client**. Audit across four dimensions (theming, loading/perceived-perf, native-feel/interactions, layout/spacing). Findings below, grouped and prioritized. Branch: `fix/ui-polish`.

## P0 — The "this is a web app, not a native client" tells (fix first)

### 1. Left nav + always-visible surfaces are NOT themed (hardcoded Slack-ish hex)
~441 hardcoded colors repo-wide; **39 instances of `#0F5A8F` (a Slack blue)** used where `var(--accent)` (#6366F1) belongs. Breaks light mode + non-default palettes, off-brand (BRAND.md).
Always-visible offenders (priority order): `LeftRail.tsx` (23, incl. `bg-[#19171d]`, `#0F5A8F`, `#4da3e0`, `#cd2553`, `#1e2027`), `AppShell.tsx` notification banner (`#0F5A8F/15 text-blue-200`), `ToastViewport.tsx` (4), `MessageInput.tsx` (status `#007a5a`), `PresenceDot.tsx` (status dots).
Canonical vars (globals.css): `--bg`/`--content-bg`, `--sidebar-bg`, `--modal-bg`, `--surface`/`--surface-raised`/`--surface-hover`, `--text-primary`/`--text-secondary`/`--text-muted`, `--accent`, `--border`, `--status-{online,away,busy,offline}`, `--text-mention`.
**Fix:** replace every hex with the matching var; all `#0F5A8F` → `var(--accent)`.

### 2. Loading skeleton flashes on chat open (should be instant from IDB cache)
Messages ARE persisted to IndexedDB + hydrated on boot (`message-cache.ts`, `hydrateMessageCache`), but:
- `isLoadingMessages` is a **single global flag** (`workspace.ts:32`) — switching from a cached chat to an uncached one, then back, keeps the skeleton on the cached one.
- **Cold-boot race:** `ChatView`/`ChannelView` effects set `setLoadingMessages(true)` when `getMessages(id).length===0` *before* `hydrateMessageCache()` fills the store (AppShell effect, async, not gated). No `isHydrated` flag exists.
**Fix:** add `isHydrated` to the store (set true after hydrate); only `setLoadingMessages(true)` if `cached.length===0 && isHydrated`. Ideally make loading **per-context** (`loadingContexts: Set<string>` + `isContextLoading(id)`), pass per-context loading to `MessageFeed`. Result: reopening a previously-loaded chat NEVER shows a skeleton.

### 3. DM header name blank for 1:1 DMs
`ChatView.tsx:142` fetches members into **local state only**, never patches the store like the sidebar (`patchChatMembers`). When the chat object lacks members/`chatType`, `getChatLabel` returns `""` (chat-label.ts:26) so the header is blank while the sidebar shows the name.
**Fix:** patch fetched members into the store (unify source with sidebar) + a fallback label.

### 4. JumpToSwitcher top gap
`JumpToSwitcher.tsx:100-103` — the "Recent/Results" `h3` sits *inside* the scrollable `p-3` container, stacking padding into a large top gap. Also missing explicit Escape handler (`:62-75`).
**Fix:** move the header out of the scroll container / tighten padding; add explicit Escape close.

## P1 — Theming the rest (light-mode + palette correctness)
Modals/pickers with heavy hardcoded hex (unusable in light mode): `SettingsModal.tsx` (37, incl. 5× `#0F5A8F`), `ForwardMessageModal.tsx` (20), `EmojiPicker.tsx` (9), `GifPicker.tsx` (8), `AttachmentCard.tsx` (16), `AdaptiveCard.tsx` (10, incl. `rgba(15,90,143,...)`), `LinkPreviewCard.tsx` (14), `ContextFilesTab.tsx` (15). Same fix pattern as P0.1.

## P2 — Native-feel interactions
- **Modal exit animations missing/inconsistent:** PreferencesModal, FeedbackModal, StatusMessageModal, SettingsModal Dialog.Content have no enter/exit animation; JumpToSwitcher overlay animates differently than SearchModal. Define shared `.modal-content`/`.modal-overlay` enter+exit keyframes in globals.css, apply via `data-[state]`.
- **ThreadPanel** uses a hardcoded cubic-bezier instead of `var(--ease-spring)` (ThreadPanel.tsx:84-90).
- **MessageHoverToolbar** micro-jank: base `translate-x-1 translate-y-1` → 1px shift on hover (`:36-40`); use opacity-only.
- **Scroll asymmetry:** initial/channel-switch uses `instant`, new-message uses `smooth` (MessageFeed.tsx ~94-100). Smooth after first settle.
- **Section collapse** uses `ease-out` not `var(--ease-spring)` (Sidebar collapsibles).
- **Reaction pop** (`react-burst`/`react-plus-one` in globals.css) defined but not applied on add.
- **Failed-send Retry/Discard buttons** lack hover bg + focus ring (MessageItem.tsx:255-278).
- **Empty states / intro cards** appear with no entrance animation (utility classes exist, not applied).

## P3 — Layout/spacing polish
- Sidebar section gaps `mb-1` → `mb-2`; DMs header `mt-3` inconsistent with Channels (Sidebar.tsx).
- MessageItem: body density style not applied to continuation rows (font-size jump) (~:479).
- ReactionPill padding tight (`h-[24px] px-2` → `h-6 px-2.5 py-0.5`).
- MessageHeader TabRow `items-end` → `items-center` + symmetric padding.
- MessageInput textarea (`px-3 py-2`) vs toolbar (`px-2 py-1`) asymmetry.
- DateDivider tight vertical padding.

## Execution batches
- **Batch 1 (P0 — the 4 asks + always-visible theming):** LeftRail theming, loading-flash (isHydrated + per-context), DM name, JumpToSwitcher gap+Escape, AppShell banner + ToastViewport + PresenceDot + MessageInput status colors → vars.
- **Batch 2 (P1):** theme the modals/pickers.
- **Batch 3 (P2 + P3):** interaction + spacing polish.
Each batch: `npm run build` green, commit per logical unit.
