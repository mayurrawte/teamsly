import type { Metadata } from "next";
import Link from "next/link";
import { Cloud, Server, MonitorDown, Check, Minus } from "lucide-react";
import {
  MarketingNav,
  MarketingFooter,
  Eyebrow,
  REPO,
  RELEASES,
} from "@/components/marketing/primitives";

export const metadata: Metadata = {
  title: "Hosted vs self-hosted vs desktop — Teamsly",
  description:
    "Three ways to run Teamsly: the zero-setup hosted app at teamsly.app (installable as a PWA), self-hosted on your own infrastructure with your Azure app, or the local-first desktop app for macOS, Windows and Linux. Compare setup, data, real-time, AI and more.",
};

type Cell = string | boolean;
type Row = { label: string; hosted: Cell; self: Cell; desktop: Cell };

const EDITIONS = [
  {
    key: "hosted",
    icon: Cloud,
    name: "Hosted",
    tagline: "teamsly.app",
    blurb: "Sign in with Microsoft and you're in. Nothing to deploy.",
    cta: { href: "/login", label: "Sign in", primary: true },
  },
  {
    key: "self",
    icon: Server,
    name: "Self-hosted",
    tagline: "your infrastructure",
    blurb: "Deploy it yourself with your own Azure app and keys. Full control of the data boundary.",
    cta: { href: "/#self-host", label: "Self-host guide", primary: false },
  },
  {
    key: "desktop",
    icon: MonitorDown,
    name: "Desktop app",
    tagline: "macOS · Windows · Linux",
    blurb: "A local-first native app that runs its own server on your machine.",
    cta: { href: RELEASES, label: "Download", primary: false, external: true },
  },
] as const;

const ROWS: Row[] = [
  { label: "Setup", hosted: "None — just sign in", self: "Deploy + your Azure app", desktop: "Download & install" },
  { label: "Runs on", hosted: "Our cloud (Vercel)", self: "Your infrastructure", desktop: "Your machine (local-first)" },
  { label: "Your data", hosted: "Live from Microsoft Graph — nothing stored", self: "Your infra + Microsoft Graph", desktop: "Local-first + Microsoft Graph" },
  { label: "Sign-in", hosted: "Microsoft account", self: "Microsoft (your Azure app)", desktop: "Microsoft (built-in)" },
  { label: "Install as an app", hosted: "Installable PWA", self: "PWA on your domain", desktop: "Native installer" },
  { label: "Real-time messages", hosted: true, self: "With webhooks configured", desktop: "Fast poll (webhooks can't reach a local server)" },
  { label: "AI catch-up & summaries", hosted: "Included (fair-use quota)", self: "Bring your own OpenAI key", desktop: "Bring your own OpenAI key" },
  { label: "Voice rooms", hosted: true, self: "Your LiveKit keys", desktop: "Your LiveKit keys" },
  { label: "MCP server", hosted: true, self: true, desktop: true },
  { label: "Updates", hosted: "Automatic", self: "You redeploy", desktop: "Auto-update / re-download" },
  { label: "Cost", hosted: "Free", self: "Your hosting costs", desktop: "Free" },
  { label: "Best for", hosted: "Trying instantly · individuals & small teams", self: "Compliance & full control", desktop: "A native daily driver" },
];

function CellValue({ value }: { value: Cell }) {
  if (value === true) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[#c9d3e0]">
        <Check size={15} style={{ color: "#818CF8" }} strokeWidth={2.4} />
        Yes
      </span>
    );
  }
  if (value === false) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[#5b6675]">
        <Minus size={15} strokeWidth={2} />
        No
      </span>
    );
  }
  return <span className="text-[#c9d3e0]">{value}</span>;
}

export default function ComparePage() {
  return (
    <div className="min-h-screen bg-[#0d1117] text-white">
      <MarketingNav stars={null} />

      {/* Hero */}
      <header className="mx-auto max-w-6xl px-6 pb-10 pt-16 text-center lg:pt-24">
        <Eyebrow>Compare</Eyebrow>
        <h1 className="mx-auto mb-5 max-w-3xl text-4xl font-black leading-[1.08] tracking-tight sm:text-5xl">
          Hosted, self-hosted, or desktop
        </h1>
        <p className="mx-auto mb-8 max-w-2xl text-[16px] leading-relaxed text-[#8b9ab0]">
          Same Teamsly, three ways to run it. Try it instantly in the cloud, run
          it on your own infrastructure, or install the local-first desktop app.
          It&rsquo;s the same open-source code either way.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/login"
            className="rounded-lg px-5 py-2.5 text-[14px] font-semibold text-white transition-all hover:brightness-110"
            style={{ background: "linear-gradient(135deg, #6366F1 0%, #818CF8 100%)" }}
          >
            Use the hosted app
          </Link>
          <a
            href={RELEASES}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border px-5 py-2.5 text-[14px] font-semibold text-[#c9d3e0] transition-colors hover:text-white"
            style={{ borderColor: "rgba(255,255,255,0.12)" }}
          >
            Download the app
          </a>
        </div>
      </header>

      {/* Edition cards */}
      <section className="mx-auto max-w-6xl px-6 pb-4">
        <div className="grid gap-4 sm:grid-cols-3">
          {EDITIONS.map(({ key, icon: Icon, name, tagline, blurb, cta }) => (
            <div
              key={key}
              className="flex flex-col rounded-2xl p-6"
              style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <div
                className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg"
                style={{ background: "rgba(99,102,241,0.18)" }}
              >
                <Icon size={19} style={{ color: "#818CF8" }} strokeWidth={1.9} />
              </div>
              <h2 className="text-[17px] font-bold text-white">{name}</h2>
              <p className="mb-3 text-[12px] font-medium uppercase tracking-wider" style={{ color: "#818CF8" }}>
                {tagline}
              </p>
              <p className="mb-5 flex-1 text-[13px] leading-relaxed text-[#8b9ab0]">{blurb}</p>
              {"external" in cta && cta.external ? (
                <a
                  href={cta.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border px-4 py-2 text-center text-[13px] font-semibold text-[#c9d3e0] transition-colors hover:text-white"
                  style={{ borderColor: "rgba(255,255,255,0.12)" }}
                >
                  {cta.label}
                </a>
              ) : (
                <Link
                  href={cta.href}
                  className={
                    cta.primary
                      ? "rounded-lg px-4 py-2 text-center text-[13px] font-semibold text-white transition-all hover:brightness-110"
                      : "rounded-lg border px-4 py-2 text-center text-[13px] font-semibold text-[#c9d3e0] transition-colors hover:text-white"
                  }
                  style={
                    cta.primary
                      ? { background: "linear-gradient(135deg, #6366F1 0%, #818CF8 100%)" }
                      : { borderColor: "rgba(255,255,255,0.12)" }
                  }
                >
                  {cta.label}
                </Link>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Comparison table */}
      <section className="mx-auto max-w-6xl px-6 pb-24 pt-8">
        <div className="overflow-x-auto rounded-2xl" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
          <table className="w-full min-w-[720px] border-collapse text-left text-[13px]">
            <thead>
              <tr style={{ background: "#111827" }}>
                <th className="px-5 py-4 font-semibold text-[#8b9ab0]"> </th>
                {EDITIONS.map(({ key, name }) => (
                  <th key={key} className="px-5 py-4 font-bold text-white">
                    {name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row, i) => (
                <tr
                  key={row.label}
                  style={{
                    borderTop: "1px solid rgba(255,255,255,0.06)",
                    background: i % 2 ? "rgba(255,255,255,0.015)" : "transparent",
                  }}
                >
                  <th className="px-5 py-4 text-left align-top font-semibold text-[#e2e8f0]">{row.label}</th>
                  <td className="px-5 py-4 align-top"><CellValue value={row.hosted} /></td>
                  <td className="px-5 py-4 align-top"><CellValue value={row.self} /></td>
                  <td className="px-5 py-4 align-top"><CellValue value={row.desktop} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mx-auto mt-6 max-w-2xl text-center text-[13px] leading-relaxed text-[#6c7686]">
          Not sure? Start with the <Link href="/login" className="text-[#818CF8] hover:text-white">hosted app</Link> — it&rsquo;s
          the fastest way to try Teamsly, and you can install it as a PWA. Move to
          self-hosting or the desktop app whenever you want; it&rsquo;s the same{" "}
          <a href={REPO} target="_blank" rel="noopener noreferrer" className="text-[#818CF8] hover:text-white">open-source code</a>.
        </p>
      </section>

      <MarketingFooter />
    </div>
  );
}
