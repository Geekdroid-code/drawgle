import { describe, expect, it } from "vitest";

import { normalizeAndValidateScreenLayoutRoles } from "@/lib/generation/screen-layout-roles";
import type { ScreenPlan } from "@/lib/types";

const screenPlan: ScreenPlan = {
  name: "Pet Care Home",
  type: "root",
  description: "A complete pet-care home.",
  productContract: {
    version: 1,
    userJob: "Understand the pet's care context and book the next needed service.",
    defaultLifecycle: "ready",
    entryCondition: "The owner opens the app with a selected pet.",
    requirements: [
      { id: "pet-context", kind: "context", purpose: "Identify the selected pet and current care context." },
      { id: "care-options", kind: "content", purpose: "Present useful grooming and veterinary service options." },
      { id: "book-care", kind: "action", purpose: "Let the owner begin a care booking." },
    ],
    primaryActionId: "book-care",
    actionOutcome: "A suitable pet-care booking flow begins.",
    nextStep: "Choose a provider and appointment time.",
  },
  layoutContract: {
    version: 3,
    viewportPlan: "Header and care options fit the first fold.",
    focalHierarchy: "Pet context, options, action.",
    sectionRhythm: "Canonical macro gaps.",
    componentDensity: "Readable service choices.",
    ctaPolicy: "One booking action.",
    antiPatterns: [],
    regions: [
      { id: "pet-header", purpose: "Selected pet context", contentKind: "header", productRequirementIds: ["pet-context"] },
      { id: "care-services", purpose: "Care options and booking", contentKind: "list", productRequirementIds: ["care-options", "book-care"] },
    ],
  },
  referenceTransfer: {
    version: 2,
    layoutSource: "screen-purpose",
    preserve: [],
    adapt: [],
    reject: [],
    rationale: "Target product owns content.",
    targetCapabilities: [],
    semanticDecisions: [],
    premiumQualityTargets: [],
    sourceContentQuarantine: ["Calories", "Daily workout"],
  },
};

describe("generated screen layout roles", () => {
  it("applies canonical spacing only to explicit valid markers", () => {
    const result = normalizeAndValidateScreenLayoutRoles({
      screenPlan,
      code: `<div class="w-full min-h-screen"><main data-drawgle-content-rail="true"><div class="flex flex-col" data-drawgle-section-stack="true"><section data-drawgle-region="pet-header">Milo's care</section><section data-drawgle-region="care-services">Grooming and vet visits <button>Book care</button></section></div></main></div>`,
    });
    expect(result.valid).toBe(true);
    expect(result.code).toContain("dg-screen-padding");
    expect(result.code).toContain("dg-section-gap");
  });

  it("fails missing regions and quarantined source-domain copy", () => {
    const result = normalizeAndValidateScreenLayoutRoles({
      screenPlan,
      code: `<div class="w-full min-h-screen"><main data-drawgle-content-rail="true"><div class="flex flex-col" data-drawgle-section-stack="true"><section data-drawgle-region="pet-header">Calories today</section></div></main></div>`,
    });
    expect(result.valid).toBe(false);
    expect(result.codes).toEqual(expect.arrayContaining(["missing_planned_region", "source_content_leak"]));
  });

  it("does not mistake the default horizontal flex direction for a vertical section flow", () => {
    const result = normalizeAndValidateScreenLayoutRoles({
      screenPlan,
      code: `<div class="w-full min-h-screen"><main data-drawgle-content-rail="true"><div style="display:flex" data-drawgle-section-stack="true"><section data-drawgle-region="pet-header">Milo's care</section><section data-drawgle-region="care-services">Grooming and vet visits <button>Book care</button></section></div></main></div>`,
    });
    expect(result.valid).toBe(false);
    expect(result.codes).toContain("section_stack_not_flow");
  });
});
