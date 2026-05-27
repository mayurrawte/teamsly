# Disappearing Messages — Design

**Date:** 2026-05-27
**Scope:** Direct messages (chats) only. No channels in v1.
**Status:** Approved for planning.

## Goal

Let a sender mark a message as ephemeral. The message:

1. **Does not render as readable text in the native Microsoft Teams client** — it appears
   as an opaque app-specific blob there.
2. **Renders normally in Teamsly**, with a live countdown badge.
3. **Auto-deletes from Graph** once its timer expires, fired by the sender's own
   Teamsly client.

Durations offered to the sender: **Off / 30 seconds / 5 minutes / 1 hour**.

## Explicit non-goals / honest framing

This is **not encryption and not a security feature.** The wrapping exists only to keep
the content from rendering as plain text inside native Teams and to carry the expiry
timestamp. We must never describe it to users as "encrypted", "secure", or "private".

- The key is derived deterministically from the `contextId` (the chat ID), which is **not
  secret** — it is visible in URLs, the Graph API, and to everyone in the conversation.
- The derivation algorithm ships in the public client bundle.
- Therefore anyone who knows the `contextId` and reads our code can recover the plaintext.
- Anything written to Graph remains subject to the tenant's eDiscovery / retention. The
  blob is recoverable by anyone with the (non-secret) key. We treat this as **clutter
  reduction + best-effort auto-delete**, nothing more.

UI copy will say "disappearing message" / "auto-deletes in …", never "encrypted".

## How it works end-to-end

```
Sender types message, picks a duration (e.g. 5 min)
        |
        v
payload = { body: "<typed text>", disappearAt: <epoch ms> }
        |
        v
wrap(payload, key = SHA-256(contextId + ":teamsly"))   // AES-GCM, random IV
        |
        v
wire string:  [TEAMSLY_E:<base64 iv>:<base64 ciphertext>]
        |
        v
POST /api/chats/{chatId}/messages  (sent as the message content, exactly like text today)
        |
        v
Graph stores the blob.   Native Teams shows:  [TEAMSLY_E:a1b2…:x9y8…]
        |
        v
Teamsly fetch -> detect prefix -> unwrap -> render body + countdown badge
        |
        v
On a poll where disappearAt <= now AND the message is the current user's own:
        -> DELETE /api/chats/{chatId}/messages/{messageId}  (Graph hard delete)
        -> removeMessage(contextId, messageId) from the store
```

## Key derivation

```ts
key = SHA-256(contextId + ":teamsly")   // 256-bit raw AES-GCM key
```

- Deterministic — sender and every receiver derive the identical key from the shared
  `contextId`. No key exchange.
- Wrapped with **AES-GCM** and a fresh random 96-bit IV per message (IV stored in the wire
  string). GCM choice is for format hygiene, not secrecy (secrecy is impossible here — see
  non-goals).
- Derived `CryptoKey` is cached in-memory per `contextId` so we do not re-derive on every
  render or poll.

## Wire format

```
[TEAMSLY_E:<base64url iv>:<base64url ciphertext>]
```

- Plaintext is the message body the user typed (already plain text in the composer).
- Ciphertext decrypts to JSON: `{ "body": string, "disappearAt": number }`.
- The marker is sent as the message content. The existing send path converts content to
  HTML via `textToHtml`; the marker contains only `[`, `]`, `:`, alphanumerics, `-`, `_`,
  so it survives that conversion unmangled. (Verify in implementation; if `textToHtml`
  alters it, send the marker pre-escaped.)

## New module: `src/lib/utils/disappear.ts`

```ts
isDisappearing(content: string): boolean        // prefix check: starts with "[TEAMSLY_E:"
getContextKey(contextId: string): Promise<CryptoKey>   // SHA-256 -> CryptoKey, cached
wrapMessage(contextId, body, disappearAt): Promise<string>   // -> "[TEAMSLY_E:iv:ct]"
unwrapMessage(contextId, content): Promise<{ body: string; disappearAt: number } | null>
```

- Uses Web Crypto (`crypto.subtle`) — available in browser; no new dependency.
- `unwrapMessage` returns `null` on any failure (bad format, wrong context, decrypt error)
  so callers can fall back to showing the raw content rather than crashing.

## Composer changes — `MessageInput.tsx`

- Add a clock/timer button (`⏱`) to the composer toolbar.
- Clicking opens a small popover: **Off / 30s / 5min / 1hr** (single-select, default Off).
- When a non-Off duration is active, show a small badge on the send button so the sender
  knows the next message will disappear.
- On send with an active timer:
  - compute `disappearAt = Date.now() + durationMs`
  - `content = await wrapMessage(chatId, typedText, disappearAt)`
  - send `content` exactly as a normal message through the existing `handleSend` path.
- The optimistic message stored locally should keep the **plaintext + disappearAt** so the
  sender sees their own message immediately (do not show themselves the blob). Implement by
  having `handleSend` accept an optional `{ disappearAt }` and store the optimistic entry
  with the readable body, while sending the wrapped content to Graph.

## Render changes — `render-message.tsx` + `MessageItem.tsx`

- In the shared render path, before rendering: if `isDisappearing(content)`, call
  `unwrapMessage(contextId, content)`.
  - On success: render `renderMessageBody(payload.body, "text")` — **the same safe pipeline
    as a normal typed message.** This is the entire XSS story (see below).
  - On failure (`null`): render a muted placeholder like "🔒 Message not available here".
- **Countdown badge:** when a message has a live `disappearAt`, show `⏱ <remaining>` next
  to it (e.g. `⏱ 28s`, `⏱ 4m`). The badge reads a 1-second `clockNow` tick.

### Where `contextId` comes from at render time

`renderMessageBody` today takes `(content, contentType)`. It needs the `contextId` to
derive the key. Options (decide in plan): thread `contextId` through `MessageItem` ->
render call (preferred, explicit), or unwrap one level up in `MessageItem`/`ChatView` and
pass the decoded `{ body, disappearAt }` down. Either way, `render-message.tsx`'s safe
parser stays the renderer of record for the decoded text.

## Sanitization / XSS — already solved by existing architecture

`renderMessageBody` (`src/lib/utils/render-message.tsx`) is a **safe allowlist parser**:

- built on `html-react-parser`, producing React elements (text is escaped by React),
- drops `<script>` / `<style>`,
- `safeHref` blocks `javascript:` and other non-http(s)/mailto URLs,
- there is **no `dangerouslySetInnerHTML` anywhere in the path.**

Rule: decrypted plaintext is rendered via `renderMessageBody(payload.body, "text")`, never
injected as raw HTML. React escapes it; no `DOMPurify` needed; no new attack surface. The
only way to introduce an XSS hole would be to bypass this renderer, which we will not do.

## The loops — reuse existing intervals, add none

Two intervals already running cover the feature:

1. **Countdown tick (1s).** `ChatView.tsx:51` already runs
   `setInterval(() => setClockNow(Date.now()), 1000)`, but it is **gated behind
   `typingEnabled`.** Change: also run the tick when the active chat has at least one live
   disappearing message, so the badge counts down even with the typing indicator off. The
   badge reads `clockNow`.

2. **Expiry sweep.** No new timer. Hook a sweep into the existing message loads:
   - `ChatView.tsx:151` re-polls the active DM every 4s — after each `setMessages`, scan
     the decoded messages for `disappearAt <= now` that are the **current user's own** and
     fire deletes.
   - `Sidebar.tsx:117` polls chats app-wide every 15s — run the same own-message expiry
     sweep across cached DM contexts there, so the sender's client cleans up DMs it is not
     currently viewing.

### Deletion authority (correctness constraint)

Graph only permits deleting **your own** messages. A receiver scanning someone else's
expired message cannot delete it (Graph returns 403). Therefore:

- **Sender's client** performs the real Graph DELETE for its own expired messages.
- **Receiver's client** only hides the message locally once expired (removes from store /
  renders the placeholder); it does not call DELETE.
- If the sender never reopens Teamsly, the blob persists in Graph until they do. This is an
  accepted limitation (best-effort delete). Native Teams never showed readable content
  regardless.

Existing delete plumbing is reused: chat DELETE is already wired at
`/api/chats/[chatId]/messages/[messageId]` and `deleteMessage` / `removeMessage` exist in
the store.

## Edge cases & accepted limitations

- **Clock skew:** `disappearAt` is the sender's absolute epoch ms; a receiver's clock drift
  shifts perceived remaining time. Material for 30s timers; accepted.
- **Search:** encrypted bodies are ciphertext in Graph, so Teamsly search and Graph-side
  search will not match their text. Accepted.
- **Realtime / SSE push:** pushed messages arrive as the blob too. The unwrap must live in
  the shared render path (not only `ChatView`) so SSE-delivered messages render decoded.
- **Attachments:** only the text body is wrapped. Files/images attached to a disappearing
  message are not cloaked and are not auto-deleted in v1. Out of scope; the composer should
  disable the timer when an attachment is present, or document that attachments are sent in
  the clear.
- **Replies/forwards** of a disappearing message would quote the blob; treat the disappear
  affordance as unavailable for quoted content in v1.
- **Edit:** editing a disappearing message is out of scope for v1 (would need re-wrap).

## Files touched (v1)

| File | Change |
|------|--------|
| `src/lib/utils/disappear.ts` | New: key derivation + wrap/unwrap + prefix check |
| `src/components/messages/MessageInput.tsx` | ⏱ duration picker; wrap on send |
| `src/components/messages/ChatView.tsx` | optimistic plaintext; ungate 1s tick; expiry sweep in 4s poll |
| `src/components/messages/MessageItem.tsx` | unwrap + countdown badge + placeholder |
| `src/lib/utils/render-message.tsx` | accept/decode disappearing content via existing safe pipeline |
| `src/components/sidebar/Sidebar.tsx` | app-wide own-message expiry sweep on existing 15s poll |

No new dependencies. No new `setInterval`. No server/API changes (reuses existing chat
send + delete endpoints).
