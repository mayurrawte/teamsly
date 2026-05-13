import { auth } from "@/lib/auth/config";
import { getGraphClient } from "@/lib/graph/client";
import { NextResponse } from "next/server";

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB — large-upload-session deferred
const RESERVED_CHARS = /[/\\:*?"<>|]/g;

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
    return NextResponse.json({ error: "File too large (4 MB max)" }, { status: 413 });
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
  const path = `/me/drive/root:/Apps/Teamsly/${encodeURIComponent(filename)}:/content`;

  try {
    const client = getGraphClient(session.accessToken);
    const item = (await client
      .api(path)
      .query({ "@microsoft.graph.conflictBehavior": "rename" })
      .header("Content-Type", contentType)
      .put(buffer)) as {
      id: string;
      name: string;
      webUrl: string;
      size: number;
      file?: { mimeType: string };
    };

    return NextResponse.json({
      id: item.id,
      name: item.name,
      webUrl: item.webUrl,
      size: item.size,
      mimeType: item.file?.mimeType ?? contentType,
    });
  } catch (err) {
    console.error("[graph] drive upload failed:", err);
    return NextResponse.json({ error: "Upload to OneDrive failed" }, { status: 502 });
  }
}
