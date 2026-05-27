# Website Overhaul — Design Spec

**Date:** 2026-05-27  
**Status:** Approved  
**Scope:** `site/` directory only — no changes to the app (`src/`)

---

## Goal

Make installation, self-hosting, download links, features, and roadmap immediately clear
to any visitor arriving at teamsly.app. Currently the site has the right sections but they
are thin or missing detail. This spec adds a Roadmap section, redesigns the Download section,
replaces the inline self-host block with a dedicated install page, and fixes minor content
inaccuracies.

---

## Decisions made

| Topic | Decision |
|---|---|
| Structure | Landing page (`index.html`) + new separate `install.html` |
| Roadmap style | Two-column shipped/planned list with version badges |
| Download UX | OS-detected tab + Homebrew primary on macOS, direct buttons on all platforms |
| Install page depth | Quick-start (3 steps) + link out to `SELF_HOSTING.md` for full Azure AD guide |
| Implementation | Pure HTML/CSS — no build scripts, no framework migration |

---

## Files changed

| File | Change type |
|---|---|
| `site/index.html` | Edit — nav, hero, features, download, roadmap (new), self-host CTA |
| `site/install.html` | New |
| `site/styles.css` | Edit — append ~80–100 lines for new components |

---

## `index.html` changes

### Nav

- Add anchor `#roadmap` between `#download` and `#install`
- Change `#install` Self-host nav link → `install.html` (hard link, not anchor)

### Hero

- Add "Try the web app →" as a third action button linking to `https://teamsly.app`
  (or however the hosted instance is served — use the real domain, not `teamsly.vercel.app`)

### Features section

Replace the 6 existing cards with accurate shipped features:

| Card title | Description |
|---|---|
| Channels & direct messages | Workspace switcher, sidebar nav, unread counts, presence indicators |
| Threads & reactions | Slide-in thread panel, optimistic replies, animated reaction pills |
| Disappearing messages | DM-only; sender picks 30s/5min/1hr; countdown badge; auto-delete on expiry |
| Voice rooms | In-app voice via LiveKit; join/leave without leaving Teams |
| Cmd+K & search | Jump to any channel, DM, or contact in two keystrokes |
| AI summaries & MCP | Catch up on long threads; MCP server for Claude Desktop/Cursor integration |

### Download section

**Redesign — replaces the current three-card grid:**

1. Section heading + version badge: "Download Teamsly" + `v0.3.0` pill
2. Three tab buttons: macOS / Windows / Linux
3. Small `<script>` at bottom of section detects `navigator.platform` /
   `navigator.userAgent` and calls `switchTab('mac'|'win'|'linux')` on page load
4. Tab content per platform:

**macOS tab (default)**
- Homebrew command block (primary — larger visual weight):
  ```
  brew tap mayurrawte/teamsly
  brew install --cask teamsly
  ```
- Secondary row of two links: "Apple Silicon (.dmg)" and "Intel (.dmg)"
  pointing to:
  - `https://github.com/mayurrawte/teamsly/releases/download/v0.3.0/Teamsly-0.3.0-arm64.dmg`
  - `https://github.com/mayurrawte/teamsly/releases/download/v0.3.0/Teamsly-0.3.0.dmg`
- Note: "Unsigned — right-click → Open on first launch"

**Windows tab**
- Primary button: "Download Setup (.exe)" →
  `https://github.com/mayurrawte/teamsly/releases/download/v0.3.0/Teamsly-Setup-0.3.0.exe`
- Secondary link: "Portable (.exe)" →
  `https://github.com/mayurrawte/teamsly/releases/download/v0.3.0/Teamsly-0.3.0.exe`
- Note: "SmartScreen → More info → Run anyway on first launch"

**Linux tab**
- Two equal buttons: "AppImage" and ".deb"
  - `https://github.com/mayurrawte/teamsly/releases/download/v0.3.0/Teamsly-0.3.0.AppImage`
  - `https://github.com/mayurrawte/teamsly/releases/download/v0.3.0/teamsly_0.3.0_amd64.deb`
- Note: "AppImage: `chmod +x` then run. Deb: `sudo dpkg -i …`"

**Below tabs:**
- "All releases on GitHub →" link to `https://github.com/mayurrawte/teamsly/releases`

### Roadmap section (new — `id="roadmap"`)

Placed between Download and FAQ.

**Heading:** "What's shipping"  
**Lede:** "Built in the open. Every release adds something that makes Teams less painful."

**Two-column grid:**

Left column — "✓ Shipped" (green label):

| Item | Badge |
|---|---|
| Channels, DMs, threads, reactions | v0.1 |
| Cmd+K switcher, search, presence | v0.1 |
| Voice rooms, calendar auto-status | v0.2 |
| Real-time channel push (webhooks) | v0.2 |
| Theming, density, animated reactions | v0.2 |
| Disappearing messages (DMs) | v0.3 |
| MCP server for AI agents | v0.2 |

Right column — "→ Planned" (muted label):

- Real-time DM push (sub-second via Graph webhooks)
- Send later / send-when-free
- AI action-item extractor
- Voice memos + auto-transcript
- Anonymous polls
- Channel snooze UI
- Read-receipt toggle

**Footer line:** "Full roadmap and task list on [GitHub →]"
linking to `https://github.com/mayurrawte/teamsly/blob/main/TASKS.md`

### Self-host section

Replace the current `<pre>` blocks with a single `.selfhost-cta` card:

- **Text:** "Run your own instance — connects to your own Azure AD tenant. No data leaves
  your infrastructure."
- **Button:** "Read the self-hosting guide →" → `install.html`
- Keep `id="install"` on the section so the nav anchor still works

### Footer fix

- Change `teamsly.vercel.app` → `teamsly.app` wherever it appears
- Update FAQ answer "Is there a mobile app?" — Electron desktop app is shipped;
  change to: "Desktop apps for macOS, Windows, and Linux are available on the
  [Download](#download) page. A native mobile app is not yet available; the web app
  works in mobile browsers."

---

## `install.html` (new)

Same `<head>`, `<header>`, and `<footer>` as `index.html` (copy verbatim).  
Page title: "Self-hosting Teamsly — teamsly.app"

### Sections

**1. Quick start**

Three numbered step cards (`.install-steps`):

- **Step 1 — Clone & install**
  ```bash
  git clone https://github.com/mayurrawte/teamsly.git
  cd teamsly
  npm install
  ```

- **Step 2 — Configure**
  ```bash
  cp .env.example .env.local
  ```
  Then a code block showing the 5 required env vars:
  ```env
  AZURE_AD_CLIENT_ID=your-client-id
  AZURE_AD_CLIENT_SECRET=your-client-secret
  AZURE_AD_TENANT_ID=common
  AUTH_SECRET=          # openssl rand -base64 32
  NEXTAUTH_URL=http://localhost:3000
  ```

- **Step 3 — Run**
  ```bash
  npm run dev
  ```
  "Open http://localhost:3000 and sign in, or visit /demo to preview without auth."

**2. Azure AD setup**

A `.callout` box (left accent border, tinted background):

> Teamsly authenticates via Microsoft Entra ID. You need an Azure AD app registration
> with the correct API permissions before sign-in will work.

Button: "Full Azure AD setup guide →" → `https://github.com/mayurrawte/teamsly/blob/main/SELF_HOSTING.md`

**3. Deploy to production**

`.deploy-grid` — three equal cards:

| Card | Content |
|---|---|
| Vercel | "One-click deploy — same env vars, zero config." Deploy button → `https://vercel.com/new/clone?repository-url=https://github.com/mayurrawte/teamsly` |
| Fly / Render / Railway | "Any Node 20+ platform works. See the deployment section of SELF_HOSTING.md for platform-specific notes." Link → SELF_HOSTING.md |
| Bare Node | `npm run build && npm start` — "Node 20+, set `NEXTAUTH_URL` to your public URL." |

**4. Troubleshooting**

Three `.qa` items (reuses FAQ styles):

- **Auth redirect mismatch** — "Add your deployment URL to `NEXTAUTH_URL` and to the
  Azure AD app's redirect URIs."
- **Graph 403 errors** — "Admin consent hasn't been granted for the required API
  permissions. Go to Azure Portal → API permissions → Grant admin consent."
- **macOS Gatekeeper blocks the app** — "Run:
  `sudo xattr -cr /Applications/Teamsly.app && sudo codesign --force --deep --sign - /Applications/Teamsly.app`"

---

## `styles.css` additions

Appended to the end of the existing file. No existing rules modified.

### Download tabs

```css
.download-tabs { … }          /* flex row, border-bottom */
.download-tab { … }           /* button, accent underline when active */
.download-tab-content { … }   /* display:none by default */
.download-tab-content.active { display: block; }
.download-primary { … }       /* large primary download button */
.download-secondary-row { … } /* flex row for secondary .dmg / .exe links */
```

### Roadmap

```css
.roadmap-grid { … }           /* two equal columns */
.roadmap-col-label { … }      /* small uppercase label, green or muted */
.roadmap-item { … }           /* card: white, 1px border, 8px radius — same as .feature */
.version-badge { … }          /* inline pill — green bg for shipped, muted for planned */
```

### Self-host CTA

```css
.selfhost-cta { … }           /* full-width card, flex row — collapses to column on mobile */
```

### Install page

```css
.install-steps { … }          /* numbered step card list */
.callout { … }                /* left accent border box */
.deploy-grid { … }            /* three equal columns — same pattern as .download-grid */
```

### Responsive additions

All new grids collapse to single column at ≤720px, matching existing breakpoints.

---

## Out of scope

- No build scripts or version-injection automation
- No framework migration
- No changelog page
- No mobile nav changes
- No changes to `src/` (the app)
- Version number (`0.3.0`) is hardcoded — update manually on next release

---

## Version update checklist (for future releases)

When a new version ships, update in `site/index.html`:
1. The `v0.3.0` version badge in the Download section heading
2. All six direct download URLs in the tab content
3. Move relevant planned items to the Shipped column in Roadmap
4. Add new planned items as needed
