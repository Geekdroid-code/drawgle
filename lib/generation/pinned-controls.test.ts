import { load } from "cheerio";
import { describe, expect, it } from "vitest";

import { navigationOwnsCenterAction, settlePinnedControls } from "./pinned-controls";
import type { NavigationPlan } from "@/lib/types";

const screen = (main: string, after = "") =>
  `<div class="w-full min-h-screen dg-bg-primary flex flex-col relative overflow-x-hidden">`
  + `<main class="flex-1 dg-shared-nav-clearance" data-drawgle-nav-clearance-owner="true">${main}</main>${after}</div>`;
const detailScreen = (body: string) =>
  `<div class="w-full min-h-screen dg-bg-primary flex flex-col relative overflow-x-hidden"><main class="flex-1">${body}</main></div>`;

const centredPlus = `<div class="fixed bottom-[100px] left-1/2 -translate-x-1/2 z-50 pointer-events-none">`
  + `<button class="w-[64px] h-[64px] rounded-full pointer-events-auto"><i data-lucide="plus" class="w-8 h-8"></i></button></div>`;
const rightFab = `<div class="fixed bottom-[calc(var(--dg-sizing-bottom-nav-height)+24px)] right-[var(--dg-mobile-layout-screen-margin)] z-[60]">`
  + `<button class="w-[64px] h-[64px] rounded-full"><i data-lucide="plus"></i></button></div>`;
const sessionStrip = `<div class="fixed bottom-[var(--dg-sizing-bottom-nav-height)] left-0 w-full px-[var(--dg-mobile-layout-screen-margin)] pb-4 pointer-events-none">`
  + `<div class="w-full h-12 pointer-events-auto"><span>Session connected</span></div></div>`;

const classOf = (code: string, selector: string) => load(code, {}, false)(selector).attr("class") ?? "";

describe("settlePinnedControls", () => {
  it("removes a pinned + that repeats the shared bar's centre action, on every screen", () => {
    const rootScreen = settlePinnedControls({ code: screen("<p>Today</p>", centredPlus), navigationOwnsCenterAction: true });
    expect(rootScreen.removedDuplicates).toBe(1);
    expect(rootScreen.code).not.toContain('data-lucide="plus"');
    expect(rootScreen.code).toContain("<p>Today</p>");

    const detail = settlePinnedControls({ code: detailScreen(`<button>Back to Today</button>${centredPlus}`), navigationOwnsCenterAction: true });
    expect(detail.removedDuplicates).toBe(1);
    expect(detail.code).toContain("Back to Today");
  });

  it("docks a centred control into the flow when the bar has no centre action of its own", () => {
    const result = settlePinnedControls({ code: detailScreen(`<p>Done</p>${centredPlus}`), navigationOwnsCenterAction: false });
    expect(result).toMatchObject({ docked: 1, removedDuplicates: 0 });
    const classes = classOf(result.code, "div.z-50").split(" ");
    expect(classes).toEqual(expect.arrayContaining(["mx-auto", "w-fit", "relative", "z-50", "pointer-events-none"]));
    expect(classes.some((name) => /^(?:fixed|bottom-|left-|-?translate-x-)/.test(name))).toBe(false);
  });

  it("docks a side control at the end of the content that clears the bar, keeping its side", () => {
    const result = settlePinnedControls({ code: screen("<section>Saved programs</section>", rightFab), navigationOwnsCenterAction: false });
    const $ = load(result.code, {}, false);
    const main = $("main");
    expect(main.children().last().attr("class")).toContain("ml-auto");
    expect(main.children().last().attr("class")).toContain("mr-[var(--dg-mobile-layout-screen-margin)]");
    expect(main.children().first().text()).toBe("Saved programs");
    expect($("main").nextAll().length).toBe(0);
  });

  it("docks a full-width strip at full width, keeping its padding", () => {
    const result = settlePinnedControls({ code: detailScreen(`<ol><li>Hamstring curls</li></ol>${sessionStrip}`), navigationOwnsCenterAction: true });
    expect(result).toMatchObject({ docked: 1, removedDuplicates: 0 });
    const classes = classOf(result.code, "div.pb-4").split(" ");
    expect(classes).toEqual(expect.arrayContaining(["w-full", "px-[var(--dg-mobile-layout-screen-margin)]", "pb-4", "relative"]));
    expect(classes).not.toContain("fixed");
    expect(classes.some((name) => /^(?:bottom-|left-)/.test(name))).toBe(false);
  });

  it("keeps a pinned control with words in it, even when the bar has a centre action", () => {
    const startSet = `<div class="fixed bottom-6 inset-x-0 px-4"><button><i data-lucide="plus"></i> Add set</button></div>`;
    const result = settlePinnedControls({ code: detailScreen(startSet), navigationOwnsCenterAction: true });
    expect(result).toMatchObject({ docked: 1, removedDuplicates: 0 });
    expect(result.code).toContain("Add set");
    expect(classOf(result.code, "div.px-4")).toContain("w-full");
  });

  it("leaves full-screen layers, hidden overlays and top bars alone", () => {
    const layers = [
      `<div class="pointer-events-none fixed inset-0 opacity-[0.03]"></div>`,
      `<div class="fixed bottom-0 left-0 right-0 opacity-0 pointer-events-none"><button><i data-lucide="plus"></i></button></div>`,
      `<header class="sticky top-0 z-50">Train</header>`,
      `<div class="fixed top-0 bottom-0 right-0 w-64">Drawer</div>`,
    ].join("");
    const code = detailScreen(layers);
    const result = settlePinnedControls({ code, navigationOwnsCenterAction: true });
    expect(result).toMatchObject({ docked: 0, removedDuplicates: 0 });
    expect(result.code).toBe(code);
  });

  it("settles only the outermost pinned element", () => {
    const nested = `<div class="fixed bottom-4 right-4"><div class="fixed bottom-2 left-2"><button>Help</button></div></div>`;
    const result = settlePinnedControls({ code: detailScreen(nested), navigationOwnsCenterAction: false });
    expect(result.docked).toBe(1);
    expect(result.code).toContain("fixed bottom-2 left-2");
  });

  it("returns a screen without pinned controls exactly as it was", () => {
    const code = detailScreen("<p>Nothing pinned</p>");
    expect(settlePinnedControls({ code, navigationOwnsCenterAction: true })).toEqual({ code, docked: 0, removedDuplicates: 0 });
  });
});

describe("navigationOwnsCenterAction", () => {
  const plan = (design: Partial<NonNullable<NavigationPlan["design"]>> | null, enabled = true) =>
    ({ enabled, kind: "bottom_tabs", items: [], visualBrief: "", screenChrome: [], design }) as unknown as NavigationPlan;

  it("reads the kit bar's own +, or the centre-action dock without a kit", () => {
    const kit = (bar: string) => ({ bar, activeItem: "", inactiveItem: "" });
    expect(navigationOwnsCenterAction(plan({ kit: kit('<nav><!--dg-nav-item--><button><i data-lucide="plus"></i></button></nav>') }))).toBe(true);
    expect(navigationOwnsCenterAction(plan({ anatomy: "center-action-dock", kit: kit("<nav><!--dg-nav-item--></nav>") }))).toBe(false);
    expect(navigationOwnsCenterAction(plan({ anatomy: "center-action-dock" }))).toBe(true);
    expect(navigationOwnsCenterAction(plan({ anatomy: "floating-dock" }))).toBe(false);
    expect(navigationOwnsCenterAction(plan({ anatomy: "center-action-dock" }, false))).toBe(false);
    expect(navigationOwnsCenterAction(null)).toBe(false);
  });
});
