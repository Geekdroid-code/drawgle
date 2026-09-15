import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  generate: vi.fn(),
  hasCredits: vi.fn(),
}));
vi.mock("@/lib/ai/gemini", () => ({
  createGeminiClient: () => ({
    models: {
      generateContent: mocks.generate,
    },
  }),
}));
vi.mock("@/lib/credits", () => ({
  adminCreditService: {
    hasCredits: mocks.hasCredits,
  },
}));
vi.mock("@/lib/supabase/queries", () => ({
  insertProjectMessage: vi.fn().mockResolvedValue({ id: "msg-123" }),
}));

import {
  applyProductPatch,
  approveProductScope,
  createProductPlanning,
  proposeProductScope,
  type ProductPlanning,
} from "./model";
import { productReferenceExecution } from "./reference-execution";
import { inspectProductReference } from "./inspect-reference";
import { prepareProductApproval } from "./approval";
import { functionalFixture } from "./test-fixtures";

const messageId = "11111111-1111-4111-8111-111111111111";

function setupPlanningStore(state: ProductPlanning) {
  let stored = state;
  return {
    from: (table: string) => {
      if (table === "projects") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: async () => ({ data: { product_planning: stored }, error: null }),
                maybeSingle: async () => ({ data: { product_planning: stored }, error: null }),
              }),
            }),
          }),
          update: (patch: { product_planning: ProductPlanning }) => {
            stored = patch.product_planning;
            return {
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    select: () => ({
                      maybeSingle: async () => ({ data: { id: "proj-1" }, error: null }),
                    }),
                  }),
                }),
              }),
            };
          },
        };
      }
      if (table === "generation_runs") {
        return {
          select: () => ({
            eq: () => ({
              in: () => ({
                limit: () => ({
                  maybeSingle: async () => ({ data: null, error: null }),
                }),
              }),
            }),
          }),
        };
      }
      return {};
    },
  };
}

describe("explicit no-reference mode (Phase 4)", () => {
  it("applies set_reference_preference to durable state and clears imagePath", () => {
    const base = createProductPlanning({
      imagePath: "old/image.webp",
      imageReferenceMode: "style",
      stylePresetSlug: null,
    });

    const patched = applyProductPatch(base, {
      operations: [
        {
          op: "set_reference_preference",
          mode: "none",
          evidence: "User selected: Proceed without external visual evidence",
        },
      ],
    }, messageId);

    expect(patched.input.referencePreference?.mode).toBe("none");
    expect(patched.input.referencePreference?.evidence).toContain("without external visual evidence");
    expect(patched.input.imagePath).toBeNull();
    expect(patched.input.referenceSource).toBe("none");

    const exec = productReferenceExecution(patched);
    expect(exec.policy).toBe("no_reference");
    expect(exec.mode).toBe("internal_style");
    expect(exec.imagePath).toBeNull();
    expect(exec.referenceId).toBeNull();
  });

  it("inspects reference in no-reference mode by synthesizing prompt-only experience without curated library", async () => {
    mocks.generate.mockResolvedValueOnce({
      text: JSON.stringify({
        observations: "Clean typography and spacious grid layout tailored to shopping.",
        direction: "Direct prompt-led minimal ecommerce.",
        informationHierarchy: "Clear product hierarchy.",
        navigation: "Bottom tab primary navigation.",
        adaptations: "Preserve explicit user tokens.",
      }),
    });

    const base = createProductPlanning({
      imagePath: null,
      imageReferenceMode: "style",
      stylePresetSlug: null,
    });

    const state = applyProductPatch(base, {
      operations: [
        {
          op: "put_fact",
          fact: {
            id: "cream-req",
            section: "preferences",
            label: "Palette",
            detail: "Cream background and no gradients",
            source: "user",
            evidence: "cream background and no gradients",
            links: [],
          },
        },
        {
          op: "set_reference_preference",
          mode: "none",
          evidence: "Explicit prompt-only direction requested.",
        },
      ],
    }, messageId);

    const inspected = await inspectProductReference({} as never, "owner-1", state, "Build shopping onboarding");
    expect(inspected.image).toBeNull();
    expect(inspected.experience.referenceId).toBeNull();
    expect(inspected.experience.referencePath).toBeNull();
    expect(inspected.experience.referenceHash).toBeNull();
    expect(inspected.experience.compatibility?.compatible).toBe(true);
    expect(inspected.experience.compatibility?.rationale).toContain("explicit no-reference mode");
  });

  it("proposes and approves scope with null referencePath in no-reference mode", () => {
    const base = createProductPlanning({
      imagePath: null,
      imageReferenceMode: "style",
      stylePresetSlug: null,
    });

    let state = applyProductPatch(base, {
      operations: [
        ...[
          ["identity", "shop", "Shop App", "Retail store"],
          ["actors", "users", "Shoppers", "Everyday buyers"],
          ["jobs", "browse", "Browse products", "Find items to purchase"],
          ["journeys", "buy", "Checkout", "Browse and checkout"],
          ["surfaces", "home", "Home", "Main feed"],
        ].map(([section, id, label, detail]) => ({
          op: "put_fact" as const,
          fact: { section: section as never, id, label, detail, source: "user" as const, evidence: "chat", links: [] },
        })),
        {
          op: "set_reference_preference",
          mode: "none",
          evidence: "No external reference",
        },
        {
          op: "set_scope",
          goal: "Launch home surface",
          surfaceIds: ["home"],
          rationale: "Initial release",
        },
      ],
    }, messageId);

    state.experience = {
      referencePath: null,
      referenceId: null,
      referenceHash: null,
      observations: "Prompt-driven layout",
      direction: "Functional ecommerce",
      informationHierarchy: "Primary catalog",
      navigation: "Bottom tabs",
      adaptations: "Preserve explicit tokens",
      compatibility: {
        compatible: true,
        conflicts: [],
        transfer: "Direct design requirements",
        rationale: "Explicit no-reference preference",
      },
    };

    state.scope!.manifest = [functionalFixture("screen:home", "Home", 0)];
    state.evidenceAssessment = { turnId: "test", mode: "product", productReady: true, experienceReady: true, gaps: [], delegation: "", rationale: "Ready" };

    const proposed = proposeProductScope(state);
    expect(proposed.scope?.status).toBe("proposed");

    const approved = approveProductScope(proposed, proposed.revision);
    expect(approved.scope?.status).toBe("approved");
    expect(productReferenceExecution(approved).policy).toBe("no_reference");
  });

  it("prepares product approval without requiring an image when referencePreference mode is none", async () => {
    mocks.hasCredits.mockResolvedValueOnce({ hasCredits: true, currentBalance: 50 });

    const base = createProductPlanning({
      imagePath: null,
      imageReferenceMode: "style",
      stylePresetSlug: null,
    });

    let state = applyProductPatch(base, {
      operations: [
        ...[
          ["identity", "shop", "Shop App", "Retail store"],
          ["actors", "users", "Shoppers", "Everyday buyers"],
          ["jobs", "browse", "Browse products", "Find items to purchase"],
          ["journeys", "buy", "Checkout", "Browse and checkout"],
          ["surfaces", "home", "Home", "Main feed"],
        ].map(([section, id, label, detail]) => ({
          op: "put_fact" as const,
          fact: { section: section as never, id, label, detail, source: "user" as const, evidence: "chat", links: [] },
        })),
        {
          op: "set_reference_preference",
          mode: "none",
          evidence: "No external reference",
        },
        {
          op: "set_scope",
          goal: "Launch home surface",
          surfaceIds: ["home"],
          rationale: "Initial release",
        },
      ],
    }, messageId);

    state.experience = {
      referencePath: null,
      referenceId: null,
      referenceHash: null,
      observations: "Prompt-driven layout",
      direction: "Functional ecommerce",
      informationHierarchy: "Primary catalog",
      navigation: "Bottom tabs",
      adaptations: "Preserve explicit tokens",
      compatibility: {
        compatible: true,
        conflicts: [],
        transfer: "Direct design requirements",
        rationale: "Explicit no-reference preference",
      },
    };

    state.scope!.manifest = [functionalFixture("screen:home", "Home", 0)];
    state.evidenceAssessment = { turnId: "test", mode: "product", productReady: true, experienceReady: true, gaps: [], delegation: "", rationale: "Ready" };
    state = proposeProductScope(state);

    const store = setupPlanningStore(state);
    const approval = await prepareProductApproval(store as never, "owner-1", {
      projectId: "22222222-2222-4222-8222-222222222222",
      productApproval: { revision: state.revision },
    });

    expect(approval).not.toBeNull();
    expect(approval?.snapshot.scope?.status).toBe("approved");
    expect(approval?.body.image).toBeNull();
    expect(approval?.body.scopeContract.referenceMode).toBe("internal_style");
  });
});
