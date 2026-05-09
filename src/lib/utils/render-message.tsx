"use client";

import { useState } from "react";
import parse, { domToReact, Element, type DOMNode, type HTMLReactParserOptions } from "html-react-parser";

type ContentType = MSMessage["body"]["contentType"];

const ALLOWED_INLINE_TAGS = new Set(["b", "strong", "i", "em", "s", "u", "span"]);

export function renderMessageBody(content: string, contentType: ContentType): React.ReactNode {
  if (contentType !== "html") return renderTextWithMentions(content);

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
      if (node.name === "p") return <p>{domToReact(node.children as DOMNode[], options)}</p>;
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
      if (node.name === "ul") return <ul className="ml-5 list-disc">{domToReact(node.children as DOMNode[], options)}</ul>;
      if (node.name === "ol") return <ol className="ml-5 list-decimal">{domToReact(node.children as DOMNode[], options)}</ol>;
      if (node.name === "li") return <li>{domToReact(node.children as DOMNode[], options)}</li>;
      if (ALLOWED_INLINE_TAGS.has(node.name)) return undefined;

      return <>{domToReact(node.children as DOMNode[], options)}</>;
    },
  };

  return parse(content, options);
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
