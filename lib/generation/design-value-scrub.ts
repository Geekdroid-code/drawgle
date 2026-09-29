/**
 * Keeps design values out of the prose layers.
 *
 * A number a model writes into prose is copied downstream as an order: "32px"
 * became every card's radius, "4% opacity soft shadow" every card's shadow, and
 * the builder obeyed the text over the image. In style mode the reference owns
 * the look, tokens own the values, and the planner's input, charter and briefs
 * describe intent and structure. Every value that could still reach them
 * (from an older stored analysis, a fallback, or a model slip) is removed here,
 * deterministically, without asking a model again.
 */

const COMPARATIVE = "(?:(?:at least|at most|up to|about|around|roughly|approximately|over|under|exactly|max(?:imum)?|min(?:imum)?|no more than|no less than)\\s+|~\\s*)?";
const UNIT = "(?:px|pt|rem|dp)";
const NUMBER = "\\d+(?:\\.\\d+)?";

const SHADOW_SHORTHAND = new RegExp(
  `(?:inset\\s+)?(?:-?${NUMBER}(?:px)?\\s+){2,3}-?${NUMBER}px(?:\\s+-?${NUMBER}px)?(?:\\s+(?:rgba?\\([^)]*\\)|hsla?\\([^)]*\\)|#[0-9a-f]{3,8}\\b))?`,
  "gi",
);
const COLOUR_FUNCTION = /\b(?:rgba?|hsla?|oklch|oklab|color)\([^)]*\)/gi;
const HEX_COLOUR = /(?<![\w&])#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b/gi;
const OPACITY = new RegExp(
  `\\b${NUMBER}\\s?%\\s*(?:opacity|alpha|transparen\\w*)|\\b(?:opacity|alpha)\\s*(?:of|at|:|=)?\\s*${NUMBER}\\s?%?`,
  "gi",
);
const SIZE_RANGE = new RegExp(`${COMPARATIVE}${NUMBER}\\s*[-–]\\s*${NUMBER}\\s?${UNIT}\\+?`, "gi");
const SIZE = new RegExp(`${COMPARATIVE}${NUMBER}\\s?${UNIT}\\+?`, "gi");

const PATTERNS = [SHADOW_SHORTHAND, COLOUR_FUNCTION, HEX_COLOUR, OPACITY, SIZE_RANGE, SIZE] as const;

/** True when the text carries a px/pt size, a hex or colour-function value, or an opacity value. */
export const hasDesignValues = (text: string | null | undefined) =>
  Boolean(text) && PATTERNS.some((pattern) => new RegExp(pattern.source, pattern.flags.replace("g", "")).test(text as string));

/** Removes design values and tidies the sentence around them. */
export const stripDesignValues = (text: string): string => {
  if (!hasDesignValues(text)) return text;
  let next = text;
  for (const pattern of PATTERNS) next = next.replace(new RegExp(pattern.source, pattern.flags), "");
  return next
    .replace(/\(\s*[,;:/+-]*\s*\)/g, "")
    .replace(/\[\s*[,;:/+-]*\s*\]/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+([,.;:!?)])/g, "$1")
    .replace(/([(\[])[ \t]+/g, "$1")
    .replace(/,\s*(?=[,.;:])/g, "")
    .replace(/(?:^|(?<=[.;:]))\s*,\s*/g, " ")
    .replace(/\s+(?:of|with|at|and|or|to|a|an|the)\s*(?=[.,;:!?]|$)/gi, "")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
};

/** Applies stripDesignValues to every string in a list, dropping entries that become empty. */
export const stripDesignValuesFromList = (values: readonly string[]) =>
  values.map(stripDesignValues).filter((value) => value.trim().length > 0);

/** Recursively scrubs every string leaf of a JSON-like value. Objects and arrays keep their shape. */
export function stripDesignValuesDeep<T>(value: T): T {
  if (typeof value === "string") return stripDesignValues(value) as unknown as T;
  if (Array.isArray(value)) return value.map((entry) => stripDesignValuesDeep(entry)) as unknown as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, stripDesignValuesDeep(entry)]),
    ) as T;
  }
  return value;
}
