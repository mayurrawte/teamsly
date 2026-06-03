# Native Microsoft Teams feel — audit & staged-PR plan

**Date:** 2026-06-03
**Goal:** Make Teamsly (web + Electron desktop) feel like the native Microsoft
Teams client. Owner emphasis: detail polish, overall native feel, and
**reactivity in the Electron desktop app**. Approach: full audit → staged PRs,
recommended order, check-in between each. Segoe-UI default font and the two
big-ticket Electron items (notarization, local-asset bundling) are **deferred**.

## Track A — Visual native-feel (detail polish)
- **A1 · Sidebar & chrome** *(this PR)* — active row = subtle accent tint + left
  accent bar (was a solid violet block); sentence-case semibold section headers
  (was ALL-CAPS); accent-colored unread badges via `--badge-unread` (was
  mention-magenta); semibold unread text (was white-bold); full-strength leading
  icons (drop `opacity-70`); unify header heights via `--chrome-header-h` (48px).
- **A2 · Message rows** — 32px round avatars (was 36px rounded-square), continuation
  gutter alignment, semibold author names, tighter line spacing, square-ish reaction
  chips.
- **A3 · Headers + composer** — 15px semibold conversation title (was 17px bold),
  accent tab indicator, flat header (drop shadow), thin rule instead of `|` glyph;
  composer accent send button (was presence-green), tighter radius/focus, fix
  `hover:text-white` (light-mode bug), lucide icons for ⏱/📅.
- **A4 · Motion / radii / elevation** — calmer ease-out (drop spring overshoots and
  scale bounces), flatter shadows, consistent radius tokens, flatter date dividers.
- *(A5 · Segoe UI default font — deferred per owner.)*

## Track B — Web reactivity
- **B1** — per-context loading flag (kill channel-switch skeleton flash + scroll
  reset); `router.prefetch` on sidebar hover; fix draft-seed flicker.
- **B2** — adaptive polling tied to SSE health (worst case 30s today); append-on-push
  instead of full refetch; gate background timers on tab visibility.
- **B3** — smooth new-message scroll; `React.memo` rows + memoized link detection;
  header skeletons.

## Track C — Electron native feel
- **C0 · App icon** — the packaged app still shows the **default Electron logo**
  (dock/taskbar/window). Set the brand icon in electron-builder + BrowserWindow.
  Quick, high-visibility. (Owner-reported 2026-06-03.)
- **C1** — no-flash launch (`show:false` + `ready-to-show`), offline retry page,
  `backgroundThrottling:false`.
- **C2** — native notification click → focus window + open conversation; stop gating
  desktop notifications behind the Pro flag in Electron.
- **C3** — Windows custom title bar, cross-platform menu, proper right-click context
  menu + spellcheck (packaged builds currently kill the context menu).
- **C4** — `teamsly://` deep links + single-instance lock + Windows taskbar badge.
- **C5 (deferred, owner-gated)** — macOS notarization for silent auto-update.
- **C6 (deferred, large)** — bundle Next `standalone` for local-first load (root fix
  for the "website in a window" feel).

## Recommended order
A1 → A2 → C0 → C1 → B1 → C2 → A3 → A4 → B2 → C3/C4 → B3. (C0 promoted near the
front since the owner flagged the Electron logo and it's a quick win.)

## Delivery status (2026-06-03)
- **Shipped, own PRs:** A1 (#62), C0 (#63), A2 (#64), C1 (#65).
- **Shipped, consolidated PR** (this branch, builds on the four above): A3
  (headers + composer), A4 (date-divider flatten), C2 (notification
  click-to-focus-and-route + Pro-gate decoupled in Electron), C3 (native
  context menu + spellcheck), C4 (single-instance lock + cross-platform badge
  via setBadgeCount).
- **Deferred (follow-up):** A4 broad motion/radius/shadow token system
  (cross-cutting); B1–B3 web reactivity (per-context loading flag, route
  prefetch, append-on-push, smooth scroll, memo rows); C3 Windows custom title
  bar; C4 `teamsly://` deep links + Windows overlay badge icon; screen-share
  `setDisplayMediaRequestHandler` for voice rooms; C5 notarization; C6
  local-asset bundling.

## Verification
Each PR: `npm run build` green. UI changes are CSS-var/Tailwind tweaks reviewable in
the running dev server across palettes + light/dark.
