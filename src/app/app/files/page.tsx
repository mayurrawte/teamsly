"use client";

import { useState, useEffect, useMemo } from "react";
import { formatDistanceToNow, format, differenceInDays } from "date-fns";
import { Search, ExternalLink, FileX, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { getFileIcon } from "@/lib/utils/file-icon";

// ---------------------------------------------------------------------------
// Tab types and filtering
// ---------------------------------------------------------------------------

type FileTab = "all" | "documents" | "images";

const DOCUMENT_MIMES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/csv",
  "text/plain",
]);

function isDocument(mimeType?: string) {
  if (!mimeType) return false;
  return DOCUMENT_MIMES.has(mimeType) || mimeType.startsWith("text/");
}

function isImage(mimeType?: string) {
  return !!mimeType && mimeType.startsWith("image/");
}

// ---------------------------------------------------------------------------
// Safe URL guard — only allow https:// links (mirrors AttachmentCard pattern)
// ---------------------------------------------------------------------------

function safeWebUrl(url?: string): string | null {
  if (!url) return null;
  if (/^https:\/\//i.test(url)) return url;
  return null;
}

// ---------------------------------------------------------------------------
// Relative/absolute date helper
// ---------------------------------------------------------------------------

function formatModified(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  if (differenceInDays(new Date(), d) > 30) {
    return format(d, "MMM d, yyyy");
  }
  return formatDistanceToNow(d, { addSuffix: true });
}

// ---------------------------------------------------------------------------
// Normalise a raw drive item — prefer top-level fields, fall back to
// remoteItem for Teams-shared files that originate from another user's drive.
// ---------------------------------------------------------------------------

interface NormalisedFile {
  id: string;
  name: string;
  mimeType?: string;
  isFolder: boolean;
  webUrl: string | null;
  modified: string;
  parentName?: string;
}

function normalise(item: MSDriveItem): NormalisedFile {
  const ri = item.remoteItem;
  const name = item.name || ri?.name || "Untitled";
  const mimeType = item.file?.mimeType ?? ri?.file?.mimeType;
  const isFolder = !!(item.folder || ri?.folder);
  const webUrl = safeWebUrl(item.webUrl) ?? safeWebUrl(ri?.webUrl) ?? null;
  const modified = item.lastModifiedDateTime || ri?.lastModifiedDateTime || "";
  const parentName =
    item.parentReference?.name ?? ri?.parentReference?.name;

  return { id: item.id, name, mimeType, isFolder, webUrl, modified, parentName };
}

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------

function FilesSkeleton() {
  return (
    <div role="status" aria-label="Loading files" aria-busy="true" className="flex flex-col gap-1 px-4 py-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-md px-3 py-2.5">
          <div className="skeleton h-9 w-9 flex-shrink-0 rounded" />
          <div className="min-w-0 flex-1">
            <div className="skeleton mb-1.5 h-3.5" style={{ width: `${55 + (i % 3) * 15}%` }} />
            <div className="skeleton h-3" style={{ width: `${30 + (i % 4) * 10}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single file row
// ---------------------------------------------------------------------------

function FileRow({ file }: { file: NormalisedFile }) {
  const Icon = getFileIcon(file.mimeType, file.isFolder);
  const href = file.webUrl;

  return (
    <div className="group flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors duration-[80ms] hover:bg-[#27292d]">
      {/* Icon */}
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded bg-[#2c2d30] text-[#ababad]">
        <Icon size={18} />
      </span>

      {/* Name + meta */}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-bold text-[#d1d2d3]">{file.name}</span>
        <span className="block truncate text-[12px] text-[#6c6f75]">
          {file.parentName ? `${file.parentName} · ` : ""}
          {file.modified ? formatModified(file.modified) : ""}
        </span>
      </span>

      {/* Open link */}
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          title={`Open ${file.name}`}
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
// Main page
// ---------------------------------------------------------------------------

const TABS: { id: FileTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "documents", label: "Documents" },
  { id: "images", label: "Images" },
];

export default function FilesPage() {
  const [items, setItems] = useState<MSDriveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeTab, setActiveTab] = useState<FileTab>("all");
  const [query, setQuery] = useState("");

  async function fetchFiles() {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/files/recent");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { items?: MSDriveItem[] };
      setItems(data.items ?? []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchFiles();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .map(normalise)
      .filter((f) => {
        if (q && !f.name.toLowerCase().includes(q)) return false;
        if (activeTab === "documents") return isDocument(f.mimeType);
        if (activeTab === "images") return isImage(f.mimeType);
        return true;
      });
  }, [items, activeTab, query]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-[#3f4144] px-4 pb-0 pt-4">
        <h1 className="mb-3 text-[18px] font-bold text-white">Files</h1>

        {/* Tab row */}
        <div className="flex gap-0" role="tablist" aria-label="File type filters">
          {TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "relative px-3 pb-2.5 pt-1 text-[13px] font-medium transition-colors duration-[80ms] ease-out focus:outline-none focus-visible:ring-1 focus-visible:ring-[#0F5A8F]",
                  active ? "text-white" : "text-[#ababad] hover:text-[#d1d2d3]"
                )}
              >
                {tab.label}
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t-full bg-[#0F5A8F]"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Search bar */}
      <div className="flex-shrink-0 px-4 py-2">
        <div className="flex items-center gap-2 rounded-md border border-[#3f4144] bg-[#1a1d21] px-3 py-1.5">
          <Search size={14} className="flex-shrink-0 text-[#ababad]" />
          <input
            type="search"
            placeholder="Search files"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-[13px] text-[#d1d2d3] placeholder-[#6c6f75] outline-none"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-1">
        {loading ? (
          <FilesSkeleton />
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
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
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <FileX size={36} className="text-[#6c6f75]" />
            <p className="text-[13px] text-[#ababad]">
              {query ? "No files match your search" : "No recent files"}
            </p>
          </div>
        ) : (
          <div className="py-1">
            {filtered.map((file) => (
              <FileRow key={file.id} file={file} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
