"use client";

import { useState, useEffect } from "react";
import {
  Loader2,
  Palette,
  Type,
  Square,
  Layers,
  ArrowRight,
  ChevronDown,
  AlertTriangle,
  MousePointerClick,
  SunMedium,
} from "lucide-react";
import { DesignTokens, ProjectData, PromptImagePayload } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { updateProjectFields } from "@/lib/supabase/queries";

// ---------------------------------------------------------------------------
// Fallback tokens (used when Gemini is unreachable)
// ---------------------------------------------------------------------------

const fallbackDesignTokens: DesignTokens = {
  tokens: {
    color: {
      background: { primary: "#ffffff", secondary: "#f9fafb" },
      surface: { card: "#ffffff", bottom_sheet: "#ffffff", modal: "#ffffff" },
      text: { high_emphasis: "#111827", medium_emphasis: "#6b7280", low_emphasis: "#9ca3af" },
      action: { primary: "#000000", secondary: "#333333", on_primary_text: "#ffffff", disabled: "#e5e7eb" },
      border: { divider: "#e5e7eb", focused: "#000000" },
    },
    typography: {
      font_family: "Inter",
      title_large: { size: "32px", weight: 700, line_height: "40px" },
      title_main: { size: "28px", weight: 700, line_height: "32px" },
      body_primary: { size: "16px", weight: 400, line_height: "24px" },
      body_secondary: { size: "14px", weight: 400, line_height: "20px" },
      caption: { size: "12px", weight: 400, line_height: "16px" },
      button_label: { size: "16px", weight: 600, line_height: "24px" },
    },
    spacing: { none: "0px", xxs: "4px", xs: "8px", sm: "12px", md: "16px", lg: "24px", xl: "32px", xxl: "48px" },
    mobile_layout: { screen_margin: "16px", safe_area_top: "44px", safe_area_bottom: "34px", section_gap: "24px", element_gap: "16px" },
    sizing: { min_touch_target: "48px", standard_button_height: "48px", standard_input_height: "48px", icon_small: "20px", icon_standard: "24px", bottom_nav_height: "80px" },
    radii: { sharp: "0px", sm: "4px", md: "8px", lg: "12px", xl: "16px", pill: "9999px" },
    border_widths: { none: "0px", hairline: "1px", thin: "2px", thick: "4px" },
    shadows: { none: "none", sm: "0 1px 2px 0 rgba(0,0,0,0.05)", md: "0 4px 6px -1px rgba(0,0,0,0.1)", lg: "0 10px 15px -3px rgba(0,0,0,0.1)", upward: "0 -4px 6px -1px rgba(0,0,0,0.1)" },
    opacities: { transparent: "0", disabled: "0.38", scrim_overlay: "0.50", pressed: "0.12", opaque: "1" },
    z_index: { base: "0", sticky_header: "10", bottom_nav: "20", bottom_sheet: "30", modal_dialog: "40", toast_snackbar: "50" },
  },
};

// ---------------------------------------------------------------------------
// Preset data
// ---------------------------------------------------------------------------

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
  compact: { spacing: { none: "0px", xxs: "2px", xs: "4px", sm: "8px", md: "12px", lg: "16px", xl: "24px", xxl: "32px" }, layout: { screen_margin: "12px", section_gap: "16px", element_gap: "12px" } },
  comfortable: { spacing: { none: "0px", xxs: "4px", xs: "8px", sm: "12px", md: "16px", lg: "24px", xl: "32px", xxl: "48px" }, layout: { screen_margin: "16px", section_gap: "24px", element_gap: "16px" } },
  spacious: { spacing: { none: "0px", xxs: "6px", xs: "12px", sm: "16px", md: "24px", lg: "32px", xl: "48px", xxl: "64px" }, layout: { screen_margin: "24px", section_gap: "32px", element_gap: "24px" } },
} as const;

const TOUCH_TARGET_PRESETS = {
  standard: { min_touch_target: "48px", standard_button_height: "48px", standard_input_height: "48px" },
  large: { min_touch_target: "56px", standard_button_height: "56px", standard_input_height: "56px" },
} as const;

const SHADOW_PRESETS = {
  flat: { none: "none", sm: "none", md: "none", lg: "none", upward: "none" },
  subtle: { none: "none", sm: "0 1px 2px 0 rgba(0,0,0,0.05)", md: "0 4px 6px -1px rgba(0,0,0,0.1)", lg: "0 10px 15px -3px rgba(0,0,0,0.1)", upward: "0 -4px 6px -1px rgba(0,0,0,0.1)" },
  elevated: { none: "none", sm: "0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px -1px rgba(0,0,0,0.1)", md: "0 4px 6px -1px rgba(0,0,0,0.15), 0 2px 4px -2px rgba(0,0,0,0.1)", lg: "0 20px 25px -5px rgba(0,0,0,0.15), 0 8px 10px -6px rgba(0,0,0,0.1)", upward: "0 -10px 15px -3px rgba(0,0,0,0.12)" },
} as const;

const BORDER_STYLE_PRESETS = {
  none: { none: "0px", hairline: "0px", thin: "0px", thick: "0px" },
  hairline: { none: "0px", hairline: "1px", thin: "2px", thick: "4px" },
  bold: { none: "0px", hairline: "2px", thin: "3px", thick: "6px" },
} as const;

// ---------------------------------------------------------------------------
// Helpers to detect the current preset from token state
// ---------------------------------------------------------------------------

function detectTypeScale(t: NonNullable<DesignTokens["tokens"]>): string {
  const bodySize = parseInt(t.typography?.body_primary?.size || "16");
  if (bodySize <= 14) return "compact";
  if (bodySize >= 18) return "large";
  return "default";
}

function detectHeadingWeight(t: NonNullable<DesignTokens["tokens"]>): string {
  const w = Number(t.typography?.title_large?.weight ?? t.typography?.title_main?.weight ?? 700);
  if (w <= 400) return "light";
  if (w <= 600) return "medium";
  return "bold";
}

function detectDensity(t: NonNullable<DesignTokens["tokens"]>): string {
  const m = parseInt(t.mobile_layout?.screen_margin || t.spacing?.md || "16");
  if (m <= 12) return "compact";
  if (m >= 24) return "spacious";
  return "comfortable";
}

function detectTouchTarget(t: NonNullable<DesignTokens["tokens"]>): string {
  const h = parseInt(t.sizing?.standard_button_height || "48");
  return h >= 56 ? "large" : "standard";
}

function detectShadowDepth(t: NonNullable<DesignTokens["tokens"]>): string {
  const md = t.shadows?.md || "";
  if (md === "none" || md === "") return "flat";
  if (md.includes("0.15")) return "elevated";
  return "subtle";
}

function detectBorderStyle(t: NonNullable<DesignTokens["tokens"]>): string {
  const hairline = parseInt(t.border_widths?.hairline || "1");
  if (hairline === 0) return "none";
  if (hairline >= 2) return "bold";
  return "hairline";
}

function detectRadiusPreset(t: NonNullable<DesignTokens["tokens"]>): string {
  const md = parseInt(t.radii?.md || t.radii?.standard || "8");
  if (md === 0) return "sharp";
  if (md >= 16) return "soft";
  return "round";
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ArtDirectorPanelProps {
  project: ProjectData;
  draftImage?: PromptImagePayload | null;
  onGenerationStart: (designTokens: DesignTokens) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function ArtDirectorPanel({ project, draftImage = null, onGenerationStart }: ArtDirectorPanelProps) {
  const [tokens, setTokens] = useState<DesignTokens | null>(project.designTokens || null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [loadingText, setLoadingText] = useState("");
  const [usedFallback, setUsedFallback] = useState(false);

  // Section collapse state
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    colors: true,
    typography: false,
    layout: false,
    shape: false,
  });

  const toggleSection = (key: string) =>
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));

  // Sync tokens when project updates externally (e.g. Realtime)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTokens(project.designTokens || null);
  }, [project.designTokens, project.id]);

  // Auto-fetch design tokens from Gemini when panel mounts with a prompt but no tokens
  useEffect(() => {
    if (tokens || !project.prompt || isLoading) return;

    const controller = new AbortController();
    const fetchDesign = async () => {
      const supabase = createClient();
      setIsLoading(true);
      setLoadingText("Analyzing your design brief...");
      try {
        const res = await fetch("/api/design", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: project.prompt, image: draftImage }),
          signal: controller.signal,
        });

        const json = await res.json().catch(() => null);
        const nextTokens = res.ok && json ? (json as DesignTokens) : fallbackDesignTokens;

        if (!res.ok) {
          console.error("Failed to fetch design", json);
          setUsedFallback(true);
        }

        setTokens(nextTokens);
        await updateProjectFields(supabase, project.id, { designTokens: nextTokens });
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        console.error("Failed to fetch design", err);
        setTokens(fallbackDesignTokens);
        setUsedFallback(true);

        try {
          const supabase = createClient();
          await updateProjectFields(supabase, project.id, { designTokens: fallbackDesignTokens });
        } catch (persistError) {
          console.error("Failed to persist fallback design tokens", persistError);
        }
      } finally {
        setIsLoading(false);
      }
    };

    void fetchDesign();
    return () => controller.abort();
  }, [draftImage, isLoading, project.id, project.prompt, tokens]);

  // Fallback when no prompt is provided
  useEffect(() => {
    if (!tokens && !project.prompt && !isLoading) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTokens(fallbackDesignTokens);
    }
  }, [tokens, project.prompt, isLoading]);

  // ---- Token updaters ----

  const deepUpdate = (mutator: (draft: DesignTokens) => void) => {
    if (!tokens) return;
    const updated: DesignTokens = JSON.parse(JSON.stringify(tokens));
    mutator(updated);
    setTokens(updated);
  };

  const handleUpdateToken = (path: string[], value: string) => {
    deepUpdate((draft) => {
      let current: Record<string, unknown> = draft.tokens as Record<string, unknown>;
      for (let i = 0; i < path.length - 1; i++) {
        if (!current[path[i]]) current[path[i]] = {};
        current = current[path[i]] as Record<string, unknown>;
      }
      current[path[path.length - 1]] = value;
    });
  };

  const updateAllRadii = (baseStr: string) => {
    deepUpdate((draft) => {
      const r = draft.tokens!.radii ?? {};
      if (baseStr === "0px") {
        Object.assign(r, { sharp: "0px", sm: "0px", md: "0px", lg: "0px", xl: "0px", pill: "0px", standard: "0px" });
      } else if (baseStr === "8px") {
        Object.assign(r, { sharp: "0px", sm: "4px", md: "8px", lg: "12px", xl: "16px", pill: "9999px", standard: "8px" });
      } else {
        Object.assign(r, { sharp: "0px", sm: "8px", md: "16px", lg: "20px", xl: "24px", pill: "9999px", standard: "16px" });
      }
      draft.tokens!.radii = r;
    });
  };

  const updateTypeScale = (preset: keyof typeof TYPE_SCALE_PRESETS) => {
    deepUpdate((draft) => {
      const typo = draft.tokens!.typography ?? {};
      for (const [key, val] of Object.entries(TYPE_SCALE_PRESETS[preset])) {
        const existing = (typo as Record<string, unknown>)[key] as Record<string, unknown> | undefined;
        (typo as Record<string, unknown>)[key] = { ...existing, ...val };
      }
      draft.tokens!.typography = typo;
    });
  };

  const updateHeadingWeight = (preset: keyof typeof HEADING_WEIGHT_PRESETS) => {
    const w = HEADING_WEIGHT_PRESETS[preset];
    deepUpdate((draft) => {
      const typo = draft.tokens!.typography ?? {};
      if (typo.title_large) typo.title_large.weight = w;
      if (typo.title_main) typo.title_main.weight = w;
      draft.tokens!.typography = typo;
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

  // ---- Build handler ----

  const handleBuild = async () => {
    setIsStarting(true);
    setLoadingText("Provisioning agents...");

    try {
      if (tokens) {
        const supabase = createClient();
        await updateProjectFields(supabase, project.id, {
          designTokens: tokens,
          status: "active",
        });

        onGenerationStart(tokens).catch((e) => console.error("Generation failed:", e));
      }
    } catch (e) {
      console.error(e);
      setIsStarting(false);
    }
  };

  // ---- Loading / starting overlay ----

  if (isLoading || isStarting) {
    return (
      <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 max-w-xs w-full text-center space-y-4">
          <Loader2 className="w-6 h-6 text-gray-900 animate-spin mx-auto" />
          <p className="text-sm font-medium text-gray-700">{loadingText}</p>
        </div>
      </div>
    );
  }

  if (!tokens?.tokens) return null;

  // ---- Derived values ----

  const t = tokens.tokens;
  const primaryBg = t.color?.background?.primary || "#ffffff";
  const secondaryBg = t.color?.background?.secondary || "#f9fafb";
  const primaryText = t.color?.text?.high_emphasis || "#111827";
  const mediumText = t.color?.text?.medium_emphasis || "#6b7280";
  const lowText = t.color?.text?.low_emphasis || "#9ca3af";
  const actionPrimary = t.color?.action?.primary || "#000000";
  const actionSecondary = t.color?.action?.secondary || "#333333";
  const actionText = t.color?.action?.on_primary_text || "#ffffff";
  const cardBg = t.color?.surface?.card || "#ffffff";
  const borderDivider = t.color?.border?.divider || "#e5e7eb";
  const borderFocused = t.color?.border?.focused || "#000000";
  const radius = t.radii?.md || t.radii?.standard || "8px";
  const radiusLg = t.radii?.lg || "12px";
  const shadowMd = t.shadows?.md || "0 4px 6px -1px rgba(0,0,0,0.1)";
  const borderHairline = t.border_widths?.hairline || "1px";
  const fontFamily = t.typography?.font_family || "Inter, sans-serif";

  return (
    <div className="absolute inset-0 bg-white md:bg-gray-50/80 md:backdrop-blur-sm z-50 flex items-center justify-center md:p-6 overflow-hidden">
      <div className="bg-white md:rounded-xl md:shadow-xl md:border border-gray-200 w-full h-full md:h-auto md:max-h-[85vh] md:max-w-5xl flex flex-col md:flex-row overflow-hidden absolute md:relative inset-0 md:inset-auto">
        {/* Left Side: Controls */}
        <div className="w-full md:w-[45%] flex flex-col h-full bg-white border-r border-gray-100">
          <div className="p-5 md:p-6 pb-4 shrink-0">
            <h2 className="text-lg font-semibold tracking-tight text-gray-900 mb-1">Design System</h2>
            <p className="text-sm text-gray-500 font-normal">Configure the base styles before generating.</p>
            {usedFallback && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>AI design analysis failed — using default tokens. You can tweak below.</span>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto pb-20">
            {/* ============ COLORS ============ */}
            <SectionHeader icon={Palette} label="Colors" sectionKey="colors" expanded={expandedSections.colors} onToggle={toggleSection} />
            {expandedSections.colors && (
              <div className="px-5 md:px-6 pb-5 space-y-4">
                <SubGroup label="Background">
                  <ColorPicker label="Primary" value={primaryBg} onChange={(v) => handleUpdateToken(["color", "background", "primary"], v)} />
                  <ColorPicker label="Secondary" value={secondaryBg} onChange={(v) => handleUpdateToken(["color", "background", "secondary"], v)} />
                </SubGroup>
                <SubGroup label="Surfaces">
                  <ColorPicker label="Card" value={cardBg} onChange={(v) => handleUpdateToken(["color", "surface", "card"], v)} />
                  <ColorPicker label="Sheet" value={t.color?.surface?.bottom_sheet || "#ffffff"} onChange={(v) => handleUpdateToken(["color", "surface", "bottom_sheet"], v)} />
                  <ColorPicker label="Modal" value={t.color?.surface?.modal || "#ffffff"} onChange={(v) => handleUpdateToken(["color", "surface", "modal"], v)} />
                </SubGroup>
                <SubGroup label="Text">
                  <ColorPicker label="High" value={primaryText} onChange={(v) => handleUpdateToken(["color", "text", "high_emphasis"], v)} />
                  <ColorPicker label="Medium" value={mediumText} onChange={(v) => handleUpdateToken(["color", "text", "medium_emphasis"], v)} />
                  <ColorPicker label="Low" value={lowText} onChange={(v) => handleUpdateToken(["color", "text", "low_emphasis"], v)} />
                </SubGroup>
                <SubGroup label="Actions">
                  <ColorPicker label="Primary" value={actionPrimary} onChange={(v) => handleUpdateToken(["color", "action", "primary"], v)} />
                  <ColorPicker label="Secondary" value={actionSecondary} onChange={(v) => handleUpdateToken(["color", "action", "secondary"], v)} />
                  <ColorPicker label="On Primary" value={actionText} onChange={(v) => handleUpdateToken(["color", "action", "on_primary_text"], v)} />
                  <ColorPicker label="Disabled" value={t.color?.action?.disabled || "#e5e7eb"} onChange={(v) => handleUpdateToken(["color", "action", "disabled"], v)} />
                </SubGroup>
                <SubGroup label="Borders">
                  <ColorPicker label="Divider" value={borderDivider} onChange={(v) => handleUpdateToken(["color", "border", "divider"], v)} />
                  <ColorPicker label="Focused" value={borderFocused} onChange={(v) => handleUpdateToken(["color", "border", "focused"], v)} />
                </SubGroup>
              </div>
            )}

            {/* ============ TYPOGRAPHY ============ */}
            <SectionHeader icon={Type} label="Typography" sectionKey="typography" expanded={expandedSections.typography} onToggle={toggleSection} />
            {expandedSections.typography && (
              <div className="px-5 md:px-6 pb-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-gray-500">Font Family</label>
                  <select
                    value={fontFamily.split(",")[0].replace(/['"]/g, "").trim()}
                    onChange={(e) => handleUpdateToken(["typography", "font_family"], e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-900 focus:ring-1 focus:ring-gray-900 outline-none transition-shadow"
                  >
                    <option value="Inter">Inter (Clean)</option>
                    <option value="Geist">Geist (Modern)</option>
                    <option value="Space Grotesk">Space Grotesk (Tech)</option>
                    <option value="Playfair Display">Playfair (Serif)</option>
                    <option value="DM Sans">DM Sans (Friendly)</option>
                    <option value="Poppins">Poppins (Geometric)</option>
                    <option value="Sora">Sora (Minimal)</option>
                    <option value="Outfit">Outfit (Versatile)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-gray-500">Type Scale</label>
                  <PresetToggle
                    options={[
                      { label: "Compact", value: "compact" },
                      { label: "Default", value: "default" },
                      { label: "Large", value: "large" },
                    ]}
                    current={detectTypeScale(t)}
                    onChange={(v) => updateTypeScale(v as keyof typeof TYPE_SCALE_PRESETS)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-gray-500">Heading Weight</label>
                  <PresetToggle
                    options={[
                      { label: "Light", value: "light" },
                      { label: "Medium", value: "medium" },
                      { label: "Bold", value: "bold" },
                    ]}
                    current={detectHeadingWeight(t)}
                    onChange={(v) => updateHeadingWeight(v as keyof typeof HEADING_WEIGHT_PRESETS)}
                  />
                </div>
              </div>
            )}

            {/* ============ LAYOUT & SPACING ============ */}
            <SectionHeader icon={Layers} label="Layout & Spacing" sectionKey="layout" expanded={expandedSections.layout} onToggle={toggleSection} />
            {expandedSections.layout && (
              <div className="px-5 md:px-6 pb-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-gray-500">Density</label>
                  <PresetToggle
                    options={[
                      { label: "Compact", value: "compact" },
                      { label: "Comfortable", value: "comfortable" },
                      { label: "Spacious", value: "spacious" },
                    ]}
                    current={detectDensity(t)}
                    onChange={(v) => updateDensity(v as keyof typeof DENSITY_PRESETS)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-gray-500 flex items-center gap-1"><MousePointerClick className="w-3 h-3" /> Touch Targets</label>
                  <PresetToggle
                    options={[
                      { label: "Standard (48)", value: "standard" },
                      { label: "Large (56)", value: "large" },
                    ]}
                    current={detectTouchTarget(t)}
                    onChange={(v) => updateTouchTargets(v as keyof typeof TOUCH_TARGET_PRESETS)}
                  />
                </div>
              </div>
            )}

            {/* ============ SHAPE & ELEVATION ============ */}
            <SectionHeader icon={Square} label="Shape & Elevation" sectionKey="shape" expanded={expandedSections.shape} onToggle={toggleSection} />
            {expandedSections.shape && (
              <div className="px-5 md:px-6 pb-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-gray-500">Corners</label>
                  <PresetToggle
                    options={[
                      { label: "Sharp", value: "sharp" },
                      { label: "Round", value: "round" },
                      { label: "Soft", value: "soft" },
                    ]}
                    current={detectRadiusPreset(t)}
                    onChange={(v) => {
                      if (v === "sharp") updateAllRadii("0px");
                      else if (v === "round") updateAllRadii("8px");
                      else updateAllRadii("16px");
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-gray-500 flex items-center gap-1"><SunMedium className="w-3 h-3" /> Shadow Depth</label>
                  <PresetToggle
                    options={[
                      { label: "Flat", value: "flat" },
                      { label: "Subtle", value: "subtle" },
                      { label: "Elevated", value: "elevated" },
                    ]}
                    current={detectShadowDepth(t)}
                    onChange={(v) => updateShadowDepth(v as keyof typeof SHADOW_PRESETS)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-gray-500">Border Width</label>
                  <PresetToggle
                    options={[
                      { label: "None", value: "none" },
                      { label: "Hairline", value: "hairline" },
                      { label: "Bold", value: "bold" },
                    ]}
                    current={detectBorderStyle(t)}
                    onChange={(v) => updateBorderStyle(v as keyof typeof BORDER_STYLE_PRESETS)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Sticky footer */}
          <div className="p-4 md:p-6 border-t border-gray-100 bg-white mt-auto sticky bottom-0">
            <Button onClick={handleBuild} className="w-full h-10 text-sm font-medium">
              Save & Build <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </div>
        </div>

        {/* ============ RIGHT SIDE: PREVIEW ============ */}
        <div className="hidden md:flex w-[55%] items-center justify-center bg-gray-50/50 p-8 relative shrink-0">
          <div
            className="w-[280px] h-[580px] shadow-sm ring-1 ring-gray-200 relative overflow-hidden flex flex-col transition-all duration-300"
            style={{
              backgroundColor: primaryBg,
              color: primaryText,
              fontFamily,
              borderRadius: "24px",
            }}
          >
            {/* Status bar placeholder */}
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <div className="w-7 h-7 rounded-full" style={{ backgroundColor: secondaryBg, border: `${borderHairline} solid ${borderDivider}` }} />
              <div className="w-7 h-7 rounded-sm opacity-80" style={{ backgroundColor: actionPrimary, borderRadius: t.radii?.sm || "4px" }} />
            </div>

            <div className="flex-1 px-5 pb-5 flex flex-col overflow-hidden">
              {/* Title block */}
              <h1
                className="tracking-tight mb-0.5"
                style={{
                  color: primaryText,
                  fontSize: t.typography?.title_main?.size || "28px",
                  fontWeight: Number(t.typography?.title_main?.weight ?? 700),
                  lineHeight: t.typography?.title_main?.line_height || "32px",
                }}
              >
                Preview
              </h1>
              <p
                className="mb-4"
                style={{
                  color: mediumText,
                  fontSize: t.typography?.body_secondary?.size || "14px",
                  lineHeight: t.typography?.body_secondary?.line_height || "20px",
                }}
              >
                Live design token preview
              </p>

              {/* Divider */}
              <div className="mb-4" style={{ borderBottom: `${borderHairline} solid ${borderDivider}` }} />

              {/* Card 1: text hierarchy */}
              <div
                className="p-3 mb-3"
                style={{
                  backgroundColor: cardBg,
                  borderRadius: radiusLg,
                  boxShadow: shadowMd,
                  border: `${borderHairline} solid ${borderDivider}`,
                }}
              >
                <div
                  className="mb-1 font-semibold"
                  style={{
                    fontSize: t.typography?.body_primary?.size || "16px",
                    lineHeight: t.typography?.body_primary?.line_height || "24px",
                    color: primaryText,
                  }}
                >
                  Card Title
                </div>
                <div
                  style={{
                    fontSize: t.typography?.body_secondary?.size || "14px",
                    lineHeight: t.typography?.body_secondary?.line_height || "20px",
                    color: mediumText,
                  }}
                >
                  Body text in medium emphasis
                </div>
                <div
                  className="mt-1"
                  style={{
                    fontSize: t.typography?.caption?.size || "12px",
                    lineHeight: t.typography?.caption?.line_height || "16px",
                    color: lowText,
                  }}
                >
                  Caption in low emphasis
                </div>
              </div>

              {/* Card 2: list item with avatar */}
              <div
                className="p-3 mb-3 flex items-center gap-3"
                style={{
                  backgroundColor: cardBg,
                  borderRadius: radiusLg,
                  boxShadow: shadowMd,
                  border: `${borderHairline} solid ${borderDivider}`,
                }}
              >
                <div className="w-10 h-10 rounded-full shrink-0" style={{ backgroundColor: actionPrimary, opacity: 0.15 }} />
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="font-medium text-sm truncate" style={{ color: primaryText }}>
                    List Item
                  </div>
                  <div style={{ fontSize: t.typography?.caption?.size || "12px", color: lowText }}>
                    Supporting text
                  </div>
                </div>
                <div className="w-6 h-6 rounded-full" style={{ backgroundColor: actionSecondary, opacity: 0.12 }} />
              </div>

              {/* Input field */}
              <div
                className="px-3 mb-4 flex items-center"
                style={{
                  backgroundColor: secondaryBg,
                  borderRadius: radius,
                  border: `${borderHairline} solid ${borderDivider}`,
                  height: t.sizing?.standard_input_height || "48px",
                }}
              >
                <span style={{ fontSize: t.typography?.body_secondary?.size || "14px", color: lowText }}>
                  Search...
                </span>
              </div>

              {/* Spacer */}
              <div className="flex-1" />

              {/* CTA button */}
              <button
                className="w-full flex justify-center items-center gap-2 transition-all active:scale-95"
                style={{
                  backgroundColor: actionPrimary,
                  color: actionText,
                  borderRadius: radiusLg,
                  height: t.sizing?.standard_button_height || "48px",
                  fontSize: t.typography?.button_label?.size || "16px",
                  fontWeight: Number(t.typography?.button_label?.weight ?? 600),
                }}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionHeader({
  icon: Icon,
  label,
  sectionKey,
  expanded,
  onToggle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  sectionKey: string;
  expanded: boolean;
  onToggle: (key: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(sectionKey)}
      className="w-full flex items-center justify-between px-5 md:px-6 py-3 hover:bg-gray-50 transition-colors"
    >
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5" /> {label}
      </span>
      <ChevronDown
        className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
      />
    </button>
  );
}

function SubGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">{label}</span>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{children}</div>
    </div>
  );
}

function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const safeHex = value.length === 7 ? value : value.length === 4 ? `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}` : "#000000";
  return (
    <div className="flex flex-col gap-1 w-full relative group">
      <label className="text-[11px] font-medium text-gray-500">{label}</label>
      <div className="relative flex items-center bg-gray-50 border border-gray-200 rounded-md p-1 pr-2 transition-all hover:border-gray-300 focus-within:ring-1 focus-within:ring-gray-900 focus-within:bg-white overflow-hidden">
        <input
          type="color"
          value={safeHex}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 w-[200%] h-[200%] -top-2 -left-2 opacity-0 cursor-pointer"
        />
        <div className="w-5 h-5 rounded-[4px] border border-black/10 shrink-0 shadow-sm pointer-events-none" style={{ backgroundColor: value }} />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full text-xs font-mono font-medium text-gray-900 outline-none uppercase bg-transparent ml-2"
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
  options: { label: string; value: string }[];
  current: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex bg-gray-50 rounded-md p-1 border border-gray-200">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`flex-1 py-1.5 text-xs font-medium rounded-[4px] transition-all ${
            current === opt.value
              ? "bg-white text-gray-900 shadow-sm ring-1 ring-gray-200"
              : "text-gray-500 hover:text-gray-900"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
