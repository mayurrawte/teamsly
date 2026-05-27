# Disappearing Messages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a DM sender mark a message as ephemeral — it renders as an opaque blob in native Teams, shows a countdown in Teamsly, and the sender's own client auto-deletes it from Graph when the timer expires.

**Architecture:** The composer wraps `{ body, disappearAt }` into an AES-GCM blob keyed by `SHA-256(contextId + ":teamsly")`, sent as the message content via the existing chat-send path. Teamsly detects the `[TEAMSLY_E:…]` prefix on render, unwraps it, and renders the decoded body through the existing safe `renderMessageBody` parser. Expiry is swept on the existing 4s (active DM) and 15s (sidebar) polls — no new intervals. This is cloaking, not encryption: the key derives from the non-secret `contextId`.

**Tech Stack:** Next.js (App Router), React, Zustand, Web Crypto (`crypto.subtle`), Microsoft Graph. No test framework exists in this repo — verification is `npm run build` + an ad-hoc `npx tsx` sanity check + manual browser testing, per `CLAUDE.md`.

**Important conventions (from `CLAUDE.md`):**
- Run `npm run build` before considering any change done (`tsc --noEmit` is insufficient — Next's build also enforces `react-hooks/rules-of-hooks` and page-export rules).
- No `Co-Authored-By` trailers on commits. Conventional Commit prefixes, imperative subject, body explains *why*.
- Never describe this feature as "encrypted"/"secure"/"private" in code or copy — it is "disappearing"/"auto-deletes".

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/lib/utils/disappear.ts` (new) | Pure crypto/codec: key derivation (cached), wrap, unwrap, prefix check, duration constants |
| `src/components/messages/MessageInput.tsx` (modify) | ⏱ duration picker in toolbar; pass chosen duration up via `SendOptions.disappearMs` |
| `src/components/messages/ChatView.tsx` (modify) | Wrap content + store optimistic plaintext on send; ungate 1s tick; expiry sweep in the 4s poll |
| `src/components/messages/MessageItem.tsx` (modify) | Unwrap disappearing content for render; countdown badge; "not available" placeholder |
| `src/lib/utils/render-message.tsx` (unchanged renderer) | Stays the safe renderer of record for decoded text — no edits needed |
| `src/components/sidebar/Sidebar.tsx` (modify) | App-wide own-message expiry sweep on the existing 15s chat poll |

---

## Task 1: Crypto/codec utility (`disappear.ts`)

**Files:**
- Create: `src/lib/utils/disappear.ts`
- Sanity check (ad-hoc, not committed as a test): `scripts/disappear-check.ts`

- [ ] **Step 1: Write the utility**

Create `src/lib/utils/disappear.ts`:

```ts
// Disappearing-message codec. NOT encryption: the key derives from the
// non-secret contextId, so anyone who knows the contextId and reads this
// code can recover the plaintext. Its only job is to keep the body from
// rendering as readable text in native Teams and to carry the expiry.

const PREFIX = "[TEAMSLY_E:";

export const DISAPPEAR_DURATIONS: { label: string; ms: number }[] = [
  { label: "30 seconds", ms: 30_000 },
  { label: "5 minutes", ms: 5 * 60_000 },
  { label: "1 hour", ms: 60 * 60_000 },
];

export interface DisappearPayload {
  body: string;
  disappearAt: number; // epoch ms
}

const keyCache = new Map<string, Promise<CryptoKey>>();

export function getContextKey(contextId: string): Promise<CryptoKey> {
  let cached = keyCache.get(contextId);
  if (cached) return cached;
  cached = (async () => {
    const material = new TextEncoder().encode(`${contextId}:teamsly`);
    const digest = await crypto.subtle.digest("SHA-256", material);
    return crypto.subtle.importKey("raw", digest, "AES-GCM", false, [
      "encrypt",
      "decrypt",
    ]);
  })();
  keyCache.set(contextId, cached);
  return cached;
}

export function isDisappearing(content: string): boolean {
  return content.startsWith(PREFIX);
}

function toB64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function wrapMessage(
  contextId: string,
  body: string,
  disappearAt: number
): Promise<string> {
  const key = await getContextKey(contextId);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(
    JSON.stringify({ body, disappearAt } satisfies DisappearPayload)
  );
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext)
  );
  return `${PREFIX}${toB64Url(iv)}:${toB64Url(ct)}]`;
}

export async function unwrapMessage(
  contextId: string,
  content: string
): Promise<DisappearPayload | null> {
  if (!isDisappearing(content)) return null;
  try {
    const inner = content.slice(PREFIX.length, -1); // strip "[TEAMSLY_E:" and trailing "]"
    const [ivPart, ctPart] = inner.split(":");
    if (!ivPart || !ctPart) return null;
    const key = await getContextKey(contextId);
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromB64Url(ivPart) },
      key,
      fromB64Url(ctPart)
    );
    const parsed = JSON.parse(new TextDecoder().decode(plain)) as DisappearPayload;
    if (typeof parsed.body !== "string" || typeof parsed.disappearAt !== "number")
      return null;
    return parsed;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Write an ad-hoc sanity-check script**

Create `scripts/disappear-check.ts` (Node 20+ exposes Web Crypto globally):

```ts
import { wrapMessage, unwrapMessage, isDisappearing } from "../src/lib/utils/disappear";

async function main() {
  const ctx = "19:abc_def@thread.v2";
  const wrapped = await wrapMessage(ctx, "secret <b>hi</b>", Date.now() + 30_000);
  console.assert(isDisappearing(wrapped), "should be detected as disappearing");
  console.assert(!wrapped.includes("secret"), "plaintext must not leak into the blob");

  const ok = await unwrapMessage(ctx, wrapped);
  console.assert(ok?.body === "secret <b>hi</b>", "round-trip body mismatch");

  const wrongCtx = await unwrapMessage("other-context", wrapped);
  console.assert(wrongCtx === null, "wrong context must fail closed (null)");

  const plain = await unwrapMessage(ctx, "just a normal message");
  console.assert(plain === null, "non-disappearing content returns null");

  console.log("disappear.ts sanity check passed");
}
main();
```

- [ ] **Step 3: Run the sanity check**

Run: `npx tsx scripts/disappear-check.ts`
Expected: prints `disappear.ts sanity check passed` with no assertion errors.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit 2>&1 | grep -v "src/lib/auth/config.ts"`
Expected: no errors referencing `disappear.ts`.

- [ ] **Step 5: Commit** (the script is a throwaway helper — keep it; it documents the contract)

```bash
git add src/lib/utils/disappear.ts scripts/disappear-check.ts
git commit -m "feat(messages): add disappearing-message codec util"
```

---

## Task 2: Decode + countdown badge in `MessageItem`

`MessageItem` already receives a `contextId` prop (`MessageItem.tsx:33,51`) and calls `renderMessageBody(message.body.content, message.body.contentType)` at two sites (`MessageItem.tsx:321` and `:396`). We unwrap once near the top of the component and feed decoded text through the *same* renderer.

**Files:**
- Modify: `src/components/messages/MessageItem.tsx`

- [ ] **Step 1: Add imports and decode state**

Near the existing import of `render-message` (`MessageItem.tsx:13`), add:

```ts
import { isDisappearing, unwrapMessage } from "@/lib/utils/disappear";
import { useEffect, useState } from "react"; // merge with existing react import
```

Inside the component body (after `contextId` is in scope), add:

```ts
const rawContent = message.body.content;
const disappearing = isDisappearing(rawContent);
const [decoded, setDecoded] = useState<{ body: string; disappearAt: number } | null>(null);
const [decodeFailed, setDecodeFailed] = useState(false);

useEffect(() => {
  if (!disappearing || !contextId) return;
  let cancelled = false;
  unwrapMessage(contextId, rawContent).then((res) => {
    if (cancelled) return;
    if (res) setDecoded(res);
    else setDecodeFailed(true);
  });
  return () => { cancelled = true; };
}, [disappearing, contextId, rawContent]);
```

- [ ] **Step 2: Add a countdown badge component (same file, above the `MessageItem` export)**

```tsx
function DisappearBadge({ disappearAt }: { disappearAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const remaining = Math.max(0, disappearAt - now);
  const secs = Math.ceil(remaining / 1000);
  const text = secs >= 3600 ? `${Math.ceil(secs / 3600)}h`
    : secs >= 60 ? `${Math.ceil(secs / 60)}m`
    : `${secs}s`;
  return (
    <span
      title="This message will disappear"
      className="ml-2 inline-flex items-center gap-1 rounded-full bg-[var(--bg-elevated,#2a2d31)] px-2 py-[1px] text-[11px] text-[var(--text-secondary,#ababad)]"
    >
      ⏱ {text}
    </span>
  );
}
```

- [ ] **Step 3: Swap the two render call sites to use decoded content**

At `MessageItem.tsx:321` and `:396`, replace:

```tsx
{renderMessageBody(message.body.content, message.body.contentType)}
```

with:

```tsx
{disappearing
  ? decoded
    ? renderMessageBody(decoded.body, "text")
    : decodeFailed
      ? <span className="italic text-[var(--text-secondary,#ababad)]">🕓 Message not available here</span>
      : <span className="italic text-[var(--text-secondary,#ababad)]">…</span>
  : renderMessageBody(message.body.content, message.body.contentType)}
```

Then, immediately after the decoded body in the **main** render site (`:396`), render the badge when a live timer exists:

```tsx
{disappearing && decoded && decoded.disappearAt > Date.now() && (
  <DisappearBadge disappearAt={decoded.disappearAt} />
)}
```

(Skip the badge at the edit-preview site `:321` — only the live message row needs it.)

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: build succeeds; no `react-hooks/rules-of-hooks` errors (the new `useState`/`useEffect` are at the top level of the component and the badge component, not inside conditionals).

- [ ] **Step 5: Commit**

```bash
git add src/components/messages/MessageItem.tsx
git commit -m "feat(messages): render disappearing bodies with countdown badge"
```

---

## Task 3: Composer duration picker + wrap on send

**Files:**
- Modify: `src/components/messages/MessageInput.tsx`
- Modify: `src/components/messages/ChatView.tsx`

- [ ] **Step 1: Extend `SendOptions`**

In `MessageInput.tsx:61`, change:

```ts
export interface SendOptions {
  mentions?: PendingMention[];
}
```

to:

```ts
export interface SendOptions {
  mentions?: PendingMention[];
  disappearMs?: number; // when set, parent wraps the content as a disappearing message
}
```

- [ ] **Step 2: Add picker state + button in the composer**

Inside `MessageInput`, add state:

```ts
import { DISAPPEAR_DURATIONS } from "@/lib/utils/disappear"; // top of file
// ...
const [disappearMs, setDisappearMs] = useState<number | null>(null);
const [showDisappearMenu, setShowDisappearMenu] = useState(false);
```

In the toolbar JSX (near the other trailing toolbar buttons, e.g. after the formatting buttons block around `MessageInput.tsx:1055`), add a button + popover:

```tsx
<div className="relative">
  <button
    type="button"
    aria-label="Disappearing message"
    onClick={() => setShowDisappearMenu((v) => !v)}
    className={`rounded p-1 text-[15px] transition-colors press-snap ${
      disappearMs ? "text-[var(--accent,#6366F1)]" : "text-[var(--text-secondary,#ababad)] hover:text-white"
    }`}
  >
    ⏱{disappearMs ? <span className="ml-[2px] text-[10px]">on</span> : null}
  </button>
  {showDisappearMenu && (
    <div className="absolute bottom-full z-50 mb-2 min-w-[160px] rounded-md border border-[var(--border,#3f4144)] bg-[var(--modal-bg,#222529)] py-1 shadow-lg">
      <button
        type="button"
        onClick={() => { setDisappearMs(null); setShowDisappearMenu(false); }}
        className={`block w-full px-3 py-1 text-left text-[13px] hover:bg-[var(--bg-hover,#2a2d31)] ${disappearMs === null ? "text-[var(--accent,#6366F1)]" : "text-[var(--text-primary,#d1d2d3)]"}`}
      >
        Off
      </button>
      {DISAPPEAR_DURATIONS.map((d) => (
        <button
          key={d.ms}
          type="button"
          onClick={() => { setDisappearMs(d.ms); setShowDisappearMenu(false); }}
          className={`block w-full px-3 py-1 text-left text-[13px] hover:bg-[var(--bg-hover,#2a2d31)] ${disappearMs === d.ms ? "text-[var(--accent,#6366F1)]" : "text-[var(--text-primary,#d1d2d3)]"}`}
        >
          {d.label}
        </button>
      ))}
    </div>
  )}
</div>
```

- [ ] **Step 3: Include `disappearMs` in the primary send call**

Find the main text-send `onSend(...)` call (`MessageInput.tsx:383`, the one that passes `{ mentions }`). Add `disappearMs` to its options object, and reset the picker after a successful send. Example shape:

```ts
await onSend(content, {
  ...(mentions.length ? { mentions } : {}),
  ...(disappearMs ? { disappearMs } : {}),
});
setDisappearMs(null);
```

Leave the image/slash/giphy `onSend` calls (`:399`, `:487`, `:568`) unchanged — disappearing applies to typed text only in v1.

- [ ] **Step 4: Wrap + optimistic-plaintext in `ChatView.handleSend`**

In `ChatView.tsx`, change the `handleSend` signature (`ChatView.tsx:160`) to read `disappearMs` and import the codec:

```ts
import { wrapMessage } from "@/lib/utils/disappear"; // top of file
```

Then update the body. The optimistic message keeps the **readable** wrapped form so the sender sees a countdown immediately; the wrapped blob is what goes to Graph:

```ts
async function handleSend(
  content: string,
  options?: { mentions?: { id: string; name: string }[]; disappearMs?: number }
) {
  const tempId = `temp-${crypto.randomUUID()}`;
  const now = new Date().toISOString();

  let outgoing = content;
  if (options?.disappearMs) {
    outgoing = await wrapMessage(chatId, content, Date.now() + options.disappearMs);
  }

  const optimistic: MSMessage = {
    id: tempId,
    createdDateTime: now,
    body: { contentType: options?.disappearMs ? "text" : "html",
            content: options?.disappearMs ? outgoing : textToHtml(content) },
    from: { user: { id: currentUserId, displayName: currentUserName } },
    reactions: [],
    attachments: [],
    __pending: true,
    __originalText: content,
  };
  appendPendingMessage(chatId, optimistic);

  try {
    const res = await fetch(`/api/chats/${chatId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: outgoing,
        ...(options?.mentions?.length ? { mentions: options.mentions } : {}),
      }),
    });
    if (!res.ok) throw new Error("Failed to send chat message");
    const serverMsg = (await res.json()) as MSMessage;
    replaceMessage(chatId, tempId, serverMsg);
  } catch {
    markMessageFailed(chatId, tempId);
    showToast({ title: "Could not send message", tone: "error" });
  }
}
```

Note: the optimistic blob is rendered by `MessageItem`'s unwrap path (Task 2), so the sender sees their own plaintext + badge. Mentions and disappearing are mutually exclusive in practice (a wrapped blob can't carry `<at>` markup) — when `disappearMs` is set, the server-side mention rewrite simply finds no plaintext to match, which is acceptable for v1.

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: success.

- [ ] **Step 6: Commit**

```bash
git add src/components/messages/MessageInput.tsx src/components/messages/ChatView.tsx
git commit -m "feat(messages): composer duration picker, wrap disappearing sends"
```

---

## Task 4: Expiry sweep in the active-DM poll + ungate the tick

The 4s poll lives at `ChatView.tsx:151` (`setInterval(load, 4000)`). After each `setMessages`, scan for the **current user's own** expired disappearing messages and delete them via the existing chat DELETE endpoint.

**Files:**
- Modify: `src/components/messages/ChatView.tsx`

- [ ] **Step 1: Add a sweep helper inside `ChatView`**

```ts
import { isDisappearing, unwrapMessage } from "@/lib/utils/disappear"; // top of file (merge with wrapMessage import)
```

Add a callback in the component:

```ts
const sweepExpired = useCallback(async (msgs: MSMessage[]) => {
  const now = Date.now();
  for (const m of msgs) {
    if (m.__pending || m.__failed) continue;
    if (m.from?.user?.id !== currentUserId) continue; // only delete our own (Graph 403s otherwise)
    if (!isDisappearing(m.body.content)) continue;
    const payload = await unwrapMessage(chatId, m.body.content);
    if (!payload || payload.disappearAt > now) continue;
    try {
      const res = await fetch(
        `/api/chats/${chatId}/messages/${encodeURIComponent(m.id)}`,
        { method: "DELETE" }
      );
      if (res.ok) removeMessage(chatId, m.id);
    } catch {
      /* best-effort; retried on next poll */
    }
  }
}, [chatId, currentUserId, removeMessage]);
```

(Confirm `removeMessage` is pulled from `useWorkspaceStore()` in this component's destructure at `ChatView.tsx:40`; add it if missing.)

- [ ] **Step 2: Call the sweep after each load**

In the `load()` function (`ChatView.tsx:136-147`), after `setMessages(chatId, sortByCreated(data))`:

```ts
const sorted = sortByCreated(data);
if (!cancelled) {
  setMessages(chatId, sorted);
  void sweepExpired(sorted);
}
```

Add `sweepExpired` to the effect's dependency array (`ChatView.tsx:158`).

- [ ] **Step 3: Ungate the 1s clock tick so receivers' badges count down without the typing indicator**

The 1s tick (`ChatView.tsx:51-55`) is gated on `typingEnabled`. Change the guard so it also runs when the visible messages include a live disappearing message. Simplest correct change — drop the early-return gate and always tick (1/s is negligible), keeping the typing-indicator logic as a consumer of `clockNow`:

```ts
useEffect(() => {
  const id = setInterval(() => setClockNow(Date.now()), 1000);
  return () => clearInterval(id);
}, []);
```

(The `DisappearBadge` in Task 2 has its own internal ticker, so this step only matters if you later move the badge to read `clockNow`. Keeping the always-on tick is harmless and future-proofs that. If you prefer minimal change, leave the badge's own ticker as the source of truth and skip this step.)

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: success; watch for `react-hooks/exhaustive-deps` warnings on the modified effect — add the documented `eslint-disable` line already present at `ChatView.tsx:157` if needed.

- [ ] **Step 5: Commit**

```bash
git add src/components/messages/ChatView.tsx
git commit -m "feat(messages): sweep own expired disappearing DMs on active poll"
```

---

## Task 5: App-wide sweep on the sidebar's 15s chat poll

So the sender's client cleans up DMs it is not currently viewing. The sidebar already polls chats every 15s (`Sidebar.tsx:117`). After it knows the chat list, sweep cached messages for each DM context.

**Files:**
- Modify: `src/components/sidebar/Sidebar.tsx`

- [ ] **Step 1: Add a sweep that reads the workspace store's cached messages**

At the top of `Sidebar.tsx`, import the codec and ensure access to the store's `getMessages`, `removeMessage`, `currentUserId`, and the chat list:

```ts
import { isDisappearing, unwrapMessage } from "@/lib/utils/disappear";
```

Add a sweep function (module-scope or inside the component) that iterates the cached DM contexts:

```ts
async function sweepAllDms(
  chatIds: string[],
  getMessages: (id: string) => MSMessage[],
  removeMessage: (ctx: string, id: string) => void,
  currentUserId: string
) {
  const now = Date.now();
  for (const chatId of chatIds) {
    for (const m of getMessages(chatId)) {
      if (m.__pending || m.__failed) continue;
      if (m.from?.user?.id !== currentUserId) continue;
      if (!isDisappearing(m.body.content)) continue;
      const payload = await unwrapMessage(chatId, m.body.content);
      if (!payload || payload.disappearAt > now) continue;
      try {
        const res = await fetch(
          `/api/chats/${chatId}/messages/${encodeURIComponent(m.id)}`,
          { method: "DELETE" }
        );
        if (res.ok) removeMessage(chatId, m.id);
      } catch {
        /* best-effort */
      }
    }
  }
}
```

- [ ] **Step 2: Invoke it from the existing 15s chat poll**

In the `loadChats` effect that owns `setInterval(loadChats, 15_000)` (`Sidebar.tsx:117`), after the chats are loaded, call:

```ts
void sweepAllDms(
  chats.map((c) => c.id),
  useWorkspaceStore.getState().getMessages,
  useWorkspaceStore.getState().removeMessage,
  useWorkspaceStore.getState().currentUserId
);
```

Use `useWorkspaceStore.getState()` (non-reactive) so the sweep does not re-trigger the effect. Confirm the exact store accessor names against `src/store/workspace.ts` and adjust if `getMessages`/`removeMessage`/`currentUserId` differ.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: success.

- [ ] **Step 4: Commit**

```bash
git add src/components/sidebar/Sidebar.tsx
git commit -m "feat(messages): app-wide sweep of expired disappearing DMs"
```

---

## Task 6: Manual end-to-end verification

No automated UI tests exist; verify in the browser per `CLAUDE.md`.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev` (serves `http://localhost:3000`).

- [ ] **Step 2: Send a 30s disappearing DM**

In a DM, click ⏱ → "30 seconds", type a message, send.
Expected: your message renders as plaintext with a `⏱ 30s` badge counting down.

- [ ] **Step 3: Confirm the blob in native Teams (or via Graph)**

Open the same chat in the real Teams web/desktop client (or `GET` the message via Graph Explorer).
Expected: the body shows `[TEAMSLY_E:…]`, not the plaintext.

- [ ] **Step 4: Confirm auto-delete**

Keep the DM open ~30–40s.
Expected: within one 4s poll after expiry, the message disappears from Teamsly and is deleted in Teams (refresh native client to confirm).

- [ ] **Step 5: Confirm the away-context sweep**

Send a 30s disappearing DM, then navigate to a different chat and stay there.
Expected: within ~15s of expiry the message is deleted (verify by returning to the DM or checking Teams).

- [ ] **Step 6: Confirm receiver behavior (if a second account is available)**

As the receiver, view the disappearing message.
Expected: renders decoded with a countdown; on expiry it disappears locally; the receiver's client does **not** attempt the DELETE (no 403 errors in console / network tab).

- [ ] **Step 7: Confirm "Off" path is unchanged**

Send a normal message with ⏱ Off.
Expected: sent as normal HTML, no badge, no blob, no deletion.

- [ ] **Step 8: Final build gate**

Run: `npm run build`
Expected: clean build.

---

## Self-Review Notes

- **Spec coverage:** codec/key (Task 1) ✓; composer picker + wrap (Task 3) ✓; render + countdown (Task 2) ✓; safe-renderer reuse via `renderMessageBody(body, "text")` (Task 2 Step 3) ✓; reuse of existing 4s/15s loops + ungated 1s tick, no new intervals (Tasks 4–5) ✓; sender-only delete authority / receiver hides locally (Task 4 Step 1, Task 6 Step 6) ✓; DM-only (no channel tasks) ✓; cloak-not-encrypt framing in code comments + copy (Task 1 header comment, "Message not available here" copy) ✓.
- **Accepted limitations carried from spec:** clock skew, search non-match, attachments unencrypted, edit/forward out of scope — none require a task in v1; called out in the spec.
- **Open implementation check (flagged in steps, not placeholders):** exact store accessor names in `src/store/workspace.ts` (`getMessages`/`removeMessage`/`currentUserId`) and the `textToHtml` marker-survival assumption (mitigated — disappearing sends use `contentType: "text"` and send the raw marker, bypassing `textToHtml`).
