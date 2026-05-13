import { auth } from "@/lib/auth/config";
import { NextResponse } from "next/server";

type Availability = "Available" | "Busy" | "DoNotDisturb" | "BeRightBack" | "Away" | "Offline";
type Activity = "Available" | "Busy" | "DoNotDisturb" | "BeRightBack" | "Away" | "OffWork";

interface SetPresenceBody {
  availability?: Availability;
  activity?: Activity;
  clear?: boolean;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as SetPresenceBody;

  const graphBase = "https://graph.microsoft.com/v1.0/me/presence";
  const headers = {
    Authorization: `Bearer ${session.accessToken}`,
    "Content-Type": "application/json",
  };

  try {
    if (body.clear) {
      const res = await fetch(`${graphBase}/clearUserPreferredPresence`, {
        method: "POST",
        headers,
      });
      if (!res.ok) {
        const text = await res.text();
        console.error("[graph] clearUserPreferredPresence failed:", text);
        return NextResponse.json({ error: "Graph clearUserPreferredPresence failed" }, { status: 502 });
      }
    } else {
      const res = await fetch(`${graphBase}/setUserPreferredPresence`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          availability: body.availability,
          activity: body.activity,
          expirationDuration: "PT1H",
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error("[graph] setUserPreferredPresence failed:", text);
        return NextResponse.json({ error: "Graph setUserPreferredPresence failed" }, { status: 502 });
      }
    }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("[graph] presence set failed:", err);
    return NextResponse.json({ error: "Graph presence set failed" }, { status: 502 });
  }
}
