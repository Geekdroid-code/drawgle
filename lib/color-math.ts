/**
 * Perceptual color math for design-token relationship checks.
 *
 * Token relationships (is this surface the same hue family as its background?
 * is the lightness step deliberate or accidental?) cannot be judged in sRGB
 * because sRGB distance does not match perceived distance. OKLab/OKLCH does,
 * and it is cheap enough to run on every generated token set.
 */

export interface Oklch {
  /** Perceptual lightness, 0-1. */
  l: number;
  /** Chroma, 0 (neutral gray) to roughly 0.37 for the most saturated sRGB colors. */
  c: number;
  /** Hue angle in degrees, 0-360. Meaningless when chroma is ~0. */
  h: number;
  /** Alpha, 0-1. */
  alpha: number;
}

export interface Rgb {
  r: number;
  g: number;
  b: number;
  alpha: number;
}

/** Chroma at or below this reads as neutral; hue is not meaningful. */
export const NEUTRAL_CHROMA_CEILING = 0.02;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const HEX_PATTERN = /^#?([0-9a-f]{3,8})$/i;
const RGB_PATTERN = /^rgba?\(\s*([0-9.]+)[\s,]+([0-9.]+)[\s,]+([0-9.]+)(?:[\s,/]+([0-9.%]+))?\s*\)$/i;

const parseAlphaComponent = (value: string | undefined) => {
  if (value === undefined) return 1;
  const trimmed = value.trim();
  if (trimmed.endsWith("%")) {
    const percent = Number.parseFloat(trimmed.slice(0, -1));
    return Number.isFinite(percent) ? clamp01(percent / 100) : 1;
  }
  const numeric = Number.parseFloat(trimmed);
  return Number.isFinite(numeric) ? clamp01(numeric) : 1;
};

export function parseCssColor(value: unknown): Rgb | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const hex = HEX_PATTERN.exec(trimmed)?.[1];
  if (hex) {
    const expand = (channel: string) => Number.parseInt(channel.repeat(2), 16);
    if (hex.length === 3 || hex.length === 4) {
      return {
        r: expand(hex[0]),
        g: expand(hex[1]),
        b: expand(hex[2]),
        alpha: hex.length === 4 ? expand(hex[3]) / 255 : 1,
      };
    }
    if (hex.length === 6 || hex.length === 8) {
      const channel = (offset: number) => Number.parseInt(hex.slice(offset, offset + 2), 16);
      return {
        r: channel(0),
        g: channel(2),
        b: channel(4),
        alpha: hex.length === 8 ? channel(6) / 255 : 1,
      };
    }
    return null;
  }

  const rgb = RGB_PATTERN.exec(trimmed);
  if (rgb) {
    const channel = (raw: string) => {
      const numeric = Number.parseFloat(raw);
      return Number.isFinite(numeric) ? Math.min(255, Math.max(0, numeric)) : null;
    };
    const r = channel(rgb[1]);
    const g = channel(rgb[2]);
    const b = channel(rgb[3]);
    if (r === null || g === null || b === null) return null;
    return { r, g, b, alpha: parseAlphaComponent(rgb[4]) };
  }

  return null;
}

const srgbToLinear = (channel: number) => {
  const normalized = channel / 255;
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
};

const linearToSrgb = (channel: number) => {
  const encoded = channel <= 0.0031308 ? channel * 12.92 : 1.055 * channel ** (1 / 2.4) - 0.055;
  return Math.round(clamp01(encoded) * 255);
};

export function rgbToOklch({ r, g, b, alpha }: Rgb): Oklch {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);

  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);

  const okL = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
  const okA = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
  const okB = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;

  const chroma = Math.sqrt(okA * okA + okB * okB);
  const hue = chroma < 1e-6 ? 0 : ((Math.atan2(okB, okA) * 180) / Math.PI + 360) % 360;

  return { l: okL, c: chroma, h: hue, alpha };
}

export function oklchToRgb({ l, c, h, alpha }: Oklch): Rgb {
  const hueRadians = (h * Math.PI) / 180;
  const okA = c * Math.cos(hueRadians);
  const okB = c * Math.sin(hueRadians);

  const lCube = (l + 0.3963377774 * okA + 0.2158037573 * okB) ** 3;
  const mCube = (l - 0.1055613458 * okA - 0.0638541728 * okB) ** 3;
  const sCube = (l - 0.0894841775 * okA - 1.2914855480 * okB) ** 3;

  return {
    r: linearToSrgb(4.0767416621 * lCube - 3.3077115913 * mCube + 0.2309699292 * sCube),
    g: linearToSrgb(-1.2684380046 * lCube + 2.6097574011 * mCube - 0.3413193965 * sCube),
    b: linearToSrgb(-0.0041960863 * lCube - 0.7034186147 * mCube + 1.7076147010 * sCube),
    alpha,
  };
}

export function toOklch(value: unknown): Oklch | null {
  const rgb = parseCssColor(value);
  return rgb ? rgbToOklch(rgb) : null;
}

export function formatHex({ r, g, b }: Rgb) {
  const channel = (value: number) => Math.round(value).toString(16).padStart(2, "0").toUpperCase();
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

export function oklchToHex(color: Oklch) {
  return formatHex(oklchToRgb(color));
}

/** Smallest angular distance between two hues, 0-180. */
export function hueDistance(left: number, right: number) {
  const delta = Math.abs(((left - right) % 360 + 360) % 360);
  return delta > 180 ? 360 - delta : delta;
}

export function relativeLuminance(value: unknown) {
  const rgb = parseCssColor(value);
  if (!rgb) return null;
  return 0.2126 * srgbToLinear(rgb.r) + 0.7152 * srgbToLinear(rgb.g) + 0.0722 * srgbToLinear(rgb.b);
}

/** WCAG 2.x contrast ratio, 1-21. Returns null when either color cannot be parsed. */
export function contrastRatio(foreground: unknown, background: unknown) {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  if (foregroundLuminance === null || backgroundLuminance === null) return null;
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Nudge a foreground color along its own lightness axis until it clears the
 * target contrast ratio against `background`, preserving hue and chroma.
 *
 * Preserving hue matters: the naive fix (swap to black or white) destroys the
 * palette's character, which is exactly the kind of blunt correction a
 * designer would reject.
 */
export function ensureContrast(
  foreground: string,
  background: string,
  targetRatio: number,
  maxSteps = 24,
): string | null {
  const current = contrastRatio(foreground, background);
  if (current === null) return null;
  if (current >= targetRatio) return foreground;

  const source = toOklch(foreground);
  const backgroundLuminance = relativeLuminance(background);
  if (!source || backgroundLuminance === null) return null;

  // Move away from the background: darken on light surfaces, lighten on dark.
  const direction = backgroundLuminance > 0.4 ? -1 : 1;
  const step = 0.03;

  let best = foreground;
  let bestRatio = current;

  for (let index = 1; index <= maxSteps; index += 1) {
    const lightness = clamp01(source.l + direction * step * index);
    const candidate = oklchToHex({ ...source, l: lightness });
    const ratio = contrastRatio(candidate, background) ?? 0;
    if (ratio > bestRatio) {
      best = candidate;
      bestRatio = ratio;
    }
    if (ratio >= targetRatio) return candidate;
    if (lightness <= 0 || lightness >= 1) break;
  }

  // Chroma can block the required contrast on vivid hues; drop it as a last
  // resort before falling back to a pure neutral.
  const neutral = oklchToHex({ ...source, c: 0, l: direction < 0 ? 0.15 : 0.97 });
  return (contrastRatio(neutral, background) ?? 0) > bestRatio ? neutral : best;
}
