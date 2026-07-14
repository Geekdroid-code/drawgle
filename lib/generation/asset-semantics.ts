import { createHash } from "crypto";

import type {
  AssetRequirement,
  VisualAssetRole,
  VisualAssetSemanticCategory,
} from "@/lib/types";

export const VISUAL_ASSET_SEMANTIC_CATEGORIES = [
  "person",
  "animal",
  "food",
  "fashion",
  "electronics",
  "vehicle",
  "fitness",
  "beauty",
  "home",
  "place",
  "nature",
  "map",
  "logo",
  "generic_product",
  "other",
] as const satisfies readonly VisualAssetSemanticCategory[];

const STOP_WORDS = new Set([
  "app", "asset", "background", "card", "cards", "cutout", "display", "for", "hero",
  "image", "images", "mobile", "object", "photo", "picture", "premium", "product", "screen",
  "section", "the", "transparent", "with",
]);

const CATEGORY_PATTERNS: Array<[VisualAssetSemanticCategory, RegExp]> = [
  ["logo", /\b(brand mark|brand logo|company logo|logo|wordmark)\b/i],
  ["map", /\b(map|route|street map|terrain|tracking map)\b/i],
  ["animal", /\b(animal|bird|cat|dog|kitten|pet|puppy)\b/i],
  ["food", /\b(bakery|berries|berry|beverages?|breakfast|burgers?|cake|cereal|cheeseburger|chicken|cookies?|dessert|drinks?|food|fries|fruits?|gnocchi|grocery|ice ?cream|mango|meal|papaya|pastr(?:y|ies)|pineapple|recipe|restaurant|taco|vegetables?)\b/i],
  ["electronics", /\b(audio|cameras?|cctv|computers?|devices?|earbuds?|headphones?|homepod|laptops?|phones?|smart ?speaker|speakers?|technology|televisions?|tv)\b/i],
  ["vehicle", /\b(automobile|bicycle|bike|cars?|motorcycle|scooter|sedan|taxi|truck|van|vehicle)\b/i],
  ["beauty", /\b(beauty|cosmetic|makeup|perfume|skincare)\b/i],
  ["fashion", /\b(bag|clothing|dress|fashion|jacket|shirt|shoe|sneaker|streetwear|top|watch)\b/i],
  ["fitness", /\b(athlete|biceps|chest|dumbbell|exercise|fitness|gym|muscle|runner|sports|torso|trainer|workout|yoga)\b/i],
  ["person", /\b(avatar|cleaner|face|female|founder|girl|headshot|human|male|man|member|people|person|portrait|profile|team|user|woman)\b/i],
  ["home", /\b(chair|decor|furniture|home|interior|lamp|room|sofa)\b/i],
  ["place", /\b(building|city|destination|hotel|landmark|place|resort|travel)\b/i],
  ["nature", /\b(beach|forest|landscape|mountain|nature|ocean|plant|tree)\b/i],
  ["generic_product", /\b(catalog|commerce|ecommerce|merchandise|shop|store)\b/i],
];

const TAG_GROUPS = [
  ["bakery", "baked", "baked_goods", "cake", "cookie", "cookies", "dessert", "pastry"],
  ["berry", "fruit", "grocery", "mango", "papaya", "pineapple", "produce"],
  ["burger", "cheeseburger", "fast_food", "fries", "taco"],
  ["audio", "earbud", "earbuds", "headphone", "headphones"],
  ["automobile", "car", "sedan", "taxi", "vehicle"],
  ["avatar", "face", "headshot", "person", "portrait", "profile"],
] as const;

const TAG_ALIASES = new Map<string, Set<string>>();
for (const group of TAG_GROUPS) {
  const values = new Set(group);
  for (const tag of group) TAG_ALIASES.set(tag, values);
}

export function normalizeSemanticToken(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export function semanticTokens(values: Array<string | null | undefined>) {
  const tokens = new Set<string>();
  for (const value of values) {
    for (const raw of (value ?? "").toLowerCase().split(/[^a-z0-9]+/)) {
      const token = normalizeSemanticToken(raw);
      if (token.length >= 3 && !STOP_WORDS.has(token)) tokens.add(token);
    }
  }
  return tokens;
}

export function inferSemanticCategory(
  subject: string,
  role?: VisualAssetRole | null,
): VisualAssetSemanticCategory {
  if (role === "map_texture") return "map";
  for (const [category, pattern] of CATEGORY_PATTERNS) {
    if (pattern.test(subject)) return category;
  }
  if (role === "avatar") return "person";
  if (role === "product_cutout" || role === "product_photo") return "generic_product";
  return "other";
}

export function normalizeSemanticTags(values: string[], category: VisualAssetSemanticCategory) {
  const tags = semanticTokens(values);
  tags.add(category);
  return Array.from(tags).slice(0, 20);
}

export function expandSemanticTags(values: Iterable<string>) {
  const expanded = new Set<string>();
  for (const raw of values) {
    const tag = normalizeSemanticToken(raw);
    if (!tag) continue;
    expanded.add(tag);
    for (const alias of TAG_ALIASES.get(tag) ?? []) expanded.add(alias);
  }
  return expanded;
}

export function semanticOverlap(left: Iterable<string>, right: Iterable<string>) {
  const a = expandSemanticTags(left);
  const b = expandSemanticTags(right);
  let overlap = 0;
  for (const token of a) if (b.has(token)) overlap += 1;
  return overlap;
}

export function isSemanticallyCompatible({
  requirement,
  assetRole,
  assetCategory,
  assetSubject,
  assetTags,
  exactReuseKey = false,
}: {
  requirement: AssetRequirement;
  assetRole: string;
  assetCategory: string | null | undefined;
  assetSubject: string;
  assetTags: string[];
  exactReuseKey?: boolean;
}) {
  if (assetRole !== requirement.role) return false;
  if (assetCategory !== requirement.semanticCategory) return false;
  if (requirement.semanticCategory === "generic_product") return exactReuseKey;
  if (exactReuseKey) return true;

  const requirementSpecific = semanticTokens([requirement.subject, ...requirement.semanticTags])
  const assetSpecific = semanticTokens([assetSubject, ...assetTags]);
  requirementSpecific.delete(requirement.semanticCategory);
  assetSpecific.delete(requirement.semanticCategory);

  if (requirementSpecific.size === 0) return true;
  return semanticOverlap(requirementSpecific, assetSpecific) > 0;
}

export function semanticRequirementKey(requirement: AssetRequirement) {
  const tags = normalizeSemanticTags(requirement.semanticTags, requirement.semanticCategory).sort().join("-");
  const subject = Array.from(semanticTokens([requirement.subject])).sort().join("-");
  return [requirement.role, requirement.semanticCategory, subject, tags].filter(Boolean).join(":");
}

export function stableCandidateIndex(seed: string, length: number) {
  if (length <= 1) return 0;
  const hash = createHash("sha256").update(seed).digest();
  return hash.readUInt32BE(0) % length;
}
