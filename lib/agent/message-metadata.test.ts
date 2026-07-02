import { describe, expect, it } from "vitest";

import { readScreenPlanProposal } from "@/lib/agent/message-metadata";

const baseProposal = (): { screenPlanProposal: Record<string, unknown> } => ({
  screenPlanProposal: {
    prompt: "Create a dashboard",
    screenPlan: {
      name: "Dashboard",
      type: "root",
      description: "A dashboard screen",
    },
    requiresBottomNav: false,
    navigationArchitecture: {
      kind: "single",
      primaryNavigation: "none",
    },
    navigationPlan: {
      enabled: false,
      items: [],
    },
    expiresAt: "2099-01-01T00:00:00.000Z",
  },
});

describe("screen plan proposal metadata", () => {
  it("keeps old single-screen proposals buildable", () => {
    const proposal = readScreenPlanProposal(baseProposal());

    expect(proposal?.screenPlan.name).toBe("Dashboard");
    expect(proposal?.baseState).toBeNull();
    expect(proposal?.stateVariants).toEqual([]);
    expect(proposal?.selectedStateVariantIds).toEqual([]);
  });

  it("parses state-aware proposal metadata", () => {
    const metadata = baseProposal();
    metadata.screenPlanProposal = {
      ...metadata.screenPlanProposal,
      baseState: {
        stateKey: "transactions",
        stateLabel: "Transactions",
      },
      selectedStateVariantIds: ["analytics"],
      stateVariants: [
        {
          id: "analytics",
          stateKey: "analytics",
          stateLabel: "Analytics",
          stateRole: "tab",
          triggerLabel: "Analytics tab",
          description: "Shows analytics tab content.",
          editInstruction: "Activate Analytics and replace table content with charts.",
          defaultSelected: true,
        },
      ],
    };

    const proposal = readScreenPlanProposal(metadata);

    expect(proposal?.baseState).toEqual({ stateKey: "transactions", stateLabel: "Transactions" });
    expect(proposal?.stateVariants).toHaveLength(1);
    expect(proposal?.stateVariants?.[0]?.id).toBe("analytics");
    expect(proposal?.selectedStateVariantIds).toEqual(["analytics"]);
  });

  it("ignores invalid, duplicate, and overflow variant entries", () => {
    const metadata = baseProposal();
    const validVariant = (id: string) => ({
      id,
      stateKey: id,
      stateLabel: id,
      stateRole: "tab",
      triggerLabel: `${id} tab`,
      description: `${id} content`,
      editInstruction: `Activate ${id}.`,
      defaultSelected: true,
    });
    metadata.screenPlanProposal = {
      ...metadata.screenPlanProposal,
      stateVariants: [
        validVariant("one"),
        { id: "invalid" },
        validVariant("one"),
        validVariant("two"),
        validVariant("three"),
        validVariant("four"),
      ],
    };

    const proposal = readScreenPlanProposal(metadata);

    expect(proposal?.stateVariants?.map((variant) => variant.id)).toEqual(["one", "two", "three"]);
  });
});
