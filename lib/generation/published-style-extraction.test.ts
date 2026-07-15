import { describe, expect, it } from "vitest";

import { extractPublishedConstructionKnowledge } from "@/lib/generation/published-style-extraction";

describe("published style construction extraction", () => {
  it("keeps portable layout anatomy from showcase HTML", () => {
    const result = extractPublishedConstructionKnowledge([
      {
        name: "Premium Dashboard",
        code: `<main class="relative"><section class="-mx-4 rounded-t-[32px] -mt-8 overflow-hidden"><div class="overflow-x-auto flex gap-3"><article class="min-w-[260px] shrink-0"></article></div><svg><path d="M0 0" /></svg></section></main>`,
      },
    ]);

    expect(result.layoutGrammar.join(" ")).toContain("overlap or edge anchoring");
    expect(result.layoutGrammar.join(" ")).toContain("partial-peek rail");
    expect(result.componentRecipes.join(" ")).toContain("visible SVG/CSS geometry");
    expect(result.evidence.some((item) => item.screens.includes("Premium Dashboard"))).toBe(true);
  });
});
