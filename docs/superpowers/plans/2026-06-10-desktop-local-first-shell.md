# Desktop local-first shell (Phase 1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the packaged desktop app load from a bundled Next standalone server on `127.0.0.1` (instant local shell) instead of the remote site, authenticating as a public client via loopback PKCE (no secret shipped), with AI/voice enabled by user-supplied BYO keys.

**Architecture:** A `DESKTOP_MODE` env branch turns NextAuth into a public PKCE client. In packaged builds, Electron's main process spawns the bundled `.next/standalone/server.js` under its own Node on an ephemeral loopback port, injecting a per-install `AUTH_SECRET` + encrypted BYO keys as env, then loads that URL. The hosted/Vercel path is untouched.

**Tech Stack:** Electron (main/preload, `safeStorage`, `child_process.fork`, `net`), Next.js standalone output, NextAuth v5 (Microsoft Entra, public client + PKCE), electron-builder.

---

## CRITICAL: this is risk-gated. Task 1 is a GATE.

Task 1 proves NextAuth + Entra **public-client PKCE loopback** works against app `377aa8a2`. **Do not start Tasks 2+ until Task 1 passes.** If it cannot be made to work, STOP and report — the fallback is a device-code grant (as `mcp-server/index.ts` uses), which changes Tasks involving auth and needs a spec amendment.

**Owner prerequisite (do first, manual):** In Azure portal → app `377aa8a2-24d1-4d6e-8eca-e347864c9880` → Authentication → Add platform → "Mobile and desktop applications" → add redirect URI `http://localhost`. ("Allow public client flows" is already enabled.) Without this, Task 1 cannot pass.

## Testing note

No test runner in this repo; the gate is the build + manual verification. Per task: `npx tsc --noEmit 2>&1 | grep -v "src/lib/auth/config.ts"` (expect empty) and `npm run electron:compile` (electron TS). Milestones run `npm run build`. The OAuth loopback and packaged-spawn paths are **only fully verifiable on a real packaged build / dev run on your machine** — each such step says so explicitly.

**Commits:** Conventional Commit prefixes, **no AI/agent co-author trailer** (per `CLAUDE.md`). Branch `feat/desktop-local-first` (already created; the spec is committed there). Subagents: do NOT run `git checkout/switch/reset/branch`; confirm `git branch --show-current` is `feat/desktop-local-first` before each commit.

---

## File structure

New:
- `electron/server.ts` — spawn + manage the bundled Next standalone server (free port, fork, health-check, stop).
- `electron/secrets.ts` — per-install `AUTH_SECRET` + encrypted BYO-key storage via `safeStorage`.
- `scripts/prepare-standalone.mjs` — copy `.next/static` + `public` into `.next/standalone` after build (Next standalone gotcha).
- `src/components/desktop/DesktopAiKeys.tsx` — desktop-only BYO-key settings panel.

Modified:
- `src/lib/auth/config.ts` — `DESKTOP_MODE` public-PKCE branch + secret-less refresh.
- `next.config.ts` — `output: "standalone"`.
- `electron/main.ts` — start local server in packaged mode; dynamic app URL; kill on quit; BYO IPC.
- `electron/preload.ts` — expose `isDesktop` + `getByoKeys`/`setByoKeys`.
- `electron-builder.json` — bundle standalone output via `extraResources`.
- `.github/workflows/release.yml` — `next build` + `prepare-standalone` before `electron-builder`.
- `electron/README.md` — document local-first + the Azure loopback redirect.
- the settings/preferences modal — mount `DesktopAiKeys` when running in Electron.

---

## Task 1 (GATE): Auth spike — NextAuth public-client PKCE loopback

**Files:**
- Modify: `src/lib/auth/config.ts`

- [ ] **Step 1: Add the `DESKTOP_MODE` branch to the provider + refresh**

In `src/lib/auth/config.ts`, add near the top (after imports):

```ts
const DESKTOP = process.env.DESKTOP_MODE === "1";
```

Change the `refreshAccessToken` body's `params` so the secret is omitted in desktop mode:

```ts
  const params = new URLSearchParams({
    client_id: process.env.AZURE_AD_CLIENT_ID!,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    scope: SCOPE,
  });
  if (!DESKTOP) {
    params.set("client_secret", process.env.AZURE_AD_CLIENT_SECRET!);
  }
```

Change the `MicrosoftEntraID({...})` provider config to:

```ts
    MicrosoftEntraID({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      ...(DESKTOP ? {} : { clientSecret: process.env.AZURE_AD_CLIENT_SECRET! }),
      issuer: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID ?? "common"}/v2.0`,
      authorization: { params: { scope: SCOPE } },
      // Desktop is a public client: no secret, prove possession with PKCE.
      ...(DESKTOP
        ? { client: { token_endpoint_auth_method: "none" as const }, checks: ["pkce", "state"] as ("pkce" | "state")[] }
        : {}),
    }),
```

- [ ] **Step 2: Type/compile check**

Run: `npx tsc --noEmit 2>&1 | grep -v "src/lib/auth/config.ts"`
Expected: no output. (If the `client`/`checks` overrides don't type against the installed next-auth, adjust to the version's accepted shape — e.g. cast the provider options — and note what you changed. Do NOT proceed past the gate on a type error.)

- [ ] **Step 3: MANUAL spike (your machine) — prove the flow**

Ensure the Azure loopback redirect URI is added (owner prerequisite above). Then run the dev server in desktop mode:

```bash
DESKTOP_MODE=1 NEXTAUTH_URL=http://localhost:3000 npm run dev
```

Open `http://localhost:3000`, sign in with Microsoft. Expected: the OAuth round-trip completes and a session is established **without** a client secret (PKCE). Confirm by loading the workspace and seeing real Teams/chats (a Graph call succeeded with the delegated token). If you see `AADSTS` errors about client assertion/secret, the public-client config or the Azure redirect/platform is off.

- [ ] **Step 4: GATE decision**

- **Pass** (sign-in works, Graph loads) → commit and continue to Task 2.
- **Fail** → STOP. Report the exact `AADSTS`/NextAuth error. Do not build the rest; we pivot to device-code (spec amendment).

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/config.ts
git commit -m "feat(auth): desktop-mode public-client PKCE branch (no secret)"
```

---

## Task 2: Next standalone output + post-build copy script

**Files:**
- Modify: `next.config.ts`
- Create: `scripts/prepare-standalone.mjs`

- [ ] **Step 1: Enable standalone output**

In `next.config.ts`, add `output: "standalone"` to the config object (keep everything else):

```ts
const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: process.cwd(),
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.microsoft.com" },
      { protocol: "https", hostname: "**.microsoftonline.com" },
    ],
  },
};
```

- [ ] **Step 2: Create the copy script**

Next's standalone output omits `.next/static` and `public`; they must be copied next to `server.js`. Create `scripts/prepare-standalone.mjs`:

```js
import { cp, access } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const standalone = join(root, ".next", "standalone");

async function exists(p) {
  try { await access(p); return true; } catch { return false; }
}

if (!(await exists(join(standalone, "server.js")))) {
  console.error("[prepare-standalone] .next/standalone/server.js missing — run `next build` with output:'standalone' first.");
  process.exit(1);
}

await cp(join(root, ".next", "static"), join(standalone, ".next", "static"), { recursive: true });
if (await exists(join(root, "public"))) {
  await cp(join(root, "public"), join(standalone, "public"), { recursive: true });
}
console.log("[prepare-standalone] copied static + public into .next/standalone");
```

- [ ] **Step 3: Build + verify standalone (milestone)**

Run: `npm run build && node scripts/prepare-standalone.mjs`
Expected: build exits 0; the script prints "copied static + public" and `.next/standalone/server.js`, `.next/standalone/.next/static`, `.next/standalone/public` exist.
Also run `npx tsc --noEmit 2>&1 | grep -v "src/lib/auth/config.ts"` → empty.

- [ ] **Step 4: Verify Vercel-path safety**

`output: "standalone"` must not break the web build. The `npm run build` above is the same build Vercel runs; if it's green, the hosted build is fine. (If a future Vercel deploy ever objects, gate via `output: process.env.BUILD_STANDALONE ? "standalone" : undefined` — not needed unless it errors.)

- [ ] **Step 5: Commit**

```bash
git add next.config.ts scripts/prepare-standalone.mjs
git commit -m "build(desktop): emit Next standalone + copy static/public"
```

---

## Task 3: `electron/secrets.ts` — per-install AUTH_SECRET + BYO keys

**Files:**
- Create: `electron/secrets.ts`

- [ ] **Step 1: Create the module**

```ts
import { app, safeStorage } from 'electron';
import { randomBytes } from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';

const userData = (): string => app.getPath('userData');
const authSecretPath = (): string => path.join(userData(), 'auth-secret.bin');
const byoPath = (): string => path.join(userData(), 'byo-keys.bin');

// The env var names the bundled Next server reads. Keep in sync with the
// settings UI and the spawn env in electron/server.ts.
export const BYO_KEYS = [
  'OPENAI_API_KEY',
  'OPENAI_BASE_URL',
  'LIVEKIT_API_KEY',
  'LIVEKIT_API_SECRET',
  'NEXT_PUBLIC_LIVEKIT_URL',
] as const;
export type ByoKey = (typeof BYO_KEYS)[number];

function encryptToFile(file: string, plain: string): void {
  const data = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(plain)
    : Buffer.from('PLAIN:' + plain, 'utf8'); // rare fallback (e.g. Linux w/o keyring)
  writeFileSync(file, data);
}

function decryptFromFile(file: string): string | null {
  if (!existsSync(file)) return null;
  const buf = readFileSync(file);
  if (buf.subarray(0, 6).toString('utf8') === 'PLAIN:') return buf.subarray(6).toString('utf8');
  try {
    return safeStorage.decryptString(buf);
  } catch {
    return null;
  }
}

/** Read-or-generate a per-install NextAuth secret. Never shipped in the binary. */
export function ensureAuthSecret(): string {
  const existing = decryptFromFile(authSecretPath());
  if (existing) return existing;
  const secret = randomBytes(32).toString('base64');
  encryptToFile(authSecretPath(), secret);
  return secret;
}

/** All saved BYO keys (decrypted) as an env map. Empty when none set. */
export function loadByoKeys(): Record<string, string> {
  const raw = decryptFromFile(byoPath());
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    const out: Record<string, string> = {};
    for (const k of BYO_KEYS) {
      const v = parsed[k];
      if (typeof v === 'string' && v.length > 0) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

/** Merge + persist BYO keys. Empty-string values delete that key. */
export function saveByoKeys(partial: Record<string, string>): void {
  const current = loadByoKeys();
  for (const k of BYO_KEYS) {
    if (k in partial) {
      const v = partial[k];
      if (v) current[k] = v;
      else delete current[k];
    }
  }
  encryptToFile(byoPath(), JSON.stringify(current));
}

/** Which BYO keys are set (names only — never return values to the renderer). */
export function byoKeyStatus(): Record<string, boolean> {
  const set = loadByoKeys();
  return Object.fromEntries(BYO_KEYS.map((k) => [k, Boolean(set[k])]));
}
```

- [ ] **Step 2: Compile check**

Run: `npm run electron:compile`
Expected: exit 0 (compiles `electron/**/*.ts` → `electron/dist`).

- [ ] **Step 3: Commit**

```bash
git add electron/secrets.ts
git commit -m "feat(desktop): per-install auth secret + encrypted BYO key store"
```

---

## Task 4: `electron/server.ts` — spawn the bundled Next server

**Files:**
- Create: `electron/server.ts`

- [ ] **Step 1: Create the module**

```ts
import { app } from 'electron';
import { fork, type ChildProcess } from 'child_process';
import { createServer } from 'net';
import http from 'http';
import path from 'path';

export interface LocalServer {
  baseUrl: string;
  port: number;
  stop: () => void;
}

// In a packaged app, extraResources land under process.resourcesPath. The
// standalone server entry is server.js at the root of the copied standalone dir.
function standaloneEntry(): string {
  return path.join(process.resourcesPath, 'standalone', 'server.js');
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      srv.close(() => resolve(port));
    });
  });
}

function healthCheck(baseUrl: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(baseUrl, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() > deadline) reject(new Error('local server health-check timed out'));
        else setTimeout(tick, 150);
      });
    };
    tick();
  });
}

/**
 * Spawn the bundled Next standalone server on a free loopback port using
 * Electron's own Node (ELECTRON_RUN_AS_NODE), then wait until it responds.
 * `env` carries NEXTAUTH/AUTH_SECRET/Azure/BYO values.
 */
export async function startLocalServer(env: Record<string, string>): Promise<LocalServer> {
  const port = await freePort();
  const baseUrl = `http://localhost:${port}`;
  const entry = standaloneEntry();

  const child: ChildProcess = fork(entry, [], {
    cwd: path.dirname(entry),
    env: {
      ...process.env,
      ...env,
      ELECTRON_RUN_AS_NODE: '1',
      PORT: String(port),
      HOSTNAME: '127.0.0.1',
      NEXTAUTH_URL: baseUrl,
      NODE_ENV: 'production',
    },
    stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
  });

  child.on('exit', (code) => {
    if (code && code !== 0) console.error(`[local-server] exited with code ${code}`);
  });

  await healthCheck(baseUrl, 20_000);

  const stop = () => {
    try { child.kill(); } catch { /* already gone */ }
  };
  app.on('before-quit', stop);
  return { baseUrl, port, stop };
}
```

- [ ] **Step 2: Compile check**

Run: `npm run electron:compile`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add electron/server.ts
git commit -m "feat(desktop): spawn bundled Next standalone on loopback"
```

---

## Task 5: Wire `electron/main.ts` — start server in packaged mode + BYO IPC

**Files:**
- Modify: `electron/main.ts`

Read the file first. Make these edits:

- [ ] **Step 1: Imports**

Add after the existing imports (line 3):

```ts
import { startLocalServer, type LocalServer } from './server';
import { ensureAuthSecret, loadByoKeys, saveByoKeys, byoKeyStatus } from './secrets';
```

- [ ] **Step 2: Make the app URL dynamic**

Replace the module-level `const TEAMSLY_URL = ...` (lines 10–11) with:

```ts
// Resolved at startup: dev → Next dev server; packaged → the local bundled
// server we spawn (set in whenReady). An explicit TEAMSLY_URL still overrides
// (e.g. to point a build at a hosted instance).
let appUrl = process.env.TEAMSLY_URL || 'http://localhost:3000';
let localServer: LocalServer | null = null;
```

In `createWindow()`, replace `void mainWindow.loadURL(TEAMSLY_URL);` (line 312) with `void mainWindow.loadURL(appUrl);`, and in the `did-fail-load` handler replace `offlineFallbackUrl(TEAMSLY_URL)` (line 308) with `offlineFallbackUrl(appUrl)`.

- [ ] **Step 3: Start the local server before creating the window**

Replace the `app.whenReady().then(() => { ... })` block (lines 404–416) with:

```ts
void app.whenReady().then(async () => {
  buildAppMenu();
  tray = buildTrayIcon();

  // Packaged builds load from a locally-spawned Next server (local-first).
  // Dev and explicit-TEAMSLY_URL builds keep their remote/dev URL.
  if (!isDev && !process.env.TEAMSLY_URL) {
    try {
      localServer = await startLocalServer({
        AUTH_SECRET: ensureAuthSecret(),
        DESKTOP_MODE: '1',
        AZURE_AD_CLIENT_ID: process.env.AZURE_AD_CLIENT_ID ?? '377aa8a2-24d1-4d6e-8eca-e347864c9880',
        AZURE_AD_TENANT_ID: process.env.AZURE_AD_TENANT_ID ?? 'common',
        ...loadByoKeys(),
      });
      appUrl = localServer.baseUrl;
    } catch (err) {
      console.error('[main] local server failed to start:', (err as Error).message);
      // appUrl stays at its default; did-fail-load shows the offline page.
    }
  }

  createWindow();
  setupAutoUpdater();

  if (!isDev) {
    void autoUpdater.checkForUpdates().catch((err: Error) => {
      console.error('[auto-updater] startup check failed:', err.message);
    });
  }
});
```

- [ ] **Step 4: BYO IPC handlers**

Add to the IPC section (after the existing `ipcMain.on(...)` handlers, ~line 400):

```ts
// BYO keys: the renderer only ever sees which keys are SET (booleans), never
// the values. Saved keys take effect on the next app launch (server respawn).
ipcMain.handle('byo:status', () => byoKeyStatus());
ipcMain.handle('byo:set', (_event, partial: Record<string, string>) => {
  saveByoKeys(partial ?? {});
  return byoKeyStatus();
});
```

- [ ] **Step 5: Kill the server on quit**

The `startLocalServer` call already registers its `stop` on `before-quit`. Leave the existing `before-quit` handler (sets `isQuitting`) as-is.

- [ ] **Step 6: Compile check**

Run: `npm run electron:compile`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add electron/main.ts
git commit -m "feat(desktop): boot local server in packaged mode; BYO key IPC"
```

---

## Task 6: Expose desktop bridge in `electron/preload.ts`

**Files:**
- Modify: `electron/preload.ts`

- [ ] **Step 1: Add the BYO + desktop API to the exposed object**

In the `contextBridge.exposeInMainWorld('electron', { ... })` object, add these members (alongside the existing ones, before the closing `})`):

```ts
  /** True when running in the packaged/desktop app (always true here). */
  isDesktop: (): true => true,
  /** Which BYO keys are currently set (names→boolean; never the values). */
  getByoStatus: (): Promise<Record<string, boolean>> => ipcRenderer.invoke('byo:status'),
  /** Save BYO keys (empty string deletes one). Returns the new status map. */
  setByoKeys: (partial: Record<string, string>): Promise<Record<string, boolean>> =>
    ipcRenderer.invoke('byo:set', partial),
```

- [ ] **Step 2: Compile check**

Run: `npm run electron:compile`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add electron/preload.ts
git commit -m "feat(desktop): expose isDesktop + BYO key bridge in preload"
```

---

## Task 7: BYO-key settings panel (renderer)

**Files:**
- Create: `src/components/desktop/DesktopAiKeys.tsx`
- Modify: the settings/preferences modal to mount it when in Electron.

- [ ] **Step 1: Create the panel**

```tsx
"use client";

import { useEffect, useState } from "react";

// Mirrors electron/secrets.ts BYO_KEYS. Each field is write-only from the UI;
// we only learn whether a key is set, never its value.
const FIELDS: { key: string; label: string; placeholder: string }[] = [
  { key: "OPENAI_API_KEY", label: "OpenAI / Azure key", placeholder: "sk-… or Azure key" },
  { key: "OPENAI_BASE_URL", label: "OpenAI base URL (optional)", placeholder: "https://….openai.azure.com/openai/v1/" },
  { key: "LIVEKIT_API_KEY", label: "LiveKit API key", placeholder: "API…" },
  { key: "LIVEKIT_API_SECRET", label: "LiveKit API secret", placeholder: "secret…" },
  { key: "NEXT_PUBLIC_LIVEKIT_URL", label: "LiveKit URL", placeholder: "wss://….livekit.cloud" },
];

type DesktopApi = {
  getByoStatus: () => Promise<Record<string, boolean>>;
  setByoKeys: (partial: Record<string, string>) => Promise<Record<string, boolean>>;
};

function desktopApi(): DesktopApi | null {
  const w = window as unknown as { electron?: Partial<DesktopApi> & { isDesktop?: () => boolean } };
  if (!w.electron?.isDesktop?.() || !w.electron.getByoStatus || !w.electron.setByoKeys) return null;
  return w.electron as DesktopApi;
}

export function DesktopAiKeys() {
  const api = desktopApi();
  const [status, setStatus] = useState<Record<string, boolean>>({});
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!api) return;
    void api.getByoStatus().then(setStatus);
  }, [api]);

  if (!api) return null; // web build / non-desktop: render nothing

  async function save() {
    const next = await api!.setByoKeys(draft);
    setStatus(next);
    setDraft({});
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">AI &amp; voice keys</h3>
        <p className="text-[12px] text-[var(--text-muted)]">
          Stored encrypted on this device and used only by the local app. Changes apply on next launch.
        </p>
      </div>
      {FIELDS.map((f) => (
        <label key={f.key} className="flex flex-col gap-1 text-[12px] text-[var(--text-secondary)]">
          <span>
            {f.label} {status[f.key] ? <span className="text-[var(--accent)]">• set</span> : null}
          </span>
          <input
            type="password"
            autoComplete="off"
            placeholder={status[f.key] ? "•••••••• (leave blank to keep)" : f.placeholder}
            value={draft[f.key] ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
            className="rounded border border-[var(--border)] bg-[var(--message-bg)] px-2 py-1.5 text-[13px] text-[var(--text-primary)]"
          />
        </label>
      ))}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void save()}
          className="rounded bg-[var(--accent)] px-3 py-1.5 text-[12px] font-medium text-white"
        >
          Save keys
        </button>
        {saved && <span className="text-[12px] text-[var(--text-muted)]">Saved — relaunch to apply</span>}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Mount it in the settings UI (desktop-only)**

Find the preferences/settings modal (search: `grep -rl "PreferencesModal\|SettingsModal" src/components`). Import and render `<DesktopAiKeys />` in an appropriate section/tab. The component self-hides on web (returns `null` when not in Electron), so it's safe to mount unconditionally.

```tsx
import { DesktopAiKeys } from "@/components/desktop/DesktopAiKeys";
// …inside the modal body / an "Advanced" or "Desktop" section:
<DesktopAiKeys />
```

- [ ] **Step 3: Build check (milestone)**

Run: `npm run build`
Expected: exit 0 (the component compiles in the web build and renders nothing there).

- [ ] **Step 4: Commit**

```bash
git add src/components/desktop/DesktopAiKeys.tsx <the-modified-settings-file>
git commit -m "feat(desktop): BYO AI/voice key settings panel (desktop-only)"
```

---

## Task 8: Package the standalone server with electron-builder

**Files:**
- Modify: `electron-builder.json`

- [ ] **Step 1: Bundle the standalone output as a resource**

Add an `extraResources` entry so the prepared `.next/standalone` dir ships under `process.resourcesPath/standalone` (matching `standaloneEntry()` in `electron/server.ts`). Insert at the top level of `electron-builder.json` (sibling of `files`):

```json
  "extraResources": [
    { "from": ".next/standalone", "to": "standalone" }
  ],
```

- [ ] **Step 2: Verify the JSON is valid**

Run: `node -e "JSON.parse(require('fs').readFileSync('electron-builder.json','utf8')); console.log('ok')"`
Expected: `ok`.

- [ ] **Step 3: Commit**

```bash
git add electron-builder.json
git commit -m "build(desktop): bundle Next standalone via extraResources"
```

---

## Task 9: Release pipeline — build standalone before packaging

**Files:**
- Modify: `.github/workflows/release.yml`

- [ ] **Step 1: Add build + prepare steps before electron-builder**

Read `release.yml`. The build job already does `npm ci`. After install and before the electron-builder/`electron:build` step, add:

```yaml
      - name: Build Next standalone
        run: npm run build

      - name: Prepare standalone (copy static + public)
        run: node scripts/prepare-standalone.mjs
```

(Keep the existing `electron:compile`/electron-builder steps. The order must be: install → next build → prepare-standalone → electron:compile → electron-builder.)

- [ ] **Step 2: Validate the workflow YAML**

Run: `node -e "require('js-yaml')" 2>/dev/null && npx --yes js-yaml .github/workflows/release.yml >/dev/null && echo "yaml ok" || python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/release.yml')); print('yaml ok')"`
Expected: `yaml ok`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "ci(desktop): build + prepare Next standalone before electron-builder"
```

---

## Task 10: Docs + final verification

**Files:**
- Modify: `electron/README.md`

- [ ] **Step 1: Update the README**

Replace the "Bundling the server … not implemented yet" section with the local-first description: packaged builds spawn the bundled `.next/standalone` server on a loopback port and authenticate as a public PKCE client; AI/voice use BYO keys entered in settings; the owner must add an `http://localhost` redirect URI to Azure app `377aa8a2` (Mobile and desktop platform).

- [ ] **Step 2: Final build + electron compile (milestone)**

Run: `npm run build && node scripts/prepare-standalone.mjs && npm run electron:compile`
Expected: all exit 0.

- [ ] **Step 3: MANUAL packaged smoke test (your machine)**

```bash
npm run electron:build   # electron-builder --publish never
```
Install/run the produced artifact and verify:
- App launches and shows the UI from the **local** server (no network needed for the shell; check it loads with Wi-Fi briefly off after sign-in).
- "Sign in" opens the system browser, completes Microsoft auth, returns to the app; real Teams/chats load.
- Settings → enter your Azure-OpenAI key → relaunch → the Catch-up/AI panels work.
- Quitting via tray fully exits (no orphaned node process: `ps aux | grep server.js`).

- [ ] **Step 4: Commit**

```bash
git add electron/README.md
git commit -m "docs(desktop): document local-first server + Azure loopback redirect"
```

---

## Self-review

**Spec coverage:**
- Bundled standalone on loopback → Tasks 2, 4, 5, 8. ✓
- Public-client PKCE loopback auth, no secret → Task 1 (gate). ✓
- Graph-core local (no app secret) → works via Task 1 auth + the existing routes (the user's delegated token); no new task needed. ✓
- BYO keys (safeStorage, env injection) → Tasks 3, 5, 6, 7. ✓
- Per-install AUTH_SECRET → Task 3 + injected in Task 5. ✓
- Hosted untouched (DESKTOP_MODE branch, Vercel build green) → Task 1 (guarded branch) + Task 2 Step 4. ✓
- Packaging + release pipeline → Tasks 8, 9. ✓
- Realtime = polling fallback in desktop → inherent (no webhook target); no task needed. ✓
- Auth-spike-first gate → Task 1 is the explicit gate. ✓
- Owner Azure step → called out at top + Task 10 README. ✓

**Placeholder scan:** No TBD/TODO; complete code in each code step. The settings-modal mount point (Task 7 Step 2) is a `grep`-then-insert because the exact modal file isn't pinned here — that's a concrete instruction, not a placeholder.

**Type/name consistency:** `startLocalServer(env)`/`LocalServer` (Task 4) used in Task 5. `ensureAuthSecret`/`loadByoKeys`/`saveByoKeys`/`byoKeyStatus` + `BYO_KEYS` (Task 3) used in Tasks 5/6. IPC channels `byo:status`/`byo:set` consistent across Tasks 5/6/7. `DESKTOP_MODE` consistent across Tasks 1/5. `standaloneEntry()` path (`resourcesPath/standalone`) matches `extraResources` `"to": "standalone"` (Tasks 4/8). `appUrl`/`localServer` consistent in Task 5.

**Risk note:** Task 1 is load-bearing. If it fails, Tasks 5's `DESKTOP_MODE`/auth env and the auth branch change to a device-code design — stop and amend the spec rather than proceeding.
