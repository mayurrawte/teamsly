import { NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";

/**
 * Privacy-safe funnel counter: how many sign-ins die on the Entra consent wall
 * per day. No user data — just a daily counter (Redis when configured, else a
 * log line), so we can tell whether publisher verification / minimal scopes moved it.
 */
export async function POST() {
  const day = new Date().toISOString().slice(0, 10);
  const redis = getRedis();
  try {
    if (redis) {
      const key = `teamsly:consent-errors:${day}`;
      await redis.incr(key);
      await redis.expire(key, 60 * 60 * 24 * 90);
    } else {
      console.info(`[telemetry] consent error (${day})`);
    }
  } catch (err) {
    console.warn("[telemetry] consent-error counter failed:", err);
  }
  return new NextResponse(null, { status: 204 });
}
