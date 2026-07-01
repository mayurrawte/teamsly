import { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { auth } from "@/lib/auth/config";

/**
 * Validates an MCP request and returns a Graph access token.
 *
 * Two auth paths:
 * 1. Bearer token — MCP clients (Claude Desktop, Cursor, etc.) send a user-scoped
 *    Graph access token obtained from /api/mcp/token. Validated against Graph /me,
 *    and (when AZURE_AD_CLIENT_ID is set) the token's app id is verified to match
 *    the Teamsly app so a token minted for some other app can't be replayed here.
 * 2. Session cookie — same-browser fallback (e.g. direct API calls from the web app).
 *
 * Both paths also require the x-mcp-secret header to match TEAMSLY_MCP_SECRET
 * (compared in constant time to avoid leaking the secret via response timing).
 */

/** Constant-time string comparison; false on any length mismatch. */
function secretsMatch(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Reads the `appid`/`azp` claim from a Graph JWT WITHOUT verifying its signature.
 * Only trustworthy after Graph has confirmed the token is genuine (the /me call
 * below) — at that point the claims are authentic and we can bind to our app id.
 */
function tokenAppId(jwt: string): string | null {
  try {
    const payload = jwt.split(".")[1];
    if (!payload) return null;
    const json = Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const claims = JSON.parse(json) as { appid?: string; azp?: string };
    return claims.appid ?? claims.azp ?? null;
  } catch {
    return null;
  }
}

export async function mcpAuth(req: NextRequest): Promise<string | null> {
  const secret = process.env.TEAMSLY_MCP_SECRET;
  if (!secret || !secretsMatch(req.headers.get("x-mcp-secret"), secret)) return null;

  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    let check: Response;
    try {
      check = await fetch("https://graph.microsoft.com/v1.0/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // Transient network/DNS failure reaching Graph — treat as unauthenticated
      // rather than throwing an opaque 500 out of the route.
      return null;
    }
    if (!check.ok) return null;

    // Token is genuine (Graph accepted it); bind it to the Teamsly app so a Graph
    // token issued to a different app registration can't be replayed against MCP.
    const expectedAppId = process.env.AZURE_AD_CLIENT_ID;
    if (expectedAppId && tokenAppId(token) !== expectedAppId) return null;

    return token;
  }

  const session = await auth();
  return session?.accessToken ?? null;
}
