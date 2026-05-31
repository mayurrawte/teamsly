# UI Bug Fixes — Cursor, Emoji, Video Call, Activity Fetch

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix four independent UI/UX regressions: missing pointer cursor on interactive elements, emoji characters not rendering, video call deeplink not working for non-email members, and activity hub not auto-fetching scan data on the "All" tab.

**Architecture:** All fixes are self-contained. No new files are needed. The emoji and cursor fixes are single-file CSS changes. The video call fix is a one-function change in `src/lib/utils/teams-deeplink.ts`. The activity fix extends the existing `useEffect` logic in `src/app/app/activity/page.tsx` to trigger the scan on "All" tab as well.

**Tech Stack:** Next.js 15 App Router, TypeScript, Tailwind CSS v4, Radix UI, Microsoft Graph client SDK

---

## Critical context before you start

- **`npm run build` is the only correct gate.** `npx tsc --noEmit` misses ESLint `react-hooks/rules-of-hooks` and Next page-export errors. Run `npm run build` after every task.
- The project root is `/Users/mayurrawte/thepsygeek/teamsly`.
- **No `Co-Authored-By:` trailers.** All commits are authored by the human committer only.
- Commit message style: `fix(scope): imperative verb + what` (Conventional Commit prefix, present tense, max 72 chars subject, body explains *why*).

---

## Task 1 — Fix hover cursor on buttons and interactive elements

**Root cause:** Browsers do not apply `cursor: pointer` to `<button>` elements by default. Tailwind v4's preflight does not set it either. Every interactive element in the app requires the cursor to change to a pointer on hover, but none of the many `<button>` elements across the codebase have it.

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add a global cursor rule to globals.css**

  Open `src/app/globals.css`. After the `@theme { ... }` block and before the `:root { ... }` block, add:

  ```css
  /* ─── Global interactive element cursors ─────────────────────────────── */
  button,
  [role="button"],
  label[for],
  select {
    cursor: pointer;
  }

  button:disabled,
  [role="button"][aria-disabled="true"] {
    cursor: not-allowed;
  }
  ```

  The existing file starts with:
  ```css
  @import "tailwindcss";

  @theme {
    --font-family-sans: var(--font-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  /* ─── Base design tokens (dark — app ships dark-first) ──────────────────── */
  :root {
  ```

  Insert the new block so the file reads:
  ```css
  @import "tailwindcss";

  @theme {
    --font-family-sans: var(--font-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  /* ─── Global interactive element cursors ─────────────────────────────── */
  button,
  [role="button"],
  label[for],
  select {
    cursor: pointer;
  }

  button:disabled,
  [role="button"][aria-disabled="true"] {
    cursor: not-allowed;
  }

  /* ─── Base design tokens (dark — app ships dark-first) ──────────────────── */
  :root {
  ```

- [ ] **Step 2: Build to verify no errors**

  ```bash
  npm run build 2>&1 | tail -20
  ```

  Expected: build succeeds, no new errors.

- [ ] **Step 3: Commit**

  ```bash
  git add src/app/globals.css
  git commit -m "fix(ui): apply pointer cursor globally to all button elements

  Browsers and Tailwind v4 preflight do not set cursor: pointer on
  <button> by default, leaving every interactive element with the text
  cursor. A single CSS rule covers every button and role=button in the
  app without touching individual components."
  ```

---

## Task 2 — Fix emoji characters not rendering

**Root cause:** `src/app/globals.css` sets `--font-family-sans` without any emoji font in the fallback chain. On Linux (without Noto Color Emoji) and on some Windows configurations, this causes emoji codepoints (👍 ❤️ 😂 etc.) to render as empty boxes or missing glyphs. Adding explicit emoji font fallbacks ensures the OS emoji font is used for emoji codepoints on all platforms.

The emojis are defined correctly in `src/lib/utils/reactions.ts` as Unicode characters (`"👍"`, `"❤️"`, `"😂"`, `"😮"`, `"😢"`, `"😡"`). They render correctly in `ReactionPill` via `reactionEmoji(type)` and in `EmojiPicker` via `{REACTION_EMOJI[type]}`. Only the font stack is missing the emoji fallback.

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add emoji font fallbacks to the font-family-sans variable**

  In `src/app/globals.css`, find the `@theme` block:
  ```css
  @theme {
    --font-family-sans: var(--font-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  ```

  Replace it with:
  ```css
  @theme {
    --font-family-sans: var(--font-sans), -apple-system, BlinkMacSystemFont, "Segoe UI",
      "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif;
  }
  ```

  `"Apple Color Emoji"` covers macOS/iOS. `"Segoe UI Emoji"` covers Windows. `"Noto Color Emoji"` covers Linux and Android.

- [ ] **Step 2: Build to verify no errors**

  ```bash
  npm run build 2>&1 | tail -20
  ```

  Expected: build succeeds, no new errors.

- [ ] **Step 3: Commit**

  ```bash
  git add src/app/globals.css
  git commit -m "fix(ui): add emoji font fallbacks to prevent blank emoji glyphs

  Without explicit emoji font fallbacks in the CSS font stack, emoji
  characters (used in reaction pills, emoji picker, and message
  content) render as empty boxes on Linux and some Windows configs.
  Adding Apple Color Emoji / Segoe UI Emoji / Noto Color Emoji as
  fallbacks restores correct rendering on all platforms."
  ```

---

## Task 3 — Fix video call deeplink for members without email

**Root cause:** When a DM chat member has no `email` field in Graph's response (common for guest users and sometimes for AAD members depending on the tenant configuration), `callIdentifiers` falls back to `userId` — a bare AAD GUID like `3b6c3d4e-1234-5678-abcd-ef1234567890`. The Teams `l/call` deeplink's `users=` parameter accepts UPN (email) or an MRI string; bare AAD GUIDs are interpreted as MRI only when prefixed with `8:orgid:`. Without this prefix, the deeplink either silently opens the Teams app with no pre-populated recipient or shows an error.

**Files:**
- Modify: `src/lib/utils/teams-deeplink.ts`

- [ ] **Step 1: Add a UUID-detection helper and update buildCallDeeplink**

  Current `src/lib/utils/teams-deeplink.ts`:
  ```ts
  // learn.microsoft.com/en-us/microsoftteams/platform/concepts/build-and-test/deep-links
  const CALL_BASE = "https://teams.microsoft.com/l/call/0/0";
  const MEETING_NEW_BASE = "https://teams.microsoft.com/l/meeting/new";

  export function buildCallDeeplink(
    identifiers: string[],
    opts?: { withVideo?: boolean }
  ): string | null {
    const filtered = identifiers.filter(Boolean);
    if (filtered.length === 0) return null;

    const users = filtered.map(encodeURIComponent).join(",");
    const url = new URL(CALL_BASE);
    url.searchParams.set("users", users);
    if (opts?.withVideo) url.searchParams.set("withVideo", "true");
    return url.toString();
  }
  ```

  Replace with:
  ```ts
  // learn.microsoft.com/en-us/microsoftteams/platform/concepts/build-and-test/deep-links
  const CALL_BASE = "https://teams.microsoft.com/l/call/0/0";
  const MEETING_NEW_BASE = "https://teams.microsoft.com/l/meeting/new";

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  /**
   * Teams deeplinks accept UPN (email) or MRI. Bare AAD GUIDs need the
   * `8:orgid:` prefix to be interpreted as MRI; without it the Teams client
   * ignores the users= param.
   */
  function toTeamsIdentifier(id: string): string {
    return UUID_RE.test(id) ? `8:orgid:${id}` : id;
  }

  export function buildCallDeeplink(
    identifiers: string[],
    opts?: { withVideo?: boolean }
  ): string | null {
    const filtered = identifiers.filter(Boolean);
    if (filtered.length === 0) return null;

    const users = filtered.map(toTeamsIdentifier).map(encodeURIComponent).join(",");
    const url = new URL(CALL_BASE);
    url.searchParams.set("users", users);
    if (opts?.withVideo) url.searchParams.set("withVideo", "true");
    return url.toString();
  }
  ```

  The rest of the file (`openTeamsCall`, `openTeamsChannelMeeting`) stays unchanged.

- [ ] **Step 2: Build to verify no errors**

  ```bash
  npm run build 2>&1 | tail -20
  ```

  Expected: build succeeds, no new errors.

- [ ] **Step 3: Commit**

  ```bash
  git add src/lib/utils/teams-deeplink.ts
  git commit -m "fix(calling): prefix bare AAD GUIDs with 8:orgid: in call deeplinks

  Teams' l/call deeplink requires MRI format for AAD object IDs.
  Without the 8:orgid: prefix a bare GUID is silently ignored,
  leaving the call recipient field empty. Email/UPN values pass
  through unchanged since they're already valid identifiers."
  ```

---

## Task 4 — Fix activity hub not fetching scan data on "All" tab

**Root cause:** `SCAN_TABS = ["mentions", "threads", "reactions"]`. The `useEffect` that calls `/api/activity/scan` only fires when `isScanTab` is true — i.e. when the user is on Mentions, Threads, or Reactions tab. The "All" tab is not in `SCAN_TABS`, so if the user opens the activity page and stays on "All", the scan never runs. The "All" tab only renders store-driven unread items (DMs + channels with `unreadCounts > 0`). Users with no current unreads see an empty "All" tab even though they may have mentions or reactions in their history.

**Fix:** Include "all" in the set of tabs that trigger the scan. Merge `scanData` results into `visibleItems` when on the "All" tab, so mentions/threads/reactions also show there.

**Files:**
- Modify: `src/app/app/activity/page.tsx`

- [ ] **Step 1: Add "all" to SCAN_TABS**

  Find this line in `src/app/app/activity/page.tsx`:
  ```ts
  const SCAN_TABS: ActivityTab[] = ["mentions", "threads", "reactions"];
  ```

  Replace with:
  ```ts
  const SCAN_TABS: ActivityTab[] = ["all", "mentions", "threads", "reactions"];
  ```

- [ ] **Step 2: Merge scan results into the "All" tab visible items**

  Find the block that builds `visibleItems` (look for `let visibleItems: ActivityItem[] = [];`):

  ```ts
  let visibleItems: ActivityItem[] = [];
  if (activeTab === "all") visibleItems = allItems;
  else if (activeTab === "dms") visibleItems = dmItems;
  else if (activeTab === "mentions") visibleItems = scanData?.mentions ?? [];
  else if (activeTab === "threads") visibleItems = scanData?.threads ?? [];
  else if (activeTab === "reactions") visibleItems = scanData?.reactions ?? [];
  ```

  Replace with:
  ```ts
  let visibleItems: ActivityItem[] = [];
  if (activeTab === "all") {
    // Merge store-driven unreads with scan results, sort newest first.
    const scanItems: ActivityItem[] = [
      ...(scanData?.mentions ?? []),
      ...(scanData?.threads ?? []),
      ...(scanData?.reactions ?? []),
    ];
    const merged = [...allItems, ...scanItems];
    // Dedupe by id (store items use dm-/ch- prefix; scan items use mention-/thread-/reaction-)
    const seen = new Set<string>();
    visibleItems = merged.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
    visibleItems.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  } else if (activeTab === "dms") {
    visibleItems = dmItems;
  } else if (activeTab === "mentions") {
    visibleItems = scanData?.mentions ?? [];
  } else if (activeTab === "threads") {
    visibleItems = scanData?.threads ?? [];
  } else if (activeTab === "reactions") {
    visibleItems = scanData?.reactions ?? [];
  }
  ```

- [ ] **Step 3: Show skeleton on "All" tab while scan is loading**

  Find:
  ```ts
  const showSkeleton = isScanTab && scanLoading && !scanLoadedRef.current;
  ```

  This already covers "all" now that "all" is in `SCAN_TABS`, so no change needed here.

- [ ] **Step 4: Build to verify no errors**

  ```bash
  npm run build 2>&1 | tail -20
  ```

  Expected: build succeeds, no new errors or type errors.

- [ ] **Step 5: Commit**

  ```bash
  git add src/app/app/activity/page.tsx
  git commit -m "fix(activity): fetch scan data on All tab and merge with unread items

  The activity scan (mentions/threads/reactions) was only triggered
  when the user explicitly switched to one of those tabs. Users on
  the default All tab saw only store-driven unreads and never got
  their mention/thread/reaction history. Adding all to SCAN_TABS
  fires the fetch immediately on page open. The All feed now merges
  store unreads with scan results, deduped and sorted newest first."
  ```

---

## Final verification

- [ ] Run `npm run build` one more time from the project root and confirm it exits clean.
- [ ] Confirm all 4 commits are on the branch with `git log --oneline -8`.
