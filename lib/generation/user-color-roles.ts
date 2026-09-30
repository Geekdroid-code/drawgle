import { hexToLab, labChroma, parseHex } from "@/lib/color-lab";
import { HEX_COLOUR_SOURCE } from "@/lib/generation/design-value-scrub";

/**
 * Which token colour roles the user's explicit design requirements name.
 *
 * A measured palette fills the roles the user left open. It must never overwrite
 * a colour the user asked for ("Soft Sage", "Warm Cream"), so the calibration
 * skips the roles that this reports.
 *
 * The token model's own reading of the request is the first answer (lib/generation/token-labels.ts): it reads any
 * language and tells a product word from a colour. This is the fallback for when it did not say, and it is careful:
 * a colour word with no role and no talk of colour is taken for a product word ("private jet", "gold tier").
 */

export type ColorRole = "background" | "surface" | "action" | "text";

const HEX = new RegExp(HEX_COLOUR_SOURCE, "gi");
/** Words that make a fact about colour, so that a colour word in it is a colour. */
const COLOUR_TALK = /\b(?:colou?rs?|palettes?|hues?|shades?|tints?|tones?|(?:dark|light)\s+(?:mode|theme|ui))\b/i;

const LIGHT_NEUTRAL = /\b(?:cream|ivory|beige|sand|off[- ]?white|white|paper|linen|oat(?:meal)?|bone|snow|parchment|eggshell|alabaster|pearl|milk|vanilla|porcelain|chalk)\b/i;
const DARK = /\b(?:black|charcoal|obsidian|onyx|midnight|jet|ebony|graphite|dark)\b/i;
const HUE = /\b(?:red|orange|amber|yellow|lime|green|sage|mint|teal|cyan|blue|navy|indigo|violet|purple|lavender|lilac|pink|rose|coral|peach|apricot|salmon|brown|tan|gold|olive|burgundy|maroon|terracotta|turquoise|emerald|cobalt|crimson|magenta|fuchsia|plum|forest|sky|ocean|honey|mustard|rust|clay|copper|bronze)\b/i;

const ROLE_WORDS: Array<[ColorRole, RegExp]> = [
  ["background", /\b(?:background|canvas|page|backdrop|wallpaper|base colou?rs?)\b/i],
  ["surface", /\b(?:cards?|surfaces?|panels?|sheets?|tiles?)\b/i],
  ["action", /\b(?:accents?|primary|brand|buttons?|cta|actions?|highlights?|links?|selected|active)\b/i],
  ["text", /\b(?:text|font colou?rs?|ink|typography colou?rs?|heading colou?rs?|type colou?rs?)\b/i],
];

type RequirementFact = { label?: unknown; detail?: unknown; evidence?: unknown };

const factsFrom = (requirements: string): string[] => {
  // compileDesignRequirements writes the facts as one JSON array on its own line,
  // followed by a reference transfer note that must not be read as a user colour.
  const line = requirements.split(/\r?\n/).find((candidate) => candidate.trimStart().startsWith("["));
  if (line) {
    try {
      const parsed = JSON.parse(line) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .filter((fact): fact is RequirementFact => Boolean(fact) && typeof fact === "object")
          .map((fact) => [fact.label, fact.detail].filter((part) => typeof part === "string").join(" "))
          .filter(Boolean);
      }
    } catch {
      // Not the compiled requirement list: read the whole text as one requirement.
    }
  }
  return [requirements];
};

const rolesForHex = (hex: string): ColorRole[] => {
  const lab = hexToLab(hex);
  if (!lab || !parseHex(hex)) return [];
  if (labChroma(lab) >= 25) return ["action"];
  return lab[0] >= 70 ? ["background"] : ["background", "text"];
};

/** The colour roles the requirements name, or an empty set when they name no colour. */
export function userNamedColorRoles(designRequirements: string | null | undefined): Set<ColorRole> {
  const named = new Set<ColorRole>();
  if (!designRequirements?.trim()) return named;

  for (const text of factsFrom(designRequirements)) {
    const hexes = text.match(HEX) ?? [];
    const light = LIGHT_NEUTRAL.test(text);
    const dark = DARK.test(text);
    const hue = HUE.test(text);
    if (hexes.length === 0 && !light && !dark && !hue) continue;

    const explicit = ROLE_WORDS.filter(([, pattern]) => pattern.test(text)).map(([role]) => role);
    if (explicit.length > 0) {
      explicit.forEach((role) => named.add(role));
      continue;
    }
    // A colour word with no role and no talk of colour is more often a product's own word: "private jet",
    // "white-label", "gold tier", "coral reef". Only a fact about colour, or a hex code, names one.
    if (hexes.length === 0 && !COLOUR_TALK.test(text)) continue;
    // A colour named without a role: infer the role from the colour itself.
    if (light) named.add("background");
    if (hue) named.add("action");
    if (dark) {
      named.add("background");
      named.add("text");
    }
    hexes.flatMap(rolesForHex).forEach((role) => named.add(role));
  }
  return named;
}

/** "font colour" is a colour; "font", "typeface", "serif" and the like name the type itself. */
const FONT_WORDS = /\b(?:fonts?\b(?!\s+colou?rs?)|typefaces?\b|serif\b|sans[- ]?serif\b|monospace\b|handwrit\w*)/i;

/**
 * Whether the requirements name fonts. Like a named colour, a named font is the user's: a preset's own
 * type stays unless they asked for another.
 */
export function userNamesTypography(designRequirements: string | null | undefined): boolean {
  if (!designRequirements?.trim()) return false;
  return factsFrom(designRequirements).some((text) => FONT_WORDS.test(text));
}
