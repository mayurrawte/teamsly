import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import {
  Star,
  GitFork,
  ShieldCheck,
  Bot,
  Command,
  Sparkles,
  Timer,
  Mic,
  Palette,
  CalendarClock,
  Slash,
  Smile,
  Bell,
  FileText,
  Download,
  Check,
  X,
  Apple,
  MonitorDown,
} from "lucide-react";

const REPO = "https://github.com/mayurrawte/teamsly";
const RELEASES = `${REPO}/releases/latest`;

// Live star count, cached for an hour. Falls back to null on any failure so the
// button still renders (just without a number).
async function getStars(): Promise<number | null> {
  try {
    const res = await fetch("https://api.github.com/repos/mayurrawte/teamsly", {
      next: { revalidate: 3600 },
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { stargazers_count?: number };
    return typeof data.stargazers_count === "number" ? data.stargazers_count : null;
  } catch {
    return null;
  }
}

export default async function LandingPage() {
  const session = await auth();
  if (session) redirect("/workspace");

  const stars = await getStars();

  return (
    <div className="min-h-screen bg-[#0d1117] text-white">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-white/5 bg-[#0d1117]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <Logo size={26} className="text-white" />
            <span className="text-[15px] font-bold tracking-tight">
              <span style={{ color: "#818CF8" }}>Teams</span>
              <span className="text-white">ly</span>
            </span>
          </div>
          <div className="hidden items-center gap-7 md:flex">
            <Link href="/features" className="text-[13px] text-[#8b9ab0] transition-colors hover:text-white">Features</Link>
            <a href="#mcp" className="text-[13px] text-[#8b9ab0] transition-colors hover:text-white">MCP</a>
            <a href="#self-host" className="text-[13px] text-[#8b9ab0] transition-colors hover:text-white">Self-host</a>
            <a href="#faq" className="text-[13px] text-[#8b9ab0] transition-colors hover:text-white">FAQ</a>
          </div>
          <div className="flex items-center gap-3">
            <StarButton stars={stars} />
            <Link
              href="/login"
              className="rounded-lg px-4 py-2 text-[13px] font-semibold text-white transition-all hover:brightness-110"
              style={{ background: "linear-gradient(135deg, #6366F1 0%, #818CF8 100%)" }}
            >
              Sign in
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative mx-auto max-w-6xl px-6 pb-16 pt-20 text-center">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(ellipse 70% 50% at 50% 15%, rgba(99,102,241,0.22) 0%, transparent 70%)",
          }}
        />
        <div className="relative">
          <a
            href={REPO}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-6 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-widest transition-colors hover:text-white"
            style={{ borderColor: "rgba(129,140,248,0.4)", color: "#818CF8", background: "rgba(129,140,248,0.08)" }}
          >
            Open source · AGPL-3.0
          </a>
          <h1 className="mx-auto mb-6 max-w-3xl text-4xl font-black leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
            A keyboard-first
            <br />
            Microsoft Teams client.
          </h1>
          <p className="mx-auto mb-9 max-w-2xl text-[17px] leading-relaxed text-[#8b9ab0]">
            Teamsly connects to your real Teams account through the official Microsoft Graph
            API — same channels, DMs, and files — and adds what Teams never shipped: a command
            palette, AI thread summaries, voice rooms, disappearing DMs, themes, and an MCP
            server that lets Claude read and send your messages.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/login"
              className="rounded-xl px-6 py-3 text-[15px] font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98]"
              style={{
                background: "linear-gradient(135deg, #6366F1 0%, #818CF8 100%)",
                boxShadow: "0 0 0 1px rgba(99,102,241,0.5), 0 8px 24px rgba(99,102,241,0.25)",
              }}
            >
              Sign in with Microsoft →
            </Link>
            <Link
              href="/demo"
              className="rounded-xl border px-6 py-3 text-[15px] font-semibold text-[#8b9ab0] transition-colors hover:border-[#6366F1] hover:text-white"
              style={{ borderColor: "rgba(255,255,255,0.1)" }}
            >
              Try the live demo
            </Link>
            <a
              href={RELEASES}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-xl border px-6 py-3 text-[15px] font-semibold text-[#8b9ab0] transition-colors hover:border-[#6366F1] hover:text-white"
              style={{ borderColor: "rgba(255,255,255,0.1)" }}
            >
              <Download size={16} /> Download
            </a>
          </div>
          <p className="mt-4 text-[12px] text-[#3d4a5c]">
            No account needed for the demo · macOS, Windows &amp; Linux desktop apps
          </p>
        </div>

        {/* Real product screenshot */}
        <BrowserFrame className="mt-14">
          <img src="/shots/workspace.png" alt="Teamsly workspace — channels, messages, and sidebar" className="block w-full" loading="eager" />
        </BrowserFrame>
      </section>

      {/* Trust bar */}
      <section className="border-y border-white/5 bg-[#0b0f15]">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-8 gap-y-2 px-6 py-4 text-[12px] font-medium text-[#5b6b80]">
          <span className="flex items-center gap-1.5"><ShieldCheck size={14} style={{ color: "#818CF8" }} /> Data stays in Microsoft 365</span>
          <span className="flex items-center gap-1.5"><GitFork size={14} style={{ color: "#818CF8" }} /> AGPL-3.0, self-hostable</span>
          <span className="flex items-center gap-1.5"><Bot size={14} style={{ color: "#818CF8" }} /> Works with Claude &amp; Cursor</span>
          <span className="flex items-center gap-1.5"><Command size={14} style={{ color: "#818CF8" }} /> Built on Microsoft Graph</span>
        </div>
      </section>

      {/* MCP highlight */}
      <section id="mcp" className="mx-auto max-w-6xl scroll-mt-20 px-6 pb-20 pt-24">
        <div
          className="rounded-2xl p-8 lg:p-12"
          style={{
            background: "linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(129,140,248,0.06) 100%)",
            border: "1px solid rgba(99,102,241,0.25)",
          }}
        >
          <div className="lg:flex lg:items-center lg:gap-12">
            <div className="lg:flex-1">
              <Eyebrow>The part you can&apos;t get anywhere else</Eyebrow>
              <h2 className="mb-4 text-3xl font-black tracking-tight lg:text-4xl">
                Let Claude send your Teams messages.
              </h2>
              <p className="mb-6 text-[15px] leading-relaxed text-[#8b9ab0]">
                Teamsly ships a built-in <span className="text-white">MCP server</span>. Add it to
                Claude Code, Claude Desktop, or Cursor and your AI can find people, send DMs, read
                chats, and post to channels — no copy-paste, no switching windows.
              </p>
              <div className="mb-6 flex flex-wrap gap-2">
                {["find_people", "send_dm", "list_chats", "get_chat_messages", "send_channel_message"].map((t) => (
                  <code key={t} className="rounded-md px-2 py-1 font-mono text-[12px]" style={{ background: "rgba(13,17,23,0.6)", color: "#818CF8", border: "1px solid rgba(255,255,255,0.08)" }}>
                    {t}
                  </code>
                ))}
              </div>
              <a href={`${REPO}/tree/main/mcp-server`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-[13px] font-semibold transition-colors hover:text-white" style={{ color: "#818CF8" }}>
                Read the MCP setup guide →
              </a>
            </div>
            <div className="mt-8 lg:mt-0 lg:w-[440px]">
              <CodeBlock>{`// .mcp.json — auto-discovered by Claude Code
{
  "mcpServers": {
    "teamsly": {
      "command": "npx",
      "args": ["tsx", "mcp-server/index.ts"]
    }
  }
}

// then, in any chat:
You:    DM Priya — running 5 min late
Claude: ✓ Sent to Priya Sharma`}</CodeBlock>
            </div>
          </div>
        </div>
      </section>

      {/* Feature rows with real screenshots */}
      <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-6">
        <FeatureRow
          eyebrow="Your real Teams, faster"
          title="Channels, DMs, threads — all live from Graph"
          body="Everything is fetched live from the Microsoft Graph API: channels, group and 1:1 chats, threaded replies, reactions, mentions, and file attachments. No scraping, no shadow copy — Teamsly stores nothing of its own."
          points={["Channels & direct messages", "Threads, reactions & mentions", "Inline file previews", "Org-wide people search"]}
          shot="/shots/workspace.png"
          alt="Teamsly channel view"
        />
        <FeatureRow
          reverse
          eyebrow="Keyboard-first"
          title="Jump anywhere with ⌘K"
          body="A fast command palette to jump between channels and DMs, plus shortcuts throughout. Search finds people you've never messaged and starts a DM in one keystroke."
          points={["⌘K quick switcher", "Org directory search", "Shortcuts for everything", "Built for people who live in the terminal"]}
          shot="/shots/cmdk.png"
          alt="Teamsly command palette"
        />
        <FeatureRow
          eyebrow="Messaging, done right"
          title="DMs with disappearing messages"
          body="Send a DM that self-destructs after 30 seconds, 5 minutes, or an hour — it shows a live countdown and vanishes for both sides. Reactions, edits, forwarding, and emoji/GIF are all here too."
          points={["Disappearing DMs (30s / 5m / 1h)", "Emoji & GIF picker (Tenor)", "Edit, delete, forward", "Smart notifications & focus mode"]}
          shot="/shots/dm.png"
          alt="Teamsly direct message view"
        />
      </section>

      {/* And more grid */}
      <section className="mx-auto max-w-6xl px-6 pb-24 pt-8">
        <h2 className="mb-3 text-center text-3xl font-black tracking-tight">And a lot more</h2>
        <p className="mb-12 text-center text-[15px] text-[#8b9ab0]">The things you&apos;d expect from a client built by people who use it daily.</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: Sparkles, title: "AI unread summaries", description: "Catch up on long threads in seconds — Claude highlights blockers and decisions." },
            { icon: Mic, title: "Voice rooms", description: "Drop-in audio per channel or DM, powered by LiveKit. No meeting links." },
            { icon: Palette, title: "Themes & density", description: "Slate, Midnight, Sepia & Forest palettes; comfortable, compact, or cozy density." },
            { icon: CalendarClock, title: "Calendar auto-status", description: "Your Outlook calendar drives presence — \"In a meeting until 12:30\" automatically." },
            { icon: Slash, title: "Slash commands", description: "/giphy, /roll, /8ball, /shrug and more, with an autocomplete menu." },
            { icon: Timer, title: "Disappearing messages", description: "Ephemeral DMs cloaked in transit, with a live expiry countdown." },
            { icon: Bell, title: "Smart notifications", description: "Mentions-only mode, keyword alerts, and a focus mode that respects your time." },
            { icon: FileText, title: "Rich link & GitHub cards", description: "PRs, issues, YouTube, Loom and Figma links expand into inline cards." },
            { icon: Bot, title: "MCP server", description: "Find people, send DMs and post to channels from Claude or Cursor." },
          ].map(({ icon: Icon, title, description }) => (
            <div key={title} className="rounded-xl p-5" style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="mb-3 flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "rgba(99,102,241,0.18)" }}>
                  <Icon size={16} style={{ color: "#818CF8" }} strokeWidth={1.8} />
                </div>
                <span className="text-[13px] font-semibold text-white">{title}</span>
              </div>
              <p className="text-[12px] leading-relaxed text-[#8b9ab0]">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Comparison */}
      <section className="mx-auto max-w-3xl px-6 pb-24">
        <h2 className="mb-10 text-center text-3xl font-black tracking-tight">Teams vs. Teamsly</h2>
        <div className="overflow-hidden rounded-2xl" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
          {[
            ["Open source", false, true],
            ["Self-hostable", false, true],
            ["⌘K command palette", false, true],
            ["Themes & density presets", false, true],
            ["AI thread summaries", false, true],
            ["MCP server for AI assistants", false, true],
            ["Disappearing messages", false, true],
            ["Your data stays in Microsoft 365", true, true],
          ].map(([label, teams, teamsly], i) => (
            <div
              key={label as string}
              className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-5 py-3 text-[13px]"
              style={{
                background: i % 2 ? "transparent" : "rgba(255,255,255,0.02)",
                borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.05)",
              }}
            >
              <span className="text-[#c9d3e0]">{label as string}</span>
              <span className="w-16 text-center text-[#5b6b80]">{teams ? <Check size={16} className="mx-auto text-[#5b6b80]" /> : <X size={16} className="mx-auto text-[#3d4a5c]" />}</span>
              <span className="w-16 text-center">{teamsly ? <Check size={16} className="mx-auto" style={{ color: "#818CF8" }} /> : <X size={16} className="mx-auto text-[#3d4a5c]" />}</span>
            </div>
          ))}
          <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#3d4a5c]" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
            <span />
            <span className="w-16 text-center">Teams</span>
            <span className="w-16 text-center" style={{ color: "#818CF8" }}>Teamsly</span>
          </div>
        </div>
      </section>

      {/* Self-host */}
      <section id="self-host" className="mx-auto max-w-6xl scroll-mt-20 px-6 pb-24">
        <div className="lg:flex lg:items-center lg:gap-12">
          <div className="lg:flex-1">
            <Eyebrow>Free &amp; open source</Eyebrow>
            <h2 className="mb-4 text-3xl font-black tracking-tight lg:text-4xl">Run your own instance</h2>
            <p className="mb-6 text-[15px] leading-relaxed text-[#8b9ab0]">
              No paywall, no feature gates. Clone it, point it at your own Azure AD app, and deploy
              to Vercel, Fly, Render, or a VM. Or skip the setup and use the hosted instance at
              teamsly.app — same code, same features.
            </p>
            <div className="flex flex-wrap gap-3">
              <a href={REPO} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-[14px] font-semibold text-white transition-all hover:brightness-110" style={{ background: "linear-gradient(135deg, #6366F1 0%, #818CF8 100%)" }}>
                <GitFork size={15} /> Clone on GitHub
              </a>
              <a href={`${REPO}/blob/main/SELF_HOSTING.md`} target="_blank" rel="noopener noreferrer" className="rounded-xl border px-5 py-2.5 text-[14px] font-semibold text-[#8b9ab0] transition-colors hover:border-[#6366F1] hover:text-white" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
                Self-hosting guide
              </a>
            </div>
          </div>
          <div className="mt-8 lg:mt-0 lg:w-[460px]">
            <CodeBlock>{`git clone https://github.com/mayurrawte/teamsly
cd teamsly

# add your Azure AD app credentials
cp .env.example .env.local

npm install
npm run dev   # → http://localhost:3000`}</CodeBlock>
          </div>
        </div>
      </section>

      {/* Download */}
      <section className="mx-auto max-w-4xl px-6 pb-24 text-center">
        <h2 className="mb-3 text-3xl font-black tracking-tight">Get the desktop app</h2>
        <p className="mb-10 text-[15px] text-[#8b9ab0]">Native builds for every platform, with auto-updates. Or just use it in your browser.</p>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { icon: Apple, os: "macOS", note: "Apple Silicon & Intel · .dmg" },
            { icon: MonitorDown, os: "Windows", note: "Installer & portable · .exe" },
            { icon: MonitorDown, os: "Linux", note: "AppImage & .deb" },
          ].map(({ icon: Icon, os, note }) => (
            <a key={os} href={RELEASES} target="_blank" rel="noopener noreferrer" className="group flex flex-col items-center gap-2 rounded-xl p-6 transition-colors hover:border-[#6366F1]" style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.07)" }}>
              <Icon size={26} className="text-[#8b9ab0] transition-colors group-hover:text-white" strokeWidth={1.6} />
              <span className="text-[15px] font-semibold text-white">{os}</span>
              <span className="text-[12px] text-[#5b6b80]">{note}</span>
            </a>
          ))}
        </div>
      </section>

      {/* Roadmap */}
      <section className="mx-auto max-w-4xl px-6 pb-24">
        <h2 className="mb-3 text-center text-3xl font-black tracking-tight">Built in the open</h2>
        <p className="mb-12 text-center text-[15px] text-[#8b9ab0]">Shipping fast. Here&apos;s what&apos;s done and what&apos;s next.</p>
        <div className="grid gap-6 sm:grid-cols-2">
          <RoadmapCol
            title="Shipped"
            accent="#34d399"
            items={["Channels, DMs & threads", "AI unread summaries", "MCP server + find_people / send_dm", "Voice rooms (LiveKit)", "Calendar auto-status", "Themes, density & motion", "Disappearing messages", "Slash commands & GitHub cards", "⌘K command palette", "Desktop apps (mac/Win/Linux)"]}
            done
          />
          <RoadmapCol
            title="Planned"
            accent="#818CF8"
            items={["Real-time DM push (sub-second)", "Send-later messages", "AI action-item extractor", "Voice memos + transcripts", "Anonymous polls", "Channel snooze UI", "Per-channel read receipts", "Linear live cards"]}
          />
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-6 pb-24">
        <h2 className="mb-10 text-center text-3xl font-black tracking-tight">Questions</h2>
        <div className="flex flex-col gap-3">
          {[
            { q: "Where does my data live?", a: "In your own Microsoft 365 tenant. Teamsly reads and writes through the official Graph API and stores nothing on its servers — messages and files never leave Microsoft." },
            { q: "Do I need an Azure AD app?", a: "Only if you self-host — you bring your own app registration. On the hosted instance at teamsly.app you just sign in with Microsoft; no setup." },
            { q: "Are disappearing messages encrypted?", a: "They're cloaked in transit so they don't render as plain text in native Teams, and they carry an expiry. This is not end-to-end encryption — it's an ephemerality feature, not a security guarantee." },
            { q: "Is it really open source?", a: "Yes — AGPL-3.0. Read every line, file issues, send PRs, or fork it. A commercial license is available for organisations that need one." },
            { q: "Is there a mobile app?", a: "Not yet. Teamsly is a desktop (macOS/Windows/Linux) and web client today. Mobile may come later." },
            { q: "What's it built with?", a: "Next.js, NextAuth, the Microsoft Graph SDK, LiveKit for voice, and Electron for the desktop builds." },
          ].map(({ q, a }) => (
            <div key={q} className="rounded-xl p-5" style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.07)" }}>
              <h3 className="mb-2 text-[14px] font-semibold text-white">{q}</h3>
              <p className="text-[13px] leading-relaxed text-[#8b9ab0]">{a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-6 pb-24 text-center">
        <div className="rounded-2xl px-8 py-16" style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(129,140,248,0.06) 100%)", border: "1px solid rgba(99,102,241,0.25)" }}>
          <h2 className="mb-4 text-3xl font-black tracking-tight lg:text-4xl">Give Teams a client worth opening.</h2>
          <p className="mx-auto mb-8 max-w-md text-[15px] text-[#8b9ab0]">Sign in with Microsoft, or try the demo first — no account needed.</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/login" className="rounded-xl px-6 py-3 text-[15px] font-semibold text-white transition-all hover:brightness-110" style={{ background: "linear-gradient(135deg, #6366F1 0%, #818CF8 100%)", boxShadow: "0 8px 24px rgba(99,102,241,0.25)" }}>
              Sign in with Microsoft →
            </Link>
            <Link href="/demo" className="rounded-xl border px-6 py-3 text-[15px] font-semibold text-[#8b9ab0] transition-colors hover:border-[#6366F1] hover:text-white" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
              Live demo
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t px-6 py-8" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Logo size={20} className="text-white" />
            <span className="text-[13px] text-[#3d4a5c]">Teamsly · AGPL-3.0 · Not affiliated with Microsoft</span>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-[12px] text-[#3d4a5c]">
            <a href={REPO} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-white">GitHub</a>
            <a href={RELEASES} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-white">Releases</a>
            <a href={`${REPO}/issues`} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-white">Issues</a>
            <Link href="/demo" className="transition-colors hover:text-white">Demo</Link>
            <Link href="/privacy" className="transition-colors hover:text-white">Privacy</Link>
            <Link href="/terms" className="transition-colors hover:text-white">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function StarButton({ stars }: { stars: number | null }) {
  return (
    <a
      href={REPO}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px] font-semibold text-[#8b9ab0] transition-colors hover:border-[#6366F1] hover:text-white"
      style={{ borderColor: "rgba(255,255,255,0.1)" }}
    >
      <Star size={14} />
      <span className="hidden sm:inline">Star</span>
      {stars !== null && (
        <span className="rounded px-1.5 py-0.5 text-[11px] tabular-nums" style={{ background: "rgba(255,255,255,0.06)", color: "#c9d3e0" }}>
          {stars}
        </span>
      )}
    </a>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-4 inline-block rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-widest" style={{ background: "rgba(129,140,248,0.15)", color: "#818CF8" }}>
      {children}
    </span>
  );
}

function BrowserFrame({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl ${className}`} style={{ border: "1px solid rgba(255,255,255,0.08)", background: "#111827", boxShadow: "0 32px 80px rgba(0,0,0,0.6)" }}>
      <div className="flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
        <div className="h-3 w-3 rounded-full bg-[#ff5f57]" />
        <div className="h-3 w-3 rounded-full bg-[#febc2e]" />
        <div className="h-3 w-3 rounded-full bg-[#28c840]" />
        <div className="ml-2 rounded px-3 py-0.5 text-[11px] text-[#3d4a5c]" style={{ background: "rgba(255,255,255,0.04)" }}>teamsly.app</div>
      </div>
      {children}
    </div>
  );
}

function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <pre className="overflow-x-auto rounded-xl p-4 font-mono text-[12px] leading-loose text-[#8b9ab0]" style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.08)" }}>
      {children}
    </pre>
  );
}

function FeatureRow({
  eyebrow, title, body, points, shot, alt, reverse = false,
}: {
  eyebrow: string; title: string; body: string; points: string[]; shot: string; alt: string; reverse?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center gap-10 py-12 lg:gap-16 ${reverse ? "lg:flex-row-reverse" : "lg:flex-row"}`}>
      <div className="lg:flex-1">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 className="mb-4 text-2xl font-black tracking-tight lg:text-3xl">{title}</h2>
        <p className="mb-6 text-[15px] leading-relaxed text-[#8b9ab0]">{body}</p>
        <ul className="flex flex-col gap-2.5 text-[14px] text-[#c9d3e0]">
          {points.map((p) => (
            <li key={p} className="flex items-center gap-2.5">
              <Check size={15} style={{ color: "#818CF8" }} strokeWidth={2.5} /> {p}
            </li>
          ))}
        </ul>
      </div>
      <div className="w-full lg:flex-1">
        <BrowserFrame>
          <img src={shot} alt={alt} className="block w-full" loading="lazy" />
        </BrowserFrame>
      </div>
    </div>
  );
}

function RoadmapCol({ title, accent, items, done = false }: { title: string; accent: string; items: string[]; done?: boolean }) {
  return (
    <div className="rounded-2xl p-6" style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.07)" }}>
      <div className="mb-4 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider" style={{ color: accent }}>
        <span className="h-2 w-2 rounded-full" style={{ background: accent }} /> {title}
      </div>
      <ul className="flex flex-col gap-2.5 text-[13px] text-[#8b9ab0]">
        {items.map((it) => (
          <li key={it} className="flex items-start gap-2.5">
            {done ? <Check size={15} className="mt-0.5 flex-shrink-0" style={{ color: accent }} strokeWidth={2.5} /> : <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: accent }} />}
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}
