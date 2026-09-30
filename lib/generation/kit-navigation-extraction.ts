import { load, type CheerioAPI } from "cheerio";

import { canonicalClasses } from "@/lib/generation/style-component-extraction";
import { KIT_NAV_ICON, KIT_NAV_ITEM_SLOT, KIT_NAV_LABEL, usableKitNavigation } from "@/lib/kit-navigation";
import type { KitNavigation } from "@/lib/types";

/**
 * Reads the bottom navigation bar out of a component kit's build (see lib/kit-navigation.ts): the element marked
 * data-dg-nav="bar", its tabs marked data-dg-nav-item, and the current one marked data-active="true". The tabs
 * become two templates, the current one and another, with their icon and label made placeholders; in the bar each
 * tab becomes a slot. Anything the renderer owns (where the bar sits on the screen) is taken off the bar.
 */

export type KitNavigationExtraction = { navigation: KitNavigation | null; note?: string };

/** Attributes that mark, identify or link rather than build. Event handlers go too. */
const DROPPED = ["id", "data-drawgle-id", "href", "src", "srcset", "data-dg-component", "data-dg-use", "data-dg-nav",
  "data-dg-nav-item", "data-dg-nav-action", "data-active", "aria-current", "aria-label", "data-nav-item-id"];

/** Placement the renderer owns: the bar is laid in its host at the bottom of every screen. */
const PLACEMENT = /^(?:fixed|absolute|sticky|inset-0|z-\S+|-?translate-[xy]-\S+|top-\S+|mt-\S+|my-\S+)$/;

type Selection = ReturnType<CheerioAPI>;
type TextNode = { type: string; data: string };

const clean = ($: CheerioAPI, root: Selection) => {
  root.find("script, style, noscript").remove();
  root.find("*").addBack().each((_, node) => {
    const $node = $(node);
    for (const attribute of DROPPED) $node.removeAttr(attribute);
    for (const attribute of Object.keys($node.attr() ?? {})) {
      if (attribute.startsWith("on")) $node.removeAttr(attribute);
    }
    const classes = $node.attr("class");
    if (classes) $node.attr("class", canonicalClasses(classes));
  });
};

/**
 * The bar's own classes without the placement the renderer owns. An offset from the bottom or the sides becomes the
 * same margin, so a floating bar still floats, and a bar centred by a transform is centred by auto margins.
 */
export function withoutPlacement(classes: string): string {
  const names = classes.split(/\s+/).filter(Boolean);
  const kept: string[] = [];
  const centred = names.includes("left-1/2") && names.some((name) => /^-translate-x-1\/2$/.test(name));
  // A pinned bar with no width of its own and not held by both sides was as wide as its tabs. In the renderer's host it
  // would stretch across the screen, so it keeps its own width: a centred pill stays a pill.
  const pinned = names.some((name) => /^(?:fixed|absolute|sticky)$/.test(name));
  const sized = names.some((name) => /^(?:w-|min-w-|max-w-)/.test(name));
  const bothSides = names.some((name) => /^(?:inset-0|inset-x-)/.test(name))
    || (names.some((name) => /^left-(?!1\/2$)/.test(name)) && names.some((name) => /^right-/.test(name)));
  if (pinned && !sized && !bothSides) kept.push("w-fit");
  for (const name of names) {
    const bottom = /^bottom-(.+)$/.exec(name);
    const insetX = /^inset-x-(.+)$/.exec(name);
    const side = /^(left|right)-(.+)$/.exec(name);
    if (bottom) {
      if (bottom[1] !== "0") kept.push(`mb-${bottom[1]}`);
    } else if (insetX) {
      if (insetX[1] !== "0") kept.push(`mx-${insetX[1]}`);
    } else if (side) {
      if (side[2] !== "0" && side[2] !== "1/2") kept.push(`${side[1] === "left" ? "ml" : "mr"}-${side[2]}`);
    } else if (!PLACEMENT.test(name)) {
      kept.push(name);
    }
  }
  if (centred) kept.push("mx-auto");
  return [...new Set(kept)].join(" ");
}

const compact = ($: CheerioAPI, root: Selection) =>
  $.html(root).replace(/\s+/g, " ").replace(/>\s+</g, "><").trim();

/** The tab's own label: the text that is its name, or its only text. Icon-only tabs have none. */
const labelNode = (tab: Selection, name: string): TextNode | null => {
  const texts = tab.find("*").addBack().contents().toArray()
    .map((node) => node as unknown as TextNode)
    .filter((node) => node.type === "text" && node.data.trim());
  const wanted = name.trim().toLowerCase();
  return texts.find((node) => node.data.trim().toLowerCase() === wanted) ?? (texts.length === 1 ? texts[0] : null);
};

/** One tab as a template: its icon and label as placeholders, cleaned, with the state it shows. */
const tabTemplate = ($: CheerioAPI, tab: Selection, state: "active" | "inactive") => {
  const name = tab.attr("data-dg-nav-item") ?? "";
  const clone = tab.clone();
  const label = labelNode(clone, name);
  if (label) label.data = KIT_NAV_LABEL;
  const lucide = clone.find("[data-lucide]").first();
  if (lucide.length) {
    lucide.attr("data-lucide", KIT_NAV_ICON);
  } else {
    const svg = clone.find("svg").first();
    if (svg.length) svg.replaceWith(`<i data-lucide="${KIT_NAV_ICON}"${svg.attr("class") ? ` class="${svg.attr("class")}"` : ""}></i>`);
  }
  clean($, clone);
  clone.attr("data-dg-nav-state", state);
  clone.attr("aria-label", KIT_NAV_LABEL);
  return compact($, clone);
};

export function extractKitNavigation(html: string): KitNavigationExtraction {
  const $ = load(html, {}, false);
  const marked = $("[data-dg-nav='bar']").first();
  const bar = marked.length ? marked : $("[data-dg-nav]").first();
  if (!bar.length) return { navigation: null, note: "the kit drew no navigation bar" };

  const tabs = bar.find("[data-dg-nav-item]").filter((_, element) => $(element).parents("[data-dg-nav-item]").length === 0);
  if (tabs.length < 2) return { navigation: null, note: `the kit's bar has ${tabs.length} marked tab${tabs.length === 1 ? "" : "s"}` };
  const row = tabs.first().parent();
  if (tabs.toArray().some((tab) => !$(tab).parent().is(row))) return { navigation: null, note: "the kit's tabs are not in one row" };

  const current = tabs.filter("[data-active='true']").first();
  const active = current.length ? current : tabs.first();
  const other = tabs.not(active).first();
  const activeItem = tabTemplate($, active, "active");
  const inactiveItem = tabTemplate($, other, "inactive");

  const barClone = bar.clone();
  barClone.find("[data-dg-nav-item]").filter((_, element) => $(element).parents("[data-dg-nav-item]").length === 0)
    .each((_, element) => { $(element).replaceWith(KIT_NAV_ITEM_SLOT); });
  clean($, barClone);
  barClone.attr("class", withoutPlacement(barClone.attr("class") ?? ""));
  const navigation = usableKitNavigation({ bar: compact($, barClone), activeItem, inactiveItem });
  return navigation ? { navigation } : { navigation: null, note: "the kit's bar is too large or unsafe to reuse" };
}
