# Catch-up Home — Design (#93)

**Goal:** Replace the dead-end post-login home (`/workspace` → "Select a channel or DM…") with a useful landing: the AI catch-up digest when AI is available, an unread-across-conversations fallback when it isn't, and a one-time first-run welcome with feature hints.

**Why:** The home is the first thing every user sees after sign-in. Today it's empty — no onboarding, no feature discovery, and the catch-up digest (the headline differentiator) is buried in a side panel. Surfacing it on the home serves both first-run activation and day-to-day retention.

---

## Approach

Extract the catch-up rendering out of the slide-in panel into a shared **`CatchUpContent`** component, used by both the panel and the new home, so the two never drift. (Rejected alternative: duplicate the markup in the home — faster, but guarantees divergence.)

The home itself is **catch-up-first**: it renders `CatchUpContent` when AI is enabled, and an **unread fallback** when it isn't — so the home is never empty or broken, even self-hosted without an AI key.

## Components / files

### New
- **`src/components/ai/CatchUpContent.tsx`** — the tab row (Digest / Action items) + window selector (24h/3d/7d) + `DigestView`/`ActionItemsView` + generated-at footer + a refresh control. Owns the transient `loading` / `meta` / `refreshNonce` state. Reads `window`/`tab` from the existing `catchUp` store, so the choice carries between home and panel. Self-contained — no props required; an optional `className` lets the home/panel adjust padding.
- **`src/components/workspace/WorkspaceHome.tsx`** *(client)* — composes the home: greeting header → `FirstRunWelcome` (if not yet seen) → `CatchUpContent` (AI on) **or** `UnreadFallback` (AI off).
- **`src/components/workspace/UnreadFallback.tsx`** — reads `unreadCounts` from the workspace store, resolves each id to `{ name, href }` via the store's existing chat/channel collections (the same data the sidebar renders), and lists "Unread across N conversations" (each row click-navigates). When there are no unread items, renders the caught-up state: "You're all caught up ✨" + the entry-point tips.
- **`src/components/workspace/FirstRunWelcome.tsx`** — dismissible card: a short welcome line + three tips (⌘K jump-to, drop-in voice rooms, MCP setup). "Got it" dismisses and sets `prefs.hasSeenWelcome`.
- **`src/components/workspace/HomeTips.tsx`** — the three-tip list, shared by `FirstRunWelcome` and the `UnreadFallback` caught-up state (DRY).

### Modified
- **`src/app/workspace/page.tsx`** — becomes a thin file that renders `<WorkspaceHome />` (page files may only export the page component per CLAUDE.md, so all logic lives in the component). Removes the hardcoded Slack-grey hex (`#d1d2d3` / `#ababad`) — replaced by CSS-var text colors.
- **`src/components/ai/CatchUpPanel.tsx`** — keeps the slide-in `<aside>` shell, overlay, Escape handler, and a header with title + **Close**; its body becomes `<CatchUpContent />`. The refresh control moves into `CatchUpContent` (so it works on the home too); the panel header keeps title + close only.
- **`src/store/preferences.ts`** — add persisted `hasSeenWelcome: boolean` (default `false`) + `setHasSeenWelcome(v)`, mirroring the existing `lastMorningBriefDay` field/setter and persistence.

## Data flow

- **AI availability:** the home branches on `process.env.NEXT_PUBLIC_AI_ENABLED === "true"` — the same client gate already used for the catch-up entry points. On → `CatchUpContent`; off → `UnreadFallback`.
- **Catch-up:** `CatchUpContent` → `DigestView`/`ActionItemsView` → existing `/api/ai/tldr` + `/api/ai/action-items` (auth + per-user quota + cache already handled server-side). Their loading / results / not-configured / limit / error states are unchanged and reused as-is.
- **Unread:** the workspace store's `unreadCounts: Record<id, number>` (already populated and persisted to `teamsly:unread-counts`; same source as the sidebar badges), joined against the store's chat/channel collections to produce name + route (`/workspace/dm/{chatId}` or `/workspace/t/{teamId}/{channelId}`). Ids with no match are skipped.
- **Greeting:** time-of-day ("Good morning" < 12:00, "Good afternoon" < 18:00, else "Good evening") + the session's first name (`session.user.name`); falls back to "Welcome back" with no name.
- **First-run:** `prefs.hasSeenWelcome` from the persisted preferences store (localStorage). `FirstRunWelcome` renders only while it's `false`.

## States covered

| Situation | Home shows |
|---|---|
| First run, AI on | `FirstRunWelcome` + catch-up digest |
| Returning, AI on | catch-up digest (incl. its own caught-up / limit / error states) |
| AI off, has unread | greeting + unread-across-N-conversations list |
| AI off, no unread | "You're all caught up ✨" + entry-point tips |
| AI on, server key missing (flag/key mismatch) | the digest's existing not-configured card (edge case, acceptable) |

## Out of scope (YAGNI)

- No new server routes (reuses the existing AI routes + the client unread store).
- No redesign of the catch-up digest itself.
- No jump-to-last-conversation routing change — `/workspace` stays the landing.
- No live quota→unread auto-swap: when AI is on but the daily limit is hit, the digest shows its existing "limit reached" message (not the unread list). The unread fallback is the AI-disabled path.

## Testing

- `npm run build` green (Next 16 / Turbopack) — the real gate (ESLint rules-of-hooks + page-export restrictions).
- Manual:
  - First run → welcome card visible; "Got it" dismisses and stays dismissed across reload.
  - AI on → digest renders; switching tabs/window works; the same window choice is reflected when opening the side panel.
  - `NEXT_PUBLIC_AI_ENABLED=false` → unread fallback list renders from the sidebar's unread counts; clicking a row opens that conversation.
  - Zero unread (AI off) → caught-up state with tips.
  - Panel still works unchanged (open via `/tldr`, refresh, close, Escape).
