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
| Production | `https://teamsly.app` | `TEAMSLY_URL=...` |

In production, set `TEAMSLY_URL` to your hosted instance (Vercel, self-hosted,
etc.). For a single-binary self-hosted build that ships the Next.js server
inside the app, see *Bundling the server* below — that path is not implemented
yet.

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
