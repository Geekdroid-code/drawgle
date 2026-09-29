import { load, type CheerioAPI } from "cheerio";

import {
  MAX_STYLE_COMPONENT_HTML_CHARS,
  MAX_STYLE_COMPONENTS,
  styleComponentSchema,
} from "@/lib/generation/style-components";
import type { StyleComponent } from "@/lib/types";

/**
 * Reads a style reference's components out of a specimen: a recreate build whose reusable components
 * were marked with data-dg-component (see SPECIMEN_MARKING_INSTRUCTION). One instance is kept for each
 * name, cleaned of everything that is not construction, with its text cut to short samples and repeated
 * items trimmed, so that it fits the size a builder is given per component.
 */

export type ExtractedStyleComponents = {
  components: StyleComponent[];
  skipped: Array<{ name: string; reason: string }>;
};

const MAX_SAMPLE_TEXT = 24;
/** Attributes that identify or link a node rather than build it. Event handlers go too. */
const DROPPED_ATTRIBUTES = ["data-dg-component", "data-dg-use", "data-drawgle-id", "id", "src", "srcset", "href"];

/** The renderer draws the status bar and the shared navigation, so a screen never copies them. */
const RENDERER_OWNED = /(^|-)(bottom-nav|bottom-navigation|navigation-bar|nav-bar|navbar|tab-bar|tabbar|dock|status-bar|statusbar|home-indicator)(-|$)|^(nav|navigation)$/;

const kebab = (value: string | undefined) =>
  (value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);

/** A sample of the text: enough to show what kind of content goes here, not the specimen's own content. */
const sampleText = (value: string) => {
  const text = value.replace(/\s+/g, " ");
  const trimmed = text.trim();
  if (trimmed.length <= MAX_SAMPLE_TEXT) return text;
  const cut = trimmed.slice(0, MAX_SAMPLE_TEXT);
  if (trimmed[MAX_SAMPLE_TEXT] === " ") return cut;
  const space = cut.lastIndexOf(" ");
  return (space >= 8 ? cut.slice(0, space) : cut).replace(/[\s,.;:!?-]+$/, "");
};

/**
 * Items that repeat (rows, chips, days) show their pattern with a few instances: children of one element
 * that share a tag and a class are cut down to `keep` of them, so a pair stays a pair at keep 2.
 */
const trimRepeats = ($: CheerioAPI, root: ReturnType<CheerioAPI>, keep: number) => {
  root.find("*").addBack().each((_, element) => {
    const seen = new Map<string, number>();
    for (const child of $(element).children().toArray()) {
      const signature = `${child.tagName}|${$(child).attr("class") ?? ""}`;
      const count = (seen.get(signature) ?? 0) + 1;
      seen.set(signature, count);
      if (count > keep) $(child).remove();
    }
  });
};

const cleaned = ($: CheerioAPI, element: Parameters<CheerioAPI>[0]) => {
  const clone = $(element).clone();
  clone.find("script, style, noscript").remove();
  clone.find("*").addBack().each((_, node) => {
    const $node = $(node);
    for (const attribute of DROPPED_ATTRIBUTES) $node.removeAttr(attribute);
    for (const attribute of Object.keys($node.attr() ?? {})) {
      if (attribute.startsWith("on")) $node.removeAttr(attribute);
    }
  });
  clone.find("*").addBack().contents().each((_, node) => {
    if (node.type === "text") node.data = sampleText(node.data);
  });
  return clone;
};

const serialize = ($: CheerioAPI, clone: ReturnType<CheerioAPI>) =>
  $.html(clone).replace(/\s+/g, " ").replace(/>\s+</g, "><").trim();

export function extractStyleComponents(html: string): ExtractedStyleComponents {
  const $ = load(html, {}, false);
  const components: StyleComponent[] = [];
  const skipped: ExtractedStyleComponents["skipped"] = [];
  const seen = new Set<string>();

  $("[data-dg-component]").each((_, element) => {
    const marked = $(element).attr("data-dg-component");
    const name = kebab(marked);
    if (!name) {
      skipped.push({ name: marked?.trim() || "(unnamed)", reason: "the marker has no usable name" });
      return;
    }
    if (seen.has(name)) return;
    seen.add(name);
    if (RENDERER_OWNED.test(name) || element.type === "tag" && element.tagName === "nav") {
      skipped.push({ name, reason: "the status bar and the shared navigation are drawn by the renderer, not by screens" });
      return;
    }
    if (components.length >= MAX_STYLE_COMPONENTS) {
      skipped.push({ name, reason: `only the first ${MAX_STYLE_COMPONENTS} components are kept` });
      return;
    }

    const use = ($(element).attr("data-dg-use") ?? "").replace(/\s+/g, " ").trim().slice(0, 240)
      || `Use as the ${name.replace(/-/g, " ")}`;
    const clone = cleaned($, element);
    if (!clone.text().trim() && clone.find("*").length === 0) {
      skipped.push({ name, reason: "the marked element is empty" });
      return;
    }
    let markup = serialize($, clone);
    for (const keep of [2, 1]) {
      if (markup.length <= MAX_STYLE_COMPONENT_HTML_CHARS) break;
      trimRepeats($, clone, keep);
      markup = serialize($, clone);
    }
    if (markup.length > MAX_STYLE_COMPONENT_HTML_CHARS) {
      skipped.push({ name, reason: `too large to copy: ${markup.length} characters, over ${MAX_STYLE_COMPONENT_HTML_CHARS}, after trimming repeated items` });
      return;
    }
    const parsed = styleComponentSchema.safeParse({ name, use, html: markup });
    if (!parsed.success) {
      skipped.push({ name, reason: parsed.error.issues[0]?.message ?? "the component is not valid" });
      return;
    }
    components.push(parsed.data);
  });

  return { components, skipped };
}
