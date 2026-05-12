/**
 * Converts a minimal markdown-subset string to HTML for the Microsoft Graph
 * sendMessage API (contentType: "html").
 *
 * Supported patterns:
 *   **text**          → <strong>text</strong>
 *   *text*            → <em>text</em>
 *   ~~text~~          → <s>text</s>
 *   <u>text</u>       → passthrough
 *   `code`            → <code>code</code>
 *   ```…```           → <pre><code>…</code></pre>
 *   [label](url)      → <a href="url">label</a>
 *   Lines starting with "- " → <ul><li>…</li></ul>
 *   Lines starting with "N. " → <ol><li>…</li></ol>
 *   Plain newlines    → <br>
 *
 * Only these patterns are transformed. No full Markdown parser is introduced.
 */
export function markdownToHtml(input: string): string {
  // Split on fenced code blocks first so we don't transform inside them.
  const segments = splitOnCodeBlocks(input);

  const processedSegments = segments.map((seg) => {
    if (seg.type === "code") {
      // Preserve content as-is inside <pre><code>, only escape HTML entities.
      return `<pre><code>${escapeHtml(seg.content)}</code></pre>`;
    }
    return processInlineAndBlocks(seg.content);
  });

  return processedSegments.join("");
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface Segment {
  type: "text" | "code";
  content: string;
}

function splitOnCodeBlocks(input: string): Segment[] {
  const segments: Segment[] = [];
  // Match triple-backtick fenced blocks: ```[lang]\n...\n```
  const fenceRe = /```([^\n]*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = fenceRe.exec(input)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", content: input.slice(lastIndex, match.index) });
    }
    // match[2] is the inner content
    segments.push({ type: "code", content: match[2] });
    lastIndex = fenceRe.lastIndex;
  }

  if (lastIndex < input.length) {
    segments.push({ type: "text", content: input.slice(lastIndex) });
  }

  return segments;
}

function processInlineAndBlocks(text: string): string {
  // Process line-by-line for list detection.
  const lines = text.split("\n");
  const outputParts: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Unordered list: lines starting with "- "
    if (/^- /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^- /.test(lines[i])) {
        items.push(`<li>${applyInline(lines[i].slice(2))}</li>`);
        i++;
      }
      outputParts.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    // Ordered list: lines starting with a number followed by ". "
    if (/^\d+\. /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        const content = lines[i].replace(/^\d+\. /, "");
        items.push(`<li>${applyInline(content)}</li>`);
        i++;
      }
      outputParts.push(`<ol>${items.join("")}</ol>`);
      continue;
    }

    // Empty line → paragraph break (two <br> looks cleaner in Teams)
    if (line === "") {
      outputParts.push("<br>");
      i++;
      continue;
    }

    // Regular line
    outputParts.push(applyInline(line));
    i++;
  }

  // Join non-list lines with <br>; list blocks are already self-contained.
  // We join all parts but insert <br> only between adjacent plain-text parts.
  return joinParts(outputParts);
}

/**
 * Joins output parts, inserting <br> between consecutive non-block pieces.
 */
function joinParts(parts: string[]): string {
  if (parts.length === 0) return "";

  const blockPattern = /^<(?:ul|ol|pre|br)/;
  let result = "";

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const prev = parts[i - 1] ?? "";

    if (
      i > 0 &&
      !blockPattern.test(part) &&
      !blockPattern.test(prev) &&
      prev !== "<br>"
    ) {
      result += "<br>";
    }

    result += part;
  }

  return result;
}

/**
 * Applies inline transformations (bold, italic, etc.) to a single line.
 * Order matters: process bold (**) before italic (*).
 */
function applyInline(text: string): string {
  // Inline code – extract first to avoid mangling backtick content
  const codeSlots: string[] = [];
  let processed = text.replace(/`([^`]+)`/g, (_, inner) => {
    const idx = codeSlots.push(`<code>${escapeHtml(inner)}</code>`) - 1;
    return `\x00CODE${idx}\x00`;
  });

  // Bold **text**
  processed = processed.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // Italic *text* (must come after bold so ** is already consumed)
  processed = processed.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // Strikethrough ~~text~~
  processed = processed.replace(/~~(.+?)~~/g, "<s>$1</s>");

  // Links [label](url)
  processed = processed.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
    const safeLabel = escapeHtml(label);
    const safeUrl = encodeURI(url);
    return `<a href="${safeUrl}">${safeLabel}</a>`;
  });

  // Restore inline code
  processed = processed.replace(/\x00CODE(\d+)\x00/g, (_, idx) => codeSlots[Number(idx)]);

  // <u>...</u> is already valid HTML – passthrough (no change needed)

  return processed;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
