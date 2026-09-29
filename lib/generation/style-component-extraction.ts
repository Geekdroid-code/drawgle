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
 * items trimmed, so that it fits the size a builder is given per component. The build ranks its components
 * (data-dg-rank, 1 for the one that most makes the reference look like itself), and they come back in that
 * order, the unranked after them in the order they appear, so that the ten places go to what is distinctive.
 */

export type ExtractedStyleComponents = {
  components: StyleComponent[];
  skipped: Array<{ name: string; reason: string }>;
};

const MAX_SAMPLE_TEXT = 24;
/** Attributes that identify or link a node rather than build it. Event handlers go too. */
const DROPPED_ATTRIBUTES = ["data-dg-component", "data-dg-use", "data-dg-rank", "data-drawgle-id", "id", "src", "srcset", "href"];

/** The renderer draws the status bar and the shared navigation, so a screen never copies them. */
const RENDERER_OWNED = /(^|-)(bottom-nav|bottom-navigation|navigation-bar|nav-bar|navbar|tab-bar|tabbar|dock|status-bar|statusbar|home-indicator)(-|$)|^(nav|navigation)$/;

/**
 * Arbitrary-value classes that have an exact, shorter utility class in the token runtime (lib/token-runtime.ts).
 * A build writes either; the component keeps the short one, so it is smaller and reads the same everywhere.
 */
const CANONICAL_CLASSES: Record<string, string> = {
  "rounded-[var(--dg-radii-app)]": "dg-radius-app",
  "rounded-[var(--dg-radii-inner)]": "dg-radius-inner",
  "rounded-[var(--dg-radii-pill)]": "dg-radius-pill",
  "text-[var(--dg-color-text-high-emphasis)]": "dg-text-high",
  "text-[var(--dg-color-text-medium-emphasis)]": "dg-text-medium",
  "text-[var(--dg-color-text-low-emphasis)]": "dg-text-low",
  "bg-[var(--dg-color-surface-card)]": "dg-surface-card",
  "bg-[var(--dg-color-surface-inset)]": "dg-surface-inset",
  "bg-[var(--dg-color-background-primary)]": "dg-bg-primary",
  "bg-[var(--dg-color-background-secondary)]": "dg-bg-secondary",
  "bg-[var(--dg-color-action-secondary)]": "dg-action-secondary",
  "shadow-[var(--dg-shadows-surface)]": "dg-shadow-surface",
  "shadow-[var(--dg-shadows-overlay)]": "dg-shadow-overlay",
  "px-[var(--dg-mobile-layout-screen-margin)]": "dg-screen-padding",
  "gap-[var(--dg-mobile-layout-section-gap)]": "dg-section-gap",
  "gap-[var(--dg-mobile-layout-element-gap)]": "dg-element-gap",
};
const ACTION_FILL = "bg-[var(--dg-color-action-primary)]";
const ACTION_TEXT = "text-[var(--dg-color-action-on-primary-text)]";

/** The classes of one element with each long form swapped for its short one, and no class twice. */
const canonicalClasses = (value: string) => {
  const classes = value.split(/\s+/).filter(Boolean);
  // The token runtime's action class is the fill and its text colour together, so only the pair becomes it.
  const pair = classes.includes(ACTION_FILL) && classes.includes(ACTION_TEXT);
  const swapped = classes.flatMap((name) => {
    if (pair && name === ACTION_TEXT) return [];
    if (pair && name === ACTION_FILL) return ["dg-action-primary"];
    return [CANONICAL_CLASSES[name] ?? name];
  });
  return [...new Set(swapped)].join(" ");
};

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
    const classes = $node.attr("class");
    if (classes) $node.attr("class", canonicalClasses(classes));
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
  /** The marked elements that were kept, by node, so that one inside another can be recognised. */
  const kept = new Map<unknown, string>();
  const ranks = new Map<string, number>();
  const found: StyleComponent[] = [];

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
    // A marked element inside a component that is kept whole is already in that component's markup. It would
    // only take one of the ten places from a kind of component the vocabulary does not have yet.
    const outer = $(element).parents("[data-dg-component]").toArray().map((parent) => kept.get(parent)).find(Boolean);
    if (outer) {
      skipped.push({ name, reason: `part of ${outer}, which is kept whole` });
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
    found.push(parsed.data);
    kept.set(element, name);
    const rank = Number.parseInt($(element).attr("data-dg-rank") ?? "", 10);
    if (Number.isInteger(rank) && rank >= 1 && rank <= 99) ranks.set(name, rank);
  });

  // the ranked first, most distinctive first, then the rest as they appear; the ten places go in that order
  const ordered = [...found].sort((left, right) => (ranks.get(left.name) ?? Number.POSITIVE_INFINITY) - (ranks.get(right.name) ?? Number.POSITIVE_INFINITY));
  for (const component of ordered) {
    if (components.length < MAX_STYLE_COMPONENTS) components.push(component);
    else skipped.push({ name: component.name, reason: `only the first ${MAX_STYLE_COMPONENTS} components are kept` });
  }
  return { components, skipped };
}
