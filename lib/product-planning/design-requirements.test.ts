import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import {
  compileDesignRequirements,
  explicitDesignRequirements,
  designRequirementsKey,
} from "./design-requirements";
import { applyProductPatch } from "./model";
import { preparedPlanKey } from "./prepared-plans";
import { designerFixture, productFixture } from "./test-fixtures";

const messageId = "11111111-1111-4111-8111-111111111111";

describe("design-requirements", () => {
  it("extracts only active user-evidenced preferences and constraints", () => {
    const base = productFixture();
    const withReqs = applyProductPatch(base, {
      operations: [
        {
          op: "put_fact",
          fact: {
            id: "cream-bg",
            section: "preferences",
            label: "Color palette",
            detail: "Use warm cream palette and no-gradients",
            source: "user",
            evidence: "User stated: I want warm cream palette and no gradients",
            links: [],
          },
        },
        {
          op: "put_fact",
          fact: {
            id: "tentative-font",
            section: "preferences",
            label: "Typography",
            detail: "Serif headings",
            source: "assumption",
            evidence: "",
            links: [],
          },
        },
      ],
    }, messageId);

    const reqs = explicitDesignRequirements(withReqs);
    expect(reqs).toHaveLength(1);
    expect(reqs[0].id).toBe("cream-bg");
    expect(compileDesignRequirements(withReqs)).toContain("warm cream palette");
    expect(compileDesignRequirements(withReqs)).not.toContain("Serif headings");
  });

  it("invalidates preparedPlanKey when explicit design requirements change", () => {
    const base = designerFixture();
    const key1 = preparedPlanKey(base, ["screen:onboarding"], null);

    const withReq = applyProductPatch(base, {
      operations: [
        {
          op: "put_fact",
          fact: {
            id: "cream-pref",
            section: "preferences",
            label: "Palette",
            detail: "Cream background",
            source: "user",
            evidence: "cream background",
            links: [],
          },
        },
      ],
    }, messageId);

    const key2 = preparedPlanKey(withReq, ["screen:onboarding"], null);
    expect(key1).not.toBe(key2);
  });

  it("suppresses design requirements when referenceMode is user_recreate even if project state is style", () => {
    const base = productFixture();
    base.input.imageReferenceMode = "style";
    const withReq = applyProductPatch(base, {
      operations: [
        {
          op: "put_fact",
          fact: {
            id: "cream-pref",
            section: "preferences",
            label: "Palette",
            detail: "Cream background",
            source: "user",
            evidence: "cream background",
            links: [],
          },
        },
      ],
    }, messageId);

    expect(compileDesignRequirements(withReq)).toContain("Cream background");
    expect(compileDesignRequirements(withReq, "user_recreate")).toBeNull();
  });
});
