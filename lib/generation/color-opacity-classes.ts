/**
 * Rewrites colour classes that ask Tailwind to fade a token colour, in the one spelling that renders.
 *
 * Screens render with the Tailwind Play CDN (v3), which cannot put an opacity on a colour held in a CSS variable.
 * Measured in Chromium against a red token:
 *   border-[var(--x)/50]   -> the text colour (white lines across a dark screen)
 *   border-[var(--x)]/50   -> Tailwind's default grey
 *   border-[color-mix(in_srgb,var(--x)_50%,transparent)] -> the token at 50%
 * so both broken spellings become the color-mix one. Only class attributes are touched.
 */

const COLOUR_UTILITY = "(?:bg|text|border(?:-[trblxyse])?|divide|ring(?:-offset)?|outline|fill|stroke|from|via|to|decoration|accent|caret|placeholder|shadow)";
const FADED_TOKEN = new RegExp(
  `^((?:[\\w-]+:)*)(${COLOUR_UTILITY})-\\[(?:color:)?(var\\(--[\\w-]+\\))(?:\\/(\\d{1,3})\\]|\\]\\/(\\d{1,3}))$`,
);
const CLASS_ATTRIBUTE = /((?<![\w-])class\s*=\s*)(?:"([^"]*)"|'([^']*)')/g;

export function repairTokenOpacityClasses(code: string): { code: string; repaired: number } {
  let repaired = 0;
  const next = code.replace(CLASS_ATTRIBUTE, (attribute, prefix: string, doubleQuoted?: string, singleQuoted?: string) => {
    const quote = doubleQuoted === undefined ? "'" : '"';
    const value = doubleQuoted ?? singleQuoted ?? "";
    let changed = false;
    const classes = value.split(/(\s+)/).map((part) => {
      const match = part.match(FADED_TOKEN);
      if (!match) return part;
      const percent = Number(match[4] ?? match[5]);
      if (!Number.isInteger(percent) || percent > 100) return part;
      changed = true;
      repaired += 1;
      return `${match[1]}${match[2]}-[color-mix(in_srgb,${match[3]}_${percent}%,transparent)]`;
    });
    return changed ? `${prefix}${quote}${classes.join("")}${quote}` : attribute;
  });
  return { code: next, repaired };
}
