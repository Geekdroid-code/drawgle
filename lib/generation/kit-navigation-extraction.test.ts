// @vitest-environment node
import { describe, expect, it } from "vitest";

import { extractKitNavigation, withoutPlacement } from "./kit-navigation-extraction";
import { KIT_NAV_ICON, KIT_NAV_ITEM_SLOT, KIT_NAV_LABEL } from "@/lib/kit-navigation";

/** A kit page with a component and, last, its bar: square, thick-bordered and pinned to the bottom, as a neo-brutalist kit draws it. */
const kitPage = (bar: string) => `<div class="w-full min-h-screen dg-bg-primary">
  <div data-dg-component="drop-card" data-dg-use="one sneaker drop" class="border-4 border-black p-4"><p>AIR MAX 1</p></div>
  ${bar}
</div>
<!-- DRAWGLE_GENERATION_COMPLETE -->`;

const brutalistBar = `<nav data-dg-nav="bar" data-drawgle-id="n1" class="fixed bottom-4 left-4 right-4 z-50 flex border-4 border-black bg-white shadow-[6px_6px_0_#000]">
  <div class="flex w-full" data-drawgle-id="n2">
    <button data-dg-nav-item="Drops" data-active="true" onclick="go()" class="flex-1 flex flex-col items-center py-3 bg-black text-white">
      <i data-lucide="zap" class="w-5 h-5"></i><span class="text-[10px] font-black uppercase">Drops</span>
    </button>
    <button data-dg-nav-item="Calendar" class="flex-1 flex flex-col items-center py-3 border-l-4 border-black">
      <i data-lucide="calendar" class="w-5 h-5"></i><span class="text-[10px] font-black uppercase">Calendar</span>
    </button>
    <button data-dg-nav-item="Profile" class="flex-1 flex flex-col items-center py-3 border-l-4 border-black">
      <i data-lucide="user" class="w-5 h-5"></i><span class="text-[10px] font-black uppercase">Profile</span>
    </button>
  </div>
</nav>`;

describe("reading the component kit's bottom bar", () => {
  it("keeps the bar's look, takes its placement off, and turns its tabs into slots", () => {
    const { navigation } = extractKitNavigation(kitPage(brutalistBar));
    expect(navigation).not.toBeNull();
    const bar = navigation!.bar;
    // the look stays
    expect(bar).toContain("border-4 border-black bg-white shadow-[6px_6px_0_#000]");
    // where it sits is the renderer's: pinned placement goes, and its offsets become the same margins
    expect(bar).not.toMatch(/\bfixed\b|\bz-50\b|\bbottom-4\b|\bleft-4\b|\bright-4\b/);
    expect(bar).toContain("mb-4");
    expect(bar).toContain("ml-4");
    expect(bar).toContain("mr-4");
    // every tab became a slot, in its place in the row
    expect(bar.split(KIT_NAV_ITEM_SLOT)).toHaveLength(4);
    expect(bar).not.toContain("Drops");
    expect(bar).not.toContain("data-dg-nav");
    expect(bar).not.toContain("data-drawgle-id");
  });

  it("makes the current tab and another one into templates, with their icon and label as placeholders", () => {
    const { navigation } = extractKitNavigation(kitPage(brutalistBar));
    expect(navigation!.activeItem).toContain("bg-black text-white");
    expect(navigation!.activeItem).toContain('data-dg-nav-state="active"');
    expect(navigation!.inactiveItem).toContain("border-l-4 border-black");
    expect(navigation!.inactiveItem).toContain('data-dg-nav-state="inactive"');
    for (const template of [navigation!.activeItem, navigation!.inactiveItem]) {
      expect(template).toContain(`data-lucide="${KIT_NAV_ICON}"`);
      expect(template).toContain(`>${KIT_NAV_LABEL}<`);
      expect(template).toContain(`aria-label="${KIT_NAV_LABEL}"`);
      // nothing that runs, and none of the kit's own markers
      expect(template).not.toMatch(/onclick|data-dg-nav-item|data-active/);
    }
  });

  it("takes the first tab as the current one when none is marked, and an inline icon as the icon's place", () => {
    const bar = `<div data-dg-nav="bar" class="flex rounded-full dg-surface-card p-2">
      <a data-dg-nav-item="Home" class="p-3 rounded-full dg-action-primary"><svg class="w-6 h-6" viewBox="0 0 24 24"><path d="M3 12h18"/></svg></a>
      <a data-dg-nav-item="Stats" class="p-3 rounded-full"><svg class="w-6 h-6" viewBox="0 0 24 24"><path d="M3 3v18"/></svg></a>
    </div>`;
    const { navigation } = extractKitNavigation(kitPage(bar));
    expect(navigation!.activeItem).toContain("dg-action-primary");
    expect(navigation!.activeItem).toContain(`<i data-lucide="${KIT_NAV_ICON}" class="w-6 h-6"></i>`);
    expect(navigation!.activeItem).not.toContain("<svg");
    // an icon-only tab keeps no text, and is named by its aria-label
    expect(navigation!.activeItem).not.toContain(`>${KIT_NAV_LABEL}<`);
    expect(navigation!.activeItem).toContain(`aria-label="${KIT_NAV_LABEL}"`);
  });

  it("gives no bar, and says why, when the kit drew none or one it cannot reuse", () => {
    expect(extractKitNavigation(kitPage(""))).toEqual({ navigation: null, note: "the kit drew no navigation bar" });
    const oneTab = `<nav data-dg-nav="bar"><button data-dg-nav-item="Home">Home</button></nav>`;
    expect(extractKitNavigation(kitPage(oneTab)).note).toBe("the kit's bar has 1 marked tab");
    const split = `<nav data-dg-nav="bar"><div><button data-dg-nav-item="Home">Home</button></div><div><button data-dg-nav-item="Me">Me</button></div></nav>`;
    expect(extractKitNavigation(kitPage(split)).note).toBe("the kit's tabs are not in one row");
    const huge = `<nav data-dg-nav="bar"><p>${"x".repeat(5000)}</p><button data-dg-nav-item="A">A</button><button data-dg-nav-item="B">B</button></nav>`;
    expect(extractKitNavigation(kitPage(huge)).note).toBe("the kit's bar is too large or unsafe to reuse");
  });
});

describe("the placement the renderer owns", () => {
  it("drops pinning and turns offsets into margins", () => {
    expect(withoutPlacement("fixed bottom-6 inset-x-4 z-40 flex rounded-full")).toBe("mb-6 mx-4 flex rounded-full");
    expect(withoutPlacement("absolute bottom-0 left-0 right-0 w-full border-t")).toBe("w-full border-t");
    // a bar centred with a transform is centred with auto margins
    expect(withoutPlacement("fixed bottom-5 left-1/2 -translate-x-1/2 w-[92%]")).toBe("mb-5 w-[92%] mx-auto");
    // the space above it on the kit page is not the bar's
    expect(withoutPlacement("mt-auto mt-8 relative flex")).toBe("relative flex");
    // a pinned pill as wide as its tabs keeps that width, instead of stretching across the screen
    expect(withoutPlacement("fixed bottom-6 left-1/2 -translate-x-1/2 flex rounded-full px-3")).toBe("w-fit mb-6 flex rounded-full px-3 mx-auto");
    expect(withoutPlacement("fixed bottom-4 left-4 flex")).toBe("w-fit mb-4 ml-4 flex");
  });
});
