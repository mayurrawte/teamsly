import { auth } from "@/lib/auth/config";
import { getGraphClient } from "@/lib/graph/client";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const client = getGraphClient(session.accessToken);
    const res = await client
      .api("/me/drive/recent")
      .query({
        $top: 50,
        $select: "id,name,size,lastModifiedDateTime,webUrl,file,folder,parentReference,remoteItem",
      })
      .get();

    return NextResponse.json({ items: res.value as MSDriveItem[] });
  } catch (err) {
    console.error("[graph] drive/recent failed:", err);
    return NextResponse.json({ error: "Graph drive/recent failed" }, { status: 502 });
  }
}
