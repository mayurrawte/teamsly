"use client";

import { ExternalLink } from "lucide-react";

// ---------------------------------------------------------------------------
// Adaptive Card schema types (1.4 subset we actually render)
// ---------------------------------------------------------------------------

interface ACTextBlock {
  type: "TextBlock";
  text?: string;
  size?: "small" | "default" | "medium" | "large" | "extraLarge";
  weight?: "lighter" | "default" | "bolder";
  color?: "default" | "accent" | "good" | "warning" | "attention" | "dark" | "light" | "subtle";
  wrap?: boolean;
  isSubtle?: boolean;
  id?: string;
}

interface ACImage {
  type: "Image";
  url?: string;
  altText?: string;
  size?: "small" | "medium" | "large" | "auto" | "stretch";
  width?: string;
  height?: string;
  id?: string;
}

interface ACContainer {
  type: "Container";
  items?: ACElement[];
  style?: "default" | "emphasis" | "good" | "attention" | "warning" | "accent";
  bleed?: boolean;
  id?: string;
}

interface ACColumnSet {
  type: "ColumnSet";
  columns?: ACColumn[];
  id?: string;
}

interface ACColumn {
  type: "Column";
  items?: ACElement[];
  width?: string | number;
  id?: string;
}

interface ACFactSet {
  type: "FactSet";
  facts?: Array<{ title?: string; value?: string }>;
  id?: string;
}

interface ACActionOpenUrl {
  type: "Action.OpenUrl";
  title?: string;
  url?: string;
}

interface ACActionOther {
  type: "Action.Submit" | "Action.ShowCard" | "Action.Execute" | string;
  title?: string;
}

type ACAction = ACActionOpenUrl | ACActionOther;

interface ACActionSet {
  type: "ActionSet";
  actions?: ACAction[];
  id?: string;
}

type ACElement =
  | ACTextBlock
  | ACImage
  | ACContainer
  | ACColumnSet
  | ACFactSet
  | ACActionSet
  | { type: string; [key: string]: unknown };

interface ACCardData {
  type?: string;
  version?: string;
  body?: ACElement[];
  actions?: ACAction[];
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Colour token map
// ---------------------------------------------------------------------------

const COLOR_MAP: Record<string, string> = {
  default: "var(--text-primary)",
  accent: "var(--accent)",
  good: "var(--status-online)",
  warning: "var(--status-away)",
  attention: "var(--status-busy)",
  dark: "#ffffff",
  light: "var(--text-muted)",
  subtle: "var(--text-secondary)",
};

const CONTAINER_STYLE_MAP: Record<string, string> = {
  default: "",
  emphasis: "bg-[#27292d] rounded-md px-3 py-2",
  good: "bg-[#1a2e24] border border-[#2bac76]/40 rounded-md px-3 py-2",
  attention: "bg-[#2e1a1e] border border-[#e01e5a]/40 rounded-md px-3 py-2",
  warning: "bg-[#2e2519] border border-[#e8a838]/40 rounded-md px-3 py-2",
  accent: "bg-[rgba(15,90,143,0.15)] border border-[#0F5A8F]/40 rounded-md px-3 py-2",
};

// ---------------------------------------------------------------------------
// Individual element renderers
// ---------------------------------------------------------------------------

function TextBlockEl({ el }: { el: ACTextBlock }) {
  if (!el.text && el.text !== "0") return null;

  const sizeClass =
    el.size === "small"
      ? "text-[11px]"
      : el.size === "medium"
        ? "text-[16px]"
        : el.size === "large"
          ? "text-[20px] font-semibold"
          : el.size === "extraLarge"
            ? "text-[26px] font-bold"
            : "text-[13px]";

  const weightClass =
    el.weight === "bolder"
      ? "font-bold"
      : el.weight === "lighter"
        ? "font-light"
        : "";

  const color = el.isSubtle
    ? "var(--text-muted)"
    : (el.color ? (COLOR_MAP[el.color] ?? "var(--text-primary)") : "var(--text-primary)");

  const wrapClass = el.wrap === false ? "truncate" : "break-words";

  return (
    <p
      className={`m-0 leading-snug ${sizeClass} ${weightClass} ${wrapClass}`}
      style={{ color }}
    >
      {el.text}
    </p>
  );
}

function ImageEl({ el }: { el: ACImage }) {
  if (!el.url) return null;

  const sizePx =
    el.size === "small"
      ? "40px"
      : el.size === "medium"
        ? "80px"
        : el.size === "large"
          ? "160px"
          : el.size === "stretch"
            ? "100%"
            : undefined;

  const style: React.CSSProperties = {
    display: "block",
    borderRadius: "4px",
    objectFit: "contain",
    maxWidth: "100%",
    width: el.width ?? sizePx,
    height: el.height,
  };

  return (
    <img
      src={el.url}
      alt={el.altText ?? ""}
      style={style}
    />
  );
}

function ContainerEl({ el }: { el: ACContainer }) {
  const styleClass = CONTAINER_STYLE_MAP[el.style ?? "default"] ?? "";
  return (
    <div className={styleClass}>
      <ElementList items={el.items ?? []} />
    </div>
  );
}

function ColumnSetEl({ el }: { el: ACColumnSet }) {
  const columns = el.columns ?? [];
  return (
    <div className="flex gap-3">
      {columns.map((col, i) => {
        const w = col.width;
        let flexStyle: React.CSSProperties = { flex: 1 };
        if (w === "auto") {
          flexStyle = { flexShrink: 0, flexGrow: 0 };
        } else if (w === "stretch") {
          flexStyle = { flex: 1 };
        } else if (typeof w === "string" && w.endsWith("px")) {
          flexStyle = { flexShrink: 0, flexGrow: 0, width: w };
        } else if (typeof w === "number") {
          flexStyle = { flex: w };
        } else if (typeof w === "string" && !isNaN(Number(w))) {
          flexStyle = { flex: Number(w) };
        }
        return (
          <div key={col.id ?? i} style={flexStyle} className="min-w-0">
            <ElementList items={col.items ?? []} />
          </div>
        );
      })}
    </div>
  );
}

function FactSetEl({ el }: { el: ACFactSet }) {
  const facts = el.facts ?? [];
  if (facts.length === 0) return null;
  return (
    <table className="w-full border-collapse text-[13px]">
      <tbody>
        {facts.map((fact, i) => (
          <tr key={i}>
            <td
              className="py-[2px] pr-3 align-top font-bold"
              style={{ color: "var(--text-primary)", whiteSpace: "nowrap" }}
            >
              {fact.title}
            </td>
            <td
              className="py-[2px] align-top break-words"
              style={{ color: "var(--text-secondary)" }}
            >
              {fact.value}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ActionSetEl({ el }: { el: ACActionSet }) {
  const actions = el.actions ?? [];
  if (actions.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 pt-1">
      {actions.map((action, i) => {
        if (action.type === "Action.OpenUrl") {
          const openUrl = action as ACActionOpenUrl;
          const href =
            openUrl.url && /^https?:\/\//i.test(openUrl.url) ? openUrl.url : undefined;
          if (href) {
            return (
              <a
                key={i}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded border border-[#0F5A8F] px-3 py-1.5 text-[12px] font-medium text-[#1d9bd1] transition-colors hover:bg-[rgba(15,90,143,0.15)]"
              >
                {action.title ?? "Open"}
                <ExternalLink size={11} />
              </a>
            );
          }
        }
        // Stubbed: Action.Submit / Action.ShowCard / Action.Execute / unknown
        return (
          <button
            key={i}
            type="button"
            disabled
            className="inline-flex cursor-not-allowed items-center rounded border border-[#3f4144] px-3 py-1.5 text-[12px] font-medium text-[#6c6f75] opacity-60"
          >
            {action.title ?? action.type}
          </button>
        );
      })}
    </div>
  );
}

function UnknownEl({ typeName }: { typeName: string }) {
  return (
    <span className="text-[11px] italic" style={{ color: "var(--text-muted)" }}>
      [unsupported: {typeName}]
    </span>
  );
}

// ---------------------------------------------------------------------------
// Recursive element dispatcher
// ---------------------------------------------------------------------------

function Element({ el }: { el: ACElement }) {
  switch (el.type) {
    case "TextBlock":
      return <TextBlockEl el={el as ACTextBlock} />;
    case "Image":
      return <ImageEl el={el as ACImage} />;
    case "Container":
      return <ContainerEl el={el as ACContainer} />;
    case "ColumnSet":
      return <ColumnSetEl el={el as ACColumnSet} />;
    case "FactSet":
      return <FactSetEl el={el as ACFactSet} />;
    case "ActionSet":
      return <ActionSetEl el={el as ACActionSet} />;
    default:
      return <UnknownEl typeName={el.type ?? "unknown"} />;
  }
}

function ElementList({ items }: { items: ACElement[] }) {
  return (
    <div className="flex flex-col gap-2">
      {items.map((el, i) => (
        <Element key={(el as { id?: string }).id ?? i} el={el} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Top-level AdaptiveCard component
// ---------------------------------------------------------------------------

interface AdaptiveCardProps {
  data: ACCardData;
}

export function AdaptiveCard({ data }: AdaptiveCardProps) {
  const body = data.body ?? [];
  // Top-level actions (attached directly to the card, not inside an ActionSet)
  const topActions = data.actions as ACAction[] | undefined;

  return (
    <div
      className="mt-2 max-w-[520px] rounded-md border border-[#3f4144] bg-[#1a1d21] px-4 py-3 text-[13px]"
      style={{ color: "var(--text-primary)" }}
    >
      <ElementList items={body} />
      {topActions && topActions.length > 0 && (
        <div className="mt-3 border-t border-[#3f4144] pt-3">
          <ActionSetEl el={{ type: "ActionSet", actions: topActions }} />
        </div>
      )}
    </div>
  );
}
