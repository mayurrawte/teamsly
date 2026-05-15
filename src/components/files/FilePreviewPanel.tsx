"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Download, ExternalLink, FileX, Loader2 } from "lucide-react";
import { useFilePreviewStore } from "@/store/filePreview";

// ---------------------------------------------------------------------------
// Mime / extension classification
// ---------------------------------------------------------------------------

type PreviewKind = "image" | "pdf" | "office" | "text" | "unsupported";

const IMAGE_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
]);

const OFFICE_MIMES = new Set([
  // OOXML
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  // Legacy MS Office binary
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
]);

const OFFICE_EXTS = new Set(["doc", "docx", "xls", "xlsx", "ppt", "pptx"]);
const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg"]);
const TEXT_EXTS = new Set([
  "txt",
  "md",
  "csv",
  "log",
  "json",
  "xml",
  "yml",
  "yaml",
  "ts",
  "tsx",
  "js",
  "jsx",
  "css",
  "html",
  "py",
  "rb",
  "go",
  "rs",
  "java",
  "c",
  "h",
  "cpp",
  "sh",
]);

function extOf(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx < 0 ? "" : name.slice(idx + 1).toLowerCase();
}

function classify(file: MSFilePreview): PreviewKind {
  const mime = file.mimeType?.toLowerCase();
  const ext = extOf(file.name);

  if (mime) {
    if (IMAGE_MIMES.has(mime) || mime.startsWith("image/")) return "image";
    if (mime === "application/pdf") return "pdf";
    if (OFFICE_MIMES.has(mime)) return "office";
    if (mime.startsWith("text/") || mime === "application/json") return "text";
  }

  if (IMAGE_EXTS.has(ext)) return "image";
  if (ext === "pdf") return "pdf";
  if (OFFICE_EXTS.has(ext)) return "office";
  if (TEXT_EXTS.has(ext)) return "text";

  return "unsupported";
}

function humanSize(bytes?: number): string | null {
  if (!bytes || bytes < 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

// ---------------------------------------------------------------------------
// Resolved-URL state — fetched once per `open` from /api/files/preview/[id]/url.
// Most surfaces don't know the driveItem id (messages only have webUrl), so
// `itemId` may be absent — in that case the panel skips the URL fetch and
// falls back to webUrl + Office Online iframe.
// ---------------------------------------------------------------------------

type UrlState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; downloadUrl: string }
  | { status: "error" };

function useResolvedDownloadUrl(file: MSFilePreview | null): UrlState {
  const [state, setState] = useState<UrlState>({ status: "idle" });

  useEffect(() => {
    if (!file) {
      setState({ status: "idle" });
      return;
    }

    // Caller already provided a pre-signed URL (uploads return this on the
    // /me/drive responses). Use it directly.
    if (file.downloadUrl) {
      setState({ status: "ready", downloadUrl: file.downloadUrl });
      return;
    }

    if (!file.itemId) {
      // No itemId → no way to call Graph for the anonymous URL. The panel
      // will rely on webUrl + Office Online's `src` parameter.
      setState({ status: "idle" });
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });

    fetch(`/api/files/preview/${encodeURIComponent(file.itemId)}/url`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{ downloadUrl: string }>;
      })
      .then((data) => {
        if (cancelled) return;
        setState({ status: "ready", downloadUrl: data.downloadUrl });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, [file]);

  return state;
}

// ---------------------------------------------------------------------------
// Text-body fetcher — only runs for kind === "text" when we have an itemId.
// Reads up to 256 KB; longer files get truncated with a clear marker.
// ---------------------------------------------------------------------------

const TEXT_PREVIEW_BYTES = 256 * 1024;

type TextState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; body: string; truncated: boolean }
  | { status: "error" };

function useTextBody(file: MSFilePreview | null, kind: PreviewKind): TextState {
  const [state, setState] = useState<TextState>({ status: "idle" });

  useEffect(() => {
    if (!file || kind !== "text" || !file.itemId) {
      setState({ status: "idle" });
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });

    fetch(`/api/files/preview/${encodeURIComponent(file.itemId)}/content`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        // Read first chunk only — cap at TEXT_PREVIEW_BYTES.
        const buf = await res.arrayBuffer();
        const limited = buf.byteLength > TEXT_PREVIEW_BYTES;
        const slice = limited ? buf.slice(0, TEXT_PREVIEW_BYTES) : buf;
        return {
          body: new TextDecoder("utf-8", { fatal: false }).decode(slice),
          truncated: limited,
        };
      })
      .then((data) => {
        if (cancelled) return;
        setState({ status: "ready", body: data.body, truncated: data.truncated });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, [file, kind]);

  return state;
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export function FilePreviewPanel() {
  const { open, file, close } = useFilePreviewStore();

  const kind = useMemo<PreviewKind>(() => (file ? classify(file) : "unsupported"), [file]);
  const urlState = useResolvedDownloadUrl(file);
  const textState = useTextBody(file, kind);

  if (!open || !file) return null;

  const resolvedDownloadUrl =
    urlState.status === "ready" ? urlState.downloadUrl : null;

  return (
    <aside
      aria-label="File preview"
      className="flex w-[360px] flex-shrink-0 flex-col border-l border-[var(--border)] bg-[var(--content-bg)]"
    >
      {/* Header */}
      <div className="flex h-[49px] flex-shrink-0 items-center gap-1.5 border-b border-[var(--border)] px-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-bold text-white" title={file.name}>
            {file.name}
          </div>
          {humanSize(file.size) && (
            <div className="text-[11px] text-[var(--text-muted)]">{humanSize(file.size)}</div>
          )}
        </div>

        {resolvedDownloadUrl && (
          <a
            href={resolvedDownloadUrl}
            download={file.name}
            target="_blank"
            rel="noopener noreferrer"
            title="Download"
            aria-label="Download file"
            className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-raised)] hover:text-white focus-ring"
          >
            <Download className="h-4 w-4" />
          </a>
        )}

        <a
          href={file.webUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Open in browser"
          aria-label="Open in browser"
          className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-raised)] hover:text-white focus-ring"
        >
          <ExternalLink className="h-4 w-4" />
        </a>

        <button
          type="button"
          aria-label="Close file preview"
          onClick={close}
          className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-raised)] hover:text-white focus-ring"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden bg-[#1a1d21]">
        <PreviewBody
          file={file}
          kind={kind}
          urlState={urlState}
          textState={textState}
        />
      </div>
    </aside>
  );
}

function PreviewBody({
  file,
  kind,
  urlState,
  textState,
}: {
  file: MSFilePreview;
  kind: PreviewKind;
  urlState: UrlState;
  textState: TextState;
}) {
  if (kind === "image") {
    // For images, prefer the resolved anonymous URL — Graph's webUrl in
    // SharePoint won't render inline as <img src>. Fall back to webUrl, which
    // probably won't load but at least surfaces a broken-image state instead
    // of a black void.
    const src =
      urlState.status === "ready"
        ? urlState.downloadUrl
        : file.thumbnailUrl ?? file.webUrl;

    if (urlState.status === "loading") return <CenteredSpinner />;

    return (
      <div className="flex h-full items-center justify-center overflow-auto p-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={file.name}
          className="max-h-full max-w-full object-contain"
        />
      </div>
    );
  }

  if (kind === "pdf") {
    if (urlState.status === "loading") return <CenteredSpinner />;
    if (urlState.status !== "ready") {
      // No anonymous URL → an authenticated iframe to graph.microsoft.com
      // would fail anyway. Punt to "Open in browser".
      return <FallbackCard file={file} reason="PDF preview requires opening in Microsoft 365." />;
    }
    return (
      <iframe
        title={file.name}
        src={urlState.downloadUrl}
        className="h-full w-full border-0"
      />
    );
  }

  if (kind === "office") {
    // Office Online's public embed only works if the document URL is reachable
    // anonymously. Graph's `@microsoft.graph.downloadUrl` *is* anonymous for
    // its TTL — feed that when available, else fall back to webUrl (which will
    // most likely render Office Online's own "Sign in to view" page; let the
    // user see it rather than hiding the option entirely).
    const src =
      urlState.status === "ready"
        ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(
            urlState.downloadUrl
          )}`
        : `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(
            file.webUrl
          )}`;

    return (
      <iframe
        title={file.name}
        src={src}
        className="h-full w-full border-0 bg-white"
        // Office's embed needs scripts + same-origin for its viewer chrome.
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
      />
    );
  }

  if (kind === "text") {
    if (!file.itemId) {
      return (
        <FallbackCard
          file={file}
          reason="Text preview requires a OneDrive-backed file."
        />
      );
    }
    if (textState.status === "loading") return <CenteredSpinner />;
    if (textState.status === "error") {
      return <FallbackCard file={file} reason="Couldn't load file contents." />;
    }
    if (textState.status === "ready") {
      return (
        <div className="h-full overflow-auto">
          <pre className="m-0 whitespace-pre-wrap break-words p-3 font-mono text-[12px] leading-[1.5] text-[#d1d2d3]">
            {textState.body}
            {textState.truncated && (
              <span className="mt-2 block text-[11px] italic text-[var(--text-muted)]">
                — preview truncated at 256 KB. Open in browser for the full file.
              </span>
            )}
          </pre>
        </div>
      );
    }
    return null;
  }

  // unsupported
  return (
    <FallbackCard
      file={file}
      reason={`Preview not available for .${extOf(file.name) || "this"} files.`}
    />
  );
}

function CenteredSpinner() {
  return (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-[var(--text-muted)]" />
    </div>
  );
}

function FallbackCard({ file, reason }: { file: MSFilePreview; reason: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <FileX className="h-10 w-10 text-[var(--text-muted)]" />
      <p className="text-[13px] text-[var(--text-secondary)]">{reason}</p>
      <div className="flex flex-col items-stretch gap-2">
        <a
          href={file.webUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 rounded-md bg-[#0F5A8F] px-3 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#0d4f7d]"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Open in browser
        </a>
      </div>
    </div>
  );
}
