import { auth } from "@/lib/auth/config";
import { NextResponse } from "next/server";

// Allowlist guards against SSRF — never proxy arbitrary URLs, only Microsoft
// domains that legitimately embed authenticated images in Teams messages.
const ALLOWED_HOSTS = [
  "graph.microsoft.com",
  /\.sharepoint\.com$/,
  /\.onmicrosoft\.com$/,
  /\.svc\.ms$/,
  /\.officeapps\.live\.com$/,
];

function isAllowedUrl(raw: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  const host = parsed.hostname.toLowerCase();
  return ALLOWED_HOSTS.some((entry) =>
    typeof entry === "string" ? host === entry : entry.test(host)
  );
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.accessToken) {
    return new NextResponse(null, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  if (!url || !isAllowedUrl(url)) {
    return NextResponse.json({ error: "Invalid or disallowed URL" }, { status: 400 });
  }

  try {
    const upstream = await fetch(url, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream returned ${upstream.status}` },
        { status: 502 }
      );
    }

    const contentType = upstream.headers.get("Content-Type") ?? "application/octet-stream";
    const buffer = await upstream.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  } catch (error) {
    console.error("[image-proxy] fetch error:", error);
    return NextResponse.json({ error: "Proxy fetch failed" }, { status: 502 });
  }
}
