export type ColorTokenKey =
  | "backgroundPrimary"
  | "backgroundSecondary"
  | "backgroundRaised"
  | "surfaceCard"
  | "surfaceSheet"
  | "surfaceModal"
  | "textPrimary"
  | "textMuted"
  | "textSubtle"
  | "actionPrimary"
  | "actionSecondary"
  | "actionForeground"
  | "actionDisabled"
  | "borderDivider"
  | "borderFocused";

export type TypeTokenKey =
  | "navTitle"
  | "screenTitle"
  | "heroTitle"
  | "sectionTitle"
  | "metricValue"
  | "body"
  | "supporting"
  | "caption"
  | "buttonLabel";

export type SpacingTokenKey = "xxs" | "xs" | "sm" | "md" | "lg" | "xl" | "xxl";
export type LayoutTokenKey = "screenMargin" | "sectionGap" | "elementGap";
export type SizingTokenKey = "standardButtonHeight" | "standardInputHeight" | "iconSmall" | "iconStandard" | "bottomNavHeight";
export type RadiusTokenKey = "app" | "pill";
export type ShadowTokenKey = "surface" | "overlay" | "none";

export type TypeScaleToken = {
  size: number;
  weight: number;
  lineHeight: number;
  sample: string;
};

export type ShadowToken = {
  value: string;
  preview: string;
};

export type PlaygroundTokens = {
  colors: Record<ColorTokenKey, string>;
  fontFamily: string;
  type: Record<TypeTokenKey, TypeScaleToken>;
  spacing: Record<SpacingTokenKey, number>;
  layout: Record<LayoutTokenKey, number>;
  sizing: Record<SizingTokenKey, number>;
  radii: Record<RadiusTokenKey, number>;
  shadows: Record<ShadowTokenKey, ShadowToken>;
  borderWidth: number;
};

export const DARK_PROJECT2_TOKENS: PlaygroundTokens = {
  colors: {
    backgroundPrimary: "#0F0F0F",
    backgroundSecondary: "#1A1A1A",
    backgroundRaised: "#1A1A1A",
    surfaceCard: "#161616",
    surfaceSheet: "#121212",
    surfaceModal: "#1E1E1E",
    textPrimary: "#FFFFFF",
    textMuted: "#A1A1A1",
    textSubtle: "#666666",
    actionPrimary: "#D4FF5E",
    actionSecondary: "#C8B6FF",
    actionForeground: "#000000",
    actionDisabled: "#2A2A2A",
    borderDivider: "#262626",
    borderFocused: "#D4FF5E",
  },
  fontFamily: "'Space Grotesk', 'JetBrains Mono', sans-serif",
  type: {
    navTitle: { size: 18, weight: 700, lineHeight: 24, sample: "Today" },
    screenTitle: { size: 28, weight: 800, lineHeight: 32, sample: "Leaderboard" },
    heroTitle: { size: 34, weight: 800, lineHeight: 40, sample: "Your Impact" },
    sectionTitle: { size: 14, weight: 600, lineHeight: 20, sample: "Weekly activity" },
    metricValue: { size: 24, weight: 700, lineHeight: 28, sample: "$500,000" },
    body: { size: 16, weight: 400, lineHeight: 24, sample: "Reusable row" },
    supporting: { size: 14, weight: 500, lineHeight: 20, sample: "Token changes" },
    caption: { size: 12, weight: 400, lineHeight: 16, sample: "Updated now" },
    buttonLabel: { size: 16, weight: 700, lineHeight: 20, sample: "Continue" },
  },
  spacing: { xxs: 4, xs: 8, sm: 12, md: 16, lg: 24, xl: 32, xxl: 48 },
  layout: { screenMargin: 20, sectionGap: 32, elementGap: 12 },
  sizing: { standardButtonHeight: 56, standardInputHeight: 52, iconSmall: 20, iconStandard: 24, bottomNavHeight: 80 },
  radii: { app: 24, pill: 9999 },
  shadows: {
    none: { value: "none", preview: "none" },
    surface: { value: "0px 4px 20px rgba(0, 0, 0, 0.5)", preview: "0px 4px 20px 0px rgba(0, 0, 0, 0.5)" },
    overlay: { value: "0px 12px 40px rgba(0, 0, 0, 0.8)", preview: "0px 12px 40px 0px rgba(0, 0, 0, 0.8)" },
  },
  borderWidth: 1.5,
};

export const LIGHT_PLAYGROUND_TOKENS: PlaygroundTokens = {
  ...DARK_PROJECT2_TOKENS,
  colors: {
    backgroundPrimary: "#F6F8F1",
    backgroundSecondary: "#E9EFE0",
    backgroundRaised: "#EEF4E7",
    surfaceCard: "#FFFFFF",
    surfaceSheet: "#F1F5EC",
    surfaceModal: "#FFFFFF",
    textPrimary: "#101510",
    textMuted: "#5F6B5F",
    textSubtle: "#8A9587",
    actionPrimary: "#2F7D32",
    actionSecondary: "#8B5CF6",
    actionForeground: "#FFFFFF",
    actionDisabled: "#D7DED2",
    borderDivider: "#DDE5D6",
    borderFocused: "#2F7D32",
  },
  shadows: {
    none: { value: "none", preview: "none" },
    surface: { value: "0px 8px 24px rgba(27, 40, 25, 0.10)", preview: "0px 8px 24px 0px rgba(27, 40, 25, 0.10)" },
    overlay: { value: "0px 18px 48px rgba(27, 40, 25, 0.18)", preview: "0px 18px 48px 0px rgba(27, 40, 25, 0.18)" },
  },
};

export const DEFAULT_PLAYGROUND_TOKENS: PlaygroundTokens = LIGHT_PLAYGROUND_TOKENS;

export const COLOR_GROUPS: Array<{
  title: string;
  items: Array<{ key: ColorTokenKey; label: string; hint: string }>;
}> = [
  {
    title: "Foundation",
    items: [
      { key: "backgroundPrimary", label: "Primary", hint: "App background" },
      { key: "backgroundSecondary", label: "Secondary", hint: "Raised canvas fills" },
      { key: "backgroundRaised", label: "Raised", hint: "Elevated backgrounds" },
    ],
  },
  {
    title: "Surfaces",
    items: [
      { key: "surfaceCard", label: "Card", hint: "Cards and blocks" },
      { key: "surfaceSheet", label: "Sheet", hint: "Bottom sheets" },
      { key: "surfaceModal", label: "Modal", hint: "Floating panels" },
    ],
  },
  {
    title: "Text",
    items: [
      { key: "textPrimary", label: "Primary text", hint: "High emphasis" },
      { key: "textMuted", label: "Muted text", hint: "Supporting labels" },
      { key: "textSubtle", label: "Subtle text", hint: "Low emphasis" },
    ],
  },
  {
    title: "Actions",
    items: [
      { key: "actionPrimary", label: "Primary", hint: "Main accent" },
      { key: "actionSecondary", label: "Secondary", hint: "Secondary accent" },
      { key: "actionForeground", label: "Foreground", hint: "Text on primary" },
      { key: "actionDisabled", label: "Disabled", hint: "Muted action state" },
    ],
  },
  {
    title: "Borders",
    items: [
      { key: "borderDivider", label: "Divider", hint: "Hairline borders" },
      { key: "borderFocused", label: "Focused", hint: "Focus and selected states" },
    ],
  },
];

export const TYPE_ITEMS: Array<{ key: TypeTokenKey; label: string }> = [
  { key: "navTitle", label: "Nav Title" },
  { key: "screenTitle", label: "Screen Title" },
  { key: "heroTitle", label: "Hero Title" },
  { key: "sectionTitle", label: "Section Title" },
  { key: "metricValue", label: "Metric Value" },
  { key: "body", label: "Body" },
  { key: "supporting", label: "Supporting" },
  { key: "caption", label: "Caption" },
  { key: "buttonLabel", label: "Button Label" },
];

export const SPACING_ITEMS: Array<{ key: SpacingTokenKey; label: string; max: number }> = [
  { key: "xxs", label: "XXS", max: 24 },
  { key: "xs", label: "XS", max: 32 },
  { key: "sm", label: "SM", max: 40 },
  { key: "md", label: "MD", max: 48 },
  { key: "lg", label: "LG", max: 64 },
  { key: "xl", label: "XL", max: 80 },
  { key: "xxl", label: "XXL", max: 96 },
];

export const LAYOUT_ITEMS: Array<{ key: LayoutTokenKey; label: string; max: number }> = [
  { key: "screenMargin", label: "Screen Margin", max: 48 },
  { key: "sectionGap", label: "Section Gap", max: 64 },
  { key: "elementGap", label: "Element Gap", max: 40 },
];

export const SIZING_ITEMS: Array<{ key: SizingTokenKey; label: string; max: number }> = [
  { key: "standardButtonHeight", label: "Button Height", max: 84 },
  { key: "standardInputHeight", label: "Input Height", max: 84 },
  { key: "iconSmall", label: "Small Icon", max: 36 },
  { key: "iconStandard", label: "Standard Icon", max: 40 },
  { key: "bottomNavHeight", label: "Bottom Nav", max: 112 },
];

export const cloneTokens = (tokens: PlaygroundTokens): PlaygroundTokens =>
  JSON.parse(JSON.stringify(tokens)) as PlaygroundTokens;

export function tokenCssVariables(tokens: PlaygroundTokens) {
  return {
    "--dg-color-text-low-emphasis": tokens.colors.textSubtle,
    "--dg-color-text-high-emphasis": tokens.colors.textPrimary,
    "--dg-color-text-medium-emphasis": tokens.colors.textMuted,
    "--dg-color-action-primary": tokens.colors.actionPrimary,
    "--dg-color-action-disabled": tokens.colors.actionDisabled,
    "--dg-color-action-secondary": tokens.colors.actionSecondary,
    "--dg-color-action-on-primary-text": tokens.colors.actionForeground,
    "--dg-color-border-divider": tokens.colors.borderDivider,
    "--dg-color-border-focused": tokens.colors.borderFocused,
    "--dg-color-surface-card": tokens.colors.surfaceCard,
    "--dg-color-surface-modal": tokens.colors.surfaceModal,
    "--dg-color-surface-bottom-sheet": tokens.colors.surfaceSheet,
    "--dg-color-background-primary": tokens.colors.backgroundPrimary,
    "--dg-color-background-secondary": tokens.colors.backgroundSecondary,
    "--dg-color-background-surface-elevated": tokens.colors.backgroundRaised,
    "--dg-radii-app": `${tokens.radii.app}px`,
    "--dg-radii-pill": `${tokens.radii.pill}px`,
    "--dg-sizing-icon-small": `${tokens.sizing.iconSmall}px`,
    "--dg-sizing-icon-standard": `${tokens.sizing.iconStandard}px`,
    "--dg-sizing-min-touch-target": "48px",
    "--dg-sizing-bottom-nav-height": `${tokens.sizing.bottomNavHeight}px`,
    "--dg-sizing-standard-input-height": `${tokens.sizing.standardInputHeight}px`,
    "--dg-sizing-standard-button-height": `${tokens.sizing.standardButtonHeight}px`,
    "--dg-shadows-none": tokens.shadows.none.value,
    "--dg-shadows-overlay": tokens.shadows.overlay.value,
    "--dg-shadows-surface": tokens.shadows.surface.value,
    "--dg-spacing-none": "0px",
    "--dg-spacing-lg": `${tokens.spacing.lg}px`,
    "--dg-spacing-md": `${tokens.spacing.md}px`,
    "--dg-spacing-sm": `${tokens.spacing.sm}px`,
    "--dg-spacing-xl": `${tokens.spacing.xl}px`,
    "--dg-spacing-xs": `${tokens.spacing.xs}px`,
    "--dg-spacing-xxl": `${tokens.spacing.xxl}px`,
    "--dg-spacing-xxs": `${tokens.spacing.xxs}px`,
    "--dg-typography-font-family": tokens.fontFamily,
    "--dg-type-nav-title-size": `${tokens.type.navTitle.size}px`,
    "--dg-type-nav-title-weight": tokens.type.navTitle.weight,
    "--dg-type-nav-title-line-height": `${tokens.type.navTitle.lineHeight}px`,
    "--dg-type-screen-title-size": `${tokens.type.screenTitle.size}px`,
    "--dg-type-screen-title-weight": tokens.type.screenTitle.weight,
    "--dg-type-screen-title-line-height": `${tokens.type.screenTitle.lineHeight}px`,
    "--dg-type-hero-title-size": `${tokens.type.heroTitle.size}px`,
    "--dg-type-hero-title-weight": tokens.type.heroTitle.weight,
    "--dg-type-hero-title-line-height": `${tokens.type.heroTitle.lineHeight}px`,
    "--dg-type-section-title-size": `${tokens.type.sectionTitle.size}px`,
    "--dg-type-section-title-weight": tokens.type.sectionTitle.weight,
    "--dg-type-section-title-line-height": `${tokens.type.sectionTitle.lineHeight}px`,
    "--dg-type-metric-value-size": `${tokens.type.metricValue.size}px`,
    "--dg-type-metric-value-weight": tokens.type.metricValue.weight,
    "--dg-type-metric-value-line-height": `${tokens.type.metricValue.lineHeight}px`,
    "--dg-type-body-size": `${tokens.type.body.size}px`,
    "--dg-type-body-weight": tokens.type.body.weight,
    "--dg-type-body-line-height": `${tokens.type.body.lineHeight}px`,
    "--dg-type-supporting-size": `${tokens.type.supporting.size}px`,
    "--dg-type-supporting-weight": tokens.type.supporting.weight,
    "--dg-type-supporting-line-height": `${tokens.type.supporting.lineHeight}px`,
    "--dg-type-caption-size": `${tokens.type.caption.size}px`,
    "--dg-type-caption-weight": tokens.type.caption.weight,
    "--dg-type-caption-line-height": `${tokens.type.caption.lineHeight}px`,
    "--dg-type-button-label-size": `${tokens.type.buttonLabel.size}px`,
    "--dg-type-button-label-weight": tokens.type.buttonLabel.weight,
    "--dg-type-button-label-line-height": `${tokens.type.buttonLabel.lineHeight}px`,
    "--dg-border-widths-standard": `${tokens.borderWidth}px`,
    "--dg-mobile-layout-element-gap": `${tokens.layout.elementGap}px`,
    "--dg-mobile-layout-section-gap": `${tokens.layout.sectionGap}px`,
    "--dg-mobile-layout-safe-area-top": "16px",
    "--dg-mobile-layout-screen-margin": `${tokens.layout.screenMargin}px`,
    "--dg-mobile-layout-safe-area-bottom": "16px",
  };
}

export function tokenCssText(tokens: PlaygroundTokens) {
  return Object.entries(tokenCssVariables(tokens))
    .map(([name, value]) => `  ${name}: ${value};`)
    .join("\n");
}
