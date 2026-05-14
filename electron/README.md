# Teamsly Desktop (Electron wrapper)

The Electron wrapper produces installable desktop builds (`.dmg`, `.exe`,
`.AppImage`) of Teamsly. The wrapper itself is minimal — it loads the Teamsly
web app in a `BrowserWindow` and opens external links (Microsoft sign-in,
embedded URLs) in the system browser.

## Configuration

The wrapper loads its UI from `TEAMSLY_URL`:

| Mode | Default | Override |
|---|---|---|
| Development | `http://localhost:3000` | `TEAMSLY_URL=...` |
| Production | `https://teamsly.vercel.app` | `TEAMSLY_URL=...` |

In production, set `TEAMSLY_URL` to your hosted instance (Vercel, self-hosted,
etc.). For a single-binary self-hosted build that ships the Next.js server
inside the app, see *Bundling the server* below — that path is not implemented
yet.

## Desktop features

The wrapper provides these native capabilities on top of the web app:

- **System tray** — a monochrome template icon on macOS (auto-inverts on
  light/dark menu bar) and a colored icon on Windows/Linux. Left-click on
  Windows/Linux toggles the window; right-click everywhere opens a context menu
  with "Open Teamsly" and "Quit Teamsly".
- **Tray tooltip with live unread count** — the renderer pushes the total
  unread count via IPC (`unread-count` channel); the tooltip updates to
  "Teamsly — N unread" when there are pending messages.
- **macOS dock badge** — mirrors the tray tooltip unread count as a red badge
  on the dock icon.
- **Close-to-tray** — closing the window hides it rather than quitting; use the
  tray "Quit" item (or Cmd+Q on macOS) to exit.
- **App menu (macOS)** — standard shortcuts: Cmd+Q quits, Cmd+R reloads,
  Cmd+Shift+R force-reloads, Edit submenu provides cut/copy/paste/select-all
  for text areas, and View › "Check for Updates…" triggers a manual update
  check.
- **Windows App User Model ID** — set to `co.shipthis.teamsly` so renderer-side
  `Notification` shows the correct app name in Windows Action Center.
- **Auto-update** — `electron-updater` checks for updates silently on launch
  and exposes a "Check for Updates…" menu item. A non-modal banner in the
  renderer shows download progress and offers a one-click install when the
  update is ready. Platform behaviour:
  - **Linux (AppImage)** — fully automatic; the new version installs and
    restarts without user intervention.
  - **Windows (NSIS, unsigned)** — download and install succeed; Windows
    SmartScreen shows a warning on each run of the new unsigned installer.
    Once signing is configured the warning disappears.
  - **macOS (unsigned)** — Gatekeeper rejects unsigned auto-install zips on
    Sonoma/Sequoia. The banner shows an "Open release page" button instead;
    the user downloads and re-installs manually from GitHub Releases. This
    limitation lifts automatically once the build is notarized.

### Not yet implemented

- **Global shortcuts** — bring-to-front via a global hotkey is not implemented.
- **Windows overlay icon** — a small red-dot overlay badge on the taskbar icon
  requires an additional icon resource and is deferred.

## Develop

In two terminals:

```bash
# Terminal 1: run the Next.js dev server
npm run dev

# Terminal 2: build and launch Electron pointing at localhost:3000
npm run electron:dev
```

Or in one command (uses `concurrently` + `wait-on` under the hood):

```bash
npm run electron:dev:all
```

## Build a local installer

```bash
npm run electron:build
```

Outputs unsigned installers to `release/`. Unsigned builds are fine for local
testing; for distributable builds see *Code signing* below.

## Release via tag

Pushing a tag of the form `v*.*.*` triggers the `release.yml` GitHub Actions
workflow, which builds for macOS, Windows, and Linux in parallel and uploads
the artifacts to a GitHub Release.

```bash
git tag v0.1.0
git push origin v0.1.0
```

The workflow uses the built-in `GITHUB_TOKEN`; no extra secrets are required
to produce unsigned artifacts.

## Code signing (optional)

For macOS notarization and Windows code signing, set the following repository
secrets and they will be picked up automatically by `electron-builder`:

- `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` — Apple notarization
- `CSC_LINK` (base64-encoded `.p12`), `CSC_KEY_PASSWORD` — code-signing certificate

Without these, builds are unsigned. macOS users will see a Gatekeeper warning
and need to right-click → Open the first time; Windows users will see a
SmartScreen warning. For an OSS project this is acceptable until you have a
real budget for certificates.

## Bundling the server (TODO)

To ship a true single-binary that doesn't require a hosted instance:

1. Add `output: 'standalone'` to `next.config.ts`.
2. Run `next build` and copy `.next/standalone/` into the Electron app
   resources.
3. In `main.ts`, spawn the standalone server as a child process on a free port
   and load `http://127.0.0.1:<port>` once it responds.

This is the path most desktop apps that wrap a web stack take. It is not
implemented in this scaffold; it is a separate piece of work.
