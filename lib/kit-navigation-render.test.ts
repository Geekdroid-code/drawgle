import { describe, expect, it } from "vitest";

import { KIT_NAV_ITEM_SLOT } from "@/lib/kit-navigation";
import {
  applyNavigationDesignEdit,
  normalizeNavigationDesignContract,
  parseStoredNavigationPlan,
  renderDeterministicNavigationShell,
  withKitNavigation,
} from "@/lib/project-navigation";
import type { KitNavigation, NavigationPlan } from "@/lib/types";

const kit: KitNavigation = {
  bar: `<nav class="mx-4 mb-4 flex border-4 border-black bg-white">${KIT_NAV_ITEM_SLOT}${KIT_NAV_ITEM_SLOT}${KIT_NAV_ITEM_SLOT}</nav>`,
  activeItem: '<button class="flex-1 bg-black text-white" data-dg-nav-state="active" aria-label="{{label}}"><i data-lucide="{{icon}}"></i><span>{{label}}</span></button>',
  inactiveItem: '<button class="flex-1 bg-white" data-dg-nav-state="inactive" aria-label="{{label}}"><i data-lucide="{{icon}}"></i><span>{{label}}</span></button>',
};

const plan = (overrides: Partial<NavigationPlan> = {}): NavigationPlan => ({
  version: 2, decision: "project-native", enabled: true, kind: "bottom-tabs",
  evidence: { source: "approved-scope", reason: "Approved with the flow" },
  items: [
    { id: "drops", label: "Drops", icon: "zap", role: "Upcoming drops", availability: "generated", linkedScreenName: "Upcoming Drops" },
    { id: "calendar", label: "Calendar", icon: "calendar", role: "Release calendar", availability: "generated", linkedScreenName: "Release Calendar" },
    { id: "profile", label: "Profile", icon: "user", role: "Wallet and entries", availability: "planned", linkedScreenName: null },
  ],
  design: normalizeNavigationDesignContract(null, "Floating dock"),
  visualBrief: "Floating dock",
  screenChrome: [],
  ...overrides,
});

describe("a project whose component kit drew its bar", () => {
  it("shows the kit's bar with the project's own tabs on every screen, placed and cleared by the renderer", () => {
    const shell = renderDeterministicNavigationShell(withKitNavigation(plan(), kit));
    expect(shell).toContain('data-navigation-anatomy="kit"');
    expect(shell).toContain('<nav class="mx-4 mb-4 flex border-4 border-black bg-white">');
    expect(shell.match(/class="dg-nav-kit-item" data-nav-item-id=/g)).toHaveLength(3);
    expect(shell).toContain('data-nav-item-id="drops" data-nav-availability="generated" data-active="false" data-linked-screen-name="Upcoming Drops"');
    expect(shell).toContain('data-nav-item-id="profile" data-nav-availability="planned" data-active="false" aria-disabled="true"');
    expect(shell).toContain('data-lucide="calendar"');
    // the canvas shows each tab's current or other drawing by the data-active it already sets
    expect(shell).toContain('.dg-nav-kit-item[data-active="true"] > [data-dg-nav-state="inactive"]');
    expect(shell).toContain('.dg-nav-kit-item:not([data-active="true"]) > [data-dg-nav-state="active"]{display:none !important;}');
    // screens still leave room for it
    expect(shell).toContain("--dg-navigation-clearance:");
    // none of the built-in bar's own look
    expect(shell).not.toContain("backdrop-filter");
    expect(shell).not.toContain('class="dg-nav-item');
  });

  it("keeps the kit's bar when the plan is normalized or stored and read back", () => {
    const withKit = withKitNavigation(plan(), kit);
    expect(normalizeNavigationDesignContract(withKit.design).kit).toEqual(kit);
    expect(parseStoredNavigationPlan(JSON.parse(JSON.stringify(withKit))).design?.kit).toEqual(kit);
    // a stored bar that cannot be drawn is dropped, and the built-in bar is drawn instead
    const broken = { ...withKit, design: { ...withKit.design!, kit: { ...kit, bar: "<nav></nav>" } } };
    expect(parseStoredNavigationPlan(broken).design?.kit).toBeUndefined();
    expect(renderDeterministicNavigationShell(parseStoredNavigationPlan(broken))).toContain('data-navigation-anatomy="floating-dock"');
  });

  it("is given only to a plan with shared navigation that has no kit bar yet", () => {
    const withKit = withKitNavigation(plan(), kit);
    expect(withKit.design?.kit).toEqual(kit);
    expect(withKitNavigation(withKit, { ...kit, bar: `<div>${KIT_NAV_ITEM_SLOT}</div>` })).toBe(withKit);
    const off = plan({ enabled: false });
    expect(withKitNavigation(off, kit)).toBe(off);
    const v1 = plan({ version: 1 });
    expect(withKitNavigation(v1, kit)).toBe(v1);
    const bare = plan();
    expect(withKitNavigation(bare, null)).toBe(bare);
    expect(withKitNavigation(bare, { ...kit, activeItem: "" })).toBe(bare);
  });

  it("gives way to the built-in bars when the person asks for a look, and keeps it for a rename", () => {
    const withKit = withKitNavigation(plan(), kit);
    expect(applyNavigationDesignEdit(withKit, "make the nav glass").design?.kit).toBeUndefined();
    const renamed = applyNavigationDesignEdit(withKit, 'rename "Drops" to "Releases"');
    expect(renamed.design?.kit).toEqual(kit);
    expect(renderDeterministicNavigationShell(renamed)).toContain("<span>Releases</span>");
  });
});
