import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/config";

/** Validates the MCP secret header and returns the Graph access token. */
export async function mcpAuth(req: NextRequest): Promise<string | null> {
  const secret = process.env.TEAMSLY_MCP_SECRET;
  if (!secret || req.headers.get("x-mcp-secret") !== secret) return null;
  const session = await auth();
  return session?.accessToken ?? null;
}
