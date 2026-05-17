# Self-Hosting Teamsly

This guide walks you through running your own Teamsly instance. You need a Microsoft Azure account (free tier is fine) and any Node.js 20+ host.

---

## 1. Register an Azure AD App

1. Go to [Azure Portal](https://portal.azure.com) → **Microsoft Entra ID** → **App registrations** → **New registration**
2. Give it a name (e.g. "Teamsly Self-Hosted")
3. For **Supported account types**, choose:
   - "Accounts in any organizational directory and personal Microsoft accounts" — if you want to allow both work and personal accounts
   - "Accounts in this organizational directory only" — for your org only
4. Set a redirect URI (Web): `http://localhost:3000/api/auth/callback/microsoft-entra-id`
5. Click **Register**

Save the **Application (client) ID** and **Directory (tenant) ID** from the Overview page.

### Add a client secret

Go to **Certificates & secrets** → **New client secret** → set an expiry → copy the **Value** (you won't see it again).

### Add API permissions

Go to **API permissions** → **Add a permission** → **Microsoft Graph** → **Delegated permissions**. Add:

| Permission | Purpose |
|---|---|
| `User.Read` | Sign-in and profile |
| `User.ReadBasic.All` | Read other users' profiles |
| `Team.ReadBasic.All` | List joined teams |
| `Channel.ReadBasic.All` | List channels |
| `ChannelMessage.Read.All` | Read channel messages |
| `ChannelMessage.Send` | Send channel messages |
| `Chat.ReadWrite` | Read and send DMs |
| `Presence.Read.All` | Read presence status |
| `Presence.ReadWrite` | Set your own presence |
| `Files.Read.All` | Read shared files |
| `Files.ReadWrite` | Upload files |
| `Calendars.Read` | Read calendar (meetings view) |

Click **Grant admin consent** (required if your account has admin rights; otherwise ask your tenant admin).

---

## 2. Configure Environment Variables

Clone the repo and copy the example:

```bash
git clone https://github.com/mayurrawte/teamsly.git
cd teamsly
cp .env.example .env.local
```

Fill in `.env.local`:

```env
# Azure AD credentials (from the app registration above)
AZURE_AD_CLIENT_ID=your-application-client-id
AZURE_AD_CLIENT_SECRET=your-client-secret-value
AZURE_AD_TENANT_ID=common   # or your specific tenant ID

# Auth.js secret — generate with: openssl rand -base64 32
AUTH_SECRET=your-random-secret-here

# Your deployment URL (for OAuth redirect)
NEXTAUTH_URL=http://localhost:3000   # change to your production URL for prod

# Optional: MCP server secret (required only if using the MCP integration)
TEAMSLY_MCP_SECRET=your-mcp-secret   # generate with: openssl rand -hex 32

# Optional: Enable AI message summaries (requires Anthropic API key)
NEXT_PUBLIC_AI_ENABLED=false
ANTHROPIC_API_KEY=sk-ant-...         # only needed if AI is enabled
```

---

## 3. Add Production Redirect URIs

When deploying to a public URL, add the production callback URI to your Azure app:

1. Go to your app registration → **Authentication** → **Add a platform** (if not already Web)
2. Add redirect URI: `https://your-domain.com/api/auth/callback/microsoft-entra-id`
3. Save

---

## 4. Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with your Microsoft account.

---

## 5. Deploy to Production

### Vercel (recommended)

```bash
npm install -g vercel
vercel
```

Set all env vars in the Vercel dashboard under **Project → Settings → Environment Variables**. Make sure `NEXTAUTH_URL` is set to your production domain.

### Fly.io

```bash
fly launch
fly secrets set AZURE_AD_CLIENT_ID=... AZURE_AD_CLIENT_SECRET=... AUTH_SECRET=... NEXTAUTH_URL=https://your-app.fly.dev
fly deploy
```

### Render / Railway

Use the standard Node.js build:
- Build command: `npm run build`
- Start command: `npm start`
- Set env vars in the platform dashboard

### Docker / Self-managed VM

```bash
npm run build
npm start   # runs on port 3000 by default
```

Or build a Docker image:

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

> Note: add `output: "standalone"` to `next.config.ts` for the Docker build.

---

## 6. MCP Server (optional)

To use the MCP integration against your self-hosted instance:

1. Set `TEAMSLY_MCP_SECRET` in your deployment env vars
2. Configure your MCP client to point at your URL:

```json
{
  "mcpServers": {
    "teamsly": {
      "command": "npx",
      "args": ["-y", "teamsly-mcp"],
      "env": {
        "TEAMSLY_BASE_URL": "https://your-domain.com",
        "TEAMSLY_MCP_SECRET": "your-mcp-secret"
      }
    }
  }
}
```

---

## Troubleshooting

**Auth error: AADSTS9002339**
Your Azure app is configured for work accounts only. Go to App registrations → Authentication → change Supported account types to include personal Microsoft accounts.

**"There is a problem with the server configuration"**
`AUTH_SECRET` is missing or incorrect. Generate a new one: `openssl rand -base64 32`.

**NEXTAUTH_URL mismatch**
Make sure `NEXTAUTH_URL` matches exactly the domain the app is served from (no trailing slash, correct scheme).

**Token refresh errors after 1 hour**
If Graph calls start failing ~1 hour after sign-in, the access token refresh is failing. Most common cause: new API permissions were added after the user last signed in. Ask users to sign out and back in to grant the new scopes.

---

## License

AGPL-3.0. If you run a modified version as a public service, you must publish your source changes under the same license.
