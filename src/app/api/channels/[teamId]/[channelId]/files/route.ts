import { auth } from "@/lib/auth/config";
import { getGraphClient } from "@/lib/graph/client";
import { NextResponse } from "next/server";

type Params = Promise<{ teamId: string; channelId: string }>;

export async function GET(_req: Request, { params }: { params: Params }) {
  const session = await auth();
  if (!session?.accessToken)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { teamId, channelId } = await params;
  const client = getGraphClient(session.accessToken);

  try {
    // Step 1: resolve the SharePoint folder backing this channel
    const folder = await client
      .api(`/teams/${teamId}/channels/${channelId}/filesFolder`)
      .get() as { id: string; parentReference?: { driveId?: string } };

    const driveId = folder.parentReference?.driveId;
    if (!driveId) {
      // Corrupted / non-standard channel — return empty list gracefully
      return NextResponse.json({ items: [] });
    }

    // Step 2: fetch children of the folder from the resolved drive
    const res = await client
      .api(`/drives/${driveId}/items/${folder.id}/children`)
      .top(100)
      .orderby("lastModifiedDateTime desc")
      .select("id,name,size,lastModifiedDateTime,webUrl,file,folder")
      .get() as { value: MSDriveItem[] };

    return NextResponse.json({ items: res.value });
  } catch {
    return NextResponse.json({ error: "Graph channel files failed" }, { status: 502 });
  }
}
