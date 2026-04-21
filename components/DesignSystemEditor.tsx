"use client";

import { useState, type ComponentType, type ReactNode } from "react";
import {
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
import {
  getFontRecommendations,
  normalizeDesignTokens,
} from "@/lib/design-tokens";
import type { DesignTokens } from "@/lib/types";

const TYPOGRAPHY_STYLES = [
  { key: "title_large", label: "Title Large" },
  { key: "title_main", label: "Title Main" },
  { key: "body_primary", label: "Body Primary" },
  { key: "body_secondary", label: "Body Secondary" },
  { key: "caption", label: "Caption" },
  { key: "button_label", label: "Button Label" },
] as const;

const SPACING_KEYS = ["xxs", "xs", "sm", "md", "lg", "xl", "xxl"] as const;
const LAYOUT_KEYS = ["screen_margin", "section_gap", "element_gap"] as const;
const SIZE_KEYS = ["standard_button_height", "standard_input_height", "icon_small", "icon_standard", "bottom_nav_height"] as const;

type DesignSystemEditorProps = {
  value: DesignTokens;
  onChange: (tokens: DesignTokens) => void;
  onSubmit: () => void | Promise<void>;
  title?: string;
  description?: string;
  submitLabel?: string;
  isSubmitting?: boolean;
  submitStatus?: string;
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
}: DesignSystemEditorProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    colors: true,
    typography: true,
    layout: false,
    shape: false,
  });

  const normalizedValue = normalizeDesignTokens(value);

  if (!normalizedValue.tokens) {
    return null;
  }

  const tokens = normalizedValue.tokens;
  const recommendedFonts = getFontRecommendations(normalizedValue).slice(0, 8);

  const toggleSection = (key: string) => setExpandedSections((current) => ({ ...current, [key]: !current[key] }));

  const deepUpdate = (mutator: (draft: DesignTokens) => void) => {
    const draft = normalizeDesignTokens(value);
    mutator(draft);
    onChange(draft);
  };

  const handleUpdateToken = (path: string[], nextValue: string) => {
    deepUpdate((draft) => {
      let current = draft.tokens as Record<string, unknown>;
      for (let index = 0; index < path.length - 1; index += 1) {
        const existing = current[path[index]];
        if (!existing || typeof existing !== "object" || Array.isArray(existing)) {
          current[path[index]] = {};
        }
        current = current[path[index]] as Record<string, unknown>;
      }

      current[path[path.length - 1]] = nextValue;
    });
  };

  const rationaleEntries = [
    { label: "Color", value: normalizedValue.meta?.rationale?.color },
    { label: "Typography", value: normalizedValue.meta?.rationale?.typography },
    { label: "Spacing", value: normalizedValue.meta?.rationale?.spacing },
    { label: "Radii", value: normalizedValue.meta?.rationale?.radii },
    { label: "Shadows", value: normalizedValue.meta?.rationale?.shadows },
    { label: "Surfaces", value: normalizedValue.meta?.rationale?.surfaces },
  ].filter((entry): entry is { label: string; value: string } => Boolean(entry.value));

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
  const radius = tokens.radii?.app || "18px";
  const radiusPill = tokens.radii?.pill || "9999px";
  const shadowSurface = tokens.shadows?.surface || "0 12px 32px rgba(15, 23, 42, 0.14)";
  const borderStandard = tokens.border_widths?.standard || "1px";
  const fontFamily = tokens.typography?.font_family?.trim() || undefined;

  return (
    <div className="relative grid min-h-[720px] overflow-hidden rounded-[28px] border border-black/8 bg-[#fcfaf6] md:grid-cols-[minmax(0,520px)_minmax(0,1fr)]">
      {isSubmitting && submitStatus ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/70 backdrop-blur-sm">
          <div className="rounded-2xl border border-black/10 bg-white px-5 py-4 text-sm font-medium text-slate-700">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {submitStatus}
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-col border-b border-black/5 md:border-b-0 md:border-r md:border-black/5">
        <div className="space-y-2 px-5 pb-4 pt-5 md:px-6 md:pt-6">
          <div className="inline-flex items-center rounded-full border border-black/10 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            Design Pass
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pb-24">
          <div className="px-5 pb-5 md:px-6">
            <div className="rounded-[24px] border border-black/8 bg-[#f4efe4] p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">AI Rationale</div>
              {recommendedFonts.length > 0 ? (
                <div className="mt-3 space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Recommended Fonts</div>
                  <div className="flex flex-wrap gap-2">
                  {recommendedFonts.map((font) => (
                    <span
                      key={font}
                      className="rounded-full border border-black/10 bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-700"
                    >
                      {font}
                    </span>
                  ))}
                  </div>
                </div>
              ) : null}
              {rationaleEntries.length > 0 ? (
                <div className="mt-4 divide-y divide-black/8 rounded-[20px] border border-black/8 bg-white/80">
                  {rationaleEntries.map((entry) => (
                    <div key={entry.label} className="px-4 py-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{entry.label}</div>
                      <p className="mt-1 text-sm leading-6 text-slate-700">{entry.value}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

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
                <ColorField label="Focused" value={tokens.color?.border?.focused || "#111827"} onChange={(nextValue) => handleUpdateToken(["color", "border", "focused"], nextValue)} />
              </SubGroup>
            </div>
          ) : null}

          <SectionHeader icon={Type} label="Typography" sectionKey="typography" expanded={expandedSections.typography} onToggle={toggleSection} />
          {expandedSections.typography ? (
            <div className="space-y-4 px-5 pb-5 md:px-6">
              <Field label="Font Family">
                <input
                  value={tokens.typography?.font_family || ""}
                  onChange={(event) => handleUpdateToken(["typography", "font_family"], event.target.value)}
                  className="h-10 w-full rounded-xl border border-black/10 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-black/30"
                />
                <p className="text-xs leading-5 text-slate-500">Edit the saved CSS stack directly. Leave it blank only if you intend the downstream builder to rely on its internal runtime fallback.</p>
              </Field>
              <div className="grid gap-3">
                {TYPOGRAPHY_STYLES.map((style) => (
                  <TypographyFieldCard
                    key={style.key}
                    label={style.label}
                    size={tokens.typography?.[style.key]?.size || ""}
                    weight={String(tokens.typography?.[style.key]?.weight ?? "")}
                    lineHeight={tokens.typography?.[style.key]?.line_height || ""}
                    onSizeChange={(nextValue) => handleUpdateToken(["typography", style.key, "size"], nextValue)}
                    onWeightChange={(nextValue) => handleUpdateToken(["typography", style.key, "weight"], nextValue)}
                    onLineHeightChange={(nextValue) => handleUpdateToken(["typography", style.key, "line_height"], nextValue)}
                  />
                ))}
              </div>
            </div>
          ) : null}

          <SectionHeader icon={Layers} label="Layout & Spacing" sectionKey="layout" expanded={expandedSections.layout} onToggle={toggleSection} />
          {expandedSections.layout ? (
            <div className="space-y-4 px-5 pb-5 md:px-6">
              <SubGroup label="Spacing Scale">
                {SPACING_KEYS.map((key) => (
                  <TextField
                    key={key}
                    label={key.toUpperCase()}
                    value={tokens.spacing?.[key] || ""}
                    onChange={(nextValue) => handleUpdateToken(["spacing", key], nextValue)}
                  />
                ))}
              </SubGroup>
              <SubGroup label="Layout Rhythm">
                {LAYOUT_KEYS.map((key) => (
                  <TextField
                    key={key}
                    label={key.replace(/_/g, " ")}
                    value={tokens.mobile_layout?.[key] || ""}
                    onChange={(nextValue) => handleUpdateToken(["mobile_layout", key], nextValue)}
                  />
                ))}
              </SubGroup>
              <SubGroup label="Component Sizing">
                {SIZE_KEYS.map((key) => (
                  <TextField
                    key={key}
                    label={key.replace(/_/g, " ")}
                    value={tokens.sizing?.[key] || ""}
                    onChange={(nextValue) => handleUpdateToken(["sizing", key], nextValue)}
                  />
                ))}
              </SubGroup>
              <div className="rounded-2xl border border-black/8 bg-[#f7f3eb] px-4 py-3">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  <MousePointerClick className="h-3.5 w-3.5" />
                  Platform Constraints
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <ReadOnlyMetric label="Safe area top" value={tokens.mobile_layout?.safe_area_top || "16px"} />
                  <ReadOnlyMetric label="Safe area bottom" value={tokens.mobile_layout?.safe_area_bottom || "34px"} />
                  <ReadOnlyMetric label="Min touch target" value={tokens.sizing?.min_touch_target || "48px"} />
                </div>
              </div>
            </div>
          ) : null}

          <SectionHeader icon={Square} label="Shape & Elevation" sectionKey="shape" expanded={expandedSections.shape} onToggle={toggleSection} />
          {expandedSections.shape ? (
            <div className="space-y-4 px-5 pb-5 md:px-6">
              <div className="rounded-[20px] border border-black/8 bg-[#f7f3eb] p-4 text-sm leading-6 text-slate-600">
                One geometry and elevation language should carry the entire app. Use a single standard radius, one standard border width, and one standard surface shadow. Reserve pill geometry only for chips, segmented controls, or deliberate capsule actions.
              </div>
              <SubGroup label="Corner Geometry">
                <TextField
                  label="app radius"
                  value={tokens.radii?.app || ""}
                  onChange={(nextValue) => handleUpdateToken(["radii", "app"], nextValue)}
                />
                <TextField
                  label="pill radius"
                  value={tokens.radii?.pill || ""}
                  onChange={(nextValue) => handleUpdateToken(["radii", "pill"], nextValue)}
                />
              </SubGroup>
              <SubGroup label="Surface Outline">
                <TextField
                  label="standard border"
                  value={tokens.border_widths?.standard || ""}
                  onChange={(nextValue) => handleUpdateToken(["border_widths", "standard"], nextValue)}
                />
              </SubGroup>
              <div className="space-y-3">
                <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">Elevation Language</span>
                <ShadowField
                  label="surface shadow"
                  value={tokens.shadows?.surface || ""}
                  onChange={(nextValue) => handleUpdateToken(["shadows", "surface"], nextValue)}
                />
                <ShadowField
                  label="overlay shadow"
                  value={tokens.shadows?.overlay || ""}
                  onChange={(nextValue) => handleUpdateToken(["shadows", "overlay"], nextValue)}
                />
              </div>
              <Field label="No Elevation" icon={SunMedium}>
                <input
                  type="text"
                  value={tokens.shadows?.none || "none"}
                  onChange={(event) => handleUpdateToken(["shadows", "none"], event.target.value)}
                  className="h-10 w-full rounded-xl border border-black/10 bg-slate-50 px-3 font-mono text-xs text-slate-900 outline-none transition focus:border-black/30 focus:bg-white"
                />
              </Field>
            </div>
          ) : null}
        </div>

        <div className="sticky bottom-0 border-t border-black/5 bg-[#fcfaf6]/95 p-4 backdrop-blur md:p-5">
          <Button className="h-11 w-full rounded-2xl text-sm font-medium" onClick={() => void onSubmit()} disabled={isSubmitting}>
            {submitLabel}
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="hidden items-center justify-center border-t border-black/5 bg-[#efe8db] p-8 md:border-t-0 md:flex">
        <div
          className="relative flex h-[620px] w-[310px] flex-col overflow-hidden rounded-[32px] border border-black/10 bg-white"
          style={{ backgroundColor: primaryBg, color: primaryText, fontFamily }}
        >
          <div className="flex items-center justify-between px-5 pt-5">
            <div className="h-7 w-7 rounded-full" style={{ backgroundColor: secondaryBg, border: `${borderStandard} solid ${borderDivider}` }} />
            <div className="h-7 w-20 rounded-full" style={{ backgroundColor: actionPrimary, opacity: 0.12, borderRadius: radiusPill }} />
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
                Live token preview for the current generation contract.
              </p>
            </div>

            <div className="mt-5" style={{ borderBottom: `${borderStandard} solid ${borderDivider}` }} />

            <div
              className="mt-5 rounded-[24px] p-4"
              style={{
                backgroundColor: cardBg,
                borderRadius: radius,
                boxShadow: shadowSurface,
                border: `${borderStandard} solid ${borderDivider}`,
              }}
            >
              <div style={{ fontSize: tokens.typography?.body_primary?.size || "16px", lineHeight: tokens.typography?.body_primary?.line_height || "24px", color: primaryText }}>
                Weekly activity
              </div>
              <div className="mt-1" style={{ fontSize: tokens.typography?.caption?.size || "12px", color: lowText }}>
                Spacing, elevation, and geometry respond directly to the live token set.
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
                borderRadius: radius,
                boxShadow: shadowSurface,
                border: `${borderStandard} solid ${borderDivider}`,
              }}
            >
              <div className="h-10 w-10 rounded-full" style={{ backgroundColor: actionPrimary, opacity: 0.14 }} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold" style={{ color: primaryText }}>Reusable list item</div>
                <div className="text-xs" style={{ color: mediumText }}>Current system values, not preset buckets</div>
              </div>
            </div>

            <div
              className="mt-4 flex items-center rounded-[18px] px-4"
              style={{
                backgroundColor: secondaryBg,
                borderRadius: radius,
                border: `${borderStandard} solid ${borderDivider}`,
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
                borderRadius: radius,
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
      className="flex w-full items-center justify-between px-5 py-3 text-left transition hover:bg-[#f7f3eb] md:px-6"
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
      <div className="relative flex items-center overflow-hidden rounded-xl border border-black/10 bg-white px-2 py-1.5 transition hover:border-black/20 focus-within:border-black/30">
        <input type="color" value={safeHex} onChange={(event) => onChange(event.target.value)} className="absolute -left-2 -top-2 h-[200%] w-[200%] cursor-pointer opacity-0" />
        <div className="h-5 w-5 shrink-0 rounded-md border border-black/10" style={{ backgroundColor: value }} />
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

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-medium capitalize text-slate-500">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-xl border border-black/10 bg-white px-3 font-mono text-xs text-slate-900 outline-none transition focus:border-black/30"
      />
    </div>
  );
}

function ShadowField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-medium capitalize text-slate-500">{label}</label>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={2}
        className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 font-mono text-xs text-slate-900 outline-none transition focus:border-black/30"
      />
    </div>
  );
}

function TypographyFieldCard({
  label,
  size,
  weight,
  lineHeight,
  onSizeChange,
  onWeightChange,
  onLineHeightChange,
}: {
  label: string;
  size: string;
  weight: string;
  lineHeight: string;
  onSizeChange: (value: string) => void;
  onWeightChange: (value: string) => void;
  onLineHeightChange: (value: string) => void;
}) {
  return (
    <div className="rounded-[20px] border border-black/8 bg-[#f7f3eb] p-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <TextField label="Size" value={size} onChange={onSizeChange} />
        <TextField label="Weight" value={weight} onChange={onWeightChange} />
        <TextField label="Line Height" value={lineHeight} onChange={onLineHeightChange} />
      </div>
    </div>
  );
}

function ReadOnlyMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-black/8 bg-white/85 px-3 py-2">
      <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className="mt-1 font-mono text-xs text-slate-900">{value}</div>
    </div>
  );
}
