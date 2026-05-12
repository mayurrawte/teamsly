"use client";

import { useState } from "react";
import parse, { domToReact, Element, type DOMNode, type HTMLReactParserOptions } from "html-react-parser";

type ContentType = MSMessage["body"]["contentType"];

const ALLOWED_INLINE_TAGS = new Set(["b", "strong", "i", "em", "s", "u", "span"]);

// Matches one or more consecutive <br> tags (with optional whitespace/attributes)
const MULTI_BR_RE = /(<br\s*\/?>(\s*<br\s*\/?>)+)/gi;

// Matches a block of consecutive lines starting with "- " or "* " that are NOT
// already inside a <ul> or <ol>. Used only on text segments outside existing list tags.
const MARKDOWN_LIST_BLOCK_RE = /(?:^|\n)((?:[ \t]*[-*] .+(?:\n|$))+)/g;

// Detects paragraphs whose trimmed text content is entirely emoji characters
const EMOJI_ONLY_RE = /^[\p{Emoji}\u{FE0F}\u{20E3}\u{200D}\s]+$/u;

function preprocessHtml(html: string): string {
  // Collapse runs of 2+ <br> down to a single <br>
  return html.replace(MULTI_BR_RE, "<br>");
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
