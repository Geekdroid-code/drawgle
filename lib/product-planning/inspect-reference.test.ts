import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ generate: vi.fn(), load: vi.fn(), store: vi.fn(), match: vi.fn(), curated: vi.fn() }));
vi.mock("@/lib/ai/gemini", () => ({ createGeminiClient: () => ({ models: { generateContent: mocks.generate } }) }));
vi.mock("./references", () => ({ loadPlanningReference: mocks.load, storePlanningReference: mocks.store }));
vi.mock("@/lib/generation/curated-style-references", () => ({ matchCuratedStyleReference: mocks.match, loadCuratedStyleReferenceImage: mocks.curated }));
import { inspectProductReference } from "./inspect-reference";
import { designerFixture, experienceFixture } from "./test-fixtures";
describe("reference-backed experience reasoning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.generate.mockResolvedValue({ text: JSON.stringify(experienceFixture()) });
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
    mocks.match.mockResolvedValue({ reference: { id: "editorial-1" } });
    mocks.curated.mockResolvedValue({ data: "curated-pixels", mimeType: "image/png" });
    mocks.store.mockResolvedValue("owner/prompt-images/curated.webp");
    const state = designerFixture(); state.input.imagePath = null;
    const result = await inspectProductReference({}, "owner", state, "Product-led layout");
    expect(mocks.generate.mock.calls[0][0].contents[0].parts[1].inlineData.data).toBe("normalized-pixels");
    expect(result.experience.referenceId).toBe("editorial-1");
    expect(result.experience.referencePath).toBe("owner/prompt-images/curated.webp");
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
