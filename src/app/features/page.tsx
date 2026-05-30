import type { Metadata } from "next";
import Link from "next/link";
import {
  Zap,
  Timer,
  Clock,
  Mic,
  CalendarClock,
  Slash,
  GitBranch,
  FileText,
  Link2,
  Palette,
  Eye,
  Bot,
  ShieldCheck,
} from "lucide-react";
import {
  MarketingNav,
  MarketingFooter,
  Eyebrow,
} from "@/components/marketing/primitives";

export const metadata: Metadata = {
  title: "Features — Teamsly",
  description:
    "Everything Teamsly adds on top of your Microsoft Teams workspace — real-time messaging, scheduled and disappearing DMs, voice rooms, AI digests, themes, an MCP server, and more. Try the live demo, no sign-in required.",
};

type Group = {
  eyebrow: string;
  features: { icon: typeof Zap; title: string; body: string }[];
};

const GROUPS: Group[] = [
  {
    eyebrow: "Messaging",
    features: [
      {
        icon: Zap,
        title: "Real-time messages",
        body: "DMs and channels update sub-second via Microsoft Graph change notifications — no waiting on a poll.",
      },
      {
        icon: Timer,
        title: "Disappearing DMs",
        body: "Send a message that vanishes after 30 seconds, 5 minutes, or an hour — with a live countdown.",
      },
      {
        icon: Clock,
        title: "Send later",
        body: "Compose now, pick a time, and Teamsly delivers the DM at the perfect moment.",
      },
    ],
  },
  {
    eyebrow: "Presence & voice",
    features: [
      {
        icon: Mic,
        title: "Voice rooms",
        body: "Drop-in audio for any channel or DM — Discord-style rooms, right where the conversation lives.",
      },
      {
        icon: CalendarClock,
        title: "Calendar auto-status",
        body: "Your Outlook calendar sets your presence automatically — “In a meeting until 12:30”, heads-down, or away.",
      },
    ],
  },
  {
    eyebrow: "In the flow",
    features: [
      {
        icon: Slash,
        title: "Slash toybox",
        body: "/coinflip, /roll, /giphy, /8ball and more — a little fun without leaving the composer.",
      },
      {
        icon: GitBranch,
        title: "GitHub & Linear cards",
        body: "Paste a PR or issue link and it unfurls into a live card with status, author, and activity.",
      },
      {
        icon: Link2,
        title: "Rich link previews",
        body: "YouTube, Loom, Figma, and Teams meeting links render as clean, joinable previews.",
      },
    ],
  },
  {
    eyebrow: "AI & automation",
    features: [
      {
        icon: FileText,
        title: "AI thread digest",
        body: "/tldr summarizes a long thread into the key points in seconds.",
      },
      {
        icon: Bot,
        title: "Built-in MCP server",
        body: "Drive your Teams workspace from any MCP client — read, search, and send messages programmatically.",
      },
    ],
  },
  {
    eyebrow: "Make it yours",
    features: [
      {
        icon: Palette,
        title: "Themes, density & motion",
        body: "Color palettes, true light and dark, compact density, and motion that feels native — not a web app.",
      },
      {
        icon: Eye,
        title: "Focus mode & quick-react",
        body: "Quiet the noise so only mentions break through, and react to any message with a number key.",
      },
    ],
  },
  {
    eyebrow: "Privacy",
    features: [
      {
        icon: ShieldCheck,
        title: "Private by default",
        body: "No third-party analytics or tracking pixels. Sessions live in memory and your browser — never a database.",
      },
    ],
  },
];

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-[#0d1117] text-white">
      <MarketingNav stars={null} />

      {/* Hero */}
      <header className="mx-auto max-w-6xl px-6 pb-10 pt-16 text-center lg:pt-24">
        <Eyebrow>Features</Eyebrow>
        <h1 className="mx-auto mb-5 max-w-3xl text-4xl font-black leading-[1.08] tracking-tight sm:text-5xl">
          Everything Teamsly adds to your Teams workspace
        </h1>
        <p className="mx-auto mb-8 max-w-2xl text-[16px] leading-relaxed text-[#8b9ab0]">
          Teamsly is a modern client for Microsoft Teams. It keeps your existing
          workspace and layers on the things you wish it had — faster messaging,
          scheduling, voice rooms, AI, deep theming, and an MCP server.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/demo"
            className="rounded-lg px-5 py-2.5 text-[14px] font-semibold text-white transition-all hover:brightness-110"
            style={{ background: "linear-gradient(135deg, #6366F1 0%, #818CF8 100%)" }}
          >
            Try the live demo
          </Link>
          <Link
            href="/login"
            className="rounded-lg border px-5 py-2.5 text-[14px] font-semibold text-[#c9d3e0] transition-colors hover:text-white"
            style={{ borderColor: "rgba(255,255,255,0.12)" }}
          >
            Sign in
          </Link>
        </div>
        <p className="mt-3 text-[12px] text-[#3d4a5c]">The demo runs in your browser — no sign-in required.</p>
      </header>

      {/* Feature groups */}
      <main className="mx-auto max-w-6xl px-6 pb-16">
        {GROUPS.map((group) => (
          <section key={group.eyebrow} className="py-8">
            <Eyebrow>{group.eyebrow}</Eyebrow>
            <div className="mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {group.features.map((f) => {
                const Icon = f.icon;
                return (
                  <div
                    key={f.title}
                    className="rounded-2xl p-5 transition-colors"
                    style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    <span
                      className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl"
                      style={{ background: "rgba(129,140,248,0.15)" }}
                    >
                      <Icon size={20} style={{ color: "#818CF8" }} strokeWidth={2} />
                    </span>
                    <h3 className="mb-1.5 text-[16px] font-bold tracking-tight text-white">{f.title}</h3>
                    <p className="text-[14px] leading-relaxed text-[#8b9ab0]">{f.body}</p>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </main>

      {/* Closing CTA */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div
          className="flex flex-col items-center gap-5 rounded-3xl px-8 py-14 text-center"
          style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(129,140,248,0.06) 100%)", border: "1px solid rgba(129,140,248,0.2)" }}
        >
          <h2 className="max-w-2xl text-3xl font-black tracking-tight">See it for yourself</h2>
          <p className="max-w-xl text-[15px] leading-relaxed text-[#8b9ab0]">
            Open the interactive demo — no account, no install. Then bring your own
            Teams workspace whenever you’re ready.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/demo"
              className="rounded-lg px-5 py-2.5 text-[14px] font-semibold text-white transition-all hover:brightness-110"
              style={{ background: "linear-gradient(135deg, #6366F1 0%, #818CF8 100%)" }}
            >
              Try the live demo
            </Link>
            <Link
              href="/login"
              className="rounded-lg border px-5 py-2.5 text-[14px] font-semibold text-[#c9d3e0] transition-colors hover:text-white"
              style={{ borderColor: "rgba(255,255,255,0.12)" }}
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
