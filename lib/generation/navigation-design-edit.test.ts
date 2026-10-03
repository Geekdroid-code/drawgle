// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/ai/provider", () => ({ generateScreenBuilderContent: vi.fn() }));
import { generateScreenBuilderContent } from "@/lib/ai/provider";
import { redesignNavigation, resolveNavigationMembership } from "./navigation-design-edit";
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
const context = { prompt: "create a new premium nav with modern style", projectCharter: null, designTokens: null,
  screens: [{ id: "training", name: "Training Tracker", code: '<main class="bg-yellow-100"><h1>Training</h1></main>' }] };
const complete = (code: string) => `${code}\n<!-- DRAWGLE_GENERATION_COMPLETE -->`;
beforeEach(() => vi.resetAllMocks());

describe("navigation design generation", () => {
  it("keeps canonical icons even when the designer tries to swap one", async () => {
    vi.mocked(generateScreenBuilderContent).mockResolvedValue(complete(bar("bg-black rounded-full", "bg-yellow-400", "text-white", "dumbbell")));
    const result = await redesignNavigation(context, plan);
    expect(result.items).toEqual(plan.items);
    const html = renderDeterministicNavigationShell(result);
    expect(html).toContain('data-lucide="house"');
    expect(html).toContain('data-lucide="activity"');
    expect(html).not.toContain('data-lucide="dumbbell"');
    expect(html).toContain("rounded-full");
    expect(vi.mocked(generateScreenBuilderContent).mock.calls[0][0].contents).toContain("bg-yellow-100");
  });
  it("retries an unchanged redesign once and then rejects it", async () => {
    vi.mocked(generateScreenBuilderContent).mockResolvedValue(complete(bar()));
    await expect(redesignNavigation(context, plan)).rejects.toThrow("materially change");
    expect(generateScreenBuilderContent).toHaveBeenCalledTimes(2);
  });
  it("rejects truncated output before it can become the shared component", async () => {
    vi.mocked(generateScreenBuilderContent).mockResolvedValue('<nav data-dg-nav="bar"><button>');
    await expect(redesignNavigation(context, plan)).rejects.toThrow("incomplete");
    expect(generateScreenBuilderContent).toHaveBeenCalledTimes(2);
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
