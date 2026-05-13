"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ExternalLink, FileX, RefreshCw } from "lucide-react";
import { getFileIcon } from "@/app/app/files/page";

// ---------------------------------------------------------------------------
// Mode discriminant
// ---------------------------------------------------------------------------

type Mode =
  | { kind: "channel"; teamId: string; channelId: string }
  | { kind: "chat"; chatId: string };

interface ContextFilesTabProps {
  mode: Mode;
}

// ---------------------------------------------------------------------------
// URL guard — only open https:// links (mirrors AttachmentCard pattern)
// ---------------------------------------------------------------------------

function safeHref(url?: string): string | null {
  if (!url) return null;
  if (/^https:\/\//i.test(url)) return url;
  return null;
}

// ---------------------------------------------------------------------------
// Relative time helper
// ---------------------------------------------------------------------------

function relativeTime(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return formatDistanceToNow(d, { addSuffix: true });
}

// ---------------------------------------------------------------------------
// Skeleton loader (~6 rows)
// ---------------------------------------------------------------------------

function FilesTabSkeleton() {
  return (
    <div role="status" aria-label="Loading files" aria-busy="true" className="flex flex-col gap-1 px-4 py-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-md px-3 py-2.5">
          <div className="skeleton h-9 w-9 flex-shrink-0 rounded" />
          <div className="min-w-0 flex-1">
            <div className="skeleton mb-1.5 h-3.5" style={{ width: `${50 + (i % 3) * 15}%` }} />
            <div className="skeleton h-3" style={{ width: `${28 + (i % 4) * 10}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Channel file row
// ---------------------------------------------------------------------------

function ChannelFileRow({ item }: { item: MSDriveItem }) {
  const mimeType = item.file?.mimeType;
  const isFolder = !!item.folder;
  const Icon = getFileIcon(mimeType, isFolder);
  const href = safeHref(item.webUrl);

  return (
    <div className="group flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors duration-[80ms] hover:bg-[#27292d]">
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded bg-[#2c2d30] text-[#ababad]">
        <Icon size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-bold text-[#d1d2d3]">{item.name}</span>
        <span className="block truncate text-[12px] text-[#6c6f75]">
          {item.lastModifiedDateTime ? `Modified ${relativeTime(item.lastModifiedDateTime)}` : ""}
        </span>
      </span>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          title={`Open ${item.name}`}
          aria-label={`Open ${item.name}`}
          className="flex-shrink-0 text-[#ababad] opacity-0 transition-opacity duration-[80ms] group-hover:opacity-100 focus:opacity-100"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink size={15} />
        </a>
      ) : (
        <span className="w-[15px] flex-shrink-0" />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chat file row
// ---------------------------------------------------------------------------

function ChatFileRow({ item }: { item: MSChatFileAttachment }) {
  const Icon = getFileIcon(undefined, false);
  const href = safeHref(item.contentUrl);
  const sharer = item.sharedBy?.displayName;

  return (
    <div className="group flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors duration-[80ms] hover:bg-[#27292d]">
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded bg-[#2c2d30] text-[#ababad]">
        <Icon size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-bold text-[#d1d2d3]">{item.name}</span>
        <span className="block truncate text-[12px] text-[#6c6f75]">
          {sharer ? `Shared by ${sharer} · ` : ""}
          {item.sharedDateTime ? relativeTime(item.sharedDateTime) : ""}
        </span>
      </span>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          title={`Open ${item.name}`}
          aria-label={`Open ${item.name}`}
          className="flex-shrink-0 text-[#ababad] opacity-0 transition-opacity duration-[80ms] group-hover:opacity-100 focus:opacity-100"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink size={15} />
        </a>
      ) : (
        <span className="w-[15px] flex-shrink-0" />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ContextFilesTab({ mode }: ContextFilesTabProps) {
  const [channelItems, setChannelItems] = useState<MSDriveItem[]>([]);
  const [chatItems, setChatItems] = useState<MSChatFileAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchKey =
    mode.kind === "channel"
      ? `${mode.teamId}/${mode.channelId}`
      : mode.chatId;

  async function fetchFiles() {
    setLoading(true);
    setError(false);
    try {
      if (mode.kind === "channel") {
        const res = await fetch(
          `/api/channels/${mode.teamId}/${mode.channelId}/files`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { items?: MSDriveItem[] };
        setChannelItems(data.items ?? []);
      } else {
        const res = await fetch(`/api/chats/${mode.chatId}/files`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { items?: MSChatFileAttachment[] };
        setChatItems(data.items ?? []);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  // Re-fetch whenever the channel or chat changes
  useEffect(() => {
    fetchFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchKey]);

  if (loading) return <FilesTabSkeleton />;

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
        <FileX size={36} className="text-[#6c6f75]" />
        <p className="text-[13px] text-[#ababad]">Couldn&apos;t load files</p>
        <button
          onClick={fetchFiles}
          className="flex items-center gap-1.5 rounded-md border border-[#3f4144] px-3 py-1.5 text-[13px] text-[#d1d2d3] transition-colors duration-[80ms] hover:bg-[#27292d]"
        >
          <RefreshCw size={13} />
          Retry
        </button>
      </div>
    );
  }

  if (mode.kind === "channel") {
    if (channelItems.length === 0) {
      return (
        <div className="flex flex-1 items-center justify-center text-[13px] text-[#6c6f75]">
          No files have been shared here yet.
        </div>
      );
    }
    return (
      <div className="flex-1 overflow-y-auto px-1 py-1">
        {channelItems.map((item) => (
          <ChannelFileRow key={item.id} item={item} />
        ))}
      </div>
    );
  }

  // chat mode
  if (chatItems.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-[13px] text-[#6c6f75]">
        No files have been shared here yet.
      </div>
    );
  }
  return (
    <div className="flex-1 overflow-y-auto px-1 py-1">
      {chatItems.map((item) => (
        <ChatFileRow key={item.id} item={item} />
      ))}
    </div>
  );
}
