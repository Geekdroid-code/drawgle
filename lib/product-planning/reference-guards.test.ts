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
import { productReferenceExecution } from "./reference-execution";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.load.mockResolvedValue(null);
  mocks.shortlist.mockResolvedValue([1, 2, 3, 4].map(index => ({ reference: { id: `candidate-${index}` }, catalogHash: "catalog" })));
  mocks.curated.mockResolvedValue({ data: "candidate", mimeType: "image/webp" });
});
it.each([false, undefined])("falls back to prompt direction after rejected or unreviewed optional candidates: %s", async verdict => {
  mocks.generate.mockResolvedValue({ text: JSON.stringify({ ...experienceFixture(), compatibility: verdict === undefined ? undefined
    : { compatible: verdict, conflicts: ["Does not fit"], transfer: "", rationale: "Reject" } }) });
  const state = designerFixture(); state.input.imagePath = null;
  const result = await inspectProductReference({}, "owner", state, "Keep the brief");
  expect(result.experience).toMatchObject({ provenance: "prompt_synthesis", referencePath: null, referenceId: null });
  expect(mocks.generate).toHaveBeenCalledTimes(3);
  expect(mocks.store).not.toHaveBeenCalled();
});
it("continues from the prompt when the optional curated search or image load fails", async () => {
  const state = designerFixture(); state.input.imagePath = null;
  mocks.shortlist.mockRejectedValueOnce(new Error("Curated search unavailable"));
  mocks.generate.mockResolvedValue({ text: JSON.stringify(experienceFixture()) });
  expect((await inspectProductReference({}, "owner", state, "Keep the brief")).experience.provenance).toBe("prompt_synthesis");
  mocks.shortlist.mockResolvedValueOnce([{ reference: { id: "missing" }, catalogHash: "catalog" }]);
  mocks.curated.mockRejectedValueOnce(new Error("Image unavailable"));
  expect((await inspectProductReference({}, "owner", state, "Keep the brief")).experience.provenance).toBe("prompt_synthesis");
  expect(mocks.generate).not.toHaveBeenCalled();
});
it("does not repeat an unavailable inspection service for every candidate", async () => {
  const state = designerFixture(); state.input.imagePath = null;
  mocks.generate.mockRejectedValue(new Error("private provider failure"));
  const trace = vi.fn();
  const result = await inspectProductReference({}, "owner", state, "Keep the brief", trace);
  expect(result.experience.provenance).toBe("prompt_synthesis");
  expect(mocks.generate).toHaveBeenCalledOnce();
  expect(mocks.curated).toHaveBeenCalledOnce();
  expect(mocks.store).not.toHaveBeenCalled();
  expect(trace).toHaveBeenCalledWith(expect.objectContaining({ errorCode: "OPTIONAL_REFERENCE_INSPECTION_UNAVAILABLE" }));
  expect(JSON.stringify(trace.mock.calls)).not.toContain("private provider failure");
});
it("uses explicit prompt requirements directly without another synthesis request", async () => {
  const state = applyProductPatch(designerFixture(), { operations: [{ op: "put_fact", fact: {
    id: "cream", section: "preferences", label: "Palette", detail: "Warm cream, no gradients",
    source: "user", evidence: "Warm cream, no gradients",
  } }] }, "11111111-1111-4111-8111-111111111111");
  state.input.referencePreference = { mode: "none", evidence: "Don't use a reference", messageId: "user-message" };
  const result = await inspectProductReference({}, "owner", state, "Design my app");
  expect(result.experience.direction).toContain("Warm cream, no gradients");
  expect(result.experience.requirementsKey).toBe(designRequirementsKey(state));
  expect(mocks.load).not.toHaveBeenCalled();
  expect(mocks.shortlist).not.toHaveBeenCalled();
  expect(mocks.generate).not.toHaveBeenCalled();
});
it.each(["write", "read"])("keeps prompt-only planning usable after optional reference storage %s fails", async failure => {
  const state = designerFixture(); state.input.imagePath = null;
  const original = structuredClone(state);
  mocks.generate.mockResolvedValue({ text: JSON.stringify({ ...experienceFixture(),
    compatibility: { compatible: true, conflicts: [], transfer: "Craft", rationale: "Fits" } }) });
  if (failure === "write") mocks.store.mockRejectedValueOnce(new Error("storage unavailable"));
  else {
    mocks.store.mockResolvedValueOnce("owner/prompt-images/reference.webp");
    mocks.load.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error("read unavailable"));
  }
  const result = await inspectProductReference({}, "owner", state, "Design my app");
  expect(result.experience.provenance).toBe("prompt_synthesis");
  expect(result.image).toBeNull();
  expect(mocks.generate).toHaveBeenCalledOnce();
  expect(state).toEqual(original);
  expect(state.input.referencePreference).toBeUndefined();
});
it("handles an unavailable saved curated image but does not hide a supplied-image failure", async () => {
  const state = designerFixture(); state.input.referenceSource = "curated";
  mocks.load.mockRejectedValue(new Error("storage unavailable"));
  mocks.shortlist.mockResolvedValue([]);
  expect((await inspectProductReference({}, "owner", state, "Design my app")).experience.provenance).toBe("prompt_synthesis");
  expect(mocks.generate).not.toHaveBeenCalled();
  await expect(inspectProductReference({}, "owner", designerFixture(), "Use my image")).rejects.toThrow("storage unavailable");
});
it("does not replace an established project's reference during a storage outage", async () => {
  const state = designerFixture(); state.input.referenceSource = "curated"; state.phase = "canvas";
  mocks.load.mockRejectedValueOnce(new Error("storage unavailable"));
  await expect(inspectProductReference({}, "owner", state, "Add another screen")).rejects.toThrow("storage unavailable");
  expect(mocks.shortlist).not.toHaveBeenCalled();
  expect(mocks.generate).not.toHaveBeenCalled();
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
it("approves an automatically prompt-derived direction without a permanent no-reference preference", () => {
  const state = designerFixture();
  state.input.imagePath = null;
  state.input.referenceSource = "none";
  state.experience = {
    ...experienceFixture(), provenance: "prompt_synthesis", referencePath: null, referenceId: null, referenceHash: null,
    requirementsKey: designRequirementsKey(state), compatibility: { compatible: true, conflicts: [], transfer: "Prompt", rationale: "No compatible curated image" },
  };
  expect(state.input.referencePreference).toBeUndefined();
  const proposed = proposeProductScope(state);
  const approved = approveProductScope(proposed, proposed.revision);
  expect(productReferenceExecution(approved)).toMatchObject({ policy: "no_reference", imagePath: null });
  expect(approved.input.referencePreference).toBeUndefined();
});
