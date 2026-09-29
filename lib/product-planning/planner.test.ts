import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("@/lib/ai/gemini", () => ({ createGeminiClient: () => ({ models: { generateContent: mocks.generate } }) }));
import { planUiFlow } from "@/lib/generation/service";
import { approveProductScope, proposeProductScope } from "./model";
import { productFixture, designerFixture, functionalFixture } from "./test-fixtures";
import type { NavigationPlan, ProjectCharter } from "@/lib/types";

const savedCharter: ProjectCharter = {
  originalPrompt: "Tacozz T-shirt shop",
  appType: "Saved app type",
  targetAudience: "Customers shopping for T-shirts",
  navigationModel: "Three shopping destinations in a bottom dock",
  navigationArchitecture: {
    kind: "bottom-tabs-app", primaryNavigation: "bottom-tabs", rootChrome: "bottom-tabs", detailChrome: "top-bar-back",
    consistencyRules: ["Keep the dock on root screens"], rationale: "Peer shopping destinations",
  },
  keyFeatures: ["Browse", "Checkout"],
  designRationale: "Saved design rationale for the whole flow",
};
const savedNavigation: NavigationPlan = {
  version: 2, decision: "project-native", enabled: true, kind: "bottom-tabs",
  evidence: { source: "product-architecture", reason: "Shop, orders and profile are peer areas" },
  items: [
    { id: "shop", label: "Shop", icon: "store", role: "Browse products", availability: "generated", linkedScreenName: "Shop" },
    { id: "orders", label: "Orders", icon: "package", role: "Track purchases", availability: "planned", linkedScreenName: null },
    { id: "profile", label: "Profile", icon: "user", role: "Account details", availability: "planned", linkedScreenName: null },
  ],
  design: { anatomy: "floating-dock", width: "content", labels: "active-only", activeTreatment: "compact-chip", surface: "solid",
    radiusPx: 32, safeAreaOffsetPx: 16, itemGapPx: 8, iconSizePx: 22, border: false, elevation: "low", centerActionItemId: null },
  visualBrief: "Saved dock",
  screenChrome: [{ screenName: "Shop", chrome: "bottom-tabs", navigationItemId: "shop" }],
};
const shopBrief = {
  name: "Shop", type: "root", roadmap_stable_key: "screen:shop",
  description: ["SCREEN PURPOSE: Browse the T-shirt catalog.", "INFORMATION HIERARCHY: Featured shirt, then the grid.",
    "LAYOUT ANATOMY: Header, featured card, two-column grid.", "KEY COMPONENTS: Size chips and product cards.",
    "PREMIUM DESIGN DECISIONS: One large featured shirt.", "INTERACTION: Tap a card to open the product.",
    "MUST PRESERVE: The featured shirt leads the screen."].join("\n"),
  layout_contract: { viewport_plan: "Scrolling catalog", focal_hierarchy: "Featured shirt first", section_rhythm: "32px between sections",
    component_density: "Two columns", cta_policy: "No primary CTA", anti_patterns: [] },
  reference_transfer: { layout_source: "screen-purpose", preserve: [], adapt: [], reject: [], rationale: "Prompt-only screen." },
  chrome_policy: { chrome: "bottom-tabs", show_primary_navigation: true, shows_back_button: false },
  asset_needs: [],
  state_variants: [],
};
const laterBatch = () => {
  const base = designerFixture();
  base.scope!.manifest!.push(functionalFixture("screen:shop", "Shop", 1));
  return approveProductScope(proposeProductScope(base), base.revision);
};

describe("approved product snapshot into existing screen planner", () => {
  beforeEach(() => mocks.generate.mockReset());
  it("rejects unapproved product scope before any model or visual planning call", async () => {
    await expect(planUiFlow({ prompt: "Start", productPlanning: productFixture() })).rejects.toThrow(/approval/);
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("supplies full product truth and exact approved scope as separate authorities", async () => {
    mocks.generate.mockRejectedValueOnce(new Error("Captured planner request"));
    const state = approveProductScope(proposeProductScope(productFixture()), 0);
    await expect(planUiFlow({ prompt: "Design onboarding", productPlanning: state, referenceMode: "internal_style" })).rejects.toThrow("Captured planner request");
    const request = JSON.stringify(mocks.generate.mock.calls[0][0]);
    expect(request).toContain("AUTHORITATIVE PRODUCT BLUEPRINT");
    expect(request).toContain("APPROVED DESIGN SCOPE");
    expect(request).toContain("Orders");
    expect(request).toContain("Onboarding");
    expect(request).toContain("generate the selected output manifest");
  });
  it("keeps multi-screen recreation on the exact-recreate planner contract", async () => {
    mocks.generate.mockRejectedValueOnce(new Error("Captured planner request"));
    const base = productFixture();
    base.input = { ...base.input, imagePath: "reference.webp", imageReferenceMode: "recreate" };
    base.scope!.surfaceIds = ["onboarding", "shop", "cart"];
    const state = approveProductScope(proposeProductScope(base), 0);
    await expect(planUiFlow({ prompt: "Recreate three screens", productPlanning: state, referenceMode: "user_recreate" })).rejects.toThrow("Captured planner request");
    expect(JSON.stringify(mocks.generate.mock.calls[0][0])).toContain("exact_recreate");
  });
  it("plans one execution chunk against the full approved flow and experience", async () => {
    mocks.generate.mockRejectedValueOnce(new Error("Captured planner request"));
    const base = designerFixture();
    base.scope!.manifest!.push(functionalFixture("screen:shop", "Shop", 1));
    const state = approveProductScope(proposeProductScope(base), base.revision);
    await expect(planUiFlow({ prompt: "Design Welcome", productPlanning: state, productExecutionKeys: ["screen:onboarding"], referenceMode: "user_style" })).rejects.toThrow("Captured planner request");
    const request = JSON.stringify(mocks.generate.mock.calls[0][0]);
    expect(request).toContain("screen:shop");
    expect(request).toContain("EXECUTION SELECTION");
    expect(request).toContain("Product-led restrained shopping");
    expect(request).toContain("Return exactly 1 screen");
    expect(request).not.toContain("initial app planning is capped at 5 screens");
  });
  it("reuses the saved blueprint for a later batch and asks only for screen briefs", async () => {
    mocks.generate.mockRejectedValueOnce(new Error("Captured planner request"));
    await expect(planUiFlow({ prompt: "Design Shop", productPlanning: laterBatch(), productExecutionKeys: ["screen:shop"],
      referenceMode: "user_style", existingCharter: savedCharter, existingNavigationPlan: savedNavigation })).rejects.toThrow("Captured planner request");
    const request = mocks.generate.mock.calls[0][0];
    expect(request.config.systemInstruction).toContain("STEP: SCREEN BRIEFS ONLY");
    expect(request.config.systemInstruction).not.toContain("STEP: PROJECT BLUEPRINT ONLY");
    expect(JSON.stringify(request)).toContain("Approved Project Blueprint");
    expect(JSON.stringify(request)).toContain("Saved design rationale for the whole flow");
    expect(JSON.stringify(request)).toContain("screen:shop");
  });
  it("keeps the saved charter and navigation when it reuses the blueprint", async () => {
    mocks.generate.mockResolvedValue({ text: JSON.stringify({ screens: [shopBrief] }) });
    const plan = await planUiFlow({ prompt: "Design Shop", productPlanning: laterBatch(), productExecutionKeys: ["screen:shop"],
      referenceMode: "user_style", existingCharter: savedCharter, existingNavigationPlan: savedNavigation });
    expect(mocks.generate).toHaveBeenCalledTimes(1);
    expect(plan.screens.map((screen) => screen.name)).toEqual(["Shop"]);
    expect(plan.charter.designRationale).toBe("Saved design rationale for the whole flow");
    expect(plan.charter.navigationModel).toBe("Three shopping destinations in a bottom dock");
    expect(plan.navigationPlan.enabled).toBe(true);
    expect(plan.navigationPlan.items.map((item) => item.id)).toEqual(["shop", "orders", "profile"]);
  });
  it("plans a fresh blueprint when the project has no saved navigation yet", async () => {
    mocks.generate.mockRejectedValueOnce(new Error("Captured planner request"));
    await expect(planUiFlow({ prompt: "Design Shop", productPlanning: laterBatch(), productExecutionKeys: ["screen:shop"],
      referenceMode: "user_style", existingCharter: savedCharter, existingNavigationPlan: null })).rejects.toThrow("Captured planner request");
    expect(mocks.generate.mock.calls[0][0].config.systemInstruction).toContain("STEP: PROJECT BLUEPRINT ONLY");
  });
});
