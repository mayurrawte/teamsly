"use client";

import { useRef, useState, KeyboardEvent } from "react";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { markdownToHtml } from "@/lib/utils/markdown-to-html";

interface Props {
  placeholder: string;
  onSend: (content: string) => Promise<void>;
  /** Called instead of onSend when a file is pending. Only rendered when provided. */
  onAttachAndSend?: (content: string, file: File) => Promise<void>;
  /** Set to true by the parent while the upload+send is in flight */
  uploading?: boolean;
}

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
// Main component
// ---------------------------------------------------------------------------

export function MessageInput({ placeholder, onSend, onAttachAndSend, uploading }: Props) {
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isBusy = sending || Boolean(uploading);

  async function submit() {
    const trimmed = value.trim();
    // Allow send when there's a pending file even with no text
    if ((!trimmed && !pendingFile) || isBusy) return;

    if (pendingFile && onAttachAndSend) {
      // File send path: delegate entirely to parent
      const fileToSend = pendingFile;
      setSending(true);
      setValue("");
      setPendingFile(null);
      try {
        await onAttachAndSend(markdownToHtml(trimmed), fileToSend);
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
    try {
      // Convert markdown-subset to HTML before sending so the Graph API
      // renders formatting correctly (contentType: "html" in graph/client.ts).
      await onSend(markdownToHtml(trimmed));
    } catch {
      setValue(trimmed);
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
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
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
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
              type="button"
              aria-label="Send message"
              onClick={submit}
              disabled={!canSend}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded transition-[background,color] duration-150 ease-out focus-ring",
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
      <p className="mt-1 text-center text-[11px] text-[var(--text-muted)]">
        <kbd className="rounded bg-[var(--border)] px-1 py-0.5 text-[10px]">Enter</kbd> to send ·{" "}
        <kbd className="rounded bg-[var(--border)] px-1 py-0.5 text-[10px]">Shift+Enter</kbd> for new line
      </p>
    </div>
  );
}
