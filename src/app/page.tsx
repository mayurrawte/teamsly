import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import {
  Zap,
  GitFork,
  ShieldCheck,
  Bot,
  Smile,
  Bell,
  Terminal,
  Users,
  Globe,
} from "lucide-react";

export default async function LandingPage() {
  const session = await auth();
  if (session) redirect("/workspace");

  return (
    <div className="min-h-screen bg-[#0d1117] text-white">
      {/* Nav */}
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <Logo size={28} className="text-white" />
          <span className="text-[15px] font-bold tracking-tight">
            <span style={{ color: "#818CF8" }}>Teams</span>
            <span className="text-white">ly</span>
          </span>
        </div>
        <div className="flex items-center gap-6">
          <a
            href="https://github.com/mayurrawte/teamsly"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[13px] text-[#8b9ab0] transition-colors hover:text-white"
          >
            <GitFork size={14} />
            GitHub
          </a>
          <Link
            href="/demo"
            className="text-[13px] text-[#8b9ab0] transition-colors hover:text-white"
          >
            Demo
          </Link>
          <Link
            href="/login"
            className="rounded-lg px-4 py-2 text-[13px] font-semibold text-white transition-all hover:brightness-110"
            style={{
              background: "linear-gradient(135deg, #6366F1 0%, #818CF8 100%)",
            }}
          >
            Sign in
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative mx-auto max-w-6xl px-6 pb-24 pt-20 text-center">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(ellipse 70% 50% at 50% 20%, rgba(99,102,241,0.22) 0%, transparent 70%)",
          }}
        />
        <div className="relative">
          <span
            className="mb-5 inline-block rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-widest"
            style={{
              borderColor: "rgba(129,140,248,0.4)",
              color: "#818CF8",
              background: "rgba(129,140,248,0.08)",
            }}
          >
            Open source · AGPL-3.0
          </span>
          <h1 className="mx-auto mb-6 max-w-3xl text-5xl font-black leading-[1.1] tracking-tight lg:text-6xl">
            A faster, calmer way to
            <br />
            <span style={{ color: "#818CF8" }}>use Microsoft Teams.</span>
          </h1>
          <p className="mx-auto mb-10 max-w-xl text-[17px] leading-relaxed text-[#8b9ab0]">
            Teamsly is an open-source Teams client built for focus — clean UI,
            keyboard-first navigation, AI summaries, and MCP support so your
            AI assistant can read and send Teams messages.
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
              Get started free →
            </Link>
            <a
              href="https://github.com/mayurrawte/teamsly"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-xl border px-6 py-3 text-[15px] font-semibold text-[#8b9ab0] transition-colors hover:border-[#6366F1] hover:text-white"
              style={{ borderColor: "rgba(255,255,255,0.1)" }}
            >
              <GitFork size={16} />
              View on GitHub
            </a>
            <Link
              href="/demo"
              className="rounded-xl border px-6 py-3 text-[15px] font-semibold text-[#8b9ab0] transition-colors hover:border-[#6366F1] hover:text-white"
              style={{ borderColor: "rgba(255,255,255,0.1)" }}
            >
              Live demo
            </Link>
          </div>
        </div>
      </section>

      {/* App preview */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <div
          className="relative overflow-hidden rounded-2xl"
          style={{
            border: "1px solid rgba(255,255,255,0.08)",
            background: "#111827",
            boxShadow: "0 32px 80px rgba(0,0,0,0.6)",
          }}
        >
          <div
            className="flex items-center gap-2 border-b px-4 py-3"
            style={{ borderColor: "rgba(255,255,255,0.07)" }}
          >
            <div className="h-3 w-3 rounded-full bg-[#ff5f57]" />
            <div className="h-3 w-3 rounded-full bg-[#febc2e]" />
            <div className="h-3 w-3 rounded-full bg-[#28c840]" />
            <div
              className="ml-2 rounded px-3 py-0.5 text-[11px] text-[#3d4a5c]"
              style={{ background: "rgba(255,255,255,0.04)" }}
            >
              teamsly.app
            </div>
          </div>
          <div className="flex h-[360px]">
            <div
              className="flex w-56 flex-col gap-1 border-r p-3"
              style={{ borderColor: "rgba(255,255,255,0.07)", background: "#0d1117" }}
            >
              <div className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-[#3d4a5c]">
                General
              </div>
              {["# announcements", "# engineering", "# design", "# random"].map((ch) => (
                <div key={ch} className="rounded-md px-2 py-1.5 text-[12px] text-[#4a5568]">
                  {ch}
                </div>
              ))}
              <div className="mb-2 mt-3 px-2 text-[10px] font-semibold uppercase tracking-widest text-[#3d4a5c]">
                Direct Messages
              </div>
              {["Alice Chen", "Bob Kumar", "Sarah Lee"].map((name, i) => (
                <div
                  key={name}
                  className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px] ${i === 0 ? "bg-[#6366F122] text-white" : "text-[#4a5568]"}`}
                >
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1e3a5f] text-[9px] text-[#818CF8]">
                    {name[0]}
                  </div>
                  {name}
                </div>
              ))}
            </div>
            <div className="flex flex-1 flex-col">
              <div
                className="mx-3 mt-3 rounded-md border px-3 py-2 text-[11px]"
                style={{ borderColor: "#3f4144", background: "rgba(99,102,241,0.1)" }}
              >
                <div className="mb-0.5 flex items-center gap-1.5 font-semibold text-white">
                  <span style={{ color: "#38BDF8" }}>✦</span> AI unread summary
                </div>
                <p className="text-[#ababad]">
                  • Alice shared the Q2 design specs — review requested by EOD
                  <br />
                  • Blocker: API rate limits hit prod, Bob is investigating
                </p>
              </div>
              <div className="flex flex-1 flex-col gap-3 p-4">
                {[
                  { name: "Alice Chen", msg: "Hey, can you review the PR when you get a chance?", time: "10:32 AM" },
                  { name: "You", msg: "On it! Give me 15 minutes.", time: "10:34 AM" },
                  { name: "Alice Chen", msg: "Thanks! No rush 🙏", time: "10:35 AM" },
                ].map((m) => (
                  <div key={m.time} className="flex items-start gap-2.5">
                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#1e3a5f] text-[11px] text-[#818CF8]">
                      {m.name[0]}
                    </div>
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-[12px] font-semibold text-white">{m.name}</span>
                        <span className="text-[10px] text-[#3d4a5c]">{m.time}</span>
                      </div>
                      <p className="text-[12px] text-[#8b9ab0]">{m.msg}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div
                className="mx-3 mb-3 rounded-lg border px-3 py-2 text-[12px] text-[#3d4a5c]"
                style={{ borderColor: "rgba(255,255,255,0.08)", background: "#1a1d21" }}
              >
                Message Alice Chen...
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <h2 className="mb-3 text-center text-3xl font-black tracking-tight">
          Everything Teams is missing
        </h2>
        <p className="mb-12 text-center text-[15px] text-[#8b9ab0]">
          Built on the official Microsoft Graph API. No scraping. No shadow IT.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: Bot,
              title: "MCP Server",
              badge: "Unique",
              description:
                "Connect Claude, Cursor, or any AI assistant to your Teams. Read messages, send replies — all via MCP tools.",
            },
            {
              icon: Zap,
              title: "AI Unread Summaries",
              description:
                "Catch up on long threads in seconds. Powered by Claude — highlights blockers and decisions automatically.",
            },
            {
              icon: Smile,
              title: "Emoji & GIF Picker",
              description:
                "Full emoji picker with skin tone support and a built-in GIF search powered by Tenor. No extra setup.",
            },
            {
              icon: Bell,
              title: "Smart Notifications",
              description:
                "Mentions-only mode, keyword alerts, and browser notifications that respect your focus time.",
            },
            {
              icon: ShieldCheck,
              title: "Your data stays in Microsoft",
              description:
                "All messages and files are fetched live from Graph API. Teamsly stores nothing on its own servers.",
            },
            {
              icon: Terminal,
              title: "Keyboard-first",
              description:
                "Fast navigation, command palette, and shortcuts throughout. Built for developers who live in the terminal.",
            },
            {
              icon: Globe,
              title: "Self-hostable",
              description:
                "Deploy on Vercel, Fly, Render, or your own VM in minutes. Bring your own Azure AD app registration.",
            },
            {
              icon: Users,
              title: "File previews & reactions",
              description:
                "Inline file preview panel, emoji reactions, threaded replies — all the Teams features you actually use.",
            },
            {
              icon: GitFork,
              title: "Open source · AGPL-3.0",
              description:
                "Inspect every line, contribute features, or fork it. Commercial license available for organisations.",
            },
          ].map(({ icon: Icon, title, badge, description }) => (
            <div
              key={title}
              className="rounded-xl p-5"
              style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <div className="mb-3 flex items-center gap-2">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg"
                  style={{ background: "rgba(99,102,241,0.18)" }}
                >
                  <Icon size={16} style={{ color: "#818CF8" }} strokeWidth={1.8} />
                </div>
                <span className="text-[13px] font-semibold text-white">{title}</span>
                {badge && (
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                    style={{ background: "rgba(129,140,248,0.15)", color: "#818CF8" }}
                  >
                    {badge}
                  </span>
                )}
              </div>
              <p className="text-[12px] leading-relaxed text-[#8b9ab0]">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* MCP highlight */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div
          className="rounded-2xl p-8 lg:p-12"
          style={{
            background: "linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(129,140,248,0.08) 100%)",
            border: "1px solid rgba(99,102,241,0.25)",
          }}
        >
          <div className="lg:flex lg:items-center lg:gap-12">
            <div className="lg:flex-1">
              <span
                className="mb-4 inline-block rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-widest"
                style={{ background: "rgba(129,140,248,0.15)", color: "#818CF8" }}
              >
                MCP Integration
              </span>
              <h2 className="mb-4 text-3xl font-black tracking-tight lg:text-4xl">
                Your AI assistant,
                <br />
                inside Teams.
              </h2>
              <p className="mb-6 text-[15px] leading-relaxed text-[#8b9ab0]">
                Teamsly ships a built-in MCP server. Add it to Claude Desktop or Cursor
                and your AI can list chats, read messages, and send replies — no
                copy-paste, no switching windows.
              </p>
              <a
                href="https://github.com/mayurrawte/teamsly/blob/main/mcp-server/index.ts"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-[13px] font-semibold transition-colors hover:text-white"
                style={{ color: "#818CF8" }}
              >
                View MCP server code →
              </a>
            </div>
            <div className="mt-8 lg:mt-0 lg:w-[420px]">
              <pre
                className="overflow-x-auto rounded-xl p-4 font-mono text-[12px] leading-loose text-[#8b9ab0]"
                style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.08)" }}
              >{`// claude_desktop_config.json
{
  "mcpServers": {
    "teamsly": {
      "command": "npx",
      "args": ["tsx", ".../mcp-server/index.ts"],
      "env": {
        "TEAMSLY_URL": "https://teamsly.app",
        "TEAMSLY_MCP_SECRET": "your-secret"
      }
    }
  }
}`}</pre>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <h2 className="mb-3 text-center text-3xl font-black tracking-tight">Simple pricing</h2>
        <p className="mb-12 text-center text-[15px] text-[#8b9ab0]">
          Free forever for self-hosters. Hosted version free during the launch trial.
        </p>
        <div className="mx-auto grid max-w-2xl gap-4 sm:grid-cols-2">
          <div
            className="rounded-2xl p-6"
            style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <div className="mb-1 text-[13px] font-semibold text-[#8b9ab0]">Self-host</div>
            <div className="mb-4 text-4xl font-black text-white">Free</div>
            <ul className="mb-6 flex flex-col gap-2 text-[13px] text-[#8b9ab0]">
              {[
                "Full source code on GitHub",
                "All features included",
                "Bring your own Azure AD app",
                "Deploy anywhere",
                "MCP server included",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <span style={{ color: "#818CF8" }}>✓</span> {f}
                </li>
              ))}
            </ul>
            <a
              href="https://github.com/mayurrawte/teamsly"
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center rounded-xl border py-2.5 text-[13px] font-semibold text-[#8b9ab0] transition-colors hover:border-[#6366F1] hover:text-white"
              style={{ borderColor: "rgba(255,255,255,0.1)" }}
            >
              View on GitHub
            </a>
          </div>
          <div
            className="rounded-2xl p-6"
            style={{
              background: "linear-gradient(135deg, rgba(99,102,241,0.2) 0%, rgba(129,140,248,0.1) 100%)",
              border: "1px solid rgba(99,102,241,0.35)",
            }}
          >
            <div className="mb-1 text-[13px] font-semibold" style={{ color: "#818CF8" }}>
              Hosted
            </div>
            <div className="mb-1 flex items-end gap-1">
              <span className="text-4xl font-black text-white">Free</span>
            </div>
            <p className="mb-4 text-[11px]" style={{ color: "#818CF8" }}>Free trial · no credit card needed</p>
            <ul className="mb-6 flex flex-col gap-2 text-[13px] text-[#8b9ab0]">
              {[
                "Sign in with Microsoft in one click",
                "No Azure setup needed",
                "AI summaries included",
                "Managed MCP endpoint",
                "Supports the project",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <span style={{ color: "#818CF8" }}>✓</span> {f}
                </li>
              ))}
            </ul>
            <Link
              href="/login"
              className="flex w-full items-center justify-center rounded-xl py-2.5 text-[13px] font-semibold text-white transition-all hover:brightness-110"
              style={{ background: "linear-gradient(135deg, #6366F1 0%, #818CF8 100%)" }}
            >
              Get started free →
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-6 pb-24 text-center">
        <div
          className="rounded-2xl px-8 py-16"
          style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <h2 className="mb-4 text-3xl font-black tracking-tight lg:text-4xl">
            Ready for a calmer Teams?
          </h2>
          <p className="mx-auto mb-8 max-w-md text-[15px] text-[#8b9ab0]">
            Self-host in minutes or try the live demo — no account needed.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/login"
              className="rounded-xl px-6 py-3 text-[15px] font-semibold text-white transition-all hover:brightness-110"
              style={{
                background: "linear-gradient(135deg, #6366F1 0%, #818CF8 100%)",
                boxShadow: "0 8px 24px rgba(99,102,241,0.25)",
              }}
            >
              Get started free →
            </Link>
            <Link
              href="/demo"
              className="rounded-xl border px-6 py-3 text-[15px] font-semibold text-[#8b9ab0] transition-colors hover:border-[#6366F1] hover:text-white"
              style={{ borderColor: "rgba(255,255,255,0.1)" }}
            >
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
            <span className="text-[13px] text-[#3d4a5c]">Teamsly · AGPL-3.0</span>
          </div>
          <div className="flex items-center gap-6 text-[12px] text-[#3d4a5c]">
            <a
              href="https://github.com/mayurrawte/teamsly"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-white"
            >
              GitHub
            </a>
            <a
              href="https://github.com/mayurrawte/teamsly/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-white"
            >
              Issues
            </a>
            <Link href="/demo" className="transition-colors hover:text-white">
              Demo
            </Link>
            <Link href="/privacy" className="transition-colors hover:text-white">
              Privacy
            </Link>
            <Link href="/terms" className="transition-colors hover:text-white">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
