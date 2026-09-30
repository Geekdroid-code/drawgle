import { normalizeSemanticTags } from "@/lib/generation/asset-semantics";
import type { AssetRequirement, VisualAssetSemanticCategory } from "@/lib/types";

/**
 * A starter set of sample portraits for the avatars a mockup shows: people of every age, and the animals people
 * keep. A planner-inferred avatar looks for one of these in the internal library before it asks a stock
 * provider, so the same reviewed photos turn up project after project. It is a starting point and not the limit
 * of what a product can show: any other subject (a horse, a chef, a shopfront) is found by the stock providers
 * the same way, and an entry added here is seeded by `pnpm seed:sample-imagery`.
 */
export type SampleImagerySpec = {
  id: string;
  /** What the photo shows. Kept generic, so that many projects' avatars can match it. */
  subject: string;
  category: Extract<VisualAssetSemanticCategory, "person" | "animal">;
  /** The words a planner's avatar subject is likely to share with it. */
  tags: string[];
  /** How many different photos to keep. */
  count: number;
};

export const SAMPLE_IMAGERY_SPECS: readonly SampleImagerySpec[] = [
  { id: "woman-adult", subject: "Smiling adult woman portrait", category: "person", tags: ["woman", "adult", "mother", "portrait", "headshot", "face"], count: 4 },
  { id: "man-adult", subject: "Smiling adult man portrait", category: "person", tags: ["man", "adult", "father", "portrait", "headshot", "face"], count: 4 },
  { id: "woman-young", subject: "Young woman portrait", category: "person", tags: ["woman", "young", "student", "portrait", "headshot", "face"], count: 3 },
  { id: "man-young", subject: "Young man portrait", category: "person", tags: ["man", "young", "student", "portrait", "headshot", "face"], count: 3 },
  { id: "woman-senior", subject: "Senior woman portrait", category: "person", tags: ["woman", "senior", "grandmother", "portrait", "face"], count: 2 },
  { id: "man-senior", subject: "Senior man portrait", category: "person", tags: ["man", "senior", "grandfather", "portrait", "face"], count: 2 },
  { id: "boy", subject: "Smiling boy portrait", category: "person", tags: ["boy", "child", "kid", "son", "portrait", "face"], count: 2 },
  { id: "girl", subject: "Smiling girl portrait", category: "person", tags: ["girl", "child", "kid", "daughter", "portrait", "face"], count: 2 },
  { id: "dog", subject: "Friendly dog portrait", category: "animal", tags: ["dog", "pet", "canine"], count: 6 },
  { id: "puppy", subject: "Puppy portrait", category: "animal", tags: ["puppy", "dog", "pet"], count: 3 },
  { id: "cat", subject: "Cat portrait", category: "animal", tags: ["cat", "pet", "feline"], count: 6 },
  { id: "kitten", subject: "Kitten portrait", category: "animal", tags: ["kitten", "cat", "pet"], count: 3 },
  { id: "rabbit", subject: "Rabbit portrait", category: "animal", tags: ["rabbit", "bunny", "pet"], count: 3 },
  { id: "bird", subject: "Pet bird portrait", category: "animal", tags: ["bird", "parrot", "budgie", "pet"], count: 3 },
];

/** The search a spec stands for: a distinct set of square photos, the same kind of requirement a planner writes. */
export const specRequirement = (spec: SampleImagerySpec): AssetRequirement => ({
  id: `sample-${spec.id}`,
  screenName: "Sample imagery",
  role: "avatar",
  subject: spec.subject,
  assetType: "photo",
  sourcePreference: "stock",
  desiredAspectRatio: "1:1",
  transparentBackground: false,
  placementHint: "A sample photo for an avatar or a profile picture.",
  priority: "supporting",
  reuseKey: `sample-${spec.id}`,
  semanticCategory: spec.category,
  semanticTags: normalizeSemanticTags([spec.subject, ...spec.tags], spec.category).slice(0, 8),
  slotCount: spec.count,
  reusePolicy: "distinct",
  origin: "planner_inferred",
});

/** The part of a stock candidate that a library entry keeps. */
export type SampleImageryCandidate = {
  provider: string;
  providerAssetId: string;
  description: string;
  tags: string[];
  license: string;
  attribution: string | null;
  sourceUrl: string | null;
};

const compact = (value: string) => value.replace(/\s+/g, " ").trim();

/** How a photo is stored: what it shows, the words that find it, and where it came from. */
export const libraryEntryFor = (spec: SampleImagerySpec, candidate: SampleImageryCandidate) => ({
  subject: compact(candidate.description ? `${spec.subject}: ${candidate.description}` : spec.subject).slice(0, 260),
  tags: [...new Set([...spec.tags, ...candidate.tags.map((tag) => tag.toLowerCase())])].slice(0, 20),
  reuseKey: `sample-${spec.id}-${candidate.provider}-${candidate.providerAssetId}`,
  license: candidate.license,
  attribution: candidate.attribution,
  sourceUrl: candidate.sourceUrl,
});
