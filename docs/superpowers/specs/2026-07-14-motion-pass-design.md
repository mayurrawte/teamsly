# Motion pass: microinteractions + token foundation (#72)

**Status:** design approved 2026-07-14 · **Branch:** `feat/motion-pass`
**Goal:** make the app feel alive and shareable for new users — "playful but earned":
big effects only on explicit triggers, everything ambient stays subtle.

## Context (what already exists — do NOT rebuild)

- Tokens in `src/app/globals.css`: `--motion-fast/base/slow` (120/200/320ms),
  `--ease-snap/spring/out-soft`, all zeroed under `prefers-reduced-motion`.
- Keyframes already shipped: `react-burst`, `react-plus-one`, `slash-fx-pop`,
  `typing-dot`, `presence-ping`, `message-in`, `send-ripple`, `badge-pulse`,
  `toast-in/out`, `skeleton-shimmer`, `message-anchor-flash`, `context-fade-in`,
  `motion-fade-up/pop-in/slide-in-right`.
- The gap: components hardcode durations/easings instead of using tokens, and
  there are no *memorable* moments (nothing a user would screenshot).

## Hard constraints

- **Zero new npm dependencies.** Hand-rolled CSS/DOM only.
- **transform/opacity only** — nothing that triggers layout; no new continuous
  animations (existing shimmer/typing dots are the only loops).
- **Reduced-motion always wins**: every new effect either lives inside
  `@media (prefers-reduced-motion: no-preference)` or uses the zeroed tokens.
- **Brand palette only** (see BRAND.md; no Slack-palette hexes).
- **No experimental Next.js flags** (no View Transitions API flag pre-launch).
- Preserve all existing behavior; this is additive polish.

## Phase 1 — token foundation

1. Add tokens to `globals.css`: `--ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1)`
   (promote the curve `slash-fx-pop` already uses), `--motion-slower: 480ms`
   (zeroed under reduced motion like the others).
2. Add radius tokens `--radius-sm: 4px / --radius-md: 6px / --radius-lg: 8px /
   --radius-xl: 12px` and shadow tokens `--shadow-raised / --shadow-overlay /
   --shadow-popover` (values lifted from the most common current usages), and
   map them through the Tailwind theme so `rounded-*`/named shadows resolve to
   the vars. Components keep their existing class names.
3. Sweep `src/components/**` + `src/app/**`: replace hardcoded animation
   durations/easings (`duration-150`, `duration-[80ms]`, inline cubic-beziers
   in `globals.css` keyframe *rules*) with the tokens. Keyframe definitions
   themselves keep raw curves only where a token doesn't exist after (1).
   Judgment rule: if a hardcoded value is within 40ms of a token, snap to the
   token; otherwise leave it and note it in the PR body.

## Phase 2 — chat hero moments

1. **Celebration confetti.**
   - Pure detector `isCelebrationMessage(text: string): boolean` in
     `src/lib/utils/celebrate.ts`: after stripping HTML tags and whitespace,
     the text is non-empty, ≤ 32 chars, consists only of emoji, and contains at
     least one of 🎉 🎊 🥳. Unit-tested (vitest) including negative cases
     ("party at 🎉 9" → false, plain text → false, "🎉🎉🎉" → true).
   - `<CelebrationBurst />` component: absolutely-positioned overlay rendered
     inside MessageFeed's scroll container; ~24 particle `<span>`s with
     randomized (CSS-var-driven, seeded from index) directions/colors from the
     brand palette; single play (`--motion-slower`), nodes removed on
     `animationend` of the last particle; `pointer-events: none`.
   - Trigger: fires once per message id (module-level `Set`) when (a) the user
     sends a message passing the detector (optimistic append path) or (b) an
     incoming message passing the detector arrives in the *open* conversation
     (upsert path). No queueing: concurrent triggers coalesce to one burst.
   - New preference `celebrationEffects: boolean` (default `true`) in the
     preferences store + a toggle in the Preferences modal (Notifications
     panel), and the demo views honor it too.
2. **Send feel.** Upgrade `message-in` to `translateY(8px) scale(0.98) → rest`
   over `--motion-base` `--ease-spring`; apply ONLY to own optimistic appends
   (`__pending` messages), never to polled/history renders. Send button:
   `:active` scale press using `--motion-fast` (wire to existing `send-ripple`
   if it is currently unused, else leave ripple as is).
3. **Emoji picker play.** Hover pop (`scale(1.25)`, `--motion-fast`,
   transform-only) on emoji buttons; staggered fade-in on picker open with
   `animation-delay: min(index, 20) * 12ms` so long grids never feel slow.

## Phase 3 — navigation polish + landing

1. **Sidebar.** Springy hover/active transitions on nav items (`--ease-spring`,
   `--motion-base`). A shared sliding indicator pill ONLY if the current list
   structure allows an absolutely-positioned sibling without restructuring;
   otherwise per-item spring only. Explicitly: no structural refactor.
2. **Unread badge roll.** When a badge count changes, old digits translate up
   and fade while new ones rise in (grid-stacked spans, transform/opacity).
   Extract the digit-diff logic as a pure helper if it exceeds ~10 lines and
   unit-test it.
3. **Panel crossfade.** Apply the existing `context-fade-in` treatment
   consistently to conversation/route panel content mounts (ChatView,
   ChannelView, activity, catch-up home) — 120ms fade + 2px rise. No
   experimental view-transition flags.
4. **Landing page (`src/app/page.tsx`).** Staggered hero fade-up on load
   (tokens + `motion-fade-up`, `animation-delay` steps), feature cards reveal
   on scroll (single `IntersectionObserver` hook + CSS class, unobserve after
   reveal), screenshot tilt on hover (`perspective` + `rotateX/Y` ≤ 4deg,
   transform-only). SSR-safe: no observer references during render; cards are
   visible (no-JS fallback) if the observer never fires.

## Verification

- `npm test` green (new: celebrate detector, badge-digit helper); `npm run build` green.
- Drive demo mode (`/demo` routes — no sign-in needed) with the dev server and
  screenshot: confetti on "🎉🎉", send spring, picker stagger, sidebar hover,
  landing reveals. Reduced-motion spot-check via emulation.
- Each phase is an independently green commit; ships as one PR (phases
  reviewable per-commit) unless a phase turns risky, then it splits out.

## Non-goals

- Sounds, haptics, message-send "power mode" screen shake.
- Always-on ambient wiggle/bounce (rejected: "full expressive" tier).
- Next.js View Transitions flag, framer-motion, canvas-confetti.
- Radius/shadow visual redesign — tokens map current values 1:1.
