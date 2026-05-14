import { auth } from "@/lib/auth/config";
import { getGraphClient } from "@/lib/graph/client";
import { NextResponse } from "next/server";

type Params = Promise<{ itemId: string }>;

// Returns Graph's anonymous-readable `@microsoft.graph.downloadUrl` for a
// driveItem. Used by FilePreviewPanel so it can:
//   • iframe-embed PDFs directly (anonymous URL keeps iframe-src happy)
//   • hand the URL to Office Online's embed.aspx viewer
//   • offer a clean Download button
//
// The URL is short-lived (Microsoft says ~1h). The panel re-fetches per open
// so we don't need to cache or refresh it from the client.
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
    const client = getGraphClient(session.accessToken);
    // `@microsoft.graph.downloadUrl` is a top-level property; we need to select
    // it explicitly so Graph populates it on the response.
    const item = (await client
      .api(`/me/drive/items/${encodeURIComponent(itemId)}`)
      .select("id,name,size,file,@microsoft.graph.downloadUrl")
      .get()) as {
      id: string;
      name?: string;
      size?: number;
      file?: { mimeType?: string };
      "@microsoft.graph.downloadUrl"?: string;
    };

    const downloadUrl = item["@microsoft.graph.downloadUrl"];
    if (!downloadUrl) {
      return NextResponse.json(
        { error: "No download URL available for this item" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      downloadUrl,
      name: item.name,
      size: item.size,
      mimeType: item.file?.mimeType,
    });
  } catch (err) {
    console.error("[graph] preview url failed:", err);
    return NextResponse.json({ error: "Graph preview url failed" }, { status: 502 });
  }
}
