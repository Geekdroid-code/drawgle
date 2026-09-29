import { parseHex, type Rgb } from "@/lib/color-lab";

/**
 * Just enough box-shadow parsing to judge and calibrate elevation: which layers
 * actually lift a surface off the page, and how to soften a shadow without
 * inventing a new one.
 */

export type ShadowLayer = {
  inset: boolean;
  x: number;
  y: number;
  blur: number;
  spread: number;
  alpha: number;
  /** The layer's colour as sRGB, or null when it is not a colour this parser reads. */
  rgb: Rgb | null;
};

const splitTopLevel = (value: string) => {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const character of value) {
    if (character === "(") depth += 1;
    if (character === ")") depth -= 1;
    if (character === "," && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += character;
  }
  if (current.trim()) parts.push(current);
  return parts;
};

const COLOR_IN_SHADOW = /(rgba?\([^)]*\)|hsla?\([^)]*\)|color\([^)]*\)|#[0-9a-f]{3,8}\b)/i;

const clampByte = (value: number) => Math.min(255, Math.max(0, Math.round(value)));

const hslToRgb = (hue: number, saturation: number, lightness: number): Rgb => {
  const s = saturation / 100;
  const l = lightness / 100;
  const k = (n: number) => (n + hue / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [clampByte(f(0) * 255), clampByte(f(8) * 255), clampByte(f(4) * 255)];
};

const readAlpha = (raw: string | undefined) => {
  if (raw === undefined) return 1;
  const value = raw.endsWith("%") ? Number.parseFloat(raw) / 100 : Number.parseFloat(raw);
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 1;
};

const parseShadowColor = (color: string | undefined): { rgb: Rgb | null; alpha: number } => {
  if (!color) return { rgb: null, alpha: 1 };
  const rgba = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i.exec(color);
  if (rgba) {
    return { rgb: [clampByte(Number(rgba[1])), clampByte(Number(rgba[2])), clampByte(Number(rgba[3]))], alpha: readAlpha(rgba[4]) };
  }
  const hsla = /^hsla?\(\s*([\d.]+)(?:deg)?[,\s]+([\d.]+)%[,\s]+([\d.]+)%(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i.exec(color);
  if (hsla) return { rgb: hslToRgb(Number(hsla[1]), Number(hsla[2]), Number(hsla[3])), alpha: readAlpha(hsla[4]) };
  const hex = /^#([0-9a-f]{4}|[0-9a-f]{8})$/i.exec(color);
  if (hex) {
    const digits = hex[1].length === 4 ? hex[1][3] + hex[1][3] : hex[1].slice(6, 8);
    return { rgb: parseHex(color), alpha: Number.parseInt(digits, 16) / 255 };
  }
  return { rgb: parseHex(color), alpha: 1 };
};

export const parseShadowLayers = (shadow: string | null | undefined): ShadowLayer[] => {
  if (!shadow || shadow.trim().toLowerCase() === "none") return [];
  return splitTopLevel(shadow).flatMap((layer) => {
    const color = COLOR_IN_SHADOW.exec(layer)?.[1];
    const rest = layer.replace(COLOR_IN_SHADOW, " ");
    const inset = /\binset\b/i.test(rest);
    const lengths = Array.from(rest.matchAll(/-?\d+(?:\.\d+)?/g)).map((match) => Number.parseFloat(match[0]));
    if (lengths.length < 2) return [];
    const [x, y, blur = 0, spread = 0] = lengths;
    const parsed = parseShadowColor(color);
    return [{ inset, x, y, blur, spread, alpha: parsed.alpha, rgb: parsed.rgb }];
  });
};

/** A shadow that lifts a surface off the page. Inset rings and 1px hairlines do not count. */
export const hasCastShadow = (shadow: string | null | undefined) =>
  parseShadowLayers(shadow).some((layer) =>
    !layer.inset
    && layer.alpha > 0.015
    && (layer.blur > 1 || Math.abs(layer.x) > 1 || Math.abs(layer.y) > 1 || layer.spread > 1));

const px = (value: number) => `${Math.round(value * 100) / 100}px`;

/**
 * Softens a shadow: no blur beyond `maxBlur`, no layer more opaque than
 * `maxAlpha`. Offsets and spreads are kept. Returns null when no layer can be
 * read, so the caller decides what to use instead of guessing here.
 */
export const capShadow = (shadow: string | null | undefined, { maxBlur, maxAlpha }: { maxBlur: number; maxAlpha: number }) => {
  const layers = parseShadowLayers(shadow);
  if (layers.length === 0) return null;
  const rewritten = layers.map((layer) => {
    const rgb = layer.rgb ?? [0, 0, 0];
    const alpha = Math.round(Math.min(layer.alpha, maxAlpha) * 1000) / 1000;
    return `${layer.inset ? "inset " : ""}${px(layer.x)} ${px(layer.y)} ${px(Math.min(layer.blur, maxBlur))} ${px(layer.spread)} rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
  });
  return rewritten.join(", ");
};

/** A canonical soft shadow in the given colour, for when the model's own could not be read. */
export const softShadow = (rgb: Rgb) => `0px 4px 16px 0px rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.06)`;
