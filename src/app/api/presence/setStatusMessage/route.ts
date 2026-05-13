import { auth } from "@/lib/auth/config";
import { NextResponse } from "next/server";

interface SetStatusMessageBody {
  message?: string;
  expiryISO?: string;
  clear?: boolean;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as SetStatusMessageBody;

  const headers = {
    Authorization: `Bearer ${session.accessToken}`,
    "Content-Type": "application/json",
  };

  let graphBody: unknown;

  if (body.clear) {
    graphBody = { statusMessage: { message: null } };
  } else {
    const trimmed = (body.message ?? "").trim();
    if (!trimmed) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }
    if (trimmed.length > 280) {
      return NextResponse.json({ error: "message exceeds 280 characters" }, { status: 400 });
    }

    const statusMessage: Record<string, unknown> = {
      message: { content: trimmed, contentType: "text" },
    };

    if (body.expiryISO) {
      // Strip trailing Z — Graph expects local-style datetime string with a separate timeZone field
      const dateTime = body.expiryISO.replace(/Z$/, "").replace(/\.\d+$/, "");
      statusMessage.expiryDateTime = { dateTime, timeZone: "UTC" };
    }

    graphBody = { statusMessage };
  }

  try {
    const res = await fetch(
      "https://graph.microsoft.com/v1.0/me/presence/setStatusMessage",
      {
        method: "POST",
        headers,
        body: JSON.stringify(graphBody),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      console.error("[graph] setStatusMessage failed:", text);
      return NextResponse.json({ error: "Graph setStatusMessage failed" }, { status: 502 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("[graph] setStatusMessage failed:", err);
    return NextResponse.json({ error: "Graph setStatusMessage failed" }, { status: 502 });
  }
}
