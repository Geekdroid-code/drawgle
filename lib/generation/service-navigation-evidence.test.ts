import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { enforceNavigationEvidencePolicy } from "@/lib/generation/service";

const productContract = (name: string) => ({
  version: 1 as const,
  user_job: `Use ${name} to complete its primary product task.`,
  default_lifecycle: "ready" as const,
  entry_condition: `The user intentionally opens ${name}.`,
  requirements: [
    { id: "screen-context", kind: "context" as const, purpose: "Provide the context needed to understand this destination." },
    { id: "screen-content", kind: "content" as const, purpose: "Provide complete product-specific information for the task." },
    { id: "primary-action", kind: "action" as const, purpose: "Let the user complete the primary task." },
  ],
  primary_action_id: "primary-action",
  action_outcome: "The requested product task is completed.",
  next_step: "Continue to the next appropriate product destination.",
});

const navigationPlan = (source: "explicit-prompt" | "reference") => ({
  version: 2 as const,
  decision: source === "reference" ? "reference-derived" as const : "project-native" as const,
  evidence: { source, reason: "Planner claimed this source." },
  enabled: true,
  kind: "bottom-tabs" as const,
  items: [
    { id: "one", label: "One", icon: "circle", role: "First area", availability: "generated" as const, linked_screen_name: "One" },
    { id: "two", label: "Two", icon: "circle", role: "Second area", availability: "planned" as const, linked_screen_name: null },
    { id: "three", label: "Three", icon: "circle", role: "Third area", availability: "planned" as const, linked_screen_name: null },
  ],
  design: {
    anatomy: "floating-dock" as const,
    width: "content" as const,
    labels: "always" as const,
    active_treatment: "icon-fill" as const,
    surface: "solid" as const,
    radius_px: 28,
    safe_area_offset_px: 12,
    item_gap_px: 4,
    icon_size_px: 20,
    border: true,
    elevation: "low" as const,
    center_action_item_id: null,
  },
  visual_brief: "Generic floating navigation.",
  screen_chrome: [
    { screen_name: "One", chrome: "bottom-tabs" as const, navigation_item_id: "one" },
  ],
});

const roadmap = (names: string[]) => ({
  requested_parent_count: names.length,
  items: names.map((name, index) => ({
    stable_key: name.toLowerCase().replace(/\s+/g, "-"),
    name,
    type: "root" as const,
    summary: `Durable product area for ${name}.`,
    priority: index === 0 ? "core" as const : "required" as const,
    explicitly_requested: true,
    dependency_keys: [],
    product_contract: productContract(name),
  })),
  initial_batch_keys: [names[0].toLowerCase().replace(/\s+/g, "-")],
});

describe("navigation evidence policy", () => {
  it("removes invented explicit-prompt evidence", () => {
    const result = enforceNavigationEvidencePolicy({
      navigationPlan: navigationPlan("explicit-prompt"),
      roadmap: roadmap(["Onboarding", "Chat Interface"]),
      prompt: "Create an onboarding screen and a chat interface.",
      mode: "style",
    });

    expect(result).toMatchObject({
      decision: "none",
      evidence: { source: null },
      enabled: false,
      items: [],
      design: null,
    });
  });

  it("reclassifies genuine peer roots as product architecture", () => {
    const result = enforceNavigationEvidencePolicy({
      navigationPlan: navigationPlan("explicit-prompt"),
      roadmap: roadmap(["Portfolio", "Markets", "Activity"]),
      prompt: "Create three screens for a brokerage product.",
      mode: "prompt",
    });

    expect(result).toMatchObject({
      decision: "project-native",
      evidence: { source: "product-architecture" },
      enabled: true,
    });
    expect(result?.evidence.reason).toContain("Portfolio, Markets, Activity");
  });

  it("does not let a style reference define information architecture", () => {
    const result = enforceNavigationEvidencePolicy({
      navigationPlan: navigationPlan("reference"),
      roadmap: roadmap(["Onboarding", "Chat Interface"]),
      prompt: "Use this image only as a visual style reference.",
      mode: "style",
    });

    expect(result?.decision).toBe("none");
    expect(result?.evidence.source).toBeNull();
    expect(result?.evidence.reason).toContain("style reference");
  });

  it("keeps literal user navigation requests", () => {
    const input = navigationPlan("explicit-prompt");
    const result = enforceNavigationEvidencePolicy({
      navigationPlan: input,
      roadmap: roadmap(["Portfolio", "Markets", "Activity"]),
      prompt: "Use a bottom tab bar for Portfolio, Markets, and Activity.",
      mode: "prompt",
    });
    expect(result).toBe(input);
  });
});
