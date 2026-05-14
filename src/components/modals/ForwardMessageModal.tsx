"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Hash, MessageSquare, Search, X } from "lucide-react";
import { getChatLabel } from "@/lib/utils/chat-label";
import { useWorkspaceStore } from "@/store/workspace";
import { messagePlainText, textToHtml } from "@/lib/utils/render-message";
import { cn } from "@/lib/utils";

// Destination kinds — keyed via discriminated union so the consumer can route
// the outgoing message to the right Graph endpoint (chats vs channels).
export type ForwardDestination =
  | { kind: "chat"; chatId: string; label: string }
  | { kind: "channel"; teamId: string; channelId: string; label: string; teamName: string };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // The message being forwarded. We read body + author from it directly.
  message: MSMessage | null;
  // Callback fired with the chosen destination + composed HTML body (already
  // includes the optional note prefix and the quoted-original block).
  onForward: (destination: ForwardDestination, htmlBody: string) => Promise<void> | void;
}

export function ForwardMessageModal({ open, onOpenChange, message, onForward }: Props) {
  const chats = useWorkspaceStore((s) => s.chats);
  const channels = useWorkspaceStore((s) => s.channels);
  const teams = useWorkspaceStore((s) => s.teams);
  const currentUserId = useWorkspaceStore((s) => s.currentUserId);

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ForwardDestination | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset internal state whenever the modal opens for a new message
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(null);
      setNote("");
      setSubmitting(false);
    }
  }, [open, message?.id]);

  // Build a flat list of destinations once per dependency change.
  const chatDestinations = useMemo<ForwardDestination[]>(
    () =>
      chats.map((chat) => ({
        kind: "chat" as const,
        chatId: chat.id,
        label: getChatLabel(chat, currentUserId),
      })),
    [chats, currentUserId]
  );

  const channelDestinations = useMemo<ForwardDestination[]>(() => {
    const list: ForwardDestination[] = [];
    for (const team of teams) {
      const teamChannels = channels[team.id] ?? [];
      for (const channel of teamChannels) {
        list.push({
          kind: "channel",
          teamId: team.id,
          channelId: channel.id,
          label: channel.displayName,
          teamName: team.displayName,
        });
      }
    }
    return list;
  }, [teams, channels]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredChats = useMemo(
    () =>
      normalizedQuery
        ? chatDestinations.filter((d) => d.label.toLowerCase().includes(normalizedQuery))
        : chatDestinations.slice(0, 20),
    [chatDestinations, normalizedQuery]
  );
  const filteredChannels = useMemo(
    () =>
      normalizedQuery
        ? channelDestinations.filter(
            (d) =>
              d.label.toLowerCase().includes(normalizedQuery) ||
              (d.kind === "channel" && d.teamName.toLowerCase().includes(normalizedQuery))
          )
        : channelDestinations.slice(0, 20),
    [channelDestinations, normalizedQuery]
  );

  const hasResults = filteredChats.length > 0 || filteredChannels.length > 0;
  const canSubmit = Boolean(selected) && !submitting;

  async function handleSubmit() {
    if (!canSubmit || !selected || !message) return;

    const originalAuthor = message.from?.user?.displayName ?? "Unknown";
    const originalHtml =
      message.body.contentType === "html"
        ? message.body.content
        : textToHtml(message.body.content);

    // Compose: optional user note (escaped to HTML) + quoted original block.
    // We use a left-bordered blockquote that visually echoes the MessageReferenceCard
    // treatment used elsewhere in the app for quoted replies.
    const noteHtml = note.trim() ? `<p>${textToHtml(note.trim())}</p>` : "";
    const quotedHtml = [
      `<blockquote style="border-left:3px solid #cd2553;margin:6px 0;padding:4px 0 4px 10px;color:#9aa0a6;">`,
      `<div style="font-size:12px;font-weight:600;margin-bottom:2px;">${escapeHtml(originalAuthor)}</div>`,
      `<div style="font-size:13px;">${originalHtml}</div>`,
      `</blockquote>`,
    ].join("");

    const htmlBody = `${noteHtml}${quotedHtml}`;

    try {
      setSubmitting(true);
      await onForward(selected, htmlBody);
      onOpenChange(false);
    } catch {
      // Caller is responsible for surfacing a toast; we still re-enable submit
      // so the user can retry without re-opening the modal.
      setSubmitting(false);
    }
  }

  const previewText = message
    ? messagePlainText(message.body.content, message.body.contentType).slice(0, 240)
    : "";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-[rgba(0,0,0,0.7)] backdrop-blur-[2px]" />
        <Dialog.Content
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            inputRef.current?.focus();
          }}
          className="fixed left-1/2 top-1/2 z-[70] flex max-h-[80vh] w-[560px] max-w-[94vw] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-[#3f4144] bg-[#1a1d21] text-[#d1d2d3] shadow-[0_16px_64px_rgba(0,0,0,0.6)] outline-none"
        >
          <Dialog.Title className="sr-only">Forward message</Dialog.Title>

          <header className="flex h-[49px] flex-shrink-0 items-center justify-between border-b border-[#3f4144] px-4">
            <h2 className="text-[15px] font-bold text-white">Forward message</h2>
            <Dialog.Close
              aria-label="Close"
              className="flex h-7 w-7 items-center justify-center rounded text-[#ababad] transition-colors duration-150 hover:bg-[#27292d] hover:text-white"
            >
              <X size={16} />
            </Dialog.Close>
          </header>

          {/* Search input */}
          <div className="flex items-center border-b border-[#3f4144]">
            <Search className="ml-5 h-4 w-4 flex-shrink-0 text-[#ababad]" />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search chats and channels..."
              className="h-[44px] min-w-0 flex-1 bg-transparent px-3 text-[14px] text-[#d1d2d3] outline-none placeholder:text-[#6c6f75]"
            />
          </div>

          {/* Destination list */}
          <div className="max-h-[280px] flex-1 overflow-y-auto px-3 py-3">
            {!hasResults ? (
              <div className="px-3 py-8 text-center text-[13px] text-[#6c6f75]">
                No matching chats or channels
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {filteredChats.length > 0 && (
                  <DestinationSection title="Direct messages">
                    {filteredChats.map((dest) => (
                      <DestinationRow
                        key={`chat-${(dest as { chatId: string }).chatId}`}
                        icon={<MessageSquare size={14} />}
                        title={dest.label}
                        subtitle="Direct message"
                        active={isSameDestination(selected, dest)}
                        onSelect={() => setSelected(dest)}
                      />
                    ))}
                  </DestinationSection>
                )}

                {filteredChannels.length > 0 && (
                  <DestinationSection title="Channels">
                    {filteredChannels.map((dest) =>
                      dest.kind === "channel" ? (
                        <DestinationRow
                          key={`channel-${dest.teamId}-${dest.channelId}`}
                          icon={<Hash size={14} />}
                          title={dest.label}
                          subtitle={dest.teamName}
                          active={isSameDestination(selected, dest)}
                          onSelect={() => setSelected(dest)}
                        />
                      ) : null
                    )}
                  </DestinationSection>
                )}
              </div>
            )}
          </div>

          {/* Note + quoted preview */}
          <div className="flex flex-col gap-2 border-t border-[#3f4144] px-4 py-3">
            <label className="text-[11px] font-bold uppercase tracking-wide text-[#6c6f75]">
              Add a note (optional)
            </label>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={2}
              placeholder="Write something to go with the forwarded message"
              className="w-full resize-none rounded border border-[#3f4144] bg-[#222529] px-2 py-1.5 text-[13px] text-[#d1d2d3] placeholder-[#6c6f75] outline-none focus:border-[#565856]"
            />

            {message && (
              <div className="rounded-md border-l-[3px] border-[var(--accent)] bg-[#222529] px-3 py-1.5">
                <div className="text-[12px] font-semibold text-[#d1d2d3]">
                  {message.from?.user?.displayName ?? "Unknown"}
                </div>
                {previewText && (
                  <div className="mt-0.5 line-clamp-2 whitespace-pre-wrap break-words text-[12px] text-[#ababad]">
                    {previewText}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 border-t border-[#3f4144] px-4 py-3">
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
              className={cn(
                "rounded-md bg-[var(--accent)] px-4 py-[6px] text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              )}
            >
              {submitting ? "Forwarding…" : "Forward"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function DestinationSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wide text-[#6c6f75]">
        {title}
      </h3>
      <div className="flex flex-col gap-1">{children}</div>
    </section>
  );
}

function DestinationRow({
  icon,
  title,
  subtitle,
  active,
  onSelect,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left transition-colors duration-[80ms]",
        active ? "bg-[#0F5A8F] text-white" : "text-[#d1d2d3] hover:bg-[#27292d]"
      )}
    >
      <span
        className={cn(
          "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded",
          active ? "bg-white/15 text-white" : "bg-[#2c2d30] text-[#ababad]"
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-bold">{title}</span>
        <span
          className={cn(
            "block truncate text-[12px]",
            active ? "text-white/75" : "text-[#6c6f75]"
          )}
        >
          {subtitle}
        </span>
      </span>
      {active && (
        <span className="ml-auto flex h-4 w-4 items-center justify-center rounded-full bg-white text-[#0F5A8F]">
          <svg viewBox="0 0 10 10" className="h-2 w-2" aria-hidden>
            <path d="M1 5l3 3 5-6" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
        </span>
      )}
    </button>
  );
}

function isSameDestination(
  a: ForwardDestination | null,
  b: ForwardDestination
): boolean {
  if (!a) return false;
  if (a.kind === "chat" && b.kind === "chat") return a.chatId === b.chatId;
  if (a.kind === "channel" && b.kind === "channel")
    return a.teamId === b.teamId && a.channelId === b.channelId;
  return false;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
