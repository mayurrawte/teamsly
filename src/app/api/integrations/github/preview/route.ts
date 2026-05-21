import { auth } from "@/lib/auth/config";
import { NextRequest, NextResponse } from "next/server";

export interface GitHubPreview {
  kind: "pr" | "issue";
  owner: string;
  repo: string;
  number: number;
  title: string;
  state: "open" | "closed" | "merged" | "draft";
  authorLogin: string;
  authorAvatar: string;
  commentCount: number;
  bodyExcerpt: string;
  htmlUrl: string;
  updatedAt: string;
}

type CacheEntry = { data: GitHubPreview | { kind: "not_found" } | { kind: "rate_limited" }; expiresAt: number };
const cache = new Map<string, CacheEntry>();

const GITHUB_URL_RE = /^https?:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/(pull|issues)\/(\d+)/;

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = request.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "Missing url" }, { status: 400 });

  const match = GITHUB_URL_RE.exec(decodeURIComponent(url));
  if (!match) return NextResponse.json({ error: "Not a GitHub PR/issue URL" }, { status: 400 });

  const [, owner, repo, type, numberStr] = match;
  const number = Number(numberStr);
  const cacheKey = `${owner}/${repo}/${type}/${number}`;

  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.data, {
      headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=600" },
    });
  }

  const apiPath = type === "pull"
    ? `https://api.github.com/repos/${owner}/${repo}/pulls/${number}`
    : `https://api.github.com/repos/${owner}/${repo}/issues/${number}`;

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "Teamsly/1.0",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  let ghRes: Response;
  try {
    ghRes = await fetch(apiPath, { headers });
  } catch {
    return NextResponse.json({ error: "Upstream fetch failed" }, { status: 502 });
  }

  if (ghRes.status === 404) {
    const entry: CacheEntry = { data: { kind: "not_found" }, expiresAt: Date.now() + 5 * 60 * 1000 };
    cache.set(cacheKey, entry);
    return NextResponse.json(entry.data, {
      headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=600" },
    });
  }

  if (ghRes.status === 403 || ghRes.status === 429) {
    const entry: CacheEntry = { data: { kind: "rate_limited" }, expiresAt: Date.now() + 60 * 1000 };
    cache.set(cacheKey, entry);
    return NextResponse.json(entry.data, {
      headers: { "Cache-Control": "private, max-age=60" },
    });
  }

  if (!ghRes.ok) {
    return NextResponse.json({ error: "GitHub API error" }, { status: 502 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw: any = await ghRes.json();

  let state: GitHubPreview["state"];
  if (type === "pull") {
    if (raw.state === "open" && raw.draft) state = "draft";
    else if (raw.state === "closed" && raw.merged_at) state = "merged";
    else state = raw.state;
  } else {
    state = raw.state === "closed" ? "closed" : "open";
  }

  const bodyRaw: string = raw.body ?? "";
  const bodyExcerpt = bodyRaw.replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);

  const preview: GitHubPreview = {
    kind: type === "pull" ? "pr" : "issue",
    owner,
    repo,
    number,
    title: raw.title ?? "",
    state,
    authorLogin: raw.user?.login ?? "",
    authorAvatar: raw.user?.avatar_url ?? "",
    commentCount: raw.comments ?? 0,
    bodyExcerpt,
    htmlUrl: raw.html_url ?? `https://github.com/${owner}/${repo}/${type}/${number}`,
    updatedAt: raw.updated_at ?? "",
  };

  cache.set(cacheKey, { data: preview, expiresAt: Date.now() + 5 * 60 * 1000 });

  return NextResponse.json(preview, {
    headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=600" },
  });
}
