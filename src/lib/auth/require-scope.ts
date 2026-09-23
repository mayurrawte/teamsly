import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { hasScopes } from "./scopes";

/**
 * For API routes behind incremental consent: returns a 403 the client recognises
 * (`error: "scope_required"`) when the session lacks the Graph scopes the route
 * needs, so the UI can offer the consent step instead of surfacing a Graph 403.
 */
export function requireScopes(session: Session | null, needed: string[]): NextResponse | null {
  if (!session?.accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasScopes(session.scopes, needed)) {
    return NextResponse.json({ error: "scope_required", scopes: needed }, { status: 403 });
  }
  return null;
}
