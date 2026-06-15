"use client";

import { Command, Mic, Plug } from "lucide-react";

const TIPS = [
  { icon: Command, title: "Jump anywhere", body: "Press ⌘K (Ctrl+K) to search and switch conversations." },
  { icon: Mic, title: "Drop-in voice", body: "Start an ad-hoc voice room in any channel or DM." },
  { icon: Plug, title: "Use it from your AI", body: "Connect Teamsly to Claude or Cursor: npx -y @teamsly/mcp" },
] as const;

export function HomeTips() {
  return (
    <ul className="flex flex-col gap-2.5">
      {TIPS.map((tip) => (
        <li key={tip.title} className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-[var(--surface-raised)] text-[var(--accent)]">
            <tip.icon className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-[var(--text-primary)]">{tip.title}</p>
            <p className="text-[12px] text-[var(--text-secondary)]">{tip.body}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
