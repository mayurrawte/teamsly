import {
  Archive,
  File,
  FileText,
  FileSpreadsheet,
  Folder,
  Image,
  Video,
  Music,
  Presentation,
  type LucideIcon,
} from "lucide-react";

// Map file extension to a canonical mime-type prefix so the icon logic below
// can be shared between real mime-type strings and Teams "reference" attachments
// that only carry the filename (no mime type).
function mimeFromExtension(fileName: string): string | undefined {
  const ext = fileName.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "xlsx":
    case "xls":
    case "csv":
      return "application/vnd.ms-excel";
    case "docx":
    case "doc":
    case "txt":
    case "pdf":
    case "rtf":
      return "application/pdf"; // close enough — maps to FileText below
    case "pptx":
    case "ppt":
      return "application/vnd.ms-powerpoint";
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "webp":
    case "svg":
      return "image/png";
    case "mp4":
    case "mov":
    case "webm":
    case "mkv":
      return "video/mp4";
    case "mp3":
    case "wav":
    case "m4a":
    case "aac":
    case "flac":
      return "audio/mpeg";
    case "zip":
    case "tar":
    case "gz":
    case "7z":
    case "rar":
      return "application/zip";
    default:
      return undefined;
  }
}

export function getFileIcon(mimeType?: string, isFolder?: boolean, fileName?: string): LucideIcon {
  if (isFolder) return Folder;

  // Teams chat attachments with contentType "reference" don't carry a real mime
  // type — fall back to extension-based inference from the file name.
  const resolved =
    !mimeType || mimeType === "reference"
      ? (fileName ? mimeFromExtension(fileName) : undefined)
      : mimeType;

  if (!resolved) return File;
  if (
    resolved === "application/pdf" ||
    resolved === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    resolved === "application/msword"
  )
    return FileText;
  if (
    resolved === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    resolved === "application/vnd.ms-excel" ||
    resolved === "text/csv"
  )
    return FileSpreadsheet;
  if (
    resolved === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    resolved === "application/vnd.ms-powerpoint"
  )
    return Presentation;
  if (resolved === "application/zip") return Archive;
  if (resolved.startsWith("image/")) return Image;
  if (resolved.startsWith("video/")) return Video;
  if (resolved.startsWith("audio/")) return Music;
  return File;
}
