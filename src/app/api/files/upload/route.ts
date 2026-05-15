import { auth } from "@/lib/auth/config";
import {
  GraphUploadError,
  getGraphClient,
  uploadLargeFileToOneDrive,
} from "@/lib/graph/client";
import { NextResponse } from "next/server";

// Graph's single-shot PUT is capped at 4 MiB. Above that we must use the
// resumable createUploadSession flow.
const SINGLE_SHOT_BYTES = 4 * 1024 * 1024;

// Hard client-visible cap. Graph itself accepts up to 250 GiB per upload
// session, but a Next.js route handler buffers the entire multipart body
// into memory before we see it, and Vercel serverless functions have
// per-invocation memory + duration limits (~1 GiB / 5 minutes on Hobby,
// configurable on Pro). 250 MiB is a comfortable headroom for the typical
// images, PDFs and short videos shared in chat without risking OOM.
const MAX_BYTES = 250 * 1024 * 1024;

const RESERVED_CHARS = /[/\\:*?"<>|]/g;

/**
 * Create an org-scoped view-only sharing link for the uploaded drive item so
 * chat recipients can open the file without needing access to the sender's
 * personal OneDrive. Falls back to null on error (caller uses item.webUrl).
 */
async function createOrgSharingLink(accessToken: string, itemId: string): Promise<string | null> {
  try {
    const client = getGraphClient(accessToken);
    const result = (await client
      .api(`/me/drive/items/${itemId}/createLink`)
      .post({ type: "view", scope: "organization" })) as {
      link?: { webUrl?: string };
    };
    return result?.link?.webUrl ?? null;
  } catch (err) {
    console.warn("[graph] createLink failed, falling back to item webUrl:", err);
    return null;
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart/form-data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file field" }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (250 MB max)" }, { status: 413 });
  }

  // Sanitize filename: strip OS-reserved chars, collapse to underscore
  const raw = file.name?.trim() ?? "";
  if (!raw || raw.length > 200) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }
  const filename = raw.replace(RESERVED_CHARS, "_");
  if (!filename) {
    return NextResponse.json({ error: "Invalid filename after sanitization" }, { status: 400 });
  }

  const buffer = await file.arrayBuffer();
  const contentType = file.type || "application/octet-stream";

  // Upload to user's OneDrive under Apps/Teamsly; Graph adds a suffix on name collision.
  const encodedPath = `/Apps/Teamsly/${encodeURIComponent(filename)}`;

  // Files ≤4 MiB take the cheap single-shot PUT; larger files use the
  // resumable upload session (5 MiB chunks).
  if (file.size <= SINGLE_SHOT_BYTES) {
    try {
      const client = getGraphClient(session.accessToken);
      const item = (await client
        .api(`/me/drive/root:${encodedPath}:/content`)
        .query({ "@microsoft.graph.conflictBehavior": "rename" })
        .header("Content-Type", contentType)
        .put(buffer)) as {
        id: string;
        name: string;
        webUrl: string;
        size: number;
        file?: { mimeType: string };
      };

      const shareUrl = await createOrgSharingLink(session.accessToken, item.id);
      return NextResponse.json({
        id: item.id,
        name: item.name,
        webUrl: shareUrl ?? item.webUrl,
        size: item.size,
        mimeType: item.file?.mimeType ?? contentType,
      });
    } catch (err) {
      console.error("[graph] drive upload failed:", err);
      return NextResponse.json({ error: "Upload to OneDrive failed" }, { status: 502 });
    }
  }

  // Chunked upload path for >4 MiB files.
  try {
    const item = await uploadLargeFileToOneDrive(
      session.accessToken,
      encodedPath,
      buffer,
      contentType
    );
    const shareUrl = await createOrgSharingLink(session.accessToken, item.id);
    return NextResponse.json({
      id: item.id,
      name: item.name,
      webUrl: shareUrl ?? item.webUrl,
      size: item.size,
      mimeType: item.file?.mimeType ?? contentType,
    });
  } catch (err) {
    console.error("[graph] chunked drive upload failed:", err);
    const status = err instanceof GraphUploadError ? 502 : 502;
    return NextResponse.json({ error: "Upload to OneDrive failed" }, { status });
  }
}
