"use client";

import { useState } from "react";
import parse, { domToReact, Element, type DOMNode, type HTMLReactParserOptions } from "html-react-parser";

type ContentType = MSMessage["body"]["contentType"];

// Hosts that serve authenticated Microsoft images embedded in Teams messages.
// The image proxy injects the access token; we rewrite <img src> to route through it.
const PROXY_HOST_PATTERNS = [
  "graph.microsoft.com",
  /\.sharepoint\.com$/,
  /\.onmicrosoft\.com$/,
  /\.svc\.ms$/,
  /\.officeapps\.live\.com$/,
];

function shouldProxy(src: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(src);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  const host = parsed.hostname.toLowerCase();
  return PROXY_HOST_PATTERNS.some((entry) =>
    typeof entry === "string" ? host === entry : entry.test(host)
  );
}

const ALLOWED_INLINE_TAGS = new Set(["b", "strong", "i", "em", "s", "u", "span"]);

// Matches one or more consecutive <br> tags (with optional whitespace/attributes)
const MULTI_BR_RE = /(<br\s*\/?>(\s*<br\s*\/?>)+)/gi;

// Matches a run of leading whitespace / non-breaking spaces (literal or entity)
// at the start of a block tag's content. Teams' composer often preserves these
// from copy/paste or from accidental space-before-Enter, which renders as a
// visible left indent on the second paragraph.
const LEADING_NBSP_RE = /(<(?:p|div|li)(?:\s[^>]*)?>)(?:&nbsp;|&#160;| |[ \t])+/gi;

// Also strip leading \u00a0 / whitespace runs that are one child-tag deep —
// e.g. <p><span style="...">  &nbsp; actual text</span></p> from Word/Teams paste.
const LEADING_NBSP_NESTED_RE = /(<(?:p|div|li)(?:\s[^>]*)?>(?:<[a-z][^>]*>)+)(?:&nbsp;|&#160;| |[ \t])+/gi;

// Strip text-indent and padding-left from inline style attrs on block-level tags;
// these come from Word/Outlook copy-paste paths through Teams and produce visible indent.
// Other style declarations on the same element are preserved.
function stripIndentStyles(html: string): string {
  return html.replace(
    /(<(?:p|div)[^>]*\bstyle=")([^"]*?)("[^>]*>)/gi,
    (_m, open, styleVal, close) => {
      const cleaned = styleVal
        .split(';')
        .filter((decl: string) => {
          const prop = decl.split(':')[0]?.trim().toLowerCase() ?? '';
          return prop !== 'text-indent' && prop !== 'padding-left' && decl.trim() !== '';
        })
        .join(';');
      return `${open}${cleaned}${close}`;
    }
  );
}


// Matches paragraphs whose only content is &nbsp; / &#160; / U+00A0 runs.
// CSS `p:empty` and `p:has(> br:only-child)` don't catch these.
const NBSP_ONLY_P_RE = /<p(?:\s[^>]*)?>(?:&nbsp;|&#160;| |\s|<br\s*\/?>)*<\/p>/gi;

// Matches a block of consecutive lines starting with "- " or "* " that are NOT
// already inside a <ul> or <ol>. Used only on text segments outside existing list tags.
const MARKDOWN_LIST_BLOCK_RE = /(?:^|\n)((?:[ \t]*[-*] .+(?:\n|$))+)/g;

// Detects paragraphs whose trimmed text content is entirely emoji characters
const EMOJI_ONLY_RE = /^[\p{Emoji}\u{FE0F}\u{20E3}\u{200D}\s]+$/u;

function preprocessHtml(html: string): string {
  return stripIndentStyles(html)
    // Collapse runs of 2+ <br> down to a single <br>
    .replace(MULTI_BR_RE, "<br>")
    // Drop paragraphs that only contain &nbsp; / whitespace / <br>
    .replace(NBSP_ONLY_P_RE, "")
    // Strip leading &nbsp; / U+00A0 runs after <p>/<div>/<li> openers
    .replace(LEADING_NBSP_RE, "$1")
    // Strip leading whitespace inside a first child tag (Word/Outlook copy-paste path)
    .replace(LEADING_NBSP_NESTED_RE, "$1");
}

function convertMarkdownLists(text: string): string {
  // Convert runs of markdown-style "- item" / "* item" lines into <ul><li> HTML.
  // Only applied to plain-text content (contentType === "text"), so no risk of
  // double-converting real HTML lists.
  return text.replace(MARKDOWN_LIST_BLOCK_RE, (_match, block) => {
    const items = block
      .split("\n")
      .filter((line: string) => /^\s*[-*] /.test(line))
      .map((line: string) => `<li>${line.replace(/^\s*[-*] /, "")}</li>`)
      .join("");
    return `\n<ul>${items}</ul>\n`;
  });
}

export function renderMessageBody(content: string, contentType: ContentType): React.ReactNode {
  if (contentType !== "html") {
    const withLists = convertMarkdownLists(content);
    // If the preprocessing produced any HTML tags, parse the result; otherwise
    // fall back to the plain-text mention renderer.
    if (/<[a-z][\s\S]*>/i.test(withLists)) {
      return renderHtml(withLists);
    }
    return renderTextWithMentions(content);
  }

  return renderHtml(preprocessHtml(content));
}

function renderHtml(html: string): React.ReactNode {
  const options: HTMLReactParserOptions = {
    replace: (node) => {
      if (!(node instanceof Element)) return undefined;

      if (node.name === "script" || node.name === "style") return <></>;
      // Teams emits <attachment id="..."> placeholders inside the body where a
      // quoted reply / card was anchored. The actual content lives in
      // message.attachments and is rendered separately, so suppress the
      // placeholder to avoid an empty fragment introducing vertical space.
      if (node.name === "attachment") return <></>;
      if (node.name === "at") return <Mention name={getText(node)} />;
      if (node.name === "a") {
        const href = safeHref(node.attribs.href);
        return (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#1d9bd1] hover:underline">
            {domToReact(node.children as DOMNode[], options)}
          </a>
        );
      }
      if (node.name === "br") return <br />;
      if (node.name === "img") {
        const src = node.attribs.src;
        if (!src || !src.startsWith("https://")) return <>[image]</>;
        const imgSrc = shouldProxy(src)
          ? `/api/image-proxy?url=${encodeURIComponent(src)}`
          : src;
        return (
          <img
            src={imgSrc}
            alt={node.attribs.alt || ""}
            className="max-h-[180px] max-w-[300px] rounded"
            loading="lazy"
          />
        );
      }
      if (node.name === "p") {
        const text = getText(node).trim();
        const isEmojiOnly = text.length > 0 && EMOJI_ONLY_RE.test(text);
        return (
          <p className={isEmojiOnly ? "emoji-only" : undefined}>
            {domToReact(node.children as DOMNode[], options)}
          </p>
        );
      }
      if (node.name === "pre") return <CodeBlock code={getText(node)} />;
      if (node.name === "code") {
        return (
          <code className="rounded border border-[#3f4144] bg-[#1a1d21] px-1 py-[1px] font-mono text-[12px] text-[#e8912d]">
            {domToReact(node.children as DOMNode[], options)}
          </code>
        );
      }
      if (node.name === "blockquote") {
        return (
          <blockquote className="border-l-4 border-[#565856] pl-3 text-[#ababad]">
            {domToReact(node.children as DOMNode[], options)}
          </blockquote>
        );
      }
      if (node.name === "ul") return <ul>{domToReact(node.children as DOMNode[], options)}</ul>;
      if (node.name === "ol") return <ol>{domToReact(node.children as DOMNode[], options)}</ol>;
      if (node.name === "li") return <li>{domToReact(node.children as DOMNode[], options)}</li>;
      if (ALLOWED_INLINE_TAGS.has(node.name)) return undefined;

      return <>{domToReact(node.children as DOMNode[], options)}</>;
    },
  };

  return parse(html, options);
}

export function messagePlainText(content: string, contentType: ContentType): string {
  if (contentType !== "html") return content;
  return content.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

// Escapes plain text for Graph's contentType:"html" payload — newlines become
// <br> and the three HTML special characters are entity-encoded.
export function textToHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}

function Mention({ name }: { name: string }) {
  return (
    <span className="rounded-[3px] bg-[rgba(205,37,83,0.15)] px-[2px] text-[#cd2553]">
      {name}
    </span>
  );
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard?.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <pre className="group/code relative my-2 overflow-x-auto rounded-md border border-[#3f4144] bg-[#1a1d21] px-3 py-2 font-mono text-[12px] leading-[1.45] text-[#d1d2d3]">
      <button
        type="button"
        onClick={copy}
        className="absolute right-2 top-2 rounded border border-[#3f4144] bg-[#222529] px-2 py-1 text-[11px] font-bold text-[#ababad] opacity-0 transition-opacity duration-150 hover:text-white group-hover/code:opacity-100"
      >
        {copied ? "Copied" : "Copy"}
      </button>
      <code>{code}</code>
    </pre>
  );
}

function renderTextWithMentions(text: string): React.ReactNode {
  const parts = text.split(/(@(?:here|channel|everyone|[A-Za-z][\w.-]*))/g);
  return parts.map((part, index) => {
    if (!part) return null;
    if (part.startsWith("@")) return <Mention key={`${part}-${index}`} name={part} />;
    return part;
  });
}

function safeHref(href?: string): string {
  if (!href) return "#";
  if (/^(https?:|mailto:)/i.test(href)) return href;
  return "#";
}

function getText(node: Element): string {
  return node.children
    .map((child) => {
      if ("data" in child && typeof child.data === "string") return child.data;
      if (child instanceof Element) return getText(child);
      return "";
    })
    .join("");
}
