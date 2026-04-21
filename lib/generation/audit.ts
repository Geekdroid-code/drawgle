import { normalizeDesignTokens } from "@/lib/design-tokens";
import { createNavigationArchitecture, resolveScreenChromePolicy } from "@/lib/navigation";
import type { DesignTokens, NavigationArchitecture, ScreenPlan } from "@/lib/types";

export type CodeAuditRule = "colors" | "radii" | "borders" | "shadows" | "typography" | "navigation";

export type CodeAuditSeverity = "error" | "warning";

export interface CodeAuditFinding {
  severity: CodeAuditSeverity;
  rule: CodeAuditRule;
  message: string;
  samples?: string[];
}

export interface CodeAuditResult {
  compliant: boolean;
  findings: CodeAuditFinding[];
}

const CLASS_ATTRIBUTE_REGEX = /\bclass(?:Name)?=(['"`])([\s\S]*?)\1/g;
const STYLE_ATTRIBUTE_REGEX = /\bstyle=(['"])([\s\S]*?)\1/g;
const HEX_REGEX = /#[0-9a-fA-F]{3,8}\b/g;
const PALETTE_UTILITY_REGEX = /^(?:bg|text|border|from|to|via|stroke|fill)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(?:[-/].*)?$/;
const SHADOW_UTILITY_REGEX = /^shadow(?:-(?:sm|md|lg|xl|2xl|inner))?$/;
const TEXT_SIZE_UTILITY_REGEX = /^text-(?:xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)$/;
const FONT_WEIGHT_UTILITY_REGEX = /^font-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/;
const ARBITRARY_RADIUS_REGEX = /\brounded(?:-[a-z]+)?-\[([^\]]+)\]/g;
const ARBITRARY_SHADOW_REGEX = /\bshadow-\[([^\]]+)\]/g;
const ARBITRARY_BORDER_WIDTH_REGEX = /\bborder(?:-[trblxy]{1,2})?-\[([^\]]+)\]/g;
const BORDER_WIDTH_UTILITY_REGEX = /\bborder(?:-[trblxy]{1,2})?-(0|2|4|8)\b/g;
const ARBITRARY_TEXT_SIZE_REGEX = /\btext-\[([^\]]+)\]/g;
const ARBITRARY_FONT_WEIGHT_REGEX = /\bfont-\[([^\]]+)\]/g;

const unique = (values: string[]) => {
  const seen = new Set<string>();
  const next: string[] = [];

  for (const value of values) {
    const normalized = value.trim();
    if (!normalized) {
      continue;
    }

    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    next.push(normalized);
  }

  return next;
};

const normalizeCssLiteral = (value: string) =>
  value
    .replaceAll("_", " ")
    .replaceAll(", ", ",")
    .replaceAll(",", ", ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const extractClassTokens = (code: string) => {
  const tokens: string[] = [];

  for (const match of code.matchAll(CLASS_ATTRIBUTE_REGEX)) {
    tokens.push(...match[2].split(/\s+/).filter(Boolean));
  }

  return unique(tokens);
};

const extractStyleValues = (code: string) => {
  const styles: string[] = [];

  for (const match of code.matchAll(STYLE_ATTRIBUTE_REGEX)) {
    styles.push(match[2]);
  }

  return styles;
};

const collectMatches = (input: string, pattern: RegExp) => [...input.matchAll(pattern)].map((match) => match[1] ?? match[0]);

const collectColorTokens = (designTokens?: DesignTokens | null) => {
  const normalized = normalizeDesignTokens(designTokens);
  const values = new Set<string>();

  const walk = (value: unknown) => {
    if (typeof value === "string") {
      if (HEX_REGEX.test(value)) {
        HEX_REGEX.lastIndex = 0;
        for (const match of value.match(HEX_REGEX) ?? []) {
          values.add(match.toLowerCase());
        }
      }

      return;
    }

    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }

    if (value && typeof value === "object") {
      Object.values(value).forEach(walk);
    }
  };

  walk(normalized?.tokens?.color ?? null);
  return values;
};

const collectAllowedTypographyValues = (designTokens?: DesignTokens | null) => {
  const normalized = normalizeDesignTokens(designTokens);
  const sizes = new Set<string>();
  const weights = new Set<string>();

  Object.values(normalized?.tokens?.typography ?? {}).forEach((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return;
    }

    const scale = value as { size?: string; weight?: string | number };
    if (typeof scale.size === "string") {
      sizes.add(normalizeCssLiteral(scale.size));
    }

    if (typeof scale.weight === "string" || typeof scale.weight === "number") {
      weights.add(String(scale.weight).trim().toLowerCase());
    }
  });

  return { sizes, weights };
};

const buildAllowedValues = (designTokens?: DesignTokens | null) => {
  const normalized = normalizeDesignTokens(designTokens);
  const typography = collectAllowedTypographyValues(normalized);

  return {
    colors: collectColorTokens(normalized),
    radii: new Set<string>([
      normalizeCssLiteral(normalized?.tokens?.radii?.app ?? "18px"),
      normalizeCssLiteral(normalized?.tokens?.radii?.pill ?? "9999px"),
      normalizeCssLiteral("full"),
    ]),
    borders: new Set<string>([
      normalizeCssLiteral(normalized?.tokens?.border_widths?.standard ?? "1px"),
      normalizeCssLiteral("0"),
    ]),
    shadows: new Set<string>([
      normalizeCssLiteral(normalized?.tokens?.shadows?.none ?? "none"),
      normalizeCssLiteral(normalized?.tokens?.shadows?.surface ?? "0 12px 32px rgba(15,23,42,0.14)"),
      normalizeCssLiteral(normalized?.tokens?.shadows?.overlay ?? "0 -4px 24px rgba(15,23,42,0.18)"),
      normalizeCssLiteral("none"),
    ]),
    typography,
  };
};

const pushFinding = (bucket: CodeAuditFinding[], finding: CodeAuditFinding) => {
  const nextFinding = {
    ...finding,
    samples: finding.samples ? unique(finding.samples).slice(0, 5) : undefined,
  };
  const key = `${nextFinding.severity}:${nextFinding.rule}:${nextFinding.message}:${(nextFinding.samples ?? []).join("|")}`;
  const hasMatch = bucket.some((existing) => `${existing.severity}:${existing.rule}:${existing.message}:${(existing.samples ?? []).join("|")}` === key);

  if (!hasMatch) {
    bucket.push(nextFinding);
  }
};

const auditColors = ({
  code,
  classTokens,
  allowedColors,
  findings,
}: {
  code: string;
  classTokens: string[];
  allowedColors: Set<string>;
  findings: CodeAuditFinding[];
}) => {
  const paletteUtilities = classTokens.filter((token) => PALETTE_UTILITY_REGEX.test(token));
  if (paletteUtilities.length > 0) {
    pushFinding(findings, {
      severity: "error",
      rule: "colors",
      message: "Hardcoded Tailwind palette utilities detected; use approved design token colors instead.",
      samples: paletteUtilities,
    });
  }

  const hardcodedHexes = unique(code.match(HEX_REGEX) ?? []).filter((value) => !allowedColors.has(value.toLowerCase()));
  if (hardcodedHexes.length > 0) {
    pushFinding(findings, {
      severity: "error",
      rule: "colors",
      message: "Off-contract hex colors detected.",
      samples: hardcodedHexes,
    });
  }
};

const auditRadii = ({
  classTokens,
  styleValues,
  allowedRadii,
  findings,
}: {
  classTokens: string[];
  styleValues: string[];
  allowedRadii: Set<string>;
  findings: CodeAuditFinding[];
}) => {
  const arbitraryRadii = unique(classTokens.flatMap((token) => collectMatches(token, ARBITRARY_RADIUS_REGEX)).map(normalizeCssLiteral));
  const styleRadii = unique(styleValues.flatMap((style) => Array.from(style.matchAll(/border-radius\s*:\s*([^;]+)/gi)).map((match) => normalizeCssLiteral(match[1]))));
  const offContract = [...arbitraryRadii, ...styleRadii].filter((value) => !allowedRadii.has(value));

  if (offContract.length > 0) {
    pushFinding(findings, {
      severity: "error",
      rule: "radii",
      message: "Off-contract radius values detected.",
      samples: offContract,
    });
  }
};

const auditBorders = ({
  classTokens,
  styleValues,
  allowedBorders,
  findings,
}: {
  classTokens: string[];
  styleValues: string[];
  allowedBorders: Set<string>;
  findings: CodeAuditFinding[];
}) => {
  const arbitraryBorderWidths = unique(
    classTokens
      .flatMap((token) => collectMatches(token, ARBITRARY_BORDER_WIDTH_REGEX))
      .map(normalizeCssLiteral)
      .filter((value) => /^(?:\d+(?:\.\d+)?(?:px|rem)|0)$/.test(value)),
  );
  const utilityBorderWidths = unique(classTokens.flatMap((token) => collectMatches(token, BORDER_WIDTH_UTILITY_REGEX)).map((value) => `${value}px`));
  const styleBorderWidths = unique(styleValues.flatMap((style) => Array.from(style.matchAll(/border(?:-[a-z]+)?-width\s*:\s*([^;]+)/gi)).map((match) => normalizeCssLiteral(match[1]))));
  const offContract = [...arbitraryBorderWidths, ...utilityBorderWidths, ...styleBorderWidths].filter((value) => !allowedBorders.has(normalizeCssLiteral(value)));

  if (offContract.length > 0) {
    pushFinding(findings, {
      severity: "error",
      rule: "borders",
      message: "Off-contract border widths detected.",
      samples: offContract,
    });
  }
};

const auditShadows = ({
  classTokens,
  styleValues,
  allowedShadows,
  findings,
}: {
  classTokens: string[];
  styleValues: string[];
  allowedShadows: Set<string>;
  findings: CodeAuditFinding[];
}) => {
  const utilityShadows = classTokens.filter((token) => SHADOW_UTILITY_REGEX.test(token) && !token.startsWith("shadow-["));
  if (utilityShadows.length > 0) {
    pushFinding(findings, {
      severity: "error",
      rule: "shadows",
      message: "Tailwind shadow utilities detected; use approved shadow recipes instead.",
      samples: utilityShadows,
    });
  }

  const arbitraryShadows = unique(classTokens.flatMap((token) => collectMatches(token, ARBITRARY_SHADOW_REGEX)).map(normalizeCssLiteral));
  const styleShadows = unique(styleValues.flatMap((style) => Array.from(style.matchAll(/box-shadow\s*:\s*([^;]+)/gi)).map((match) => normalizeCssLiteral(match[1]))));
  const offContract = [...arbitraryShadows, ...styleShadows].filter((value) => !allowedShadows.has(value));

  if (offContract.length > 0) {
    pushFinding(findings, {
      severity: "error",
      rule: "shadows",
      message: "Off-contract shadow values detected.",
      samples: offContract,
    });
  }
};

const auditTypography = ({
  classTokens,
  allowedSizes,
  allowedWeights,
  findings,
}: {
  classTokens: string[];
  allowedSizes: Set<string>;
  allowedWeights: Set<string>;
  findings: CodeAuditFinding[];
}) => {
  const utilitySizes = classTokens.filter((token) => TEXT_SIZE_UTILITY_REGEX.test(token));
  if (utilitySizes.length > 0) {
    pushFinding(findings, {
      severity: "error",
      rule: "typography",
      message: "Tailwind text-size utilities detected; use approved typography token sizes instead.",
      samples: utilitySizes,
    });
  }

  const utilityWeights = classTokens.filter((token) => FONT_WEIGHT_UTILITY_REGEX.test(token));
  if (utilityWeights.length > 0) {
    pushFinding(findings, {
      severity: "error",
      rule: "typography",
      message: "Tailwind font-weight utilities detected; use approved typography token weights instead.",
      samples: utilityWeights,
    });
  }

  const arbitrarySizes = unique(
    classTokens
      .flatMap((token) => collectMatches(token, ARBITRARY_TEXT_SIZE_REGEX))
      .map(normalizeCssLiteral)
      .filter((value) => /^(?:\d+(?:\.\d+)?(?:px|rem)|0)$/.test(value)),
  );
  const arbitraryWeights = unique(
    classTokens
      .flatMap((token) => collectMatches(token, ARBITRARY_FONT_WEIGHT_REGEX))
      .map((value) => value.trim().toLowerCase())
      .filter((value) => /^\d+$/.test(value)),
  );

  const offContractSizes = arbitrarySizes.filter((value) => !allowedSizes.has(value));
  const offContractWeights = arbitraryWeights.filter((value) => !allowedWeights.has(value));

  if (offContractSizes.length > 0) {
    pushFinding(findings, {
      severity: "error",
      rule: "typography",
      message: "Off-contract typography sizes detected.",
      samples: offContractSizes,
    });
  }

  if (offContractWeights.length > 0) {
    pushFinding(findings, {
      severity: "error",
      rule: "typography",
      message: "Off-contract typography weights detected.",
      samples: offContractWeights,
    });
  }
};

const auditNavigation = ({
  code,
  navigationArchitecture,
  screenPlan,
  findings,
}: {
  code: string;
  navigationArchitecture?: NavigationArchitecture | null;
  screenPlan?: ScreenPlan | null;
  findings: CodeAuditFinding[];
}) => {
  const normalizedArchitecture = createNavigationArchitecture({ navigationArchitecture });
  const hasBottomAnchoredPrimaryNav = /(?:<nav\b[\s\S]{0,600}bottom-0)|(?:bottom-0[\s\S]{0,300}<nav\b)|(?:bottom-0[\s\S]{0,200}(?:Home|Search|Explore|Profile|Orders|Cart))/i.test(code);
  const hasBackAffordance = /(data-lucide="arrow-left"|data-lucide='arrow-left'|aria-label="Back"|aria-label='Back'|>\s*Back\s*<|chevron-left|arrow-left|←)/i.test(code);

  if (!screenPlan) {
    if (normalizedArchitecture.primaryNavigation === "none" && hasBottomAnchoredPrimaryNav) {
      pushFinding(findings, {
        severity: "error",
        rule: "navigation",
        message: "A primary bottom-tab shell was introduced in a project that should not have one.",
      });
    }

    return;
  }

  const chromePolicy = resolveScreenChromePolicy({ screenPlan, navigationArchitecture: normalizedArchitecture });

  if (!chromePolicy.showPrimaryNavigation && hasBottomAnchoredPrimaryNav) {
    pushFinding(findings, {
      severity: "error",
      rule: "navigation",
      message: "A detail or non-shell screen introduced the primary bottom-tab navigation.",
    });
  }

  if (chromePolicy.showPrimaryNavigation && !hasBottomAnchoredPrimaryNav) {
    pushFinding(findings, {
      severity: "warning",
      rule: "navigation",
      message: "This screen is expected to carry the primary navigation shell, but no bottom-anchored nav was detected.",
    });
  }

  if (chromePolicy.showsBackButton && !hasBackAffordance) {
    pushFinding(findings, {
      severity: "warning",
      rule: "navigation",
      message: "This screen is expected to expose a back affordance, but none was detected.",
    });
  }
};

export function auditScreenCode({
  code,
  designTokens,
  navigationArchitecture,
  screenPlan,
}: {
  code: string;
  designTokens?: DesignTokens | null;
  navigationArchitecture?: NavigationArchitecture | null;
  screenPlan?: ScreenPlan | null;
}): CodeAuditResult {
  const classTokens = extractClassTokens(code);
  const styleValues = extractStyleValues(code);
  const allowedValues = buildAllowedValues(designTokens);
  const findings: CodeAuditFinding[] = [];

  auditColors({
    code,
    classTokens,
    allowedColors: allowedValues.colors,
    findings,
  });
  auditRadii({
    classTokens,
    styleValues,
    allowedRadii: allowedValues.radii,
    findings,
  });
  auditBorders({
    classTokens,
    styleValues,
    allowedBorders: allowedValues.borders,
    findings,
  });
  auditShadows({
    classTokens,
    styleValues,
    allowedShadows: allowedValues.shadows,
    findings,
  });
  auditTypography({
    classTokens,
    allowedSizes: allowedValues.typography.sizes,
    allowedWeights: allowedValues.typography.weights,
    findings,
  });
  auditNavigation({
    code,
    navigationArchitecture,
    screenPlan,
    findings,
  });

  return {
    compliant: findings.every((finding) => finding.severity !== "error"),
    findings,
  };
}

const serializeFinding = (finding: CodeAuditFinding) =>
  `${finding.severity}:${finding.rule}:${finding.message}:${(finding.samples ?? []).join("|")}`;

export function diffAuditFindings(previous: CodeAuditResult, next: CodeAuditResult) {
  const previousKeys = new Set(previous.findings.map(serializeFinding));
  return next.findings.filter((finding) => !previousKeys.has(serializeFinding(finding)));
}

export function formatAuditFailureMessage(
  findings: CodeAuditFinding[] | CodeAuditResult,
  prefix = "Generated code rejected by design audit.",
) {
  const nextFindings = Array.isArray(findings) ? findings : findings.findings;
  const relevant = nextFindings.filter((finding) => finding.severity === "error");
  if (relevant.length === 0) {
    return prefix;
  }

  const details = relevant
    .slice(0, 3)
    .map((finding) => `${finding.message}${finding.samples?.length ? ` (${finding.samples.join(", ")})` : ""}`)
    .join(" ");

  return `${prefix} ${details}`.trim();
}