# Motion Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the approved motion pass — token foundation plus playful-but-earned microinteractions (celebration confetti, send spring, picker stagger, sidebar/badge polish, landing reveals).

**Architecture:** All motion is CSS-first on the existing token system in `src/app/globals.css` (Tailwind 4 `@theme`). New JS is limited to: one pure detector (`celebrate.ts`), one overlay component (`CelebrationBurst`), one preference flag, one IntersectionObserver hook, and a digit-roll badge span. Spec: `docs/superpowers/specs/2026-07-14-motion-pass-design.md` — read it first.

**Tech Stack:** Next 16 / React / Tailwind 4 (`@theme` CSS tokens) / zustand / vitest.

## Global Constraints

- Zero new npm dependencies.
- transform/opacity only; no new continuous animations.
- Every new effect inside `@media (prefers-reduced-motion: no-preference)` OR driven by the tokens that zero under reduced motion.
- Brand palette only — never introduce `#1164a3 #4a154b #3f0e40 #350d36 #611f69` or other Slack-palette hexes (BRAND.md).
- No experimental Next.js flags.
- No commit trailers mentioning AI/agents. Conventional Commits, imperative subject.
- `npm test` and `npm run build` must pass at the end of every task.
- Do not change component behavior — additive polish only.

---

### Task 1: Motion/radius/shadow tokens

**Files:**
- Modify: `src/app/globals.css` (the `@theme` block at top; the `:root` token block near line 100; the reduced-motion block near line 125)

**Interfaces:**
- Produces: CSS vars `--ease-bounce`, `--motion-slower`, `--radius-sm/md/lg/xl`, `--shadow-raised/overlay/popover` for later tasks.

- [ ] **Step 1: Add easing + duration tokens**

In the `:root` block that currently holds `--ease-snap/spring/out-soft` and `--motion-fast/base/slow`, add:

```css
  --ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);  /* earned-playful overshoot */
  --motion-slower: 480ms;                              /* celebration-scale effects */
```

In the `@media (prefers-reduced-motion: reduce)` block where `--motion-fast/base/slow` zero out, add `--motion-slower: 0ms;`.

- [ ] **Step 2: Add radius + shadow tokens to `@theme`**

Inside the existing `@theme` block:

```css
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-xl: 12px;
  --shadow-raised: 0 1px 3px rgba(0, 0, 0, 0.3);
  --shadow-overlay: -4px 0 16px rgba(0, 0, 0, 0.3);
  --shadow-popover: 0 4px 16px rgba(0, 0, 0, 0.4);
```

(Tailwind 4 maps `--radius-*`/`--shadow-*` theme vars onto `rounded-*`/`shadow-*` utilities; existing class usage keeps working. Before committing, grep two sample components using `rounded-md` and confirm rendering is unchanged by running the build.)

- [ ] **Step 3: Retarget the existing bounce curves**

`slash-fx-pop` uses `cubic-bezier(0.34, 1.56, 0.64, 1)` inline — replace with `var(--ease-bounce)`. Also swap the raw curves in `.react-burst` (`cubic-bezier(0.2, 0.8, 0.2, 1)`) and `.slash-menu-in` only if identical to an existing token; if not identical, leave and note in the PR body.

- [ ] **Step 4: Verify + commit**

Run: `npm test` → all pass; `npm run build` → clean.

```bash
git add src/app/globals.css
git commit -m "feat(ui): add bounce/slower motion tokens and radius/shadow theme tokens"
```

### Task 2: Hardcoded motion sweep

**Files:**
- Modify: components under `src/components/**` and `src/app/**` that hardcode durations (`duration-150`, `duration-[80ms]`, `duration-[120ms]`, etc.) or inline easings.

**Interfaces:**
- Consumes: tokens from Task 1.

- [ ] **Step 1: Inventory**

Run: `grep -rn "duration-\[\|duration-75\|duration-100\|duration-150\|duration-200\|duration-300\|cubic-bezier" src/components src/app --include='*.tsx' | grep -v node_modules`

- [ ] **Step 2: Apply the snap rule**

For each hit: if the value is within 40ms of a token (fast=120, base=200, slow=320, slower=480), replace with the token via Tailwind arbitrary value, e.g. `duration-150` → `duration-[var(--motion-fast)]`, `duration-200` → `duration-[var(--motion-base)]`. `duration-[80ms]` → `duration-[var(--motion-fast)]`. Inline `cubic-bezier` in tsx `style`/classes → the matching `var(--ease-*)`. Anything not within 40ms of a token: leave it, list it in the commit body.

- [ ] **Step 3: Verify + commit**

Run: `npm test` and `npm run build` → green. Visually spot-check one hover (sidebar item) and one modal open in demo mode if the dev server is available; otherwise rely on build.

```bash
git add -A
git commit -m "refactor(ui): route hardcoded animation durations/easings through motion tokens"
```

### Task 3: Celebration confetti

**Files:**
- Create: `src/lib/utils/celebrate.ts`
- Create: `src/lib/utils/celebrate.test.ts`
- Create: `src/components/messages/CelebrationBurst.tsx`
- Modify: `src/store/preferences.ts` (add `celebrationEffects: boolean`, default `true`, + setter, persisted like siblings)
- Modify: `src/components/modals/PreferencesModal.tsx` (Notifications panel: toggle "Celebration effects" — hint: "Confetti when a message is pure celebration (🎉)")
- Modify: `src/components/messages/MessageFeed.tsx` (render overlay + fire on qualifying messages)
- Modify: `src/app/globals.css` (confetti keyframes)

**Interfaces:**
- Produces: `isCelebrationMessage(text: string): boolean`; `<CelebrationBurst playKey={string} />` — plays once per distinct non-empty `playKey`.

- [ ] **Step 1: Write the failing detector test** (`src/lib/utils/celebrate.test.ts`)

```ts
import { describe, expect, it } from "vitest";
import { isCelebrationMessage } from "./celebrate";

describe("isCelebrationMessage", () => {
  it("accepts pure celebration emoji", () => {
    expect(isCelebrationMessage("🎉")).toBe(true);
    expect(isCelebrationMessage("🎉🎉🎉")).toBe(true);
    expect(isCelebrationMessage("🎊 🥳")).toBe(true);
    expect(isCelebrationMessage("🥳🚀")).toBe(true); // other emoji allowed alongside a trigger
  });
  it("rejects text, mixed content, missing trigger, and empties", () => {
    expect(isCelebrationMessage("party at 🎉 9")).toBe(false);
    expect(isCelebrationMessage("congrats!")).toBe(false);
    expect(isCelebrationMessage("🚀🚀")).toBe(false); // emoji but no celebration trigger
    expect(isCelebrationMessage("")).toBe(false);
    expect(isCelebrationMessage("<p>🎉</p>")).toBe(true); // html-wrapped still counts
    expect(isCelebrationMessage("🎉".repeat(40))).toBe(false); // > 32 chars after strip
  });
});
```

- [ ] **Step 2: Run it, expect module-missing failure**

Run: `npx vitest run src/lib/utils/celebrate.test.ts` → FAIL (cannot resolve `./celebrate`).

- [ ] **Step 3: Implement the detector** (`src/lib/utils/celebrate.ts`)

```ts
/** Celebration detector (#72 motion pass): a message that is nothing but
 * emoji, at least one of which is a celebration trigger, earns confetti. */
const TRIGGERS = ["\u{1F389}", "\u{1F38A}", "\u{1F973}"]; // 🎉 🎊 🥳
const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}|\p{Emoji_Component}|‍|️|\s)+$/u;

export function isCelebrationMessage(raw: string): boolean {
  const text = raw.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
  if (!text || text.length > 32) return false;
  if (!TRIGGERS.some((t) => text.includes(t))) return false;
  return EMOJI_ONLY.test(text);
}
```

- [ ] **Step 4: Run tests, expect pass; commit**

```bash
git add src/lib/utils/celebrate.ts src/lib/utils/celebrate.test.ts
git commit -m "feat(chat): celebration-message detector"
```

- [ ] **Step 5: Keyframes + component**

`globals.css`, inside `@media (prefers-reduced-motion: no-preference)`:

```css
  @keyframes confetti-fall {
    0%   { transform: translate3d(0, 0, 0) rotate(0deg) scale(1); opacity: 1; }
    100% { transform: translate3d(var(--cf-x), var(--cf-y), 0) rotate(var(--cf-r)) scale(0.6); opacity: 0; }
  }
  .confetti-particle { animation: confetti-fall var(--motion-slower) var(--ease-out-soft) forwards; }
```

`CelebrationBurst.tsx` — client component; on `playKey` change (non-empty, unseen this mount) renders 24 absolutely-positioned spans in a `pointer-events-none absolute inset-0 overflow-hidden z-10` wrapper anchored to the feed; each span gets inline CSS vars derived from its index (deterministic, no `Math.random`): `--cf-x: ${(i % 8 - 3.5) * 28}px`, `--cf-y: ${120 + (i % 5) * 40}px`, `--cf-r: ${(i % 2 ? 1 : -1) * (180 + i * 20)}deg`, a 6×10px rounded rectangle, color cycling through `var(--accent)`, `#f0b429`, `#57bb8a`, `#cd5b45`, `#818CF8` (existing app hues); wrapper unmounts via `onAnimationEnd` counting to 24 or a `setTimeout(600)` fallback. Also bail out (render nothing) when `usePreferencesStore.celebrationEffects` is false.

- [ ] **Step 6: Wire into MessageFeed**

In `MessageFeed.tsx`: track `celebrateKey` state; in the effect that already watches `messages` for arrival detection, when the newest message `isCelebrationMessage(bodyText)` AND its id hasn't been seen in a module-level `Set` (seed the Set with all current ids on first run so history never fires), set `celebrateKey` to the message id. Render `<CelebrationBurst playKey={celebrateKey} />` inside the scroll container. This covers own sends (optimistic append) and incoming messages in the open conversation with one code path. Use `messagePlainText` from `@/lib/utils/render-message` to get body text.

- [ ] **Step 7: Preference toggle**

`preferences.ts`: add `celebrationEffects: true` + `setCelebrationEffects` following the exact pattern of an existing boolean pref (e.g. `desktopNotifications`), including persistence partialize if present. `PreferencesModal.tsx` Notifications panel: copy an existing Toggle row.

- [ ] **Step 8: Verify + commit**

Run: `npm test`, `npm run build` → green. Dev server: open `/demo`, send `🎉🎉` in a demo chat → confetti plays once; send plain text → nothing; toggle pref off → nothing.

```bash
git add -A
git commit -m "feat(chat): confetti burst for pure-celebration messages"
```

### Task 4: Send feel + emoji picker play

**Files:**
- Modify: `src/app/globals.css` (`message-in` keyframe, picker stagger classes)
- Modify: `src/components/messages/MessageItem.tsx` or `MessageFeed.tsx` (wherever `message-in` is applied — grep first; apply only to `__pending` messages)
- Modify: `src/components/messages/MessageInput.tsx` (send button press)
- Modify: `src/components/messages/EmojiPicker.tsx` (hover pop + stagger)

**Interfaces:**
- Consumes: `--ease-spring`, `--motion-fast/base` from Task 1.

- [ ] **Step 1: Upgrade `message-in`**

```css
  @keyframes message-in {
    from { opacity: 0; transform: translateY(8px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  .message-in { animation: message-in var(--motion-base) var(--ease-spring) both; }
```

Grep `message-in` usage. Ensure the class lands ONLY on rows whose message has `__pending` (own optimistic sends); if it's currently applied more broadly, narrow it: `className={cn(..., message.__pending && "message-in")}`.

- [ ] **Step 2: Send button micro-press**

On the send button in `MessageInput.tsx` add `active:scale-90 transition-transform duration-[var(--motion-fast)] ease-[var(--ease-snap)]` (keep existing classes).

- [ ] **Step 3: Picker hover pop + stagger**

Emoji entry buttons: add `transition-transform duration-[var(--motion-fast)] hover:scale-125 focus-visible:scale-125` (transform-only). Picker open: on the grid wrapper's children add `style={{ animationDelay: `${Math.min(index, 20) * 12}ms` }}` with class `motion-fade-up` (existing keyframe) — only if entries are rendered from a mapped array with an index available; if the grid is one static block, apply `motion-fade-up` to category sections instead.

- [ ] **Step 4: Verify + commit**

Run: `npm test`, `npm run build`. Demo mode: send a message → it springs up once and does not re-animate on poll; open emoji picker → gentle stagger; hover an emoji → pop.

```bash
git add -A
git commit -m "feat(chat): send spring, button press, emoji picker stagger"
```

### Task 5: Sidebar spring + unread badge roll + panel crossfade

**Files:**
- Modify: `src/components/sidebar/Sidebar.tsx` (item transitions; badge at ~line 946)
- Create: `src/components/ui/RollingNumber.tsx`
- Create: `src/components/ui/RollingNumber.test.tsx` — only if a pure digit-diff helper is extracted; otherwise skip the test file
- Modify: `src/app/globals.css` (roll keyframes)
- Modify: `src/components/messages/ChatView.tsx`, `ChannelView.tsx`, `src/app/workspace/activity/page.tsx`, catch-up home component (consistent `context-fade-in` on panel mount — grep `context-fade-in` for the existing pattern)

**Interfaces:**
- Produces: `<RollingNumber value={number} />` — renders the number; animates digit change.

- [ ] **Step 1: Sidebar item spring**

Nav item rows: ensure hover/active background + transform transitions use `transition-[background-color,transform] duration-[var(--motion-base)] ease-[var(--ease-spring)]`; add `active:scale-[0.98]` press. No structural refactor: skip the shared indicator pill unless the active item already has an absolutely-positioned sibling to animate.

- [ ] **Step 2: RollingNumber**

```tsx
"use client";
import { useEffect, useRef, useState } from "react";

/** Odometer-lite: when `value` changes, old number slides up+fades, new slides in. */
export function RollingNumber({ value }: { value: number }) {
  const prev = useRef(value);
  const [anim, setAnim] = useState(false);
  useEffect(() => {
    if (prev.current !== value) {
      prev.current = value;
      setAnim(true);
      const t = setTimeout(() => setAnim(false), 240);
      return () => clearTimeout(t);
    }
  }, [value]);
  return (
    <span className="relative inline-block overflow-hidden tabular-nums">
      <span key={value} className={anim ? "roll-in inline-block" : "inline-block"}>{value}</span>
    </span>
  );
}
```

```css
  @keyframes roll-in {
    from { transform: translateY(0.7em); opacity: 0; }
    to   { transform: translateY(0); opacity: 1; }
  }
  .roll-in { animation: roll-in var(--motion-base) var(--ease-spring) both; }
```

Swap the badge count text at `Sidebar.tsx:946` (the `rounded-full bg-[var(--badge-unread)]` span) to render `<RollingNumber value={count} />` where `count` is whatever expression currently renders (check for the `99+` cap case: if the rendered value is a string, keep the plain string for non-numeric and only roll numerics).

- [ ] **Step 3: Panel crossfade**

Grep `context-fade-in`. Apply the same class to the top-level content wrapper of ChatView, ChannelView, activity page, and the catch-up home component, keyed so it re-runs on conversation change (e.g. `key={contextId}` on the wrapper if not already present — check render cost first; if a view already remounts per conversation, the class alone suffices).

- [ ] **Step 4: Verify + commit**

Run: `npm test`, `npm run build`. Demo mode: switch channels → content fades in; badge count changes → digits roll (trigger by sending demo messages).

```bash
git add -A
git commit -m "feat(ui): sidebar spring, rolling unread badges, consistent panel crossfade"
```

### Task 6: Landing page first impressions

**Files:**
- Create: `src/hooks/useRevealOnScroll.ts`
- Modify: `src/app/page.tsx` (hero stagger, feature-card reveal, screenshot tilt)
- Modify: `src/app/globals.css` (reveal + tilt styles)

**Interfaces:**
- Produces: `useRevealOnScroll(): { ref, revealed }` — attach `ref` to a container; `revealed` flips true when ≥15% visible, once.

- [ ] **Step 1: The hook**

```ts
"use client";
import { useEffect, useRef, useState } from "react";

export function useRevealOnScroll<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") { setRevealed(true); return; }
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setRevealed(true); io.disconnect(); } },
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { ref, revealed };
}
```

- [ ] **Step 2: CSS**

```css
.reveal-on-scroll { opacity: 0; transform: translateY(12px); }
.reveal-on-scroll.revealed {
  opacity: 1; transform: translateY(0);
  transition: opacity var(--motion-slow) var(--ease-out-soft), transform var(--motion-slow) var(--ease-spring);
}
@media (prefers-reduced-motion: reduce) {
  .reveal-on-scroll { opacity: 1; transform: none; }
}
@media (prefers-reduced-motion: no-preference) {
  .tilt-on-hover { transition: transform var(--motion-base) var(--ease-spring); transform: perspective(900px); }
  .tilt-on-hover:hover { transform: perspective(900px) rotateX(2deg) rotateY(-3deg) scale(1.01); }
}
```

- [ ] **Step 3: Apply on the landing page**

`src/app/page.tsx` is a server component with client children — check first (grep `"use client"`). Hero: add `motion-fade-up` with `animationDelay` steps (0/60/120/180ms) to headline, subhead, CTA row, hero image. Feature-card sections: wrap in a small client component using `useRevealOnScroll` (`reveal-on-scroll` + conditional `revealed`). Screenshot/hero image: `tilt-on-hover`. If `page.tsx` must stay a server page, put the reveal logic in a `LandingReveal` client wrapper component created alongside (`src/components/landing/LandingReveal.tsx` — Create it in that case).

- [ ] **Step 4: Verify + commit**

Run: `npm test`, `npm run build`. Dev server: load `/` logged out — hero staggers in, cards reveal on scroll, screenshot tilts on hover; with reduced-motion emulated, everything is visible statically.

```bash
git add -A
git commit -m "feat(landing): hero stagger, scroll reveals, screenshot tilt"
```
