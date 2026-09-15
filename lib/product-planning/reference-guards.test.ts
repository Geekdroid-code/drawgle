import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ generate: vi.fn(), load: vi.fn(), store: vi.fn(), shortlist: vi.fn(), curated: vi.fn() }));
vi.mock("@/lib/ai/gemini", () => ({ createGeminiClient: () => ({ models: { generateContent: mocks.generate } }) }));
vi.mock("./references", () => ({ loadPlanningReference: mocks.load, storePlanningReference: mocks.store }));
vi.mock("@/lib/generation/curated-style-references", () => ({ shortlistCuratedStyleReferences: mocks.shortlist, loadCuratedStyleReferenceImage: mocks.curated }));
import { inspectProductReference } from "./inspect-reference";
import { designerFixture, experienceFixture } from "./test-fixtures";
import { applyProductPatch, proposeProductScope, approveProductScope } from "./model";
import { designRequirementsKey } from "./design-requirements";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.load.mockResolvedValue(null);
  mocks.shortlist.mockResolvedValue([1, 2, 3, 4].map(index => ({ reference: { id: `candidate-${index}` }, catalogHash: "catalog" })));
  mocks.curated.mockResolvedValue({ data: "candidate", mimeType: "image/webp" });
});
it.each([false, undefined])("never persists rejected or unreviewed candidates: %s", async verdict => {
  mocks.generate.mockResolvedValue({ text: JSON.stringify({ ...experienceFixture(), compatibility: verdict === undefined ? undefined
    : { compatible: verdict, conflicts: ["Does not fit"], transfer: "", rationale: "Reject" } }) });
  const state = designerFixture(); state.input.imagePath = null;
  await expect(inspectProductReference({}, "owner", state, "Keep the brief")).rejects.toMatchObject({ code: "NO_COMPATIBLE_REFERENCE" });
  expect(mocks.generate).toHaveBeenCalledTimes(3);
  expect(mocks.store).not.toHaveBeenCalled();
});
it("blocks stale requirements at proposal and final approval independently", () => {
  const state = designerFixture();
  state.experience!.requirementsKey = designRequirementsKey(state);
  state.experience!.compatibility = { compatible: true, conflicts: [], transfer: "Craft", rationale: "Fits" };
  const proposed = proposeProductScope(state);
  const changed = applyProductPatch(proposed, { operations: [{ op: "put_fact", fact: { id: "new", section: "preferences",
    label: "Typography", detail: "Serif headings", source: "user", evidence: "Serif headings" } }] }, "11111111-1111-4111-8111-111111111111");
  expect(() => proposeProductScope(changed)).toThrow(/requirements changed/);
  expect(() => approveProductScope(changed, changed.revision)).toThrow(/requirements changed/);
});
it("blocks incompatible evidence even with the current requirements key", () => {
  const state = designerFixture(); state.experience!.requirementsKey = designRequirementsKey(state);
  state.experience!.compatibility = { compatible: false, conflicts: ["Contradiction"], transfer: "", rationale: "No" };
  expect(() => proposeProductScope(state)).toThrow(/compatibility/);
});
it("reselects a saved curated reference when requirements change", async () => {
  const state = designerFixture(); state.input.referenceSource = "curated";
  state.experience!.requirementsKey = "stale"; state.experience!.referenceId = "old";
  mocks.load.mockResolvedValueOnce({ data: "old", mimeType: "image/webp" }).mockResolvedValueOnce({ data: "saved", mimeType: "image/webp" });
  mocks.store.mockResolvedValue("owner/prompt-images/new.webp");
  mocks.generate.mockResolvedValue({ text: JSON.stringify({ ...experienceFixture(), compatibility: { compatible: true, conflicts: [], transfer: "Craft", rationale: "Fits" } }) });
  const result = await inspectProductReference({}, "owner", state, "New direction");
  expect(result.experience.referenceId).toBe("candidate-1");
  expect(mocks.shortlist).toHaveBeenCalledOnce();
});
it("never replaces an incompatible user upload with library evidence", async () => {
  mocks.load.mockResolvedValue({ data: "user", mimeType: "image/webp" });
  mocks.generate.mockResolvedValue({ text: JSON.stringify({ ...experienceFixture(), compatibility: { compatible: false, conflicts: ["Cannot transfer"], transfer: "", rationale: "Conflict" } }) });
  await expect(inspectProductReference({}, "owner", designerFixture(), "Preserve choices")).rejects.toMatchObject({ code: "USER_REFERENCE_CONFLICT" });
  expect(mocks.shortlist).not.toHaveBeenCalled();
});
