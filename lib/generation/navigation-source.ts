import { load } from "cheerio";
import { extractKitNavigation, withoutPlacement } from "./kit-navigation-extraction";
import { defaultNavigationDesignContract, detectLocalNavigationMarkup, lucideIconName, renderDeterministicNavigationShell, validateNavigationShell } from "@/lib/project-navigation";
import type { NavigationPlan } from "@/lib/types";

export type NavigationSourceScreen = { id: string; name: string; code: string };

/** Promote only an identifiable bottom bar. Never feed a whole screen to the nav editor. */
export function navigationFromScreen(screen: NavigationSourceScreen, knownPlan?: NavigationPlan | null): NavigationPlan | null {
  const $ = load(screen.code, {}, false);
  const candidates = $("nav, footer, [data-dg-nav='bar'], [data-drawgle-primary-nav], div").filter((_, node) => {
    const el = $(node);
    if (el.is("div") && !el.is("[data-dg-nav], [data-drawgle-primary-nav]")
      && !/\b(?:fixed|absolute|sticky)\b/.test(`${el.attr("class") ?? ""} ${el.attr("style") ?? ""}`)) return false;
    const marker = `${el.attr("class") ?? ""} ${el.attr("style") ?? ""} ${el.attr("aria-label") ?? ""}`;
    return el.is("[data-dg-nav], [data-drawgle-primary-nav]") || /bottom|tab.bar|primary.navigation/i.test(marker);
  }).filter((_, node) => {
    const el = $(node);
    const buttons = el.find("button, a, [data-nav-item-id], [data-dg-nav-item]");
    return buttons.length >= 2 && buttons.length <= 6 && el.find("main, header, section, article, h1, h2, input").length === 0;
  });
  // Prefer the innermost candidate, but never guess between two distinct bars.
  const bars = candidates.filter((_, node) => !candidates.toArray().some(other => other !== node && $(other).parents().toArray().includes(node)));
  if (bars.length !== 1) return null;
  const bar = bars.first();
  let tabs = bar.find("[data-nav-item-id], [data-dg-nav-item]");
  if (!tabs.length) tabs = bar.find("button, a").filter((_, node) => !/^(?:plus|add|create)$/i.test($(node).find("[data-lucide]").attr("data-lucide") ?? ""));
  if (tabs.length < 2 || tabs.length > 5) return null;
  const items: NavigationPlan["items"] = [];
  let valid = true;
  tabs.each((index, node) => {
    const tab = $(node);
    const icon = tab.find("[data-lucide]").attr("data-lucide");
    const text = tab.attr("data-dg-nav-item") || tab.attr("aria-label") || tab.text().trim();
    const known = knownPlan?.items.find(item => item.id === tab.attr("data-nav-item-id") || item.label.toLowerCase() === text.toLowerCase())
      ?? knownPlan?.items.find(item => lucideIconName(item.icon) === lucideIconName(icon));
    const label = text || known?.label || icon?.split("-").map(word => word[0].toUpperCase() + word.slice(1)).join(" ");
    // An unlabeled SVG cannot tell us which destination it represents.
    if (!icon || !label || label.length > 40) { valid = false; return; }
    const id = known?.id || `nav-${index + 1}`;
    items.push({ id, label, icon: lucideIconName(icon), role: known?.role || label,
      linkedScreenName: known?.linkedScreenName ?? null, availability: known?.availability ?? "planned" });
    tab.attr("data-dg-nav-item", label);
    if (tab.attr("aria-current") === "page") tab.attr("data-active", "true");
  });
  if (!valid || new Set(items.map(item => item.id)).size !== items.length) return null;
  bar.attr("data-dg-nav", "bar");
  bar.attr("class", withoutPlacement(bar.attr("class") ?? ""));
  const kit = extractKitNavigation($.html(bar)).navigation;
  if (!kit) return null;
  const plan: NavigationPlan = {
    version: 2, decision: "reference-derived", evidence: { source: "explicit-prompt", reason: `Reused the navigation from ${screen.name}.` },
    enabled: true, kind: "bottom-tabs", items, visualBrief: `Existing navigation from ${screen.name}`,
    design: { ...defaultNavigationDesignContract(), kit }, screenChrome: [],
  };
  return validateNavigationShell(renderDeterministicNavigationShell(plan), plan) ? plan : null;
}

export function findNavigationSource(screens: NavigationSourceScreen[], prompt: string, references: string[], knownPlan?: NavigationPlan | null) {
  if (references.some(id => !screens.some(screen => screen.id === id))) throw new Error("The referenced navigation source is no longer available in this project.");
  const pool = references.length ? screens.filter(screen => references.includes(screen.id)) : screens;
  const available = pool.flatMap(screen => {
    const plan = navigationFromScreen(screen, knownPlan);
    return plan ? [{ screen, plan }] : [];
  });
  // A named destination without a bar must not hide the project's existing source bar.
  const named = available.filter(({ screen }) => prompt.toLowerCase().includes(screen.name.toLowerCase()));
  const candidates = named.length ? named : available;
  if (!candidates.length && pool.some(screen => detectLocalNavigationMarkup(screen.code).hasLocalNavigation)) {
    throw new Error("I found existing navigation, but could not safely extract its tabs. Name or select the source navigation so I can preserve it instead of inventing a replacement.");
  }
  if (candidates.length > 1) throw new Error("There are several different screen navigations. Name the screen whose navigation should be shared.");
  return candidates[0] ?? null;
}
