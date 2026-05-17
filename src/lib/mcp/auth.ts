import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/config";

/**
 * Validates an MCP request and returns a Graph access token.
 *
 * Two auth paths:
 * 1. Bearer token — MCP clients (Claude Desktop, Cursor, etc.) send a user-scoped
 *    Graph access token obtained from /api/mcp/token. Validated against Graph /me.
 * 2. Session cookie — same-browser fallback (e.g. direct API calls from the web app).
 *
 * Both paths also require the x-mcp-secret header to match TEAMSLY_MCP_SECRET.
 */
export async function mcpAuth(req: NextRequest): Promise<string | null> {
  const secret = process.env.TEAMSLY_MCP_SECRET;
  if (!secret || req.headers.get("x-mcp-secret") !== secret) return null;

  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const check = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    return check.ok ? token : null;
  }

  const session = await auth();
  return session?.accessToken ?? null;
}
