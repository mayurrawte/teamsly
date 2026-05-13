import {
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

export function getFileIcon(mimeType?: string, isFolder?: boolean): LucideIcon {
  if (isFolder) return Folder;
  if (!mimeType) return File;
  if (mimeType === "application/pdf") return FileText;
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/msword"
  )
    return FileText;
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "application/vnd.ms-excel" ||
    mimeType === "text/csv"
  )
    return FileSpreadsheet;
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    mimeType === "application/vnd.ms-powerpoint"
  )
    return Presentation;
  if (mimeType.startsWith("image/")) return Image;
  if (mimeType.startsWith("video/")) return Video;
  if (mimeType.startsWith("audio/")) return Music;
  return File;
}
