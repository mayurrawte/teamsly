"use client";

import { useState, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Bug, Sparkles } from "lucide-react";
import { useToastStore } from "@/store/toasts";
import { cn } from "@/lib/utils";

type FeedbackType = "bug" | "feature";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Build a human-readable environment string shown in the form and submitted
// as the "env" field. Reads the build-time version constant injected by
// next.config.ts so there's no runtime package.json parse.
function buildEnvString(): string {
  const version = process.env.NEXT_PUBLIC_APP_VERSION ?? "web";
  const platform =
    typeof navigator !== "undefined" ? navigator.platform : "unknown";

  // Electron sets window.electron on the preload bridge. Fall back to "web"
  // when running in a plain browser context.
  const runtime =
    typeof window !== "undefined" &&
    (window as { electron?: { isElectron?: () => boolean } }).electron?.isElectron?.()
      ? "desktop"
      : "web";

  return `Teamsly ${version} · ${platform} · ${runtime}`;
}

// Open the GitHub new-issue URL pre-filled with the user's input.
// GitHub's issue-form URL parameter format for structured forms is:
//   ?template=<file>&title=<value>&field-<field-id>=<value>
// The `title=` param maps to the issue title bar (separate from body fields).
// Each body field is addressed as `field-<id>` where <id> matches the YAML.
function openGitHubIssue(type: FeedbackType, fields: Record<string, string>) {
  const base = "https://github.com/mayurrawte/teamsly/issues/new";
  const template =
    type === "bug" ? "bug_report.yml" : "feature_request.yml";

  const params = new URLSearchParams({ template });

  // Map local field names to their YAML `id` values.
  for (const [key, value] of Object.entries(fields)) {
    if (value.trim()) {
      params.set(`field-${key}`, value.trim());
    }
  }

  const url = `${base}?${params.toString()}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

export function FeedbackModal({ open, onOpenChange }: Props) {
  const showToast = useToastStore((s) => s.showToast);

  const [type, setType] = useState<FeedbackType>("bug");

  // Bug fields
  const [bugTitle, setBugTitle] = useState("");
  const [bugWhat, setBugWhat] = useState("");
  const [bugExpected, setBugExpected] = useState("");
  const [bugSteps, setBugSteps] = useState("");

  // Feature fields
  const [featTitle, setFeatTitle] = useState("");
  const [featProblem, setFeatProblem] = useState("");
  const [featProposed, setFeatProposed] = useState("");

  const [envString, setEnvString] = useState("");

  // Compute env string once on the client (navigator is not available on server)
  useEffect(() => {
    setEnvString(buildEnvString());
  }, []);

  // Reset all fields whenever the modal opens so re-opening starts fresh
  useEffect(() => {
    if (open) {
      setType("bug");
      setBugTitle("");
      setBugWhat("");
      setBugExpected("");
      setBugSteps("");
      setFeatTitle("");
      setFeatProblem("");
      setFeatProposed("");
    }
  }, [open]);

  const canSubmitBug = bugTitle.trim().length > 0 && bugWhat.trim().length > 0;
  const canSubmitFeat = featTitle.trim().length > 0 && featProblem.trim().length > 0;
  const canSubmit = type === "bug" ? canSubmitBug : canSubmitFeat;

  function handleSubmit() {
    if (!canSubmit) return;

    if (type === "bug") {
      openGitHubIssue("bug", {
        title: bugTitle,
        "what-happened": bugWhat,
        expected: bugExpected,
        steps: bugSteps,
        env: envString,
      });
    } else {
      openGitHubIssue("feature", {
        title: featTitle,
        problem: featProblem,
        proposed: featProposed,
      });
    }

    onOpenChange(false);
    showToast({ title: "Opening GitHub… complete your submission there" });
  }

  const inputClass =
    "w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none transition-colors duration-150 placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]";
  const textareaClass = `${inputClass} resize-none`;
  const labelClass = "text-[12px] font-semibold text-[var(--text-secondary)]";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-[70] w-[500px] max-w-[94vw] max-h-[90vh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto overflow-x-hidden rounded-xl border border-[var(--border)] bg-[var(--modal-bg)] text-[var(--text-primary)] shadow-[0_16px_64px_rgba(0,0,0,0.6)] focus:outline-none"
          aria-describedby={undefined}
        >
          <Dialog.Title className="sr-only">Send feedback</Dialog.Title>

          <header className="flex h-[49px] items-center justify-between border-b border-[var(--border)] px-5">
            <h2 className="text-[15px] font-bold text-white">Send feedback</h2>
            <Dialog.Close
              aria-label="Close"
              className="flex h-7 w-7 items-center justify-center rounded text-[var(--text-secondary)] hover:bg-[var(--surface-raised)] hover:text-white focus-ring"
            >
              <X size={16} />
            </Dialog.Close>
          </header>

          <div className="flex flex-col gap-4 px-5 py-5">
            {/* Type picker */}
            <div className="grid grid-cols-2 gap-2">
              <TypeButton
                active={type === "bug"}
                icon={<Bug size={16} />}
                label="Bug"
                onClick={() => setType("bug")}
              />
              <TypeButton
                active={type === "feature"}
                icon={<Sparkles size={16} />}
                label="Feature"
                onClick={() => setType("feature")}
              />
            </div>

            {/* Bug fields */}
            {type === "bug" && (
              <>
                <div className="flex flex-col gap-1">
                  <label className={labelClass}>
                    One-line summary <Required />
                  </label>
                  <input
                    value={bugTitle}
                    onChange={(e) => setBugTitle(e.target.value)}
                    placeholder="e.g. Sidebar crashes when switching teams"
                    className={inputClass}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className={labelClass}>
                    What happened? <Required />
                  </label>
                  <textarea
                    value={bugWhat}
                    onChange={(e) => setBugWhat(e.target.value)}
                    rows={3}
                    placeholder="Describe what went wrong"
                    className={textareaClass}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className={labelClass}>What did you expect?</label>
                  <textarea
                    value={bugExpected}
                    onChange={(e) => setBugExpected(e.target.value)}
                    rows={2}
                    placeholder="What should have happened instead?"
                    className={textareaClass}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className={labelClass}>Steps to reproduce</label>
                  <textarea
                    value={bugSteps}
                    onChange={(e) => setBugSteps(e.target.value)}
                    rows={3}
                    placeholder={"1. Open sidebar\n2. Click a team\n3. …"}
                    className={textareaClass}
                  />
                </div>
              </>
            )}

            {/* Feature fields */}
            {type === "feature" && (
              <>
                <div className="flex flex-col gap-1">
                  <label className={labelClass}>
                    One-line summary <Required />
                  </label>
                  <input
                    value={featTitle}
                    onChange={(e) => setFeatTitle(e.target.value)}
                    placeholder="e.g. Keyboard shortcut to jump to DMs"
                    className={inputClass}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className={labelClass}>
                    What problem are you trying to solve? <Required />
                  </label>
                  <textarea
                    value={featProblem}
                    onChange={(e) => setFeatProblem(e.target.value)}
                    rows={3}
                    placeholder="Describe the pain point or workflow gap"
                    className={textareaClass}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className={labelClass}>How might it work?</label>
                  <textarea
                    value={featProposed}
                    onChange={(e) => setFeatProposed(e.target.value)}
                    rows={2}
                    placeholder="Optional — sketch how this could look or behave"
                    className={textareaClass}
                  />
                </div>
              </>
            )}

            {/* Environment — auto-populated, read-only */}
            <div className="flex flex-col gap-1">
              <label className={labelClass}>Environment (auto-detected)</label>
              <p className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-mono text-[12px] text-[var(--text-muted)] select-all">
                {envString || "detecting…"}
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-1">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="rounded-md border border-[var(--border)] px-3 py-[6px] text-[13px] font-semibold text-[var(--text-secondary)] transition-colors hover:border-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  Cancel
                </button>
              </Dialog.Close>

              <button
                type="button"
                disabled={!canSubmit}
                onClick={handleSubmit}
                className="rounded-md bg-[var(--accent)] px-4 py-[6px] text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Open issue on GitHub
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function TypeButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-[13px] font-semibold transition-colors duration-100",
        active
          ? "border-[var(--accent)] bg-[var(--accent)]/10 text-white"
          : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:border-[var(--text-muted)] hover:text-[var(--text-primary)]"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function Required() {
  return <span className="text-[#cd2553]" aria-hidden>*</span>;
}
