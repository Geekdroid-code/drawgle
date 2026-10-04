import { load } from "cheerio";

import { SHARED_NAV_CLEARANCE_CLASS } from "@/lib/navigation-clearance";
import type { NavigationPlan } from "@/lib/types";

/**
 * Settles the controls a built screen pinned to the bottom of the viewport with `fixed`.
 *
 * A canvas frame is as tall as its screen, so a pinned control sits over whatever ends the screen: a + over a list
 * row, a session strip over the queue, a button over "Back to Today". Two things happen instead:
 *
 * - A pinned + that repeats the shared bar's own centre action is a second copy of it, and is removed.
 * - Every other pinned control is docked: it joins the screen's flow where the content ends, keeps its horizontal
 *   place, and covers nothing. On a screen with the shared bar it docks inside the element that holds the bar's
 *   clearance, so it ends above the bar rather than under it.
 *
 * Full-screen layers (inset-0, top and bottom anchors) and hidden states (opacity-0, hidden, invisible) are left
 * alone: they cover nothing until something opens them.
 */

const PLUS_ICONS = /^(?:plus|plus-circle|circle-plus|square-plus|plus-square)$/;
const PLUS_ICON_MARKUP = /data-lucide=["'](?:plus|plus-circle|circle-plus|square-plus|plus-square)["']/;

/** The shared bar already carries a centre action: its own + in a kit bar, or the centre-action dock anatomy. */
export function navigationOwnsCenterAction(plan: NavigationPlan | null | undefined): boolean {
  if (!plan?.enabled) return false;
  if (plan.design?.kit) return PLUS_ICON_MARKUP.test(plan.design.kit.bar);
  return plan.design?.anatomy === "center-action-dock";
}

const classesOf = (value: string | undefined) => (value ?? "").split(/\s+/).filter(Boolean);

const isPinnedToBottom = (classes: string[]) =>
  classes.includes("fixed") &&
  classes.some((name) => /^-?bottom-/.test(name)) &&
  !classes.some((name) => /^-?(?:inset-(?:0|y-|\[)|top-)/.test(name)) &&
  !classes.some((name) => /^(?:hidden|invisible|opacity-0|translate-y-full)$/.test(name));

/** The flow classes that keep a docked control where it was pinned across the screen's width. */
function dockedClasses(classes: string[]): string[] {
  const kept: string[] = [];
  let left: string | null = null;
  let right: string | null = null;
  let centred = false;
  let fullWidth = classes.includes("w-full");
  for (const name of classes) {
    if (name === "fixed" || /^-?bottom-/.test(name) || /^-?translate-x-/.test(name)) continue;
    if (name === "inset-x-0") {
      fullWidth = true;
      continue;
    }
    const leftValue = name.match(/^left-(.+)$/)?.[1];
    if (leftValue) {
      if (leftValue === "1/2") centred = true;
      else left = leftValue;
      continue;
    }
    const rightValue = name.match(/^right-(.+)$/)?.[1];
    if (rightValue) {
      right = rightValue;
      continue;
    }
    kept.push(name);
  }
  if (left === "0" && right === "0") fullWidth = true;

  const hasWidth = kept.some((name) => /^(?:w-|size-)/.test(name));
  const added: string[] = [];
  if (fullWidth) {
    if (!kept.includes("w-full")) added.push("w-full");
  } else if (centred) {
    added.push("mx-auto", ...(hasWidth ? [] : ["w-fit"]));
  } else if (right) {
    added.push("ml-auto", ...(hasWidth ? [] : ["w-fit"]), ...(right === "0" ? [] : [`mr-${right}`]));
  } else if (left) {
    added.push("mr-auto", ...(hasWidth ? [] : ["w-fit"]), ...(left === "0" ? [] : [`ml-${left}`]));
  }
  if (!kept.some((name) => /^(?:relative|absolute|sticky)$/.test(name))) added.push("relative");
  return [...kept, ...added];
}

export function settlePinnedControls({
  code,
  navigationOwnsCenterAction: barOwnsCenterAction,
}: {
  code: string;
  navigationOwnsCenterAction: boolean;
}): { code: string; docked: number; removedDuplicates: number } {
  if (!/\bfixed\b/.test(code)) return { code, docked: 0, removedDuplicates: 0 };

  const $ = load(code, {}, false);
  const pinned = $("[class]").toArray().filter((element) => isPinnedToBottom(classesOf($(element).attr("class"))));
  // Settle the outermost pinned element only; anything pinned inside it moves with it.
  const outermost = pinned.filter((element) => !pinned.some((other) => other !== element && $(other).find(element).length > 0));
  if (outermost.length === 0) return { code, docked: 0, removedDuplicates: 0 };

  const owner = $(`.${SHARED_NAV_CLEARANCE_CLASS}`).first();
  let docked = 0;
  let removedDuplicates = 0;

  for (const element of outermost) {
    const node = $(element);
    if (barOwnsCenterAction) {
      const controls = node.is("button, a, [role='button']") ? node : node.find("button, a, [role='button']");
      const icon = (controls.length === 1 ? controls.find("[data-lucide]").attr("data-lucide") : undefined) ?? "";
      if (PLUS_ICONS.test(icon) && !node.text().trim()) {
        node.remove();
        removedDuplicates += 1;
        continue;
      }
    }

    node.attr("class", dockedClasses(classesOf(node.attr("class"))).join(" "));
    if (owner.length && !owner.is(element) && node.closest(`.${SHARED_NAV_CLEARANCE_CLASS}`).length === 0
      && node.find(`.${SHARED_NAV_CLEARANCE_CLASS}`).length === 0) {
      owner.append(node);
    }
    docked += 1;
  }

  return { code: $.html(), docked, removedDuplicates };
}
