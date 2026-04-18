"use client";

import { useState, type ComponentType, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  Layers,
  Loader2,
  MousePointerClick,
  Palette,
  Square,
  SunMedium,
  Type,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import type { DesignTokens } from "@/lib/types";

const TYPE_SCALE_PRESETS = {
  compact: {
    title_large: { size: "28px", line_height: "36px" },
    title_main: { size: "24px", line_height: "28px" },
    body_primary: { size: "14px", line_height: "20px" },
    body_secondary: { size: "12px", line_height: "16px" },
    caption: { size: "10px", line_height: "14px" },
    button_label: { size: "14px", line_height: "20px" },
  },
  default: {
    title_large: { size: "32px", line_height: "40px" },
    title_main: { size: "28px", line_height: "32px" },
    body_primary: { size: "16px", line_height: "24px" },
    body_secondary: { size: "14px", line_height: "20px" },
    caption: { size: "12px", line_height: "16px" },
    button_label: { size: "16px", line_height: "24px" },
  },
  large: {
    title_large: { size: "36px", line_height: "44px" },
    title_main: { size: "32px", line_height: "40px" },
    body_primary: { size: "18px", line_height: "28px" },
    body_secondary: { size: "16px", line_height: "24px" },
    caption: { size: "14px", line_height: "20px" },
    button_label: { size: "18px", line_height: "28px" },
  },
} as const;

const HEADING_WEIGHT_PRESETS = { light: 400, medium: 600, bold: 700 } as const;

const DENSITY_PRESETS = {
  compact: {
    spacing: { none: "0px", xxs: "2px", xs: "4px", sm: "8px", md: "12px", lg: "16px", xl: "24px", xxl: "32px" },
    layout: { screen_margin: "12px", section_gap: "16px", element_gap: "12px" },
  },
  comfortable: {
    spacing: { none: "0px", xxs: "4px", xs: "8px", sm: "12px", md: "16px", lg: "24px", xl: "32px", xxl: "48px" },
    layout: { screen_margin: "16px", section_gap: "24px", element_gap: "16px" },
  },
  spacious: {
    spacing: { none: "0px", xxs: "6px", xs: "12px", sm: "16px", md: "24px", lg: "32px", xl: "48px", xxl: "64px" },
    layout: { screen_margin: "24px", section_gap: "32px", element_gap: "24px" },
  },
} as const;

const TOUCH_TARGET_PRESETS = {
  standard: { min_touch_target: "48px", standard_button_height: "48px", standard_input_height: "48px" },
  large: { min_touch_target: "56px", standard_button_height: "56px", standard_input_height: "56px" },
} as const;

const SHADOW_PRESETS = {
  flat: { none: "none", sm: "none", md: "none", lg: "none", upward: "none" },
  subtle: {
    none: "none",
    sm: "0 1px 2px 0 rgba(0,0,0,0.05)",
    md: "0 4px 6px -1px rgba(0,0,0,0.1)",
    lg: "0 10px 15px -3px rgba(0,0,0,0.1)",
    upward: "0 -4px 6px -1px rgba(0,0,0,0.1)",
  },
  elevated: {
    none: "none",
    sm: "0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px -1px rgba(0,0,0,0.1)",
    md: "0 4px 6px -1px rgba(0,0,0,0.15), 0 2px 4px -2px rgba(0,0,0,0.1)",
    lg: "0 20px 25px -5px rgba(0,0,0,0.15), 0 8px 10px -6px rgba(0,0,0,0.1)",
    upward: "0 -10px 15px -3px rgba(0,0,0,0.12)",
  },
} as const;

const BORDER_STYLE_PRESETS = {
  none: { none: "0px", hairline: "0px", thin: "0px", thick: "0px" },
  hairline: { none: "0px", hairline: "1px", thin: "2px", thick: "4px" },
  bold: { none: "0px", hairline: "2px", thin: "3px", thick: "6px" },
} as const;

function detectTypeScale(tokens: NonNullable<DesignTokens["tokens"]>) {
  const bodySize = parseInt(tokens.typography?.body_primary?.size || "16", 10);
  if (bodySize <= 14) return "compact";
  if (bodySize >= 18) return "large";
  return "default";
}

function detectHeadingWeight(tokens: NonNullable<DesignTokens["tokens"]>) {
  const weight = Number(tokens.typography?.title_large?.weight ?? tokens.typography?.title_main?.weight ?? 700);
  if (weight <= 400) return "light";
  if (weight <= 600) return "medium";
  return "bold";
}

function detectDensity(tokens: NonNullable<DesignTokens["tokens"]>) {
  const margin = parseInt(tokens.mobile_layout?.screen_margin || tokens.spacing?.md || "16", 10);
  if (margin <= 12) return "compact";
  if (margin >= 24) return "spacious";
  return "comfortable";
}

function detectTouchTarget(tokens: NonNullable<DesignTokens["tokens"]>) {
  const height = parseInt(tokens.sizing?.standard_button_height || "48", 10);
  return height >= 56 ? "large" : "standard";
}

function detectShadowDepth(tokens: NonNullable<DesignTokens["tokens"]>) {
  const value = tokens.shadows?.md || "";
  if (!value || value === "none") return "flat";
  if (value.includes("0.15")) return "elevated";
  return "subtle";
}

function detectBorderStyle(tokens: NonNullable<DesignTokens["tokens"]>) {
  const hairline = parseInt(tokens.border_widths?.hairline || "1", 10);
  if (hairline === 0) return "none";
  if (hairline >= 2) return "bold";
  return "hairline";
}

function detectRadiusPreset(tokens: NonNullable<DesignTokens["tokens"]>) {
  const radius = parseInt(tokens.radii?.md || tokens.radii?.standard || "8", 10);
  if (radius === 0) return "sharp";
  if (radius >= 16) return "soft";
  return "round";
}

type DesignSystemEditorProps = {
  value: DesignTokens;
  onChange: (tokens: DesignTokens) => void;
  onSubmit: () => void | Promise<void>;
  title?: string;
  description?: string;
  submitLabel?: string;
  isSubmitting?: boolean;
  submitStatus?: string;
  usedFallback?: boolean;
};

export function DesignSystemEditor({
  value,
  onChange,
  onSubmit,
  title = "Design System",
  description = "Tune the visual system before building.",
  submitLabel = "Continue",
  isSubmitting = false,
  submitStatus,
  usedFallback = false,
}: DesignSystemEditorProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    colors: true,
    typography: false,
    layout: false,
    shape: false,
  });

  if (!value.tokens) {
    return null;
  }

  const toggleSection = (key: string) => setExpandedSections((current) => ({ ...current, [key]: !current[key] }));

  const deepUpdate = (mutator: (draft: DesignTokens) => void) => {
    const draft = JSON.parse(JSON.stringify(value)) as DesignTokens;
    mutator(draft);
    onChange(draft);
  };

  const handleUpdateToken = (path: string[], nextValue: string) => {
    deepUpdate((draft) => {
      let current = draft.tokens as Record<string, unknown>;
      for (let index = 0; index < path.length - 1; index += 1) {
        if (!current[path[index]]) {
          current[path[index]] = {};
        }
        current = current[path[index]] as Record<string, unknown>;
      }

      current[path[path.length - 1]] = nextValue;
    });
  };

  const updateAllRadii = (base: string) => {
    deepUpdate((draft) => {
      const radii = draft.tokens!.radii ?? {};
      if (base === "0px") {
        Object.assign(radii, { sharp: "0px", sm: "0px", md: "0px", lg: "0px", xl: "0px", pill: "0px", standard: "0px" });
      } else if (base === "8px") {
        Object.assign(radii, { sharp: "0px", sm: "4px", md: "8px", lg: "12px", xl: "16px", pill: "9999px", standard: "8px" });
      } else {
        Object.assign(radii, { sharp: "0px", sm: "8px", md: "16px", lg: "20px", xl: "24px", pill: "9999px", standard: "16px" });
      }

      draft.tokens!.radii = radii;
    });
  };

  const updateTypeScale = (preset: keyof typeof TYPE_SCALE_PRESETS) => {
    deepUpdate((draft) => {
      const typography = draft.tokens!.typography ?? {};
      for (const [key, nextPreset] of Object.entries(TYPE_SCALE_PRESETS[preset])) {
        const existing = (typography as Record<string, unknown>)[key] as Record<string, unknown> | undefined;
        (typography as Record<string, unknown>)[key] = { ...existing, ...nextPreset };
      }
      draft.tokens!.typography = typography;
    });
  };

  const updateHeadingWeight = (preset: keyof typeof HEADING_WEIGHT_PRESETS) => {
    const weight = HEADING_WEIGHT_PRESETS[preset];
    deepUpdate((draft) => {
      const typography = draft.tokens!.typography ?? {};
      if (typography.title_large) typography.title_large.weight = weight;
      if (typography.title_main) typography.title_main.weight = weight;
      draft.tokens!.typography = typography;
    });
  };

  const updateDensity = (preset: keyof typeof DENSITY_PRESETS) => {
    deepUpdate((draft) => {
      draft.tokens!.spacing = { ...draft.tokens!.spacing, ...DENSITY_PRESETS[preset].spacing };
      draft.tokens!.mobile_layout = { ...draft.tokens!.mobile_layout, ...DENSITY_PRESETS[preset].layout };
    });
  };

  const updateTouchTargets = (preset: keyof typeof TOUCH_TARGET_PRESETS) => {
    deepUpdate((draft) => {
      draft.tokens!.sizing = { ...draft.tokens!.sizing, ...TOUCH_TARGET_PRESETS[preset] };
    });
  };

  const updateShadowDepth = (preset: keyof typeof SHADOW_PRESETS) => {
    deepUpdate((draft) => {
      draft.tokens!.shadows = { ...draft.tokens!.shadows, ...SHADOW_PRESETS[preset] };
    });
  };

  const updateBorderStyle = (preset: keyof typeof BORDER_STYLE_PRESETS) => {
    deepUpdate((draft) => {
      draft.tokens!.border_widths = { ...draft.tokens!.border_widths, ...BORDER_STYLE_PRESETS[preset] };
    });
  };

  const tokens = value.tokens;
  const primaryBg = tokens.color?.background?.primary || "#ffffff";
  const secondaryBg = tokens.color?.background?.secondary || "#f9fafb";
  const primaryText = tokens.color?.text?.high_emphasis || "#111827";
  const mediumText = tokens.color?.text?.medium_emphasis || "#6b7280";
  const lowText = tokens.color?.text?.low_emphasis || "#9ca3af";
  const actionPrimary = tokens.color?.action?.primary || "#000000";
  const actionSecondary = tokens.color?.action?.secondary || "#333333";
  const actionText = tokens.color?.action?.on_primary_text || "#ffffff";
  const cardBg = tokens.color?.surface?.card || "#ffffff";
  const borderDivider = tokens.color?.border?.divider || "#e5e7eb";
  const borderFocused = tokens.color?.border?.focused || "#000000";
  const radius = tokens.radii?.md || tokens.radii?.standard || "8px";
  const radiusLg = tokens.radii?.lg || "12px";
  const shadowMd = tokens.shadows?.md || "0 4px 6px -1px rgba(0,0,0,0.1)";
  const borderHairline = tokens.border_widths?.hairline || "1px";
  const fontFamily = tokens.typography?.font_family || "Geist, sans-serif";

  return (
    <div className="relative grid min-h-[720px] overflow-hidden rounded-[28px] border border-black/10 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.10)] md:grid-cols-[minmax(0,460px)_minmax(0,1fr)]">
      {isSubmitting && submitStatus ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/70 backdrop-blur-sm">
          <div className="rounded-2xl border border-black/10 bg-white px-5 py-4 text-sm font-medium text-slate-700 shadow-lg">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {submitStatus}
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-col border-b border-black/5 md:border-b-0 md:border-r md:border-black/5">
        <div className="space-y-2 px-5 pb-4 pt-5 md:px-6 md:pt-6">
          <div className="inline-flex items-center rounded-full border border-black/10 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            Design Pass
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          </div>
          {usedFallback ? (
            <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              AI design analysis failed, so you are editing the default token set.
            </div>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pb-24">
          <SectionHeader icon={Palette} label="Colors" sectionKey="colors" expanded={expandedSections.colors} onToggle={toggleSection} />
          {expandedSections.colors ? (
            <div className="space-y-4 px-5 pb-5 md:px-6">
              <SubGroup label="Background">
                <ColorField label="Primary" value={primaryBg} onChange={(nextValue) => handleUpdateToken(["color", "background", "primary"], nextValue)} />
                <ColorField label="Secondary" value={secondaryBg} onChange={(nextValue) => handleUpdateToken(["color", "background", "secondary"], nextValue)} />
              </SubGroup>
              <SubGroup label="Surfaces">
                <ColorField label="Card" value={cardBg} onChange={(nextValue) => handleUpdateToken(["color", "surface", "card"], nextValue)} />
                <ColorField label="Sheet" value={tokens.color?.surface?.bottom_sheet || "#ffffff"} onChange={(nextValue) => handleUpdateToken(["color", "surface", "bottom_sheet"], nextValue)} />
                <ColorField label="Modal" value={tokens.color?.surface?.modal || "#ffffff"} onChange={(nextValue) => handleUpdateToken(["color", "surface", "modal"], nextValue)} />
              </SubGroup>
              <SubGroup label="Text">
                <ColorField label="High" value={primaryText} onChange={(nextValue) => handleUpdateToken(["color", "text", "high_emphasis"], nextValue)} />
                <ColorField label="Medium" value={mediumText} onChange={(nextValue) => handleUpdateToken(["color", "text", "medium_emphasis"], nextValue)} />
                <ColorField label="Low" value={lowText} onChange={(nextValue) => handleUpdateToken(["color", "text", "low_emphasis"], nextValue)} />
              </SubGroup>
              <SubGroup label="Actions">
                <ColorField label="Primary" value={actionPrimary} onChange={(nextValue) => handleUpdateToken(["color", "action", "primary"], nextValue)} />
                <ColorField label="Secondary" value={actionSecondary} onChange={(nextValue) => handleUpdateToken(["color", "action", "secondary"], nextValue)} />
                <ColorField label="On Primary" value={actionText} onChange={(nextValue) => handleUpdateToken(["color", "action", "on_primary_text"], nextValue)} />
                <ColorField label="Disabled" value={tokens.color?.action?.disabled || "#e5e7eb"} onChange={(nextValue) => handleUpdateToken(["color", "action", "disabled"], nextValue)} />
              </SubGroup>
              <SubGroup label="Borders">
                <ColorField label="Divider" value={borderDivider} onChange={(nextValue) => handleUpdateToken(["color", "border", "divider"], nextValue)} />
                <ColorField label="Focused" value={borderFocused} onChange={(nextValue) => handleUpdateToken(["color", "border", "focused"], nextValue)} />
              </SubGroup>
            </div>
          ) : null}

          <SectionHeader icon={Type} label="Typography" sectionKey="typography" expanded={expandedSections.typography} onToggle={toggleSection} />
          {expandedSections.typography ? (
            <div className="space-y-4 px-5 pb-5 md:px-6">
              <Field label="Font Family">
                <select
                  value={fontFamily.split(",")[0].replace(/["']/g, "").trim()}
                  onChange={(event) => handleUpdateToken(["typography", "font_family"], event.target.value)}
                  className="h-10 w-full rounded-xl border border-black/10 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition focus:border-black/30 focus:bg-white"
                >
                  <option value="Geist">Geist</option>
                  <option value="Inter">Inter</option>
                  <option value="Space Grotesk">Space Grotesk</option>
                  <option value="DM Sans">DM Sans</option>
                  <option value="Outfit">Outfit</option>
                  <option value="Poppins">Poppins</option>
                  <option value="Sora">Sora</option>
                  <option value="Playfair Display">Playfair Display</option>
                </select>
              </Field>
              <Field label="Type Scale">
                <PresetToggle
                  options={[
                    { label: "Compact", value: "compact" },
                    { label: "Default", value: "default" },
                    { label: "Large", value: "large" },
                  ]}
                  current={detectTypeScale(tokens)}
                  onChange={(nextValue) => updateTypeScale(nextValue as keyof typeof TYPE_SCALE_PRESETS)}
                />
              </Field>
              <Field label="Heading Weight">
                <PresetToggle
                  options={[
                    { label: "Light", value: "light" },
                    { label: "Medium", value: "medium" },
                    { label: "Bold", value: "bold" },
                  ]}
                  current={detectHeadingWeight(tokens)}
                  onChange={(nextValue) => updateHeadingWeight(nextValue as keyof typeof HEADING_WEIGHT_PRESETS)}
                />
              </Field>
            </div>
          ) : null}

          <SectionHeader icon={Layers} label="Layout & Spacing" sectionKey="layout" expanded={expandedSections.layout} onToggle={toggleSection} />
          {expandedSections.layout ? (
            <div className="space-y-4 px-5 pb-5 md:px-6">
              <Field label="Density">
                <PresetToggle
                  options={[
                    { label: "Compact", value: "compact" },
                    { label: "Comfortable", value: "comfortable" },
                    { label: "Spacious", value: "spacious" },
                  ]}
                  current={detectDensity(tokens)}
                  onChange={(nextValue) => updateDensity(nextValue as keyof typeof DENSITY_PRESETS)}
                />
              </Field>
              <Field label="Touch Targets" icon={MousePointerClick}>
                <PresetToggle
                  options={[
                    { label: "Standard", value: "standard" },
                    { label: "Large", value: "large" },
                  ]}
                  current={detectTouchTarget(tokens)}
                  onChange={(nextValue) => updateTouchTargets(nextValue as keyof typeof TOUCH_TARGET_PRESETS)}
                />
              </Field>
            </div>
          ) : null}

          <SectionHeader icon={Square} label="Shape & Elevation" sectionKey="shape" expanded={expandedSections.shape} onToggle={toggleSection} />
          {expandedSections.shape ? (
            <div className="space-y-4 px-5 pb-5 md:px-6">
              <Field label="Corners">
                <PresetToggle
                  options={[
                    { label: "Sharp", value: "sharp" },
                    { label: "Round", value: "round" },
                    { label: "Soft", value: "soft" },
                  ]}
                  current={detectRadiusPreset(tokens)}
                  onChange={(nextValue) => {
                    if (nextValue === "sharp") {
                      updateAllRadii("0px");
                    } else if (nextValue === "round") {
                      updateAllRadii("8px");
                    } else {
                      updateAllRadii("16px");
                    }
                  }}
                />
              </Field>
              <Field label="Shadow Depth" icon={SunMedium}>
                <PresetToggle
                  options={[
                    { label: "Flat", value: "flat" },
                    { label: "Subtle", value: "subtle" },
                    { label: "Elevated", value: "elevated" },
                  ]}
                  current={detectShadowDepth(tokens)}
                  onChange={(nextValue) => updateShadowDepth(nextValue as keyof typeof SHADOW_PRESETS)}
                />
              </Field>
              <Field label="Border Width">
                <PresetToggle
                  options={[
                    { label: "None", value: "none" },
                    { label: "Hairline", value: "hairline" },
                    { label: "Bold", value: "bold" },
                  ]}
                  current={detectBorderStyle(tokens)}
                  onChange={(nextValue) => updateBorderStyle(nextValue as keyof typeof BORDER_STYLE_PRESETS)}
                />
              </Field>
            </div>
          ) : null}
        </div>

        <div className="sticky bottom-0 border-t border-black/5 bg-white/90 p-4 backdrop-blur md:p-5">
          <Button className="h-11 w-full rounded-2xl text-sm font-medium" onClick={() => void onSubmit()} disabled={isSubmitting}>
            {submitLabel}
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="hidden items-center justify-center bg-[radial-gradient(circle_at_top,#f8fafc,transparent_48%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] p-8 md:flex">
        <div
          className="relative flex h-[620px] w-[310px] flex-col overflow-hidden rounded-[32px] border border-black/10 shadow-[0_18px_60px_rgba(15,23,42,0.16)]"
          style={{ backgroundColor: primaryBg, color: primaryText, fontFamily }}
        >
          <div className="flex items-center justify-between px-5 pt-5">
            <div className="h-7 w-7 rounded-full" style={{ backgroundColor: secondaryBg, border: `${borderHairline} solid ${borderDivider}` }} />
            <div className="h-7 w-20 rounded-full" style={{ backgroundColor: actionPrimary, opacity: 0.12 }} />
          </div>

          <div className="flex flex-1 flex-col px-5 pb-5 pt-4">
            <div>
              <h3
                className="tracking-tight"
                style={{
                  color: primaryText,
                  fontSize: tokens.typography?.title_main?.size || "28px",
                  fontWeight: Number(tokens.typography?.title_main?.weight ?? 700),
                  lineHeight: tokens.typography?.title_main?.line_height || "32px",
                }}
              >
                Preview
              </h3>
              <p
                className="mt-1"
                style={{
                  color: mediumText,
                  fontSize: tokens.typography?.body_secondary?.size || "14px",
                  lineHeight: tokens.typography?.body_secondary?.line_height || "20px",
                }}
              >
                Live token preview for the first generation pass.
              </p>
            </div>

            <div className="mt-5" style={{ borderBottom: `${borderHairline} solid ${borderDivider}` }} />

            <div
              className="mt-5 rounded-[24px] p-4"
              style={{
                backgroundColor: cardBg,
                borderRadius: radiusLg,
                boxShadow: shadowMd,
                border: `${borderHairline} solid ${borderDivider}`,
              }}
            >
              <div style={{ fontSize: tokens.typography?.body_primary?.size || "16px", lineHeight: tokens.typography?.body_primary?.line_height || "24px", color: primaryText }}>
                Weekly activity
              </div>
              <div className="mt-1" style={{ fontSize: tokens.typography?.caption?.size || "12px", color: lowText }}>
                Clean hierarchy with reusable card treatment.
              </div>
              <div className="mt-4 grid grid-cols-4 gap-2">
                {[36, 54, 42, 64].map((height, index) => (
                  <div key={height} className="flex items-end">
                    <div
                      className="w-full rounded-full"
                      style={{
                        height,
                        background: index % 2 === 0 ? actionPrimary : actionSecondary,
                        opacity: index % 2 === 0 ? 1 : 0.34,
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div
              className="mt-4 flex items-center gap-3 rounded-[24px] p-4"
              style={{
                backgroundColor: cardBg,
                borderRadius: radiusLg,
                boxShadow: shadowMd,
                border: `${borderHairline} solid ${borderDivider}`,
              }}
            >
              <div className="h-10 w-10 rounded-full" style={{ backgroundColor: actionPrimary, opacity: 0.14 }} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold" style={{ color: primaryText }}>Reusable list item</div>
                <div className="text-xs" style={{ color: mediumText }}>Stable spacing, color, and type rhythm</div>
              </div>
            </div>

            <div
              className="mt-4 flex items-center rounded-[18px] px-4"
              style={{
                backgroundColor: secondaryBg,
                borderRadius: radius,
                border: `${borderHairline} solid ${borderDivider}`,
                height: tokens.sizing?.standard_input_height || "48px",
              }}
            >
              <span style={{ fontSize: tokens.typography?.body_secondary?.size || "14px", color: lowText }}>Search interactions</span>
            </div>

            <div className="flex-1" />

            <button
              type="button"
              className="mt-4 flex h-[52px] w-full items-center justify-center gap-2 rounded-[20px] transition active:scale-[0.99]"
              style={{
                backgroundColor: actionPrimary,
                color: actionText,
                borderRadius: radiusLg,
                fontSize: tokens.typography?.button_label?.size || "16px",
                fontWeight: Number(tokens.typography?.button_label?.weight ?? 600),
              }}
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  label,
  sectionKey,
  expanded,
  onToggle,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  sectionKey: string;
  expanded: boolean;
  onToggle: (key: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(sectionKey)}
      className="flex w-full items-center justify-between px-5 py-3 text-left transition hover:bg-slate-50 md:px-6"
    >
      <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
      <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
    </button>
  );
}

function Field({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon?: ComponentType<{ className?: string }>;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
        {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
        {label}
      </label>
      {children}
    </div>
  );
}

function SubGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">{label}</span>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{children}</div>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const safeHex = value.length === 7
    ? value
    : value.length === 4
      ? `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`
      : "#000000";

  return (
    <div className="relative flex w-full flex-col gap-1">
      <label className="text-[11px] font-medium text-slate-500">{label}</label>
      <div className="relative flex items-center overflow-hidden rounded-xl border border-black/10 bg-slate-50 px-2 py-1.5 transition hover:border-black/20 focus-within:border-black/30 focus-within:bg-white">
        <input type="color" value={safeHex} onChange={(event) => onChange(event.target.value)} className="absolute inset-0 h-[200%] w-[200%] -left-2 -top-2 cursor-pointer opacity-0" />
        <div className="h-5 w-5 shrink-0 rounded-md border border-black/10 shadow-sm" style={{ backgroundColor: value }} />
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="ml-2 w-full bg-transparent font-mono text-xs font-medium uppercase text-slate-900 outline-none"
        />
      </div>
    </div>
  );
}

function PresetToggle({
  options,
  current,
  onChange,
}: {
  options: Array<{ label: string; value: string }>;
  current: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex rounded-xl border border-black/10 bg-slate-50 p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition ${
            current === option.value
              ? "bg-white text-slate-950 shadow-sm ring-1 ring-black/10"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}