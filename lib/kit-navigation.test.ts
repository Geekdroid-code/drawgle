import { describe, expect, it } from "vitest";

import { fillKitNavigationBar, kitBarWithBottom, KIT_NAV_ITEM_SLOT, usableKitNavigation, type KitNavigationTab } from "./kit-navigation";

const kit = {
  bar: `<nav class="flex border-4 border-black">${KIT_NAV_ITEM_SLOT}${KIT_NAV_ITEM_SLOT}${KIT_NAV_ITEM_SLOT}</nav>`,
  activeItem: '<button class="bg-black text-white" data-dg-nav-state="active" aria-label="{{label}}"><i data-lucide="{{icon}}"></i><span>{{label}}</span></button>',
  inactiveItem: '<button class="bg-white" data-dg-nav-state="inactive" aria-label="{{label}}"><i data-lucide="{{icon}}"></i><span>{{label}}</span></button>',
};
const tab = (id: string, label: string, icon = "circle", generated = true): KitNavigationTab =>
  ({ id, label, icon, generated, linkedScreenName: generated ? `${label} screen` : null });

describe("a kit bar the renderer can draw", () => {
  it("is one with a tab slot, both tab templates, within size and with nothing that runs", () => {
    expect(usableKitNavigation(kit)).toEqual(kit);
    expect(usableKitNavigation(null)).toBeNull();
    expect(usableKitNavigation({ ...kit, bar: "<nav></nav>" })).toBeNull();
    expect(usableKitNavigation({ ...kit, activeItem: "  " })).toBeNull();
    expect(usableKitNavigation({ ...kit, bar: `${kit.bar}${"x".repeat(4000)}` })).toBeNull();
    expect(usableKitNavigation({ ...kit, inactiveItem: '<button onclick="steal()">x</button>' })).toBeNull();
    expect(usableKitNavigation({ ...kit, bar: `<script>x()</script>${kit.bar}` })).toBeNull();
  });
});

describe("filling the kit's bar with a project's tabs", () => {
  it("puts each tab in a slot, drawn as the current one and as another, with its own icon and label", () => {
    const html = fillKitNavigationBar(kit, [tab("drops", "Drops", "zap"), tab("calendar", "Calendar", "calendar"), tab("me", "Me", "user")]);
    expect(html.startsWith('<nav class="flex border-4 border-black"><div class="dg-nav-kit-item" data-nav-item-id="drops"')).toBe(true);
    expect(html.match(/class="dg-nav-kit-item"/g)).toHaveLength(3);
    expect(html).toContain('data-lucide="zap"');
    expect(html).toContain("<span>Calendar</span>");
    expect(html.match(/data-dg-nav-state="active"/g)).toHaveLength(3);
    expect(html).toContain('data-linked-screen-name="Drops screen"');
    expect(html).not.toContain(KIT_NAV_ITEM_SLOT);
  });

  it("holds more tabs than the kit drew in its last slot, and drops slots it has no tab for", () => {
    const five = fillKitNavigationBar(kit, ["a", "b", "c", "d", "e"].map((id) => tab(id, id.toUpperCase())));
    expect(five.match(/class="dg-nav-kit-item"/g)).toHaveLength(5);
    const two = fillKitNavigationBar(kit, [tab("a", "A"), tab("b", "B")]);
    expect(two.match(/class="dg-nav-kit-item"/g)).toHaveLength(2);
    expect(two.endsWith("</nav>")).toBe(true);
  });

  it("escapes what a tab says, and marks a tab with no screen yet", () => {
    const html = fillKitNavigationBar(kit, [tab("x", '<img src=x onerror="a()">'), tab("later", "Later", "clock", false)]);
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img src=x onerror=&quot;a()&quot;&gt;");
    expect(html).toContain('data-nav-item-id="later" data-nav-availability="planned" data-active="false" aria-disabled="true"');
  });
});

describe("the bottom of the kit's bar", () => {
  const slot = KIT_NAV_ITEM_SLOT;

  it("is left alone when the bar already spaces it, as both live bars did", () => {
    const attached = `<nav class="h-[var(--dg-sizing-bottom-nav-height)] dg-surface-card border-t px-6 flex pb-[var(--dg-mobile-layout-safe-area-bottom)]">${slot}</nav>`;
    expect(kitBarWithBottom(attached)).toBe(attached);
    const floating = `<nav class="mx-4 mb-4 flex rounded-full">${slot}</nav>`;
    expect(kitBarWithBottom(floating)).toBe(floating);
  });

  it("pads an attached bar that does not, so its fill reaches the bottom edge", () => {
    expect(kitBarWithBottom(`<nav class="flex border-t dg-surface-card px-6">${slot}</nav>`))
      .toBe(`<nav class="flex border-t dg-surface-card px-6 pb-[var(--dg-effective-safe-area-bottom)]">${slot}</nav>`);
    // px and pt are not bottom spacing
    expect(kitBarWithBottom(`<nav class="px-4 pt-2">${slot}</nav>`)).toContain("pb-[var(--dg-effective-safe-area-bottom)]");
  });

  it("lifts a floating bar that does not by a margin, so it still floats above the edge", () => {
    expect(kitBarWithBottom(`<div class="mx-6 dg-radius-pill flex">${slot}</div>`))
      .toBe(`<div class="mx-6 dg-radius-pill flex mb-[var(--dg-effective-safe-area-bottom)]">${slot}</div>`);
  });

  it("gives a bar without a class one, and leaves markup it cannot read as it is", () => {
    expect(kitBarWithBottom(`<nav data-dg-nav="bar">${slot}</nav>`))
      .toBe(`<nav data-dg-nav="bar" class="pb-[var(--dg-effective-safe-area-bottom)]">${slot}</nav>`);
    expect(kitBarWithBottom(slot)).toBe(slot);
  });
});
