#!/usr/bin/env node
/**
 * Teamsly MCP Server
 *
 * Exposes Microsoft Teams messaging as MCP tools so any AI assistant
 * (Claude Desktop, Cursor, etc.) can read and send Teams messages.
 *
 * Auth:
 *   1. Sign in at teamsly.app (or your self-hosted URL).
 *   2. Visit <your-url>/api/mcp/token — copy the token (valid ~1 hour).
 *   3. Set TEAMSLY_ACCESS_TOKEN to that value in your MCP client config.
 *   4. Set TEAMSLY_MCP_SECRET to the shared secret configured on the server.
 *
 * Claude Desktop — ~/Library/Application Support/Claude/claude_desktop_config.json:
 * {
 *   "mcpServers": {
 *     "teamsly": {
 *       "command": "npx",
 *       "args": ["tsx", "/path/to/teamsly/mcp-server/index.ts"],
 *       "env": {
 *         "TEAMSLY_BASE_URL": "https://teamsly.app",
 *         "TEAMSLY_MCP_SECRET": "your-server-secret",
 *         "TEAMSLY_ACCESS_TOKEN": "token-from-api-mcp-token"
 *       }
 *     }
 *   }
 * }
 *
 * Cursor / Windsurf: add same env block under Settings → MCP Servers.
 * Claude Code CLI: claude mcp add teamsly npx tsx /path/to/mcp-server/index.ts
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE_URL = process.env.TEAMSLY_BASE_URL ?? process.env.TEAMSLY_URL ?? "https://teamsly.app";
const SECRET = process.env.TEAMSLY_MCP_SECRET ?? "";
const ACCESS_TOKEN = process.env.TEAMSLY_ACCESS_TOKEN ?? "";

if (!SECRET) {
  process.stderr.write("TEAMSLY_MCP_SECRET is not set\n");
  process.exit(1);
}
if (!ACCESS_TOKEN) {
  process.stderr.write(
    "TEAMSLY_ACCESS_TOKEN is not set.\n" +
    "Visit " + BASE_URL + "/api/mcp/token (while signed in) to get your token.\n"
  );
  process.exit(1);
}

async function api(path: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "x-mcp-secret": SECRET,
      "Authorization": `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

const server = new McpServer({
  name: "teamsly",
  version: "1.0.0",
});

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

server.tool(
  "list_chats",
  "List recent Microsoft Teams DM and group chat conversations",
  {},
  async () => {
    const data = await api("/api/mcp/chats");
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  }
);

server.tool(
  "get_chat_messages",
  "Get recent messages from a Teams DM or group chat",
  { chat_id: z.string().describe("The chat ID from list_chats") },
  async ({ chat_id }) => {
    const data = await api(`/api/mcp/chats/${encodeURIComponent(chat_id)}/messages`);
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
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
    await api(`/api/mcp/chats/${encodeURIComponent(chat_id)}/messages`, {
      method: "POST",
      body: JSON.stringify({ message }),
    });
    return { content: [{ type: "text", text: "Message sent." }] };
  }
);

server.tool(
  "list_teams",
  "List the Microsoft Teams the user has joined",
  {},
  async () => {
    const data = await api("/api/mcp/teams");
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  }
);

server.tool(
  "list_channels",
  "List channels in a Microsoft Teams team",
  { team_id: z.string().describe("The team ID from list_teams") },
  async ({ team_id }) => {
    const data = await api(`/api/mcp/teams/${team_id}/channels`);
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
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
    const data = await api(`/api/mcp/teams/${team_id}/channels/${channel_id}/messages`);
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  }
);

server.tool(
  "send_channel_message",
  "Send a message to a Teams channel",
  {
    team_id: z.string().describe("The team ID from list_teams"),
    channel_id: z.string().describe("The channel ID from list_channels"),
    message: z.string().describe("Plain text message to send"),
  },
  async ({ team_id, channel_id, message }) => {
    await api(`/api/mcp/teams/${team_id}/channels/${channel_id}/messages`, {
      method: "POST",
      body: JSON.stringify({ message }),
    });
    return { content: [{ type: "text", text: "Message sent." }] };
  }
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const transport = new StdioServerTransport();
await server.connect(transport);
