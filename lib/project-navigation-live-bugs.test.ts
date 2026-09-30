import { describe, expect, it } from "vitest";

import {
  lucideIconName,
  normalizeNavigationPlan,
  removesMostOfTheScreen,
  renderDeterministicNavigationShell,
  sanitizeScreenCodeForSharedNavigation,
} from "@/lib/project-navigation";
import type { NavigationArchitecture, NavigationPlan, ScreenPlan } from "@/lib/types";

/**
 * Three faults the first live project showed (an invoice tracker, 2026-09-30): its Dashboard was saved empty, one
 * tab of its bar drew no icon, and its Home tab lost the screen it opens once the second batch was built.
 */

const dashboardPlan = { name: "Dashboard", type: "root", description: "", chromePolicy: { chrome: "bottom-tabs", showPrimaryNavigation: true }, navigationItemId: "home" } as unknown as ScreenPlan;

const row = (index: number) => `
      <!-- Activity Row ${index} -->
      <div class="flex items-center gap-3 p-4 dg-surface-card rounded-[var(--dg-radii-inner)]">
        <span class="w-10 h-10 rounded-full dg-surface-inset flex items-center justify-center"><i data-lucide="file-text"></i></span>
        <div class="flex-1 min-w-0"><p class="dg-type-body">Invoice #10${index}</p><p class="dg-type-caption">Paid</p></div>
        <span class="dg-type-body">$1,200</span>
      </div>`;

/** The shape of the Dashboard the builder wrote: comments throughout, and one before a floating button near the end. */
const dashboard = `<div class="w-full min-h-screen dg-bg-primary dg-text-high flex flex-col relative overflow-x-hidden">
  <!-- Content Wrapper -->
  <main class="dg-shared-nav-clearance flex-1 flex flex-col" data-drawgle-nav-clearance-owner="true">
    <!-- Header Section -->
    <header class="px-4 pt-4 flex items-center justify-between">
      <h1 class="dg-type-screen-title">Overview</h1>
      <button class="w-[48px] h-[48px] rounded-full dg-surface-card"><i data-lucide="bell"></i></button>
    </header>
    <!-- Recent Activity -->
    <section class="px-4 flex flex-col gap-2">${[1, 2, 3, 4].map(row).join("")}
    </section>
  </main>

  <!-- Create Invoice FAB - Positioned fixedly above the bottom nav clearance -->
  <div class="fixed bottom-[100px] right-[var(--dg-mobile-layout-screen-margin)] z-50">
    <button class="h-12 px-4 rounded-full dg-action-primary flex items-center gap-2">
      <i data-lucide="plus"></i><span class="dg-type-button-label">Create Invoice</span>
    </button>
  </div>
</div>`;

const elements = (code: string) => (code.match(/<[a-z][a-z0-9-]*\b/gi) ?? []).length;

describe("the screen's own navigation is removed, and nothing else", () => {
  it("keeps a screen whose comment mentions the bottom nav, with its floating button", () => {
    const sanitized = sanitizeScreenCodeForSharedNavigation(dashboard, dashboardPlan, { projectNavigationEnabled: true });
    // it used to come back as the empty root: the comment pattern ran from the first comment to the last
    expect(elements(sanitized)).toBe(elements(dashboard));
    expect(sanitized).toContain("Overview");
    expect(sanitized).toContain("Invoice #104");
    expect(sanitized).toContain("Create Invoice");
  });

  it("still removes a tab bar the screen drew for itself", () => {
    const withOwnBar = dashboard.replace("</main>", `</main>
  <!-- Bottom navigation -->
  <div class="fixed bottom-0 left-0 right-0 flex justify-around p-2 dg-surface-card">
    <button><i data-lucide="house"></i><span>Home</span></button>
    <button><i data-lucide="file-text"></i><span>Invoices</span></button>
    <button><i data-lucide="users"></i><span>Clients</span></button>
  </div>`);
    const sanitized = sanitizeScreenCodeForSharedNavigation(withOwnBar, dashboardPlan, { projectNavigationEnabled: true });
    expect(sanitized).not.toContain(">Clients<");
    expect(sanitized).toContain("Invoice #104");
  });

  it("keeps the screen as written when a removal would take most of it", () => {
    // a whole screen wrapped in one fixed, bottom-anchored container with its tabs inside it
    const wrapped = `<div class="fixed inset-0 bottom-0 flex flex-col">${dashboard}<nav class="flex"><button><i data-lucide="house"></i><span>Home</span></button><button><i data-lucide="users"></i><span>Clients</span></button><button><i data-lucide="file-text"></i><span>Invoices</span></button></nav></div>`;
    const sanitized = sanitizeScreenCodeForSharedNavigation(wrapped, dashboardPlan, { projectNavigationEnabled: true });
    expect(elements(sanitized)).toBeGreaterThanOrEqual(elements(wrapped) * 0.5);
    expect(sanitized).toContain("Invoice #104");
  });

  it("knows when cleaning a screen up took most of it", () => {
    expect(removesMostOfTheScreen(dashboard, `<div class="w-full min-h-screen"></div>`)).toBe(true);
    expect(removesMostOfTheScreen(dashboard, dashboard)).toBe(false);
    // a small screen is never judged by this: a handful of elements is too few to tell
    expect(removesMostOfTheScreen("<div><p>a</p></div>", "<div></div>")).toBe(false);
  });
});

describe("the bar's icons", () => {
  it("turns an icon component name into the name the runtime looks up", () => {
    expect(lucideIconName("FileText")).toBe("file-text");
    expect(lucideIconName("BarChart3")).toBe("bar-chart-3");
    expect(lucideIconName("LayoutDashboard")).toBe("layout-dashboard");
    expect(lucideIconName("UserCircle2")).toBe("user-circle-2");
    expect(lucideIconName("file-text")).toBe("file-text");
    expect(lucideIconName("users")).toBe("users");
    expect(lucideIconName("")).toBe("circle");
    expect(lucideIconName(null)).toBe("circle");
  });

  it("draws the tab whose icon the planner named as a component", () => {
    const plan: NavigationPlan = {
      version: 2, decision: "project-native", enabled: true, kind: "bottom-tabs",
      evidence: { source: "approved-scope", reason: "Approved with the flow" },
      items: [
        { id: "home", label: "Home", icon: "home", role: "Overview", availability: "generated", linkedScreenName: "Dashboard" },
        { id: "invoices", label: "Invoices", icon: "FileText", role: "Invoices", availability: "generated", linkedScreenName: "Invoice List" },
        { id: "clients", label: "Clients", icon: "users", role: "Clients", availability: "generated", linkedScreenName: "Clients" },
      ],
      design: { anatomy: "floating-dock", width: "inset", labels: "hidden", activeTreatment: "icon-fill", surface: "glass", radiusPx: 24,
        safeAreaOffsetPx: 16, itemGapPx: 12, iconSizePx: 22, border: true, elevation: "medium", centerActionItemId: null },
      visualBrief: "A floating capsule",
      screenChrome: [],
    };
    const shell = renderDeterministicNavigationShell(plan);
    expect(shell).toContain('data-lucide="file-text"');
    expect(shell).not.toContain('data-lucide="filetext"');
  });
});

describe("a later batch of a product keeps the bar's earlier links", () => {
  const architecture: NavigationArchitecture = {
    kind: "bottom-tabs-app", primaryNavigation: "bottom-tabs", rootChrome: "bottom-tabs", detailChrome: "top-bar-back",
    consistencyRules: [], rationale: "Peer areas",
  };
  // what the first batch saved: Home opens the Dashboard it built; the other tabs' screens come in the next batch
  const savedAfterFirstBatch: NavigationPlan = {
    version: 2, decision: "project-native", enabled: true, kind: "bottom-tabs",
    evidence: { source: "approved-scope", reason: "Approved with the flow" },
    items: [
      { id: "home", label: "Home", icon: "home", role: "Overview of earnings and recent activity", availability: "generated", linkedScreenName: "Dashboard" },
      { id: "invoices", label: "Invoices", icon: "file-text", role: "Manage and track all billing documents", availability: "planned", linkedScreenName: null },
      { id: "clients", label: "Clients", icon: "users", role: "Access and manage the client directory", availability: "planned", linkedScreenName: null },
    ],
    design: null,
    visualBrief: "Typed navigation",
    screenChrome: [
      { screenName: "Invoice List", chrome: "bottom-tabs", navigationItemId: "invoices" },
      { screenName: "Clients", chrome: "bottom-tabs", navigationItemId: "clients" },
    ],
  };
  const secondBatch: ScreenPlan[] = [
    { name: "Invoice List", type: "root", description: "All invoices" },
    { name: "Create Invoice", type: "detail", description: "A new invoice" },
    { name: "Clients", type: "root", description: "The client directory" },
    { name: "Client Profile", type: "detail", description: "One client" },
  ];

  it("keeps Home opening the Dashboard built in the first batch", () => {
    const plan = normalizeNavigationPlan({ navigationPlan: savedAfterFirstBatch, screens: secondBatch, navigationArchitecture: architecture, strictScreenLinks: false });
    const byId = new Map(plan.items.map((item) => [item.id, item]));
    expect(byId.get("home")).toMatchObject({ availability: "generated", linkedScreenName: "Dashboard" });
    expect(byId.get("invoices")).toMatchObject({ availability: "generated", linkedScreenName: "Invoice List" });
    expect(byId.get("clients")).toMatchObject({ availability: "generated", linkedScreenName: "Clients" });
  });

  it("keeps the strict check when a flow is planned whole", () => {
    const plan = normalizeNavigationPlan({ navigationPlan: savedAfterFirstBatch, screens: secondBatch, navigationArchitecture: architecture, strictScreenLinks: true });
    expect(plan.items.find((item) => item.id === "home")?.availability).toBe("planned");
  });

  // The live sneaker app: the first batch built Upcoming Drops, and the second batch's words matching gave "Drops"
  // the Release Calendar, which the Calendar tab names, and left Calendar with nothing.
  const sneakerAfterFirstBatch: NavigationPlan = {
    version: 2, decision: "project-native", enabled: true, kind: "bottom-tabs",
    evidence: { source: "approved-scope", reason: "Approved with the flow" },
    items: [
      { id: "drops", label: "Drops", icon: "zap", role: "Upcoming sneaker drops and release countdowns", availability: "generated", linkedScreenName: "Upcoming Drops" },
      { id: "calendar", label: "Calendar", icon: "calendar", role: "Monthly calendar of sneaker releases", availability: "generated", linkedScreenName: "Release Calendar" },
      { id: "profile", label: "Profile", icon: "user", role: "Wallet, entries and preferences", availability: "generated", linkedScreenName: "Profile & Wallet" },
    ],
    design: null,
    visualBrief: "Typed navigation",
    screenChrome: [{ screenName: "Upcoming Drops", chrome: "bottom-tabs", navigationItemId: "drops" }],
  };
  const sneakerSecondBatch: ScreenPlan[] = [
    { name: "Sneaker Detail", type: "detail", description: "One sneaker drop with its release countdown and raffle" },
    { name: "Release Calendar", type: "root", description: "Upcoming sneaker drops and releases on a monthly calendar" },
    { name: "Profile & Wallet", type: "root", description: "Wallet, entries and preferences" },
  ];

  it("never guesses a tab onto a screen another tab names, and keeps its own earlier screen", () => {
    const plan = normalizeNavigationPlan({ navigationPlan: sneakerAfterFirstBatch, screens: sneakerSecondBatch, navigationArchitecture: architecture, strictScreenLinks: false });
    expect(plan.items.map((item) => [item.id, item.availability, item.linkedScreenName])).toEqual([
      ["drops", "generated", "Upcoming Drops"],
      ["calendar", "generated", "Release Calendar"],
      ["profile", "generated", "Profile & Wallet"],
    ]);
    // each screen of the batch is lit by its own tab
    const chrome = new Map(plan.screenChrome.map((entry) => [entry.screenName, entry.navigationItemId]));
    expect(chrome.get("Release Calendar")).toBe("calendar");
    expect(chrome.get("Profile & Wallet")).toBe("profile");
  });

  it("does not let a guess take another tab's named screen when a flow is planned whole either", () => {
    const whole = normalizeNavigationPlan({ navigationPlan: sneakerAfterFirstBatch, screens: sneakerSecondBatch, navigationArchitecture: architecture, strictScreenLinks: true });
    const drops = whole.items.find((item) => item.id === "drops");
    expect(drops?.linkedScreenName).not.toBe("Release Calendar");
    expect(whole.items.find((item) => item.id === "calendar")?.linkedScreenName).toBe("Release Calendar");
  });
});
