import { auth } from "@/lib/auth/config";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await auth();
  if (!session?.accessToken) {
    return new NextResponse(null, { status: 401 });
  }

  const { userId } = await params;
  const endpoint =
    userId === "me"
      ? "https://graph.microsoft.com/v1.0/me/photo/$value"
      : `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(userId)}/photo/$value`;

  try {
    const graphRes = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
    });

    if (graphRes.status === 404) {
      return new NextResponse(null, { status: 404 });
    }

    if (!graphRes.ok) {
      console.error(`[photo proxy] Graph returned ${graphRes.status} for userId=${userId}`);
      return NextResponse.json({ error: "Graph photo fetch failed" }, { status: 502 });
    }

    const buffer = await graphRes.arrayBuffer();
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  } catch (error) {
    console.error("[photo proxy] Unexpected error for userId=%s:", userId, error);
    return NextResponse.json({ error: "Internal error" }, { status: 502 });
  }
}
