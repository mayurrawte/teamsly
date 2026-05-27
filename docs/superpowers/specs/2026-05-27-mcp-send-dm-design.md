# MCP Send DM Design

**Date:** 2026-05-27  
**Status:** Approved  
**Scope:** `mcp-server/index.ts` only — no Next.js app changes

## Goal

Let Claude send a Microsoft Teams DM to any person the user names, without the user needing to know chat IDs or navigate the app.

**Target flow:**
> "Send Priya a message: are you free for a call tomorrow?"
> → Claude finds Priya, opens or reuses the 1:1 chat, sends the message.

---

## What Changes

Single file: `mcp-server/index.ts`

1. Add `People.Read` to the OAuth scope string
2. Add `find_people` tool
3. Add `send_dm` tool

No new files. No changes to the Next.js app or any other lib.

---

## OAuth Scope

Add `People.Read` to the existing `SCOPE` constant.

`People.Read` enables `GET /me/people` — a relevance-ranked list of people the
signed-in user actually interacts with (recent emails, meetings, chats). This is
strictly better than a raw `/users?$filter=` org search for the "send to someone
I know" use case.

Existing users will be prompted to re-consent on next login (device code flow
re-runs automatically when the refresh token no longer covers the new scope).

---

## Tool: `find_people`

**Purpose:** Resolve a name string to one or more AAD user records.

**Input:**
```ts
{ query: z.string().describe("Name or partial name to search for") }
```

**Graph call:**
```
GET /me/people?$search="<query>"&$select=id,displayName,userPrincipalName&$top=5
```

**Output (returned as JSON text):**
```json
[
  { "id": "abc123", "displayName": "Priya Sharma", "email": "priya@contoso.com" }
]
```

Returns an empty array `[]` (not an error) when no results are found, so Claude
can tell the user gracefully ("No contacts found for 'Priya'").

---

## Tool: `send_dm`

**Purpose:** Find or create a 1:1 chat with a user and post a message.

**Input:**
```ts
{
  user_id: z.string().describe("AAD user ID from find_people"),
  message: z.string().describe("Message text to send"),
}
```

**Step 1 — Find or create the 1:1 chat:**
```
POST /me/chats
{
  "chatType": "oneOnOne",
  "members": [
    { "@odata.type": "#microsoft.graph.aadUserConversationMember",
      "roles": ["owner"],
      "user@odata.bind": "https://graph.microsoft.com/v1.0/users('<my-id>')" },
    { "@odata.type": "#microsoft.graph.aadUserConversationMember",
      "roles": ["owner"],
      "user@odata.bind": "https://graph.microsoft.com/v1.0/users('<user_id>')" }
  ]
}
```

Graph is idempotent for 1:1 chats: returns the existing chat if one already
exists between the two users, or creates and returns a new one. No pre-check needed.

The signed-in user's own ID is fetched once per process via `GET /me?$select=id`
and cached in a module-level variable.

**Step 2 — Send the message:**
```
POST /me/chats/<chatId>/messages
{ "body": { "contentType": "text", "content": "<message>" } }
```

**Output:** `"Message sent."` on success.

**Errors:** Surface the raw Graph error message so Claude can explain it
(e.g. "Cannot send messages to external/guest users in this tenant").

---

## Usage Examples

```
# Happy path
You: send tom a message: lunch today?
Claude: find_people("tom") → [{ id: "x1", displayName: "Tom Baker", ... }]
Claude: send_dm("x1", "lunch today?") → "Message sent."
Claude: Done — sent "lunch today?" to Tom Baker.

# Ambiguous name
You: send alex a message: can you review my PR?
Claude: find_people("alex") → [Alex Wu, Alex Chen, Alex Nguyen]
Claude: I found 3 people named Alex — which one did you mean?
  1. Alex Wu (alex.wu@...)
  2. Alex Chen (alex.chen@...)
  3. Alex Nguyen (alex.n@...)

# Not found
Claude: find_people("zxqwerty") → []
Claude: No contacts found for 'zxqwerty'. Did you mean someone else?
```

---

## What's Out of Scope

- **@mention pings in DMs** — the current `send_dm` sends plain text. The
  existing `sendChatMessage` + `buildGraphMentions` infrastructure is in the
  Next.js app; adding it to the MCP server is a separate task.
- **Channel messages** — existing `send_channel_message` tool covers this.
- **Group DMs** — only 1:1 chats. Creating group chats requires knowing all
  member IDs upfront.
- **File attachments** — out of scope.

---

## Testing

After implementation:

1. Run `npx tsx mcp-server/index.ts` — complete device code auth (will re-prompt
   for `People.Read` consent).
2. Verify `find_people("your own name")` returns your record.
3. Verify `send_dm(<your-own-id>, "test")` delivers a self-DM.
4. Add to Claude Code settings and test end-to-end via natural language.
