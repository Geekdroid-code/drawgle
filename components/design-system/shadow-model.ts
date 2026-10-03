import { clamp, colorAlpha, colorRgb, colorValue } from "@/components/inspector/color-model";
export type ShadowParts = { x: number; y: number; blur: number; spread: number; color: string; opacity: number; enabled: boolean; inset?: boolean; supported?: boolean; rgb: number[] };
const base = { x: 0, y: 12, blur: 32, spread: 0, color: "#0F172A", opacity: .14, enabled: true, rgb: [15, 23, 42] };
export const SHADOW_PRESETS = [
  { label: "Soft", value: { ...base, y: 8, blur: 24, spread: -10, opacity: .12 } },
  { label: "Float", value: { ...base, y: 18, blur: 48, spread: -18, opacity: .18 } },
  { label: "Overlay", value: { ...base, y: -6, blur: 28, opacity: .16 } },
];
export function parseCssShadow(value: string): ShadowParts {
  if (!value.trim() || value.trim() === "none") return { ...base, enabled: false, opacity: 0, supported: true };
  const match = value.match(/(?:rgba?|hsla?)\([^)]*\)|#[\da-f]{3,8}\b/i);
  const remaining = value.replace(match?.[0] || "", "").replace(/\binset\b/, "").trim();
  const numbers = remaining.match(/-?\d*\.?\d+(?:px)?/g)?.map(parseFloat) || [];
  const rgb = colorRgb(match?.[0] || base.color);
  return { x: numbers[0] ?? base.x, y: numbers[1] ?? base.y, blur: numbers[2] ?? base.blur, spread: numbers[3] ?? 0,
    color: colorValue(rgb), opacity: match ? colorAlpha(match[0]) : base.opacity, rgb: [rgb.r, rgb.g, rgb.b],
    enabled: true, inset: /\binset\b/.test(value), supported: numbers.length >= 2 && numbers.length <= 4 && !remaining.includes(",") && !/[a-z]/i.test(remaining.replace(/px/g, "")) };
}
export function serializeCssShadow(parts: ShadowParts) {
  if (!parts.enabled || parts.opacity <= 0) return "none";
  return `${parts.inset ? "inset " : ""}${parts.x}px ${parts.y}px ${Math.max(0, parts.blur)}px ${parts.spread}px ${colorValue(colorRgb(parts.color), clamp(parts.opacity, 0, 1))}`;
}
