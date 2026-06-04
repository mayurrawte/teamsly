# Publish `@teamsly/mcp` to npm — Design

**Date:** 2026-06-04
**Status:** Approved (design)
**Stage:** Path A of a two-stage distribution effort. Path B (hosted remote MCP) is out of scope here and gets its own spec.

## Problem

The Teamsly MCP server exists and works, but it is only consumable the developer way: clone the whole `teamsly` repo, have Node + `npx tsx`, and point an MCP client config at an absolute path on local disk (`mcp-server/index.ts`). The `mcp-server/` folder is not a publishable package — its `package.json` is just `{"type":"module"}` (no `name`, `version`, `bin`, or `dependencies`).

This makes the server unusable for anyone who is not already a contributor to the repo.

## Goal & success criteria

Any technical user can connect their Microsoft Teams to an MCP client with a single command and no repo clone:

```bash
claude mcp add teamsly -- npx -y @teamsly/mcp
```

Success means:

- `@teamsly/mcp` installs from the public npm registry.
- The device-code sign-in works on first tool call (unchanged behavior).
- All 9 existing tools function identically to running from source today: `find_people`, `send_dm`, `list_chats`, `get_chat_messages`, `send_chat_message`, `list_teams`, `list_channels`, `get_channel_messages`, `send_channel_message`.

Authentication is already solved — the server ships with Teamsly's Azure client ID (`377aa8a2-24d1-4d6e-8eca-e347864c9880`) and tenant `common` baked in as defaults. This effort is **purely a packaging change**; no server logic changes.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Package name | `@teamsly/mcp` | Scoped under the existing `teamsly` npm org; clean namespace for future packages. |
| Build output | Compile TS → JS | Plain Node JS ships; fast startup; no heavy runtime deps. Standard for npm MCP servers. |
| Repo layout | Stays in this repo as `mcp-server/` | One source of truth; the folder already lives here. |
| Versioning | Independent, start `0.1.0` | Decoupled from the app (`teamsly@0.4.0`) so release cadences don't force noise-bumps on each other. |
| Bundler | tsup (esbuild) | Zero-config ESM, preserves shebang, externalizes declared deps. |
| CI publish | Out of scope for v0.1.0 | YAGNI for first publish; optional follow-up. |

## Package layout

`mcp-server/` becomes a self-contained publishable package. `index.ts` keeps its current logic and its `#!/usr/bin/env node` shebang.

```
mcp-server/
  index.ts          # source — unchanged logic, keeps shebang
  package.json      # fleshed out into a real package (below)
  tsconfig.json     # NEW — TypeScript config for the build
  tsup.config.ts    # NEW — bundler config
  README.md         # add npx install instructions (keep clone-from-source flow)
  dist/             # build output — gitignored, npm-published
    index.js
```

New `mcp-server/package.json`:

```json
{
  "name": "@teamsly/mcp",
  "version": "0.1.0",
  "description": "Microsoft Teams as MCP tools — DMs, channels, messages.",
  "type": "module",
  "bin": { "teamsly-mcp": "dist/index.js" },
  "files": ["dist", "README.md"],
  "engines": { "node": ">=18" },
  "publishConfig": { "access": "public" },
  "scripts": {
    "build": "tsup",
    "prepublishOnly": "npm run build"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.29.0",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "tsup": "^8",
    "typescript": "^6"
  }
}
```

Notes:

- **Scoped packages default to private on npm.** `publishConfig.access: public` makes the publish public without needing the `--access public` flag each time.
- Single bin `teamsly-mcp`, so `npx -y @teamsly/mcp` resolves to it unambiguously.
- `files: ["dist", "README.md"]` → only compiled output + README ship; the rest of the repo is excluded.
- `index.ts` uses `@modelcontextprotocol/sdk` and `zod` plus Node built-ins. These two deps are declared locally so `npx` installs them. Versions match what the root app currently resolves (`@modelcontextprotocol/sdk@^1.29.0`, `zod@^4.4.3`).

## Build

**tsup** (esbuild under the hood):

- Entry `index.ts` → `dist/index.js`, ESM format, Node target.
- Preserves the leading `#!/usr/bin/env node` shebang so the bin is directly executable.
- Externalizes declared dependencies (does not bundle the SDK/zod), leaving npm to install and dedupe them.
- `npm run build` produces `dist/`. `prepublishOnly` runs the build automatically so a stale `dist/` can't ship.

`tsconfig.json` targets Node 18+ ESM (`module`/`moduleResolution` aligned for the bundler) and is used for editor/type-check support; tsup itself uses esbuild and does not type-check.

## Local dev is unaffected

The repo's root `.mcp.json` keeps using `npx tsx mcp-server/index.ts` for in-repo development — no build needed while editing the source. The published package is what external users consume. Both flows are documented in the README:

- **Use it (others):** `claude mcp add teamsly -- npx -y @teamsly/mcp`
- **Develop it (contributors):** clone + `npx tsx mcp-server/index.ts` (existing flow)

## Publishing flow

From `mcp-server/`:

```bash
npm publish   # public via publishConfig.access
```

The npm-auth path is confirmed with the owner before the first publish. Two safe options (the publish token is never pasted into a chat/transcript):

1. The owner runs `npm publish` after the package is prepared, or
2. The owner sets `NPM_TOKEN` (or `~/.npmrc`) locally and the publish is run from that environment.

Publishing is an outward-facing, effectively irreversible action (a published version cannot be meaningfully replaced), so it requires explicit owner sign-off at the time.

## Out of scope

- **Path B — hosted remote MCP server** (HTTP/SSE transport + browser OAuth for non-technical end users). Next stage; separate spec. Nothing in this design blocks it.
- **CI publish workflow** (GitHub Actions release-on-tag). Optional future enhancement; not required to ship v0.1.0.
- Any change to server tool behavior, auth flow, or the baked-in Azure client ID.

## Verification

- `npm run build` in `mcp-server/` produces an executable `dist/index.js` with a working shebang.
- `npm pack` (dry run) shows only `dist/` + `README.md` + `package.json` in the tarball.
- Running the built bin directly (`node mcp-server/dist/index.js`) starts the server and prints the device-code prompt on first run.
- After publish, `npx -y @teamsly/mcp` from a clean directory (outside the repo) connects and lists teams.
