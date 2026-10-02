// Shared browser/server validation for the RGB and HSL values accepted by the editor.
export function isFunctionalCssColor(value: string): boolean {
  const match = value.match(/^(rgba?|hsla?)\(([^()]+)\)$/i);
  if (!match) return false;
  const parts = match[2].trim().split(/[\s,/]+/);
  if (parts.length < 3 || parts.length > 4) return false;
  const number = (part: string, maximum: number) => /^-?\d*\.?\d+%?$/.test(part) && Number.isFinite(parseFloat(part)) && parseFloat(part) >= 0 && parseFloat(part) <= (part.endsWith("%") ? 100 : maximum);
  if (parts[3] && !number(parts[3], 1)) return false;
  if (/^rgb/i.test(match[1])) return parts.slice(0, 3).every(part => number(part, 255));
  return /^-?\d*\.?\d+(?:deg|grad|rad|turn)?$/.test(parts[0]) && parts.slice(1, 3).every(part => part.endsWith("%") && number(part, 100));
}

// Native pickers accept opaque hex; retain the saved alpha until a color is chosen.
export function colorPickerHex(value: string): string | null {
  if (/^#[\da-f]{3,4}$/i.test(value)) return `#${value.slice(1, 4).split("").map(char => char + char).join("")}`;
  if (/^#[\da-f]{6}(?:[\da-f]{2})?$/i.test(value)) return value.slice(0, 7);
  const rgb = value.match(/^rgba?\(([^()]+)\)$/i);
  if (!rgb || !isFunctionalCssColor(value)) return null;
  const channels = rgb[1].trim().split(/[\s,/]+/).slice(0, 3);
  return `#${channels.map(channel => Math.round(parseFloat(channel) * (channel.endsWith("%") ? 2.55 : 1)).toString(16).padStart(2, "0")).join("")}`;
}
