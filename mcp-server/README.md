# Teamsly MCP Server

Exposes your Microsoft Teams as MCP tools — send DMs, read messages, list chats, channels, and teams.

Works with any MCP-compatible client: Claude Code, Claude Desktop, Cursor, Zed, Windsurf, and others.

## Install

```bash
claude mcp add teamsly -- npx -y @teamsly/mcp
```

That's it — no clone required. On first use you'll do a one-time Microsoft sign-in (see **Auth** below). For other clients, use the config blocks further down.

## Auth (one-time setup)

On first run, a sign-in prompt appears in your terminal:

```
╔══════════════════════════════════════════╗
║       Sign in to Teamsly MCP             ║
╠══════════════════════════════════════════╣
║  1. Open: https://microsoft.com/devicelogin
║  2. Enter code: XXXXXXXX                 ║
╚══════════════════════════════════════════╝
```

Open the URL, enter the code, sign in with your Microsoft account. Done — tokens are saved to `~/.config/teamsly-mcp/tokens.json` and auto-refreshed.

> **Azure app requirement:** the app registration behind `TEAMSLY_CLIENT_ID` must have **"Allow public client flows"** enabled (Entra ID → App registrations → *app* → Authentication → Advanced settings). The device-code flow is a public-client flow; without this, sign-in fails at the token step with `AADSTS7000218: ... must contain 'client_assertion' or 'client_secret'`.

## Tools

| Tool | Description |
|---|---|
| `find_people` | Search contacts by name → returns `[{ id, displayName, email }]` |
| `send_dm` | Send a DM given a user ID (use `find_people` first) |
| `list_chats` | List recent DM and group chats |
| `get_chat_messages` | Get recent messages from a chat |
| `send_chat_message` | Send a message to a chat by ID |
| `list_teams` | List your Teams |
| `list_channels` | List channels in a team |
| `get_channel_messages` | Get recent messages from a channel |
| `send_channel_message` | Post a message to a channel |

## Configuration

---

### Claude Code

**Project-level** (auto-discovered for anyone who opens this repo — already configured via `.mcp.json`):

```json
{
  "mcpServers": {
    "teamsly": {
      "command": "npx",
      "args": ["-y", "@teamsly/mcp"]
    }
  }
}
```

**User-level** (available in all your projects):

```bash
claude mcp add teamsly -- npx -y @teamsly/mcp
```

---

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "teamsly": {
      "command": "npx",
      "args": ["-y", "@teamsly/mcp"]
    }
  }
}
```

Restart Claude Desktop after saving.

---

### Cursor

Edit `~/.cursor/mcp.json` (user-level) or `.cursor/mcp.json` in your project (project-level):

```json
{
  "mcpServers": {
    "teamsly": {
      "command": "npx",
      "args": ["-y", "@teamsly/mcp"]
    }
  }
}
```

---

### Zed

Edit `~/.config/zed/settings.json`:

```json
{
  "context_servers": {
    "teamsly": {
      "command": { "path": "npx", "args": ["-y", "@teamsly/mcp"] }
    }
  }
}
```

---

### Windsurf

Edit `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "teamsly": {
      "command": "npx",
      "args": ["-y", "@teamsly/mcp"]
    }
  }
}
```

---

### Develop from source

Working on the server itself? Run it straight from the repo with no build:

```bash
npx tsx mcp-server/index.ts
```

The repo's `.mcp.json` already points Claude Code at this for local development.

---

## Optional env vars

| Variable | Default | Description |
|---|---|---|
| `TEAMSLY_CLIENT_ID` | teamsly.app's app ID | Azure AD app client ID |
| `TEAMSLY_TENANT_ID` | `common` | Tenant ID (use your org's ID to restrict to one tenant) |
| `TEAMSLY_TOKEN_DIR` | `~/.config/teamsly-mcp` | Token storage directory |
