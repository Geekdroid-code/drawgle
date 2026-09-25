import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { scopePreparationKey } from "./scope-preparation";
import { designerFixture } from "./test-fixtures";

describe("approval-card preparation identity", () => {
  it("survives approval bookkeeping but expires on scope, reference, or shared design changes", () => {
    const proposed = designerFixture();
    proposed.scope!.status = "proposed";
    const shared = { designTokens: null, navigationPlan: null, charter: null };
    const keys = ["screen:onboarding"];
    const key = scopePreparationKey(proposed, keys, shared);
    const approved = { ...proposed, revision: proposed.revision + 2,
      scope: { ...proposed.scope!, status: "approved" as const, approvedRevision: proposed.revision + 2 } };
    expect(scopePreparationKey(approved, keys, shared)).toBe(key);
    expect(scopePreparationKey(approved, ["screen:shop"], shared)).not.toBe(key);
    expect(scopePreparationKey({ ...approved, contentRevision: (approved.contentRevision ?? 0) + 1 }, keys, shared)).not.toBe(key);
    expect(scopePreparationKey({ ...approved, experience: { ...approved.experience!, referenceHash: "new-pixels" } }, keys, shared)).not.toBe(key);
    expect(scopePreparationKey(approved, keys, { ...shared, navigationPlan: { version: 2 } as never })).not.toBe(key);
  });
});
