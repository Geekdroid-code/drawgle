/**
 * Small, dependency-free colour maths shared by the design evaluation harness,
 * the reference palette measurement and the token calibration.
 *
 * Everything is sRGB in, CIE L*a*b* (D65) for comparisons. Colour differences
 * use CIEDE2000, the perceptual standard: "within ΔE 4" in this codebase always
 * means deltaE2000.
 */

export type Rgb = readonly [number, number, number];
export type Lab = readonly [number, number, number];

const clampByte = (value: number) => Math.min(255, Math.max(0, Math.round(value)));

/** Parses #rgb, #rrggbb and #rrggbbaa (the alpha channel is ignored). */
export const parseHex = (value: string | null | undefined): Rgb | null => {
  const match = value?.trim().match(/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (!match) return null;
  let hex = match[1];
  if (hex.length <= 4) hex = hex.split("").map((digit) => digit + digit).join("");
  return [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16)) as unknown as Rgb;
};

export const rgbToHex = (rgb: Rgb) =>
  `#${rgb.map((channel) => clampByte(channel).toString(16).padStart(2, "0")).join("")}`.toUpperCase();

const srgbToLinear = (channel: number) => {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
};

const linearToSrgb = (value: number) => {
  const clamped = Math.min(1, Math.max(0, value));
  return 255 * (clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * clamped ** (1 / 2.4) - 0.055);
};

const D65 = { x: 0.95047, y: 1, z: 1.08883 } as const;
const EPSILON = 216 / 24389;
const KAPPA = 24389 / 27;

const labForward = (t: number) => (t > EPSILON ? Math.cbrt(t) : (KAPPA * t + 16) / 116);
const labInverse = (t: number) => (t ** 3 > EPSILON ? t ** 3 : (116 * t - 16) / KAPPA);

export const rgbToLab = (rgb: Rgb): Lab => {
  const [red, green, blue] = rgb.map(srgbToLinear);
  const x = (0.4124564 * red + 0.3575761 * green + 0.1804375 * blue) / D65.x;
  const y = (0.2126729 * red + 0.7151522 * green + 0.072175 * blue) / D65.y;
  const z = (0.0193339 * red + 0.119192 * green + 0.9503041 * blue) / D65.z;
  const [fx, fy, fz] = [labForward(x), labForward(y), labForward(z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
};

export const labToRgb = (lab: Lab): Rgb => {
  const fy = (lab[0] + 16) / 116;
  const fx = fy + lab[1] / 500;
  const fz = fy - lab[2] / 200;
  const x = labInverse(fx) * D65.x;
  const y = (lab[0] > KAPPA * EPSILON ? fy ** 3 : lab[0] / KAPPA) * D65.y;
  const z = labInverse(fz) * D65.z;
  const red = 3.2404542 * x - 1.5371385 * y - 0.4985314 * z;
  const green = -0.969266 * x + 1.8760108 * y + 0.041556 * z;
  const blue = 0.0556434 * x - 0.2040259 * y + 1.0572252 * z;
  return [clampByte(linearToSrgb(red)), clampByte(linearToSrgb(green)), clampByte(linearToSrgb(blue))];
};

export const hexToLab = (hex: string | null | undefined): Lab | null => {
  const rgb = parseHex(hex);
  return rgb ? rgbToLab(rgb) : null;
};

export const labToHex = (lab: Lab) => rgbToHex(labToRgb(lab));

/** Chroma C*ab: 0 for greys, ~25 and above for a clearly coloured accent. */
export const labChroma = (lab: Lab) => Math.hypot(lab[1], lab[2]);

const degrees = (radians: number) => (radians * 180) / Math.PI;
const radians = (value: number) => (value * Math.PI) / 180;

export const labHue = (lab: Lab) => {
  const angle = degrees(Math.atan2(lab[2], lab[1]));
  return angle < 0 ? angle + 360 : angle;
};

export const deltaE76 = (first: Lab, second: Lab) =>
  Math.hypot(first[0] - second[0], first[1] - second[1], first[2] - second[2]);

/** CIEDE2000 (Sharma, Wu and Dalal 2005). */
export const deltaE2000 = (first: Lab, second: Lab) => {
  const [l1, a1, b1] = first;
  const [l2, a2, b2] = second;
  const c1 = Math.hypot(a1, b1);
  const c2 = Math.hypot(a2, b2);
  const meanChroma = (c1 + c2) / 2;
  const chromaTerm = Math.sqrt(meanChroma ** 7 / (meanChroma ** 7 + 25 ** 7));
  const g = 0.5 * (1 - chromaTerm);
  const a1Prime = (1 + g) * a1;
  const a2Prime = (1 + g) * a2;
  const c1Prime = Math.hypot(a1Prime, b1);
  const c2Prime = Math.hypot(a2Prime, b2);
  const hue = (b: number, aPrime: number) => {
    if (b === 0 && aPrime === 0) return 0;
    const angle = degrees(Math.atan2(b, aPrime));
    return angle < 0 ? angle + 360 : angle;
  };
  const h1Prime = hue(b1, a1Prime);
  const h2Prime = hue(b2, a2Prime);

  const deltaL = l2 - l1;
  const deltaC = c2Prime - c1Prime;
  const chromaProduct = c1Prime * c2Prime;
  let deltaHue = 0;
  if (chromaProduct !== 0) {
    deltaHue = h2Prime - h1Prime;
    if (deltaHue > 180) deltaHue -= 360;
    else if (deltaHue < -180) deltaHue += 360;
  }
  const deltaH = 2 * Math.sqrt(chromaProduct) * Math.sin(radians(deltaHue) / 2);

  const meanL = (l1 + l2) / 2;
  const meanCPrime = (c1Prime + c2Prime) / 2;
  let meanHue = h1Prime + h2Prime;
  if (chromaProduct !== 0) {
    if (Math.abs(h1Prime - h2Prime) <= 180) meanHue /= 2;
    else meanHue = (meanHue + (meanHue < 360 ? 360 : -360)) / 2;
  }

  const t = 1
    - 0.17 * Math.cos(radians(meanHue - 30))
    + 0.24 * Math.cos(radians(2 * meanHue))
    + 0.32 * Math.cos(radians(3 * meanHue + 6))
    - 0.2 * Math.cos(radians(4 * meanHue - 63));
  const deltaTheta = 30 * Math.exp(-(((meanHue - 275) / 25) ** 2));
  const rotationChroma = 2 * Math.sqrt(meanCPrime ** 7 / (meanCPrime ** 7 + 25 ** 7));
  const sl = 1 + (0.015 * (meanL - 50) ** 2) / Math.sqrt(20 + (meanL - 50) ** 2);
  const sc = 1 + 0.045 * meanCPrime;
  const sh = 1 + 0.015 * meanCPrime * t;
  const rotation = -Math.sin(radians(2 * deltaTheta)) * rotationChroma;

  const lightness = deltaL / sl;
  const chroma = deltaC / sc;
  const hueTerm = deltaH / sh;
  return Math.sqrt(lightness ** 2 + chroma ** 2 + hueTerm ** 2 + rotation * chroma * hueTerm);
};

/** ΔE (CIEDE2000) between two hex colours, or null when either is not a hex colour. */
export const hexDeltaE = (first: string | null | undefined, second: string | null | undefined) => {
  const a = hexToLab(first);
  const b = hexToLab(second);
  return a && b ? deltaE2000(a, b) : null;
};

/** Linear sRGB mix like CSS color-mix: `amount` 0 keeps `from`, 1 becomes `to`. */
export const mixHex = (from: string, to: string, amount: number) => {
  const a = parseHex(from);
  const b = parseHex(to);
  if (!a || !b) return from;
  const t = Math.min(1, Math.max(0, amount));
  return rgbToHex(a.map((channel, index) => channel + (b[index] - channel) * t) as unknown as Rgb);
};
