import { auth } from "@/lib/auth/config";
import { NextResponse } from "next/server";

type Params = Promise<{ itemId: string }>;

// Hard cap on body size we'll buffer & return. The panel only needs:
//   • text/code (256 KB inline render)
//   • small JSON
// PDFs and Office docs are embedded via iframe pointing at the anonymous
// @microsoft.graph.downloadUrl from /url, so they never hit this route. We
// still set a 10 MB ceiling so a stray large fetch can't OOM the function.
const MAX_BYTES = 10 * 1024 * 1024;

export async function GET(_req: Request, { params }: { params: Params }) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { itemId } = await params;
  if (!itemId) {
    return NextResponse.json({ error: "Missing itemId" }, { status: 400 });
  }

  try {
    // Stream the raw content directly from Graph. We use fetch() (not the SDK
    // client) because the SDK insists on parsing the body as JSON for /content
    // endpoints and binary/text passthrough is easier with raw fetch.
    const upstream = await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(itemId)}/content`,
      {
        headers: { Authorization: `Bearer ${session.accessToken}` },
        // Graph 302-redirects to a pre-signed URL; fetch follows redirects by
        // default which is what we want.
      }
    );

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream returned ${upstream.status}` },
        { status: 502 }
      );
    }

    const contentLengthHeader = upstream.headers.get("Content-Length");
    if (contentLengthHeader) {
      const declared = Number(contentLengthHeader);
      if (Number.isFinite(declared) && declared > MAX_BYTES) {
        return NextResponse.json(
          { error: "File too large to preview (10 MB cap)" },
          { status: 413 }
        );
      }
    }

    const contentType =
      upstream.headers.get("Content-Type") ?? "application/octet-stream";

    // Buffer the response so we can enforce MAX_BYTES even when the upstream
    // declared no Content-Length. ArrayBuffer is simpler than streaming for a
    // 10 MB cap.
    const buffer = await upstream.arrayBuffer();
    if (buffer.byteLength > MAX_BYTES) {
      return NextResponse.json(
        { error: "File too large to preview (10 MB cap)" },
        { status: 413 }
      );
    }

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        // Short cache — these are auth-gated and the URL is keyed on a Graph
        // itemId which is stable, so 5 minutes is fine and keeps repeated
        // panel opens snappy.
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (err) {
    console.error("[graph] preview content failed:", err);
    return NextResponse.json(
      { error: "Graph preview content failed" },
      { status: 502 }
    );
  }
}
