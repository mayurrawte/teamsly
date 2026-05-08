# Teamsly

**The Slack experience, powered by Microsoft Teams.**

Your company forces you to use Teams. You miss Slack. Teamsly gives you the familiar sidebar, clean message feed, and fast keyboard-driven UX — all reading and writing directly to your real Microsoft Teams data via the official Graph API.

No data leaves Microsoft. No shadow IT. Just a better interface.

![Teamsly Screenshot](docs/screenshot.png)

---

## Download

### Desktop apps (zero config — sign in and go)

| Platform | Download |
|---|---|
| macOS (Apple Silicon + Intel) | [Teamsly.dmg](https://teamsly.app/download/mac) |
| Windows | [Teamsly-Setup.exe](https://teamsly.app/download/win) |
| Linux | [Teamsly.AppImage](https://teamsly.app/download/linux) |

**No Azure setup. No env files. No IT involvement.** Download → open → sign in with Microsoft → done in ~90 seconds.

### Web

Just go to [teamsly.app](https://teamsly.app) and sign in. Same UX, no install.

### Self-host

Want to run your own instance? See [docs/SELF_HOSTING.md](docs/SELF_HOSTING.md). One command: `docker compose up`.

---

## Features

- **Slack-like sidebar** — workspace switcher, channels list, DMs
- **Clean message feed** — threaded conversations, reactions, file attachments
- **Fast message input** — keyboard shortcuts, Enter to send, Shift+Enter for newline
- **Real data** — reads and writes via Microsoft Graph API (official, no scraping)
- **Self-hostable** — deploy anywhere, your data stays in Microsoft's infrastructure
- **Dark theme** — easy on the eyes, inspired by Slack's dark mode

### Coming soon (Pro / hosted)
- AI message summaries — catch up on 200 unread messages in 10 seconds
- Multi-tenant — connect multiple Teams orgs in one sidebar
- Smart notifications — keyword alerts, digest mode, snooze
- Richer message formatting — full Slack-compatible markdown

---

## Tech stack

- **Next.js 15** (App Router) + **TypeScript**
- **Tailwind CSS v4** + **Radix UI** primitives
- **Microsoft Graph API** via `@microsoft/microsoft-graph-client`
- **NextAuth v5** with Microsoft Entra ID provider
- **Zustand** for client state

---

## Getting started

### 1. Register an Azure AD app

1. Go to [Azure Portal](https://portal.azure.com) → **Azure Active Directory** → **App registrations** → **New registration**
2. Set redirect URI: `http://localhost:3000/api/auth/callback/microsoft-entra-id`
3. Under **Certificates & secrets**, create a client secret
4. Under **API permissions**, add these **delegated** permissions:
   - `User.Read`
   - `Team.ReadBasic.All`
   - `Channel.ReadBasic.All`
   - `ChannelMessage.Read.All`
   - `ChannelMessage.Send`
   - `Chat.ReadWrite`
   - `Presence.Read.All`
   - `Files.Read.All`
5. Grant admin consent

### 2. Configure environment

```bash
cp .env.example .env.local
```

Fill in your Azure AD credentials:

```env
AZURE_AD_CLIENT_ID=your-client-id
AZURE_AD_CLIENT_SECRET=your-client-secret
AZURE_AD_TENANT_ID=common
AUTH_SECRET=your-random-secret   # openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000
```

### 3. Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign in with your Microsoft account.

---

## Architecture

```
src/
├── app/
│   ├── api/              # Next.js API routes (proxy to Graph API)
│   │   ├── auth/         # NextAuth handler
│   │   ├── teams/        # GET /api/teams
│   │   ├── channels/     # GET /api/channels/[teamId]
│   │   ├── messages/     # GET+POST /api/messages/[teamId]/[channelId]
│   │   ├── chats/        # GET /api/chats + messages
│   │   └── me/           # GET /api/me
│   └── app/              # Main authenticated app
│       ├── t/[teamId]/[channelId]/  # Channel view
│       └── dm/[chatId]/             # DM view
├── components/
│   ├── layout/           # AppShell, Providers, SignInPage
│   ├── sidebar/          # WorkspaceBar, Sidebar, UserFooter
│   └── messages/         # ChannelView, ChatView, MessageFeed, MessageItem, MessageInput
├── lib/
│   ├── auth/             # NextAuth config
│   └── graph/            # Microsoft Graph API client
├── store/                # Zustand workspace state
└── types/                # Global TypeScript types (MSTeam, MSMessage, etc.)
```

All Microsoft data flows: `Browser → Next.js API route → Microsoft Graph API → Microsoft's servers`. Nothing is stored in Teamsly.

---

## Real-time updates

Currently uses polling (every 5 seconds). The roadmap includes [Microsoft Graph change notifications](https://learn.microsoft.com/en-us/graph/change-notifications-overview) (webhooks) for near-real-time updates with ~1-3s latency.

---

## Deployment

### Vercel (easiest)

```bash
npx vercel
```

Set the same env vars in the Vercel dashboard. Update `NEXTAUTH_URL` to your production URL and add the production redirect URI to your Azure AD app.

### Docker

```dockerfile
# Dockerfile coming soon
```

### Self-hosted

Any Node.js 20+ host. `npm run build && npm start`.

---

## Legal

Built entirely on [Microsoft Graph API](https://learn.microsoft.com/en-us/graph/overview) (official, public API). This project:

- Does **not** reverse-engineer the Teams client
- Does **not** use private or undocumented APIs
- Does **not** store user data outside Microsoft infrastructure
- Is covered by Microsoft's [EU interoperability commitments (AT.40721)](https://learn.microsoft.com/en-us/legal/microsoft-apis/terms-of-use)

Users authenticate directly with Microsoft via OAuth 2.0. Teamsly never sees your password.

---

## Contributing

PRs welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for setup.

Key areas for contribution:
- [ ] Graph change notifications (real-time)
- [ ] Thread/reply support
- [ ] File preview
- [ ] Emoji picker
- [ ] Message reactions
- [ ] Search
- [ ] Electron desktop wrapper
- [ ] AI message summaries (Pro feature)

---

## License

[AGPL-3.0](LICENSE) — free to self-host, modify, and contribute. Commercial hosting requires a separate license.

---

*Built by [@mayurrawte](https://github.com/mayurrawte) · Not affiliated with Microsoft*
