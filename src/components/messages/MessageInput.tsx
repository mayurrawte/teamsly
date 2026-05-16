"use client";

import { useRef, useState, KeyboardEvent, useEffect, useCallback, ClipboardEvent, DragEvent } from "react";
import TextareaAutosize from "react-textarea-autosize";
import {
  Send,
  Paperclip,
  Smile,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Link,
  ListOrdered,
  List,
  Code,
  Code2,
  X,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { markdownToHtml } from "@/lib/utils/markdown-to-html";
import { Avatar } from "@/components/ui/Avatar";
import { useToastStore } from "@/store/toasts";
import { useDraftsStore } from "@/store/drafts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MentionCandidate {
  id: string;
  displayName: string;
  email?: string;
}

/**
 * Lightweight mention descriptor passed alongside the HTML body when
 * the user sends. `id` is the AAD user id, or the sentinel `__everyone__`
 * for `@everyone`. The send handler turns this into a Graph `mentions[]`
 * array on the server (see `/api/chats/[chatId]/messages` and the channel
 * route) — the client never has to know the Graph shape.
 */
export interface PendingMention {
  id: string;
  name: string;
}

export interface SendOptions {
  mentions?: PendingMention[];
}

interface Props {
  placeholder: string;
  onSend: (content: string, options?: SendOptions) => Promise<void>;
  /** Called instead of onSend when a file is pending. Only rendered when provided. */
  onAttachAndSend?: (content: string, file: File) => Promise<void>;
  /** Set to true by the parent while the upload+send is in flight */
  uploading?: boolean;
  /** Members to suggest for @mention autocomplete */
  mentionCandidates?: MentionCandidate[];
  /**
   * Force the `@everyone` entry to appear at the top of the mention
   * popover even when no per-member candidates are passed. Used by
   * channels where we don't pre-load the roster — the autocomplete then
   * only has `@everyone` to offer until the user types past it.
   */
  allowEveryone?: boolean;
  /**
   * Stable key used to scope the composer's draft persistence. When
   * provided, `MessageInput` seeds `value` from the drafts store on mount
   * and writes back on every change (debounced 300 ms). When `undefined`
   * (e.g. thread reply composer), nothing is persisted.
   */
  contextId?: string;
}

// Sentinel mention id for `@everyone`. The chat/channel API routes turn
// this into the Graph `conversation` mention shape; everything else is
// treated as a real AAD user.
const EVERYONE_MENTION_ID = "__everyone__";

// ---------------------------------------------------------------------------
// Toolbar configuration
// ---------------------------------------------------------------------------

type FormatAction =
  | "bold"
  | "italic"
  | "underline"
  | "strikethrough"
  | "link"
  | "orderedList"
  | "unorderedList"
  | "code"
  | "codeBlock";

interface ToolbarButton {
  action: FormatAction;
  label: string;
  icon: React.ReactNode;
  shortcut?: string;
}

// ---------------------------------------------------------------------------
// @mention trigger detection helpers
// ---------------------------------------------------------------------------

/** Returns { query, atIndex } when cursor is inside an @-word, else null. */
function detectMentionTrigger(
  text: string,
  cursor: number
): { query: string; atIndex: number } | null {
  // Walk backwards from cursor to find the start of the current word
  const before = text.slice(0, cursor);
  // The trigger is active when the segment from the last whitespace/start to cursor starts with @
  const match = before.match(/(?:^|[\s\n])(@\S{0,50})$/);
  if (!match) return null;
  const segment = match[1]; // e.g. "@ma"
  const atIndex = before.lastIndexOf(segment);
  const query = segment.slice(1); // strip leading @
  return { query, atIndex };
}

// ---------------------------------------------------------------------------
// Extension for MIME type → file extension
// ---------------------------------------------------------------------------

function mimeToExt(mimeType: string): string {
  const map: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
    "image/bmp": "bmp",
    "image/tiff": "tiff",
  };
  return map[mimeType] ?? "png";
}

// ---------------------------------------------------------------------------
// Client-side file size cap — must match the server route's MAX_BYTES in
// src/app/api/files/upload/route.ts. The route uses the chunked Graph
// createUploadSession flow for anything >4 MiB and rejects beyond 250 MiB.
// ---------------------------------------------------------------------------

const MAX_FILE_BYTES = 250 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function MessageInput({
  placeholder,
  onSend,
  onAttachAndSend,
  uploading,
  mentionCandidates,
  allowEveryone,
  contextId,
}: Props) {
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  // Mentions the user has accepted via the autocomplete (or `@everyone`).
  // Reset on send. Kept parallel to the plain `@Display Name` text in the
  // textarea so the parent can build a structured Graph `mentions[]`.
  const [pendingMentions, setPendingMentions] = useState<PendingMention[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const showToast = useToastStore((state) => state.showToast);
  const setDraft = useDraftsStore((s) => s.setDraft);
  const clearDraftInStore = useDraftsStore((s) => s.clearDraft);

  // ---------------------------------------------------------------------------
  // Draft seed + debounced write-back
  // ---------------------------------------------------------------------------
  // Seed `value` from the drafts store when the context changes (incl. mount).
  // We read the store imperatively so this effect doesn't re-run on every
  // draft mutation. When `contextId` is undefined (thread reply composer),
  // skip persistence entirely.
  useEffect(() => {
    if (!contextId) {
      setValue("");
      return;
    }
    const existing = useDraftsStore.getState().drafts[contextId] ?? "";
    setValue(existing);
    // We intentionally reset on every contextId change so switching chats
    // doesn't leak the previous chat's typing into the new one.
  }, [contextId]);

  // Debounced write-back: 300 ms after the user stops typing, persist the
  // current `value`. Cancelled on the next keystroke. Fire-and-forget IDB
  // write — store + IDB stay in sync without blocking the UI.
  useEffect(() => {
    if (!contextId) return;
    const handle = window.setTimeout(() => {
      setDraft(contextId, value);
    }, 300);
    return () => window.clearTimeout(handle);
  }, [value, contextId, setDraft]);

  // ---------------------------------------------------------------------------
  // @mention state
  // ---------------------------------------------------------------------------
  const [mentionAnchor, setMentionAnchor] = useState<{ query: string; atIndex: number } | null>(null);
  const [mentionSelectedIdx, setMentionSelectedIdx] = useState(0);
  const mentionPopoverRef = useRef<HTMLDivElement>(null);

  // Treat `allowEveryone` as enough on its own to enable the popover —
  // channels currently don't pre-load the roster so `mentionCandidates`
  // is empty, but we still want `@everyone` to surface there.
  const hasMentionCandidates =
    Boolean(mentionCandidates && mentionCandidates.length > 0) ||
    Boolean(allowEveryone);

  // Group context: expose `@everyone` at the top of the suggestion list.
  // Trigger when there's more than one candidate (group chats) OR when the
  // parent explicitly opts in via `allowEveryone` (channels).
  const showEveryone =
    Boolean(allowEveryone) || (mentionCandidates?.length ?? 0) > 1;

  const everyoneCandidate: MentionCandidate = {
    id: EVERYONE_MENTION_ID,
    displayName: "everyone",
  };

  const filteredCandidates = mentionAnchor && hasMentionCandidates
    ? (() => {
        const q = mentionAnchor.query.toLowerCase();
        const memberMatches = (mentionCandidates ?? [])
          .filter((c) => {
            if (!q) return true;
            return (
              c.displayName.toLowerCase().includes(q) ||
              (c.email && c.email.toLowerCase().startsWith(q))
            );
          })
          .slice(0, 6);
        // Show @everyone first when it matches the query (or no query yet).
        const includeEveryone =
          showEveryone && (!q || "everyone".startsWith(q));
        return includeEveryone
          ? [everyoneCandidate, ...memberMatches].slice(0, 7)
          : memberMatches;
      })()
    : [];

  const mentionOpen = mentionAnchor !== null && filteredCandidates.length > 0;

  const filteredCount = filteredCandidates.length;

  // Keep selected index in bounds when filtered list changes
  useEffect(() => {
    if (mentionOpen) {
      setMentionSelectedIdx((prev) => Math.min(prev, filteredCount - 1));
    }
  }, [filteredCount, mentionOpen]);

  // ---------------------------------------------------------------------------
  // Drag-drop state
  // ---------------------------------------------------------------------------
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  // Counter tracks nested enter/leave events on child elements
  const dragCounterRef = useRef(0);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const sendButtonRef = useRef<HTMLButtonElement>(null);

  function triggerRipple() {
    const btn = sendButtonRef.current;
    if (!btn) return;
    const ripple = document.createElement("span");
    ripple.style.cssText = `
      position: absolute;
      inset: 0;
      border-radius: 50%;
      background: rgba(255,255,255,0.35);
      transform: scale(0);
      animation: send-ripple 400ms ease-out forwards;
      pointer-events: none;
    `;
    btn.appendChild(ripple);
    ripple.addEventListener("animationend", () => ripple.remove());
  }

  // ---------------------------------------------------------------------------
  // Mention trigger: re-evaluate on value / cursor change
  // ---------------------------------------------------------------------------
  const updateMentionTrigger = useCallback(
    (text: string, cursorPos: number) => {
      if (!hasMentionCandidates) {
        setMentionAnchor(null);
        return;
      }
      const result = detectMentionTrigger(text, cursorPos);
      if (result) {
        setMentionAnchor(result);
        setMentionSelectedIdx(0);
      } else {
        setMentionAnchor(null);
      }
    },
    [hasMentionCandidates]
  );

  const isBusy = sending || Boolean(uploading);

  async function submit() {
    triggerRipple();
    const trimmed = value.trim();
    // Allow send when there's a pending file even with no text
    if ((!trimmed && !pendingFile) || isBusy) return;

    if (pendingFile && onAttachAndSend) {
      // File send path: delegate entirely to parent
      const fileToSend = pendingFile;
      setSending(true);
      setValue("");
      setPendingFile(null);
      // Drop the persisted draft optimistically; if the send fails we
      // re-seed `value` below and the debounced write-back will rewrite it.
      if (contextId) clearDraftInStore(contextId);
      try {
        await onAttachAndSend(markdownToHtml(trimmed), fileToSend);
        // Attachment path doesn't carry mentions in the current flow,
        // but reset anyway in case we extend it.
        setPendingMentions([]);
      } catch {
        setValue(trimmed);
        setPendingFile(fileToSend);
      } finally {
        setSending(false);
      }
      return;
    }

    if (!trimmed) return;
    setSending(true);
    setValue("");
    if (contextId) clearDraftInStore(contextId);
    // Snapshot mentions for this send, narrowed to names that still appear
    // in the trimmed body — the user may have typed `@Alex` then deleted it.
    const mentionsForSend = pendingMentions.filter((m) => {
      if (m.id === EVERYONE_MENTION_ID) {
        return /(^|\s)@everyone(\s|$)/.test(trimmed);
      }
      return trimmed.includes(`@${m.name}`);
    });
    try {
      // Convert markdown-subset to HTML before sending so the Graph API
      // renders formatting correctly (contentType: "html" in graph/client.ts).
      await onSend(
        markdownToHtml(trimmed),
        mentionsForSend.length > 0 ? { mentions: mentionsForSend } : undefined
      );
      setPendingMentions([]);
    } catch {
      setValue(trimmed);
    } finally {
      setSending(false);
    }
  }

  // ---------------------------------------------------------------------------
  // @mention insertion
  // ---------------------------------------------------------------------------

  function insertMention(candidate: MentionCandidate) {
    const ta = textareaRef.current;
    if (!ta || !mentionAnchor) return;

    const cursor = ta.selectionStart ?? value.length;
    const before = value.slice(0, mentionAnchor.atIndex);
    const after = value.slice(cursor);

    // Insert `@DisplayName ` so the textarea still reads naturally for the
    // user. Parallel to this, we accumulate `pendingMentions` so the parent
    // can build the Graph `mentions[]` array on send — that's what gives
    // real Teams clients a notification ping instead of a colored pill.
    const insertion = `@${candidate.displayName} `;
    const newValue = before + insertion + after;
    const newCursor = mentionAnchor.atIndex + insertion.length;

    setValue(newValue);
    setMentionAnchor(null);
    setPendingMentions((prev) => {
      // Avoid duplicate entries for the same user across multiple inserts.
      if (prev.some((m) => m.id === candidate.id)) return prev;
      return [...prev, { id: candidate.id, name: candidate.displayName }];
    });

    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(newCursor, newCursor);
    });
  }

  // ---------------------------------------------------------------------------
  // Key handler
  // ---------------------------------------------------------------------------

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // When mention popover is open, intercept navigation keys
    if (mentionOpen) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionSelectedIdx((prev) => (prev + 1) % filteredCandidates.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionSelectedIdx((prev) => (prev - 1 + filteredCandidates.length) % filteredCandidates.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(filteredCandidates[mentionSelectedIdx]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMentionAnchor(null);
        return;
      }
    }

    // Submit on Enter (without Shift)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
      return;
    }

    // Keyboard shortcuts
    const isMod = e.metaKey || e.ctrlKey;
    if (isMod) {
      switch (e.key.toLowerCase()) {
        case "b":
          e.preventDefault();
          applyFormat("bold");
          break;
        case "i":
          e.preventDefault();
          applyFormat("italic");
          break;
        case "k":
          e.preventDefault();
          applyFormat("link");
          break;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Paste handler (images / files from clipboard)
  // ---------------------------------------------------------------------------

  function onPaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    if (!onAttachAndSend) return; // Only when upload is supported

    const items = Array.from(e.clipboardData.items);
    const fileItems = items.filter((item) => item.kind === "file");

    if (fileItems.length === 0) return; // No files — let default text paste run

    // Warn if multiple images pasted
    if (fileItems.length > 1) {
      showToast({ title: "Paste one image at a time", tone: "info" });
    }

    e.preventDefault();

    // Prefer an image item; fall back to the first file of any type
    const imageItem = fileItems.find((item) => item.type.startsWith("image/"));
    const chosen = imageItem ?? fileItems[0];
    const file = chosen.getAsFile();
    if (!file) return;

    // If the pasted image has no name, generate a friendly one
    const finalFile =
      file.name && file.name !== "image.png"
        ? file
        : new File([file], `pasted-image-${Date.now()}.${mimeToExt(chosen.type)}`, {
            type: chosen.type,
          });

    if (finalFile.size > MAX_FILE_BYTES) {
      showToast({ title: "File is too large (250 MB max)", tone: "error" });
      return;
    }

    setPendingFile(finalFile);
  }

  // ---------------------------------------------------------------------------
  // Drag-drop handlers (file onto composer)
  // ---------------------------------------------------------------------------

  function onDragEnter(e: DragEvent<HTMLDivElement>) {
    if (!onAttachAndSend) return;
    e.preventDefault();
    dragCounterRef.current += 1;
    if (dragCounterRef.current === 1) setIsDraggingFile(true);
  }

  function onDragOver(e: DragEvent<HTMLDivElement>) {
    if (!onAttachAndSend) return;
    e.preventDefault(); // Required to allow drop
  }

  function onDragLeave() {
    if (!onAttachAndSend) return;
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) setIsDraggingFile(false);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    if (!onAttachAndSend) return;
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDraggingFile(false);

    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      showToast({ title: "File is too large (250 MB max)", tone: "error" });
      return;
    }
    setPendingFile(file);
  }

  // ---------------------------------------------------------------------------
  // Format application
  // ---------------------------------------------------------------------------

  function applyFormat(action: FormatAction) {
    const ta = textareaRef.current;
    if (!ta) return;

    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.slice(start, end);
    const before = value.slice(0, start);
    const after = value.slice(end);

    let replacement = "";
    let newCursorStart = start;
    let newCursorEnd = end;

    switch (action) {
      case "bold": {
        replacement = `**${selected}**`;
        newCursorStart = selected ? start : start + 2;
        newCursorEnd = selected ? start + replacement.length : start + 2;
        break;
      }
      case "italic": {
        replacement = `*${selected}*`;
        newCursorStart = selected ? start : start + 1;
        newCursorEnd = selected ? start + replacement.length : start + 1;
        break;
      }
      case "underline": {
        replacement = `<u>${selected}</u>`;
        newCursorStart = selected ? start : start + 3;
        newCursorEnd = selected ? start + replacement.length : start + 3;
        break;
      }
      case "strikethrough": {
        replacement = `~~${selected}~~`;
        newCursorStart = selected ? start : start + 2;
        newCursorEnd = selected ? start + replacement.length : start + 2;
        break;
      }
      case "link": {
        const url = window.prompt("Enter URL:", "https://");
        if (!url) return;
        const label = selected || "link text";
        replacement = `[${label}](${url})`;
        newCursorStart = start + replacement.length;
        newCursorEnd = newCursorStart;
        break;
      }
      case "code": {
        replacement = `\`${selected}\``;
        newCursorStart = selected ? start : start + 1;
        newCursorEnd = selected ? start + replacement.length : start + 1;
        break;
      }
      case "codeBlock": {
        const inner = selected ? `\n${selected}\n` : "\n";
        replacement = `\`\`\`${inner}\`\`\``;
        newCursorStart = selected ? start : start + 4;
        newCursorEnd = selected ? start + replacement.length : start + 4;
        break;
      }
      case "unorderedList": {
        if (!selected) {
          replacement = "- ";
          newCursorStart = start + 2;
          newCursorEnd = newCursorStart;
        } else {
          const lines = selected.split("\n");
          replacement = lines.map((l) => `- ${l}`).join("\n");
          newCursorStart = start;
          newCursorEnd = start + replacement.length;
        }
        break;
      }
      case "orderedList": {
        if (!selected) {
          replacement = "1. ";
          newCursorStart = start + 3;
          newCursorEnd = newCursorStart;
        } else {
          const lines = selected.split("\n");
          replacement = lines.map((l, idx) => `${idx + 1}. ${l}`).join("\n");
          newCursorStart = start;
          newCursorEnd = start + replacement.length;
        }
        break;
      }
      default:
        return;
    }

    const newValue = before + replacement + after;
    setValue(newValue);

    // Restore selection after React re-render
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(newCursorStart, newCursorEnd);
    });
  }

  // ---------------------------------------------------------------------------
  // Toolbar definitions (defined here so they can reference applyFormat)
  // ---------------------------------------------------------------------------

  const toolbarButtons: (ToolbarButton | "divider")[] = [
    {
      action: "bold",
      label: "Bold (Cmd+B)",
      icon: <Bold className="h-3.5 w-3.5" />,
    },
    {
      action: "italic",
      label: "Italic (Cmd+I)",
      icon: <Italic className="h-3.5 w-3.5" />,
    },
    {
      action: "underline",
      label: "Underline",
      icon: <Underline className="h-3.5 w-3.5" />,
    },
    {
      action: "strikethrough",
      label: "Strikethrough",
      icon: <Strikethrough className="h-3.5 w-3.5" />,
    },
    "divider",
    {
      action: "link",
      label: "Link (Cmd+K)",
      icon: <Link className="h-3.5 w-3.5" />,
    },
    {
      action: "orderedList",
      label: "Ordered list",
      icon: <ListOrdered className="h-3.5 w-3.5" />,
    },
    {
      action: "unorderedList",
      label: "Unordered list",
      icon: <List className="h-3.5 w-3.5" />,
    },
    "divider",
    {
      action: "code",
      label: "Inline code",
      icon: <Code className="h-3.5 w-3.5" />,
    },
    {
      action: "codeBlock",
      label: "Code block",
      icon: <Code2 className="h-3.5 w-3.5" />,
    },
  ];

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function formatBytes(bytes: number): string {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (file && file.size > MAX_FILE_BYTES) {
      showToast({ title: "File is too large (250 MB max)", tone: "error" });
      e.target.value = "";
      return;
    }
    setPendingFile(file);
    // Reset input so picking the same file again fires onChange
    e.target.value = "";
  }

  const canSend = (value.trim() || Boolean(pendingFile)) && !isBusy;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="px-4 pb-4">
      {/* Hidden file picker — only mounted when upload is available */}
      {onAttachAndSend && (
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
          aria-hidden="true"
          tabIndex={-1}
        />
      )}

      {/* Outer wrapper handles drag-drop; position:relative for drop overlay */}
      <div
        ref={dropZoneRef}
        className="relative"
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {/* Drag-over overlay */}
        {isDraggingFile && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[var(--accent)] bg-[var(--surface)] text-[var(--accent)]">
            <Upload className="h-6 w-6" />
            <span className="text-[13px] font-medium">Drop to attach</span>
          </div>
        )}

        {/* @mention popover — positioned above the composer */}
        {mentionOpen && (
          <div
            ref={mentionPopoverRef}
            role="listbox"
            aria-label="Mention suggestions"
            className="absolute bottom-full left-0 z-20 mb-1 w-72 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-lg"
          >
            {filteredCandidates.map((c, idx) => (
              <button
                key={c.id}
                role="option"
                aria-selected={idx === mentionSelectedIdx}
                type="button"
                onMouseDown={(e) => {
                  // Prevent textarea blur before insertion
                  e.preventDefault();
                  insertMention(c);
                }}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors duration-100",
                  idx === mentionSelectedIdx
                    ? "bg-[var(--surface-hover)]"
                    : "hover:bg-[var(--surface-hover)]"
                )}
              >
                <Avatar userId={c.id} displayName={c.displayName} size={20} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-[var(--text-primary)]">
                    {c.displayName}
                  </span>
                  {c.email && (
                    <span className="block truncate text-[11px] text-[var(--text-muted)]">
                      {c.email}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="rounded-lg border border-[var(--border-input)] bg-[var(--surface)] transition-colors duration-150 focus-within:border-[var(--text-secondary)]">
          {/* Formatting toolbar */}
          <div className="flex items-center gap-0.5 border-b border-[var(--border)] px-2 py-1">
            {toolbarButtons.map((item, idx) => {
              if (item === "divider") {
                return (
                  <span
                    key={`divider-${idx}`}
                    className="mx-1 h-4 w-px flex-shrink-0 bg-[var(--border)]"
                    aria-hidden="true"
                  />
                );
              }
              return (
                <button
                  key={item.action}
                  type="button"
                  aria-label={item.label}
                  title={item.label}
                  onMouseDown={(e) => {
                    // Prevent textarea from losing focus
                    e.preventDefault();
                    applyFormat(item.action);
                  }}
                  className="flex h-6 w-6 items-center justify-center rounded text-[var(--text-secondary)] transition-colors duration-100 hover:bg-[var(--surface-hover)] hover:text-white active:bg-[var(--accent)] active:text-white focus-ring"
                >
                  {item.icon}
                </button>
              );
            })}
          </div>

          {/* Textarea row */}
          <div className="flex items-end gap-2 px-3 py-2">
            {/* Paperclip only rendered when parent supports file upload */}
            {onAttachAndSend && (
              <button
                type="button"
                aria-label="Attach file"
                disabled={isBusy}
                onClick={() => fileInputRef.current?.click()}
                className="flex-shrink-0 rounded p-1 text-[var(--text-secondary)] transition-colors duration-150 hover:bg-[var(--surface-hover)] hover:text-white focus-ring disabled:opacity-40"
              >
                <Paperclip className="h-4 w-4" />
              </button>
            )}
            <TextareaAutosize
              ref={textareaRef}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                updateMentionTrigger(e.target.value, e.target.selectionStart);
              }}
              onKeyDown={onKeyDown}
              onKeyUp={(e) => {
                // Re-check trigger after cursor movement keys (arrow left/right/home/end)
                const ta = e.currentTarget;
                updateMentionTrigger(ta.value, ta.selectionStart);
              }}
              onClick={(e) => {
                const ta = e.currentTarget;
                updateMentionTrigger(ta.value, ta.selectionStart);
              }}
              onPaste={onPaste}
              placeholder={placeholder}
              maxRows={8}
              disabled={isBusy}
              className="flex-1 resize-none bg-transparent text-[14px] text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none disabled:opacity-50"
            />
            <div className="flex flex-shrink-0 items-center gap-1">
              <button
                type="button"
                aria-label="Insert emoji"
                className="rounded p-1 text-[var(--text-secondary)] transition-colors duration-150 hover:bg-[var(--surface-hover)] hover:text-white focus-ring"
              >
                <Smile className="h-4 w-4" />
              </button>
              <button
                ref={sendButtonRef}
                type="button"
                aria-label="Send message"
                onClick={submit}
                disabled={!canSend}
                className={cn(
                  "relative overflow-hidden flex h-8 w-8 items-center justify-center rounded transition-[background,color] duration-150 ease-out focus-ring",
                  canSend
                    ? "bg-[#007a5a] text-white hover:bg-[#148567]"
                    : "text-[var(--text-muted)]"
                )}
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Pending attachment chip — sits between textarea and bottom hint */}
          {pendingFile && (
            <div className="flex items-center gap-2 border-t border-[var(--border)] px-3 py-1.5">
              <Paperclip className="h-3.5 w-3.5 flex-shrink-0 text-[var(--text-secondary)]" aria-hidden="true" />
              <span className="flex-1 truncate text-[12px] text-[var(--text-primary)]">
                {pendingFile.name}
              </span>
              <span className="flex-shrink-0 text-[11px] text-[var(--text-muted)]">
                {formatBytes(pendingFile.size)}
              </span>
              <button
                type="button"
                aria-label={`Remove attachment ${pendingFile.name}`}
                onClick={() => setPendingFile(null)}
                className="flex-shrink-0 rounded p-0.5 text-[var(--text-secondary)] transition-colors duration-100 hover:bg-[var(--surface-hover)] hover:text-white focus-ring"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      </div>
      <p className="mt-1 text-center text-[11px] text-[var(--text-muted)]">
        <kbd className="rounded bg-[var(--border)] px-1 py-0.5 text-[10px]">Enter</kbd> to send ·{" "}
        <kbd className="rounded bg-[var(--border)] px-1 py-0.5 text-[10px]">Shift+Enter</kbd> for new line
      </p>
    </div>
  );
}
