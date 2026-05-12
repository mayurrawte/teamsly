# Teamsly — Marketing Site

Static HTML/CSS marketing site for Teamsly. No build step, no dependencies,
no framework. Open `index.html` in a browser or push to any static host.

Files:

- `index.html` — page structure and copy
- `styles.css` — design system and responsive layout (IBM Plex Sans, #0F5A8F)
- `logo.svg` — standalone brand mark (64x64, also inlined in the HTML)
- `favicon.svg` — browser tab icon (same design as logo)

---

## Deploying

### Option A — Vercel (recommended)

The site lives in the `site/` subdirectory of the main repo. Vercel lets you
deploy a subdirectory as a separate project, which keeps the marketing site
decoupled from the Next.js app at `teamsly.vercel.app`.

1. Go to [vercel.com](https://vercel.com) and click **Add New Project**.
2. Import the same GitHub repository (`mayurrawte/teamsly`).
3. Under **Root Directory**, type `site` and confirm.
4. Set **Framework Preset** to **Other** (Vercel auto-detects static files).
5. Leave Build Command and Output Directory blank — Vercel will serve `site/`
   directly.
6. Click **Deploy**. The site will be live at a `*.vercel.app` preview URL.

**Custom domain (e.g., `teamsly.wearesnx.studio`):**

Once your domain is ready, open the Vercel project, go to **Settings > Domains**,
and add the subdomain. Then create a DNS record with your registrar:

```
Type:   CNAME
Name:   teamsly          (or @ for apex)
Value:  cname.vercel-dns.com
TTL:    Auto / 3600
```

Vercel provisions a TLS certificate automatically within a few minutes.

For apex domains (`wearesnx.studio`) use an A record pointing to Vercel's IP
addresses instead — the Vercel UI lists the correct values when you add the
domain.

---

### Option B — GitHub Pages

Less recommended (the main app already lives on Vercel), but workable.

Create `.github/workflows/pages.yml` in the repo root:

```yaml
name: Deploy site to GitHub Pages
on:
  push:
    branches: [main]
    paths: [site/**]

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: site
      - id: deployment
        uses: actions/deploy-pages@v4
```

Enable **GitHub Pages** in the repo settings (Source: GitHub Actions).
The site will be available at `https://mayurrawte.github.io/teamsly/`.

For a custom domain, add a `CNAME` file inside `site/` containing your domain,
and point the DNS CNAME record to `mayurrawte.github.io`.

---

## Local development

```bash
# Any local static server works, e.g.:
npx serve site

# Or Python's built-in server:
python3 -m http.server 8080 --directory site
```

Then open `http://localhost:8080`.
