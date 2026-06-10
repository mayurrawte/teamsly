# Desktop local-first shell (Phase 1) — Design

**Date:** 2026-06-10
**Status:** Approved (design)
**Issue:** #70 (Electron: bundle Next standalone for local-first load) — Phase 1.
**Stage:** Phase 1 of the "native feel" track. Later phases (realtime-push refinement, window-chrome polish, motion) are out of scope here.

## Problem

The Electron desktop app loads the **remote** site (`electron/main.ts` → `loadURL('https://teamsly.vercel.app')`). Every shell interaction is a network round-trip, so the desktop app feels like "a website in a window": slow cold start, blank loads, and a hard dependency on connectivity. VSCode (also Electron) feels native because its shell loads from local disk. We want the same: load the app from a **local Next server bundled inside the app**.

The blocker is auth: the hosted app is a **confidential** OAuth client using `AZURE_AD_CLIENT_SECRET`. A locally-bundled server would need that secret inside a distributed binary — extractable, a real security hole. So local-first requires the desktop to authenticate as a **public client** (PKCE, no secret).

## Goal & success criteria (Phase 1)

A packaged desktop build that:
- Boots a **bundled Next standalone server on `127.0.0.1:<ephemeral-port>`** and loads the UI from it (no remote round-trip for the shell).
- Authenticates via **loopback authorization-code + PKCE** as a **public client** — sign-in opens in the system browser and redirects back to the local server. **No secret ships in the binary.**
- Runs the **Graph-backed core locally**: messages, channels, chats, files, presence, search — all using the user's delegated token.
- Lets the user enable **AI and voice via BYO keys** entered in desktop settings (stored encrypted locally, injected into the server as env).
- **Does not change the hosted web app's behavior** (Vercel path is env-branched and untouched) and ships **no new secrets** to the open-source repo.
- `npm run build` (standalone) and `npm run electron:compile` pass.

## Non-goals (deferred)

- Realtime **push** in desktop (Graph webhooks need a public URL) — desktop uses the existing **polling** fallback.
- Window-chrome polish (#71 Windows title bar, motion #72) and reactivity (B2/B3) — separate items.
- macOS notarization (#73, owner-gated).
- Auto-migrating existing remote-mode installs' state — desktop starts fresh local session.

## Key facts established during brainstorming

- **One Azure app registration already serves everything**: `377aa8a2-24d1-4d6e-8eca-e347864c9880`. It is already a confidential client (web/Vercel, with secret) **and** has "Allow public client flows" enabled (MCP device-code). The desktop adds a third usage of the **same** app as a public/PKCE client. Same client ID; the existing secret stays hosted-only; desktop never uses it.
- **Only Azure change needed (owner step):** add a `http://localhost` redirect URI under a "Mobile and desktop applications" platform on that app. Azure matches any port for public-client loopback, so one entry covers the dynamic port. Purely additive — does not affect the hosted Web-platform redirect.
- The MCP server (`mcp-server/index.ts`) already proves public-client auth against this app (device-code). The loopback-PKCE flow is the same public client, different grant.

## Decisions

### A. Auth: env-branched public client + PKCE (`DESKTOP_MODE`)
`src/lib/auth/config.ts` gains a `DESKTOP_MODE` branch. When set (only in the bundled desktop server):
- Configure the Microsoft Entra provider as a **public client**: same `clientId`, **no `clientSecret`**, `client: { token_endpoint_auth_method: "none" }`, `checks: ["pkce", "state"]`.
- The token-**refresh** path (`refreshAccessToken`) omits `client_secret` (public clients refresh without one).
- `NEXTAUTH_URL` is set dynamically to `http://localhost:<port>` at server spawn so the callback resolves to the local server.
The Vercel/web path is byte-for-byte unchanged (confidential client, secret, existing refresh).

### B. Process model: bundled standalone server spawned by Electron
- `next.config.ts`: `output: "standalone"`.
- Packaging copies `.next/standalone`, `.next/static`, and `public` into app resources (electron-builder `extraResources`).
- New `electron/server.ts`: pick a free port; `fork` the standalone `server.js` under Electron's own Node (`ELECTRON_RUN_AS_NODE=1`, no separate node binary) with the right `cwd` + env (`PORT`, `HOSTNAME=127.0.0.1`, `NEXTAUTH_URL`, `AUTH_SECRET`, `AZURE_AD_CLIENT_ID`, `AZURE_AD_TENANT_ID`, `DESKTOP_MODE=1`, plus any BYO keys); health-check `GET /` until ready; return the base URL. Terminate the child on app quit (`before-quit`).
- `electron/main.ts`: dev → `http://localhost:3000` (unchanged); packaged → `await startLocalServer()` then `loadURL(baseUrl)`. The existing `did-fail-load` offline-fallback covers spawn/health failures.

### C. No shipped secrets — per-install secret + BYO keys via `safeStorage`
- **`AUTH_SECRET`**: generated on first run (`crypto.randomBytes`), persisted encrypted via Electron `safeStorage` in `app.getPath('userData')`. Used to encrypt the local NextAuth session. Per-install, never shipped.
- **BYO keys** (`OPENAI_API_KEY`, `OPENAI_BASE_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `NEXT_PUBLIC_LIVEKIT_URL`): entered in a desktop-only settings panel → IPC → main persists encrypted (`safeStorage`) → injected as env vars when the server is spawned. Unset → the existing "not configured" cards show. Graph-core needs none of these.

### D. Risk-gated sequencing: auth spike first
The load-bearing bet is "NextAuth v5 + Entra public client + PKCE + loopback works against `377aa8a2`." The plan will **prove this in a minimal harness first** (a dev run with `DESKTOP_MODE` + a localhost callback, real sign-in) before building packaging/spawn. If NextAuth's Entra provider can't do public-PKCE cleanly, the fallback is the **device-code** grant (as MCP uses) feeding a custom local session — decided at the spike, not after building everything.

## Architecture & data flow

```
Electron main (packaged)
  ├─ ensureAuthSecret()            [safeStorage in userData]
  ├─ loadByoKeys()                 [safeStorage] → env
  ├─ startLocalServer():
  │     port = freePort()
  │     fork(standalone/server.js, { ELECTRON_RUN_AS_NODE:1,
  │            env: { PORT, HOSTNAME:127.0.0.1, NEXTAUTH_URL:http://localhost:port,
  │                   AUTH_SECRET, AZURE_AD_CLIENT_ID, AZURE_AD_TENANT_ID,
  │                   DESKTOP_MODE:1, ...byoKeys } })
  │     await healthCheck(http://localhost:port)
  │     return baseUrl
  └─ mainWindow.loadURL(baseUrl)
        │
        ▼  (renderer = the real Next app, served locally)
  Sign in → shell.openExternal(authorize URL, PKCE) → system browser → Microsoft
        → redirect http://localhost:port/api/auth/callback/microsoft-entra-id
        → local NextAuth exchanges code+verifier (no secret) → session cookie (local)
        │
        ▼
  API routes run locally; Graph calls use the user's delegated token.
  AI/voice routes read BYO keys from env (if provided).
```

## Components & interfaces

### `next.config.ts` (modify)
Add `output: "standalone"`. (Vercel ignores this for its own build tracing; verify the Vercel build stays green. If any friction, gate behind `process.env.BUILD_STANDALONE`.)

### `electron/server.ts` (new)
```ts
export interface LocalServer { baseUrl: string; port: number; stop(): void; }
export async function startLocalServer(env: Record<string,string>): Promise<LocalServer>
```
- `freePort()` via a transient `net.Server` listen on 0.
- `fork(serverEntry, { env: { ...process.env, ...env, ELECTRON_RUN_AS_NODE: "1" }, cwd: standaloneDir })`.
- `healthCheck(baseUrl, timeoutMs)` polling until a 200/redirect.
- `stop()` kills the child; called from `before-quit`.

### `electron/main.ts` (modify)
- Import `startLocalServer`; in packaged mode build the env (auth secret + BYO + Azure client/tenant + `DESKTOP_MODE`), start the server, `loadURL` the returned base URL. Keep dev path. Kill child on quit. Keep the offline-fallback handler.

### `electron/secrets.ts` (new)
- `ensureAuthSecret(): string` — read-or-generate, encrypted via `safeStorage`, persisted in `userData/auth-secret.bin`.
- `loadByoKeys(): Record<string,string>` / `saveByoKeys(partial)` — encrypted JSON in `userData/byo-keys.bin`. IPC handlers (`byo:get` masked, `byo:set`) wired in main.

### `src/lib/auth/config.ts` (modify)
- `const DESKTOP = process.env.DESKTOP_MODE === "1";` Branch the provider config (public/PKCE/no-secret when `DESKTOP`) and `refreshAccessToken` (no `client_secret` when `DESKTOP`). Web path unchanged.

### Desktop settings UI (new, desktop-only)
- A settings panel (gated on an "is desktop" signal, e.g. a `window.teamsly?.isDesktop` exposed by preload) to enter BYO keys → IPC `byo:set`. Lives alongside existing settings/preferences UI. Web build never shows it.

### `electron-builder.json` (modify)
- Add `extraResources` for `.next/standalone`, `.next/static`, `public` (mapped into the resources dir the server reads).

### `.github/workflows/release.yml` (modify)
- Before `electron-builder`: `npm run build` then a copy step (`.next/static` + `public` into `.next/standalone`). Across all three OSes.

### `electron/README.md` (modify)
- Replace "Bundling the server … not implemented yet" with the real local-first description + the Azure loopback-redirect owner step.

## Error handling & edge cases

| Condition | Behavior |
|---|---|
| Server spawn fails / port busy | retry once on a new port → else offline-fallback page |
| Health-check timeout | offline-fallback page + visible window |
| Auth (loopback) fails | existing NextAuth error surface; user can retry sign-in |
| Missing BYO key | existing "AI/voice not configured" cards |
| App quit | child server killed in `before-quit` |
| Dev mode | unchanged — loads the Next dev server, no spawn |
| `safeStorage` unavailable | fall back to an obfuscated-but-unencrypted file + warn (rare; Linux without a keyring) |

## What works in desktop Phase 1
- ✅ Local + instant: shell, messages, channels, chats, files, presence, search (Graph-core).
- ✅ AI + voice **with BYO keys**.
- ⚠️ Realtime falls back to polling (webhooks need a public URL).

## Hosted-version safety (hard requirement)
- The Vercel app never sets `DESKTOP_MODE`, so it runs today's exact confidential-client + remote path. Same Azure app, same secret, unchanged Web redirect.
- The only shared-file changes are the env-guarded `auth/config.ts` branch and `next.config.ts` `output`. Both verified by `npm run build` + the PR CI; the web behavior must remain identical.

## Testing / verification (honest)
- `npm run build` (produces `.next/standalone`) and `npm run electron:compile` green.
- **Auth spike** (gate): dev run with `DESKTOP_MODE=1` + localhost callback completes a real Microsoft sign-in via PKCE (no secret) and loads Graph data.
- **Packaged build (your machine):** app launches, spawns the local server, signs in via loopback in the system browser, lists real Teams/chats; AI works after entering a BYO key; quitting kills the server.
- Much of this is **only verifiable on a real packaged build on your machine** — the plan will state exactly what to test; CI covers build/compile, not the OAuth/packaged-spawn path.

## Risks
1. **NextAuth public-PKCE with Entra** (load-bearing) — mitigated by the auth-spike-first gate; device-code fallback if needed.
2. **Standalone packaging gaps** (static/public copy, cwd, Node resolution under `ELECTRON_RUN_AS_NODE`) — standard Next-standalone-in-Electron gotchas; validated on a packaged build.
3. **App size** grows (ships the Next server + minimal node_modules) — expected.
4. **`output: "standalone"` on Vercel** — low risk; gate behind an env flag if it interferes.

## File-change summary
New: `electron/server.ts`, `electron/secrets.ts`, desktop BYO-settings UI (+ preload `isDesktop` flag + IPC).
Modified: `electron/main.ts`, `next.config.ts`, `src/lib/auth/config.ts`, `electron-builder.json`, `.github/workflows/release.yml`, `electron/README.md`, preload script.

## Owner steps (not code)
1. Azure portal → app `377aa8a2` → Authentication → add platform "Mobile and desktop applications" → redirect URI `http://localhost`. (Public client flows already enabled.)
2. Nothing else: same client ID, same secret (hosted-only), same scopes/consent.
