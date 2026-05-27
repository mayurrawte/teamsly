# Website Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve teamsly.app so installation, download links, self-hosting, features, and roadmap are immediately clear to any visitor.

**Architecture:** Pure static HTML/CSS extension — three files in `site/`. No framework, no build step. CSS is appended to the existing `styles.css`. A new `install.html` page is added alongside `index.html`. There are no automated tests; verification is done by opening the file in a browser.

**Tech Stack:** HTML5, CSS3, vanilla JS (one small OS-detection snippet in the download section)

---

## File map

| File | Action | Responsibility |
|---|---|---|
| `site/styles.css` | Edit (append) | All new CSS classes for tabs, roadmap, CTA card, install page |
| `site/index.html` | Edit | Nav, hero, features cards, download tabs, roadmap section, self-host CTA, footer fixes |
| `site/install.html` | Create | Quick-start guide, Azure AD callout, deploy grid, troubleshooting |

---

## Task 1: CSS additions

**Files:**
- Modify: `site/styles.css` (append to end of file)

- [ ] **Step 1: Open `site/styles.css` and append the following block at the very end of the file**

```css
/* ---------- download version badge ---------- */

.download-version-badge {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 10px;
  background: #f0f4ff;
  color: var(--accent);
  border: 1px solid #c7d9f5;
  border-radius: 11px;
  font-size: 12px;
  font-weight: 600;
  margin-left: 10px;
  vertical-align: middle;
}

/* ---------- download tabs ---------- */

.download-tabs {
  display: flex;
  border-bottom: 1px solid var(--border);
  margin: 24px 0 0;
}

.download-tab {
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-soft);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  cursor: pointer;
  transition: color 120ms ease, border-color 120ms ease;
  font-family: inherit;
}

.download-tab:hover { color: var(--text); }
.download-tab.active { color: var(--accent); border-bottom-color: var(--accent); }

.download-tab-content { display: none; padding: 24px 0 0; }
.download-tab-content.active { display: block; }

.download-panel {
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 24px;
}

.download-primary {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 42px;
  padding: 0 20px;
  background: var(--accent);
  color: #fff;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  transition: background-color 120ms ease;
}
.download-primary:hover { background: var(--accent-hover); text-decoration: none; color: #fff; }

.download-secondary-row {
  display: flex;
  gap: 12px;
  margin-top: 14px;
  flex-wrap: wrap;
}

.download-secondary {
  display: inline-flex;
  align-items: center;
  height: 36px;
  padding: 0 14px;
  background: #fff;
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  transition: background-color 120ms ease;
}
.download-secondary:hover { background: var(--bg-alt); text-decoration: none; }

.download-note {
  margin: 14px 0 0;
  font-size: 13px;
  color: var(--text-mute);
}

.download-all-link {
  display: block;
  text-align: center;
  margin-top: 20px;
  font-size: 14px;
  color: var(--text-soft);
}

/* ---------- roadmap ---------- */

.roadmap-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin-top: 32px;
}

.roadmap-col-label {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 14px;
}

.roadmap-col-label.shipped { color: #059669; }
.roadmap-col-label.planned { color: var(--text-mute); }

.roadmap-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 6px;
  margin-bottom: 6px;
  font-size: 14px;
  color: var(--text);
}

.version-badge {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 700;
}

.version-badge.shipped {
  background: #f0fdf4;
  color: #059669;
}

.roadmap-footer {
  margin-top: 20px;
  font-size: 14px;
  color: var(--text-soft);
  text-align: center;
}

/* ---------- self-host CTA ---------- */

.selfhost-cta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 28px 32px;
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 8px;
}

.selfhost-cta-text h3 { margin-bottom: 6px; }
.selfhost-cta-text p { margin: 0; color: var(--text-soft); font-size: 15px; }

/* ---------- install page ---------- */

.install-steps {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 24px;
}

.install-step {
  display: flex;
  gap: 20px;
  align-items: flex-start;
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 22px 24px;
}

.install-step-num {
  display: inline-grid;
  place-items: center;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--accent);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
}

.install-step-body { flex: 1; min-width: 0; }
.install-step-body h3 { margin-bottom: 10px; }
.install-step-body pre { margin: 10px 0 0; }
.install-step-body p { margin: 10px 0 0; color: var(--text-soft); font-size: 14px; }

.callout {
  margin-top: 40px;
  padding: 18px 22px;
  background: #f0f4ff;
  border-left: 3px solid var(--accent);
  border-radius: 0 6px 6px 0;
}

.callout p { margin: 0 0 14px; color: var(--text); }
.callout p:last-child { margin: 0; }

.deploy-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-top: 24px;
}

.deploy-card {
  padding: 20px 22px;
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.deploy-card h3 { margin: 0; font-size: 16px; }
.deploy-card p { margin: 0; color: var(--text-soft); font-size: 14px; line-height: 1.55; }

/* ---------- responsive additions ---------- */

@media (max-width: 980px) {
  .roadmap-grid { grid-template-columns: 1fr; }
  .deploy-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 720px) {
  .selfhost-cta { flex-direction: column; align-items: flex-start; }
  .deploy-grid { grid-template-columns: 1fr; }
}
```

- [ ] **Step 2: Open `site/index.html` in a browser and verify no visual regressions**

Open `file:///path/to/teamsly/site/index.html` (or `open site/index.html` on macOS).
Expected: page renders identically to before — the CSS additions have no selectors matching existing HTML yet.

- [ ] **Step 3: Commit**

```bash
git add site/styles.css
git commit -m "style: add CSS for download tabs, roadmap, install page components"
```

---

## Task 2: Download section redesign

**Files:**
- Modify: `site/index.html` — replace the `<section id="download">` block

- [ ] **Step 1: In `site/index.html`, replace the entire `<section id="download" …>…</section>` block**

Find and replace the block that starts with `<section id="download" class="section">` and ends with its closing `</section>`. Replace it with:

```html
      <section id="download" class="section">
        <div class="container">
          <h2>Download Teamsly <span class="download-version-badge">v0.3.0</span></h2>
          <p class="section-lede">
            Native window, system tray with unread count, auto-update. Pick your platform.
          </p>

          <div class="download-tabs" role="tablist">
            <button class="download-tab active" role="tab" id="tab-mac" onclick="switchTab('mac')">macOS</button>
            <button class="download-tab" role="tab" id="tab-win" onclick="switchTab('win')">Windows</button>
            <button class="download-tab" role="tab" id="tab-linux" onclick="switchTab('linux')">Linux</button>
          </div>

          <!-- macOS -->
          <div class="download-tab-content active" id="content-mac">
            <div class="download-panel">
              <p class="download-sub" style="margin:0 0 14px">Apple Silicon &amp; Intel · Homebrew recommended</p>
              <pre><code>brew tap mayurrawte/teamsly
brew install --cask teamsly</code></pre>
              <div class="download-secondary-row">
                <a class="download-secondary" href="https://github.com/mayurrawte/teamsly/releases/download/v0.3.0/Teamsly-0.3.0-arm64.dmg">Apple Silicon (.dmg)</a>
                <a class="download-secondary" href="https://github.com/mayurrawte/teamsly/releases/download/v0.3.0/Teamsly-0.3.0.dmg">Intel (.dmg)</a>
              </div>
              <p class="download-note">Unsigned build — right-click → Open on first launch, or use Homebrew which handles the signature automatically.</p>
            </div>
          </div>

          <!-- Windows -->
          <div class="download-tab-content" id="content-win">
            <div class="download-panel">
              <p class="download-sub" style="margin:0 0 14px">Windows 10 / 11</p>
              <a class="download-primary" href="https://github.com/mayurrawte/teamsly/releases/download/v0.3.0/Teamsly-Setup-0.3.0.exe">⬇ Download Setup (.exe)</a>
              <div class="download-secondary-row">
                <a class="download-secondary" href="https://github.com/mayurrawte/teamsly/releases/download/v0.3.0/Teamsly-0.3.0.exe">Portable (.exe)</a>
              </div>
              <p class="download-note">SmartScreen warning on first launch — click "More info" → "Run anyway". Unsigned build.</p>
            </div>
          </div>

          <!-- Linux -->
          <div class="download-tab-content" id="content-linux">
            <div class="download-panel">
              <p class="download-sub" style="margin:0 0 14px">AppImage or Debian package</p>
              <div style="display:flex;gap:12px;flex-wrap:wrap">
                <a class="download-primary" href="https://github.com/mayurrawte/teamsly/releases/download/v0.3.0/Teamsly-0.3.0.AppImage">⬇ AppImage</a>
                <a class="download-primary" href="https://github.com/mayurrawte/teamsly/releases/download/v0.3.0/teamsly_0.3.0_amd64.deb">⬇ .deb (amd64)</a>
              </div>
              <p class="download-note">AppImage: <code>chmod +x Teamsly-*.AppImage &amp;&amp; ./Teamsly-*.AppImage</code>. Deb: <code>sudo dpkg -i teamsly_*.deb</code>. Auto-update works on both.</p>
            </div>
          </div>

          <a class="download-all-link" href="https://github.com/mayurrawte/teamsly/releases">All releases on GitHub →</a>
        </div>

        <script>
          function switchTab(platform) {
            document.querySelectorAll('.download-tab').forEach(function(t) { t.classList.remove('active'); });
            document.querySelectorAll('.download-tab-content').forEach(function(c) { c.classList.remove('active'); });
            document.getElementById('tab-' + platform).classList.add('active');
            document.getElementById('content-' + platform).classList.add('active');
          }
          (function() {
            var p = (navigator.platform || '').toLowerCase();
            var ua = (navigator.userAgent || '').toLowerCase();
            if (p.indexOf('win') !== -1) { switchTab('win'); }
            else if (p.indexOf('linux') !== -1 || ua.indexOf('linux') !== -1) { switchTab('linux'); }
            // default: mac tab already active
          })();
        </script>
      </section>
```

- [ ] **Step 2: Open `site/index.html` in browser, scroll to Download section**

Check:
- Three tabs render (macOS / Windows / Linux)
- macOS tab is active by default, shows Homebrew `pre` block + two secondary `.dmg` links
- Clicking Windows tab shows the Setup .exe primary button + Portable secondary
- Clicking Linux tab shows two primary buttons (AppImage + .deb)
- "All releases on GitHub →" link appears below tabs
- Version badge `v0.3.0` appears next to the heading

- [ ] **Step 3: Commit**

```bash
git add site/index.html
git commit -m "feat(site): redesign download section with OS-detected tabs"
```

---

## Task 3: Features section update

**Files:**
- Modify: `site/index.html` — replace the six `.feature` cards inside `#features`

- [ ] **Step 1: In `site/index.html`, replace the `<div class="feature-grid">…</div>` block inside `#features`**

Find the `<div class="feature-grid">` block and replace it entirely with:

```html
          <div class="feature-grid">
            <div class="feature">
              <h3>Channels &amp; direct messages</h3>
              <p>Workspace switcher, sidebar navigation, unread counts, and presence indicators backed by Microsoft Graph.</p>
            </div>
            <div class="feature">
              <h3>Threads &amp; reactions</h3>
              <p>Slide-in thread panel, optimistic replies, animated reaction pills, and clear rollback when a Graph call fails.</p>
            </div>
            <div class="feature">
              <h3>Disappearing messages</h3>
              <p>DM-only. Sender picks 30 s / 5 min / 1 hr. Body is cloaked in transit; Teamsly shows a countdown badge and auto-deletes on expiry.</p>
            </div>
            <div class="feature">
              <h3>Voice rooms</h3>
              <p>In-app voice via LiveKit. Join or start a call without leaving Teamsly — no separate window, no browser tab.</p>
            </div>
            <div class="feature">
              <h3>Cmd+K &amp; search</h3>
              <p>Jump to any channel, DM, or contact in two keystrokes. Full-text search across loaded messages and channels.</p>
            </div>
            <div class="feature">
              <h3>AI summaries &amp; MCP</h3>
              <p>Catch up on long threads with one click. MCP server lets Claude Desktop, Cursor, and any MCP-compatible agent read and send messages on your behalf.</p>
            </div>
          </div>
```

- [ ] **Step 2: Open `site/index.html` in browser, scroll to Features section**

Check:
- Six cards render in a 3-column grid
- Disappearing messages card is present (was not in the old version)
- Voice rooms card is present
- No card says "Optional AI features" or "Density and preferences" (old cards removed)

- [ ] **Step 3: Commit**

```bash
git add site/index.html
git commit -m "feat(site): update features section to reflect shipped v0.3.0 capabilities"
```

---

## Task 4: Roadmap section

**Files:**
- Modify: `site/index.html` — insert new `#roadmap` section between `#download` and `#install`

- [ ] **Step 1: In `site/index.html`, find the line `<section id="install"` and insert the following block immediately before it**

```html
      <section id="roadmap" class="section section-alt">
        <div class="container">
          <h2>What's shipping</h2>
          <p class="section-lede">
            Built in the open. Every release adds something that makes Teams less painful.
          </p>

          <div class="roadmap-grid">
            <div>
              <div class="roadmap-col-label shipped">✓ Shipped</div>
              <div class="roadmap-item">Channels, DMs, threads, reactions <span class="version-badge shipped">v0.1</span></div>
              <div class="roadmap-item">Cmd+K switcher, search, presence <span class="version-badge shipped">v0.1</span></div>
              <div class="roadmap-item">Voice rooms, calendar auto-status <span class="version-badge shipped">v0.2</span></div>
              <div class="roadmap-item">Real-time channel push (webhooks) <span class="version-badge shipped">v0.2</span></div>
              <div class="roadmap-item">Theming, density, animated reactions <span class="version-badge shipped">v0.2</span></div>
              <div class="roadmap-item">MCP server for AI agents <span class="version-badge shipped">v0.2</span></div>
              <div class="roadmap-item">Disappearing messages (DMs) <span class="version-badge shipped">v0.3</span></div>
            </div>
            <div>
              <div class="roadmap-col-label planned">→ Planned</div>
              <div class="roadmap-item">Real-time DM push (sub-second)</div>
              <div class="roadmap-item">Send later / send-when-free</div>
              <div class="roadmap-item">AI action-item extractor</div>
              <div class="roadmap-item">Voice memos + auto-transcript</div>
              <div class="roadmap-item">Anonymous polls</div>
              <div class="roadmap-item">Channel snooze UI</div>
              <div class="roadmap-item">Read-receipt toggle</div>
            </div>
          </div>

          <p class="roadmap-footer">
            Full roadmap and task list on <a href="https://github.com/mayurrawte/teamsly/blob/main/TASKS.md">GitHub →</a>
          </p>
        </div>
      </section>

```

- [ ] **Step 2: Open `site/index.html` in browser, scroll to the Roadmap section**

Check:
- Section appears between Download and Self-host
- Left column has green "✓ Shipped" label with 7 items, each with a green version badge
- Right column has muted "→ Planned" label with 7 items, no badges
- "Full roadmap … on GitHub →" link appears below
- Background is `--bg-alt` (matches alternating section pattern)

- [ ] **Step 3: Commit**

```bash
git add site/index.html
git commit -m "feat(site): add roadmap section with shipped/planned items"
```

---

## Task 5: Nav, hero, self-host CTA, footer and FAQ fixes

**Files:**
- Modify: `site/index.html` — five targeted edits

- [ ] **Step 1: Update the `<nav>` — add Roadmap link and point Self-host at `install.html`**

Find this block in the `<nav class="primary-nav">`:

```html
          <nav class="primary-nav" aria-label="Primary">
            <a href="#features">Features</a>
            <a href="#how">How it works</a>
            <a href="#compare">vs Teams</a>
            <a href="#download">Download</a>
            <a href="#install">Self-host</a>
            <a href="#faq">FAQ</a>
          </nav>
```

Replace it with:

```html
          <nav class="primary-nav" aria-label="Primary">
            <a href="#features">Features</a>
            <a href="#how">How it works</a>
            <a href="#compare">vs Teams</a>
            <a href="#download">Download</a>
            <a href="#roadmap">Roadmap</a>
            <a href="install.html">Self-host</a>
            <a href="#faq">FAQ</a>
          </nav>
```

- [ ] **Step 2: Update the hero — add "Try the web app" button**

Find this block inside `.hero-actions`:

```html
            <div class="hero-actions">
              <a class="btn btn-primary" href="#download">Download for desktop</a>
              <a class="btn btn-secondary" href="https://github.com/mayurrawte/teamsly">View on GitHub</a>
            </div>
```

Replace it with:

```html
            <div class="hero-actions">
              <a class="btn btn-primary" href="#download">Download for desktop</a>
              <a class="btn btn-secondary" href="https://teamsly.app">Try the web app</a>
              <a class="btn btn-secondary" href="https://github.com/mayurrawte/teamsly">View on GitHub</a>
            </div>
```

- [ ] **Step 3: Replace the self-host section body with the CTA card**

Find the entire content inside `<section id="install" class="section section-alt">`:

```html
      <section id="install" class="section section-alt">
        <div class="container">
          <h2>Self-host</h2>
          <p class="section-lede">
            One repository. No managed service to depend on.
          </p>

          <pre><code>git clone https://github.com/mayurrawte/teamsly
cd teamsly
npm install
cp .env.example .env.local
npm run dev</code></pre>

          <p>
            Fill in <code>.env.local</code> with your Azure AD app credentials:
          </p>

          <pre><code>AZURE_AD_CLIENT_ID=<span class="hash">your-client-id</span>
AZURE_AD_CLIENT_SECRET=<span class="hash">your-client-secret</span>
AZURE_AD_TENANT_ID=common
AUTH_SECRET=<span class="hash">openssl rand -base64 32</span>
NEXTAUTH_URL=http://localhost:3000</code></pre>

          <p>
            Then open <code>http://localhost:3000</code> and sign in, or visit <code>/demo</code> to preview the UI without auth.
            For production, any Node 20+ host works (<code>npm run build &amp;&amp; npm start</code>) and Vercel deploys
            cleanly with the same environment variables.
          </p>
        </div>
      </section>
```

Replace it with:

```html
      <section id="install" class="section section-alt">
        <div class="container">
          <h2>Self-host</h2>
          <div class="selfhost-cta">
            <div class="selfhost-cta-text">
              <h3>Run your own instance</h3>
              <p>Connects to your own Azure AD tenant. No data leaves your infrastructure. Any Node 20+ host works — Vercel, Fly, Render, or bare Node.</p>
            </div>
            <a class="btn btn-primary" href="install.html">Self-hosting guide →</a>
          </div>
        </div>
      </section>
```

- [ ] **Step 4: Fix the "Is there a mobile app?" FAQ answer**

Find:

```html
          <div class="qa">
            <h3>Is there a mobile app?</h3>
            <p>Not yet. The web app is responsive and works in mobile browsers; a desktop wrapper (Electron) is on the
              roadmap.</p>
          </div>
```

Replace with:

```html
          <div class="qa">
            <h3>Is there a mobile app?</h3>
            <p>Desktop apps for macOS, Windows, and Linux are available on the <a href="#download">Download</a> page.
              A native mobile app is not yet available; the web app works in mobile browsers.</p>
          </div>
```

- [ ] **Step 5: Fix `teamsly.vercel.app` in the footer**

Find:

```html
          <p class="download-footer">
            Or use the web app at
            <a href="https://teamsly.vercel.app">teamsly.vercel.app</a> — no install required.
          </p>
```

This element no longer exists after Task 2 replaced the download section — skip this step if not found.

Then find in the footer:

```html
<a href="https://github.com/mayurrawte/teamsly/blob/main/README.md">README</a>
```

And verify `teamsly.vercel.app` does not appear anywhere else in the file by running:

```bash
grep -n "vercel.app" site/index.html
```

Expected output: no lines (the old download-footer link was removed in Task 2).

- [ ] **Step 6: Open `site/index.html` in browser and do a full page check**

Verify in order:
1. Nav has 6 links: Features, How it works, vs Teams, Download, Roadmap, Self-host, FAQ (7 total — that's correct)
2. Hero has three buttons: "Download for desktop", "Try the web app", "View on GitHub"
3. Scroll to Self-host: shows the CTA card with "Run your own instance" text + "Self-hosting guide →" button
4. Scroll to FAQ: "Is there a mobile app?" answer mentions desktop apps are available
5. `grep -n "vercel.app" site/index.html` returns no results

- [ ] **Step 7: Commit**

```bash
git add site/index.html
git commit -m "feat(site): update nav, hero, self-host CTA, FAQ; fix footer URL"
```

---

## Task 6: Create `install.html`

**Files:**
- Create: `site/install.html`

- [ ] **Step 1: Create `site/install.html` with the following complete content**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Self-hosting Teamsly — teamsly.app</title>
    <meta
      name="description"
      content="Run your own Teamsly instance. Quick-start guide: clone the repo, configure Azure AD credentials, and deploy to Vercel, Fly, Render, or bare Node 20+."
    />
    <meta name="theme-color" content="#0F5A8F" />

    <meta property="og:type" content="website" />
    <meta property="og:title" content="Self-hosting Teamsly" />
    <meta property="og:description" content="Quick-start self-hosting guide for Teamsly — the open-source Microsoft Teams client." />
    <meta property="og:url" content="https://teamsly.app/install.html" />
    <meta property="og:site_name" content="Teamsly" />

    <link rel="icon" type="image/svg+xml" href="favicon.svg" />

    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;600;700&display=swap" rel="stylesheet" />

    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <header class="site-header">
      <div class="container header-inner">
        <a href="index.html" class="brand">
          <svg class="brand-mark logo-mark" width="26" height="26" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="2.5" cy="3.5" r="1.2" fill="currentColor" stroke="none" />
            <circle cx="6.2" cy="1.4" r="0.9" fill="currentColor" stroke="none" />
            <line x1="3.5" y1="3" x2="5.5" y2="2" stroke="currentColor" stroke-width="1" />
            <rect x="3" y="5" width="18" height="13" rx="3" stroke="currentColor" stroke-width="2" />
            <polyline points="5,18 3,22 7,18" stroke="currentColor" stroke-width="2" stroke-linejoin="round" fill="none" />
            <polyline points="8,10.5 10.5,12 8,13.5" stroke="currentColor" stroke-width="2" stroke-linejoin="round" fill="none" />
            <line x1="12.5" y1="13.5" x2="15.5" y2="13.5" stroke="currentColor" stroke-width="2" />
          </svg>
          <span class="brand-name">Teamsly</span>
        </a>
        <nav class="primary-nav" aria-label="Primary">
          <a href="index.html#features">Features</a>
          <a href="index.html#how">How it works</a>
          <a href="index.html#compare">vs Teams</a>
          <a href="index.html#download">Download</a>
          <a href="index.html#roadmap">Roadmap</a>
          <a href="install.html">Self-host</a>
          <a href="index.html#faq">FAQ</a>
        </nav>
        <a class="btn btn-primary header-cta" href="https://github.com/mayurrawte/teamsly">
          GitHub
        </a>
      </div>
    </header>

    <main id="top">
      <section class="hero" style="padding-bottom:48px">
        <div class="container">
          <p class="kicker">Self-hosting guide</p>
          <h1>Run your own Teamsly</h1>
          <p class="lede">
            Clone the repo, add your Azure AD credentials, and you have a fully self-hosted
            Microsoft Teams client. Any Node 20+ host works — local, Vercel, Fly, Render, or Docker.
          </p>
        </div>
      </section>

      <section class="section" style="padding-top:0">
        <div class="container">
          <h2>Quick start</h2>
          <p class="section-lede">Three commands to a running local instance.</p>

          <div class="install-steps">
            <div class="install-step">
              <span class="install-step-num">1</span>
              <div class="install-step-body">
                <h3>Clone &amp; install</h3>
                <pre><code>git clone https://github.com/mayurrawte/teamsly.git
cd teamsly
npm install</code></pre>
              </div>
            </div>

            <div class="install-step">
              <span class="install-step-num">2</span>
              <div class="install-step-body">
                <h3>Configure</h3>
                <pre><code>cp .env.example .env.local</code></pre>
                <p>Fill in <code>.env.local</code> with your Azure AD app credentials:</p>
                <pre><code>AZURE_AD_CLIENT_ID=your-application-client-id
AZURE_AD_CLIENT_SECRET=your-client-secret-value
AZURE_AD_TENANT_ID=common
AUTH_SECRET=                 <span class="hash"># openssl rand -base64 32</span>
NEXTAUTH_URL=http://localhost:3000</code></pre>
              </div>
            </div>

            <div class="install-step">
              <span class="install-step-num">3</span>
              <div class="install-step-body">
                <h3>Run</h3>
                <pre><code>npm run dev</code></pre>
                <p>Open <code>http://localhost:3000</code> and sign in with your Microsoft 365 account.
                  Visit <code>/demo</code> to preview the UI without auth.</p>
              </div>
            </div>
          </div>

          <div class="callout">
            <p><strong>You need an Azure AD app registration.</strong> Teamsly authenticates
              through Microsoft Entra ID. Before sign-in works you need an app registration
              with the correct delegated Graph API permissions (User.Read, ChannelMessage.Read.All,
              Chat.ReadWrite, and others).</p>
            <a class="btn btn-primary" href="https://github.com/mayurrawte/teamsly/blob/main/SELF_HOSTING.md">
              Full Azure AD setup guide →
            </a>
          </div>
        </div>
      </section>

      <section class="section section-alt">
        <div class="container">
          <h2>Deploy to production</h2>
          <p class="section-lede">
            Set the same five environment variables on any host and run <code>npm run build &amp;&amp; npm start</code>.
          </p>

          <div class="deploy-grid">
            <div class="deploy-card">
              <h3>Vercel</h3>
              <p>One-click deploy. Import the repo, set the five env vars in the dashboard, done. Auto-deploys on push to main.</p>
              <a class="btn btn-primary" href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fmayurrawte%2Fteamsly&env=AZURE_AD_CLIENT_ID,AZURE_AD_CLIENT_SECRET,AZURE_AD_TENANT_ID,AUTH_SECRET,NEXTAUTH_URL">
                Deploy to Vercel
              </a>
            </div>

            <div class="deploy-card">
              <h3>Fly / Render / Railway</h3>
              <p>Any Node 20+ platform works. Set the five env vars and run the build + start commands. See the full deployment guide for platform-specific notes.</p>
              <a href="https://github.com/mayurrawte/teamsly/blob/main/SELF_HOSTING.md#deployment">Deployment notes on GitHub →</a>
            </div>

            <div class="deploy-card">
              <h3>Bare Node</h3>
              <p>Build once, serve forever. Node 20+ required. Set <code>NEXTAUTH_URL</code> to your public URL before building.</p>
              <pre><code>npm run build
npm start</code></pre>
            </div>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="container faq" style="max-width:760px">
          <h2>Troubleshooting</h2>

          <div class="qa">
            <h3>Auth redirect mismatch — sign-in fails immediately</h3>
            <p>Your <code>NEXTAUTH_URL</code> must match the redirect URI registered in Azure AD.
              Go to Azure Portal → your app → Authentication → add
              <code>https://your-domain.com/api/auth/callback/microsoft-entra-id</code> as a Web redirect URI.</p>
          </div>

          <div class="qa">
            <h3>Graph API returns 403 after sign-in</h3>
            <p>Admin consent hasn't been granted for the required delegated permissions.
              Go to Azure Portal → your app → API permissions → click
              <strong>Grant admin consent for [your tenant]</strong>. You need Global Admin rights
              (or ask your tenant admin).</p>
          </div>

          <div class="qa">
            <h3>macOS Gatekeeper blocks the desktop app</h3>
            <p>The desktop build is unsigned. Run once to clear the quarantine flag and apply an ad-hoc signature:</p>
            <pre><code>sudo xattr -cr /Applications/Teamsly.app
sudo codesign --force --deep --sign - /Applications/Teamsly.app</code></pre>
            <p>Alternatively, install via Homebrew — the cask preflight script does this automatically:</p>
            <pre><code>brew tap mayurrawte/teamsly
brew install --cask teamsly</code></pre>
          </div>
        </div>
      </section>
    </main>

    <footer class="site-footer">
      <div class="container footer-inner">
        <div class="footer-brand">
          <div class="brand">
            <svg class="brand-mark logo-mark" width="26" height="26" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="2.5" cy="3.5" r="1.2" fill="currentColor" stroke="none" />
              <circle cx="6.2" cy="1.4" r="0.9" fill="currentColor" stroke="none" />
              <line x1="3.5" y1="3" x2="5.5" y2="2" stroke="currentColor" stroke-width="1" />
              <rect x="3" y="5" width="18" height="13" rx="3" stroke="currentColor" stroke-width="2" />
              <polyline points="5,18 3,22 7,18" stroke="currentColor" stroke-width="2" stroke-linejoin="round" fill="none" />
              <polyline points="8,10.5 10.5,12 8,13.5" stroke="currentColor" stroke-width="2" stroke-linejoin="round" fill="none" />
              <line x1="12.5" y1="13.5" x2="15.5" y2="13.5" stroke="currentColor" stroke-width="2" />
            </svg>
            <span class="brand-name">Teamsly</span>
          </div>
          <p>Open-source client for Microsoft Teams.<br>Self-hosted, AGPL-3.0.</p>
        </div>

        <div class="footer-cols">
          <div>
            <h4>Project</h4>
            <a href="https://github.com/mayurrawte/teamsly">GitHub</a>
            <a href="https://github.com/mayurrawte/teamsly/issues">Issues</a>
            <a href="https://github.com/mayurrawte/teamsly/blob/main/LICENSE">License (AGPL-3.0)</a>
          </div>
          <div>
            <h4>Docs</h4>
            <a href="https://github.com/mayurrawte/teamsly/blob/main/README.md">README</a>
            <a href="install.html">Self-host</a>
            <a href="index.html#faq">FAQ</a>
          </div>
          <div>
            <h4>Legal</h4>
            <a href="https://github.com/mayurrawte/teamsly/blob/main/NOTICE.md">Notice</a>
            <a href="https://github.com/mayurrawte/teamsly/blob/main/LICENSE">License</a>
            <a href="https://github.com/mayurrawte">@mayurrawte</a>
          </div>
        </div>
      </div>
      <div class="container footer-bottom">
        <span>&copy; 2026 Teamsly contributors</span>
        <span>Not affiliated with Microsoft Corporation.</span>
      </div>
      <div class="container footer-disclaimer">
        Teamsly is not affiliated with, endorsed by, or sponsored by Slack Technologies LLC, Salesforce Inc., or Microsoft Corporation.
        Microsoft Teams is a trademark of Microsoft Corporation. Slack is a trademark of Slack Technologies LLC.
        Both marks are used only as nominative references to their respective products.
        Teamsly accesses Microsoft Teams data via the public Microsoft Graph API.
        No private APIs, scraped content, or reverse-engineered protocols are used.
        <a href="https://github.com/mayurrawte/teamsly/blob/main/NOTICE.md">Full notice</a> ·
        <a href="https://github.com/mayurrawte/teamsly/blob/main/LICENSE">License</a> ·
        <a href="https://github.com/mayurrawte/teamsly">GitHub</a>
      </div>
    </footer>
  </body>
</html>
```

- [ ] **Step 2: Open `site/install.html` in browser and verify**

Check in order:
1. Header renders with same logo/nav as `index.html`; nav "Self-host" link is current page (`install.html`)
2. Hero shows "Self-hosting guide" kicker + heading "Run your own Teamsly"
3. Quick start section has three numbered step cards: Clone & install, Configure (with env var block), Run
4. Azure AD callout box appears below steps with left blue border + "Full Azure AD setup guide →" button
5. Deploy section shows three cards: Vercel (with deploy button), Fly/Render/Railway, Bare Node
6. Troubleshooting shows three Q&A items
7. Footer renders correctly, links back to `index.html#faq` etc.

- [ ] **Step 3: Verify cross-page navigation**

- From `install.html`, click the brand logo → should load `index.html`
- From `install.html`, click "Features" in nav → should load `index.html#features`
- From `index.html`, click "Self-host" in nav → should load `install.html`
- From `index.html`, click "Self-hosting guide →" CTA button → should load `install.html`

- [ ] **Step 4: Commit**

```bash
git add site/install.html
git commit -m "feat(site): add install.html quick-start self-hosting page"
```

---

## Self-review

**Spec coverage check:**

| Spec requirement | Covered by |
|---|---|
| Nav: add Roadmap, Self-host → install.html | Task 5 step 1 |
| Hero: "Try the web app" button | Task 5 step 2 |
| Features: 6 updated cards | Task 3 |
| Download: tabs + OS detection + Homebrew primary | Task 2 |
| Download: direct links to v0.3.0 binaries | Task 2 |
| Roadmap: shipped/planned two-column | Task 4 |
| Self-host section: CTA card | Task 5 step 3 |
| FAQ mobile app answer fix | Task 5 step 4 |
| Footer URL fix (teamsly.vercel.app → teamsly.app) | Task 5 step 5 |
| install.html: 3-step quick start | Task 6 |
| install.html: Azure AD callout + link | Task 6 |
| install.html: deploy grid (Vercel, other, bare node) | Task 6 |
| install.html: troubleshooting | Task 6 |
| CSS: all new component classes | Task 1 |
| Responsive: new grids collapse at ≤720px | Task 1 |

All spec requirements covered. ✓
