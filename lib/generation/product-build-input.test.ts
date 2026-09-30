import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ stream: vi.fn() }));
vi.mock("@/lib/ai/provider", () => ({ generateScreenBuilderContentStream: mocks.stream, generateScreenBuilderContent: vi.fn() }));
import { buildScreenCode } from "./service";
import { designerFixture, functionalFixture } from "@/lib/product-planning/test-fixtures";
import { bindApprovedScreenPlans } from "@/lib/product-planning/screen-plan-contract";
import { recreationFrameChrome } from "@/lib/product-planning/recreation-frames";

beforeEach(() => mocks.stream.mockImplementation(async function* () { yield "<main>Screen</main>"; }));
describe("actual builder input contracts", () => {
  it("sends source pixels and frame two to the builder for a supplied state, without cloning", async () => {
    const state = designerFixture(); state.input.imageReferenceMode = "recreate";
    state.scope!.status = "approved";
    state.scope!.manifest = [{ ...functionalFixture(), referenceScreenIndex: 1 }, {
      ...functionalFixture("state:payment", "Choose payment", 1), kind: "state", parentStableKey: "screen:onboarding",
      stateKey: "payment", triggerLabel: "Change method", editInstruction: "Floating payment pills over blurred background", referenceScreenIndex: 2,
    }];
    const plans = bindApprovedScreenPlans(state, undefined, state.scope!.manifest.map(item => ({ name: item.name, type: "detail", description: item.description })), 2);
    expect(plans).toHaveLength(2); expect(plans.every(plan => plan.stateVariants.length === 0)).toBe(true);
    const chrome = recreationFrameChrome(plans);
    expect(chrome.navigationPlan.enabled).toBe(false);
    const image = { data: "actual-supplied-image-data", mimeType: "image/png" };
    await buildScreenCode({ screenPlan: chrome.screens[1], prompt: "Recreate the two supplied frames", image, referenceMode: "user_recreate",
      requiresBottomNav: chrome.requiresBottomNav, navigationPlan: chrome.navigationPlan, navigationArchitecture: chrome.navigationArchitecture });
    const input = mocks.stream.mock.calls.at(-1)![0];
    expect(input.contents.parts).toContainEqual({ inlineData: image });
    expect(JSON.stringify(input.contents.parts)).toContain("visible screen 2 of 2");
    expect(input.configOverride.systemInstruction).toContain("Ignore generic chrome categories");
    expect(() => bindApprovedScreenPlans(state, undefined, plans, 1)).toThrow(/observed source/);
  });
  it("passes a local image to the builder with explicit project-preserving authority", async () => {
    const image = { data: "local-layout", mimeType: "image/png" };
    await buildScreenCode({ screenPlan: { name: "Paywall", type: "detail", description: "Four plans" },
      prompt: "Add paywall", image, referenceScope: "screen", referenceMode: "user_style", requiresBottomNav: false });
    const parts = mocks.stream.mock.calls.at(-1)![0].contents.parts;
    expect(parts).toContainEqual({ inlineData: image });
    expect(JSON.stringify(parts)).toContain("Do not import its palette");
  });
  it("keeps product copy guidance after project context is dropped on a build retry", async () => {
    await buildScreenCode({ screenPlan: { name: "Today", type: "root", description: "Daily habit progress" }, prompt: "Habit tracker",
      referenceMode: "user_style", requiresBottomNav: false, projectContext: null,
      productContent: "Audience: everyday habit tracking. Use Add habit, Today, Weekly progress. No fabricated telemetry." });
    expect(JSON.stringify(mocks.stream.mock.calls.at(-1)![0].contents.parts)).toContain("No fabricated telemetry");
  });
  it("sends the shared visual family to the actual style builder", async () => {
    await buildScreenCode({ screenPlan: { name: "Calendar", type: "root", description: "Upcoming family events" },
      prompt: "Family planner", referenceMode: "user_style", requiresBottomNav: false,
      screenFamilyContract: {
        summary: "Quiet purple family planner", surfaces: "One focal surface; lists can stay flat",
        typography: "Compact headings", spacing: "Shared edge rail", navigation: "One shell",
        imagery: "No arbitrary stock faces", consistencyRules: ["Keep one button geometry"],
      } });
    expect(mocks.stream.mock.calls.at(-1)![0].configOverride.systemInstruction)
      .toContain("Quiet purple family planner");
  });
  describe("a style reference's components", () => {
    const component = { name: "calendar-strip", use: "A week selector at the top of a day view", html: '<div class="dg-surface-card">Mon</div>' };
    const memory = [
      "PROJECT REFERENCE DNA",
      "SEMANTIC COMPOSITION LIBRARY (principles, never source geometry)",
      "- focal-anchor ? Single focal anchor [primary; focal-anchor]: One first read",
      "  Adaptation rule: Choose a target-native focal object.",
      "  Craft bar: Only one region should carry peak scale or contrast.",
    ].join("\n");
    const screenPlan = { name: "Today", type: "root" as const, description: "Daily habit progress" };
    const built = () => mocks.stream.mock.calls.at(-1)![0];
    const memoryPart = () => (built().contents.parts as Array<{ text?: string }>).map((part) => part.text ?? "").find((text) => text.startsWith("Compact Existing Project Memory")) ?? "";

    it("go to the style builder, and the craft bars they replace stay out of its project memory", async () => {
      await buildScreenCode({ screenPlan, prompt: "Habit tracker", image: { data: "style-image", mimeType: "image/png" },
        referenceMode: "curated_style", requiresBottomNav: false, projectContext: memory, styleComponents: [component] });
      expect(built().configOverride.systemInstruction).toContain("STYLE COMPONENTS");
      expect(built().configOverride.systemInstruction).toContain("- calendar-strip — A week selector at the top of a day view — <div class=\"dg-surface-card\">Mon</div>");
      expect(memoryPart()).toContain("Adaptation rule: Choose a target-native focal object.");
      expect(memoryPart()).not.toContain("Craft bar:");

      // without them, the memory is sent whole
      await buildScreenCode({ screenPlan, prompt: "Habit tracker", image: { data: "style-image", mimeType: "image/png" },
        referenceMode: "curated_style", requiresBottomNav: false, projectContext: memory });
      expect(built().configOverride.systemInstruction).not.toContain("STYLE COMPONENTS");
      expect(memoryPart()).toContain("Craft bar: Only one region should carry peak scale or contrast.");
    });

    it("reach a prompt-only build too, as its component kit, and are ignored by Image to UI", async () => {
      // a project with no reference has a component kit, and every one of its screens is built from it
      await buildScreenCode({ screenPlan, prompt: "Habit tracker", referenceMode: "internal_style", requiresBottomNav: false,
        projectContext: memory, styleComponents: [component] });
      expect(built().configOverride.systemInstruction).toContain("- calendar-strip — A week selector at the top of a day view");
      expect(memoryPart()).not.toContain("Craft bar:");

      await buildScreenCode({ screenPlan, prompt: "Recreate this", image: { data: "source-image", mimeType: "image/png" },
        referenceMode: "user_recreate", requiresBottomNav: false, styleComponents: [component] });
      expect(built().configOverride.systemInstruction).not.toContain("STYLE COMPONENTS");
    });

    it("that are malformed are left out instead of breaking the build", async () => {
      await buildScreenCode({ screenPlan, prompt: "Habit tracker", image: { data: "style-image", mimeType: "image/png" },
        referenceMode: "curated_style", requiresBottomNav: false, projectContext: memory,
        styleComponents: [{ name: "", use: "x", html: "" }] as never });
      expect(built().configOverride.systemInstruction).not.toContain("STYLE COMPONENTS");
      expect(memoryPart()).toContain("Craft bar:");
    });
  });
});
