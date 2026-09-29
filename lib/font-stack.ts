/**
 * Font-family stacks: which family a stack asks for first, and whether the app can load it.
 *
 * The canvas and the exports load fonts by name from Google Fonts. A generic keyword (`serif`) names no
 * font, so the browser draws its own default (Times). A face that only some devices ship (SF Pro, New
 * York) is not served by Google Fonts, and one request that names it fails as a whole, so none of the
 * project's fonts load. Both are a wrong answer, not a design choice, so neither is kept.
 */

/** Keywords that name no font. */
const GENERIC_FONT_FAMILIES = new Set([
  "sans-serif",
  "serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui",
  "ui-sans-serif",
  "ui-serif",
  "ui-monospace",
  "-apple-system",
  "blinkmacsystemfont",
  "segoe ui",
  "emoji",
  "math",
  "fangsong",
]);

/** Faces that ship with an operating system and are not served by Google Fonts. */
const DEVICE_ONLY_FONT_FAMILIES = new Set([
  "sf pro",
  "sf pro display",
  "sf pro text",
  "sf pro rounded",
  "sf compact",
  "sf mono",
  "san francisco",
  "new york",
  "helvetica",
  "helvetica neue",
  "arial",
  "times",
  "times new roman",
  "georgia",
  "verdana",
  "tahoma",
  "trebuchet ms",
  "menlo",
  "monaco",
  "consolas",
  "courier new",
  "avenir",
  "avenir next",
]);

/** The families of a CSS font stack, in order, without their quotes. */
export const parseFontFamilyList = (fontFamily?: string | null) => {
  const value = fontFamily?.trim();
  if (!value) return [];

  const families: string[] = [];
  let current = "";
  let quote: string | null = null;

  for (const character of value) {
    if ((character === "'" || character === "\"") && !quote) {
      quote = character;
      continue;
    }

    if (quote === character) {
      quote = null;
      continue;
    }

    if (character === "," && !quote) {
      if (current.trim()) families.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  if (current.trim()) families.push(current.trim());

  return families
    .map((family) => family.replace(/^['"]|['"]$/g, "").trim())
    .filter(Boolean);
};

/** The family a stack asks for first, when that is a font name and not a keyword. */
export const namedFontFamily = (fontFamily?: string | null): string | null => {
  const family = parseFontFamilyList(fontFamily)[0];
  if (!family) return null;

  const lower = family.toLowerCase();
  if (GENERIC_FONT_FAMILIES.has(lower) || lower.startsWith("var(")) return null;
  return /^[\p{L}\p{N} ._-]+$/u.test(family) ? family : null;
};

/** The family a stack asks for first, when that is a real font the app can load by name. */
export const loadableFontFamily = (fontFamily?: string | null): string | null => {
  const family = namedFontFamily(fontFamily);
  return family && !DEVICE_ONLY_FONT_FAMILIES.has(family.toLowerCase()) ? family : null;
};

const DEFAULT_HEADING_STACK = '"Manrope", sans-serif';
const DEFAULT_BODY_STACK = '"Inter", sans-serif';

const stackOf = (family: string) => `"${family}", sans-serif`;

/**
 * The heading and body stacks a generated token set keeps. A stack that asks for a font the app can load
 * is kept as written, and one family for both roles is a choice the evidence can make: a reference that
 * sets everything in one typeface gets one typeface, with hierarchy from size and weight. Only a role
 * with no loadable font is filled in: from the fonts the model recommended, and then from the neutral UI
 * defaults.
 *
 * A user who named fonts keeps them even when only some devices have them (`keepDeviceFaces`): the canvas
 * cannot load such a face, but replacing a font the user asked for is worse than drawing a fallback.
 */
export function resolveFontFamilies({
  heading,
  body,
  recommended = [],
  keepDeviceFaces = false,
}: {
  heading?: string | null;
  body?: string | null;
  recommended?: readonly string[];
  keepDeviceFaces?: boolean;
}): { heading: string; body: string } {
  const usable = keepDeviceFaces ? namedFontFamily : loadableFontFamily;
  const named = recommended.map((family) => usable(family)).filter((family): family is string => Boolean(family));
  const chosenHeading = usable(heading) ? String(heading).trim() : named[0] ? stackOf(named[0]) : DEFAULT_HEADING_STACK;
  if (usable(body)) return { heading: chosenHeading, body: String(body).trim() };

  const headingFamily = usable(chosenHeading)?.toLowerCase();
  const other = named.find((family) => family.toLowerCase() !== headingFamily);
  return { heading: chosenHeading, body: other ? stackOf(other) : DEFAULT_BODY_STACK };
}
