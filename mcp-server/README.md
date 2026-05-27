# Teamsly MCP Server

Exposes your Microsoft Teams as MCP tools — send DMs, read messages, list chats, channels, and teams.

Works with any MCP-compatible client: Claude Code, Claude Desktop, Cursor, Zed, Windsurf, and others.

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

The server runs via `npx tsx mcp-server/index.ts` from the repo root. Replace the path with an absolute path if configuring globally.

---

### Claude Code

**Project-level** (auto-discovered for anyone who opens this repo — already configured via `.mcp.json`):

```json
{
  "mcpServers": {
    "teamsly": {
      "command": "npx",
      "args": ["tsx", "mcp-server/index.ts"]
    }
  }
}
```

**User-level** (available in all your projects):

```bash
claude mcp add teamsly -- npx tsx /absolute/path/to/teamsly/mcp-server/index.ts
```

---

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "teamsly": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/teamsly/mcp-server/index.ts"]
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
      "args": ["tsx", "/absolute/path/to/teamsly/mcp-server/index.ts"]
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
      "command": {
        "path": "npx",
        "args": ["tsx", "/absolute/path/to/teamsly/mcp-server/index.ts"]
      }
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
      "args": ["tsx", "/absolute/path/to/teamsly/mcp-server/index.ts"]
    }
  }
}
```

---

## Optional env vars

| Variable | Default | Description |
|---|---|---|
| `TEAMSLY_CLIENT_ID` | teamsly.app's app ID | Azure AD app client ID |
| `TEAMSLY_TENANT_ID` | `common` | Tenant ID (use your org's ID to restrict to one tenant) |
| `TEAMSLY_TOKEN_DIR` | `~/.config/teamsly-mcp` | Token storage directory |
