const GITHUB_URL_RE = /https?:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/(pull|issues)\/(\d+)/g;

export interface DetectedGitHubLink {
  url: string;
  owner: string;
  repo: string;
  kind: "pull" | "issues";
  number: number;
}

export function detectGitHubLinks(text: string): DetectedGitHubLink[] {
  const seen = new Set<string>();
  const results: DetectedGitHubLink[] = [];
  let match: RegExpExecArray | null;
  GITHUB_URL_RE.lastIndex = 0;

  while ((match = GITHUB_URL_RE.exec(text)) !== null) {
    const [url, owner, repo, kind, numberStr] = match;
    if (seen.has(url)) continue;
    seen.add(url);
    results.push({ url, owner, repo, kind: kind as "pull" | "issues", number: Number(numberStr) });
    if (results.length >= 3) break;
  }

  return results;
}
