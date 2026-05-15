import { Download } from "lucide-react";
import { getFileIcon } from "@/lib/utils/file-icon";
import { useFilePreviewStore } from "@/store/filePreview";
import { AdaptiveCard } from "./AdaptiveCard";

type MSAttachment = NonNullable<MSMessage["attachments"]>[number];

interface AttachmentCardProps {
  attachment: MSAttachment;
}

export function AttachmentCard({ attachment }: AttachmentCardProps) {
  // Quoted-reply path — Graph returns the referenced message as an attachment
  // with contentType "messageReference". Caller is expected to filter these
  // out before passing to AttachmentCard (they render above the body), but
  // guard here too so we never fall through to the generic file row.
  if (isMessageReference(attachment.contentType)) {
    return <MessageReferenceCard attachment={attachment} />;
  }

  // Adaptive Card path
  if (attachment.contentType === "application/vnd.microsoft.card.adaptive") {
    return <AdaptiveCardAttachment attachment={attachment} />;
  }

  const href = safeAttachmentHref(attachment.contentUrl);
  const label = attachment.name || "Attachment";
  const contentType = attachment.contentType || "File";

  const FileIcon = getFileIcon(attachment.contentType, false, attachment.name ?? undefined);

  const content = (
    <>
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded bg-[#2c2d30] text-[#ababad]">
        <FileIcon size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-bold text-[#d1d2d3]">{label}</span>
        <span className="block truncate text-[12px] text-[#6c6f75]">{contentType}</span>
      </span>
      <Download className="h-4 w-4 flex-shrink-0 text-[#ababad]" />
    </>
  );

  if (!href) {
    return (
      <div className="mt-2 flex max-w-[420px] items-center gap-3 rounded-md border border-[#3f4144] bg-[#1a1d21] px-3 py-2 text-left opacity-70">
        {content}
      </div>
    );
  }

  function onClick(e: React.MouseEvent<HTMLAnchorElement>) {
    // Power-user opt-out: Ctrl/Cmd+click or middle-click keeps the legacy
    // "open in new tab" behaviour. Default click opens the inline preview
    // panel so we don't bounce the user to SharePoint and back.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
    if (!href) return; // demo / null webUrl — no-op preview, no-op link
    e.preventDefault();
    useFilePreviewStore.getState().openPreview({
      name: label,
      webUrl: href,
      mimeType: attachment.contentType ?? sniffMimeFromName(label),
    });
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      // Middle-click (button 1) goes to onAuxClick, not onClick, so the
      // browser's default "open in new tab" already works for us — no
      // explicit handler needed.
      className="mt-2 flex max-w-[420px] cursor-pointer items-center gap-3 rounded-md border border-[#3f4144] bg-[#1a1d21] px-3 py-2 text-left transition-colors duration-150 hover:border-[#565856] hover:bg-[#27292d]"
    >
      {content}
    </a>
  );
}

// Graph chat/channel message attachments often carry contentType "reference"
// (a sharing reference, not a real MIME). Sniff from extension so the preview
// panel can pick the right renderer.
function sniffMimeFromName(name: string): string | undefined {
  const ext = name.split(".").pop()?.toLowerCase();
  if (!ext) return undefined;
  switch (ext) {
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "webp":
    case "svg":
      return `image/${ext === "jpg" ? "jpeg" : ext === "svg" ? "svg+xml" : ext}`;
    case "pdf":
      return "application/pdf";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case "pptx":
      return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    case "doc":
      return "application/msword";
    case "xls":
      return "application/vnd.ms-excel";
    case "ppt":
      return "application/vnd.ms-powerpoint";
    case "txt":
    case "md":
    case "log":
      return "text/plain";
    case "csv":
      return "text/csv";
    case "json":
      return "application/json";
    default:
      return undefined;
  }
}

function safeAttachmentHref(url?: string | null): string | null {
  if (!url) return null;
  if (/^https:\/\//i.test(url)) return url;
  return null;
}

// ---------------------------------------------------------------------------
// Adaptive Card attachment handler
// ---------------------------------------------------------------------------

function AdaptiveCardAttachment({ attachment }: { attachment: MSAttachment }) {
  // `content` may be a JSON string (Graph API) or already a parsed object
  let parsed: Record<string, unknown> | null = null;

  try {
    if (typeof attachment.content === "string" && attachment.content.trim().startsWith("{")) {
      parsed = JSON.parse(attachment.content) as Record<string, unknown>;
    } else if (
      typeof attachment.content === "object" &&
      attachment.content !== null &&
      !Array.isArray(attachment.content)
    ) {
      parsed = attachment.content as Record<string, unknown>;
    }
  } catch {
    // fall through to fallback
  }

  if (!parsed) {
    // Parse failed or content missing — render name-only stub
    const FallbackIcon = getFileIcon(attachment.contentType, false, attachment.name ?? undefined);
    return (
      <div className="mt-2 flex max-w-[420px] items-center gap-3 rounded-md border border-[#3f4144] bg-[#1a1d21] px-3 py-2 text-left opacity-70">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded bg-[#2c2d30] text-[#ababad]">
          <FallbackIcon size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-bold text-[#d1d2d3]">
            {attachment.name || "Adaptive Card"}
          </span>
          <span className="block truncate text-[12px] text-[#6c6f75]">
            application/vnd.microsoft.card.adaptive
          </span>
        </span>
      </div>
    );
  }

  return <AdaptiveCard data={parsed} />;
}

// ---------------------------------------------------------------------------
// Message reference (quoted reply) renderer
// ---------------------------------------------------------------------------

export function isMessageReference(contentType?: string | null): boolean {
  return typeof contentType === "string" && contentType.toLowerCase() === "messagereference";
}

interface MessageReferenceShape {
  messageId?: string;
  messagePreview?: string;
  messageSender?: {
    user?: { id?: string; displayName?: string };
  };
}

function parseMessageReference(content: MSAttachment["content"]): MessageReferenceShape | null {
  try {
    if (typeof content === "string" && content.trim().startsWith("{")) {
      return JSON.parse(content) as MessageReferenceShape;
    }
    if (typeof content === "object" && content !== null && !Array.isArray(content)) {
      return content as MessageReferenceShape;
    }
  } catch {
    // fall through
  }
  return null;
}

export function MessageReferenceCard({ attachment }: { attachment: MSAttachment }) {
  const parsed = parseMessageReference(attachment.content);

  const senderName = parsed?.messageSender?.user?.displayName ?? "Unknown";
  const preview = parsed?.messagePreview?.trim() ?? "";

  return (
    <div className="mb-1 max-w-[640px] overflow-hidden rounded-md border-l-[3px] border-[var(--accent)] bg-[var(--surface)] py-1.5 pl-3 pr-3">
      <div className="text-[12px] font-semibold text-[var(--text-secondary)]">{senderName}</div>
      {preview && (
        <div className="mt-0.5 line-clamp-2 whitespace-pre-wrap break-words text-[13px] text-[var(--text-secondary)]">
          {preview}
        </div>
      )}
    </div>
  );
}
