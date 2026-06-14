import { normalizeDesignTokens } from "@/lib/design-tokens";
import type {
  DesignTokens,
  DesignTokenValues,
  DesignTypographyScale,
  ProjectData,
  ProjectNavigationData,
} from "@/lib/types";

type PublicPrimitive = string | Record<string, string | Record<string, string>>;
type PublicTokenFrontmatter = Record<string, PublicPrimitive>;

const PRIVATE_EXPORT_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bhigh_emphasis\b/gi, "text"],
  [/\bmedium_emphasis\b/gi, "muted text"],
  [/\blow_emphasis\b/gi, "subtle text"],
  [/\bsurface_elevated\b/gi, "raised surface"],
  [/\bon_primary_text\b/gi, "primary foreground"],
  [/\bsystem_schema\b/gi, "design profile"],
  [/\bprojectCharter\b/g, "design brief"],
  [/\bnavigationArchitecture\b/g, "navigation model"],
  [/\bplanningDiagnostics\b/g, "planning notes"],
  [/\bcharterSource\b/g, "source"],
  [/\boriginalPrompt\b/g, "source brief"],
  [/\bupdatedAt\b/g, "updated"],
  [/\bscreenChrome\b/g, "screen treatment"],
  [/\bdg-[a-z0-9-]+\b/gi, "design utility"],
];

const sanitizePublicText = (value?: string | null) => {
  if (!value?.trim()) {
    return null;
  }

  return PRIVATE_EXPORT_REPLACEMENTS.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    value.trim(),
  );
};

const toPublicString = (value: unknown) => {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
};

const compactRecord = (entries: Array<[string, unknown]>): Record<string, string> => {
  const record: Record<string, string> = {};

  for (const [key, value] of entries) {
    const nextValue = toPublicString(value);
    if (nextValue) {
      record[key] = nextValue;
    }
  }

  return record;
};

const buildPublicTypographyStyle = (
  style: DesignTypographyScale | undefined,
  fontFamily?: string,
): Record<string, string> => compactRecord([
  ["fontFamily", fontFamily],
  ["fontSize", style?.size],
  ["fontWeight", style?.weight],
  ["lineHeight", style?.line_height],
]);

const isNonEmptyRecord = (value: Record<string, unknown>) => Object.keys(value).length > 0;

const buildPublicDesignTokens = (designTokens?: DesignTokens | null): PublicTokenFrontmatter => {
  const tokens: DesignTokenValues | undefined = normalizeDesignTokens(designTokens ?? {}).tokens;
  const color = tokens?.color;
  const typography = tokens?.typography;
  const spacing = tokens?.spacing;
  const mobileLayout = tokens?.mobile_layout;
  const radii = tokens?.radii;
  const shadows = tokens?.shadows;
  const fontFamily = toPublicString(typography?.font_family) ?? "System UI";
  const frontmatter: PublicTokenFrontmatter = {};

  const colors = compactRecord([
    ["background", color?.background?.primary],
    ["background-muted", color?.background?.secondary],
    ["surface", color?.surface?.card],
    ["surface-panel", color?.surface?.modal ?? color?.surface?.bottom_sheet],
    ["text", color?.text?.high_emphasis],
    ["text-muted", color?.text?.medium_emphasis],
    ["text-subtle", color?.text?.low_emphasis],
    ["primary", color?.action?.primary],
    ["primary-foreground", color?.action?.on_primary_text],
    ["secondary", color?.action?.secondary],
    ["border", color?.border?.divider],
    ["focus-ring", color?.border?.focused],
    ["disabled", color?.action?.disabled],
  ]);

  if (isNonEmptyRecord(colors)) {
    frontmatter.colors = colors;
  }

  const typographyStyles = {
    "display-lg": buildPublicTypographyStyle(typography?.hero_title, fontFamily),
    "headline-md": buildPublicTypographyStyle(typography?.screen_title, fontFamily),
    "headline-sm": buildPublicTypographyStyle(typography?.section_title, fontFamily),
    "metric-lg": buildPublicTypographyStyle(typography?.metric_value, fontFamily),
    "body-md": buildPublicTypographyStyle(typography?.body, fontFamily),
    "body-sm": buildPublicTypographyStyle(typography?.supporting, fontFamily),
    "label-md": buildPublicTypographyStyle(typography?.button_label, fontFamily),
    "label-sm": buildPublicTypographyStyle(typography?.caption, fontFamily),
  };
  const publicTypography = Object.fromEntries(
    Object.entries(typographyStyles).filter(([, value]) => isNonEmptyRecord(value)),
  ) as Record<string, Record<string, string>>;

  if (isNonEmptyRecord(publicTypography)) {
    frontmatter.typography = publicTypography;
  }

  const rounded = compactRecord([
    ["sm", "8px"],
    ["md", "12px"],
    ["lg", radii?.app],
    ["full", radii?.pill],
  ]);

  if (isNonEmptyRecord(rounded)) {
    frontmatter.rounded = rounded;
  }

  const publicSpacing = compactRecord([
    ["base", spacing?.xxs],
    ["xs", spacing?.xs],
    ["sm", spacing?.sm],
    ["md", spacing?.md],
    ["lg", spacing?.lg],
    ["xl", spacing?.xl],
    ["screen-padding", mobileLayout?.screen_margin],
    ["section-gap", mobileLayout?.section_gap],
    ["element-gap", mobileLayout?.element_gap],
  ]);

  if (isNonEmptyRecord(publicSpacing)) {
    frontmatter.spacing = publicSpacing;
  }

  const publicShadows = compactRecord([
    ["none", shadows?.none],
    ["surface", shadows?.surface],
    ["overlay", shadows?.overlay],
  ]);

  if (isNonEmptyRecord(publicShadows)) {
    frontmatter.shadows = publicShadows;
  }

  return frontmatter;
};

const yamlScalar = (value: string) => `'${value.replace(/'/g, "''")}'`;

const formatYamlRecord = (
  record: PublicTokenFrontmatter | Record<string, string | Record<string, string>>,
  depth = 0,
): string[] => {
  const indent = "  ".repeat(depth);
  const lines: string[] = [];

  for (const [key, value] of Object.entries(record)) {
    if (typeof value === "string") {
      lines.push(`${indent}${key}: ${yamlScalar(value)}`);
      continue;
    }

    if (isNonEmptyRecord(value)) {
      lines.push(`${indent}${key}:`);
      lines.push(...formatYamlRecord(value, depth + 1));
    }
  }

  return lines;
};

const formatList = (items?: string[] | null) => {
  const lines = (items ?? [])
    .map((item) => sanitizePublicText(item))
    .filter((item): item is string => Boolean(item));

  return lines.length ? lines.map((item) => `- ${item}`).join("\n") : null;
};

const buildPublicDesignSections = ({
  project,
  projectNavigation,
  tokens,
}: {
  project: ProjectData;
  projectNavigation?: ProjectNavigationData | null;
  tokens: PublicTokenFrontmatter;
}) => {
  const charter = project.charter;
  const direction = charter?.creativeDirection;
  const navigationPlan = projectNavigation?.plan ?? null;
  const appType = sanitizePublicText(charter?.appType);
  const audience = sanitizePublicText(charter?.targetAudience);
  const concept = sanitizePublicText(direction?.conceptName);
  const styleEssence = sanitizePublicText(direction?.styleEssence);
  const designRationale = sanitizePublicText(charter?.designRationale);
  const colorStory = sanitizePublicText(direction?.colorStory);
  const typographyMood = sanitizePublicText(direction?.typographyMood);
  const surfaceLanguage = sanitizePublicText(direction?.surfaceLanguage);
  const iconographyStyle = sanitizePublicText(direction?.iconographyStyle);
  const motionTone = sanitizePublicText(direction?.motionTone);
  const composition = formatList(direction?.compositionPrinciples);
  const signatureMoments = formatList(direction?.signatureMoments);
  const keyFeatures = formatList(charter?.keyFeatures);
  const avoid = formatList(direction?.avoid);
  const navItems = navigationPlan?.items
    ?.map((item) => {
      const label = sanitizePublicText(item.label);
      const role = sanitizePublicText(item.role);
      return label ? `- ${label}${role ? `: ${role}` : ""}` : null;
    })
    .filter((line): line is string => Boolean(line))
    .join("\n");

  const colorValues = typeof tokens.colors === "object" && !Array.isArray(tokens.colors)
    ? Object.entries(tokens.colors).map(([key, value]) => `\`${key}\` ${value}`).join(", ")
    : null;
  const fontNames = typeof tokens.typography === "object" && !Array.isArray(tokens.typography)
    ? Array.from(new Set(
      Object.values(tokens.typography)
        .filter((value): value is Record<string, string> => typeof value === "object")
        .map((value) => value.fontFamily)
        .filter(Boolean),
    )).join(", ")
    : null;

  return [
    ["Brand & Style", [
      concept ? `The visual direction is "${concept}".` : null,
      appType ? `The product should read as a ${appType}.` : null,
      audience ? `Design for ${audience}.` : null,
      styleEssence,
      designRationale,
    ].filter(Boolean).join("\n\n")],
    ["Colors", [
      colorStory,
      colorValues ? `Use the exported palette roles as the public color contract: ${colorValues}.` : null,
      "Reserve stronger accent color for primary action, focus, and key status moments; keep neutral surfaces quiet and readable.",
    ].filter(Boolean).join("\n\n")],
    ["Typography", [
      typographyMood,
      fontNames ? `Use ${fontNames} across the interface unless platform constraints require a system fallback.` : null,
      "Build hierarchy through weight, scale, and muted supporting copy rather than decorative type treatment.",
    ].filter(Boolean).join("\n\n")],
    ["Layout & Spacing", [
      composition,
      "Use the spacing roles in the front matter for screen padding, section rhythm, component interiors, and tight inline groups.",
    ].filter(Boolean).join("\n\n")],
    ["Elevation & Shape", [
      surfaceLanguage,
      motionTone ? `Motion should feel ${motionTone}.` : null,
      "Use rounded surfaces and soft depth consistently; avoid mixing unrelated radius or shadow styles in the same screen.",
    ].filter(Boolean).join("\n\n")],
    ["Components", [
      iconographyStyle ? `Iconography: ${iconographyStyle}` : null,
      signatureMoments ? `Signature moments:\n${signatureMoments}` : null,
      keyFeatures ? `Product capabilities to support:\n${keyFeatures}` : null,
    ].filter(Boolean).join("\n\n")],
    ["Navigation", [
      navigationPlan?.enabled ? `Use ${sanitizePublicText(navigationPlan.kind) ?? "persistent"} primary navigation for peer destinations.` : "Use contextual navigation only; persistent app navigation is not required.",
      sanitizePublicText(navigationPlan?.visualBrief),
      navItems ? `Primary destinations:\n${navItems}` : null,
    ].filter(Boolean).join("\n\n")],
    ["Avoid", avoid ?? "- Generic dashboard blocks without a clear hierarchy\n- Decorative clutter that competes with core tasks\n- Inconsistent spacing, radius, or elevation between related components"],
  ] as const;
};

export const buildPublicDesignMdDocument = ({
  project,
  projectNavigation,
  tokenDraft,
}: {
  project: ProjectData;
  projectNavigation?: ProjectNavigationData | null;
  tokenDraft?: DesignTokens | null;
}) => {
  const tokens = buildPublicDesignTokens(tokenDraft ?? project.designTokens ?? null);
  const frontmatter: PublicTokenFrontmatter = {
    name: sanitizePublicText(project.name) ?? "Untitled Project",
    ...tokens,
  };
  const sections = buildPublicDesignSections({ project, projectNavigation, tokens });
  const document = [
    "---",
    ...formatYamlRecord(frontmatter),
    "---",
    "",
    ...sections.flatMap(([title, content]) => [`## ${title}`, "", sanitizePublicText(content) ?? "", ""]),
  ].join("\n").trimEnd();

  return PRIVATE_EXPORT_REPLACEMENTS.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    document,
  );
};
