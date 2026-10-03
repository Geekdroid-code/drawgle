import { findDrawgleElement, type DeterministicEditOperation } from "@/lib/drawgle-dom";
import type { DesignTokens } from "@/lib/types";

/**
 * Generation saving the design system or navigation: "Created" when there was none before, which is where that
 * history starts (the database marks the same entries; supabase/migrations/20261003120000_history_starting_points.sql).
 */
export const designSystemSaveLabel = (before: DesignTokens | null | undefined) =>
  before?.tokens && Object.keys(before.tokens).length > 0 ? "Updated the design system" : "Created the design system";
export const navigationSaveLabel = (beforeShellCode: string | null | undefined) =>
  beforeShellCode?.trim() ? "Updated the navigation" : "Created the navigation";

/**
 * Names a saved element edit in Recent changes by what changed and where: "Restyled “Sign Out”", "Changed text to
 * “Wishlist”", "Deleted image", rather than five identical "Edited element" rows. The same edit always gets the same
 * name, which a retried save relies on.
 */

const KINDS: Record<string, string> = {
  img: "image", picture: "image", svg: "icon", i: "icon", button: "button", a: "link", input: "field", textarea: "field",
  select: "menu", h1: "heading", h2: "heading", h3: "heading", h4: "heading", h5: "heading", h6: "heading", p: "text",
  span: "text", label: "label", nav: "navigation", ul: "list", ol: "list", li: "list item", section: "section",
  header: "header", footer: "footer",
};
const STYLE_EDITS = new Set<DeterministicEditOperation["type"]>(["setStyle", "clearStyle", "setClassUtility", "removeClassUtility", "replaceClassList"]);

const decode = (text: string) => text
  .replace(/&nbsp;/g, " ").replace(/&quot;/g, "\"").replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const quoted = (text: string) => `“${text.length > 28 ? `${text.slice(0, 27).trimEnd()}…` : text}”`;

/** What a person would call the element: its words, else its label, else its kind. */
function elementName(code: string, drawgleId: string) {
  const element = findDrawgleElement(code, drawgleId);
  if (!element) return "element";
  const words = decode(code.slice(element.startOffset, element.endOffset)
    .replace(/<(style|script)\b[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
  if (words) return quoted(words);
  const label = /\s(?:aria-label|alt|title)\s*=\s*"([^"]+)"/i.exec(code.slice(element.startOffset, element.openEndOffset))?.[1]?.trim();
  return label ? quoted(decode(label)) : KINDS[element.tagName] ?? "element";
}

export function describeElementEdit(code: string, drawgleId: string, operations: DeterministicEditOperation[], where: "screen" | "navigation" = "screen") {
  const name = elementName(code, drawgleId);
  const kinds = new Set(operations.map((operation) => operation.type));
  const texts = operations.flatMap((operation) => operation.type === "replaceText" ? [operation.text.replace(/\s+/g, " ").trim()] : []);
  const label = kinds.has("deleteElement") ? `Deleted ${name}`
    : kinds.has("duplicateElement") ? `Duplicated ${name}`
    : kinds.size === 1 && texts.length === 1 ? texts[0] ? `Changed text to ${quoted(texts[0])}` : `Cleared the text of ${name}`
    : kinds.size === 1 && texts.length > 1 ? `Changed text in ${name}`
    : kinds.size === 1 && kinds.has("replaceImage") ? "Replaced image"
    : [...kinds].every((kind) => STYLE_EDITS.has(kind)) ? `Restyled ${name}`
    : `Edited ${name}`;
  return where === "navigation" ? `${label} in navigation` : label;
}
