import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { Star, Check } from "lucide-react";

export const REPO = "https://github.com/mayurrawte/teamsly";
export const RELEASES = `${REPO}/releases/latest`;

export function MarketingNav({ stars }: { stars: number | null }) {
  return (
    <nav className="sticky top-0 z-50 border-b border-white/5 bg-[#0d1117]/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo size={26} className="text-white" />
          <span className="text-[15px] font-bold tracking-tight">
            <span style={{ color: "#818CF8" }}>Teams</span>
            <span className="text-white">ly</span>
          </span>
        </Link>
        <div className="hidden items-center gap-7 md:flex">
          <Link href="/features" className="text-[13px] text-[#8b9ab0] transition-colors hover:text-white">Features</Link>
          <Link href="/#mcp" className="text-[13px] text-[#8b9ab0] transition-colors hover:text-white">MCP</Link>
          <Link href="/#self-host" className="text-[13px] text-[#8b9ab0] transition-colors hover:text-white">Self-host</Link>
          <Link href="/#faq" className="text-[13px] text-[#8b9ab0] transition-colors hover:text-white">FAQ</Link>
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
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t px-6 py-8" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Logo size={20} className="text-white" />
          <span className="text-[13px] text-[#3d4a5c]">Teamsly · AGPL-3.0 · Not affiliated with Microsoft</span>
        </div>
        <div className="flex flex-wrap items-center gap-6 text-[12px] text-[#3d4a5c]">
          <Link href="/features" className="transition-colors hover:text-white">Features</Link>
          <a href={REPO} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-white">GitHub</a>
          <a href={RELEASES} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-white">Releases</a>
          <a href={`${REPO}/issues`} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-white">Issues</a>
          <Link href="/demo" className="transition-colors hover:text-white">Demo</Link>
          <Link href="/privacy" className="transition-colors hover:text-white">Privacy</Link>
          <Link href="/terms" className="transition-colors hover:text-white">Terms</Link>
        </div>
      </div>
    </footer>
  );
}

export function StarButton({ stars }: { stars: number | null }) {
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

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-4 inline-block rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-widest" style={{ background: "rgba(129,140,248,0.15)", color: "#818CF8" }}>
      {children}
    </span>
  );
}

export function BrowserFrame({ children, className = "" }: { children: React.ReactNode; className?: string }) {
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

export function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <pre className="overflow-x-auto rounded-xl p-4 font-mono text-[12px] leading-loose text-[#8b9ab0]" style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.08)" }}>
      {children}
    </pre>
  );
}

export function FeatureRow({
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
