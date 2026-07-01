"use client";

import { ExternalLink, PlayCircle, Video, Frame, Phone, MessageSquareMore, Users } from "lucide-react";
import type { DetectedLink } from "@/lib/integrations/link-detect";

/**
 * Renders a single inline preview card for the link types
 * `detectRichLinks` recognizes. Each card is fully URL-derived — no API
 * call needed — so no loading/error state to manage. If the underlying
 * link rots, the card still opens it; we just can't promise the title is
 * fresh.
 */
export function LinkPreviewCard({ link }: { link: DetectedLink }) {
  switch (link.kind) {
    case "youtube":
      return <YouTubeCard videoId={link.videoId} url={link.url} />;
    case "loom":
      return <LoomCard videoId={link.videoId} url={link.url} />;
    case "figma":
      return <FigmaCard fileName={link.fileName} url={link.url} />;
    case "teams-meeting":
      return <TeamsMeetingCard url={link.url} />;
    case "teams-deeplink":
      return <TeamsDeepLinkCard url={link.url} action={link.action} />;
  }
}

// ─── YouTube ─────────────────────────────────────────────────────────────────

function YouTubeCard({ videoId, url }: { videoId: string; url: string }) {
  // hqdefault is the safest stable thumbnail size — maxresdefault doesn't
  // exist for every video, sddefault is unreliable for older uploads.
  const thumb = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  return (
    <CardShell url={url} accentClass="border-l-red-500">
      <div className="flex gap-3">
        <div className="relative aspect-video w-32 flex-shrink-0 overflow-hidden rounded bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={thumb} alt="" className="h-full w-full object-cover" loading="lazy" />
          <span className="absolute inset-0 flex items-center justify-center">
            <PlayCircle className="h-8 w-8 text-white drop-shadow-lg" strokeWidth={1.5} />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold uppercase tracking-wide text-red-400">YouTube</div>
          <p className="mt-0.5 truncate text-[13px] font-semibold text-[var(--text-primary)]">{url.replace(/^https?:\/\//, "")}</p>
          <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">Click to play</p>
        </div>
      </div>
    </CardShell>
  );
}

// ─── Loom ────────────────────────────────────────────────────────────────────

function LoomCard({ videoId, url }: { videoId: string; url: string }) {
  return (
    <CardShell url={url} accentClass="border-l-[#625df5]">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-[#625df5]/15 text-[#a5a1ff]">
          <Video className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold uppercase tracking-wide text-[#a5a1ff]">Loom</div>
          <p className="mt-0.5 truncate text-[13px] font-semibold text-[var(--text-primary)]">
            Loom recording · <span className="font-mono text-[12px]">{videoId.slice(0, 10)}…</span>
          </p>
          <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">Click to watch</p>
        </div>
      </div>
    </CardShell>
  );
}

// ─── Figma ───────────────────────────────────────────────────────────────────

function FigmaCard({ fileName, url }: { fileName: string; url: string }) {
  return (
    <CardShell url={url} accentClass="border-l-[#F24E1E]">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-[#F24E1E]/15 text-[#F24E1E]">
          <Frame className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold uppercase tracking-wide text-[#F24E1E]">Figma</div>
          <p className="mt-0.5 truncate text-[13px] font-semibold text-[var(--text-primary)]" title={fileName}>
            {fileName || "Figma file"}
          </p>
          <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">Click to open in Figma</p>
        </div>
      </div>
    </CardShell>
  );
}

// ─── Microsoft Teams meeting ─────────────────────────────────────────────────

function TeamsMeetingCard({ url }: { url: string }) {
  // The msteams: scheme launches the native Teams desktop/mobile client
  // when installed; falls back to the web app via the https URL.
  const nativeUrl = url.replace(/^https:\/\/teams\.microsoft\.com\//, "msteams:/");
  return (
    <CardShell url={url} accentClass="border-l-[#5059C9]">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-[#5059C9]/15 text-[#9BA2E4]">
          <Users className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold uppercase tracking-wide text-[#9BA2E4]">Microsoft Teams meeting</div>
          <p className="mt-0.5 truncate text-[13px] font-semibold text-[var(--text-primary)]">Join the call in Teams</p>
          <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">Opens the native Teams client</p>
        </div>
        <a
          href={nativeUrl}
          onClick={(e) => e.stopPropagation()}
          className="flex-shrink-0 inline-flex items-center gap-1 rounded bg-[#5059C9] px-2.5 py-1 text-[12px] font-semibold text-white transition-colors hover:bg-[#3f48a8]"
        >
          Join
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </CardShell>
  );
}

// ─── msteams: deep link (call / chat / meet) ────────────────────────────────

function TeamsDeepLinkCard({ url, action }: { url: string; action: "call" | "chat" | "meet" | "other" }) {
  const meta = {
    call: { label: "Microsoft Teams call",       cta: "Call",  Icon: Phone },
    chat: { label: "Microsoft Teams chat",       cta: "Chat",  Icon: MessageSquareMore },
    meet: { label: "Microsoft Teams meeting",    cta: "Join",  Icon: Users },
    other: { label: "Microsoft Teams deep link", cta: "Open",  Icon: ExternalLink },
  }[action];
  const Icon = meta.Icon;
  return (
    <CardShell url={url} accentClass="border-l-[#5059C9]">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-[#5059C9]/15 text-[#9BA2E4]">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold uppercase tracking-wide text-[#9BA2E4]">{meta.label}</div>
          <p className="mt-0.5 truncate text-[13px] font-semibold text-[var(--text-primary)]">Launch in Teams</p>
          <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">Opens the native Teams client</p>
        </div>
        <a
          href={url}
          onClick={(e) => e.stopPropagation()}
          className="flex-shrink-0 inline-flex items-center gap-1 rounded bg-[#5059C9] px-2.5 py-1 text-[12px] font-semibold text-white transition-colors hover:bg-[#3f48a8]"
        >
          {meta.cta}
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </CardShell>
  );
}

// ─── Shared card chrome ──────────────────────────────────────────────────────

function CardShell({
  url,
  accentClass,
  children,
}: {
  url: string;
  accentClass: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`mt-2 block max-w-[480px] rounded-md border border-l-4 border-[var(--border)] bg-[var(--surface)] p-3 no-underline transition-colors hover:bg-[var(--surface-hover)] ${accentClass}`}
    >
      {children}
    </a>
  );
}
