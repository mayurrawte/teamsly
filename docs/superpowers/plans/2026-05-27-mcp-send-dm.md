# MCP Send DM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `find_people` and `send_dm` tools to the Teamsly MCP server so Claude can DM any Teams contact by name.

**Architecture:** All changes are in `mcp-server/index.ts`. Add `People.Read` to the OAuth scope, add a cached `getMyId()` helper, then register two new MCP tools: `find_people` (name → user list) and `send_dm` (user_id + message → delivered DM).

**Tech Stack:** `@modelcontextprotocol/sdk` 1.29.0, `zod`, Microsoft Graph REST API, `npx tsx` runner

---

### Task 1: Add `People.Read` scope and `getMyId()` helper

**Files:**
- Modify: `mcp-server/index.ts`

The `People.Read` scope unlocks `GET /me/people` — a relevance-ranked list of people the user actually interacts with, far better than a raw org search. The `getMyId()` helper fetches and caches the signed-in user's own AAD ID once per process; `send_dm` needs it to build the two-member array for the 1:1 chat POST.

- [ ] **Step 1: Add `People.Read` to the SCOPE constant**

In `mcp-server/index.ts`, find the `SCOPE` constant (around line 37) and add `"People.Read"` to the array:

```typescript
const SCOPE = [
  "User.Read",
  "User.ReadBasic.All",
  "People.Read",
  "Team.ReadBasic.All",
  "Channel.ReadBasic.All",
  "ChannelMessage.Read.All",
  "ChannelMessage.Send",
  "Chat.ReadWrite",
  "Presence.Read.All",
  "Files.Read.All",
  "Calendars.Read",
  "offline_access",
].join(" ");
```

- [ ] **Step 2: Add the `getMyId()` helper after the `getAccessToken` function**

Add this block immediately after the closing brace of `getAccessToken` (before the `// ---` Graph API helper comment):

```typescript
// Cached own AAD user ID — needed when building the members array for
// POST /chats (1:1 chat creation requires both member IDs explicitly).
let _myId: string | null = null;

async function getMyId(): Promise<string> {
  if (!_myId) {
    const me = (await graph("/me?$select=id")) as { id: string };
    _myId = me.id;
  }
  return _myId;
}
```

- [ ] **Step 3: Delete the stale token cache so the new scope is consented**

```bash
rm -f ~/.config/teamsly-mcp/tokens.json
```

This forces re-auth on next run so `People.Read` is included in the consent prompt. Without this the old token persists and `find_people` calls will 403.

- [ ] **Step 4: Verify the server still starts cleanly (dry run)**

```bash
cd /Users/mayurrawte/thepsygeek/teamsly
npx tsx mcp-server/index.ts
```

Expected: The device-code auth banner appears on stderr (because we deleted tokens):
```
╔══════════════════════════════════════════╗
║       Sign in to Teamsly MCP             ║
╠══════════════════════════════════════════╣
║  1. Open: https://microsoft.com/devicelogin
║  2. Enter code: XXXXXXXX                 ║
╚══════════════════════════════════════════╝
```

Complete sign-in in the browser. After `✓ Signed in. Tokens saved.` appears, Ctrl-C the process — we're just confirming auth works, not using it yet.

- [ ] **Step 5: Commit**

```bash
git add mcp-server/index.ts
git commit -m "feat(mcp): add People.Read scope and getMyId helper"
```

---

### Task 2: Add `find_people` tool

**Files:**
- Modify: `mcp-server/index.ts`

`find_people` calls `GET /me/people?$search=…` which returns people ranked by interaction frequency — the user's recent contacts float to the top. Returns a trimmed array so Claude gets clean data without noise.

- [ ] **Step 1: Add the tool after the `get_channel_messages` tool block**

Find the `send_channel_message` tool registration at the bottom of the tools section. Add `find_people` immediately before it:

```typescript
server.tool(
  "find_people",
  "Search for a Microsoft Teams contact by name. Returns up to 5 matching users with their IDs, display names, and email addresses. Use the returned `id` with send_dm to send a message.",
  {
    query: z.string().describe("Name or partial name to search for, e.g. 'Priya' or 'Tom Baker'"),
  },
  async ({ query }) => {
    const encoded = encodeURIComponent(`"${query}"`);
    const data = (await graph(
      `/me/people?$search=${encoded}&$select=id,displayName,userPrincipalName&$top=5`
    )) as {
      value?: Array<{ id: string; displayName: string; userPrincipalName?: string }>;
    };
    const people = (data?.value ?? []).map((p) => ({
      id: p.id,
      displayName: p.displayName,
      email: p.userPrincipalName ?? "",
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(people, null, 2) }],
    };
  }
);
```

- [ ] **Step 2: Smoke-test `find_people` manually**

Run the server and call the tool directly via a small one-liner to verify the Graph call works:

```bash
cd /Users/mayurrawte/thepsygeek/teamsly
node -e "
const { readFileSync } = require('fs');
const { join, homedir } = require('path');
const tokens = JSON.parse(readFileSync(join(homedir(), '.config/teamsly-mcp/tokens.json'), 'utf8'));
fetch('https://graph.microsoft.com/v1.0/me/people?\$search=\"your-own-name\"&\$select=id,displayName,userPrincipalName&\$top=5', {
  headers: { Authorization: 'Bearer ' + tokens.access_token }
}).then(r => r.json()).then(d => console.log(JSON.stringify(d.value?.slice(0,3), null, 2)));
"
```

Replace `your-own-name` with your own first name. Expected: a JSON array with at least your own record containing `id`, `displayName`, and `userPrincipalName`.

If you see `401`: the token expired — run `npx tsx mcp-server/index.ts` once to refresh it, then retry.
If you see `403 Forbidden` with `"code": "ErrorAccessDenied"`: the `People.Read` scope wasn't consented — delete `~/.config/teamsly-mcp/tokens.json` and re-auth via `npx tsx mcp-server/index.ts`.

- [ ] **Step 3: Commit**

```bash
git add mcp-server/index.ts
git commit -m "feat(mcp): add find_people tool"
```

---

### Task 3: Add `send_dm` tool

**Files:**
- Modify: `mcp-server/index.ts`

`send_dm` does two Graph calls: `POST /chats` to find-or-create the 1:1 chat (Graph is idempotent — returns the existing chat if one already exists, creates it if not), then `POST /me/chats/{chatId}/messages` to deliver the message. The tool surfaces raw Graph errors so Claude can explain failures like "cannot message external users."

- [ ] **Step 1: Add the tool immediately after `find_people`**

```typescript
server.tool(
  "send_dm",
  "Send a direct message to a Teams user. Call find_people first to get their user ID. Creates a new 1:1 chat if one doesn't exist yet, or reuses the existing one.",
  {
    user_id: z.string().describe("AAD user ID from find_people"),
    message: z.string().describe("Plain text message to send"),
  },
  async ({ user_id, message }) => {
    const myId = await getMyId();

    // POST /chats is idempotent for oneOnOne: returns existing chat or creates new.
    const chat = (await graph("/chats", {
      method: "POST",
      body: JSON.stringify({
        chatType: "oneOnOne",
        members: [
          {
            "@odata.type": "#microsoft.graph.aadUserConversationMember",
            roles: ["owner"],
            "user@odata.bind": `https://graph.microsoft.com/v1.0/users('${myId}')`,
          },
          {
            "@odata.type": "#microsoft.graph.aadUserConversationMember",
            roles: ["owner"],
            "user@odata.bind": `https://graph.microsoft.com/v1.0/users('${user_id}')`,
          },
        ],
      }),
    })) as { id: string };

    await graph(`/me/chats/${encodeURIComponent(chat.id)}/messages`, {
      method: "POST",
      body: JSON.stringify({ body: { contentType: "text", content: message } }),
    });

    return { content: [{ type: "text", text: "Message sent." }] };
  }
);
```

- [ ] **Step 2: Smoke-test `send_dm` by sending yourself a message**

Get your own AAD user ID first (it was returned in the Task 2 smoke test). Then:

```bash
node -e "
const { readFileSync } = require('fs');
const { join, homedir } = require('path');
const tokens = JSON.parse(readFileSync(join(homedir(), '.config/teamsly-mcp/tokens.json'), 'utf8'));
const myId = 'PASTE-YOUR-AAD-ID-HERE';

// Step 1: find or create the 1:1 chat (self-DM)
fetch('https://graph.microsoft.com/v1.0/chats', {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + tokens.access_token, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    chatType: 'oneOnOne',
    members: [
      { '@odata.type': '#microsoft.graph.aadUserConversationMember', roles: ['owner'], 'user@odata.bind': 'https://graph.microsoft.com/v1.0/users(\'' + myId + '\')' },
      { '@odata.type': '#microsoft.graph.aadUserConversationMember', roles: ['owner'], 'user@odata.bind': 'https://graph.microsoft.com/v1.0/users(\'' + myId + '\')' }
    ]
  })
}).then(r => r.json()).then(chat => {
  console.log('chat id:', chat.id);
  // Step 2: send the message
  return fetch('https://graph.microsoft.com/v1.0/me/chats/' + encodeURIComponent(chat.id) + '/messages', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + tokens.access_token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ body: { contentType: 'text', content: 'MCP smoke test — ignore' } })
  });
}).then(r => r.json()).then(m => console.log('message id:', m.id));
"
```

Expected: a `chat id:` line and a `message id:` line. Check Teams/Teamsly — you should see "MCP smoke test — ignore" in your self-chat.

- [ ] **Step 3: Commit**

```bash
git add mcp-server/index.ts
git commit -m "feat(mcp): add send_dm tool"
```

---

### Task 4: Register with Claude Code and end-to-end test

**Files:**
- Create or modify: `~/.claude/settings.json` (user-level, not committed)

Add the Teamsly MCP server to your Claude Code session so the tools are available in every project.

- [ ] **Step 1: Add the server via the CLI**

```bash
claude mcp add teamsly -- npx tsx /Users/mayurrawte/thepsygeek/teamsly/mcp-server/index.ts
```

Expected output: `Added MCP server teamsly` (or similar confirmation).

Verify it was written:
```bash
grep -A5 "teamsly" ~/.claude/settings.json
```

Expected:
```json
"teamsly": {
  "command": "npx",
  "args": ["tsx", "/Users/mayurrawte/thepsygeek/teamsly/mcp-server/index.ts"]
}
```

- [ ] **Step 2: Restart Claude Code to pick up the new server**

Close and reopen Claude Code (or run `/mcp` in the session to confirm the server appears in the list).

Expected: `teamsly` shown as a connected MCP server with tools: `list_chats`, `get_chat_messages`, `send_chat_message`, `list_teams`, `list_channels`, `get_channel_messages`, `find_people`, `send_dm`.

- [ ] **Step 3: End-to-end test via natural language**

In a Claude Code session, say:

> "Find Priya in my Teams contacts"

Claude should call `find_people("Priya")` and return a list. Then say:

> "Send her: hey, are you free for a quick call?"

Claude should call `send_dm("<id>", "hey, are you free for a quick call?")` and confirm. Check Teams to verify the message arrived.

If `find_people` returns an empty array for a name you expect to find: the person may not be in your `/me/people` list (they need to be a recent contact). As a fallback, try searching by their email prefix.
