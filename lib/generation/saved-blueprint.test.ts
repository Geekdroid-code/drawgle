import { describe, expect, it } from "vitest";
import { approveProductScope, proposeProductScope } from "@/lib/product-planning/model";
import { designerFixture, functionalFixture } from "@/lib/product-planning/test-fixtures";
import type { NavigationPlan, ProjectCharter } from "@/lib/types";
import { savedProjectBlueprint } from "./saved-blueprint";

const charter: ProjectCharter = {
  originalPrompt: "Tacozz T-shirt shop",
  appType: "T-shirt shop",
  targetAudience: "Shoppers",
  navigationModel: "Bottom dock",
  navigationArchitecture: {
    kind: "bottom-tabs-app", primaryNavigation: "bottom-tabs", rootChrome: "bottom-tabs", detailChrome: "top-bar-back",
    consistencyRules: [], rationale: "Peer areas",
  },
  keyFeatures: [],
  designRationale: "One calm system",
};
const navigation = (enabled: boolean): NavigationPlan => enabled
  ? {
      version: 2, decision: "project-native", enabled: true, kind: "bottom-tabs",
      evidence: { source: "product-architecture", reason: "Peer areas" },
      items: [{ id: "shop", label: "Shop", icon: "store", role: "Browse", availability: "generated", linkedScreenName: "Shop" }],
      design: null, visualBrief: "Dock", screenChrome: [],
    }
  : {
      version: 2, decision: "none", enabled: false, kind: "none",
      evidence: { source: null, reason: "No peer areas" }, items: [], design: null, visualBrief: "", screenChrome: [],
    };
const approved = (phase: "discovery" | "canvas" = "discovery") => {
  const base = designerFixture();
  base.scope!.manifest!.push(functionalFixture("screen:shop", "Shop", 1));
  return { ...approveProductScope(proposeProductScope(base), base.revision), phase };
};

describe("saved project blueprint", () => {
  it("rebuilds the blueprint from the approved flow and saved project state", () => {
    const blueprint = savedProjectBlueprint({ productPlanning: approved(), executionKeys: ["screen:shop"], charter, navigationPlan: navigation(true) });
    const roadmap = blueprint?.roadmap as { items: Array<{ stable_key: string; type: string }>; initial_batch_keys: string[] };

    expect(roadmap.items.map((item) => [item.stable_key, item.type])).toEqual([["screen:onboarding", "detail"], ["screen:shop", "root"]]);
    expect(roadmap.initial_batch_keys).toEqual(["screen:shop"]);
    expect((blueprint?.charter as ProjectCharter).keyFeatures).toEqual(["Welcome", "Shop"]);
    expect((blueprint?.navigation_architecture as { consistency_rules: string[] }).consistency_rules).toHaveLength(1);
  });

  it("keeps an approved flow's no-navigation decision, but lets a growing canvas project decide again", () => {
    expect(savedProjectBlueprint({ productPlanning: approved("discovery"), executionKeys: ["screen:shop"], charter, navigationPlan: navigation(false) }))
      .toMatchObject({ requires_bottom_nav: false, navigation_plan: { decision: "none", items: [] } });
    expect(savedProjectBlueprint({ productPlanning: approved("canvas"), executionKeys: ["screen:shop"], charter, navigationPlan: navigation(false) })).toBeNull();
    expect(savedProjectBlueprint({ productPlanning: approved("canvas"), executionKeys: ["screen:shop"], charter, navigationPlan: navigation(true) })).not.toBeNull();
  });

  it("returns null when saved state is missing, so the planner runs normally", () => {
    const productPlanning = approved();
    expect(savedProjectBlueprint({ productPlanning, executionKeys: ["screen:shop"], charter: null, navigationPlan: navigation(true) })).toBeNull();
    expect(savedProjectBlueprint({ productPlanning, executionKeys: ["screen:shop"], charter, navigationPlan: null })).toBeNull();
    expect(savedProjectBlueprint({ productPlanning, executionKeys: ["screen:shop"], charter: { ...charter, navigationArchitecture: null },
      navigationPlan: navigation(true) })).toBeNull();
    expect(savedProjectBlueprint({ productPlanning, executionKeys: ["state:unknown"], charter, navigationPlan: navigation(true) })).toBeNull();
  });

  it("keeps a complete creative direction within planner limits and drops an incomplete one", () => {
    const direction = {
      conceptName: "Soft cobalt", styleEssence: "Calm", colorStory: "Cobalt on cloud", typographyMood: "Friendly",
      surfaceLanguage: "Islands", iconographyStyle: "Line icons", compositionPrinciples: Array.from({ length: 14 }, (_, index) => `Rule ${index}`),
      signatureMoments: ["Focal card"], motionTone: "Bouncy", avoid: ["Side borders"],
    };
    const kept = savedProjectBlueprint({ productPlanning: approved(), executionKeys: ["screen:shop"],
      charter: { ...charter, creativeDirection: direction }, navigationPlan: navigation(true) });
    const dropped = savedProjectBlueprint({ productPlanning: approved(), executionKeys: ["screen:shop"],
      charter: { ...charter, creativeDirection: { ...direction, avoid: [] } }, navigationPlan: navigation(true) });

    expect((kept?.charter as ProjectCharter).creativeDirection?.compositionPrinciples).toHaveLength(10);
    expect((dropped?.charter as ProjectCharter).creativeDirection).toBeNull();
  });
});
