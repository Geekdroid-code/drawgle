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
  it("applies canonical spacing to every explicit marker without choosing the topology", () => {
    const result = normalizeAndValidateScreenLayoutRoles({
      screenPlan,
      code: `<div class="w-full min-h-screen"><header data-drawgle-content-rail="true">Milo's care</header><main data-drawgle-content-rail="true"><div class="grid" data-drawgle-section-stack="true"><section>Grooming</section><section>Vet visits</section></div></main></div>`,
    });
    expect(result.valid).toBe(true);
    expect(result.code.match(/dg-screen-padding/g)).toHaveLength(2);
    expect(result.code).toContain("dg-section-gap");
  });

  it("accepts an expressive composition with no planner-owned layout markers", () => {
    const result = normalizeAndValidateScreenLayoutRoles({
      screenPlan,
      code: `<div class="w-full min-h-screen"><main class="relative overflow-hidden"><section class="absolute inset-0">Milo's care</section><aside class="grid grid-cols-2">Grooming and vet visits <button>Book care</button></aside></main></div>`,
    });
    expect(result.valid).toBe(true);
    expect(result.changed).toBe(false);
    expect(result.codes).toEqual([]);
  });

  it("does not compound screen padding inside an existing canonical rail", () => {
    const result = normalizeAndValidateScreenLayoutRoles({
      screenPlan,
      code: `<div class="px-[var(--dg-mobile-layout-screen-margin)] space-y-[var(--dg-mobile-layout-section-gap)]">
        <section data-drawgle-content-rail="true" class="dg-screen-padding">
          <div data-drawgle-content-rail="true">Milestone medallions</div>
        </section>
      </div>`,
    });

    expect(result.valid).toBe(true);
    expect(result.code).not.toContain("dg-screen-padding");
  });

  it("adds section gap only to a real flex or grid owner without an existing canonical gap", () => {
    const result = normalizeAndValidateScreenLayoutRoles({
      screenPlan,
      code: `<div>
        <section data-drawgle-section-stack="true"><div>Header</div><div>Cards</div></section>
        <div class="flex flex-col" data-drawgle-section-stack="true"><section>One</section><section>Two</section></div>
        <div class="grid gap-[var(--dg-mobile-layout-section-gap)]" data-drawgle-section-stack="true"><section>Three</section><section>Four</section></div>
      </div>`,
    });

    expect(result.valid).toBe(true);
    expect(result.code.match(/dg-section-gap/g)).toHaveLength(1);
  });

  it("still blocks quarantined source-domain copy", () => {
    const result = normalizeAndValidateScreenLayoutRoles({
      screenPlan,
      code: `<div class="w-full min-h-screen"><main data-drawgle-content-rail="true"><section>Calories today</section></main></div>`,
    });
    expect(result.valid).toBe(false);
    expect(result.codes).toEqual(["source_content_leak"]);
  });
});
