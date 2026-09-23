import { describe, expect, it } from "vitest";
import { compileProductSpecification, renderProductSpecification } from "./product-spec";

const item = (key: string) => ({ stableKey: key, kind: "screen", name: "Same name", description: `Purpose ${key}`,
  surfaceIds: [key], journeyIds: ["journey"], decisionIds: [], dependencyKeys: ["outside"],
  actions: [{ label: "Continue", destinationKey: "outside", outcome: "Continue externally" }],
  information: "A saved balance", entryCondition: "Signed in", outcome: "Balance seen", sequence: 0 });
const planning = (key: string) => ({ scope: { status: "approved", manifest: [item(key)] },
  blueprint: { facts: [{ id: key, section: "surfaces", label: "Balance", detail: "Show balance", source: "user", evidence: "PRIVATE_QUOTATION", links: ["actor"] },
    { id: "actor", section: "actors", label: "Member", detail: "A member", source: "assumption" }] },
  input: { imagePath: "PRIVATE_PATH" }, lease: { id: "PRIVATE_LEASE" } });

describe("product specification", () => {
  it("resolves different approvals by stable identity despite duplicate names", () => {
    const result = compileProductSpecification(["one", "two"].map(key => ({ screenId: key, name: "Same name", outputKey: key, approvalId: `approval-${key}`, approvedPlanning: planning(key) })));
    expect(result.screens.map(s => s.behavior?.description)).toEqual(["Purpose one", "Purpose two"]);
    expect(result.screens[0].facts.map(f => f.classification)).toEqual(["user-confirmed", "approved-assumption"]);
    expect(result.screens[0].externalReferences).toEqual(["outside"]);
    expect(JSON.stringify(result)).not.toContain("PRIVATE_");
  });
  it("does not promote drafts or unrelated latest scope into historical behavior", () => {
    const approvedPlanning = planning("one");
    approvedPlanning.scope.status = "draft";
    const result = compileProductSpecification([{ screenId: "one", name: "One", outputKey: "one", approvedPlanning }], planning("one"));
    expect(result.screens[0].behavior).toBeNull();
    expect(renderProductSpecification(result)).toContain("Behavior specification unavailable");
  });
  it("exports legacy and manual state gaps without guessing behavior", () => {
    const spec = compileProductSpecification([{ screenId: "state", name: "Checkout", parentScreenId: "missing" }]);
    expect(spec.screens[0].gaps).toHaveLength(2);
    expect(spec.screens[0].behavior).toBeNull();
  });
  it("labels newer decisions without replacing approved facts", () => {
    const current = planning("one");
    current.blueprint.facts[0].detail = "New balance rules";
    const spec = compileProductSpecification([{ screenId: "one", name: "One", outputKey: "one", approvedPlanning: planning("one") }], current);
    expect(spec.screens[0].facts.map(f => f.detail)).toContain("Show balance");
    expect(spec.screens[0].facts.find(f => f.classification === "newer-decision")?.detail).toBe("New balance rules");
    expect(spec.screens[0].gaps[0]).toContain("may not be reflected");
  });
});
