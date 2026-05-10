import { Download, FileText } from "lucide-react";

interface AttachmentCardProps {
  attachment: NonNullable<MSMessage["attachments"]>[number];
}

export function AttachmentCard({ attachment }: AttachmentCardProps) {
  const href = safeAttachmentHref(attachment.contentUrl);
  const label = attachment.name || "Attachment";
  const contentType = attachment.contentType || "File";

  const content = (
    <>
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded bg-[#2c2d30] text-[#ababad]">
        <FileText size={18} />
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

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 flex max-w-[420px] items-center gap-3 rounded-md border border-[#3f4144] bg-[#1a1d21] px-3 py-2 text-left transition-colors duration-150 hover:border-[#565856] hover:bg-[#27292d]"
    >
      {content}
    </a>
  );
}

function safeAttachmentHref(url?: string): string | null {
  if (!url) return null;
  if (/^https:\/\//i.test(url)) return url;
  return null;
}
