// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/ai/provider", () => ({ generateScreenBuilderContent: vi.fn() }));
import { generateScreenBuilderContent } from "@/lib/ai/provider";
import { acceptDestinations, redesignNavigation, resolveNavigationMembership, reviseNavigationDestinations } from "./navigation-design-edit";
import { extractKitNavigation } from "./kit-navigation-extraction";
import { defaultNavigationDesignContract, renderDeterministicNavigationShell } from "@/lib/project-navigation";
import type { NavigationPlan } from "@/lib/types";

const bar = (surface = "bg-white rounded-none", active = "text-black", inactive = "text-gray-500", icon = "house") => `<nav data-dg-nav="bar" class="flex ${surface}"><button data-dg-nav-item="Home" data-active="true" class="p-4 ${active}"><i data-lucide="${icon}"></i><span>Home</span></button><button data-dg-nav-item="Health" class="p-4 ${inactive}"><i data-lucide="activity"></i><span>Health</span></button><button data-dg-nav-item="Messages" class="p-4 ${inactive}"><i data-lucide="message-circle"></i><span>Messages</span></button></nav>`;
const plan: NavigationPlan = {
  version: 2, decision: "project-native", enabled: true, kind: "bottom-tabs", visualBrief: "Project's nav", screenChrome: [],
  design: { ...defaultNavigationDesignContract(), kit: extractKitNavigation(bar()).navigation },
  items: [
    { id: "home", label: "Home", icon: "house", role: "Overview", linkedScreenName: null },
    { id: "health", label: "Health", icon: "activity", role: "Health and training", linkedScreenName: null },
    { id: "messages", label: "Messages", icon: "message-circle", role: "Messages", linkedScreenName: null },
  ],
};
/** Two built tabs over a grey glass dock, as in a habit tracker whose bar the person called filthy. */
const habitPlan: NavigationPlan = {
  version: 2, decision: "project-native", enabled: true, kind: "bottom-tabs", visualBrief: "Compact floating pill with circular icon wells",
  evidence: { source: "approved-scope", reason: "Approved" }, screenChrome: [],
  design: { ...defaultNavigationDesignContract("glass"), labels: "hidden", activeTreatment: "tint" },
  items: [
    { id: "today", label: "Today", icon: "calendar", role: "Daily logging", linkedScreenName: "Dashboard", availability: "generated" },
    { id: "history", label: "History", icon: "bar-chart-3", role: "Trends", linkedScreenName: "Progress History", availability: "generated" },
  ],
};
const habitScreens = [
  { id: "dash", name: "Dashboard", code: '<main class="bg-yellow-300"><h1>Today</h1></main><nav class="fixed bottom-0 left-0 right-0 flex"><button><i data-lucide="calendar"></i>Old</button><button><i data-lucide="chart"></i>Bar</button></nav>', role: "Grid of habit cards", navigationItemId: "today", chrome: "bottom-tabs", parentScreenId: null },
  { id: "add", name: "Add Habit", code: "<form>New habit</form>", role: "Create a habit", navigationItemId: null, chrome: "top-bar-back", parentScreenId: null },
  { id: "hist", name: "Progress History", code: "<main>Milestones</main>", role: "Timeline", navigationItemId: "history", chrome: "bottom-tabs", parentScreenId: null },
];
const habitContext = { prompt: "improve this filthy nav", projectCharter: null, designTokens: null, screens: habitScreens,
  plannedScreens: [{ name: "Insights", description: "Weekly completion trends" }] };
const habitBar = (tabs: string[]) => `<nav data-dg-nav="bar" class="flex bg-black rounded-full p-2 gap-2">${tabs.map((label, index) => `<button data-dg-nav-item="${label}"${index === 0 ? ' data-active="true" class="rounded-full bg-yellow-300 text-black p-3"' : ' class="rounded-full text-white/60 p-3"'}><i data-lucide="circle"></i></button>`).join("")}</nav>`;
const context = { prompt: "create a new premium nav with modern style", projectCharter: null, designTokens: null,
  screens: [{ id: "training", name: "Training Tracker", code: '<main class="bg-yellow-100"><h1>Training</h1></main>' }] };
const complete = (code: string) => `${code}\n<!-- DRAWGLE_GENERATION_COMPLETE -->`;
const withNotes = (notes: unknown, code: string) => complete(`<nav-notes>${JSON.stringify(notes)}</nav-notes>\n${code}`);
const keep = (target: NavigationPlan) => target.items.map(({ id, label, icon, role, linkedScreenName }) => ({ id, label, icon, role, linkedScreenName }));
const call = (index = 0) => vi.mocked(generateScreenBuilderContent).mock.calls[index][0];
beforeEach(() => vi.resetAllMocks());

describe("navigation design generation", () => {
  it("keeps canonical icons in a restyle even when the designer tries to swap one", async () => {
    vi.mocked(generateScreenBuilderContent).mockResolvedValue(complete(bar("bg-black rounded-full", "bg-yellow-400", "text-white", "dumbbell")));
    const { plan: result } = await redesignNavigation(context, plan, "restyle");
    expect(result.items).toEqual(plan.items);
    const html = renderDeterministicNavigationShell(result);
    expect(html).toContain('data-lucide="house"');
    expect(html).toContain('data-lucide="activity"');
    expect(html).not.toContain('data-lucide="dumbbell"');
    expect(html).toContain("rounded-full");
    expect(call().contents).toContain("bg-yellow-100");
  });
  it("retries an unchanged redesign once and then rejects it", async () => {
    vi.mocked(generateScreenBuilderContent).mockResolvedValue(withNotes({ title: "Same", destinations: keep(plan) }, bar()));
    await expect(redesignNavigation(context, plan, "redesign")).rejects.toThrow("materially change");
    expect(generateScreenBuilderContent).toHaveBeenCalledTimes(2);
  });
  it("rejects truncated output before it can become the shared component", async () => {
    vi.mocked(generateScreenBuilderContent).mockResolvedValue(`<nav-notes>${JSON.stringify({ destinations: keep(plan) })}</nav-notes><nav data-dg-nav="bar"><button>`);
    await expect(redesignNavigation(context, plan, "redesign")).rejects.toThrow("incomplete");
    expect(generateScreenBuilderContent).toHaveBeenCalledTimes(2);
  });
  it("lets a redesign add the tabs the app needs, keeping built tabs and reporting what it made", async () => {
    vi.mocked(generateScreenBuilderContent).mockResolvedValue(withNotes({
      title: "Inverted accent dock", summary: "A black pill whose active tab is the yellow of the habit cards.",
      destinations: [...keep(habitPlan), { id: "insights", label: "Insights", icon: "LineChart", role: "Weekly trends", linkedScreenName: null }],
    }, habitBar(["Today", "History", "Insights"])));
    const { plan: result, notes } = await redesignNavigation(habitContext, habitPlan, "redesign");
    expect(result.items.map(item => item.id)).toEqual(["today", "history", "insights"]);
    expect(result.items[2]).toMatchObject({ icon: "line-chart", linkedScreenName: null, availability: "planned" });
    expect(result.items.slice(0, 2)).toEqual(habitPlan.items);
    expect(result.design?.kit?.bar).toContain("bg-black");
    expect(notes).toEqual({ title: "Inverted accent dock", summary: "A black pill whose active tab is the yellow of the habit cards." });
  });
  it("gives a redesign the product, the rejected bar in words, and the screens without their old bars", async () => {
    vi.mocked(generateScreenBuilderContent).mockResolvedValue(withNotes({ destinations: keep(habitPlan) }, habitBar(["Today", "History"])));
    await redesignNavigation(habitContext, habitPlan, "redesign");
    const { contents, configOverride } = call();
    expect(contents).toContain("Insights: Weekly completion trends");
    expect(contents).toContain("Add Habit: Create a habit (detail or form, never a tab)");
    expect(contents).toContain("Dashboard: Grid of habit cards (opens from the Today tab)");
    expect(contents).toContain("Compact floating pill");
    expect(contents).toContain("bg-yellow-300");
    expect(contents).not.toContain("Old");
    expect(contents).not.toContain("Current bar:");
    expect(configOverride?.systemInstruction).toContain("The person rejected the current bar: a glass-dock bar with 2 tabs (Today, History)");
    expect(configOverride?.temperature).toBeUndefined();
  });
  it("does not let a redesign drop a tab that opens a built screen", async () => {
    vi.mocked(generateScreenBuilderContent).mockResolvedValue(withNotes({
      destinations: [keep(habitPlan)[0], { id: "insights", label: "Insights", icon: "line-chart", role: "Trends", linkedScreenName: null }],
    }, habitBar(["Today", "Insights"])));
    await expect(redesignNavigation(habitContext, habitPlan, "redesign")).rejects.toThrow("Keep the History destination");
    expect(call(1).contents).toContain("Keep the History destination");
  });
  it("never turns a form or detail screen into a tab", () => {
    expect(() => acceptDestinations([...keep(habitPlan), { id: "add", label: "Add", icon: "plus", role: "Add a habit", linkedScreenName: "Add Habit" }],
      habitPlan, habitScreens, "redesign")).toThrow("cannot be a tab");
    expect(() => acceptDestinations([...keep(habitPlan), { id: "me", label: "Me", icon: "user", role: "Account", linkedScreenName: "Settings" }],
      habitPlan, habitScreens, "redesign")).toThrow("not a built screen");
  });
  it("changes only the tabs for a tab request, and may remove a built one when asked", async () => {
    vi.mocked(generateScreenBuilderContent).mockResolvedValue(JSON.stringify({
      title: "Renamed and trimmed", summary: "Renamed Today to Habits and removed History.",
      destinations: [{ ...keep(habitPlan)[0], label: "Habits" }, { id: "insights", label: "Insights", icon: "line-chart", role: "Trends", linkedScreenName: null }],
    }));
    const { plan: result, notes } = await reviseNavigationDestinations({ ...habitContext, prompt: "rename Today to Habits and swap History for Insights" }, habitPlan);
    expect(result.items.map(item => [item.id, item.label])).toEqual([["today", "Habits"], ["insights", "Insights"]]);
    expect(result.design).toEqual(habitPlan.design);
    expect(notes.title).toBe("Renamed and trimmed");
  });
  it("accepts an existing tab assignment but ignores model-proposed replacement icons", async () => {
    vi.mocked(generateScreenBuilderContent).mockResolvedValue(JSON.stringify({ items: [{ id: "invented", icon: "dumbbell" }], assignments: [{ screenId: "training", itemId: "health" }] }));
    const result = await resolveNavigationMembership(context, plan, ["training"]);
    expect(result.items).toEqual(plan.items);
    expect(result.assignments).toEqual([{ screenId: "training", itemId: "health" }]);
  });
  it("rejects an invented tab assignment", async () => {
    vi.mocked(generateScreenBuilderContent).mockResolvedValue(JSON.stringify({ items: [], assignments: [{ screenId: "training", itemId: "dumbbell" }] }));
    await expect(resolveNavigationMembership(context, plan, ["training"])).rejects.toThrow("active tab");
  });
});
