import { describe, expect, it } from "vitest";

import { isSemanticallyCompatible } from "@/lib/generation/asset-semantics";
import { libraryEntryFor, SAMPLE_IMAGERY_SPECS, specRequirement, type SampleImagerySpec } from "@/lib/generation/sample-imagery";
import type { AssetRequirement } from "@/lib/types";

const candidate = {
  provider: "pexels",
  providerAssetId: "3456",
  description: "Golden retriever puppy sitting on green grass",
  tags: ["Golden", "retriever", "grass"],
  license: "Pexels License",
  attribution: "Photo by A. Photographer on Pexels",
  sourceUrl: "https://www.pexels.com/photo/3456/",
};

const spec = (id: string) => SAMPLE_IMAGERY_SPECS.find((item) => item.id === id) as SampleImagerySpec;

describe("the sample imagery list", () => {
  it("covers people of every age and the common pets", () => {
    const ids = SAMPLE_IMAGERY_SPECS.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ["woman-adult", "man-adult", "woman-senior", "man-senior", "boy", "girl", "dog", "cat", "rabbit", "bird"]) {
      expect(ids, `missing ${id}`).toContain(id);
    }
    for (const item of SAMPLE_IMAGERY_SPECS) {
      expect(["person", "animal"]).toContain(item.category);
      expect(item.count).toBeGreaterThanOrEqual(1);
      expect(item.count).toBeLessThanOrEqual(12);
      expect(item.tags.length).toBeGreaterThan(0);
    }
    // a few dozen photos, not a catalogue
    expect(SAMPLE_IMAGERY_SPECS.reduce((sum, item) => sum + item.count, 0)).toBeLessThanOrEqual(60);
  });

  it("stands for square photos, several distinct ones per entry", () => {
    expect(specRequirement(spec("dog"))).toMatchObject({
      id: "sample-dog", role: "avatar", assetType: "photo", desiredAspectRatio: "1:1", transparentBackground: false,
      semanticCategory: "animal", reusePolicy: "distinct", slotCount: 6, sourcePreference: "stock",
    });
    expect(specRequirement(spec("woman-adult")).semanticCategory).toBe("person");
  });
});

describe("a library entry", () => {
  it("keeps what the photo shows, the words that find it and where it came from", () => {
    const entry = libraryEntryFor(spec("puppy"), candidate);
    expect(entry.subject).toBe("Puppy portrait: Golden retriever puppy sitting on green grass");
    expect(entry.tags).toEqual(expect.arrayContaining(["puppy", "dog", "pet", "golden", "retriever", "grass"]));
    expect(new Set(entry.tags).size).toBe(entry.tags.length);
    expect(entry.reuseKey).toBe("sample-puppy-pexels-3456");
    expect(entry).toMatchObject({ license: "Pexels License", attribution: "Photo by A. Photographer on Pexels", sourceUrl: "https://www.pexels.com/photo/3456/" });
  });

  it("copes with a photo that has no caption and one with a very long one", () => {
    expect(libraryEntryFor(spec("cat"), { ...candidate, description: "" }).subject).toBe("Cat portrait");
    expect(libraryEntryFor(spec("cat"), { ...candidate, description: "x ".repeat(400) }).subject.length).toBeLessThanOrEqual(260);
  });

  it("is found by the avatars a planner writes, before any stock search", () => {
    const planned = (subject: string, semanticCategory: AssetRequirement["semanticCategory"], semanticTags: string[]): AssetRequirement => ({
      ...specRequirement(spec("dog")), id: "planned", subject, semanticCategory, semanticTags, origin: "planner_inferred",
    });
    const library = SAMPLE_IMAGERY_SPECS.map((item) => ({ item, entry: libraryEntryFor(item, { ...candidate, description: "", tags: [] }) }));
    const finds = (requirement: AssetRequirement) => library.filter(({ item, entry }) => isSemanticallyCompatible({
      requirement, assetRole: "avatar", assetCategory: item.category, assetSubject: entry.subject, assetTags: entry.tags,
    })).map(({ item }) => item.id);

    expect(finds(planned("Biscuit, a golden retriever puppy", "animal", ["dog", "puppy"]))).toEqual(expect.arrayContaining(["dog", "puppy"]));
    expect(finds(planned("Whiskers, a tabby cat", "animal", ["cat"]))).toContain("cat");
    expect(finds(planned("Cocoa, a brown rabbit", "animal", ["rabbit"]))).toEqual(["rabbit"]);
    expect(finds(planned("Kiwi, a green parrot", "animal", ["parrot", "bird"]))).toEqual(["bird"]);
    expect(finds(planned("Maya, a smiling mother", "person", ["woman", "mother"]))).toContain("woman-adult");
    expect(finds(planned("Dad", "person", ["man", "father"]))).toContain("man-adult");
    expect(finds(planned("Grandma Rose", "person", ["grandmother", "senior"]))).toContain("woman-senior");
    expect(finds(planned("Leo, a seven year old boy", "person", ["boy", "child"]))).toContain("boy");
    expect(finds(planned("Team member headshot", "person", ["headshot"])).length).toBeGreaterThan(0);
    expect(finds(planned("Client profile photo", "person", ["profile"])).length).toBeGreaterThan(0);
    // a pet is never offered for a person, or the other way round
    expect(finds(planned("Maya, a smiling mother", "person", ["woman"]))).not.toContain("dog");
    expect(finds(planned("Biscuit, a golden retriever puppy", "animal", ["dog"]))).not.toContain("woman-adult");
  });
});
