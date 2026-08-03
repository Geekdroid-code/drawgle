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
            {
              name: "Support Inbox",
              type: "root",
              roadmap_stable_key: "screen:support-inbox",
              description: "Reference DNA: Preserve the approved dark material system.\nVisual Goal: Triage active support conversations.\nLayout Anatomy: Prioritized conversation queue beside status filters.\nKey Components: Queue rows, urgency markers, ownership badges, and search.\nVisual Styling: Dense charcoal surfaces with electric-blue focus states.\nInteraction Notes: Selecting a row opens the active conversation.\nMust Preserve: Fast scanning and clear escalation priority.",
              asset_needs: [],
              state_variants: [],
            },
            {
              name: "Knowledge Search",
              type: "root",
              roadmap_stable_key: "screen:knowledge-search",
              description: "Reference DNA: Preserve the approved dark material system.\nVisual Goal: Find reliable support answers quickly.\nLayout Anatomy: Search-led hierarchy with ranked answer previews.\nKey Components: Query field, source filters, answer cards, and copy actions.\nVisual Styling: Quiet charcoal reading surfaces with blue relevance cues.\nInteraction Notes: Refine results without losing the current query.\nMust Preserve: Source confidence and readable answer hierarchy.",
              asset_needs: [],
              state_variants: [],
            },
            {
              name: "Resolution Activity",
              type: "root",
              roadmap_stable_key: "screen:resolution-activity",
              description: "Reference DNA: Preserve the approved dark material system.\nVisual Goal: Review case outcomes and escalations.\nLayout Anatomy: Chronological resolution ledger with outcome summaries.\nKey Components: Activity timeline, outcome badges, agent labels, and filters.\nVisual Styling: Structured charcoal rows with restrained semantic colors.\nInteraction Notes: Filter activity and open a completed case.\nMust Preserve: Audit clarity and distinct outcome states.",
              asset_needs: [],
              state_variants: [],
            },
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
