// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import sharp from "sharp";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ generate: vi.fn(), load: vi.fn(), upload: vi.fn() }));
vi.mock("@/lib/ai/gemini", () => ({ createGeminiClient: () => ({ models: { generateContent: mocks.generate } }) }));
vi.mock("./references", () => ({ loadPlanningReference: mocks.load }));
import { normalizeReferenceImage } from "@/lib/generation/reference-image";
import { cropSourceFrame, loadSourceDetail, sourceHash, verifySourceDetails } from "./source-detail";
import { experienceFixture } from "./test-fixtures";
const admin = { storage: { from: () => ({ upload: mocks.upload }) } };
const source = async () => ({ data: (await sharp({ create: { width: 1800, height: 1200, channels: 3, background: "#FADABC" } }).png().toBuffer()).toString("base64"), mimeType: "image/png" });
beforeEach(() => { vi.resetAllMocks(); mocks.upload.mockResolvedValue({ error: null }); });
it("preserves original recreation detail while keeping style previews at their existing size", async () => {
  const image = await source();
  const full = await normalizeReferenceImage(image, "recreate");
  const preview = await normalizeReferenceImage(image, "style");
  expect((await sharp(Buffer.from(full.image.data, "base64")).metadata()).width).toBe(1800);
  expect((await sharp(Buffer.from(preview.image.data, "base64")).metadata()).width).toBe(1024);
  const originalPixels = await sharp(Buffer.from(image.data, "base64")).raw().toBuffer();
  expect(await sharp(Buffer.from(full.image.data, "base64")).raw().toBuffer()).toEqual(originalPixels);
}, 60_000);
it("rejects invented/out-of-image bounds without producing a derivative", async () => {
  const image = await source();
  await expect(cropSourceFrame(image, { x: .8, y: 0, width: .5, height: 1 })).rejects.toThrow(/bounds/);
  expect(await verifySourceDetails(admin, "owner", image, [{ index: 1, bounds: { x: .8, y: 0, width: .5, height: 1 } }])).toEqual([]);
  expect(mocks.generate).not.toHaveBeenCalled();
});
it("persists only independently accepted crops with original and derivative identities", async () => {
  const image = await source();
  mocks.generate.mockResolvedValue({ text: '{"approvedIndices":[2]}' });
  const frames = await verifySourceDetails(admin, "owner", image, [1, 2].map(index => ({ index, bounds: { x: (index - 1) / 2, y: 0, width: .5, height: 1 } })));
  expect(frames).toHaveLength(1);
  expect(frames[0]).toMatchObject({ index: 2, sourceHash: sourceHash(image), transformVersion: 1 });
  expect(frames[0].hash).toHaveLength(64);
  expect(mocks.upload).toHaveBeenCalledOnce();
  expect(mocks.generate.mock.calls[0][0].contents[0].parts).toHaveLength(6);
});
it("keeps the full composite when verification is uncertain or invalid", async () => {
  mocks.generate.mockResolvedValue({ text: '{"approvedIndices":[]}' });
  expect(await verifySourceDetails(admin, "owner", await source(), [{ index: 1, bounds: { x: 0, y: 0, width: .5, height: 1 } }])).toEqual([]);
  expect(mocks.upload).not.toHaveBeenCalled();
});
it("refuses changed crop evidence on a retry and never reuses a crop for a new source", async () => {
  const image = await source();
  const experience = { ...experienceFixture(), sourceFrames: [{ index: 1, sourceHash: sourceHash(image), transformVersion: 1 as const,
    bounds: { x: 0, y: 0, width: .5, height: 1 }, path: "owner/prompt-images/crop.webp", hash: "a".repeat(64) }] };
  mocks.load.mockResolvedValue({ data: "changed", mimeType: "image/webp" });
  await expect(loadSourceDetail(admin, "owner", image, experience, 1)).rejects.toThrow(/derivative changed/);
  mocks.load.mockClear();
  expect(await loadSourceDetail(admin, "owner", { ...image, data: "another" }, experience, 1)).toBeNull();
  expect(mocks.load).not.toHaveBeenCalled();
});
