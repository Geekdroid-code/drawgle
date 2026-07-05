export type ScreenStyleMemoryInput = {
  id?: string | null;
  name: string;
  code?: string | null;
  summary?: string | null;
};

const CLASS_ATTRIBUTE_REGEX = /\bclass=(["'])([\s\S]*?)\1/g;
const STYLE_ATTRIBUTE_REGEX = /\bstyle=(["'])([\s\S]*?)\1/g;
const DRAWGLE_UTILITY_REGEX = /\bdg-[a-z0-9-]+\b/g;
const DRAWGLE_VAR_REGEX = /var\(--dg-[a-z0-9-]+(?:,[^)]+)?\)/g;
const RAW_COLOR_REGEX = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]+\)/gi;

const compact = (value: string | null | undefined, limit: number) => {
  const text = value?.replace(/\s+/g, " ").trim();
  if (!text) {
    return null;
  }

  return text.length > limit ? `${text.slice(0, limit - 3).trimEnd()}...` : text;
};

const uniqLimit = (values: string[], limit: number) => {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    output.push(normalized);

    if (output.length >= limit) {
      break;
    }
  }

  return output;
};

const extractClassValues = (code: string) => {
  const values: string[] = [];
  for (const match of code.matchAll(CLASS_ATTRIBUTE_REGEX)) {
    if (match[2]) {
      values.push(match[2]);
    }
  }
  return values;
};

const extractStyleValues = (code: string) => {
  const values: string[] = [];
  for (const match of code.matchAll(STYLE_ATTRIBUTE_REGEX)) {
    if (match[2]) {
      values.push(match[2]);
    }
  }
  return values;
};

const rootClass = (classValues: string[]) => compact(classValues[0], 220);

const materialClasses = (classValues: string[]) => uniqLimit(
  classValues
    .flatMap((value) => value.split(/\s+/))
    .filter((className) =>
      /^(?:dg-|bg-|text-|border|ring|shadow|rounded|p[trblxy]?|m[trblxy]?|gap|space-|grid|flex|items-|justify-|backdrop|overflow-|min-|max-|w-|h-)/.test(className),
    ),
  28,
);

export function extractScreenStyleMemory(screen: ScreenStyleMemoryInput) {
  const code = screen.code?.trim();
  if (!code) {
    return null;
  }

  const classValues = extractClassValues(code);
  const styleValues = extractStyleValues(code);
  const utilityTokens = uniqLimit(code.match(DRAWGLE_UTILITY_REGEX) ?? [], 24);
  const cssVars = uniqLimit(code.match(DRAWGLE_VAR_REGEX) ?? [], 24);
  const rawColors = uniqLimit(
    [
      ...(code.match(RAW_COLOR_REGEX) ?? []),
      ...styleValues.flatMap((value) => value.match(RAW_COLOR_REGEX) ?? []),
    ],
    8,
  );
  const materials = materialClasses(classValues);

  const lines = [
    `Screen: ${screen.name}`,
    screen.summary ? `Summary: ${compact(screen.summary, 240)}` : null,
    rootClass(classValues) ? `Root/classes: ${rootClass(classValues)}` : null,
    utilityTokens.length ? `Token utilities: ${utilityTokens.join(", ")}` : null,
    cssVars.length ? `CSS vars: ${cssVars.join(", ")}` : null,
    materials.length ? `Material/layout classes: ${materials.join(", ")}` : null,
    rawColors.length ? `Raw color evidence to map back to tokens when systemic: ${rawColors.join(", ")}` : null,
  ].filter(Boolean);

  return lines.length > 1 ? lines.join("\n") : null;
}

export function formatCanonicalVisualSystem(screens: ScreenStyleMemoryInput[]) {
  const memories = screens
    .map(extractScreenStyleMemory)
    .filter((memory): memory is string => Boolean(memory));

  if (memories.length === 0) {
    return null;
  }

  return [
    "CANONICAL VISUAL SYSTEM FROM EXISTING SCREENS",
    "Use this as style continuity evidence only: reuse the visual system, token roles, material language, and nav/chrome feel; do not copy content or layout.",
    ...memories.slice(0, 5).map((memory, index) => `${index + 1}. ${memory}`),
  ].join("\n\n");
}
