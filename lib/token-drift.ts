export type TokenDriftSeverity = "warning" | "severe";

export type TokenDriftIssue = {
  code:
    | "generic_tailwind_palette"
    | "raw_arbitrary_color"
    | "raw_style_color"
    | "raw_radius"
    | "raw_spacing";
  value: string;
  context: string;
  severity: TokenDriftSeverity;
};

export type TokenDriftResult = {
  issues: TokenDriftIssue[];
  severeIssues: TokenDriftIssue[];
  warnings: string[];
  hasSevereDrift: boolean;
};

type DetectTokenDriftOptions = {
  scope?: "screen" | "navigation";
};

const SYSTEM_PALETTES = [
  "white",
  "black",
  "gray",
  "slate",
  "zinc",
  "neutral",
  "stone",
  "red",
  "orange",
  "amber",
  "yellow",
  "lime",
  "green",
  "emerald",
  "teal",
  "cyan",
  "sky",
  "blue",
  "indigo",
  "violet",
  "purple",
  "fuchsia",
  "pink",
  "rose",
];

const CLASS_ATTRIBUTE_REGEX = /\bclass=(["'])([\s\S]*?)\1/g;
const STYLE_ATTRIBUTE_REGEX = /\bstyle=(["'])([\s\S]*?)\1/g;
const STYLE_BLOCK_REGEX = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
const SVG_BLOCK_REGEX = /<svg\b[\s\S]*?<\/svg>/gi;
const TOKEN_REFERENCE_REGEX = /(?:var\(--dg-|dg-)/;
const HEX_COLOR_REGEX = /#[0-9a-fA-F]{3,8}\b/g;
const RGB_COLOR_REGEX = /rgba?\([^)]+\)/gi;
const RAW_COLOR_DECLARATION_REGEX =
  /\b(?:color|background(?:-color)?|border(?:-(?:color|top-color|right-color|bottom-color|left-color))?|box-shadow|text-shadow|fill|stroke)\s*:\s*(#[0-9a-fA-F]{3,8}\b|rgba?\([^)]+\))/gi;

const paletteClassRegex = new RegExp(
  `^(?:bg|text|border|ring|from|via|to|fill|stroke)-(?:${SYSTEM_PALETTES.join("|")})(?:-\\d{2,3})?(?:\\/\\d+)?$`,
);

const rawArbitraryColorRegex = /^(?:bg|text|border|ring|from|via|to|fill|stroke)-\[(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))\]$/i;
const rawRadiusRegex = /^rounded(?:-[trblxyse]{1,2})?-\[(?!var\()[^\]]*(?:px|rem|%)\]$/i;
const rawSpacingRegex =
  /^(?:p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap|gap-x|gap-y|space-x|space-y|inset|inset-x|inset-y|top|right|bottom|left|w|h|min-w|min-h|max-w|max-h)-\[(?!var\()[^\]]*(?:px|rem|%)\]$/i;

const compact = (value: string, limit = 120) => {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > limit ? `${text.slice(0, limit - 3)}...` : text;
};

const stripAllowedArtBlocks = (code: string) =>
  code.replace(SVG_BLOCK_REGEX, (block) =>
    block.includes("data-drawgle-primary-nav") ? block : " ",
  );

const isTokenFallbackColor = (value: string, index: number) => {
  const before = value.slice(Math.max(0, index - 120), index);
  return /var\(--dg-[^;{}]*$/i.test(before);
};
const addIssue = (issues: TokenDriftIssue[], issue: TokenDriftIssue) => {
  if (issues.some((existing) => existing.code === issue.code && existing.value === issue.value && existing.context === issue.context)) {
    return;
  }

  issues.push(issue);
};

const issueWarning = (issue: TokenDriftIssue) => `${issue.code}: ${issue.value} in ${issue.context}`;

export function detectTokenDrift(code: string, options: DetectTokenDriftOptions = {}): TokenDriftResult {
  const source = stripAllowedArtBlocks(code);
  const issues: TokenDriftIssue[] = [];

  for (const match of source.matchAll(CLASS_ATTRIBUTE_REGEX)) {
    const classValue = match[2] ?? "";
    const context = compact(classValue);
    const classes = classValue.split(/\s+/).filter(Boolean);

    for (const className of classes) {
      if (TOKEN_REFERENCE_REGEX.test(className)) {
        continue;
      }

      if (paletteClassRegex.test(className)) {
        addIssue(issues, {
          code: "generic_tailwind_palette",
          value: className,
          context,
          severity: "severe",
        });
        continue;
      }

      const rawColor = className.match(rawArbitraryColorRegex);
      if (rawColor) {
        addIssue(issues, {
          code: "raw_arbitrary_color",
          value: rawColor[1],
          context,
          severity: "severe",
        });
        continue;
      }

      if (rawRadiusRegex.test(className)) {
        addIssue(issues, {
          code: "raw_radius",
          value: className,
          context,
          severity: options.scope === "navigation" ? "severe" : "warning",
        });
        continue;
      }

      if (rawSpacingRegex.test(className)) {
        addIssue(issues, {
          code: "raw_spacing",
          value: className,
          context,
          severity: "warning",
        });
      }
    }
  }

  for (const match of source.matchAll(STYLE_ATTRIBUTE_REGEX)) {
    const styleValue = match[2] ?? '';

    for (const declaration of styleValue.matchAll(RAW_COLOR_DECLARATION_REGEX)) {
      const colorIndex = (declaration.index ?? 0) + declaration[0].indexOf(declaration[1]);
      if (isTokenFallbackColor(styleValue, colorIndex)) {
        continue;
      }

      addIssue(issues, {
        code: 'raw_style_color',
        value: declaration[1],
        context: compact(styleValue),
        severity: 'severe',
      });
    }

    const rawColors = styleValue.matchAll(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]+\)/gi);
    for (const color of rawColors) {
      if (isTokenFallbackColor(styleValue, color.index ?? 0)) {
        continue;
      }

      addIssue(issues, {
        code: 'raw_style_color',
        value: color[0],
        context: compact(styleValue),
        severity: 'severe',
      });
    }
  }

  for (const match of source.matchAll(STYLE_BLOCK_REGEX)) {
    const css = match[1] ?? '';
    const rawColors = css.matchAll(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]+\)/gi);
    for (const color of rawColors) {
      if (isTokenFallbackColor(css, color.index ?? 0)) {
        continue;
      }

      addIssue(issues, {
        code: 'raw_style_color',
        value: color[0],
        context: compact(css),
        severity: 'severe',
      });
    }
  }
  const severeIssues = issues.filter((issue) => issue.severity === "severe");

  return {
    issues,
    severeIssues,
    warnings: issues.map(issueWarning),
    hasSevereDrift: severeIssues.length > 0,
  };
}
