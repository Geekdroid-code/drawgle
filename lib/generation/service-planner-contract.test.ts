import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { generateContent } = vi.hoisted(() => ({
  generateContent: vi.fn(),
}));

vi.mock("@/lib/ai/gemini", () => ({
  createGeminiClient: () => ({ models: { generateContent } }),
}));

import {
  buildScreenCountContract,
  parsePlannerProjectBlueprint,
  planProjectBlueprint,
  planUiFlow,
} from "@/lib/generation/service";
import type {
  GenerationIntentContract,
  GenerationScopeContract,
} from "@/lib/types";

const promptCountIntent: GenerationIntentContract = {
  kind: "full_app",
  source: "prompt",
  reason: "The user explicitly requested three screens.",
  exactScreenCount: 3,
  maxInitialScreens: 5,
  explicitScreenCount: 3,
  referenceScreenCount: null,
  allowSharedNavigation: true,
  visibleNavigationHandling: "shared_navigation",
};

const promptCountScope: GenerationScopeContract = {
  version: 2,
  referenceMode: "user_style",
  promptScreenCount: 3,
  namedScreenCount: null,
  imageScreenCount: 3,
  finalScreenCount: 3,
  countSource: "prompt_count",
  confidence: "high",
  conflictResolution: null,
  allScreensRequested: false,
  reason: "The user explicitly requested three screens.",
  diagnostics: [],
  screens: [
    { index: 1, name: "Screen 1", kind: "screen" },
    { index: 2, name: "Screen 2", kind: "screen" },
    { index: 3, name: "Screen 3", kind: "screen" },
  ],
};

const malformedNavigationBlueprint = {
  requires_bottom_nav: true,
  navigation_architecture: {
    kind: "bottom-tabs-app",
    primary_navigation: "bottom-tabs",
    root_chrome: "bottom-tabs",
    detail_chrome: "top-bar-back",
    consistency_rules: ["Keep navigation placement consistent."],
    rationale: "Three peer support areas need persistent navigation.",
  },
  navigation_plan: {
    version: 2,
    decision: "project-native",
    evidence: {
      source: "product-architecture",
      reason: "The roadmap contains three peer root destinations.",
    },
    items: [
      { id: "inbox", label: "Inbox", icon: "messages-square", availability: "generated", linked_screen_name: "Support Inbox" },
      { id: "knowledge", label: "Knowledge", icon: "book-open", availability: "generated", linked_screen_name: "Knowledge Search" },
      { id: "activity", label: "Activity", icon: "history", availability: "generated", linked_screen_name: "Resolution Activity" },
    ],
    design: {
      anatomy: "fixed-tab-rail",
      width: "full",
      labels: "always",
      active_treatment: "tint",
      surface: "solid",
      radius_px: 0,
      safe_area_offset_px: 8,
      item_gap_px: 4,
      icon_size_px: 20,
      border: true,
      elevation: "low",
      center_action_item_id: null,
    },
    visual_brief: "A stable support workspace tab rail.",
    screen_chrome: [
      { chrome: "bottom-tabs", navigation_item_id: "inbox" },
      { screenName: "Knowledge Search", chrome: "bottom-tabs", navigationItemId: "knowledge" },
    ],
  },
  roadmap: {
    requested_parent_count: 3,
    items: [
      { stable_key: "screen:support-inbox", name: "Support Inbox", type: "root", summary: "Triage and continue active customer support conversations.", priority: "core", explicitly_requested: true, dependency_keys: [] },
      { stable_key: "screen:knowledge-search", name: "Knowledge Search", type: "root", summary: "Find approved answers and reusable troubleshooting guidance.", priority: "core", explicitly_requested: true, dependency_keys: [] },
      { stable_key: "screen:resolution-activity", name: "Resolution Activity", type: "root", summary: "Review escalations, outcomes, and recently resolved cases.", priority: "core", explicitly_requested: true, dependency_keys: [] },
    ],
    initial_batch_keys: ["screen:support-inbox", "screen:knowledge-search", "screen:resolution-activity"],
  },
  charter: {
    originalPrompt: "Build an AI assistant for support chat with three core screens.",
    imageReferenceSummary: "Use the uploaded image only as visual direction.",
    appType: "AI customer support workspace",
    targetAudience: "Customer support agents",
    navigationModel: "Three peer root workspaces",
    keyFeatures: ["Conversation triage", "Knowledge search", "Resolution history"],
    designRationale: "Use a compact mobile hierarchy with clear task separation and consistent navigation.",
  },
};

const completeScreenBrief = ({
  name,
  stableKey,
  visualGoal,
  components,
}: {
  name: string;
  stableKey: string;
  visualGoal: string;
  components: string;
}) => ({
  name,
  type: "root",
  roadmap_stable_key: stableKey,
  description: [
    "Reference DNA: Preserve the approved charcoal material system, electric-blue emphasis, restrained border contrast, compact icon wells, disciplined typography, and dense but readable support-workspace rhythm. Treat these as visual-system invariants only; the source screenshot does not supply this screen's section order, hero scaffold, card topology, or domain content.",
    `Visual Goal: ${visualGoal} Establish one unmistakable first read, then a quieter supporting hierarchy that helps an agent decide what to do next without scanning equal-weight cards.`,
    `Layout Anatomy: Use a 390px task-native mobile composition with a compact top context region, a dominant working surface, and secondary controls grouped by their actual workflow relationship. The content rail scrolls vertically when needed, preserves deliberate macro-versus-micro spacing, and leaves renderer-owned navigation clearance untouched. ${components}`,
    `Key Components: ${components} Every row and control has min-width protection, intentional wrapping or truncation, visible state feedback, and enough height for real support copy. Avoid empty visual shells, decorative metric grids, and generic dashboard modules that do not advance this screen's job.`,
    "Visual Styling: Use layered charcoal surfaces with a small, legible elevation set, electric-blue focus and selection cues, quiet neutral metadata, crisp Lucide-weight iconography, and the approved outer/inner/pill radius roles. Preserve readable contrast and material depth without copying reference coordinates or literal decorative geometry.",
    "Interaction Notes: Keep the primary action obvious but subordinate to ongoing work until commitment is required. Selection, filtering, search, and drill-in states must preserve context, expose clear feedback, and never introduce a second primary navigation shell inside screen content.",
    "Must Preserve: Maintain the target task as layout authority, one dominant first read, strong macro/micro spacing contrast, real-content resilience, 390px viewport fit, safe scrolling, renderer-owned shared-navigation clearance, token-backed styling, and zero source-domain or source-layout cloning.",
  ].join("\n"),
  layout_contract: {
    viewport_plan: "Compact top context, flexible working surface, vertical scroll when required, and renderer-owned bottom navigation clearance.",
    focal_hierarchy: "The current support task dominates; filters and metadata remain visibly quieter.",
    section_rhythm: "Use large gaps between workflow regions and tight gaps inside rows, labels, and control groups.",
    component_density: "Favor information-dense but readable rows with explicit wrapping and minimum touch targets.",
    cta_policy: "Use one peak-emphasis action only when the workflow has a true commitment step.",
    anti_patterns: ["No equal-weight dashboard card grid.", "No copied source hero or connector scaffold."],
  },
  reference_transfer: {
    layout_source: "screen-purpose",
    preserve: ["Charcoal material depth", "Electric-blue emphasis", "Compact icon rhythm"],
    adapt: ["Translate the approved hierarchy and density into the target support workflow."],
    reject: ["Source section order", "Source hero scaffold", "Source card topology"],
    rationale: "The support task owns layout while portable visual craft creates family resemblance.",
    target_capabilities: ["conversation"],
    semantic_decisions: [],
    premium_quality_targets: ["Create one dominant first read and a quieter supporting hierarchy."],
  },
  chrome_policy: {
    chrome: "bottom-tabs",
    show_primary_navigation: true,
    shows_back_button: false,
  },
  asset_needs: [],
  state_variants: [],
});

describe("planner contract resilience", () => {
  beforeEach(() => {
    generateContent.mockReset();
  });

  it("does not promote count-only placeholders into locked screen names", () => {
    const contract = buildScreenCountContract({
      intentContract: promptCountIntent,
      explicitScreenSections: [],
      scopeContract: promptCountScope,
    });

    expect(contract).toMatchObject({
      exactCount: 3,
      source: "prompt_count",
    });
    expect(contract.namedScreens).toBeUndefined();
  });

  it("normalizes harmless navigation omissions without discarding the blueprint", () => {
    const parsed = parsePlannerProjectBlueprint(malformedNavigationBlueprint);

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    expect(parsed.data.navigation_plan?.items.map((item) => item.role)).toEqual([
      "Inbox destination",
      "Knowledge destination",
      "Activity destination",
    ]);
    expect(parsed.data.navigation_plan?.screen_chrome).toEqual([
      {
        screen_name: "Support Inbox",
        chrome: "bottom-tabs",
        navigation_item_id: "inbox",
      },
      {
        screen_name: "Knowledge Search",
        chrome: "bottom-tabs",
        navigation_item_id: "knowledge",
      },
    ]);
  });

  it("continues from a normalized blueprint into distinct screen briefs", async () => {
    generateContent
      .mockResolvedValueOnce({
        text: JSON.stringify(malformedNavigationBlueprint),
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({
          screens: [
            completeScreenBrief({
              name: "Support Inbox",
              stableKey: "screen:support-inbox",
              visualGoal: "Triage active support conversations by urgency, ownership, and waiting time.",
              components: "Use a conversation queue, urgency markers, ownership badges, search, and compact status filters.",
            }),
            completeScreenBrief({
              name: "Knowledge Search",
              stableKey: "screen:knowledge-search",
              visualGoal: "Find approved support answers quickly and understand their source confidence.",
              components: "Use a query field, source filters, ranked answer previews, confidence metadata, and copy actions.",
            }),
            completeScreenBrief({
              name: "Resolution Activity",
              stableKey: "screen:resolution-activity",
              visualGoal: "Review escalations, outcomes, and recently resolved cases as an auditable activity stream.",
              components: "Use a chronological activity ledger, outcome badges, agent labels, filters, and case drill-in affordances.",
            }),
          ],
        }),
      });

    const plan = await planUiFlow({
      prompt: "Build an AI assistant for support chat with 3 core screens",
      referenceMode: "user_style",
      scopeContract: promptCountScope,
      projectContext: "New project; no prior screens exist.",
    });

    expect(generateContent).toHaveBeenCalledTimes(2);
    expect(plan.screens.map((screen) => screen.name)).toEqual([
      "Support Inbox",
      "Knowledge Search",
      "Resolution Activity",
    ]);
    expect(plan.screens.map((screen) => screen.name)).not.toContain("Screen 1");
    expect(plan.screens.every((screen) => !screen.description.includes("Planner Brief"))).toBe(true);
  });

  it("returns ordered planning seeds without invoking the detailed screen planner", async () => {
    generateContent.mockResolvedValueOnce({ text: JSON.stringify(malformedNavigationBlueprint) });

    const blueprint = await planProjectBlueprint({
      prompt: "Build an AI assistant for support chat with 3 core screens",
      referenceMode: "user_style",
      scopeContract: promptCountScope,
      projectContext: "New project; no prior screens exist.",
    });

    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(blueprint.version).toBe(1);
    expect(blueprint.screenSeeds.map((seed) => seed.name)).toEqual([
      "Support Inbox",
      "Knowledge Search",
      "Resolution Activity",
    ]);
    expect(blueprint.screenSeeds[0]).toMatchObject({
      roadmapStableKey: "screen:support-inbox",
      roadmapPriority: "core",
      explicitlyRequested: true,
      dependencyKeys: [],
    });
    expect(blueprint.screenSeeds.every((seed) => !seed.summary.includes("Layout Anatomy:"))).toBe(true);
  });

  it("repairs weak screen briefs once and then fails before build", async () => {
    const weakScreens = {
      screens: [{
        name: "Support Inbox",
        type: "root",
        description: "A short support inbox summary.",
        asset_needs: [],
      }],
    };
    generateContent
      .mockResolvedValueOnce({ text: JSON.stringify(malformedNavigationBlueprint) })
      .mockResolvedValueOnce({ text: JSON.stringify(weakScreens) })
      .mockResolvedValueOnce({ text: JSON.stringify(weakScreens) });

    await expect(planUiFlow({
      prompt: "Build an AI assistant for support chat with 3 core screens",
      referenceMode: "user_style",
      scopeContract: promptCountScope,
      projectContext: "New project; no prior screens exist.",
    })).rejects.toThrow("no builder-grade screen briefs after one repair attempt");

    expect(generateContent).toHaveBeenCalledTimes(3);
  });

  it("fails safely instead of manufacturing generic screens after a bounded repair", async () => {
    generateContent
      .mockResolvedValueOnce({ text: "{}" })
      .mockResolvedValueOnce({ text: "{}" });

    await expect(planUiFlow({
      prompt: "Build an AI assistant for support chat with 3 core screens",
      referenceMode: "user_style",
      scopeContract: promptCountScope,
      projectContext: "New project; no prior screens exist.",
    })).rejects.toThrow("Project blueprint failed schema validation after one repair attempt");

    expect(generateContent).toHaveBeenCalledTimes(2);
  });
});
