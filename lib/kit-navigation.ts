import type { KitNavigation } from "@/lib/types";

/**
 * A project's bottom navigation, drawn by its component kit in the app's own style, instead of one of the
 * renderer's five fixed bars. The live test's neo-brutalist sneaker app got a rounded floating dock from those, and
 * the planner's own descriptions ("a central focal action button", "circular icon wells") could not be drawn.
 *
 * The kit's bar is kept as templates: the bar with its tabs taken out, and one current and one other tab. The
 * renderer fills the bar with the project's tabs, drawing each in both states; the canvas and the exports show
 * the current one by setting data-active on the tab, as they always have. This module runs in the browser, so it
 * works on strings; the kit's markup is read out of the build on the server (lib/generation/kit-navigation-extraction.ts).
 */

/** Where one of the kit's tabs was: the renderer puts the project's tabs in these slots, in order. */
export const KIT_NAV_ITEM_SLOT = "<!--dg-nav-item-->";
export const KIT_NAV_ICON = "{{icon}}";
export const KIT_NAV_LABEL = "{{label}}";

/** The bar and a tab are small; anything larger is not a bar, and is left out rather than trimmed. */
export const MAX_KIT_BAR_CHARS = 4000;
export const MAX_KIT_ITEM_CHARS = 1600;

const UNSAFE = /<\s*(script|iframe|object|embed|link|meta|base)\b|\son[a-z]+\s*=|javascript:/i;

/** A kit bar the renderer can draw: a bar with a tab slot, both tab templates, within size, and nothing executable. */
export function usableKitNavigation(value: unknown): KitNavigation | null {
  if (!value || typeof value !== "object") return null;
  const { bar, activeItem, inactiveItem } = value as Record<string, unknown>;
  if (typeof bar !== "string" || typeof activeItem !== "string" || typeof inactiveItem !== "string") return null;
  if (!bar.includes(KIT_NAV_ITEM_SLOT) || bar.length > MAX_KIT_BAR_CHARS) return null;
  if (!activeItem.trim() || !inactiveItem.trim()) return null;
  if (activeItem.length > MAX_KIT_ITEM_CHARS || inactiveItem.length > MAX_KIT_ITEM_CHARS) return null;
  if (UNSAFE.test(bar) || UNSAFE.test(activeItem) || UNSAFE.test(inactiveItem)) return null;
  return { bar, activeItem, inactiveItem };
}

const BAR_ROOT = /^(\s*<[a-z][a-z0-9-]*\b)([^>]*)>/i;
const CLASS_ATTRIBUTE = /\sclass\s*=\s*"([^"]*)"/i;
/** A class that already spaces the bar's bottom: its own padding or margin. */
const BOTTOM_SPACING = /^-?(?:p|py|pb|m|my|mb)-/;
/** A class that floats the bar: a side margin or rounded corners all round. */
const FLOATING = /^(?:-?(?:mx|ml|mr|m)-|rounded(?:-(?:sm|md|lg|xl|2xl|3xl|full|\[[^\]]+\]))?$|dg-radius-(?:app|pill))/;

/**
 * The bar with the phone's bottom safe area kept once, by the bar. A bar attached to the bottom edge pads its own
 * bottom, so its fill reaches the edge; a floating bar keeps a margin below it. The renderer used to add the safe area
 * again as transparent space under every kit bar, so an attached bar stopped short of the edge with a strip of page
 * showing below it. A bar that already spaces its bottom is left as it is.
 */
export function kitBarWithBottom(bar: string): string {
  const root = bar.match(BAR_ROOT);
  if (!root) return bar;
  const attributes = root[2];
  const classes = attributes.match(CLASS_ATTRIBUTE)?.[1] ?? "";
  const tokens = classes.split(/\s+/).filter(Boolean);
  if (tokens.some((token) => BOTTOM_SPACING.test(token))) return bar;
  const added = tokens.some((token) => FLOATING.test(token))
    ? "mb-[var(--dg-effective-safe-area-bottom)]"
    : "pb-[var(--dg-effective-safe-area-bottom)]";
  const nextAttributes = CLASS_ATTRIBUTE.test(attributes)
    ? attributes.replace(CLASS_ATTRIBUTE, (_match, value: string) => ` class="${[value.trim(), added].filter(Boolean).join(" ")}"`)
    : `${attributes} class="${added}"`;
  return `${root[1]}${nextAttributes}>${bar.slice(root[0].length)}`;
}

export type KitNavigationTab = {
  id: string;
  label: string;
  /** A Lucide icon name, already in kebab case. */
  icon: string;
  generated: boolean;
  linkedScreenName: string | null;
};

const escapeHtml = (value: string) => value
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");

const withTab = (template: string, tab: KitNavigationTab) =>
  template.split(KIT_NAV_ICON).join(escapeHtml(tab.icon)).split(KIT_NAV_LABEL).join(escapeHtml(tab.label));

/**
 * One tab: a wrapper that takes no room of its own (display: contents) around the tab drawn as the current one and
 * as another one. The wrapper carries what the canvas sets and reads, so the current tab shows by data-active.
 */
export function kitNavigationTabHtml(kit: KitNavigation, tab: KitNavigationTab): string {
  const linked = tab.generated && tab.linkedScreenName ? ` data-linked-screen-name="${escapeHtml(tab.linkedScreenName)}"` : "";
  return [
    `<div class="dg-nav-kit-item" data-nav-item-id="${escapeHtml(tab.id)}" data-nav-availability="${tab.generated ? "generated" : "planned"}" data-active="false"${linked}${tab.generated ? "" : ' aria-disabled="true"'}>`,
    withTab(kit.activeItem, tab),
    withTab(kit.inactiveItem, tab),
    "</div>",
  ].join("");
}

/**
 * The kit's bar with the project's tabs in its slots, in order. The last slot takes every tab left over, and slots
 * with no tab left are dropped, so a bar drawn with three tabs holds a project's two or five.
 */
export function fillKitNavigationBar(kit: KitNavigation, tabs: readonly KitNavigationTab[]): string {
  const parts = kit.bar.split(KIT_NAV_ITEM_SLOT);
  const slots = parts.length - 1;
  let html = parts[0];
  for (let slot = 0; slot < slots; slot += 1) {
    const last = slot === slots - 1;
    const placed = last ? tabs.slice(slot) : tabs.slice(slot, slot + 1);
    html += placed.map((tab) => kitNavigationTabHtml(kit, tab)).join("") + parts[slot + 1];
  }
  return html;
}
