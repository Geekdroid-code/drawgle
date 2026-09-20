import type { DesignTokenValues } from "./types";

// Match complete color functions, not their numeric channels or stop positions.
const colorPattern = /#[\da-f]{8}\b|#[\da-f]{6}\b|#[\da-f]{4}\b|#[\da-f]{3}\b|(?:rgb|hsl)a?\([^)]*\)/gi;
const colors = (gradient?: string) => [...(gradient ?? "").matchAll(colorPattern)];

export function actionGradientStops(tokens: DesignTokenValues) {
  const stops = colors(tokens.gradients?.action_primary);
  return {
    start: stops[0]?.[0] ?? tokens.color?.action?.primary_gradient_start ?? tokens.color?.action?.primary,
    end: stops.at(-1)?.[0] ?? tokens.color?.action?.primary_gradient_end ?? tokens.color?.action?.primary,
  };
}

function rgb(color: string) {
  const value = /^#[\da-f]{3,4}$/i.test(color) ? `#${[...color.slice(1)].map(c => c + c).join("")}` : color;
  if (/^#[\da-f]{6}([\da-f]{2})?$/i.test(value)) return [1, 3, 5].map(i => parseInt(value.slice(i, i + 2), 16));
  const match = color.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
  return match ? match.slice(1, 4).map(Number) : null;
}

// Preserve the light/dark treatment of an action gradient when changing its hue.
function retint(stop: string, base: string, next: string) {
  const channels = rgb(stop), origin = rgb(base), target = rgb(next);
  if (!target) return next;
  const brightness = (values: number[]) => values.reduce((sum, c) => sum + c, 0);
  const ratio = channels && origin ? brightness(channels) / Math.max(1, brightness(origin)) : 1;
  const tinted = target.map(c => Math.round(Math.min(255, c * ratio)));
  const alpha = stop.match(/(?:rgba|hsla)\([^)]*,\s*([\d.]+%?)\s*\)$/i)?.[1]
    ?? stop.match(/\/\s*([\d.]+%?)\s*\)$/)?.[1];
  if (alpha) return `rgba(${tinted.join(", ")}, ${alpha})`;
  const hexAlpha = /^#[\da-f]{8}$/i.test(stop) ? stop.slice(-2)
    : /^#[\da-f]{4}$/i.test(stop) ? stop.slice(-1).repeat(2) : "";
  return `#${tinted.map(c => c.toString(16).padStart(2, "0")).join("")}${hexAlpha}`;
}

/** Mutates the editor's draft only; normalization never recolors untouched sources. */
export function updateActionGradient(tokens: DesignTokenValues, key: string, value: string) {
  if (!["primary", "primary_gradient_start", "primary_gradient_end"].includes(key)) return;
  const gradient = tokens.gradients?.action_primary;
  const stops = colors(gradient);
  let next = gradient;
  if (stops.length >= 2 && gradient) {
    let index = 0;
    next = gradient.replace(colorPattern, color => {
      const current = index++;
      if (key === "primary") return retint(color, stops[0][0], value);
      return current === (key === "primary_gradient_start" ? 0 : stops.length - 1) ? value : color;
    });
  } else {
    const previous = actionGradientStops(tokens);
    const start = key === "primary_gradient_end" ? previous.start ?? value : value;
    const end = key === "primary_gradient_start" ? previous.end ?? value : value;
    next = `linear-gradient(135deg, ${start} 0%, ${end} 100%)`;
  }
  tokens.gradients = { ...tokens.gradients, action_primary: next };
  const updated = actionGradientStops(tokens);
  tokens.color = { ...tokens.color, action: { ...tokens.color?.action,
    primary_gradient_start: updated.start, primary_gradient_end: updated.end } };
}
