import { colorPickerHex, isFunctionalCssColor } from "@/lib/css-color";
export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
export type RGB = { r: number; g: number; b: number };
export type HSV = { h: number; s: number; v: number };
export function colorRgb(value: string): RGB {
  const hsl = value.match(/^hsla?\(([^()]+)\)$/i);
  if (hsl) {
    const [h, s, l] = hsl[1].trim().split(/[\s,/]+/);
    const unit = h.endsWith("turn") ? 360 : h.endsWith("rad") ? 180 / Math.PI : h.endsWith("grad") ? .9 : 1;
    const hue = ((parseFloat(h) * unit) % 360 + 360) % 360, saturation = parseFloat(s) / 100, light = parseFloat(l) / 100;
    const v = light + saturation * Math.min(light, 1 - light);
    return hsvToRgb({ h: hue, s: v ? 2 * (1 - light / v) : 0, v });
  }
  let hex = colorPickerHex(value);
  if (!hex && typeof document !== "undefined" && /^[a-z]+$/i.test(value)) {
    const element = document.createElement("span"); element.style.backgroundColor = value;
    if (element.style.backgroundColor) {
      document.body.appendChild(element); hex = colorPickerHex(getComputedStyle(element).backgroundColor); element.remove();
    }
  }
  hex ??= "#000000";
  return { r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16) };
}
export function colorAlpha(value: string) {
  if (value === "transparent") return 0;
  if (/^#[\da-f]{8}$/i.test(value)) return parseInt(value.slice(7), 16) / 255;
  if (/^#[\da-f]{4}$/i.test(value)) return parseInt(value.slice(4).repeat(2), 16) / 255;
  const match = value.match(/^(?:rgba?|hsla?)\(([^()]+)\)$/i);
  const alpha = match?.[1].trim().split(/[\s,/]+/)[3];
  return alpha ? clamp(parseFloat(alpha) / (alpha.endsWith("%") ? 100 : 1), 0, 1) : 1;
}
export function colorValue(rgb: RGB, alpha = 1) {
  const channels = [rgb.r, rgb.g, rgb.b].map(value => Math.round(clamp(value, 0, 255)));
  return alpha < 1 ? `rgba(${channels.join(", ")}, ${Number(alpha.toFixed(2))})` : `#${channels.map(value => value.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}
export function rgbToHsv({ r, g, b }: RGB): HSV {
  r /= 255; g /= 255; b /= 255;
  const high = Math.max(r, g, b), low = Math.min(r, g, b), delta = high - low;
  const hue = !delta ? 0 : high === r ? ((g - b) / delta) % 6 : high === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  return { h: (hue * 60 + 360) % 360, s: high ? delta / high : 0, v: high };
}
export function hsvToRgb({ h, s, v }: HSV): RGB {
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  const channels = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return { r: (channels[0] + m) * 255, g: (channels[1] + m) * 255, b: (channels[2] + m) * 255 };
}
export const validColor = (value: string) => /^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(value) || isFunctionalCssColor(value) || /^(?:transparent|currentColor|[a-z]+)$/i.test(value) && typeof CSS !== "undefined" && CSS.supports("color", value);
