import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ generate: vi.fn(), load: vi.fn(), store: vi.fn(), match: vi.fn(), curated: vi.fn(), shortlist: vi.fn() }));
vi.mock("@/lib/ai/gemini", () => ({ createGeminiClient: () => ({ models: { generateContent: mocks.generate } }) }));
vi.mock("./references", () => ({ loadPlanningReference: mocks.load, storePlanningReference: mocks.store }));
vi.mock("@/lib/generation/curated-style-references", () => ({
  matchCuratedStyleReference: mocks.match,
  loadCuratedStyleReferenceImage: mocks.curated,
  shortlistCuratedStyleReferences: mocks.shortlist,
}));
import { inspectProductReference } from "./inspect-reference";
import { designerFixture, experienceFixture } from "./test-fixtures";
describe("reference-backed experience reasoning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.shortlist.mockResolvedValue([]);
    mocks.generate.mockResolvedValue({ text: JSON.stringify({ ...experienceFixture(), compatibility: { compatible: true, conflicts: [], transfer: "Spacing", rationale: "Fits" } }) });
  });
  it("inspects uploaded pixels without replacing them through curated retrieval", async () => {
    mocks.load.mockResolvedValue({ data: "uploaded-pixels", mimeType: "image/webp" });
    const result = await inspectProductReference({}, "owner", designerFixture(), "Prioritize shopping");
    expect(mocks.match).not.toHaveBeenCalled();
    expect(mocks.generate.mock.calls[0][0].contents[0].parts[1].inlineData.data).toBe("uploaded-pixels");
    expect(result.experience.referenceHash).toHaveLength(64);
  });
  it("loads, persists and inspects a real curated image rather than only its identifier", async () => {
    mocks.load.mockResolvedValueOnce(null).mockResolvedValueOnce({ data: "normalized-pixels", mimeType: "image/webp" });
    mocks.shortlist.mockResolvedValue([{ reference: { id: "editorial-1" }, catalogHash: "cat-1" }]);
    mocks.curated.mockResolvedValue({ data: "curated-pixels", mimeType: "image/png" });
    mocks.store.mockResolvedValue("owner/prompt-images/curated.webp");
    const state = designerFixture(); state.input.imagePath = null;
    const result = await inspectProductReference({}, "owner", state, "Product-led layout");
    expect(mocks.generate.mock.calls[0][0].contents[0].parts[1].inlineData.data).toBe("curated-pixels");
    expect(result.experience.referenceId).toBe("editorial-1");
    expect(result.experience.referencePath).toBe("owner/prompt-images/curated.webp");
  });
  it("preserves curated provenance on repeated inspection", async () => {
    mocks.load.mockResolvedValue({ data: "library-pixels", mimeType: "image/webp" });
    const state = designerFixture(); state.experience!.referenceId = "curated-original";
    state.experience!.requirementsKey = "[]";
    state.experience!.referenceHash = createHash("sha256").update("library-pixels").digest("hex");
    state.experience!.compatibility = { compatible: true, conflicts: [], transfer: "Spacing", rationale: "Fits" };
    const result = await inspectProductReference({}, "owner", state, "Refine the visual hierarchy");
    expect(result.experience.referenceId).toBe("curated-original");
    expect(mocks.match).not.toHaveBeenCalled();
  });
  it("skips an incompatible candidate in the shortlist in favor of a compatible one", async () => {
    mocks.load.mockResolvedValueOnce(null).mockResolvedValueOnce({ data: "normalized-pixels", mimeType: "image/webp" });
    mocks.shortlist.mockResolvedValue([
      { reference: { id: "dark-neon" }, catalogHash: "cat-neon" },
      { reference: { id: "clean-minimal" }, catalogHash: "cat-clean" },
    ]);
    mocks.curated
      .mockResolvedValueOnce({ data: "dark-pixels", mimeType: "image/png" })
      .mockResolvedValueOnce({ data: "clean-pixels", mimeType: "image/png" });
    mocks.store.mockResolvedValue("owner/prompt-images/clean.webp");

    mocks.generate
      .mockResolvedValueOnce({
        text: JSON.stringify({
          ...experienceFixture(),
          compatibility: { compatible: false, conflicts: ["Dark neon palette conflicts with cream background request"], transfer: "", rationale: "Incompatible" },
        }),
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({
          ...experienceFixture(),
          compatibility: { compatible: true, conflicts: [], transfer: "Typography and card spacing", rationale: "Compatible" },
        }),
      });

    const state = designerFixture();
    state.input.imagePath = null;
    const result = await inspectProductReference({}, "owner", state, "Use warm cream background and no gradients");
    expect(result.experience.referenceId).toBe("clean-minimal");
    expect(result.experience.compatibility?.compatible).toBe(true);
    expect(mocks.store).toHaveBeenCalledWith({}, "owner", { data: "clean-pixels", mimeType: "image/png" });
  });
  it("fails closed if the reference is unavailable", async () => {
    mocks.load.mockResolvedValue(null);
    mocks.match.mockResolvedValue({ reference: { id: "missing" } });
    mocks.curated.mockResolvedValue(null);
    await expect(inspectProductReference({}, "owner", designerFixture(), "Minimal")).rejects.toThrow(/unavailable/);
    expect(mocks.match).not.toHaveBeenCalled();
    expect(mocks.generate).not.toHaveBeenCalled();
  });
});
