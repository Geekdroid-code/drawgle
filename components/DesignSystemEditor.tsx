"use client";

import { useState, type ComponentType, type ReactNode } from "react";
import {
  ArrowRight,
  Eye,
  Layers,
  Loader2,
  Palette,
  Ruler,
  Shapes,
  Sparkles,
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

type EditorTab = "colors" | "type" | "spacing" | "shape";
type MobileView = "tokens" | "preview";

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

const EDITOR_TABS: Array<{ id: EditorTab; label: string; icon: ComponentType<{ className?: string }> }> = [
  { id: "colors", label: "Colors", icon: Palette },
  { id: "type", label: "Type", icon: Type },
  { id: "spacing", label: "Spacing", icon: Ruler },
  { id: "shape", label: "Shape", icon: Shapes },
];

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
  const [activeTab, setActiveTab] = useState<EditorTab>("colors");
  const [mobileView, setMobileView] = useState<MobileView>("tokens");
  const normalizedValue = normalizeDesignTokens(value);

  if (!normalizedValue.tokens) {
    return null;
  }

  const tokens = normalizedValue.tokens;
  const recommendedFonts = getFontRecommendations(normalizedValue).slice(0, 6);

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

  return (
    <div className="relative flex min-h-[680px] flex-1 flex-col overflow-hidden lg:h-[calc(100dvh-6.25rem)] lg:min-h-[620px]">
      {isSubmitting && submitStatus ? (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/72 backdrop-blur-sm">
          <div className="rounded-[14px] border border-slate-950/[0.08] bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-[0_18px_50px_-36px_rgba(15,23,42,0.6)]">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {submitStatus}
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex shrink-0 flex-col gap-3 rounded-[16px] border border-slate-950/[0.1] bg-white/92 px-4 py-3 backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          
          <h2 className="mt-1 truncate text-xl font-semibold tracking-[-0.03em] text-slate-950">{title}</h2>
          <p className="mt-0.5 line-clamp-1 text-sm text-slate-500">{description}</p>
        </div>

        <div className="grid grid-cols-2 rounded-[12px] border border-slate-950/[0.08] bg-[#f7f7f8] p-1 text-xs font-medium lg:hidden">
          {[
            { id: "tokens", label: "Tokens" },
            { id: "preview", label: "Preview" },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              className={`rounded-[9px] px-2 py-1.5 transition ${mobileView === item.id ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`}
              onClick={() => setMobileView(item.id as MobileView)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="hidden items-center gap-2 lg:flex">
          <span className="inline-flex h-9 items-center gap-2 rounded-[10px] border border-slate-950/[0.08] bg-[#f7f7f8] px-3 text-xs font-medium text-slate-600">
            <Eye className="h-3.5 w-3.5" />
            Live preview
          </span>
          <span className="inline-flex h-9 items-center rounded-[10px] border border-slate-950/[0.08] bg-white px-3 text-xs font-medium text-slate-600">
            {recommendedFonts.length || 0} font candidates
          </span>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 pt-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className={`${mobileView === "tokens" ? "flex" : "hidden"} min-h-0 flex-col overflow-hidden rounded-[16px] border border-slate-950/[0.1] bg-white lg:flex`}>
          <div className="shrink-0 border-b border-slate-950/[0.08] bg-white px-3 py-2">
            <div className="grid grid-cols-4 gap-1 rounded-[12px] bg-[#f7f7f8] p-1">
              {EDITOR_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex h-9 items-center justify-center gap-1.5 rounded-[9px] text-xs font-semibold transition ${
                    activeTab === tab.id ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <tab.icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto bg-white px-4 py-4">
            {activeTab === "colors" ? (
              <div className="grid gap-4 xl:grid-cols-2">
                <TokenGroup label="Background">
                  <ColorField label="Primary" value={primaryBg} onChange={(nextValue) => handleUpdateToken(["color", "background", "primary"], nextValue)} />
                  <ColorField label="Secondary" value={secondaryBg} onChange={(nextValue) => handleUpdateToken(["color", "background", "secondary"], nextValue)} />
                </TokenGroup>
                <TokenGroup label="Surfaces">
                  <ColorField label="Card" value={cardBg} onChange={(nextValue) => handleUpdateToken(["color", "surface", "card"], nextValue)} />
                  <ColorField label="Sheet" value={tokens.color?.surface?.bottom_sheet || "#ffffff"} onChange={(nextValue) => handleUpdateToken(["color", "surface", "bottom_sheet"], nextValue)} />
                  <ColorField label="Modal" value={tokens.color?.surface?.modal || "#ffffff"} onChange={(nextValue) => handleUpdateToken(["color", "surface", "modal"], nextValue)} />
                </TokenGroup>
                <TokenGroup label="Text">
                  <ColorField label="High" value={primaryText} onChange={(nextValue) => handleUpdateToken(["color", "text", "high_emphasis"], nextValue)} />
                  <ColorField label="Medium" value={mediumText} onChange={(nextValue) => handleUpdateToken(["color", "text", "medium_emphasis"], nextValue)} />
                  <ColorField label="Low" value={lowText} onChange={(nextValue) => handleUpdateToken(["color", "text", "low_emphasis"], nextValue)} />
                </TokenGroup>
                <TokenGroup label="Actions">
                  <ColorField label="Primary" value={actionPrimary} onChange={(nextValue) => handleUpdateToken(["color", "action", "primary"], nextValue)} />
                  <ColorField label="Secondary" value={actionSecondary} onChange={(nextValue) => handleUpdateToken(["color", "action", "secondary"], nextValue)} />
                  <ColorField label="On Primary" value={actionText} onChange={(nextValue) => handleUpdateToken(["color", "action", "on_primary_text"], nextValue)} />
                  <ColorField label="Disabled" value={tokens.color?.action?.disabled || "#e5e7eb"} onChange={(nextValue) => handleUpdateToken(["color", "action", "disabled"], nextValue)} />
                </TokenGroup>
                <TokenGroup label="Borders">
                  <ColorField label="Divider" value={borderDivider} onChange={(nextValue) => handleUpdateToken(["color", "border", "divider"], nextValue)} />
                  <ColorField label="Focused" value={tokens.color?.border?.focused || "#111827"} onChange={(nextValue) => handleUpdateToken(["color", "border", "focused"], nextValue)} />
                </TokenGroup>
              </div>
            ) : null}

            {activeTab === "type" ? (
              <div className="grid gap-4">
                <TokenGroup label="Font Stack">
                  <TextField
                    label="Font family"
                    value={tokens.typography?.font_family || ""}
                    onChange={(nextValue) => handleUpdateToken(["typography", "font_family"], nextValue)}
                    wide
                  />
                </TokenGroup>
                <div className="overflow-hidden rounded-[14px] border border-slate-950/[0.08]">
                  <div className="grid grid-cols-[1.2fr_0.8fr_0.8fr_0.9fr] gap-2 border-b border-slate-950/[0.08] bg-[#f7f7f8] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    <span>Style</span>
                    <span>Size</span>
                    <span>Weight</span>
                    <span>Line</span>
                  </div>
                  {TYPOGRAPHY_STYLES.map((style) => (
                    <TypographyRow
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

            {activeTab === "spacing" ? (
              <div className="grid gap-4 xl:grid-cols-2">
                <TokenGroup label="Spacing Scale">
                  {SPACING_KEYS.map((key) => (
                    <TextField key={key} label={key.toUpperCase()} value={tokens.spacing?.[key] || ""} onChange={(nextValue) => handleUpdateToken(["spacing", key], nextValue)} />
                  ))}
                </TokenGroup>
                <TokenGroup label="Layout Rhythm">
                  {LAYOUT_KEYS.map((key) => (
                    <TextField key={key} label={key.replace(/_/g, " ")} value={tokens.mobile_layout?.[key] || ""} onChange={(nextValue) => handleUpdateToken(["mobile_layout", key], nextValue)} />
                  ))}
                </TokenGroup>
                <TokenGroup label="Component Sizing">
                  {SIZE_KEYS.map((key) => (
                    <TextField key={key} label={key.replace(/_/g, " ")} value={tokens.sizing?.[key] || ""} onChange={(nextValue) => handleUpdateToken(["sizing", key], nextValue)} />
                  ))}
                </TokenGroup>
                <TokenGroup label="Platform Constraints">
                  <ReadOnlyMetric label="Safe area top" value={tokens.mobile_layout?.safe_area_top || "16px"} />
                  <ReadOnlyMetric label="Safe area bottom" value={tokens.mobile_layout?.safe_area_bottom || "34px"} />
                  <ReadOnlyMetric label="Min touch" value={tokens.sizing?.min_touch_target || "48px"} />
                </TokenGroup>
              </div>
            ) : null}

            {activeTab === "shape" ? (
              <div className="grid gap-4 xl:grid-cols-2">
                <TokenGroup label="Corner Geometry">
                  <TextField label="App radius" value={tokens.radii?.app || ""} onChange={(nextValue) => handleUpdateToken(["radii", "app"], nextValue)} />
                  <TextField label="Pill radius" value={tokens.radii?.pill || ""} onChange={(nextValue) => handleUpdateToken(["radii", "pill"], nextValue)} />
                </TokenGroup>
                <TokenGroup label="Surface Outline">
                  <TextField label="Standard border" value={tokens.border_widths?.standard || ""} onChange={(nextValue) => handleUpdateToken(["border_widths", "standard"], nextValue)} />
                </TokenGroup>
                <TokenGroup label="Elevation">
                  <ShadowField label="Surface shadow" value={tokens.shadows?.surface || ""} onChange={(nextValue) => handleUpdateToken(["shadows", "surface"], nextValue)} />
                  <ShadowField label="Overlay shadow" value={tokens.shadows?.overlay || ""} onChange={(nextValue) => handleUpdateToken(["shadows", "overlay"], nextValue)} />
                  <TextField label="No elevation" value={tokens.shadows?.none || "none"} onChange={(nextValue) => handleUpdateToken(["shadows", "none"], nextValue)} wide />
                </TokenGroup>
              </div>
            ) : null}
          </div>
        </section>

        <section className={`${mobileView === "preview" ? "flex" : "hidden"} min-h-0 items-center justify-center overflow-hidden rounded-[16px] border border-slate-950/[0.1] bg-[#eaedf1] p-3 sm:p-4 lg:flex`}>
          <PhonePreview
            primaryBg={primaryBg}
            secondaryBg={secondaryBg}
            primaryText={primaryText}
            mediumText={mediumText}
            lowText={lowText}
            actionPrimary={actionPrimary}
            actionSecondary={actionSecondary}
            actionText={actionText}
            cardBg={cardBg}
            borderDivider={borderDivider}
            radius={radius}
            radiusPill={radiusPill}
            shadowSurface={shadowSurface}
            borderStandard={borderStandard}
            fontFamily={fontFamily}
            tokens={tokens}
          />
        </section>
      </div>

      <div className="mt-4 flex shrink-0 flex-col gap-2 rounded-[16px] border border-slate-950/[0.1] bg-white/94 p-3 backdrop-blur lg:flex-row lg:items-center lg:justify-between">
        <div className="hidden items-center gap-2 text-xs text-slate-500 lg:flex">
          <Eye className="h-3.5 w-3.5" />
          Preview stays live while tokens change.
        </div>
        <Button className="h-10 rounded-[12px] dg-button-primary px-4 text-sm font-medium lg:min-w-[250px]" onClick={() => void onSubmit()} disabled={isSubmitting}>
          {submitLabel}
          <ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function TokenGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-[14px] border border-slate-950/[0.08] bg-[#fbfbfc] p-3">
      <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        <Layers className="h-3.5 w-3.5" />
        {label}
      </div>
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
    <label className="group relative flex cursor-pointer items-center gap-2 rounded-[12px] border border-slate-950/[0.08] bg-white px-2 py-2 transition hover:border-slate-950/[0.18]">
      <input type="color" value={safeHex} onChange={(event) => onChange(event.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
      <span className="h-7 w-7 shrink-0 rounded-[8px] border border-slate-950/[0.1]" style={{ backgroundColor: value }} />
      <span className="min-w-0">
        <span className="block truncate text-xs font-medium text-slate-700">{label}</span>
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="block w-full bg-transparent font-mono text-[11px] uppercase text-slate-500 outline-none"
        />
      </span>
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  wide = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  wide?: boolean;
}) {
  return (
    <label className={wide ? "col-span-full space-y-1" : "space-y-1"}>
      <span className="block truncate text-[11px] font-medium capitalize text-slate-500">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-[10px] border border-slate-950/[0.08] bg-white px-2.5 font-mono text-xs text-slate-900 outline-none transition focus:border-[#002fa7]/40"
      />
    </label>
  );
}

function ShadowField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="col-span-full space-y-1">
      <span className="block text-[11px] font-medium capitalize text-slate-500">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={2}
        className="w-full resize-none rounded-[10px] border border-slate-950/[0.08] bg-white px-2.5 py-2 font-mono text-xs text-slate-900 outline-none transition focus:border-[#002fa7]/40"
      />
    </label>
  );
}

function TypographyRow({
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
    <div className="grid grid-cols-[1.2fr_0.8fr_0.8fr_0.9fr] gap-2 border-b border-slate-950/[0.06] px-3 py-2 last:border-b-0">
      <div className="flex items-center text-sm font-medium text-slate-800">{label}</div>
      <CompactInput value={size} onChange={onSizeChange} />
      <CompactInput value={weight} onChange={onWeightChange} />
      <CompactInput value={lineHeight} onChange={onLineHeightChange} />
    </div>
  );
}

function CompactInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-8 min-w-0 rounded-[9px] border border-slate-950/[0.08] bg-[#fbfbfc] px-2 font-mono text-xs text-slate-900 outline-none transition focus:border-[#002fa7]/40 focus:bg-white"
    />
  );
}

function ReadOnlyMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[12px] border border-slate-950/[0.08] bg-white px-2.5 py-2">
      <div className="truncate text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">{label}</div>
      <div className="mt-1 font-mono text-xs text-slate-900">{value}</div>
    </div>
  );
}

function PhonePreview({
  primaryBg,
  secondaryBg,
  primaryText,
  mediumText,
  lowText,
  actionPrimary,
  actionSecondary,
  actionText,
  cardBg,
  borderDivider,
  radius,
  radiusPill,
  shadowSurface,
  borderStandard,
  fontFamily,
  tokens,
}: {
  primaryBg: string;
  secondaryBg: string;
  primaryText: string;
  mediumText: string;
  lowText: string;
  actionPrimary: string;
  actionSecondary: string;
  actionText: string;
  cardBg: string;
  borderDivider: string;
  radius: string;
  radiusPill: string;
  shadowSurface: string;
  borderStandard: string;
  fontFamily?: string;
  tokens: NonNullable<DesignTokens["tokens"]>;
}) {
  return (
    <div
      className="relative flex aspect-[9/18] h-[min(100%,clamp(360px,68dvh,560px))] max-h-full w-auto max-w-[min(78vw,280px)] flex-col overflow-hidden rounded-[clamp(22px,7vw,30px)] border border-slate-950/[0.12] bg-white shadow-[0_24px_60px_-42px_rgba(15,23,42,0.75)]"
      style={{ backgroundColor: primaryBg, color: primaryText, fontFamily }}
    >
      <div className="flex items-center justify-between px-[7%] pt-[7%]">
        <div className="h-[clamp(20px,6vw,28px)] w-[clamp(20px,6vw,28px)] rounded-full" style={{ backgroundColor: secondaryBg, border: `${borderStandard} solid ${borderDivider}` }} />
        <div className="h-[clamp(20px,6vw,28px)] w-[28%] rounded-full" style={{ backgroundColor: actionPrimary, opacity: 0.12, borderRadius: radiusPill }} />
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-[7%] pb-[7%] pt-[5%]">
        <h3
          className="tracking-tight"
          style={{
            color: primaryText,
            fontSize: `clamp(18px, 5.4vw, ${tokens.typography?.title_main?.size || "28px"})`,
            fontWeight: Number(tokens.typography?.title_main?.weight ?? 700),
            lineHeight: "1.12",
          }}
        >
          Preview
        </h3>
        <p className="mt-1 line-clamp-2" style={{ color: mediumText, fontSize: `clamp(12px, 3.2vw, ${tokens.typography?.body_secondary?.size || "14px"})`, lineHeight: "1.45" }}>
          Live token response across surfaces, type, spacing, and action states.
        </p>

        <div className="mt-[7%]" style={{ borderBottom: `${borderStandard} solid ${borderDivider}` }} />

        <div
          className="mt-[7%] p-[7%]"
          style={{
            backgroundColor: cardBg,
            borderRadius: radius,
            boxShadow: shadowSurface,
            border: `${borderStandard} solid ${borderDivider}`,
          }}
        >
          <div style={{ fontSize: `clamp(13px, 3.8vw, ${tokens.typography?.body_primary?.size || "16px"})`, lineHeight: "1.35", color: primaryText }}>
            Weekly activity
          </div>
          <div className="mt-1 line-clamp-1" style={{ fontSize: `clamp(10px, 3vw, ${tokens.typography?.caption?.size || "12px"})`, color: lowText }}>
            Token changes land here immediately.
          </div>
          <div className="mt-[7%] grid grid-cols-4 gap-[5%]">
            {[36, 54, 42, 64].map((height, index) => (
              <div key={`${height}-${index}`} className="flex items-end">
                <div
                  className="w-full rounded-full"
                  style={{
                    height: `clamp(24px, ${height / 5}vw, ${height}px)`,
                    background: index % 2 === 0 ? actionPrimary : actionSecondary,
                    opacity: index % 2 === 0 ? 1 : 0.34,
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        <div
          className="mt-[6%] flex items-center gap-[5%] p-[6%]"
          style={{
            backgroundColor: cardBg,
            borderRadius: radius,
            boxShadow: shadowSurface,
            border: `${borderStandard} solid ${borderDivider}`,
          }}
        >
          <div className="h-[clamp(30px,9vw,40px)] w-[clamp(30px,9vw,40px)] shrink-0 rounded-full" style={{ backgroundColor: actionPrimary, opacity: 0.14 }} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[clamp(12px,3.4vw,14px)] font-semibold" style={{ color: primaryText }}>Reusable row</div>
            <div className="truncate text-[clamp(10px,3vw,12px)]" style={{ color: mediumText }}>Surface plus text rhythm</div>
          </div>
        </div>

        <div
          className="mt-[6%] flex items-center px-[6%]"
          style={{
            backgroundColor: secondaryBg,
            borderRadius: radius,
            border: `${borderStandard} solid ${borderDivider}`,
            height: `clamp(40px, 10vw, ${tokens.sizing?.standard_input_height || "48px"})`,
          }}
        >
          <span className="truncate" style={{ fontSize: `clamp(12px, 3.2vw, ${tokens.typography?.body_secondary?.size || "14px"})`, color: lowText }}>Search interactions</span>
        </div>

        <div className="flex-1" />

        <button
          type="button"
          className="mt-[6%] flex h-[clamp(42px,11vw,52px)] w-full items-center justify-center gap-2 transition active:scale-[0.99]"
          style={{
            backgroundColor: actionPrimary,
            color: actionText,
            borderRadius: radius,
            fontSize: `clamp(13px, 3.6vw, ${tokens.typography?.button_label?.size || "16px"})`,
            fontWeight: Number(tokens.typography?.button_label?.weight ?? 600),
          }}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
