// @vitest-environment node
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env/server", () => ({ getOptionalPexelsApiKey: () => "test-pexels-key", getOptionalPixabayApiKey: () => null }));
vi.mock("@/lib/r2", () => ({ uploadToR2: async ({ key }: { key: string }) => `https://assets.example/${key}` }));

import {
  findStockCandidates,
  isUserIdentity,
  normalizeAssetBytes,
  planVisualAssets,
  rankStockCandidates,
  resolveProjectAssets,
  stockSearchQuery,
} from "@/lib/generation/visual-assets";
import type { AssetRequirement, ScreenPlan } from "@/lib/types";

type Row = Record<string, unknown>;

/** Just enough of the admin client for the asset resolver: visual_assets rows and usage upserts. */
const fakeAdmin = (initial: Row[] = []) => {
  const rows: Row[] = [...initial];
  const from = (name: string) => {
    if (name === "project_asset_usages") return { upsert: async () => ({ error: null }) };
    const filters: Array<[string, unknown]> = [];
    let max = Number.POSITIVE_INFINITY;
    const matches = () => rows.filter((row) => filters.every(([column, value]) => row[column] === value)).slice(0, max);
    const query = {
      select: () => query,
      eq: (column: string, value: unknown) => { filters.push([column, value]); return query; },
      limit: (count: number) => { max = count; return query; },
      maybeSingle: async () => ({ data: matches()[0] ?? null, error: null }),
      then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
        Promise.resolve({ data: matches(), error: null }).then(resolve, reject),
      insert: (row: Row) => {
        rows.push({ ...row });
        return { select: () => ({ single: async () => ({ data: row, error: null }) }) };
      },
    };
    return query;
  };
  return { admin: { from } as never, rows };
};

const jpeg = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: { r: 196, g: 150, b: 96 } } }).jpeg().toBuffer();

const pexelsPhoto = (id: number, alt: string, width = 1200, height = 800) => ({
  id, width, height, alt, photographer: "A. Photographer", url: `https://www.pexels.com/photo/${id}/`,
  src: { large2x: `https://images.pexels.test/${id}.jpg` },
});

/** Answers the Pexels search and the image downloads. */
const stubStock = async (photos: ReturnType<typeof pexelsPhoto>[]) => {
  const image = await jpeg(1200, 800);
  const fetchMock = vi.fn(async (input: URL | string) => {
    const url = new URL(String(input));
    if (url.hostname === "api.pexels.com") return new Response(JSON.stringify({ photos }), { status: 200 });
    return new Response(new Uint8Array(image), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

const petAvatar = (overrides: Partial<AssetRequirement> = {}): AssetRequirement => ({
  id: "family-pets",
  screenName: "Pet Library",
  role: "avatar",
  subject: "Biscuit, a golden retriever puppy",
  assetType: "photo",
  sourcePreference: "internal_library",
  desiredAspectRatio: "1:1",
  transparentBackground: false,
  placementHint: "Round pet avatar",
  priority: "critical",
  reuseKey: "family-pets-avatar",
  semanticCategory: "animal",
  semanticTags: ["dog", "puppy"],
  slotCount: 1,
  reusePolicy: "repeat",
  origin: "planner_inferred",
  ...overrides,
});

const resolve = (admin: never, requirement: AssetRequirement) =>
  resolveProjectAssets({ admin, ownerId: "owner", projectId: "project", generationRunId: "run", requirements: [requirement] });

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.unstubAllGlobals());

describe("sample people and pets are photos", () => {
  it("sends a planner-inferred pet avatar to stock and returns a square photo with the subject as its alt", async () => {
    const fetchMock = await stubStock([
      pexelsPhoto(1, "Golden retriever puppy sitting on green grass"),
      pexelsPhoto(2, "Plate of pasta on a table"),
    ]);
    const { admin, rows } = fakeAdmin();
    const manifest = await resolve(admin, petAvatar());

    const search = new URL(String(fetchMock.mock.calls[0][0]));
    expect(search.hostname).toBe("api.pexels.com");
    expect(search.searchParams.get("orientation")).toBe("square");
    expect(search.searchParams.get("query")).toMatch(/dog/);
    expect(search.searchParams.get("query")).toMatch(/portrait/);

    const [asset] = manifest.assetsByScreen["Pet Library"];
    expect(asset).toMatchObject({ placeholder: false, source: "stock", provider: "pexels", role: "avatar", hasAlpha: false });
    expect(asset.url).toMatch(/^https:\/\/assets\.example\/visual-assets\//);
    // cropped square, not shrunk into a 3:2 frame
    expect(asset.width).toBe(asset.height);
    expect(asset.alt).toBe("Biscuit, a golden retriever puppy");
    expect(manifest.diagnostics?.[0]).toMatchObject({ selectedVia: "stock", rejectionCode: null });
    // and it is kept for the next project, as any stock photo is
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ role: "avatar", semantic_category: "animal", asset_type: "photo", has_alpha: false, visibility: "public_reusable" });
  });

  it("reaches stock for a person's avatar too, where it used to stop at initials", async () => {
    const fetchMock = await stubStock([pexelsPhoto(7, "Smiling woman in a yellow sweater")]);
    const { admin } = fakeAdmin();
    const manifest = await resolve(admin, petAvatar({
      id: "family-members", subject: "Maya, a smiling mother", semanticCategory: "person", semanticTags: ["woman", "mother"], reuseKey: "family-members",
    }));
    expect(fetchMock).toHaveBeenCalled();
    expect(manifest.assetsByScreen["Pet Library"][0]).toMatchObject({ placeholder: false, source: "stock", role: "avatar" });
  });

  it("uses the internal library before it asks a stock provider", async () => {
    const fetchMock = await stubStock([pexelsPhoto(1, "Golden retriever puppy")]);
    const { admin } = fakeAdmin([{
      id: "library-dog", source: "internal_library", provider: "drawgle_r2", role: "avatar", semantic_category: "animal",
      asset_type: "photo", has_alpha: false, status: "active", visibility: "public_reusable", owner_id: null, created_by_project_id: null,
      subject: "Border collie resting, an earlier project's prompt", tags: ["dog", "collie"], public_url: "https://assets.example/library-dog.webp",
      width: 800, height: 800, license: "Drawgle curated internal library", attribution: null, source_url: null, reuse_key: "collie", content_hash: "abc",
    }]);
    const manifest = await resolve(admin, petAvatar());

    expect(fetchMock).not.toHaveBeenCalled();
    const [asset] = manifest.assetsByScreen["Pet Library"];
    expect(asset).toMatchObject({ id: "library-dog", source: "internal_library", placeholder: false });
    // the alt is what this requirement asks the image to show, not what the asset was first saved as
    expect(asset.alt).toBe("Biscuit, a golden retriever puppy");
    expect(manifest.diagnostics?.[0].selectedVia).toBe("curated");
  });

  it("still returns the initials placeholder for the user's own identity", async () => {
    const fetchMock = await stubStock([pexelsPhoto(3, "Smiling woman")]);
    const { admin, rows } = fakeAdmin();
    const own = petAvatar({ id: "my-avatar", subject: "The signed-in user's own profile photo", semanticCategory: "person", semanticTags: ["portrait"], origin: "user_specified" });
    expect(isUserIdentity(own)).toBe(true);
    expect(isUserIdentity(petAvatar())).toBe(false);

    const manifest = await resolve(admin, own);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(rows).toHaveLength(0);
    expect(manifest.assetsByScreen["Pet Library"][0]).toMatchObject({ placeholder: true, source: "placeholder", role: "avatar" });
    expect(manifest.assetsByScreen["Pet Library"][0].placementHint).toContain("Use initials or a person icon.");
    expect(manifest.diagnostics?.[0].rejectionCode).toBe("identity_requires_supplied_image");
  });

  it("falls back to a placeholder that does not ask for a person icon when no pet photo qualifies", async () => {
    await stubStock([pexelsPhoto(9, "Plate of pasta on a table")]);
    const { admin } = fakeAdmin();
    const manifest = await resolve(admin, petAvatar());
    const [asset] = manifest.assetsByScreen["Pet Library"];
    expect(asset.placeholder).toBe(true);
    expect(asset.placementHint).not.toContain("person icon");
    expect(manifest.diagnostics?.[0].rejectionCode).toBe("no_semantic_match");
  });
});

describe("planning an avatar", () => {
  const screens = (need: Partial<AssetRequirement> & Record<string, unknown>): ScreenPlan[] => [{
    name: "Pet Library",
    type: "root",
    description: "A list of the family's pets.",
    assetNeeds: [{ ...petAvatar({ id: "pets", assetType: "transparent_png", transparentBackground: true, desiredAspectRatio: "4:5" }), ...need } as AssetRequirement],
  }];

  it("makes a sample avatar a square photo, whatever the planner asked for", async () => {
    const [planned] = await planVisualAssets({ prompt: "An app for families with multiple pets", screens: screens({}) });
    expect(planned).toMatchObject({
      role: "avatar", assetType: "photo", transparentBackground: false, desiredAspectRatio: "1:1", semanticCategory: "animal", origin: "planner_inferred",
    });
  });

  it("leaves a cutout that is not an avatar alone", async () => {
    const [planned] = await planVisualAssets({
      prompt: "A scooter shop",
      screens: screens({
        role: "product_cutout", subject: "Electric scooter side view", placementHint: "Large foreground product image",
        semanticCategory: "vehicle", semanticTags: ["scooter"],
      }),
    });
    expect(planned).toMatchObject({ role: "product_cutout", assetType: "transparent_png", transparentBackground: true, desiredAspectRatio: "4:5" });
  });

  it("keeps the user's own identity, even when the prompt asks for portraits", async () => {
    const [planned] = await planVisualAssets({
      prompt: "A profile app with a clear portrait photo of each member",
      screens: screens({ origin: "user_specified", assetType: "photo", transparentBackground: false }),
    });
    expect(planned.origin).toBe("user_specified");
    expect(isUserIdentity(planned)).toBe(true);
  });

  it("does not build a recovered requirement's subject, and so its alt text, from the app prompt", async () => {
    const prompt = "Create a luxury skincare app with sharp photography and an off-white background.";
    const planned = await planVisualAssets({
      prompt,
      screens: [{ name: "Daily Protocol", type: "root", description: "Use full-bleed hero photography above the routine.", assetNeeds: [] }],
      charter: {
        originalPrompt: prompt, appType: "Luxury skincare routine", targetAudience: "Skincare customers", navigationModel: "Tabs",
        keyFeatures: ["Routine"], designRationale: "Photography-led",
      },
    });
    expect(planned).toHaveLength(1);
    expect(planned[0].semanticCategory).toBe("beauty");
    expect(planned[0].subject).toBe("Luxury skincare routine Daily Protocol background photo");
    expect(planned[0].subject).not.toContain("off-white");
    expect(planned[0].subject).not.toContain("Create a");
  });
});

describe("stock ranking for people and pets", () => {
  const candidate = (providerAssetId: string, description: string) => ({
    provider: "pexels" as const, providerAssetId, imageUrl: `https://images.pexels.test/${providerAssetId}.jpg`, sourceUrl: null,
    description, tags: [], attribution: null, license: "Pexels License", width: 1200, height: 1200,
  });

  it("accepts the pets and people that captions name without naming the category", () => {
    const rabbit = petAvatar({ subject: "Cocoa, a brown rabbit", semanticTags: ["rabbit"], reuseKey: "rabbit" });
    expect(rankStockCandidates(rabbit, [candidate("rabbit", "Brown rabbit sitting on grass"), candidate("pasta", "Plate of pasta")])
      .map((item) => item.providerAssetId)).toEqual(["rabbit"]);

    const bird = petAvatar({ subject: "Kiwi, a green parrot", semanticTags: ["parrot", "bird"], reuseKey: "parrot" });
    expect(rankStockCandidates(bird, [candidate("parrot", "Green parrot on a branch")]).map((item) => item.providerAssetId)).toEqual(["parrot"]);

    const person = petAvatar({ subject: "Nana, a grandmother", semanticCategory: "person", semanticTags: ["woman", "senior"], reuseKey: "nana" });
    expect(rankStockCandidates(person, [candidate("nana", "Senior woman smiling at the camera"), candidate("laptop", "Laptop on a desk")])
      .map((item) => item.providerAssetId)).toEqual(["nana"]);
  });

  it("still starts a pet search with a pet word and a portrait", () => {
    expect(stockSearchQuery(petAvatar())).toBe("dog biscuit golden retriever puppy portrait");
  });
});

describe("the pet project's own requirements", () => {
  // as the planner wrote them for the pet project: its pets came as product cutouts in one run and avatars in another
  const stored = (overrides: Partial<AssetRequirement>): AssetRequirement => petAvatar({
    role: "product_cutout", assetType: "transparent_png", transparentBackground: true, semanticCategory: "animal", ...overrides,
  });
  const candidate = (providerAssetId: string, description: string) => ({
    provider: "pexels" as const, providerAssetId, imageUrl: `https://images.pexels.test/${providerAssetId}.jpg`, sourceUrl: null,
    description, tags: [], attribution: null, license: "Pexels License", width: 1600, height: 1200,
  });

  it("searches for a pet planned as a product cutout as a portrait, not as an isolated product", () => {
    const portraits = stored({
      id: "pet-portraits", subject: "Happy domestic pets (dogs, cats) looking at camera", slotCount: 6, reusePolicy: "distinct",
      semanticTags: ["dog", "cat", "portrait", "pet", "library", "happy", "domestic", "pets"], reuseKey: "pet-gallery-images",
    });
    const query = stockSearchQuery(portraits);
    expect(query).toMatch(/portrait$/);
    expect(query).not.toContain("isolated");
    expect(query).toContain("dog");
    // other products keep the role's own wording
    expect(stockSearchQuery({ ...portraits, semanticCategory: "electronics", subject: "Wireless headphones", semanticTags: ["headphones"] })).toMatch(/isolated product$/);
    // and a pet in an editorial section keeps that wording too
    expect(stockSearchQuery({ ...portraits, role: "section_photo" })).toMatch(/editorial photography$/);
  });

  it("does not ask a dog's caption to say \"product\" before it qualifies", () => {
    const portraits = stored({
      id: "pet-portraits", subject: "Happy domestic pets (dogs, cats) looking at camera", slotCount: 6, reusePolicy: "distinct",
      semanticTags: ["dog", "cat", "portrait", "pet", "happy", "domestic", "pets"],
    });
    const ranked = rankStockCandidates(portraits, [
      candidate("dog", "Brown and white dog lying on the floor"),
      candidate("cat", "Tabby cat looking at the camera"),
      candidate("mug", "White ceramic mug on a table"),
    ]);
    expect(ranked.map((item) => item.providerAssetId).sort()).toEqual(["cat", "dog"]);

    const closeUp = stored({ id: "pet-hero-detail", subject: "Close-up of a specific pet", slotCount: 1, semanticTags: ["portrait", "pet", "detail", "profile"], desiredAspectRatio: "free" });
    expect(rankStockCandidates(closeUp, [candidate("dog", "Close-up of a dog's face"), candidate("mug", "Close-up of a mug")]).map((item) => item.providerAssetId)).toEqual(["dog"]);
  });
});

describe("findStockCandidates", () => {
  it("lists the photos that qualify, best first, without downloading or saving anything", async () => {
    const fetchMock = await stubStock([pexelsPhoto(1, "Golden retriever puppy sitting on grass"), pexelsPhoto(2, "Plate of pasta on a table")]);
    const found = await findStockCandidates(petAvatar(), 3);
    expect(found.map((item) => item.providerAssetId)).toEqual(["1"]);
    expect(found[0]).toMatchObject({ provider: "pexels", license: "Pexels License", sourceUrl: "https://www.pexels.com/photo/1/" });
    // one search, and not a single image download
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(new URL(String(fetchMock.mock.calls[0][0])).hostname).toBe("api.pexels.com");
  });
});

describe("normalizeAssetBytes for a square avatar", () => {
  const side = async (bytes: Uint8Array) => {
    const meta = await sharp(Buffer.from(bytes)).metadata();
    return [meta.width, meta.height];
  };

  it("crops a landscape or portrait photo to a square without enlarging it", async () => {
    expect(await side((await normalizeAssetBytes(await jpeg(1200, 800), false, true)).bytes)).toEqual([800, 800]);
    expect(await side((await normalizeAssetBytes(await jpeg(600, 900), false, true)).bytes)).toEqual([600, 600]);
    expect(await side((await normalizeAssetBytes(await jpeg(3000, 2000), false, true)).bytes)).toEqual([1024, 1024]);
  });

  it("crops after honouring the camera's orientation", async () => {
    const turned = await sharp({ create: { width: 1200, height: 800, channels: 3, background: { r: 90, g: 120, b: 200 } } })
      .jpeg().withMetadata({ orientation: 6 }).toBuffer();
    // shown upright it is 800 wide and 1200 tall, so the square is 800
    expect(await side((await normalizeAssetBytes(turned, false, true)).bytes)).toEqual([800, 800]);
  });

  it("leaves every other image inside the old 1024 box, uncropped", async () => {
    expect(await side((await normalizeAssetBytes(await jpeg(1200, 800), false)).bytes)).toEqual([1024, 683]);
    expect(await side((await normalizeAssetBytes(await jpeg(600, 900), false)).bytes)).toEqual([600, 900]);
  });
});
