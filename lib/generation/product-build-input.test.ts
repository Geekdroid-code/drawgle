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
});
