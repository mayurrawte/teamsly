"use client";

import { useRef, useState, KeyboardEvent, useEffect, useCallback, ClipboardEvent, DragEvent } from "react";
import dynamic from "next/dynamic";
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
  Slash,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { markdownToHtml } from "@/lib/utils/markdown-to-html";
import { Avatar } from "@/components/ui/Avatar";
import { useToastStore } from "@/store/toasts";
import { useDraftsStore } from "@/store/drafts";
import { GifPicker } from "./GifPicker";
import { SlashCommandMenu, useSlashMenu } from "./SlashCommandMenu";
import { parseSlashCommand, type SlashCommand } from "@/lib/slash-commands";
import { useCatchUpStore } from "@/store/catchUp";
import { usePreferencesStore } from "@/store/preferences";
import { DISAPPEAR_DURATIONS } from "@/lib/utils/disappear";

// emoji-mart ships a heavy data bundle — load lazily to keep the initial JS small
const EmojiMartPicker = dynamic(() => import("@emoji-mart/react"), {
  ssr: false,
  loading: () => null,
});

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
  disappearMs?: number; // when set, parent wraps the content as a disappearing message
  scheduleTime?: number; // epoch ms; when set, parent queues the message instead of sending now
  releaseWhenAvailable?: string; // recipient AAD id; when set, parent queues until the recipient is "Available"
  releaseTargetName?: string; // recipient display name, for the pending banner
}

interface Props {
  placeholder: string;
  onSend: (content: string, options?: SendOptions) => Promise<void>;
  /** Called instead of onSend when a file is pending. Only rendered when provided. */
  onAttachAndSend?: (content: string, file: File) => Promise<void>;
  /** Set to true by the parent while the upload+send is in flight */
  uploading?: boolean;
  /** Upload progress percentage (0–100). Displayed as a progress bar when uploading. */
  uploadProgress?: number;
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
  /** Current user's display name — used by slash commands like /me and /draw. */
  currentUserName?: string;
  /** Current user's AAD id — used to exclude self from /draw pool. */
  currentUserId?: string;
  /** Channel/chat members available for /draw with no args. */
  channelMembers?: Array<{ id: string; displayName: string }>;
  /**
   * Show the disappearing-message (⏱) picker. Only DMs wire the send-side
   * wrapping, so channels must leave this false — otherwise a user could set a
   * timer expecting ephemerality while the message is sent as plaintext.
   */
  allowDisappearing?: boolean;
  /**
   * Show the send-later (📅) picker. Only DMs wire the client-side queue +
   * due-sweep, so channels must leave this false.
   */
  allowSchedule?: boolean;
  /**
   * When this is a 1:1 DM, the recipient's id + name. Enables the "Send when
   * {name} is free" entry at the top of the schedule menu — the message is
   * held until the recipient's presence becomes "Available" instead of until
   * a time. Undefined for group chats / self-DMs.
   */
  whenFreeTarget?: { id: string; name: string };
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
// Send-later presets
// ---------------------------------------------------------------------------

interface SchedulePreset {
  label: string;
  /** Returns the target epoch ms, or null when the preset is in the past now. */
  at: () => number | null;
}

// Each preset is computed fresh at open time so "Tonight 6pm" disables itself
// once 18:00 has passed and "Tomorrow 9am" always lands on the next day.
const SCHEDULE_PRESETS: SchedulePreset[] = [
  {
    label: "In 1 hour",
    at: () => Date.now() + 60 * 60 * 1000,
  },
  {
    label: "Tonight 6pm",
    at: () => {
      const d = new Date();
      d.setHours(18, 0, 0, 0);
      return d.getTime() > Date.now() ? d.getTime() : null;
    },
  },
  {
    label: "Tomorrow 9am",
    at: () => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      return d.getTime();
    },
  },
  {
    label: "Monday 9am",
    at: () => {
      const d = new Date();
      // 1 = Monday. Days until next Monday (always strictly in the future).
      const daysUntilMonday = ((1 - d.getDay() + 7) % 7) || 7;
      d.setDate(d.getDate() + daysUntilMonday);
      d.setHours(9, 0, 0, 0);
      return d.getTime();
    },
  },
];

/** Format an epoch ms for the active-state pill + datetime-local input. */
function formatScheduleLabel(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Convert epoch ms to the `YYYY-MM-DDTHH:mm` string a datetime-local wants. */
function toDatetimeLocalValue(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function MessageInput({
  placeholder,
  onSend,
  onAttachAndSend,
  uploading,
  uploadProgress,
  mentionCandidates,
  allowEveryone,
  contextId,
  currentUserName = "",
  currentUserId = "",
  channelMembers,
  allowDisappearing,
  allowSchedule,
  whenFreeTarget,
}: Props) {
  // Lazy-init from the saved draft so a context with a draft paints filled on
  // first render instead of flashing empty for a frame before the seed effect
  // below runs. The effect still handles in-place contextId changes.
  const [value, setValue] = useState(() =>
    contextId ? (useDraftsStore.getState().drafts[contextId] ?? "") : "",
  );
  const [sending, setSending] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  // Disappearing timer, pre-armed from this conversation's saved default (if any).
  const setDisappearDefault = usePreferencesStore((s) => s.setDisappearDefault);
  const convoDisappearDefault = usePreferencesStore((s) =>
    contextId ? (s.disappearDefaults[contextId] ?? null) : null,
  );
  const [disappearMs, setDisappearMs] = useState<number | null>(() =>
    contextId ? (usePreferencesStore.getState().disappearDefaults[contextId] ?? null) : null,
  );
  const [showDisappearMenu, setShowDisappearMenu] = useState(false);
  const [scheduleTime, setScheduleTime] = useState<number | null>(null);
  const [showScheduleMenu, setShowScheduleMenu] = useState(false);
  const emojiAnchorRef = useRef<HTMLButtonElement>(null);
  const emojiContainerRef = useRef<HTMLDivElement>(null);
  const disappearMenuRef = useRef<HTMLDivElement>(null);
  const scheduleMenuRef = useRef<HTMLDivElement>(null);
  // Mentions the user has accepted via the autocomplete (or `@everyone`).
  // Reset on send. Kept parallel to the plain `@Display Name` text in the
  // textarea so the parent can build a structured Graph `mentions[]`.
  const [pendingMentions, setPendingMentions] = useState<PendingMention[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const showToast = useToastStore((state) => state.showToast);
  const setDraft = useDraftsStore((s) => s.setDraft);
  const clearDraftInStore = useDraftsStore((s) => s.clearDraft);
  const openCatchUp = useCatchUpStore((s) => s.setOpen);

  // ---------------------------------------------------------------------------
  // Draft seed + debounced write-back
  // ---------------------------------------------------------------------------
  // Seed `value` from the drafts store when the context changes (incl. mount).
  // We read the store imperatively so this effect doesn't re-run on every
  // draft mutation. When `contextId` is undefined (thread reply composer),
  // skip persistence entirely.
  useEffect(() => {
    // A schedule selection is per-composition; never carry it across chats.
    setScheduleTime(null);
    setShowScheduleMenu(false);
    if (!contextId) {
      setValue("");
      setDisappearMs(null);
      return;
    }
    const existing = useDraftsStore.getState().drafts[contextId] ?? "";
    setValue(existing);
    // Arm the disappearing timer from this conversation's saved default.
    setDisappearMs(usePreferencesStore.getState().disappearDefaults[contextId] ?? null);
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

  // ---------------------------------------------------------------------------
  // Slash-command menu state
  // ---------------------------------------------------------------------------
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState("");
  const [slashError, setSlashError] = useState<string | null>(null);

  function detectSlashTrigger(text: string) {
    // Only trigger when the entire value is a /word (no spaces after the word yet)
    const m = text.match(/^\/(\w*)$/);
    if (m) {
      setSlashMenuOpen(true);
      setSlashQuery(m[1]);
    } else {
      setSlashMenuOpen(false);
      setSlashQuery("");
    }
  }

  const slashMenu = useSlashMenu({
    open: slashMenuOpen,
    query: slashQuery,
    onSelect: handleSlashSelect,
    onClose: () => setSlashMenuOpen(false),
  });

  function handleSlashSelect(cmd: SlashCommand) {
    setSlashMenuOpen(false);
    if (cmd.requiresArgs) {
      // Drop the user into "/{name} " so they can type args
      setValue(`/${cmd.name} `);
      requestAnimationFrame(() => textareaRef.current?.focus());
    } else {
      // Execute immediately and submit
      void executeAndSubmit(`/${cmd.name}`);
    }
  }

  async function executeAndSubmit(input: string) {
    const parsed = parseSlashCommand(input.trim());
    if (!parsed) {
      await doSend(input.trim());
      return;
    }
    const ctx = { currentUserName, currentUserId, channelMembers };
    const result = await parsed.command.execute(parsed.args, ctx);
    if (result.kind === "error") {
      setSlashError(result.message);
      return;
    }
    if (result.kind === "gif") {
      await sendGifByQuery(result.query);
      return;
    }
    if (result.kind === "action") {
      setValue("");
      if (contextId) clearDraftInStore(contextId);
      if (result.action === "open_catch_up") openCatchUp(true);
      return;
    }
    // kind === "text"
    await doSend(result.text);
  }

  async function sendGifByQuery(query: string) {
    if (isBusy) return;
    setSending(true);
    setValue("");
    if (contextId) clearDraftInStore(contextId);
    try {
      const res = await fetch(`/api/gifs/search?q=${encodeURIComponent(query)}&limit=1`);
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      const gif = data.results?.[0];
      if (!gif) {
        setSlashError(`No GIFs found for "${query}"`);
        return;
      }
      const media = gif.media[0];
      const url = media?.gif?.url ?? media?.tinygif?.url;
      if (!url) {
        setSlashError(`No GIFs found for "${query}"`);
        return;
      }
      const alt = (gif.title ?? "GIF").replace(/"/g, "&quot;");
      await onSend(
        `<img src="${url}" alt="${alt}" style="max-width:300px;border-radius:4px" />`
      );
    } catch {
      setSlashError(`Couldn't fetch a GIF for "${query}"`);
    } finally {
      setSending(false);
    }
  }

  async function doSend(text: string) {
    if (!text || isBusy) return;
    setSending(true);
    setValue("");
    if (contextId) clearDraftInStore(contextId);
    try {
      await onSend(markdownToHtml(text));
      setPendingMentions([]);
    } catch {
      setValue(text);
    } finally {
      setSending(false);
    }
  }

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

  // Close emoji picker on outside click
  useEffect(() => {
    if (!emojiOpen) return;
    function handler(e: MouseEvent) {
      if (
        emojiContainerRef.current &&
        !emojiContainerRef.current.contains(e.target as Node) &&
        emojiAnchorRef.current &&
        !emojiAnchorRef.current.contains(e.target as Node)
      ) {
        setEmojiOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [emojiOpen]);

  // Close the disappearing-timer / send-later menus on outside click or Escape
  // (the emoji picker above already does this; these two were the outliers).
  useEffect(() => {
    if (!showDisappearMenu && !showScheduleMenu) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (showDisappearMenu && disappearMenuRef.current && !disappearMenuRef.current.contains(t)) {
        setShowDisappearMenu(false);
      }
      if (showScheduleMenu && scheduleMenuRef.current && !scheduleMenuRef.current.contains(t)) {
        setShowScheduleMenu(false);
      }
    }
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") {
        setShowDisappearMenu(false);
        setShowScheduleMenu(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [showDisappearMenu, showScheduleMenu]);

  function insertEmoji(emoji: { native: string }) {
    const ta = textareaRef.current;
    const inserted = emoji.native;
    if (!ta) {
      setValue((v) => v + inserted);
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const next = value.slice(0, start) + inserted + value.slice(end);
    setValue(next);
    const newCursor = start + inserted.length;
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(newCursor, newCursor);
    });
    setEmojiOpen(false);
  }

  async function sendGif(url: string, title: string) {
    if (isBusy) return;
    setSending(true);
    try {
      await onSend(`<img src="${url}" alt="${title.replace(/"/g, "&quot;")}" style="max-width:300px;border-radius:4px" />`);
    } catch {
      // ignore — parent handles errors
    } finally {
      setSending(false);
    }
  }

  async function submit() {
    triggerRipple();
    setSlashError(null);
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

    // If the message starts with a slash, attempt slash-command execution
    if (trimmed.startsWith("/")) {
      const parsed = parseSlashCommand(trimmed);
      if (parsed) {
        setValue("");
        if (contextId) clearDraftInStore(contextId);
        const ctx = { currentUserName, currentUserId, channelMembers };
        const result = await parsed.command.execute(parsed.args, ctx);
        if (result.kind === "error") {
          setValue(trimmed);
          setSlashError(result.message);
          return;
        }
        if (result.kind === "gif") {
          await sendGifByQuery(result.query);
          return;
        }
        if (result.kind === "action") {
          if (result.action === "open_catch_up") openCatchUp(true);
          return;
        }
        await doSend(result.text);
        return;
      }
      // Unrecognised command — send as plain text (strip the slash prefix feeling)
    }

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
        {
          ...(mentionsForSend.length > 0 ? { mentions: mentionsForSend } : {}),
          ...(disappearMs ? { disappearMs } : {}),
          ...(scheduleTime ? { scheduleTime } : {}),
        }
      );
      setPendingMentions([]);
      setDisappearMs(null);
      setScheduleTime(null);
    } catch {
      setValue(trimmed);
    } finally {
      setSending(false);
    }
  }

  // Queue the current message to be held until the recipient is free. Mirrors
  // the send path in `submit` but passes `releaseWhenAvailable` instead of a
  // `scheduleTime` so the parent gates delivery on presence, not time.
  async function sendWhenFree(target: { id: string; name: string }) {
    setSlashError(null);
    const trimmed = value.trim();
    if (!trimmed || isBusy) return;
    setShowScheduleMenu(false);
    setSending(true);
    setValue("");
    if (contextId) clearDraftInStore(contextId);
    const mentionsForSend = pendingMentions.filter((m) => {
      if (m.id === EVERYONE_MENTION_ID) {
        return /(^|\s)@everyone(\s|$)/.test(trimmed);
      }
      return trimmed.includes(`@${m.name}`);
    });
    try {
      await onSend(markdownToHtml(trimmed), {
        ...(mentionsForSend.length > 0 ? { mentions: mentionsForSend } : {}),
        ...(disappearMs ? { disappearMs } : {}),
        releaseWhenAvailable: target.id,
        releaseTargetName: target.name,
      });
      setPendingMentions([]);
      setDisappearMs(null);
      setScheduleTime(null);
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
    // Slash-command menu takes priority over mention menu
    if (slashMenuOpen && slashMenu.handleKey(e)) return;

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

        {/* Slash-command menu */}
        <SlashCommandMenu
          open={slashMenuOpen && slashMenu.filtered.length > 0}
          filtered={slashMenu.filtered}
          selectedIdx={slashMenu.selectedIdx}
          onHover={slashMenu.setSelectedIdx}
          onPick={handleSlashSelect}
        />

        {/* @mention popover — positioned above the composer */}
        {mentionOpen && (
          <div
            ref={mentionPopoverRef}
            role="listbox"
            aria-label="Mention suggestions"
            className="absolute bottom-full left-0 z-[120] mb-1 w-72 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-lg"
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

        <div className="rounded-md border border-[var(--border-input)] bg-[var(--surface)] transition-[border-color,box-shadow] duration-150 focus-within:border-[var(--accent)] focus-within:shadow-[0_0_0_2px_var(--accent-light)]">
          {/* Formatting toolbar */}
          <div className="flex items-center gap-0.5 border-b border-[var(--border)] px-3 py-1">
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
                  className="flex h-6 w-6 items-center justify-center rounded text-[var(--text-secondary)] transition-colors duration-100 hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] active:bg-[var(--accent)] active:text-white focus-ring"
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
                className="flex-shrink-0 rounded p-1 text-[var(--text-secondary)] transition-colors duration-150 hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] focus-ring disabled:opacity-40"
              >
                <Paperclip className="h-4 w-4" />
              </button>
            )}
            <TextareaAutosize
              ref={textareaRef}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setSlashError(null);
                detectSlashTrigger(e.target.value);
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
              {/* Emoji picker */}
              <div className="relative">
                <button
                  ref={emojiAnchorRef}
                  type="button"
                  aria-label="Insert emoji"
                  onClick={() => setEmojiOpen((o) => !o)}
                  className={cn(
                    "rounded p-1 transition-colors duration-150 hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] focus-ring",
                    emojiOpen ? "bg-[var(--surface-hover)] text-white" : "text-[var(--text-secondary)]"
                  )}
                >
                  <Smile className="h-4 w-4" />
                </button>
                {emojiOpen && (
                  <div
                    ref={emojiContainerRef}
                    className="absolute bottom-full right-0 z-[120] mb-2"
                  >
                    <EmojiMartPicker
                      data={async () => (await import("@emoji-mart/data")).default}
                      onEmojiSelect={insertEmoji}
                      theme="dark"
                      previewPosition="none"
                      skinTonePosition="none"
                      perLine={9}
                      maxFrequentRows={2}
                    />
                  </div>
                )}
              </div>

              {/* Slash commands trigger */}
              <button
                type="button"
                aria-label="Slash commands"
                title="Commands (/)"
                onClick={() => {
                  if (!value) {
                    setValue("/");
                    setSlashMenuOpen(true);
                    setSlashQuery("");
                    requestAnimationFrame(() => textareaRef.current?.focus());
                  } else {
                    textareaRef.current?.focus();
                  }
                }}
                className={cn(
                  "rounded px-1.5 py-0.5 transition-colors duration-150 hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] focus-ring",
                  slashMenuOpen ? "bg-[var(--surface-hover)] text-white" : "text-[var(--text-secondary)]"
                )}
              >
                <Slash className="h-4 w-4" />
              </button>

              {/* GIF picker */}
              <GifPicker onSelect={sendGif}>
                <button
                  type="button"
                  aria-label="Send a GIF"
                  disabled={isBusy}
                  className="rounded px-1.5 py-0.5 text-[10px] font-bold text-[var(--text-secondary)] transition-colors duration-150 hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] focus-ring disabled:opacity-40"
                >
                  GIF
                </button>
              </GifPicker>

              {/* Disappearing message duration picker */}
              {allowDisappearing && (
              <div className="relative" ref={disappearMenuRef}>
                <button
                  type="button"
                  aria-label="Disappearing message"
                  onClick={() => setShowDisappearMenu((v) => !v)}
                  className={`rounded p-1 text-[15px] transition-colors press-snap ${
                    disappearMs ? "text-[var(--accent)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  ⏱{disappearMs ? <span className="ml-[2px] text-[10px]">on</span> : null}
                </button>
                {showDisappearMenu && (
                  <div className="absolute bottom-full right-0 z-[120] mb-2 min-w-[160px] rounded-md border border-[var(--border)] bg-[var(--modal-bg)] py-1 shadow-lg">
                    <button
                      type="button"
                      onClick={() => { setDisappearMs(null); setShowDisappearMenu(false); }}
                      className={`block w-full px-3 py-1 text-left text-[13px] hover:bg-[var(--surface-hover)] ${disappearMs === null ? "text-[var(--accent)]" : "text-[var(--text-primary)]"}`}
                    >
                      Off
                    </button>
                    {DISAPPEAR_DURATIONS.map((d) => (
                      <button
                        key={d.ms}
                        type="button"
                        onClick={() => { setDisappearMs(d.ms); setShowDisappearMenu(false); }}
                        className={`block w-full px-3 py-1 text-left text-[13px] hover:bg-[var(--surface-hover)] ${disappearMs === d.ms ? "text-[var(--accent)]" : "text-[var(--text-primary)]"}`}
                      >
                        {d.label}
                      </button>
                    ))}
                    {contextId && (
                      <>
                        <div className="my-1 h-px bg-[var(--border)]" />
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={convoDisappearDefault != null}
                          onClick={() => {
                            if (convoDisappearDefault != null) {
                              setDisappearDefault(contextId, null);
                            } else {
                              // Save the current pick (default to 1h if none selected).
                              const ms = disappearMs ?? 60 * 60_000;
                              setDisappearMs(ms);
                              setDisappearDefault(contextId, ms);
                            }
                          }}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                        >
                          <span className={`flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-[3px] border ${convoDisappearDefault != null ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--border-input)]"}`}>
                            {convoDisappearDefault != null ? "✓" : ""}
                          </span>
                          Default for this conversation
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
              )}

              {/* Send-later (scheduled message) picker */}
              {allowSchedule && (
              <div className="relative" ref={scheduleMenuRef}>
                <button
                  type="button"
                  aria-label="Schedule message"
                  onClick={() => setShowScheduleMenu((v) => !v)}
                  className={`rounded p-1 text-[15px] transition-colors press-snap ${
                    scheduleTime ? "text-[var(--accent)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  📅{scheduleTime ? <span className="ml-[2px] text-[10px]">{formatScheduleLabel(scheduleTime)}</span> : null}
                </button>
                {showScheduleMenu && (
                  <div className="absolute bottom-full right-0 z-[120] mb-2 min-w-[200px] rounded-md border border-[var(--border)] bg-[var(--modal-bg)] py-1 shadow-lg">
                    {whenFreeTarget && (
                      <>
                        <button
                          type="button"
                          onClick={() => { void sendWhenFree(whenFreeTarget); }}
                          className="block w-full truncate px-3 py-1 text-left text-[13px] text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
                          title={`Send when ${whenFreeTarget.name} is free`}
                        >
                          Send when {whenFreeTarget.name} is free
                        </button>
                        <div className="my-1 h-px bg-[var(--border)]" aria-hidden="true" />
                      </>
                    )}
                    {scheduleTime !== null && (
                      <button
                        type="button"
                        onClick={() => { setScheduleTime(null); setShowScheduleMenu(false); }}
                        className="block w-full px-3 py-1 text-left text-[13px] text-[var(--accent)] hover:bg-[var(--surface-hover)]"
                      >
                        Send now (clear)
                      </button>
                    )}
                    {SCHEDULE_PRESETS.map((preset) => {
                      const at = preset.at();
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          disabled={at === null}
                          onClick={() => { if (at !== null) { setScheduleTime(at); setShowScheduleMenu(false); } }}
                          className={`block w-full px-3 py-1 text-left text-[13px] hover:bg-[var(--surface-hover)] ${
                            at === null
                              ? "cursor-not-allowed text-[var(--text-muted)] opacity-50"
                              : scheduleTime === at
                                ? "text-[var(--accent)]"
                                : "text-[var(--text-primary)]"
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                    <div className="my-1 h-px bg-[var(--border)]" aria-hidden="true" />
                    <label className="block px-3 py-1 text-[11px] text-[var(--text-muted)]">
                      Custom time
                      <input
                        type="datetime-local"
                        min={toDatetimeLocalValue(Date.now())}
                        value={scheduleTime !== null ? toDatetimeLocalValue(scheduleTime) : ""}
                        onChange={(e) => {
                          const next = e.target.value ? new Date(e.target.value).getTime() : NaN;
                          if (!Number.isNaN(next) && next > Date.now()) {
                            setScheduleTime(next);
                          }
                        }}
                        className="mt-1 block w-full rounded border border-[var(--border-input)] bg-[var(--surface)] px-2 py-1 text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                      />
                    </label>
                  </div>
                )}
              </div>
              )}

              <button
                ref={sendButtonRef}
                type="button"
                aria-label={scheduleTime ? "Schedule message" : "Send message"}
                onClick={submit}
                disabled={!canSend}
                className={cn(
                  "relative overflow-hidden flex h-8 items-center justify-center rounded transition-[background,color,transform] duration-150 ease-out focus-ring",
                  scheduleTime ? "w-auto gap-1 px-2.5 text-[13px] font-medium" : "w-8",
                  canSend
                    ? "bg-[var(--accent)] text-white hover:opacity-90"
                    : "text-[var(--text-muted)]"
                )}
              >
                <Send className="h-4 w-4" />
                {scheduleTime ? <span>Schedule</span> : null}
              </button>
            </div>
          </div>

          {/* Slash-command error */}
          {slashError && (
            <div className="flex items-center gap-1.5 border-t border-[var(--border)] px-3 py-1.5 text-[12px] text-red-400">
              <span className="font-mono">/</span>
              {slashError}
            </div>
          )}

          {/* Pending attachment chip — sits between textarea and bottom hint */}
          {pendingFile && (
            <div className="flex items-center gap-2 border-t border-[var(--border)] px-3 py-1.5">
              <Paperclip className="h-3.5 w-3.5 flex-shrink-0 text-[var(--text-secondary)]" aria-hidden="true" />
              <span className="flex-1 truncate text-[12px] text-[var(--text-primary)]">
                {pendingFile.name}
              </span>
              {uploading && uploadProgress !== undefined ? (
                <div className="flex flex-shrink-0 items-center gap-2">
                  <div className="h-1 w-20 overflow-hidden rounded-full bg-[var(--border)]">
                    <div
                      className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-150"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-[var(--text-muted)]">{uploadProgress}%</span>
                </div>
              ) : (
                <>
                  <span className="flex-shrink-0 text-[11px] text-[var(--text-muted)]">
                    {formatBytes(pendingFile.size)}
                  </span>
                  {!uploading && (
                    <button
                      type="button"
                      aria-label={`Remove attachment ${pendingFile.name}`}
                      onClick={() => setPendingFile(null)}
                      className="flex-shrink-0 rounded p-0.5 text-[var(--text-secondary)] transition-colors duration-100 hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] focus-ring"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </>
              )}
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
