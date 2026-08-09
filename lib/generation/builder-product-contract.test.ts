import { describe, expect, it } from "vitest";

import { buildBuilderProjectContract, formatBuilderProjectContract } from "@/lib/generation/builder-product-contract";

describe("builder project contract", () => {
  it("contains compact product continuity without raw planner or duplicated prompt text", () => {
    const contract = buildBuilderProjectContract({
      charter: {
        originalPrompt: "SECRET ORIGINAL PROMPT",
        appType: "Invoice utility",
        targetAudience: "Freelancers",
        navigationModel: "Bottom tabs",
        keyFeatures: ["Invoices", "Clients"],
        designRationale: "Fast debt tracking",
      },
      screenFamily: {
        summary: "Quiet utility",
        surfaces: "Pale bordered cards",
        typography: "Compact hierarchy",
        spacing: "Clear macro/micro rhythm",
        navigation: "Product-owned tabs",
        imagery: "Optional",
        consistencyRules: ["Use one radius hierarchy"],
      },
      screenPlan: {
        name: "Invoice Detail",
        type: "detail",
        description: "Inspect an invoice and take action",
        layoutContract: {
          viewportPlan: "Header and content",
          focalHierarchy: "Amount first",
          sectionRhythm: "Grouped sections",
          componentDensity: "Compact",
          ctaPolicy: "One action",
          antiPatterns: [],
          regions: [{ id: "invoice-summary", purpose: "Invoice summary", contentKind: "focal" }],
        },
      },
    });
    const formatted = formatBuilderProjectContract(contract);
    expect(formatted).toContain("invoice-summary");
    expect(formatted).not.toContain("SECRET ORIGINAL PROMPT");
    expect(formatted).not.toContain("Planner Brief");
  });
});
