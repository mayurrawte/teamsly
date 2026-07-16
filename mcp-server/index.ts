#!/usr/bin/env node
/**
 * Teamsly MCP Server
 *
 * Exposes Microsoft Teams messaging as MCP tools for any AI client.
 *
 * Auth — device code flow (one-time setup, then automatic):
 *   On first run, a URL and short code are printed to stderr.
 *   Open the URL, enter the code, sign in with Microsoft. Done.
 *   Tokens are saved to ~/.config/teamsly-mcp/tokens.json and auto-refresh.
 *
 * Minimal config for Claude Desktop
 * (~/Library/Application Support/Claude/claude_desktop_config.json):
 *
 *   {
 *     "mcpServers": {
 *       "teamsly": {
 *         "command": "npx",
 *         "args": ["tsx", "/path/to/teamsly/mcp-server/index.ts"]
 *       }
 *     }
 *   }
 *
 * Optional env vars:
 *   TEAMSLY_CLIENT_ID  — Azure AD app client ID (defaults to teamsly.app's app)
 *   TEAMSLY_TENANT_ID  — tenant ID (default: "common" = any Microsoft account)
 *   TEAMSLY_TOKEN_DIR  — override token storage directory
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { version } from "./package.json";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const CLIENT_ID = process.env.TEAMSLY_CLIENT_ID ?? "377aa8a2-24d1-4d6e-8eca-e347864c9880";
const TENANT_ID = process.env.TEAMSLY_TENANT_ID ?? "common";
const TOKEN_DIR = process.env.TEAMSLY_TOKEN_DIR ?? join(homedir(), ".config", "teamsly-mcp");
const TOKEN_FILE = join(TOKEN_DIR, "tokens.json");

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

const GRAPH = "https://graph.microsoft.com/v1.0";
const TOKEN_URL = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;

// ---------------------------------------------------------------------------
// Token storage
// ---------------------------------------------------------------------------

interface TokenStore {
  access_token: string;
  refresh_token: string;
  expires_at: number; // ms
}

function loadTokens(): TokenStore | null {
  try {
    return JSON.parse(readFileSync(TOKEN_FILE, "utf8")) as TokenStore;
  } catch {
    return null;
  }
}

function saveTokens(t: TokenStore) {
  mkdirSync(TOKEN_DIR, { recursive: true });
  writeFileSync(TOKEN_FILE, JSON.stringify(t, null, 2), { mode: 0o600 });
}

// ---------------------------------------------------------------------------
// Auth — device code flow + auto-refresh
// ---------------------------------------------------------------------------

async function deviceCodeAuth(): Promise<TokenStore> {
  const codeRes = await fetch(
    `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/devicecode`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: CLIENT_ID, scope: SCOPE }),
    }
  );
  if (!codeRes.ok) throw new Error(`Device code request failed: ${await codeRes.text()}`);

  const { device_code, user_code, verification_uri, interval, expires_in } =
    (await codeRes.json()) as {
      device_code: string;
      user_code: string;
      verification_uri: string;
      interval: number;
      expires_in: number;
    };

  process.stderr.write(
    `\n╔══════════════════════════════════════════╗\n` +
    `║       Sign in to Teamsly MCP             ║\n` +
    `╠══════════════════════════════════════════╣\n` +
    `║  1. Open: ${verification_uri.padEnd(31)}║\n` +
    `║  2. Enter code: ${user_code.padEnd(25)}║\n` +
    `╚══════════════════════════════════════════╝\n\n` +
    `Waiting for sign-in…\n`
  );

  const deadline = Date.now() + expires_in * 1000;
  const poll = Math.max(interval, 5) * 1000;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, poll));
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        client_id: CLIENT_ID,
        device_code,
      }),
    });
    const data = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error?: string;
    };

    if (data.access_token) {
      const tokens: TokenStore = {
        access_token: data.access_token,
        refresh_token: data.refresh_token ?? "",
        expires_at: Date.now() + (data.expires_in ?? 3600) * 1000,
      };
      saveTokens(tokens);
      process.stderr.write("✓ Signed in. Tokens saved.\n\n");
      return tokens;
    }
    if (data.error && data.error !== "authorization_pending" && data.error !== "slow_down") {
      throw new Error(`Auth error: ${data.error}`);
    }
  }
  throw new Error("Device code expired — please restart and try again.");
}

async function refreshTokens(stored: TokenStore): Promise<TokenStore> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: CLIENT_ID,
      refresh_token: stored.refresh_token,
      scope: SCOPE,
    }),
  });
  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
  };
  if (!data.access_token) throw new Error(`Refresh failed: ${data.error}`);

  const tokens: TokenStore = {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? stored.refresh_token,
    expires_at: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  saveTokens(tokens);
  return tokens;
}

let _tokens: TokenStore | null = null;

async function getAccessToken(): Promise<string> {
  if (!_tokens) {
    _tokens = loadTokens();
  }
  if (!_tokens) {
    _tokens = await deviceCodeAuth();
  } else if (_tokens.expires_at < Date.now() + 60_000) {
    try {
      _tokens = await refreshTokens(_tokens);
    } catch {
      // Refresh token expired — re-authenticate
      _tokens = await deviceCodeAuth();
    }
  }
  return _tokens.access_token;
}

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

// ---------------------------------------------------------------------------
// Graph API helper
// ---------------------------------------------------------------------------

async function graph(path: string, options: RequestInit = {}) {
  const token = await getAccessToken();
  const res = await fetch(`${GRAPH}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Graph ${path} → ${res.status}: ${text}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// ---------------------------------------------------------------------------
// MCP server + tools
// ---------------------------------------------------------------------------

const server = new McpServer({ name: "teamsly", version });

server.tool(
  "list_chats",
  "List recent Microsoft Teams DM and group chat conversations",
  {},
  async () => {
    const data = await graph("/me/chats?$expand=members&$top=50");
    return { content: [{ type: "text", text: JSON.stringify(data?.value ?? data, null, 2) }] };
  }
);

server.tool(
  "get_chat_messages",
  "Get recent messages from a Teams DM or group chat",
  { chat_id: z.string().describe("The chat ID from list_chats") },
  async ({ chat_id }) => {
    const data = await graph(`/me/chats/${encodeURIComponent(chat_id)}/messages?$top=20`);
    return { content: [{ type: "text", text: JSON.stringify(data?.value ?? data, null, 2) }] };
  }
);

server.tool(
  "send_chat_message",
  "Send a message to a Teams DM or group chat",
  {
    chat_id: z.string().describe("The chat ID from list_chats"),
    message: z.string().describe("Plain text message to send"),
  },
  async ({ chat_id, message }) => {
    await graph(`/me/chats/${encodeURIComponent(chat_id)}/messages`, {
      method: "POST",
      body: JSON.stringify({ body: { contentType: "text", content: message } }),
    });
    return { content: [{ type: "text", text: "Message sent." }] };
  }
);

server.tool(
  "list_teams",
  "List the Microsoft Teams the user has joined",
  {},
  async () => {
    const data = await graph("/me/joinedTeams");
    return { content: [{ type: "text", text: JSON.stringify(data?.value ?? data, null, 2) }] };
  }
);

server.tool(
  "list_channels",
  "List channels in a Microsoft Teams team",
  { team_id: z.string().describe("The team ID from list_teams") },
  async ({ team_id }) => {
    const data = await graph(`/teams/${team_id}/channels`);
    return { content: [{ type: "text", text: JSON.stringify(data?.value ?? data, null, 2) }] };
  }
);

server.tool(
  "get_channel_messages",
  "Get recent messages from a Teams channel",
  {
    team_id: z.string().describe("The team ID from list_teams"),
    channel_id: z.string().describe("The channel ID from list_channels"),
  },
  async ({ team_id, channel_id }) => {
    const data = await graph(`/teams/${team_id}/channels/${channel_id}/messages?$top=20`);
    return { content: [{ type: "text", text: JSON.stringify(data?.value ?? data, null, 2) }] };
  }
);

server.tool(
  "find_people",
  "Search for a Microsoft Teams contact by name. Returns up to 5 matching users with their IDs, display names, and email addresses. Use the returned `id` with send_dm to send a message.",
  {
    query: z.string().describe("Name or partial name to search for, e.g. 'Priya' or 'Tom Baker'"),
  },
  async ({ query }) => {
    const encoded = encodeURIComponent(query);
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

server.tool(
  "send_channel_message",
  "Post a message to a Teams channel",
  {
    team_id: z.string().describe("The team ID from list_teams"),
    channel_id: z.string().describe("The channel ID from list_channels"),
    message: z.string().describe("Plain text message to send"),
  },
  async ({ team_id, channel_id, message }) => {
    await graph(`/teams/${team_id}/channels/${channel_id}/messages`, {
      method: "POST",
      body: JSON.stringify({ body: { contentType: "text", content: message } }),
    });
    return { content: [{ type: "text", text: "Message sent." }] };
  }
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const transport = new StdioServerTransport();
await server.connect(transport);
