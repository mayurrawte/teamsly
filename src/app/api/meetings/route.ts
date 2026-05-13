import { auth } from "@/lib/auth/config";
import { getGraphClient } from "@/lib/graph/client";
import { NextRequest, NextResponse } from "next/server";

const SELECT_FIELDS = [
  "id",
  "subject",
  "bodyPreview",
  "start",
  "end",
  "location",
  "onlineMeeting",
  "organizer",
  "attendees",
  "isAllDay",
  "isCancelled",
  "isOnlineMeeting",
  "webLink",
].join(",");

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const now = new Date();
  const defaultEnd = new Date(now);
  defaultEnd.setDate(defaultEnd.getDate() + 14);

  const startParam = searchParams.get("start") ?? now.toISOString();
  const endParam = searchParams.get("end") ?? defaultEnd.toISOString();

  try {
    const client = getGraphClient(session.accessToken);
    const res = await client
      .api("/me/calendarView")
      .query({
        startDateTime: startParam,
        endDateTime: endParam,
        $top: 50,
        $orderby: "start/dateTime",
        $select: SELECT_FIELDS,
      })
      .get();

    return NextResponse.json({ items: res.value as MSCalendarEvent[] });
  } catch (err) {
    console.error("[graph] calendarView failed:", err);
    return NextResponse.json({ error: "Graph calendarView failed" }, { status: 502 });
  }
}
