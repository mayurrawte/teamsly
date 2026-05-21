import { auth } from "@/lib/auth/config";
import { getGraphClient } from "@/lib/graph/client";
import { NextResponse } from "next/server";

const SELECT_FIELDS = [
  "subject",
  "start",
  "end",
  "showAs",
  "categories",
  "attendees",
].join(",");

interface CalendarEvent {
  subject?: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  showAs?: string;
  categories?: string[];
  attendees?: unknown[];
}

export async function GET() {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const windowEnd = new Date(now.getTime() + 8 * 60 * 60_000);

  try {
    const client = getGraphClient(session.accessToken);
    const res = await client
      .api("/me/calendarView")
      .query({
        startDateTime: now.toISOString(),
        endDateTime: windowEnd.toISOString(),
        $top: 10,
        $orderby: "start/dateTime",
        $select: SELECT_FIELDS,
      })
      .get();

    const events: CalendarEvent[] = res.value ?? [];

    for (const event of events) {
      const startMs = new Date(event.start.dateTime + "Z").getTime();
      const endMs = new Date(event.end.dateTime + "Z").getTime();
      const nowMs = now.getTime();

      if (nowMs < startMs || nowMs >= endMs) continue;

      const categories = event.categories ?? [];
      const isOOO =
        event.showAs === "oof" ||
        categories.some((c) => c.toLowerCase().includes("out of office"));

      if (isOOO) {
        return NextResponse.json({
          presence: "Away",
          message: "Out of office",
          source: "ooo",
          expiresAt: event.end.dateTime + "Z",
        });
      }

      const isMeeting =
        event.showAs === "busy" &&
        Array.isArray(event.attendees) &&
        event.attendees.length > 0;

      if (isMeeting) {
        return NextResponse.json({
          presence: "Busy",
          message: "In a meeting",
          source: "meeting",
          expiresAt: event.end.dateTime + "Z",
        });
      }

      const isFocus =
        (event.showAs === "free" && categories.some((c) => c.toLowerCase().includes("focus"))) ||
        /focus|heads.?down|deep work/i.test(event.subject ?? "");

      if (isFocus) {
        return NextResponse.json({
          presence: "DoNotDisturb",
          message: "Heads-down",
          source: "focus",
          expiresAt: event.end.dateTime + "Z",
        });
      }
    }

    return NextResponse.json({
      presence: null,
      message: null,
      source: "none",
      expiresAt: null,
    });
  } catch (err) {
    console.error("[graph] calendar auto-status failed:", err);
    return NextResponse.json(
      { presence: null, message: null, source: "none", expiresAt: null },
      { status: 502 }
    );
  }
}
