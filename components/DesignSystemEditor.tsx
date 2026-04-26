"use client";

import { useState, type ComponentType, type PointerEvent, type ReactNode } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Eye,
  Layers,
  Loader2,
  Minus,
  Palette,
  Plus,
  Ruler,
  Shapes,
  Type,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  getFontRecommendations,
  normalizeDesignTokens,
} from "@/lib/design-tokens";
import type { DesignTokens } from "@/lib/types";

const TYPOGRAPHY_STYLES = [
  { key: "nav_title", label: "Nav Title", sample: "Transaction Detail", fallback: 17 },
  { key: "screen_title", label: "Screen Title", sample: "Daily Planner", fallback: 24 },
  { key: "hero_title", label: "Hero Title", sample: "Your Path to Freedom", fallback: 32 },
  { key: "section_title", label: "Section Title", sample: "Weekly activity", fallback: 18 },
  { key: "metric_value", label: "Metric Value", sample: "$500,000", fallback: 32 },
  { key: "body", label: "Body", sample: "Premium mobile rhythm", fallback: 16 },
  { key: "supporting", label: "Supporting", sample: "Token changes land here", fallback: 14 },
  { key: "caption", label: "Caption", sample: "Updated just now", fallback: 12 },
  { key: "button_label", label: "Button Label", sample: "Continue", fallback: 15 },
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

const FONT_WEIGHT_OPTIONS = [
  { value: "300", label: "Light" },
  { value: "400", label: "Regular" },
  { value: "500", label: "Medium" },
  { value: "600", label: "Semi" },
  { value: "700", label: "Bold" },
  { value: "800", label: "Heavy" },
] as const;

const parsePixelToken = (value: string, fallback: number) => {
  const parsed = Number.parseFloat(value.replace("px", "").trim());
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clampNumber = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const serializePixelToken = (value: number, min: number, max: number) => `${clampNumber(Math.round(value), min, max)}px`;

type RgbColor = { r: number; g: number; b: number };
type HsvColor = { h: number; s: number; v: number };

const normalizeHex = (value: string) => {
  const stripped = value.trim().replace(/^#/, "");
  const expanded = stripped.length === 3
    ? stripped.split("").map((character) => `${character}${character}`).join("")
    : stripped;

  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) {
    return null;
  }

  return `#${expanded.toUpperCase()}`;
};

const hexToRgb = (value: string): RgbColor | null => {
  const normalized = normalizeHex(value);
  if (!normalized) {
    return null;
  }

  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  };
};

const rgbToHex = ({ r, g, b }: RgbColor) => `#${[r, g, b]
  .map((channel) => clampNumber(Math.round(channel), 0, 255).toString(16).padStart(2, "0"))
  .join("")
  .toUpperCase()}`;

const rgbToHsv = ({ r, g, b }: RgbColor): HsvColor => {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;

  let hue = 0;
  if (delta !== 0) {
    if (max === red) {
      hue = 60 * (((green - blue) / delta) % 6);
    } else if (max === green) {
      hue = 60 * ((blue - red) / delta + 2);
    } else {
      hue = 60 * ((red - green) / delta + 4);
    }
  }

  return {
    h: hue < 0 ? hue + 360 : hue,
    s: max === 0 ? 0 : delta / max,
    v: max,
  };
};

const hsvToRgb = ({ h, s, v }: HsvColor): RgbColor => {
  const chroma = v * s;
  const x = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - chroma;
  const [red, green, blue] = h < 60
    ? [chroma, x, 0]
    : h < 120
      ? [x, chroma, 0]
      : h < 180
        ? [0, chroma, x]
        : h < 240
          ? [0, x, chroma]
          : h < 300
            ? [x, 0, chroma]
            : [chroma, 0, x];

  return {
    r: (red + m) * 255,
    g: (green + m) * 255,
    b: (blue + m) * 255,
  };
};

const getRgbFallback = (value: string) => hexToRgb(value) ?? { r: 0, g: 0, b: 0 };

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
                <div className="overflow-x-auto overflow-y-hidden rounded-[14px] border border-slate-950/[0.08]">
                  <div className="grid min-w-[920px] grid-cols-[1.05fr_154px_178px_154px_1fr] gap-3 border-b border-slate-950/[0.08] bg-[#f7f7f8] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    <span>Style</span>
                    <span>Size</span>
                    <span>Weight</span>
                    <span>Line</span>
                    <span>Sample</span>
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
                      sample={style.sample}
                      fallbackSize={style.fallback}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {activeTab === "spacing" ? (
              <div className="grid gap-4 xl:grid-cols-2">
                <TokenGroup label="Spacing Scale">
                  {SPACING_KEYS.map((key) => (
                    <SpacingMetricRow
                      key={key}
                      label={key.toUpperCase()}
                      value={tokens.spacing?.[key] || ""}
                      min={0}
                      max={96}
                      onChange={(nextValue) => handleUpdateToken(["spacing", key], nextValue)}
                    />
                  ))}
                </TokenGroup>
                <TokenGroup label="Layout Rhythm">
                  {LAYOUT_KEYS.map((key) => (
                    <SpacingMetricRow
                      key={key}
                      label={key.replace(/_/g, " ")}
                      value={tokens.mobile_layout?.[key] || ""}
                      min={0}
                      max={120}
                      preview="layout"
                      onChange={(nextValue) => handleUpdateToken(["mobile_layout", key], nextValue)}
                    />
                  ))}
                </TokenGroup>
                <TokenGroup label="Component Sizing">
                  {SIZE_KEYS.map((key) => (
                    <SpacingMetricRow
                      key={key}
                      label={key.replace(/_/g, " ")}
                      value={tokens.sizing?.[key] || ""}
                      min={8}
                      max={140}
                      preview="component"
                      onChange={(nextValue) => handleUpdateToken(["sizing", key], nextValue)}
                    />
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
                  <ShapeMetricRow
                    label="App radius"
                    value={tokens.radii?.app || ""}
                    min={0}
                    max={48}
                    preview="radius"
                    onChange={(nextValue) => handleUpdateToken(["radii", "app"], nextValue)}
                  />
                  <ShapeMetricRow
                    label="Pill radius"
                    value={tokens.radii?.pill || ""}
                    min={0}
                    max={9999}
                    preview="pill"
                    onChange={(nextValue) => handleUpdateToken(["radii", "pill"], nextValue)}
                  />
                </TokenGroup>
                <TokenGroup label="Surface Outline">
                  <ShapeMetricRow
                    label="Standard border"
                    value={tokens.border_widths?.standard || ""}
                    min={0}
                    max={8}
                    preview="border"
                    onChange={(nextValue) => handleUpdateToken(["border_widths", "standard"], nextValue)}
                  />
                </TokenGroup>
                <TokenGroup label="Elevation">
                  <ShadowField
                    label="Surface shadow"
                    value={tokens.shadows?.surface || ""}
                    previewRadius={radius}
                    onChange={(nextValue) => handleUpdateToken(["shadows", "surface"], nextValue)}
                  />
                  <ShadowField
                    label="Overlay shadow"
                    value={tokens.shadows?.overlay || ""}
                    previewRadius={radius}
                    onChange={(nextValue) => handleUpdateToken(["shadows", "overlay"], nextValue)}
                  />
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
  const normalizedValue = normalizeHex(value) ?? "#000000";
  const [isOpen, setIsOpen] = useState(false);
  const [hexDraftState, setHexDraftState] = useState({ source: normalizedValue, value: normalizedValue });
  const [previousColor, setPreviousColor] = useState(normalizedValue);
  const hexDraft = hexDraftState.source === normalizedValue ? hexDraftState.value : normalizedValue;
  const rgb = getRgbFallback(normalizedValue);
  const hsv = rgbToHsv(rgb);
  const isHexValid = Boolean(normalizeHex(hexDraft));

  const commitHex = (nextValue: string) => {
    const normalized = normalizeHex(nextValue);
    setHexDraftState({ source: normalized ?? normalizedValue, value: nextValue.toUpperCase() });
    if (normalized) {
      onChange(normalized);
    }
  };

  const commitRgb = (nextRgb: RgbColor) => {
    const nextHex = rgbToHex(nextRgb);
    setHexDraftState({ source: nextHex, value: nextHex });
    onChange(nextHex);
  };

  const commitHsv = (nextHsv: HsvColor) => {
    commitRgb(hsvToRgb(nextHsv));
  };

  const handleCanvasPointer = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = clampNumber(event.clientX - rect.left, 0, rect.width);
    const y = clampNumber(event.clientY - rect.top, 0, rect.height);
    commitHsv({
      h: hsv.h,
      s: rect.width === 0 ? hsv.s : x / rect.width,
      v: rect.height === 0 ? hsv.v : 1 - y / rect.height,
    });
  };

  return (
    <div className="relative">
      <div className={`group flex items-center gap-2 rounded-[12px] border bg-white px-2 py-2 transition hover:border-slate-950/[0.18] ${isHexValid ? "border-slate-950/[0.08]" : "border-rose-300"}`}>
        <button
          type="button"
          aria-label={`Open ${label} color picker`}
          className="h-7 w-7 shrink-0 rounded-[8px] border border-slate-950/[0.1] shadow-inner"
          style={{ backgroundColor: normalizedValue }}
          onClick={() => {
            setPreviousColor(normalizedValue);
            setIsOpen((current) => !current);
          }}
        />
        <label className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium text-slate-700">{label}</span>
          <input
            type="text"
            value={hexDraft}
            onFocus={() => {
              setPreviousColor(normalizedValue);
              setIsOpen(true);
            }}
            onChange={(event) => commitHex(event.target.value)}
            className="block w-full bg-transparent font-mono text-[11px] uppercase text-slate-500 outline-none"
          />
        </label>
      </div>

      {isOpen ? (
        <div className="absolute left-0 top-[calc(100%+8px)] z-40 w-[min(320px,calc(100vw-2rem))] rounded-[16px] border border-slate-950/[0.1] bg-white p-3 shadow-[0_24px_70px_-42px_rgba(15,23,42,0.85)]">
          <div
            role="slider"
            aria-label={`${label} saturation and brightness`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(hsv.s * 100)}
            tabIndex={0}
            className="relative h-36 cursor-crosshair overflow-hidden rounded-[12px] border border-slate-950/[0.08]"
            style={{
              backgroundColor: rgbToHex(hsvToRgb({ h: hsv.h, s: 1, v: 1 })),
              backgroundImage: "linear-gradient(90deg, #FFFFFF, rgba(255,255,255,0)), linear-gradient(0deg, #000000, rgba(0,0,0,0))",
            }}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              handleCanvasPointer(event);
            }}
            onPointerMove={(event) => {
              if (event.buttons === 1) {
                handleCanvasPointer(event);
              }
            }}
          >
            <span
              className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(15,23,42,0.3)]"
              style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, backgroundColor: normalizedValue }}
            />
          </div>

          <div className="mt-3 grid grid-cols-[34px_minmax(0,1fr)] items-center gap-3">
            <div className="h-8 w-8 rounded-full border border-slate-950/[0.1]" style={{ backgroundColor: normalizedValue }} />
            <input
              type="range"
              min={0}
              max={360}
              value={Math.round(hsv.h)}
              onChange={(event) => commitHsv({ ...hsv, h: Number(event.target.value) })}
              className="h-2 w-full appearance-none rounded-full bg-[linear-gradient(90deg,#ff0000,#ffff00,#00ff00,#00ffff,#0000ff,#ff00ff,#ff0000)] outline-none"
            />
          </div>

          <div className="mt-3 grid grid-cols-4 gap-2">
            <ColorNumberField label="R" value={rgb.r} onChange={(nextValue) => commitRgb({ ...rgb, r: nextValue })} />
            <ColorNumberField label="G" value={rgb.g} onChange={(nextValue) => commitRgb({ ...rgb, g: nextValue })} />
            <ColorNumberField label="B" value={rgb.b} onChange={(nextValue) => commitRgb({ ...rgb, b: nextValue })} />
            <label className="space-y-1">
              <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Hex</span>
              <input
                type="text"
                value={hexDraft}
                onChange={(event) => commitHex(event.target.value)}
                className={`h-9 w-full rounded-[10px] border bg-[#fbfbfc] px-2 font-mono text-xs uppercase outline-none transition focus:bg-white ${isHexValid ? "border-slate-950/[0.08] focus:border-[#002fa7]/40" : "border-rose-300 text-rose-600"}`}
              />
            </label>
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-slate-950/[0.08] pt-3">
            <div className="flex items-center gap-2 text-[11px] font-medium text-slate-500">
              <span className="h-5 w-5 rounded-full border border-slate-950/[0.1]" style={{ backgroundColor: previousColor }} />
              Previous
              <span className="h-5 w-5 rounded-full border border-slate-950/[0.1]" style={{ backgroundColor: normalizedValue }} />
              Current
            </div>
            <button
              type="button"
              className="rounded-[9px] border border-slate-950/[0.08] bg-[#f7f7f8] px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-white"
              onClick={() => setIsOpen(false)}
            >
              Done
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ColorNumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="space-y-1">
      <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</span>
      <input
        type="number"
        min={0}
        max={255}
        value={Math.round(value)}
        onChange={(event) => onChange(clampNumber(Number(event.target.value), 0, 255))}
        className="h-9 w-full rounded-[10px] border border-slate-950/[0.08] bg-[#fbfbfc] px-2 font-mono text-xs text-slate-900 outline-none transition focus:border-[#002fa7]/40 focus:bg-white"
      />
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

function TypographyRow({
  label,
  size,
  weight,
  lineHeight,
  onSizeChange,
  onWeightChange,
  onLineHeightChange,
  sample,
  fallbackSize,
}: {
  label: string;
  size: string;
  weight: string;
  lineHeight: string;
  onSizeChange: (value: string) => void;
  onWeightChange: (value: string) => void;
  onLineHeightChange: (value: string) => void;
  sample: string;
  fallbackSize: number;
}) {
  const sizeNumber = parsePixelToken(size, fallbackSize);
  const lineNumber = parsePixelToken(lineHeight, Math.round(sizeNumber * 1.35));
  const resolvedWeight = weight || "400";

  return (
    <div className="grid min-w-[920px] grid-cols-[1.05fr_154px_178px_154px_1fr] items-center gap-3 border-b border-slate-950/[0.06] px-3 py-2.5 last:border-b-0">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-slate-900">{label}</div>
        <div className="mt-0.5 font-mono text-[11px] text-slate-400">{sizeNumber}px / {lineNumber}px</div>
      </div>
      <TokenMetricField
        label={`${label} size`}
        value={size}
        min={8}
        max={72}
        onChange={onSizeChange}
      />
      <FontWeightControl value={resolvedWeight} onChange={onWeightChange} />
      <TokenMetricField
        label={`${label} line height`}
        value={lineHeight}
        min={10}
        max={96}
        onChange={onLineHeightChange}
      />
      <div
        className="min-w-0 truncate rounded-[10px] border border-slate-950/[0.06] bg-[#fbfbfc] px-3 py-2 text-slate-950"
        style={{
          fontSize: `${sizeNumber}px`,
          fontWeight: Number(resolvedWeight),
          lineHeight: `${lineNumber}px`,
        }}
      >
        {sample}
      </div>
    </div>
  );
}

function SpacingMetricRow({
  label,
  value,
  min,
  max,
  preview = "spacing",
  onChange,
}: {
  label: string;
  value: string;
  min: number;
  max: number;
  preview?: "spacing" | "layout" | "component";
  onChange: (value: string) => void;
}) {
  const numericValue = parsePixelToken(value, min);

  return (
    <div className="col-span-full grid gap-2 rounded-[12px] border border-slate-950/[0.06] bg-white p-2 sm:grid-cols-[minmax(0,1fr)_154px_120px] sm:items-center">
      <div className="min-w-0">
        <div className="truncate text-xs font-medium capitalize text-slate-800">{label}</div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#eef1f5]">
          <div
            className="h-full rounded-full bg-slate-950 transition-all"
            style={{ width: `${clampNumber((numericValue / max) * 100, 4, 100)}%` }}
          />
        </div>
      </div>
      <TokenMetricField label={label} value={value} min={min} max={max} onChange={onChange} />
      <SpacingPreview value={numericValue} variant={preview} />
    </div>
  );
}

function SpacingPreview({ value, variant }: { value: number; variant: "spacing" | "layout" | "component" }) {
  if (variant === "layout") {
    return (
      <div className="flex h-12 items-center justify-center rounded-[10px] border border-slate-950/[0.06] bg-[#fbfbfc] p-1.5">
        <div className="h-full w-16 rounded-[8px] border border-slate-300 bg-white p-1" style={{ padding: clampNumber(value / 4, 2, 12) }}>
          <div className="h-full rounded-[5px] bg-slate-950/[0.12]" />
        </div>
      </div>
    );
  }

  if (variant === "component") {
    return (
      <div className="flex h-12 items-center justify-center rounded-[10px] border border-slate-950/[0.06] bg-[#fbfbfc]">
        <div className="rounded-full bg-slate-950" style={{ width: clampNumber(value * 1.25, 20, 92), height: clampNumber(value / 3, 8, 28) }} />
      </div>
    );
  }

  return (
    <div className="flex h-12 items-center justify-center gap-1 rounded-[10px] border border-slate-950/[0.06] bg-[#fbfbfc]">
      <span className="h-5 w-5 rounded-[6px] bg-slate-950/[0.14]" />
      <span className="h-px bg-slate-950" style={{ width: clampNumber(value, 4, 72) }} />
      <span className="h-5 w-5 rounded-[6px] bg-slate-950/[0.14]" />
    </div>
  );
}

function ShapeMetricRow({
  label,
  value,
  min,
  max,
  preview,
  onChange,
}: {
  label: string;
  value: string;
  min: number;
  max: number;
  preview: "radius" | "pill" | "border";
  onChange: (value: string) => void;
}) {
  const numericValue = parsePixelToken(value, min);

  return (
    <div className="col-span-full grid gap-2 rounded-[12px] border border-slate-950/[0.06] bg-white p-2 sm:grid-cols-[minmax(0,1fr)_154px_120px] sm:items-center">
      <div className="min-w-0">
        <div className="truncate text-xs font-medium capitalize text-slate-800">{label}</div>
        <div className="mt-0.5 font-mono text-[11px] text-slate-400">{serializePixelToken(numericValue, min, max)}</div>
      </div>
      <TokenMetricField label={label} value={value} min={min} max={max} onChange={onChange} />
      <ShapePreview value={numericValue} variant={preview} />
    </div>
  );
}

function ShapePreview({ value, variant }: { value: number; variant: "radius" | "pill" | "border" }) {
  if (variant === "border") {
    return (
      <div className="flex h-12 items-center justify-center rounded-[10px] bg-[#fbfbfc]">
        <div className="h-8 w-16 rounded-[10px] bg-white" style={{ border: `${clampNumber(value, 0, 8)}px solid #111827` }} />
      </div>
    );
  }

  return (
    <div className="flex h-12 items-center justify-center rounded-[10px] border border-slate-950/[0.06] bg-[#fbfbfc]">
      <div
        className="h-8 w-16 border border-slate-950/[0.08] bg-white shadow-[0_10px_28px_-22px_rgba(15,23,42,0.7)]"
        style={{ borderRadius: variant === "pill" ? 9999 : clampNumber(value, 0, 48) }}
      />
    </div>
  );
}

function ShadowField({
  label,
  value,
  previewRadius,
  onChange,
}: {
  label: string;
  value: string;
  previewRadius: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="col-span-full grid gap-2 rounded-[12px] border border-slate-950/[0.06] bg-white p-2 sm:grid-cols-[minmax(0,1fr)_120px]">
      <label className="space-y-1">
        <span className="block text-[11px] font-medium capitalize text-slate-500">{label}</span>
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={2}
          className="w-full resize-none rounded-[10px] border border-slate-950/[0.08] bg-[#fbfbfc] px-2.5 py-2 font-mono text-xs text-slate-900 outline-none transition focus:border-[#002fa7]/40 focus:bg-white"
        />
      </label>
      <div className="flex min-h-20 items-center justify-center rounded-[10px] bg-[#f7f7f8]">
        <div
          className="h-12 w-16 border border-slate-950/[0.08] bg-white"
          style={{
            borderRadius: previewRadius,
            boxShadow: value === "none" ? "none" : value,
          }}
        />
      </div>
    </div>
  );
}

function TokenMetricField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: string;
  min: number;
  max: number;
  onChange: (value: string) => void;
}) {
  const numericValue = parsePixelToken(value, min);
  const updateValue = (nextValue: number) => onChange(serializePixelToken(nextValue, min, max));

  return (
    <div className="grid h-9 grid-cols-[30px_minmax(0,1fr)_30px] overflow-hidden rounded-[10px] border border-slate-950/[0.08] bg-white">
      <button
        type="button"
        aria-label={`Decrease ${label}`}
        className="flex items-center justify-center border-r border-slate-950/[0.06] text-slate-500 transition hover:bg-[#f7f7f8] hover:text-slate-900"
        onClick={() => updateValue(numericValue - 1)}
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <label className="flex min-w-0 items-center bg-[#fbfbfc] px-2 focus-within:bg-white">
        <input
          type="number"
          min={min}
          max={max}
          value={numericValue}
          onChange={(event) => {
            const nextValue = Number.parseFloat(event.target.value);
            if (Number.isFinite(nextValue)) {
              updateValue(nextValue);
            }
          }}
          onBlur={(event) => {
            const nextValue = Number.parseFloat(event.target.value);
            updateValue(Number.isFinite(nextValue) ? nextValue : numericValue);
          }}
          className="h-full min-w-0 flex-1 bg-transparent font-mono text-xs text-slate-900 outline-none"
        />
        <span className="shrink-0 font-mono text-[11px] text-slate-400">px</span>
      </label>
      <button
        type="button"
        aria-label={`Increase ${label}`}
        className="flex items-center justify-center border-l border-slate-950/[0.06] text-slate-500 transition hover:bg-[#f7f7f8] hover:text-slate-900"
        onClick={() => updateValue(numericValue + 1)}
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function FontWeightControl({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const hasPresetValue = FONT_WEIGHT_OPTIONS.some((option) => option.value === value);
  const selectedOption = FONT_WEIGHT_OPTIONS.find((option) => option.value === value);
  const selectedLabel = selectedOption ? `${selectedOption.label} ${selectedOption.value}` : `Custom ${value}`;

  return (
    <div className="relative">
      <button
        type="button"
        className="flex h-9 w-full items-center justify-between gap-2 rounded-[10px] border border-slate-950/[0.08] bg-white px-2.5 text-left text-xs font-medium text-slate-800 outline-none transition hover:border-slate-950/[0.16] focus:border-[#002fa7]/40"
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen ? (
        <div className="absolute left-0 top-[calc(100%+6px)] z-30 w-full min-w-[178px] overflow-hidden rounded-[12px] border border-slate-950/[0.1] bg-white p-1 shadow-[0_18px_60px_-34px_rgba(15,23,42,0.75)]">
          {!hasPresetValue ? (
            <div className="flex h-8 items-center justify-between rounded-[9px] bg-[#f7f7f8] px-2 text-xs font-medium text-slate-500">
              <span>Custom {value}</span>
              <Check className="h-3.5 w-3.5" />
            </div>
          ) : null}
          {FONT_WEIGHT_OPTIONS.map((option) => {
            const selected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                className={`flex h-8 w-full items-center justify-between rounded-[9px] px-2 text-left text-xs font-medium transition ${
                  selected ? "bg-slate-950 text-white" : "text-slate-700 hover:bg-[#f7f7f8]"
                }`}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
              >
                <span>{option.label} {option.value}</span>
                {selected ? <Check className="h-3.5 w-3.5" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
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
            fontSize: `clamp(18px, 5.4vw, ${tokens.typography?.screen_title?.size || "24px"})`,
            fontWeight: Number(tokens.typography?.screen_title?.weight ?? 800),
            lineHeight: "1.12",
          }}
        >
          Preview
        </h3>
        <p className="mt-1 line-clamp-2" style={{ color: mediumText, fontSize: `clamp(12px, 3.2vw, ${tokens.typography?.supporting?.size || "14px"})`, lineHeight: "1.45" }}>
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
          <div style={{ fontSize: `clamp(13px, 3.8vw, ${tokens.typography?.body?.size || "16px"})`, lineHeight: "1.35", color: primaryText }}>
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
          <span className="truncate" style={{ fontSize: `clamp(12px, 3.2vw, ${tokens.typography?.supporting?.size || "14px"})`, color: lowText }}>Search interactions</span>
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
