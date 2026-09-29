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

/** Well-known serif and slab families on Google Fonts, in lower case. A family that is not here is taken for a sans. */
const SERIF_FONT_FAMILIES = new Set([
  "playfair display", "playfair display sc", "lora", "merriweather", "libre baskerville", "baskervville", "cormorant", "cormorant garamond",
  "cormorant infant", "eb garamond", "dm serif display", "dm serif text", "fraunces", "newsreader", "source serif 4", "source serif pro",
  "crimson text", "crimson pro", "pt serif", "noto serif", "noto serif display", "bitter", "roboto slab", "roboto serif", "zilla slab",
  "spectral", "gelasio", "alegreya", "vollkorn", "old standard tt", "bodoni moda", "instrument serif", "young serif", "gloock",
  "libre caslon text", "libre caslon display", "cardo", "domine", "arvo", "abril fatface", "cinzel", "rufina", "prata", "marcellus",
  "literata", "tinos", "yeseva one", "bellefair", "lustria", "neuton", "frank ruhl libre", "ibm plex serif", "stix two text", "aleo",
  "rokkitt", "josefin slab", "crete round", "podkova", "playfair", "libre bodoni", "gilda display", "italiana", "cormorant upright",
]);

/** Well-known monospaced families, in lower case. */
const MONO_FONT_FAMILIES = new Set([
  "jetbrains mono", "fira code", "fira mono", "ibm plex mono", "roboto mono", "source code pro", "space mono", "dm mono", "inconsolata",
  "ubuntu mono", "courier prime", "overpass mono", "red hat mono", "geist mono", "martian mono", "azeret mono", "sometype mono",
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

/**
 * Whether a stack is set in a serif or monospaced face, from its family or, for a family this list does not
 * know, from the generic keyword the model closed the stack with (`"Foo", serif`). Null for a sans.
 */
export const fontClassOf = (fontFamily?: string | null): "serif" | "mono" | null => {
  const families = parseFontFamilyList(fontFamily);
  const primary = namedFontFamily(fontFamily)?.toLowerCase();
  if (primary && MONO_FONT_FAMILIES.has(primary)) return "mono";
  if (primary && SERIF_FONT_FAMILIES.has(primary)) return "serif";
  const closing = families.slice(1).map((family) => family.toLowerCase()).filter((family) => GENERIC_FONT_FAMILIES.has(family));
  if (closing.includes("monospace") || closing.includes("ui-monospace")) return "mono";
  if (closing.includes("serif") || closing.includes("ui-serif")) return "serif";
  return null;
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

/**
 * The stacks with any serif or monospaced role replaced, for a reference whose letters were read as a sans:
 * a heading by the body's sans, else by a sans the model recommended, else by the neutral default; a body by a
 * recommended sans of another family, else by the neutral default. A stack that is already a sans is kept.
 */
export function keepSansFamilies({
  heading,
  body,
  recommended = [],
}: {
  heading?: string | null;
  body?: string | null;
  recommended?: readonly string[];
}): { heading: string | null; body: string | null } {
  const isSans = (stack?: string | null) => Boolean(namedFontFamily(stack)) && !fontClassOf(stack);
  const sans = recommended.map((family) => family.trim()).filter((family) => loadableFontFamily(family) && !fontClassOf(family));

  const nextHeading = !heading || isSans(heading)
    ? heading ?? null
    : isSans(body) ? String(body).trim() : sans[0] ? stackOf(loadableFontFamily(sans[0])!) : DEFAULT_HEADING_STACK;
  const headingFamily = loadableFontFamily(nextHeading)?.toLowerCase();
  const otherSans = sans.find((family) => loadableFontFamily(family)?.toLowerCase() !== headingFamily);
  const nextBody = !body || isSans(body)
    ? body ?? null
    : otherSans ? stackOf(loadableFontFamily(otherSans)!) : DEFAULT_BODY_STACK;
  return { heading: nextHeading, body: nextBody };
}
