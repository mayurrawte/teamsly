# Making Teamsly adoptable — findings and plan (2026-09-03)

Baseline: 10 stars, 0 forks, 19 unique visitors and 25 unique cloners in the last 14 days,
12 npm downloads/month for `@teamsly/mcp`. teamsly.app is live; Show HN has not happened.
The product works; the funnel does not. Below, in the order a new user hits them.

## 1. The consent wall (biggest blocker)

Signing in to the hosted app asks for **twelve delegated Graph scopes** at once (Chat.ReadWrite,
ChannelMessage.Read.All, Files.ReadWrite, Presence.ReadWrite, Calendars.Read, …) from an
**unverified publisher** on the `common` tenant. In most companies user consent to third-party
apps is disabled, so the Microsoft dialog says *"Need admin approval"* and the visit ends there.
The sign-in page currently shows only `Sign-in failed: <error code>`.

Fixes, cheapest first:
- **Explain it and give the admin a one-click link.** Detect `AADSTS65001` / `access_denied` /
  `consent_required` in the callback error and show a "Company account? Send this to your IT admin"
  panel with the tenant-wide admin-consent URL
  (`https://login.microsoftonline.com/organizations/v2.0/adminconsent?client_id=…&scope=…`).
  Shipped today on the sign-in page (needs `NEXT_PUBLIC_AZURE_AD_CLIENT_ID` set in Vercel).
- **Incremental consent.** Sign in with `User.Read Chat.ReadWrite Team.ReadBasic.All
  Channel.ReadBasic.All ChannelMessage.Read.All ChannelMessage.Send` only; request Files, Presence
  and Calendars the first time the user opens Files / Meetings (Auth.js supports a second
  `signIn` with extra scopes; keep the union in the refresh-token scope). Fewer scopes = far more
  tenants allow user consent.
- **Publisher verification** (Microsoft Partner Network ID on the app registration) removes the
  "unverified" banner and is a prerequisite for many tenants' consent policies. Free, needs a
  Partner Center account and a verified domain (teamsly.app).
- Longer term: **Teams app store / Entra app gallery listing** so admins find it where they already
  approve apps.

## 2. Self-hosting has to be the default answer for companies

Because of §1, the realistic path for an org is "run it under our own Azure app, admin approves
once". Today that means reading SELF_HOSTING.md and hand-writing a Dockerfile.
Shipped today: `Dockerfile` + `docker-compose.yml` (standalone Next build, non-root, healthcheck),
a **Deploy with Vercel** button pre-wired with the four required env vars, and a README quick start.
Next: a `scripts/azure-app.sh` that creates the app registration with the exact 12 permissions via
`az ad app create` — the 25-click portal walkthrough is where self-hosters give up.

## 3. Who is the user?

The landing page sells "keyboard-first, calmer Teams" to everyone. The people who actually switch
clients are (a) developers who live in a terminal and already run an MCP-capable agent,
(b) Linux users who have no official Teams desktop app, (c) people in 3+ tenants who want one inbox.
Each has a natural channel: r/linux and the Linux-Teams complaint threads, the MCP directories and
"Claude + Teams" searches, and multi-tenant admins. Lead with those three stories, not features.
`#143 multi-account` and `#100 search` are the roadmap items that matter to them.

## 4. Trust signals a stranger checks in 30 seconds

- A **privacy page that says what is stored** (nothing, tokens only in the encrypted Auth.js cookie)
  and what the AI feature sends to OpenAI. The README says "Nothing is stored"; the site should too.
- **Signed desktop builds** (#73): unsigned macOS builds show a scary Gatekeeper dialog. Notarisation
  is ~$99/year and a CI step.
- **Release cadence visible**: last GitHub release is v0.6.2 (June). Cut releases from CI on tags.
- **A CHANGELOG** and a public roadmap link (issues already labelled P0–P3).

## 5. Distribution that fits the product

- Show HN (kit in LAUNCH_KIT.md) — after §1's consent panel ships, so the first-comment complaint
  "I got 'need admin approval'" already has an answer.
- awesome-selfhosted (PR; it requires Docker/compose, which now exists) and awesome-mcp-servers.
- Homebrew cask for the desktop app (`Casks/` directory already exists in the repo — publish a tap).
- Every "Teams on Linux" thread on r/linux, r/selfhosted and the Microsoft Q&A forum.

## What shipped today (this commit)
- `npm run lint` works on a clean install again (eslint-config-next flat configs, ESLint 9;
  eslint-plugin-react 7.37 is incompatible with ESLint 10). New react-hooks 7 rules downgraded to
  warnings (65 sites) — tracked as an issue.
- `npm audit fix` applied; remaining: `sharp` (libvips CVEs) needs a Next.js bump.
- Dockerfile, docker-compose.yml, .dockerignore; Vercel deploy button; README/SELF_HOSTING updates.
- Sign-in page: admin-consent helper (see §1).
- Six stale agent worktrees and their branches removed from the repo checkout.
