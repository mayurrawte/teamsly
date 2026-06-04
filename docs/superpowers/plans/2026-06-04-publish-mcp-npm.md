# Publish `@teamsly/mcp` to npm — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package the existing `mcp-server/` as the public npm package `@teamsly/mcp` so anyone can connect Microsoft Teams to their MCP client with `npx -y @teamsly/mcp` — no repo clone.

**Architecture:** `mcp-server/index.ts` is unchanged in behavior. We give the folder a real `package.json` (scoped name, `bin`, declared deps), compile it to `dist/index.js` with tsup (esbuild, ESM, preserves the shebang), exclude the folder from the root Next.js build, document the npx install, and publish under the `teamsly` npm org.

**Tech Stack:** TypeScript, tsup (esbuild), `@modelcontextprotocol/sdk`, Zod, npm scoped package.

**Branch:** `feat/publish-mcp-npm` (already checked out; the design spec is committed there).

**Spec:** `docs/superpowers/specs/2026-06-04-publish-mcp-npm-design.md`

---

## Pre-flight context (read once)

- `mcp-server/index.ts` imports only `@modelcontextprotocol/sdk`, `zod`, and Node built-ins (`fs`, `os`, `path`). Line 1 is `#!/usr/bin/env node`.
- `dist/` and `node_modules/` are already in the root `.gitignore` (bare patterns, so they match `mcp-server/dist` and `mcp-server/node_modules` too). No `.gitignore` change is needed.
- Tracked files under `mcp-server/`: `README.md`, `index.ts`, `package.json`.
- Local Node is v20; engines target `>=18`.
- The dep versions below mirror what the root app already resolves: `@modelcontextprotocol/sdk@^1.29.0`, `zod@^4.4.3`, `typescript@^6`.
- Auth is lazy: the device-code flow only triggers on a Graph call, not at startup or on `tools/list`. So the smoke test in Task 3 works even with no saved tokens.

---

## Task 1: Promote `mcp-server/package.json` to a real package

**Files:**
- Modify: `mcp-server/package.json` (currently just `{"type":"module"}`)

- [ ] **Step 1: Replace the file contents**

Overwrite `mcp-server/package.json` with:

```json
{
  "name": "@teamsly/mcp",
  "version": "0.1.0",
  "description": "Microsoft Teams as MCP tools — DMs, channels, messages.",
  "type": "module",
  "bin": {
    "teamsly-mcp": "dist/index.js"
  },
  "files": [
    "dist",
    "README.md"
  ],
  "engines": {
    "node": ">=18"
  },
  "publishConfig": {
    "access": "public"
  },
  "scripts": {
    "build": "tsup",
    "type-check": "tsc --noEmit",
    "prepublishOnly": "npm run build"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.29.0",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "@types/node": "^20",
    "tsup": "^8",
    "typescript": "^6"
  }
}
```

- [ ] **Step 2: Verify the JSON parses and key fields are present**

Run:
```bash
node -e "const p=require('./mcp-server/package.json'); if(p.name!=='@teamsly/mcp') throw new Error('name'); if(p.bin['teamsly-mcp']!=='dist/index.js') throw new Error('bin'); if(p.publishConfig.access!=='public') throw new Error('access'); console.log('package.json OK')"
```
Expected: `package.json OK`

- [ ] **Step 3: Commit**

```bash
git add mcp-server/package.json
git commit -m "build(mcp): turn mcp-server into the @teamsly/mcp package"
```

---

## Task 2: Add build config and exclude the package from the root build

**Files:**
- Create: `mcp-server/tsconfig.json`
- Create: `mcp-server/tsup.config.ts`
- Modify: `tsconfig.json:22` (root — add `"mcp-server"` to `exclude`)

- [ ] **Step 1: Create `mcp-server/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "types": ["node"],
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["index.ts", "tsup.config.ts"]
}
```

- [ ] **Step 2: Create `mcp-server/tsup.config.ts`**

```ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["index.ts"],
  format: ["esm"],
  target: "node18",
  platform: "node",
  clean: true,
});
```

tsup auto-detects the `#!/usr/bin/env node` shebang on the entry file and marks the output executable. With `"type": "module"` set, ESM output is written to `dist/index.js`.

- [ ] **Step 3: Exclude `mcp-server` from the root TypeScript build**

The root `tsconfig.json` has `"include": ["**/*.ts", ...]`, which would pull in `mcp-server/tsup.config.ts`. That file imports `tsup`, which is only installed inside `mcp-server/node_modules`, so `next build` would fail to resolve it. Exclude the folder.

In `tsconfig.json`, change line 22 from:
```json
  "exclude": ["node_modules", "electron", "release"]
```
to:
```json
  "exclude": ["node_modules", "electron", "release", "mcp-server"]
```

- [ ] **Step 4: Verify the root type-check no longer sees the package**

Run (the only error should be the known pre-existing `auth/config.ts` one, which we filter):
```bash
npx tsc --noEmit 2>&1 | grep -v "src/lib/auth/config.ts" | grep -E "mcp-server|tsup" || echo "root build does not reference mcp-server — OK"
```
Expected: `root build does not reference mcp-server — OK`

- [ ] **Step 5: Commit**

```bash
git add mcp-server/tsconfig.json mcp-server/tsup.config.ts tsconfig.json
git commit -m "build(mcp): add tsup/tsconfig and exclude mcp-server from root build"
```

---

## Task 3: Install deps, build, and verify the artifact

**Files:**
- Create (generated, committed): `mcp-server/package-lock.json`
- Create (generated, gitignored): `mcp-server/dist/index.js`, `mcp-server/node_modules/`

- [ ] **Step 1: Install the package's dependencies**

Run (uses `--prefix` to avoid `cd`):
```bash
npm install --prefix mcp-server
```
Expected: installs `@modelcontextprotocol/sdk`, `zod`, `tsup`, `typescript`, `@types/node`; creates `mcp-server/package-lock.json` and `mcp-server/node_modules/`.

- [ ] **Step 2: Build**

```bash
npm run build --prefix mcp-server
```
Expected: tsup writes `mcp-server/dist/index.js` and reports success.

- [ ] **Step 3: Verify the shebang survived**

```bash
node -e "const l=require('fs').readFileSync('mcp-server/dist/index.js','utf8').split('\n')[0]; if(l!=='#!/usr/bin/env node') throw new Error('missing shebang, got: '+l); console.log('shebang OK')"
```
Expected: `shebang OK`

- [ ] **Step 4: Verify the bin is executable**

```bash
test -x mcp-server/dist/index.js && echo "executable OK" || (chmod +x mcp-server/dist/index.js && echo "fixed exec bit")
```
Expected: `executable OK` (if it prints `fixed exec bit`, tsup didn't set it — harmless, npm also sets bin perms on install).

- [ ] **Step 5: Smoke-test the built server over MCP stdio**

Sends `initialize` + `tools/list` and confirms a tool is listed. Self-terminating (~2s); no tokens required because `tools/list` does not call Graph.
```bash
{ printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}' \
  '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'; sleep 2; } \
  | node mcp-server/dist/index.js 2>/dev/null \
  | grep -q '"send_dm"' && echo "SMOKE PASS" || echo "SMOKE FAIL"
```
Expected: `SMOKE PASS`

- [ ] **Step 6: Verify the publish tarball contains only the intended files**

```bash
npm pack ./mcp-server --dry-run 2>&1 | grep -E "dist/index.js|package.json|README.md" && echo "---" && npm pack ./mcp-server --dry-run 2>&1 | grep -E "index.ts|tsup.config|tsconfig" && echo "UNEXPECTED FILE IN TARBALL" || echo "tarball contents OK"
```
Expected: the three wanted paths are listed, followed by `tarball contents OK` (no source/config files in the tarball).

- [ ] **Step 7: Commit the lockfile**

`dist/` and `node_modules/` are gitignored; only the lockfile is tracked.
```bash
git add mcp-server/package-lock.json
git commit -m "build(mcp): add lockfile for the @teamsly/mcp package"
```

---

## Task 4: Document the npx install in the README

**Files:**
- Modify: `mcp-server/README.md`

The current README tells users to run `npx tsx /absolute/path/.../index.ts`. Make `npx -y @teamsly/mcp` the primary install for every client and keep the from-source path as a "develop locally" note.

- [ ] **Step 1: Add an Install section near the top**

Immediately after the intro line ("Works with any MCP-compatible client: …"), insert:

```markdown

## Install

```bash
claude mcp add teamsly -- npx -y @teamsly/mcp
```

That's it — no clone required. On first use you'll do a one-time Microsoft sign-in (see **Auth** below). For other clients, use the config blocks further down.
```

- [ ] **Step 2: Update the per-client config blocks to use the published package**

In each client block (Claude Code project-level, Claude Desktop, Cursor, Zed, Windsurf), replace the command/args that point at a local path with the published package. The replacement for the standard `mcpServers` shape is:

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

For the Zed block, keep its `context_servers` wrapper but use the same `command`/`args`:

```json
{
  "context_servers": {
    "teamsly": {
      "command": { "path": "npx", "args": ["-y", "@teamsly/mcp"] }
    }
  }
}
```

And replace the Claude Code **user-level** line:
```bash
claude mcp add teamsly -- npx -y @teamsly/mcp
```

- [ ] **Step 3: Add a "Develop from source" subsection**

Under the Configuration area, add (this preserves the existing contributor flow that the repo's `.mcp.json` already uses):

```markdown
### Develop from source

Working on the server itself? Run it straight from the repo with no build:

```bash
npx tsx mcp-server/index.ts
```

The repo's `.mcp.json` already points Claude Code at this for local development.
```

- [ ] **Step 4: Verify the README advertises the package and no longer leads with a local path**

```bash
grep -q "npx -y @teamsly/mcp" mcp-server/README.md && echo "install line OK"
grep -c "tsx /absolute/path" mcp-server/README.md
```
Expected: `install line OK`, then `0` (no remaining absolute-path tsx instructions).

- [ ] **Step 5: Commit**

```bash
git add mcp-server/README.md
git commit -m "docs(mcp): document npx -y @teamsly/mcp install"
```

---

## Task 5: Verify the root app build is unaffected

No commit — this is a guard that the `tsconfig` exclude in Task 2 didn't break the app build.

- [ ] **Step 1: Run the full root build**

```bash
npm run build
```
Expected: `next build` completes successfully (same result as before this work). This is the canonical gate per the repo's `CLAUDE.md` — `tsc --noEmit` alone is not sufficient. Takes ~1–3 minutes.

- [ ] **Step 2: If the build fails**

Confirm the failure is unrelated to this change by checking it does not mention `mcp-server`, `tsup`, or `@teamsly/mcp`. If it does, the exclude in Task 2 Step 3 is wrong — re-check that `"mcp-server"` is in the root `tsconfig.json` `exclude` array. Do not proceed to publish until the root build is green.

---

## Task 6: Publish to npm (requires owner sign-off)

Publishing is outward-facing and effectively irreversible (a published version number can't be reused). **Do not run `npm publish` without explicit owner confirmation at this step.** The npm token must never be pasted into a chat/transcript.

- [ ] **Step 1: Dry-run the publish**

```bash
npm publish ./mcp-server --dry-run
```
Expected: reports it would publish `@teamsly/mcp@0.1.0` with public access; lists the same files verified in Task 3 Step 6.

- [ ] **Step 2: Confirm the auth path with the owner**

Choose one (owner decides):
- **(a) Owner publishes:** owner runs `npm publish ./mcp-server` in a shell where they are logged in (`npm whoami` shows their account and they have publish rights to the `teamsly` org).
- **(b) Token in env:** owner sets `NPM_TOKEN` / configures `~/.npmrc`, then the publish is run from that environment. The token is never echoed.

- [ ] **Step 3: Publish**

```bash
npm publish ./mcp-server
```
Expected: `+ @teamsly/mcp@0.1.0`.

- [ ] **Step 4: Verify the published package works from a clean directory**

```bash
npm view @teamsly/mcp version
```
Expected: `0.1.0`.

Then confirm a cold `npx` install resolves and lists tools (run from outside the repo, e.g. a temp dir):
```bash
{ printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}' \
  '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'; sleep 4; } \
  | npx -y @teamsly/mcp 2>/dev/null \
  | grep -q '"send_dm"' && echo "PUBLISHED PACKAGE OK" || echo "PUBLISHED PACKAGE FAIL"
```
Expected: `PUBLISHED PACKAGE OK` (allow extra time on first run while npx downloads the package).

- [ ] **Step 5: Open a PR**

```bash
git push -u origin feat/publish-mcp-npm
gh pr create --title "Publish @teamsly/mcp to npm" --body "Packages mcp-server/ as the public npm package @teamsly/mcp so users can connect via \`npx -y @teamsly/mcp\` without cloning the repo. Spec: docs/superpowers/specs/2026-06-04-publish-mcp-npm-design.md"
```

---

## Done criteria

- `npm view @teamsly/mcp version` returns `0.1.0`.
- `npx -y @teamsly/mcp` from a clean directory connects and lists the 9 tools.
- The repo's local dev flow (`npx tsx mcp-server/index.ts`) and the root `npm run build` both still work.
- README leads with the npx install; from-source remains documented for contributors.

## Out of scope (separate effort)

- Path B — hosted remote MCP server (HTTP/SSE + browser OAuth).
- CI publish-on-tag workflow.
- Any change to server tool behavior, auth flow, or the baked-in Azure client ID.
