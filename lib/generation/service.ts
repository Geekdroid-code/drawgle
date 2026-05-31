import "server-only";

import { z } from "zod";

import { createGeminiClient } from "@/lib/ai/gemini";
import { geminiPolicyForTask } from "@/lib/ai/model-policy";
import { hasApprovedDesignTokens, normalizeDesignTokens } from "@/lib/design-tokens";
import { applyEdits } from "@/lib/diff-engine";
import { buildScopedEditContext } from "@/lib/generation/block-index";
import { formatDesignStyleContract, getDesignStylePack, summarizeDesignStyle } from "@/lib/generation/design-styles";
import { createNavigationArchitecture, deriveRequiresBottomNav, resolveScreenChromePolicy } from "@/lib/navigation";
import {
  applyNavigationPlanToScreens,
  normalizeNavigationPlan,
  renderDeterministicNavigationShell,
  validateNavigationShell,
} from "@/lib/project-navigation";
import {
  buildRecreateScreenInstruction,
  buildStyleScreenInstruction,
  buildEditSystemInstruction,
  creativeDirectionInstruction,
  designInstruction,
  plannerBlueprintStepInstruction,
  plannerScreenBriefStepInstruction,
  referenceAnalysisRecreateInstruction,
  referenceAnalysisStyleInstruction,
} from "@/lib/generation/prompts";
import { appendRequiredAnchors, DRAWGLE_GENERATION_COMPLETE_SENTINEL, extractRequiredAnchors, stripGenerationCompleteSentinel, validateSourceCompletion } from "@/lib/generation/screen-quality";
import { buildRepairSurroundingContext, type RepairTarget } from "@/lib/generation/screen-repair";
import { buildTokenPromptContext } from "@/lib/token-runtime";
import type {
  BuildScreenInput,
  LlmInputSnapshot,
  LlmLogFn,
  CreativeDirection,
  DesignStylePack,
  DesignTokenMetadata,
  DesignTokenValues,
  DesignTokens,
  JsonValue,
  Message,
  GenerationIntentContract,
  NavigationArchitecture,
  NavigationPlan,
  PlanningMode,
  PlannedUiFlow,
  PromptImagePayload,
  ProjectCharter,
  ReferenceMode,
  ScreenCountContract,
  ScreenCountEnforcement,
  ScreenFamilyContract,
  ScreenBlockIndex,
  ScreenPlan,
} from "@/lib/types";

const normalizeScreenType = (value: unknown) => {
  if (value === undefined || value === null || value === "") {
    return "detail";
  }

  if (typeof value !== "string") {
    return value;
  }

  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (["root", "home", "dashboard", "main", "primary", "tab", "tabs", "section", "peer"].includes(normalized)) {
    return "root";
  }

  return "detail";
};

const ScreenTypeSchema = z.preprocess(normalizeScreenType, z.enum(["root", "detail"])).default("detail");

const SCREEN_CHROME_KINDS = ["bottom-tabs", "top-bar", "top-bar-back", "modal-sheet", "immersive"] as const;

const normalizeChromeKind = (value: unknown) => {
  if (value === undefined || value === null || value === "") {
    return "top-bar";
  }

  if (typeof value !== "string") {
    return value;
  }

  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

  if (/(bottom|tab)/.test(normalized)) return "bottom-tabs";
  if (/(back|detail|return)/.test(normalized)) return "top-bar-back";
  if (/(modal|sheet|drawer)/.test(normalized)) return "modal-sheet";
  if (/(immersive|full-screen|fullscreen|splash|onboarding|cover|hero)/.test(normalized)) return "immersive";
  if (/(top|header|nav-bar|navbar)/.test(normalized)) return "top-bar";

  return "top-bar";
};

const ScreenChromeKindSchema = z.preprocess(normalizeChromeKind, z.enum(SCREEN_CHROME_KINDS));

const normalizeNavigationArchitectureKind = (value: unknown) => {
  if (value === undefined || value === null || value === "") {
    return "hierarchical";
  }

  if (typeof value !== "string") {
    return value;
  }

  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  if (/(bottom|tab|root|peer|multi)/.test(normalized)) return "bottom-tabs-app";
  if (/(single|one|standalone)/.test(normalized)) return "single-screen";
  return "hierarchical";
};

const NavigationArchitectureKindSchema = z.preprocess(
  normalizeNavigationArchitectureKind,
  z.enum(["bottom-tabs-app", "hierarchical", "single-screen"]),
);

const normalizePrimaryNavigation = (value: unknown) => {
  if (typeof value !== "string") {
    return value ?? "none";
  }

  return /(bottom|tab)/i.test(value) ? "bottom-tabs" : "none";
};

const PrimaryNavigationSchema = z.preprocess(normalizePrimaryNavigation, z.enum(["bottom-tabs", "none"]).default("none"));

const normalizeNavigationPlanKind = (value: unknown) => {
  if (typeof value !== "string") {
    return value ?? "none";
  }

  return /(bottom|tab)/i.test(value) ? "bottom-tabs" : "none";
};

const NavigationPlanKindSchema = z.preprocess(normalizeNavigationPlanKind, z.enum(["bottom-tabs", "none"]));

const coerceBooleanish = (value: unknown): boolean | null => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (["true", "yes", "1", "enabled", "on"].includes(normalized)) return true;
  if (["false", "no", "0", "disabled", "off", "none"].includes(normalized)) return false;
  return null;
};

const BooleanishSchema = z.preprocess((value) => {
  const coerced = coerceBooleanish(value);
  if (coerced !== null) {
    return coerced;
  }

  return value;
}, z.boolean());

const AssetNeedSourcePreferenceSchema = z.preprocess((value) => {
  if (value === "ai_generated") {
    return "internal_library";
  }
  return value;
}, z.enum(["user_upload", "internal_library", "stock"]));

const normalizeAssetType = (value: unknown) => {
  if (typeof value !== "string") return value;
  const v = value.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
  if (/(transparent|cutout|png|alpha)/.test(v)) return "transparent_png";
  if (/(photo|photograph|image|jpeg|jpg)/.test(v)) return "photo";
  if (/(illustr|drawing|artwork|vector)/.test(v)) return "illustration";
  if (/(icon|glyph|symbol|badge)/.test(v)) return "icon_like";
  return value;
};

const normalizeAssetPriority = (value: unknown) => {
  if (typeof value !== "string") return value;
  const v = value.toLowerCase().trim();
  if (/(critical|high|must|essential|required)/.test(v)) return "critical";
  if (/(support|medium|secondary|normal|default)/.test(v)) return "supporting";
  if (/(optional|low|nice|bonus)/.test(v)) return "optional";
  return value;
};

const normalizeAssetRole = (value: unknown) => {
  if (typeof value !== "string") return value;
  const v = value.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
  if (/(hero|hero_cutout)/.test(v)) return "hero_cutout";
  if (/(product_cutout|product_png)/.test(v)) return "product_cutout";
  if (/(avatar|profile_photo|profile_pic)/.test(v)) return "avatar";
  if (/(section_photo|section_image)/.test(v)) return "section_photo";
  if (/(background_photo|bg_photo|background_image)/.test(v)) return "background_photo";
  if (/(product_photo|product_image)/.test(v)) return "product_photo";
  if (/(decorative_object|decoration)/.test(v)) return "decorative_object";
  if (/(map|map_texture)/.test(v)) return "map_texture";
  return value;
};

const normalizeAspectRatio = (value: unknown) => {
  if (typeof value !== "string") return value;
  const v = value.toLowerCase().trim().replace(/\s+/g, "");
  if (v === "1:1" || v === "square") return "1:1";
  if (v === "4:5" || v === "portrait") return "4:5";
  if (v === "5:4") return "5:4";
  if (v === "16:9" || v === "widescreen" || v === "landscape") return "16:9";
  return "free";
};

const AssetNeedSchema = z.object({
  id: z.string().trim().min(1).max(80),
  screenName: z.string().trim().min(1).max(100).optional(),
  role: z.preprocess(normalizeAssetRole, z.enum([
    "hero_cutout",
    "product_cutout",
    "avatar",
    "section_photo",
    "background_photo",
    "product_photo",
    "decorative_object",
    "map_texture",
  ])),
  subject: z.string().trim().min(3).max(260),
  assetType: z.preprocess(normalizeAssetType, z.enum(["transparent_png", "photo", "illustration", "icon_like"])),
  sourcePreference: AssetNeedSourcePreferenceSchema,
  desiredAspectRatio: z.preprocess(normalizeAspectRatio, z.enum(["1:1", "4:5", "5:4", "16:9", "free"])),
  transparentBackground: z.boolean(),
  placementHint: z.string().trim().min(1).max(500),
  priority: z.preprocess(normalizeAssetPriority, z.enum(["critical", "supporting", "optional"])),
  reuseKey: z.string().trim().min(1).max(160).optional(),
  origin: z.enum(["reference_visible", "user_explicit", "planner_inferred", "heuristic_inferred"]).optional(),
});

const ScreenPlanSchema = z.object({
  name: z.string().trim().min(1).max(100),
  type: ScreenTypeSchema,
  description: z.string().trim().min(1).max(8000),
  chrome_policy: z.object({
    chrome: ScreenChromeKindSchema,
    show_primary_navigation: BooleanishSchema.optional(),
    shows_back_button: BooleanishSchema.optional(),
  }).optional(),
  asset_needs: z.array(AssetNeedSchema).max(4).default([]).optional(),
});

const NavigationArchitectureSchema = z.object({
  kind: NavigationArchitectureKindSchema,
  primary_navigation: PrimaryNavigationSchema,
  root_chrome: ScreenChromeKindSchema,
  detail_chrome: ScreenChromeKindSchema,
  consistency_rules: z.array(z.string().trim().min(1).max(500)).min(1).max(10),
  rationale: z.string().trim().min(1).max(2400),
});

const NavigationPlanSchema = z.object({
  enabled: BooleanishSchema,
  kind: NavigationPlanKindSchema,
  items: z.array(z.object({
    id: z.string().trim().min(1).max(80),
    label: z.string().trim().min(1).max(40),
    icon: z.string().trim().min(1).max(80),
    role: z.string().trim().min(1).max(240),
    linked_screen_name: z.string().trim().min(1).max(100),
  })).max(5).default([]),
  visual_brief: z.string().trim().min(1).max(1600),
  screen_chrome: z.array(z.object({
    screen_name: z.string().trim().min(1).max(100),
    chrome: ScreenChromeKindSchema,
    navigation_item_id: z.string().trim().min(1).max(80).nullable().optional(),
  })).default([]),
}).optional();
type ParsedNavigationPlan = NonNullable<z.infer<typeof NavigationPlanSchema>>;

const CreativeDirectionSchema = z.object({
  conceptName: z.string().trim().min(1).max(200),
  styleEssence: z.string().trim().min(1).max(2400),
  colorStory: z.string().trim().min(1).max(2400),
  typographyMood: z.string().trim().min(1).max(2400),
  surfaceLanguage: z.string().trim().min(1).max(2400),
  iconographyStyle: z.string().trim().min(1).max(2400),
  compositionPrinciples: z.array(z.string().trim().min(1).max(600)).min(1).max(10),
  signatureMoments: z.array(z.string().trim().min(1).max(600)).min(1).max(10),
  motionTone: z.string().trim().min(1).max(2400),
  avoid: z.array(z.string().trim().min(1).max(600)).min(1).max(12),
});

const PlanSchema = z.object({
  requires_bottom_nav: BooleanishSchema.optional(),
  navigation_architecture: NavigationArchitectureSchema.optional(),
  navigation_plan: NavigationPlanSchema,
  charter: z.object({
    originalPrompt: z.string().trim().min(1).max(10000),
    imageReferenceSummary: z.string().trim().max(6000).nullable().optional(),
    appType: z.string().trim().min(1).max(240),
    targetAudience: z.string().trim().min(1).max(800),
    navigationModel: z.string().trim().min(1).max(800),
    keyFeatures: z.array(z.string().trim().min(1).max(400)).min(1).max(20),
    designRationale: z.string().trim().min(1).max(8000),
    creativeDirection: CreativeDirectionSchema.nullable().optional(),
  }),
  screens: z.array(ScreenPlanSchema).min(1).max(12),
});

const ProjectBlueprintSchema = PlanSchema.omit({ screens: true });

const ScreenBriefsSchema = z.object({
  screens: z.array(ScreenPlanSchema).min(1).max(12),
});

const ReferenceScreenSchema = z.object({
  index: z.number().int().min(1).max(12),
  suggestedRole: z.string().trim().min(1).max(200),
  layoutSummary: z.string().trim().min(1).max(2500),
  visualHierarchy: z.string().trim().min(1).max(2500),
  components: z.array(z.string().trim().min(1).max(400)).min(1).max(20),
  stylingCues: z.array(z.string().trim().min(1).max(400)).min(1).max(20),
  interactionCues: z.array(z.string().trim().min(1).max(400)).max(20).default([]),
  copyPatterns: z.array(z.string().trim().min(1).max(400)).max(20).default([]),
  implementationNotes: z.array(z.string().trim().min(1).max(400)).max(20).default([]),
});

const ReferenceAnalysisSchema = z.object({
  overallVisualStyle: z.string().trim().min(1).max(3000),
  screenCountEstimate: z.number().int().min(1).max(12),
  screenReferences: z.array(ReferenceScreenSchema).min(1).max(12),
  designSystemSignals: z.object({
    palette: z.string().trim().min(1).max(1200),
    typography: z.string().trim().min(1).max(1200),
    surfaces: z.string().trim().min(1).max(1200),
    iconography: z.string().trim().min(1).max(1200),
    density: z.string().trim().min(1).max(1200),
    motionTone: z.string().trim().min(1).max(1200),
  }),
});

type ReferenceAnalysis = z.infer<typeof ReferenceAnalysisSchema>;
type ParsedCreativeDirection = z.infer<typeof CreativeDirectionSchema>;

const StringRecordSchema = z.record(z.string(), z.string());
const TypographyScaleSchema = z.object({
  size: z.string().optional(),
  weight: z.union([z.string(), z.number()]).optional(),
  line_height: z.string().optional(),
}).passthrough();

const DesignTokensSchema = z
  .object({
    system_schema: z.string().optional(),
    meta: z.object({
      recommendedFonts: z.array(z.string().trim().min(1).max(120)).max(8).optional(),
    }).partial().optional(),
    tokens: z.object({
      color: z.object({
        background: StringRecordSchema.optional(),
        surface: StringRecordSchema.optional(),
        text: StringRecordSchema.optional(),
        action: StringRecordSchema.optional(),
        border: StringRecordSchema.optional(),
      }).partial().passthrough().optional(),
      typography: z.object({
        font_family: z.string().optional(),
        nav_title: TypographyScaleSchema.optional(),
        screen_title: TypographyScaleSchema.optional(),
        hero_title: TypographyScaleSchema.optional(),
        section_title: TypographyScaleSchema.optional(),
        metric_value: TypographyScaleSchema.optional(),
        body: TypographyScaleSchema.optional(),
        supporting: TypographyScaleSchema.optional(),
        caption: TypographyScaleSchema.optional(),
        button_label: TypographyScaleSchema.optional(),
        title_large: TypographyScaleSchema.optional(),
        title_main: TypographyScaleSchema.optional(),
        body_primary: TypographyScaleSchema.optional(),
        body_secondary: TypographyScaleSchema.optional(),
      }).passthrough().optional(),
      spacing: StringRecordSchema.optional(),
      mobile_layout: StringRecordSchema.optional(),
      sizing: StringRecordSchema.optional(),
      radii: z.object({
        app: z.string().optional(),
        pill: z.string().optional(),
      }).passthrough().optional(),
      border_widths: z.object({
        standard: z.string().optional(),
      }).passthrough().optional(),
      shadows: z.object({
        none: z.string().optional(),
        surface: z.string().optional(),
        overlay: z.string().optional(),
      }).passthrough().optional(),
      elevation: StringRecordSchema.optional(),
      opacities: StringRecordSchema.optional(),
      z_index: StringRecordSchema.optional(),
    }).passthrough().optional(),
  })
  .passthrough();

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);

const buildApprovedDesignTokens = (candidate: unknown): DesignTokens => {
  if (!isRecord(candidate)) {
    throw new Error("Design generation did not return a valid mobile_universal_core token object.");
  }

  const next = normalizeDesignTokens(candidate as Partial<DesignTokens>);

  if (!hasApprovedDesignTokens(next)) {
    throw new Error("Design generation did not return a usable mobile_universal_core token set.");
  }

  return next;
};

const humanizeReferenceRole = (value: string, index: number) => {
  const cleaned = value
    .replace(/\b(screen|view|page|state)\b/gi, " ")
    .replace(/[^a-zA-Z0-9\s/-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return `Reference Screen ${index}`;
  }

  return cleaned.replace(/\b\w/g, (character) => character.toUpperCase());
};

const buildStructuredScreenDescription = (referenceScreen: ReferenceAnalysis["screenReferences"][number]) =>
  [
    `Visual Goal: ${referenceScreen.suggestedRole}.`,
    `Layout: ${referenceScreen.layoutSummary}`,
    `Hierarchy: ${referenceScreen.visualHierarchy}`,
    `Key Components: ${referenceScreen.components.join("; ")}`,
    referenceScreen.stylingCues.length > 0 ? `Visual Styling: ${referenceScreen.stylingCues.join("; ")}` : null,
    referenceScreen.interactionCues.length > 0 ? `Interaction Notes: ${referenceScreen.interactionCues.join("; ")}` : null,
    referenceScreen.copyPatterns.length > 0 ? `Copy / Typography Anchors: ${referenceScreen.copyPatterns.join("; ")}` : null,
    referenceScreen.implementationNotes.length > 0 ? `Must-Preserve Details: ${referenceScreen.implementationNotes.join("; ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");

const fallbackCreativeDirection = ({
  prompt,
  referenceAnalysis,
}: {
  prompt: string;
  referenceAnalysis?: ReferenceAnalysis | null;
}): CreativeDirection => ({
  conceptName: referenceAnalysis ? "Reference-Led Premium Precision" : "Premium Mobile Signature",
  styleEssence: referenceAnalysis
    ? `Translate the observed reference into a refined product system without flattening its strongest spatial ideas. ${referenceAnalysis.overallVisualStyle}`
    : `Create a premium mobile product identity from the brief alone: clear hierarchy, restrained surfaces, and one memorable focal move per screen for "${prompt.trim() || "the product"}".`,
  colorStory: referenceAnalysis?.designSystemSignals.palette
    ?? "Use a disciplined neutral base, one assertive primary accent, and selective color contrast to guide hierarchy instead of filling every region with color.",
  typographyMood: referenceAnalysis?.designSystemSignals.typography
    ?? "Use confident hierarchy with contrast between oversized focal headings and restrained supporting copy. Avoid bland enterprise defaults.",
  surfaceLanguage: referenceAnalysis?.designSystemSignals.surfaces
    ?? "Layer cards, sheets, and background regions deliberately. Surfaces should feel tactile and premium rather than like repeated template blocks.",
  iconographyStyle: referenceAnalysis?.designSystemSignals.iconography
    ?? "Use clean, slightly bold iconography with strong framing and purposeful circular or pill containers when emphasis is needed.",
  compositionPrinciples: [
    "Give each screen a clear focal hierarchy with one dominant anchor before secondary information.",
    "Use asymmetry, overlap, floating surfaces, or sculpted grouping when it improves memorability and clarity.",
    "Let whitespace and scale do real design work instead of filling the screen with repeated widgets.",
  ],
  signatureMoments: (() => {
    const referenceMoments = referenceAnalysis
      ? referenceAnalysis.screenReferences.flatMap((screen) => screen.implementationNotes).slice(0, 4)
      : [];

    if (referenceMoments.length >= 2) {
      return referenceMoments;
    }

    return [
      ...referenceMoments,
      "Use at least one standout composition move per primary screen, such as a sculpted hero, floating metric slab, oversized title block, or layered bottom sheet.",
      "Make the primary action feel designed, not default: custom pill CTA, anchored control bar, or expressive segmented control.",
    ].slice(0, 4);
  })(),
  motionTone: referenceAnalysis?.designSystemSignals.motionTone
    ?? "Motion should feel polished, deliberate, and tactile rather than bouncy or ornamental.",
  avoid: [
    "Do not default to generic evenly stacked white cards with interchangeable stats.",
    "Do not rely on bland gray-on-white enterprise dashboard patterns unless the brief explicitly demands them.",
    "Do not make every screen symmetrical if the product would benefit from stronger visual tension and hierarchy.",
  ],
});

const fallbackScreenPlan = (prompt: string): ScreenPlan => ({
  name: "New Screen",
  type: "root",
  description: prompt.trim() || "Convert this concept into a polished mobile screen.",
});

const inferLegacyRequiresBottomNav = ({
  prompt,
  planningMode,
  referenceAnalysis,
}: {
  prompt: string;
  planningMode: PlanningMode;
  referenceAnalysis?: ReferenceAnalysis | null;
}) => {
  if (planningMode === "single-screen") {
    return false;
  }

  const normalizedPrompt = prompt.trim().toLowerCase();

  if (/(\btab\b|bottom nav|bottom navigation)/i.test(normalizedPrompt)) {
    return true;
  }

  if (referenceAnalysis && referenceAnalysis.screenCountEstimate >= 4) {
    return true;
  }

  return /(marketplace|delivery|commerce|shopping|social|feed|discover|orders|wallet|library|travel|booking|ride|food)/i.test(normalizedPrompt);
};

type ExplicitScreenSection = {
  index: number;
  name: string;
  description: string;
  anchors: string[];
};

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
};

const normalizeScreenName = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\b(screen|page|view|the)\b/g, " ").replace(/\s+/g, " ").trim();

const parseRequestedScreenCount = (prompt: string) => {
  const numeric = prompt.match(/\b(?:generate|create|build|make|design)?\s*(?:these\s+|all\s+|the\s+)*(\d{1,2})\b(?:\s+\w+){0,8}\s+(?:screen|screens|page|pages)\b/i);
  if (numeric) {
    return Number(numeric[1]);
  }

  const word = prompt.match(/\b(one|two|three|four|five|six|seven|eight)\b(?:\s+\w+){0,8}\s+(?:screen|screens|page|pages)\b/i);
  if (word) {
    return NUMBER_WORDS[word[1].toLowerCase()] ?? null;
  }

  return null;
};

const stripGlobalNavigationBrief = (sectionText: string) => {
  const globalNavMatch = sectionText.match(
    /(?:^|\n)\s*(?:Bottom\s+Navigation|Shared\s+Navigation|Persistent\s+Navigation|Navigation\s+Shell|Primary\s+Navigation)\b/i,
  );

  if (!globalNavMatch || typeof globalNavMatch.index !== "number") {
    return sectionText;
  }

  return sectionText.slice(0, globalNavMatch.index).trim();
};

const parseExplicitScreenSections = (prompt: string): ExplicitScreenSection[] => {
  const matches = Array.from(prompt.matchAll(/(?:^|\n)\s*Screen\s+(\d{1,2})\s*:\s*([^\n.]+?)(?:\.|\n|$)/gi));
  if (matches.length === 0) {
    return [];
  }

  return matches.map((match, index) => {
    const nextMatch = matches[index + 1];
    const start = match.index ?? 0;
    const end = nextMatch?.index ?? prompt.length;
    const sectionText = stripGlobalNavigationBrief(prompt.slice(start, end).trim());
    const rawName = (match[2] ?? `Screen ${match[1]}`).trim().replace(/^The\s+/i, "");

    return {
      index: Number(match[1]),
      name: rawName.slice(0, 100),
      description: sectionText.slice(0, 7000),
      anchors: extractRequiredAnchors(sectionText),
    };
  });
};

const hasExplicitNavigationRequest = (prompt: string) =>
  /\b(bottom\s+nav|bottom\s+navigation|tab\s+bar|tabs?|persistent\s+nav|primary\s+nav)\b/i.test(prompt);

const looksLikeFiniteFlowWithoutPersistentNav = (prompt: string, sections: ExplicitScreenSection[]) => {
  if (sections.length < 2 || hasExplicitNavigationRequest(prompt)) {
    return false;
  }

  const combined = `${prompt} ${sections.map((section) => section.name).join(" ")}`;
  return /\b(onboarding|splash|welcome|login|sign\s*up|checkout|tracking|map|detail|modal|flow)\b/i.test(combined);
};

const explicitSectionChromePolicy = (section: ExplicitScreenSection, index: number, forceNoPersistentNav: boolean): ScreenPlan["chromePolicy"] => {
  const nameAndBrief = `${section.name} ${section.description}`;

  if (/\b(onboarding|splash|welcome|hero)\b/i.test(nameAndBrief)) {
    return { chrome: "immersive", showPrimaryNavigation: false, showsBackButton: false };
  }

  if (/\b(tracking|map|detail|checkout|summary|confirmation|modal)\b/i.test(nameAndBrief)) {
    return { chrome: "top-bar-back", showPrimaryNavigation: false, showsBackButton: true };
  }

  if (forceNoPersistentNav) {
    return { chrome: index === 0 ? "immersive" : "top-bar", showPrimaryNavigation: false, showsBackButton: false };
  }

  return undefined;
};

const screenMatchesSection = (screen: ScreenPlan, section: ExplicitScreenSection) => {
  const screenName = normalizeScreenName(screen.name);
  const sectionName = normalizeScreenName(section.name);
  if (!screenName || !sectionName) {
    return false;
  }

  return screenName.includes(sectionName) || sectionName.includes(screenName);
};

const screenPlanFromExplicitSection = (
  section: ExplicitScreenSection,
  index: number,
  forceNoPersistentNav: boolean,
  existing?: ScreenPlan,
): ScreenPlan => {
  const baseDescription = [
    `Explicit user-requested screen ${section.index}: ${section.name}.`,
    section.description,
    existing?.description ? `Planner enhancement:\n${existing.description}` : null,
  ].filter(Boolean).join("\n\n").slice(0, 7800);

  return {
    name: existing?.name?.trim() || section.name,
    type: existing?.type ?? (index === 0 && !/\b(onboarding|splash|welcome)\b/i.test(section.name) ? "root" : "detail"),
    description: appendRequiredAnchors(baseDescription, section.anchors),
    assetNeeds: existing?.assetNeeds ?? [],
    chromePolicy: explicitSectionChromePolicy(section, index, forceNoPersistentNav) ?? existing?.chromePolicy ?? null,
  };
};

const clampScreenCount = (value: number | null | undefined) => {
  if (!Number.isFinite(value ?? NaN)) {
    return null;
  }

  return Math.min(12, Math.max(1, Math.round(value as number)));
};

const INITIAL_PROJECT_SCREEN_LIMIT = 5;

const hasFullAppIntent = (prompt: string) =>
  /\b(?:full|complete|entire|whole)\s+(?:app|application|product|prototype)\b/i.test(prompt) ||
  /\b(?:multi[-\s]?screen|app\s+flow|prototype|full\s+flow|multiple\s+screens)\b/i.test(prompt) ||
  /\b(?:create|build|design|make)\s+(?:an?\s+)?(?:mobile\s+)?(?:app|application|product)\b/i.test(prompt);

const compileGenerationIntentContract = ({
  prompt,
  planningMode,
  referenceMode,
  referenceAnalysis,
  explicitScreenSections,
  requestedScreenCount,
}: {
  prompt: string;
  planningMode: PlanningMode;
  referenceMode: ReferenceMode;
  referenceAnalysis: ReferenceAnalysis | null;
  explicitScreenSections: ExplicitScreenSection[];
  requestedScreenCount: number | null;
}): GenerationIntentContract => {
  const explicitCount = clampScreenCount(requestedScreenCount) ?? (
    explicitScreenSections.length > 0 ? clampScreenCount(explicitScreenSections.length) : null
  );
  const referenceScreenCount = clampScreenCount(referenceAnalysis?.screenCountEstimate);
  const explicitMultiScreen = Boolean(explicitCount && explicitCount > 1);
  const fullAppRequested = hasFullAppIntent(prompt) || explicitMultiScreen;

  if (planningMode === "single-screen") {
    return {
      kind: "add_screen",
      source: "planning_mode",
      reason: "Single-screen planning mode queues exactly one additional screen.",
      exactScreenCount: 1,
      maxInitialScreens: 1,
      explicitScreenCount: explicitCount,
      referenceScreenCount,
      allowSharedNavigation: true,
      visibleNavigationHandling: "shared_navigation",
    };
  }

  if (referenceMode === "user_recreate" && !fullAppRequested) {
    const exactScreenCount = explicitCount ?? referenceScreenCount ?? 1;
    return {
      kind: "exact_recreate",
      source: explicitCount ? "prompt" : "reference_image",
      reason: explicitCount
        ? `The user explicitly requested ${explicitCount} screen${explicitCount === 1 ? "" : "s"} while recreating the uploaded reference.`
        : referenceScreenCount
          ? `The uploaded reference appears to contain ${referenceScreenCount} visible screen${referenceScreenCount === 1 ? "" : "s"}.`
          : "The user asked to recreate the uploaded reference, so uncertain reference count defaults to one visible screen.",
      exactScreenCount,
      maxInitialScreens: exactScreenCount,
      explicitScreenCount: explicitCount,
      referenceScreenCount,
      allowSharedNavigation: exactScreenCount > 1 && hasExplicitNavigationRequest(prompt),
      visibleNavigationHandling: "inline_static_chrome",
    };
  }

  if (fullAppRequested) {
    return {
      kind: "full_app",
      source: explicitCount ? "prompt" : "prompt",
      reason: explicitCount
        ? `The user requested a multi-screen app with ${explicitCount} screen${explicitCount === 1 ? "" : "s"}.`
        : `The user asked for a full app/product experience; initial generation is capped at ${INITIAL_PROJECT_SCREEN_LIMIT} screens.`,
      exactScreenCount: explicitCount ? Math.min(explicitCount, INITIAL_PROJECT_SCREEN_LIMIT) : null,
      maxInitialScreens: INITIAL_PROJECT_SCREEN_LIMIT,
      explicitScreenCount: explicitCount,
      referenceScreenCount,
      allowSharedNavigation: true,
      visibleNavigationHandling: "shared_navigation",
    };
  }

  return {
    kind: "style_reference_app",
    source: referenceMode === "user_style" || referenceMode === "curated_style" ? "image_reference_mode" : "prompt",
    reason: `No exact recreate contract was detected; initial app planning is capped at ${INITIAL_PROJECT_SCREEN_LIMIT} screens.`,
    exactScreenCount: explicitCount,
    maxInitialScreens: INITIAL_PROJECT_SCREEN_LIMIT,
    explicitScreenCount: explicitCount,
    referenceScreenCount,
    allowSharedNavigation: true,
    visibleNavigationHandling: "shared_navigation",
  };
};

const buildScreenCountContract = ({
  intentContract,
  explicitScreenSections,
}: {
  intentContract: GenerationIntentContract;
  explicitScreenSections: ExplicitScreenSection[];
}): ScreenCountContract => {
  if (intentContract.exactScreenCount) {
    const source: ScreenCountContract["source"] =
      intentContract.kind === "add_screen"
        ? "planning_mode"
        : intentContract.explicitScreenCount
          ? explicitScreenSections.length > 0 ? "named_screens" : "prompt_count"
          : intentContract.source === "reference_image" ? "reference_image" : "open_project";

    return {
      exactCount: intentContract.exactScreenCount,
      source,
      reason: intentContract.reason,
      namedScreens: explicitScreenSections.map((section) => section.name),
      referenceScreenCount: intentContract.referenceScreenCount,
      disableSharedNavigation: !intentContract.allowSharedNavigation,
      maxScreens: intentContract.maxInitialScreens ?? null,
    };
  }

  return {
    exactCount: null,
    source: "open_project",
    reason: intentContract.reason,
    referenceScreenCount: intentContract.referenceScreenCount,
    disableSharedNavigation: !intentContract.allowSharedNavigation,
    maxScreens: intentContract.maxInitialScreens ?? null,
  };
};

const formatScreenCountContract = (contract: ScreenCountContract) => {
  const lines = [
    "Screen count contract:",
    contract.exactCount
      ? `- Return exactly ${contract.exactCount} screen${contract.exactCount === 1 ? "" : "s"}.`
      : "- Screen count is open; choose only the screens genuinely needed by the app brief.",
    `- Authority: ${contract.source}. ${contract.reason}`,
    contract.namedScreens?.length
      ? `- Named screens to preserve when possible: ${contract.namedScreens.join(", ")}.`
      : null,
    contract.disableSharedNavigation
      ? "- Shared project navigation is disabled for this run. If the reference has visible tabs, treat them as static visual chrome inside the planned screen, not as extra screens."
      : "- Navigation must not create additional screens beyond this contract.",
    !contract.exactCount && contract.maxScreens
      ? `- Return no more than ${contract.maxScreens} screen${contract.maxScreens === 1 ? "" : "s"} for this initial generation.`
      : null,
  ].filter(Boolean);

  return lines.join("\n");
};

const screenCountContractJson = (contract: ScreenCountContract): JsonValue => ({
  exactCount: contract.exactCount,
  source: contract.source,
  reason: contract.reason,
  namedScreens: contract.namedScreens ?? [],
  referenceScreenCount: contract.referenceScreenCount ?? null,
  disableSharedNavigation: Boolean(contract.disableSharedNavigation),
  maxScreens: contract.maxScreens ?? null,
});

const intentContractJson = (contract: GenerationIntentContract): JsonValue => ({
  kind: contract.kind,
  source: contract.source,
  reason: contract.reason,
  exactScreenCount: contract.exactScreenCount ?? null,
  maxInitialScreens: contract.maxInitialScreens ?? null,
  explicitScreenCount: contract.explicitScreenCount ?? null,
  referenceScreenCount: contract.referenceScreenCount ?? null,
  allowSharedNavigation: contract.allowSharedNavigation,
  visibleNavigationHandling: contract.visibleNavigationHandling,
});

const buildScreenFamilyContract = ({
  referenceAnalysis,
  creativeDirection,
  designTokens,
  designStyle,
  intentContract,
}: {
  referenceAnalysis: ReferenceAnalysis | null;
  creativeDirection?: CreativeDirection | null;
  designTokens?: DesignTokens | null;
  designStyle?: DesignStylePack | null;
  intentContract: GenerationIntentContract;
}): ScreenFamilyContract => {
  const tokenColor = designTokens?.tokens?.color;
  const tokenRadius = designTokens?.tokens?.radii;
  const signals = referenceAnalysis?.designSystemSignals;
  const styleRules = designStyle
    ? [
        ...designStyle.layoutGrammar.slice(0, 3),
        ...designStyle.componentRecipes.slice(0, 3),
        ...designStyle.densityRules.slice(0, 2),
      ]
    : [];
  return {
    summary: designStyle
      ? `${designStyle.label}: ${designStyle.premiumIntent}`
      : creativeDirection?.styleEssence ?? referenceAnalysis?.overallVisualStyle ?? "Maintain one coherent mobile product visual system across all generated screens.",
    surfaces: signals?.surfaces ?? designStyle?.creativeDirectionSeed.surfaceLanguage ?? [
      tokenColor?.surface?.card ? `Use card surfaces from approved tokens such as ${tokenColor.surface.card}.` : "Use one shared card/surface language.",
      tokenRadius?.app ? `Preserve the approved app radius ${tokenRadius.app}.` : "Keep radius, shadow, border, and elevation consistent across screens.",
    ].join(" "),
    typography: signals?.typography ?? designStyle?.creativeDirectionSeed.typographyMood ?? "Use the same type scale, weight rhythm, label casing, and hierarchy across every screen.",
    spacing: signals?.density ?? designStyle?.densityRules.join(" ") ?? "Keep screen-edge padding, card padding, vertical rhythm, and grid gaps consistent with the reference/design tokens.",
    navigation: intentContract.visibleNavigationHandling === "inline_static_chrome"
      ? "Visible navigation from a one-screen recreate reference is static visual chrome inside that screen, not shared project navigation."
      : designStyle?.navigationRecipes.join(" ") ?? "Shared navigation, when present, is derived from the approved screen slate and must not create additional screens.",
    imagery: designStyle?.assetAndImageryRules.join(" ") ?? "Use bitmap imagery only when it is visible in the reference, explicitly requested, or truly required by the screen purpose; otherwise use CSS, icons, charts, and text structure.",
    consistencyRules: [
      ...styleRules,
      ...(creativeDirection?.compositionPrinciples ?? []).slice(0, 4),
      ...(referenceAnalysis?.screenReferences[0]?.stylingCues ?? []).slice(0, 3),
      "Every planned screen must look like it belongs to the same product family while keeping a screen-specific composition.",
    ].slice(0, 8),
  };
};

const formatScreenFamilyContract = (contract: ScreenFamilyContract) => [
  "Screen family contract:",
  `- Summary: ${contract.summary}`,
  `- Surfaces: ${contract.surfaces}`,
  `- Typography: ${contract.typography}`,
  `- Spacing: ${contract.spacing}`,
  `- Navigation: ${contract.navigation}`,
  `- Imagery: ${contract.imagery}`,
  contract.consistencyRules.length
    ? `- Consistency rules: ${contract.consistencyRules.join(" | ")}`
    : null,
].filter(Boolean).join("\n");

const normalizeScreenBriefsWithFamilyContract = ({
  screens,
  prompt,
  screenFamilyContract,
}: {
  screens: ScreenPlan[];
  prompt: string;
  screenFamilyContract: ScreenFamilyContract;
}) => screens.map((screen) => {
  const profileContext = /\b(profile|settings|account|user)\b/i.test(screen.name)
    ? [
        "Contextual profile/settings repair:",
        `This screen must serve the actual product requested by the user: "${prompt.trim().slice(0, 260) || "the app brief"}".`,
        "Avoid generic interchangeable settings filler. Use domain-specific rows, labels, badges, reminders, privacy/data controls, and account details that fit this product.",
      ].join("\n")
    : null;

  const familyAppendix = [
    "Shared product family requirements:",
    formatScreenFamilyContract(screenFamilyContract),
    profileContext,
  ].filter(Boolean).join("\n\n");

  if (screen.description.includes("Shared product family requirements:")) {
    return screen;
  }

  return {
    ...screen,
    description: `${screen.description}\n\n${familyAppendix}`.slice(0, 9000),
  };
});

const screenPlanFromReferenceScreen = ({
  referenceScreen,
  index,
  prompt,
}: {
  referenceScreen?: ReferenceAnalysis["screenReferences"][number];
  index: number;
  prompt: string;
}): ScreenPlan => {
  if (referenceScreen) {
    return {
      name: humanizeReferenceRole(referenceScreen.suggestedRole, referenceScreen.index),
      type: index === 0 ? "root" : "detail",
      description: buildStructuredScreenDescription(referenceScreen),
      assetNeeds: [],
    };
  }

  return {
    ...fallbackScreenPlan(prompt || `Screen ${index + 1}`),
    name: index === 0 ? "Home" : `Screen ${index + 1}`,
    type: index === 0 ? "root" : "detail",
  };
};

const enforceScreenCountContract = ({
  screens,
  contract,
  prompt,
  referenceAnalysis,
}: {
  screens: ScreenPlan[];
  contract: ScreenCountContract;
  prompt: string;
  referenceAnalysis: ReferenceAnalysis | null;
}): { screens: ScreenPlan[]; enforcement: ScreenCountEnforcement } => {
  const exactCount = contract.exactCount;
  if (!exactCount) {
    if (contract.maxScreens && screens.length > contract.maxScreens) {
      return { screens: screens.slice(0, contract.maxScreens), enforcement: "trimmed" };
    }
    return { screens, enforcement: "none" };
  }

  if (screens.length > exactCount) {
    return { screens: screens.slice(0, exactCount), enforcement: "trimmed" };
  }

  if (screens.length < exactCount) {
    const nextScreens = [...screens];
    for (let index = screens.length; index < exactCount; index++) {
      nextScreens.push(screenPlanFromReferenceScreen({
        referenceScreen: referenceAnalysis?.screenReferences[index],
        index,
        prompt,
      }));
    }
    return { screens: nextScreens, enforcement: "filled" };
  }

  return { screens, enforcement: "none" };
};

const reconcileScreensWithPrompt = ({
  prompt,
  screens,
  planningMode,
}: {
  prompt: string;
  screens: ScreenPlan[];
  planningMode: PlanningMode;
}) => {
  if (planningMode === "single-screen") {
    return screens.slice(0, 1);
  }

  const sections = parseExplicitScreenSections(prompt);
  const requestedCount = parseRequestedScreenCount(prompt);

  if (sections.length === 0) {
    return screens;
  }

  const forceNoPersistentNav = looksLikeFiniteFlowWithoutPersistentNav(prompt, sections);
  const reconciled = sections.map((section, index) => {
    const existing = screens.find((screen) => screenMatchesSection(screen, section));
    return screenPlanFromExplicitSection(section, index, forceNoPersistentNav, existing);
  });

  if (requestedCount && reconciled.length >= requestedCount) {
    return reconciled.slice(0, requestedCount);
  }

  const extras = screens.filter((screen) => !sections.some((section) => screenMatchesSection(screen, section)));
  return [...reconciled, ...extras].slice(0, requestedCount ?? 12);
};

const coerceNavigationArchitecture = ({
  parsedNavigationArchitecture,
  existingNavigationArchitecture,
  requiresBottomNav,
  lockToExistingArchitecture = false,
}: {
  parsedNavigationArchitecture?: z.infer<typeof NavigationArchitectureSchema> | null;
  existingNavigationArchitecture?: ProjectCharter["navigationArchitecture"];
  requiresBottomNav?: boolean;
  lockToExistingArchitecture?: boolean;
}): NavigationArchitecture => {
  if (lockToExistingArchitecture && existingNavigationArchitecture) {
    return createNavigationArchitecture({ navigationArchitecture: existingNavigationArchitecture });
  }

  const nextArchitecture = parsedNavigationArchitecture
    ? {
        kind: parsedNavigationArchitecture.kind,
        primaryNavigation: parsedNavigationArchitecture.primary_navigation,
        rootChrome: parsedNavigationArchitecture.root_chrome,
        detailChrome: parsedNavigationArchitecture.detail_chrome,
        consistencyRules: parsedNavigationArchitecture.consistency_rules,
        rationale: parsedNavigationArchitecture.rationale,
      }
    : existingNavigationArchitecture ?? null;

  return createNavigationArchitecture({
    navigationArchitecture: nextArchitecture,
    requiresBottomNav,
  });
};

const resolvePlannedScreen = ({
  screenPlan,
  navigationArchitecture,
}: {
  screenPlan: ScreenPlan;
  navigationArchitecture: NavigationArchitecture;
}): ScreenPlan => ({
  ...screenPlan,
  chromePolicy: resolveScreenChromePolicy({
    screenPlan,
    navigationArchitecture,
  }),
});

const toNavigationPlan = (parsed?: ParsedNavigationPlan | null): NavigationPlan | null => {
  if (!parsed) {
    return null;
  }

  return {
    enabled: parsed.enabled,
    kind: parsed.enabled ? parsed.kind : "none",
    items: parsed.items.map((item) => ({
      id: item.id,
      label: item.label,
      icon: item.icon,
      role: item.role,
      linkedScreenName: item.linked_screen_name,
    })),
    visualBrief: parsed.visual_brief,
    screenChrome: parsed.screen_chrome.map((entry) => ({
      screenName: entry.screen_name,
      chrome: entry.chrome,
      navigationItemId: entry.navigation_item_id ?? null,
    })),
  };
};

const fallbackScreensFromReference = ({
  prompt,
  planningMode,
  referenceAnalysis,
}: {
  prompt: string;
  planningMode: PlanningMode;
  referenceAnalysis: ReferenceAnalysis | null;
}) => {
  if (!referenceAnalysis || referenceAnalysis.screenReferences.length === 0) {
    return [fallbackScreenPlan(prompt)];
  }

  const screens = referenceAnalysis.screenReferences
    .slice(0, planningMode === "single-screen" ? 1 : 8)
    .map((referenceScreen, index) => ({
      name: humanizeReferenceRole(referenceScreen.suggestedRole, referenceScreen.index),
      type: index === 0 ? "root" : "detail",
      description: buildStructuredScreenDescription(referenceScreen),
    })) satisfies ScreenPlan[];

  return screens.length > 0 ? screens : [fallbackScreenPlan(prompt)];
};

export const fallbackProjectCharter = ({
  prompt,
  image,
  referenceMode,
  referenceAnalysis,
  creativeDirection,
  designStyle,
  navigationArchitecture,
  existingCharter,
}: {
  prompt: string;
  image?: PromptImagePayload | null;
  referenceMode?: ReferenceMode | null;
  referenceAnalysis?: ReferenceAnalysis | null;
  creativeDirection?: CreativeDirection | null;
  designStyle?: DesignStylePack | null;
  navigationArchitecture: NavigationArchitecture;
  existingCharter?: ProjectCharter | null;
}): ProjectCharter => ({
  originalPrompt: prompt.trim() || existingCharter?.originalPrompt || "Create a polished mobile app experience from the provided reference.",
  imageReferenceSummary: image
    ? isStyleReferenceMode(referenceMode)
      ? referenceAnalysis
        ? `Use the style reference for visual DNA only. ${referenceAnalysis.overallVisualStyle}`
        : "Use the style reference for visual DNA, material quality, typography, color rhythm, and component craft without copying its layout."
      : referenceAnalysis
        ? `Use the uploaded reference as a structural and stylistic blueprint. ${referenceAnalysis.overallVisualStyle}`
        : "Use the uploaded reference as inspiration for layout hierarchy, tone, and composition while adapting it into a polished product UI."
    : null,
  appType: existingCharter?.appType ?? "Mobile application",
  targetAudience: existingCharter?.targetAudience ?? "General product users",
  navigationModel: existingCharter?.navigationModel
    ?? (deriveRequiresBottomNav(navigationArchitecture) ? "Bottom-tab mobile application" : "Hierarchical mobile flow"),
  navigationArchitecture,
  keyFeatures: existingCharter?.keyFeatures?.length ? existingCharter.keyFeatures : ["Primary workflow", "Supporting detail views"],
  designRationale: referenceAnalysis
    ? `Prioritize clarity, mobile ergonomics, and a coherent design system that preserves this visual DNA: ${referenceAnalysis.designSystemSignals.palette} ${referenceAnalysis.designSystemSignals.surfaces} ${referenceAnalysis.designSystemSignals.typography}`
    : designStyle
      ? `Prioritize clarity, mobile ergonomics, and the selected ${designStyle.label} style contract: ${designStyle.premiumIntent}`
    : existingCharter?.designRationale ?? "Prioritize clarity, mobile ergonomics, and a coherent design system that can scale across future screens.",
  creativeDirection: creativeDirection === undefined
    ? existingCharter?.creativeDirection ?? fallbackCreativeDirection({ prompt, referenceAnalysis })
    : creativeDirection,
  designStyle: summarizeDesignStyle(designStyle) ?? existingCharter?.designStyle ?? null,
});

const truncateText = (value: string, maxLength: number) =>
  value.trim().replace(/\s+\n/g, "\n").replace(/[ \t]{2,}/g, " ").slice(0, maxLength).trim();

const readTextField = ({
  record,
  keys,
  fallback,
  maxLength,
}: {
  record: Record<string, unknown>;
  keys: string[];
  fallback: string;
  maxLength: number;
}) => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return truncateText(value, maxLength);
    }
  }

  return fallback;
};

const readTextArray = ({
  value,
  fallback,
  maxItems,
  maxLength,
}: {
  value: unknown;
  fallback: string[];
  maxItems: number;
  maxLength: number;
}) => {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const next = value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => truncateText(item, maxLength))
    .slice(0, maxItems);

  return next.length > 0 ? next : fallback;
};

const normalizeCreativeDirection = (value: unknown, fallback: CreativeDirection | null | undefined) => {
  if (!isRecord(value)) {
    return fallback ?? null;
  }

  const parsed = CreativeDirectionSchema.safeParse(value);
  if (parsed.success) {
    return parsed.data;
  }

  const fallbackDirection = fallback ?? fallbackCreativeDirection({ prompt: "", referenceAnalysis: null });

  return {
    conceptName: readTextField({ record: value, keys: ["conceptName", "concept_name"], fallback: fallbackDirection.conceptName, maxLength: 200 }),
    styleEssence: readTextField({ record: value, keys: ["styleEssence", "style_essence"], fallback: fallbackDirection.styleEssence, maxLength: 2400 }),
    colorStory: readTextField({ record: value, keys: ["colorStory", "color_story"], fallback: fallbackDirection.colorStory, maxLength: 2400 }),
    typographyMood: readTextField({ record: value, keys: ["typographyMood", "typography_mood"], fallback: fallbackDirection.typographyMood, maxLength: 2400 }),
    surfaceLanguage: readTextField({ record: value, keys: ["surfaceLanguage", "surface_language"], fallback: fallbackDirection.surfaceLanguage, maxLength: 2400 }),
    iconographyStyle: readTextField({ record: value, keys: ["iconographyStyle", "iconography_style"], fallback: fallbackDirection.iconographyStyle, maxLength: 2400 }),
    compositionPrinciples: readTextArray({ value: value.compositionPrinciples ?? value.composition_principles, fallback: fallbackDirection.compositionPrinciples, maxItems: 10, maxLength: 600 }),
    signatureMoments: readTextArray({ value: value.signatureMoments ?? value.signature_moments, fallback: fallbackDirection.signatureMoments, maxItems: 10, maxLength: 600 }),
    motionTone: readTextField({ record: value, keys: ["motionTone", "motion_tone"], fallback: fallbackDirection.motionTone, maxLength: 2400 }),
    avoid: readTextArray({ value: value.avoid, fallback: fallbackDirection.avoid, maxItems: 12, maxLength: 600 }),
  } satisfies CreativeDirection;
};

const referenceScreensForCharter = (referenceAnalysis?: ReferenceAnalysis | null) =>
  referenceAnalysis?.screenReferences.map((screen) => ({
    index: screen.index,
    suggestedRole: screen.suggestedRole,
    layoutSummary: screen.layoutSummary,
    visualHierarchy: screen.visualHierarchy,
    components: screen.components,
    stylingCues: screen.stylingCues,
    interactionCues: screen.interactionCues,
    copyPatterns: screen.copyPatterns,
    implementationNotes: screen.implementationNotes,
  })) ?? [];

const enrichProjectCharter = ({
  base,
  source,
  referenceAnalysis,
  referenceMode,
  designStyle,
  navigationArchitecture,
  diagnostics,
}: {
  base: ProjectCharter;
  source: NonNullable<ProjectCharter["charterSource"]>;
  referenceAnalysis?: ReferenceAnalysis | null;
  referenceMode?: ReferenceMode | null;
  designStyle?: DesignStylePack | null;
  navigationArchitecture: NavigationArchitecture;
  diagnostics?: ProjectCharter["planningDiagnostics"] | null;
}): ProjectCharter => ({
  ...base,
  imageReferenceSummary: base.imageReferenceSummary
    ?? (referenceAnalysis
      ? isStyleReferenceMode(referenceMode)
        ? `Use the style reference for visual DNA only. ${referenceAnalysis.overallVisualStyle}`
        : `Use the uploaded reference as a structural and stylistic blueprint. ${referenceAnalysis.overallVisualStyle}`
      : null),
  navigationArchitecture,
  designStyle: summarizeDesignStyle(designStyle) ?? base.designStyle ?? null,
  referenceScreens: base.referenceScreens?.length ? base.referenceScreens : referenceScreensForCharter(referenceAnalysis),
  designSystemSignals: base.designSystemSignals ?? referenceAnalysis?.designSystemSignals ?? null,
  planningDiagnostics: diagnostics ?? base.planningDiagnostics ?? { source },
  charterSource: source,
});

const salvageProjectCharterFromRawPlan = ({
  rawPlan,
  prompt,
  image,
  referenceMode,
  referenceAnalysis,
  creativeDirection,
  designStyle,
  navigationArchitecture,
  existingCharter,
  diagnostics,
}: {
  rawPlan: unknown;
  prompt: string;
  image?: PromptImagePayload | null;
  referenceMode?: ReferenceMode | null;
  referenceAnalysis?: ReferenceAnalysis | null;
  creativeDirection?: CreativeDirection | null;
  designStyle?: DesignStylePack | null;
  navigationArchitecture: NavigationArchitecture;
  existingCharter?: ProjectCharter | null;
  diagnostics: NonNullable<ProjectCharter["planningDiagnostics"]>;
}): ProjectCharter => {
  const fallback = fallbackProjectCharter({
    prompt,
    image,
    referenceMode,
    referenceAnalysis,
    creativeDirection,
    designStyle,
    navigationArchitecture,
    existingCharter,
  });

  if (!isRecord(rawPlan) || !isRecord(rawPlan.charter)) {
    return enrichProjectCharter({
      base: fallback,
      source: "reference_fallback",
      referenceAnalysis,
      referenceMode,
      designStyle,
      navigationArchitecture,
      diagnostics: { ...diagnostics, source: "reference_fallback" },
    });
  }

  const rawCharter = rawPlan.charter;
  const rawCreativeDirection = normalizeCreativeDirection(
    rawCharter.creativeDirection ?? rawCharter.creative_direction,
    creativeDirection ?? existingCharter?.creativeDirection ?? fallback.creativeDirection,
  );

  return enrichProjectCharter({
    base: {
      originalPrompt: readTextField({ record: rawCharter, keys: ["originalPrompt", "original_prompt"], fallback: fallback.originalPrompt, maxLength: 10000 }),
      imageReferenceSummary: readTextField({
        record: rawCharter,
        keys: ["imageReferenceSummary", "image_reference_summary", "referenceImageAnalysis", "reference_image_analysis"],
        fallback: fallback.imageReferenceSummary ?? "",
        maxLength: 6000,
      }) || fallback.imageReferenceSummary,
      appType: readTextField({ record: rawCharter, keys: ["appType", "app_type"], fallback: fallback.appType, maxLength: 240 }),
      targetAudience: readTextField({ record: rawCharter, keys: ["targetAudience", "target_audience"], fallback: fallback.targetAudience, maxLength: 800 }),
      navigationModel: readTextField({ record: rawCharter, keys: ["navigationModel", "navigation_model"], fallback: fallback.navigationModel, maxLength: 800 }),
      navigationArchitecture,
      keyFeatures: readTextArray({ value: rawCharter.keyFeatures ?? rawCharter.key_features, fallback: fallback.keyFeatures, maxItems: 20, maxLength: 400 }),
      designRationale: readTextField({ record: rawCharter, keys: ["designRationale", "design_rationale"], fallback: fallback.designRationale, maxLength: 8000 }),
      creativeDirection: rawCreativeDirection,
      designStyle: summarizeDesignStyle(designStyle) ?? fallback.designStyle ?? null,
    },
    source: "partial_planner",
    referenceAnalysis,
    referenceMode,
    designStyle,
    navigationArchitecture,
    diagnostics: { ...diagnostics, source: "partial_planner" },
  });
};

const hasBuilderGradeBrief = (description: string) => {
  const markers = ["Visual Goal:", "Layout:", "Hierarchy:", "Key Components:", "Visual Styling:"];
  return markers.filter((marker) => description.includes(marker)).length >= 3;
};

const ensureBuilderGradeScreenBriefs = ({
  screens,
  referenceAnalysis,
}: {
  screens: ScreenPlan[];
  referenceAnalysis?: ReferenceAnalysis | null;
}) =>
  screens.map((screen, index) => {
    if (hasBuilderGradeBrief(screen.description)) {
      return screen;
    }

    const referenceScreen = referenceAnalysis?.screenReferences[index];
    if (!referenceScreen) {
      return screen;
    }

    const enrichedDescription = [
      `Reference DNA: Rebuild this as a premium Drawgle screen using reference screen ${referenceScreen.index} (${referenceScreen.suggestedRole}) as the strongest visual and structural cue.`,
      buildStructuredScreenDescription(referenceScreen),
      `Planner Brief:\n${screen.description}`,
    ].join("\n\n").slice(0, 8000);

    return {
      ...screen,
      description: enrichedDescription,
    };
  });

const normalizeScreenAssetNeeds = (screenName: string, value: unknown): NonNullable<ScreenPlan["assetNeeds"]> => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item): NonNullable<ScreenPlan["assetNeeds"]>[number] | null => {
      const input = isRecord(item)
        ? {
            ...item,
            assetType: item.assetType ?? item.asset_type,
            sourcePreference: item.sourcePreference ?? item.source_preference,
            desiredAspectRatio: item.desiredAspectRatio ?? item.desired_aspect_ratio,
            transparentBackground: item.transparentBackground ?? item.transparent_background,
            placementHint: item.placementHint ?? item.placement_hint,
            reuseKey: item.reuseKey ?? item.reuse_key,
            origin: item.origin,
          }
        : item;
      const parsed = AssetNeedSchema.safeParse(input);
      if (!parsed.success) {
        return null;
      }

      return {
        ...parsed.data,
        screenName,
        reuseKey: parsed.data.reuseKey ?? `${parsed.data.role}-${parsed.data.subject}`,
        origin: parsed.data.origin ?? (parsed.data.sourcePreference === "user_upload" ? "user_explicit" : "planner_inferred"),
      };
    })
    .filter((item): item is NonNullable<ScreenPlan["assetNeeds"]>[number] => Boolean(item));
};

const extractRawScreenArray = (value: unknown): unknown[] => {
  if (Array.isArray(value)) {
    return value;
  }

  if (!isRecord(value)) {
    return [];
  }

  const screenKeys = [
    "screens",
    "screen_briefs",
    "screenBriefs",
    "screen_plans",
    "screenPlans",
    "planned_screens",
    "plannedScreens",
  ];

  for (const key of screenKeys) {
    if (Array.isArray(value[key])) {
      return value[key] as unknown[];
    }
  }

  return isRecord(value.data) ? extractRawScreenArray(value.data) : [];
};

const coerceScreenPlanFromRawItem = (item: unknown): ScreenPlan | null => {
  const parsed = ScreenPlanSchema.safeParse(item);
  if (parsed.success) {
    return {
      name: parsed.data.name,
      type: parsed.data.type,
      description: parsed.data.description,
      assetNeeds: normalizeScreenAssetNeeds(parsed.data.name, parsed.data.asset_needs),
      chromePolicy: parsed.data.chrome_policy
        ? {
            chrome: parsed.data.chrome_policy.chrome,
            showPrimaryNavigation: parsed.data.chrome_policy.show_primary_navigation ?? false,
            showsBackButton: parsed.data.chrome_policy.shows_back_button ?? false,
          }
        : null,
    };
  }

  if (!isRecord(item)) {
    return null;
  }

  const name = readTextField({
    record: item,
    keys: ["name", "title", "screenName", "screen_name"],
    fallback: "",
    maxLength: 100,
  });
  const description = readTextField({
    record: item,
    keys: ["description", "brief", "screenBrief", "screen_brief"],
    fallback: "",
    maxLength: 8000,
  });

  if (!name || !description) {
    return null;
  }

  const normalizedType = ScreenTypeSchema.parse(item.type);
  const rawChromePolicy = isRecord(item.chrome_policy)
    ? item.chrome_policy
    : isRecord(item.chromePolicy)
      ? item.chromePolicy
      : null;
  const chromePolicy = rawChromePolicy
    ? ScreenPlanSchema.shape.chrome_policy.safeParse({
        chrome: rawChromePolicy.chrome,
        show_primary_navigation: rawChromePolicy.show_primary_navigation ?? rawChromePolicy.showPrimaryNavigation,
        shows_back_button: rawChromePolicy.shows_back_button ?? rawChromePolicy.showsBackButton,
      })
    : null;
  const parsedChromePolicy = chromePolicy?.success ? chromePolicy.data : null;
  const assetNeeds = normalizeScreenAssetNeeds(
    name,
    Array.isArray(item.asset_needs) ? item.asset_needs : item.assetNeeds,
  );

  return {
    name,
    type: normalizedType,
    description,
    assetNeeds,
    chromePolicy: parsedChromePolicy
      ? {
          chrome: parsedChromePolicy.chrome,
          showPrimaryNavigation: parsedChromePolicy.show_primary_navigation ?? false,
          showsBackButton: parsedChromePolicy.shows_back_button ?? false,
        }
      : null,
  };
};

const parseJsonResponse = <T>(text: string): T => {
  const trimmed = text.trim();
  const cleaned = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const firstBrace = cleaned.indexOf("{");
    const firstBracket = cleaned.indexOf("[");
    let startIdx = -1;
    let openChar = "";
    let closeChar = "";

    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
      startIdx = firstBrace;
      openChar = "{";
      closeChar = "}";
    } else if (firstBracket !== -1) {
      startIdx = firstBracket;
      openChar = "[";
      closeChar = "]";
    }

    if (startIdx === -1) {
      throw new Error("The model did not return valid JSON.");
    }

    let balance = 0;
    let inString = false;
    let escaped = false;

    for (let i = startIdx; i < cleaned.length; i++) {
      const char = cleaned[i];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\") {
        escaped = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (!inString) {
        if (char === openChar) {
          balance++;
        } else if (char === closeChar) {
          balance--;
          if (balance === 0) {
            const potentialJson = cleaned.slice(startIdx, i + 1);
            try {
              return JSON.parse(potentialJson) as T;
            } catch {
              break;
            }
          }
        }
      }
    }

    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("The model did not return valid JSON.");
    }

    return JSON.parse(jsonMatch[0]) as T;
  }
};

/**
 * Attempt to independently recover valid screens (and optionally navigation
 * architecture) from the raw Gemini planner JSON when the full PlanSchema
 * parse fails.  This avoids discarding perfectly good screen plans just
 * because an unrelated charter field exceeded its length limit.
 */
const salvageScreensFromRawPlan = (rawPlan: unknown): {
  screens: ScreenPlan[];
  navigationArchitecture: z.infer<typeof NavigationArchitectureSchema> | null;
  navigationPlan: NavigationPlan | null;
  requiresBottomNav: boolean | null;
} => {
  const empty = { screens: [], navigationArchitecture: null, navigationPlan: null, requiresBottomNav: null };

  if (!isRecord(rawPlan)) {
    return empty;
  }

  const raw = rawPlan as Record<string, unknown>;

  // --- screens ---
  let screens: ScreenPlan[] = [];
  const rawScreens = extractRawScreenArray(raw);
  if (rawScreens.length > 0) {
    const validScreens: ScreenPlan[] = [];
    for (const item of rawScreens) {
      const screenPlan = coerceScreenPlanFromRawItem(item);
      if (screenPlan) {
        validScreens.push(screenPlan);
      } else {
        console.warn(
          "[salvageScreensFromRawPlan] Skipping invalid screen",
          {
            screenName: isRecord(item) ? (item as Record<string, unknown>).name : "unknown",
            issues: ["Unable to recover a valid screen name and description from the planner item."],
          },
        );
      }
    }
    screens = validScreens;
  }

  // --- navigation_architecture ---
  let navigationArchitecture: z.infer<typeof NavigationArchitectureSchema> | null = null;
  if (isRecord(raw.navigation_architecture)) {
    const navParsed = NavigationArchitectureSchema.safeParse(raw.navigation_architecture);
    if (navParsed.success) {
      navigationArchitecture = navParsed.data;
    }
  }

  let navigationPlan: NavigationPlan | null = null;
  if (isRecord(raw.navigation_plan)) {
    const navPlanParsed = NavigationPlanSchema.safeParse(raw.navigation_plan);
    if (navPlanParsed.success) {
      navigationPlan = toNavigationPlan(navPlanParsed.data);
    }
  }

  // --- requires_bottom_nav ---
  const requiresBottomNav = coerceBooleanish(raw.requires_bottom_nav);

  return { screens, navigationArchitecture, navigationPlan, requiresBottomNav };
};

const toInlineImage = (image?: PromptImagePayload | null) => {
  if (!image) {
    return null;
  }

  return {
    inlineData: {
      data: image.data,
      mimeType: image.mimeType,
    },
  };
};

const normalizeReferenceMode = (referenceMode?: ReferenceMode | null): Exclude<ReferenceMode, "internal_style"> => {
  if (referenceMode === "user_style") return "user_style";
  if (referenceMode === "curated_style" || referenceMode === "internal_style") return "curated_style";
  return "user_recreate";
};

const isStyleReferenceMode = (referenceMode?: ReferenceMode | null) =>
  normalizeReferenceMode(referenceMode) !== "user_recreate";

const styleReferenceInstruction = [
  "Style reference mode: use the image only for visual DNA and premium craft.",
  "Preserve material quality, shadows, radii, blur/glass, typography character, icon weight, color rhythm, polish, micro-shapes, navigation treatment, and component craftsmanship.",
  "Do not preserve exact section order, object positions, domain content, data values, full layout structure, or literal screen anatomy.",
  "Build the actual screen structure from the user prompt, planned screen role, project charter, navigation plan, and approved tokens.",
].join(" ");

const userRecreateReferenceInstruction = "Use the uploaded sketch or wireframe as structural visual evidence while still honoring the provided design tokens. Preserve visible layer order, containment, layout mechanics, edge/depth treatment, and component construction instead of treating the image as loose style inspiration.";

const referenceAnalysisLabel = (referenceMode?: ReferenceMode | null) =>
  isStyleReferenceMode(referenceMode)
    ? "Style Reference Analysis (visual DNA only, do not copy screenshot layout)"
    : "Reference Screen Analysis";

const formatReferenceAnalysis = (referenceAnalysis: ReferenceAnalysis) => {
  const screenSections = referenceAnalysis.screenReferences
    .map((referenceScreen) => [
      `Reference Screen ${referenceScreen.index}: ${referenceScreen.suggestedRole}`,
      `Layout: ${referenceScreen.layoutSummary}`,
      `Hierarchy: ${referenceScreen.visualHierarchy}`,
      `Components: ${referenceScreen.components.join("; ")}`,
      `Styling Cues: ${referenceScreen.stylingCues.join("; ")}`,
      referenceScreen.interactionCues.length > 0 ? `Interaction Cues: ${referenceScreen.interactionCues.join("; ")}` : null,
      referenceScreen.copyPatterns.length > 0 ? `Copy Patterns: ${referenceScreen.copyPatterns.join("; ")}` : null,
      referenceScreen.implementationNotes.length > 0 ? `Implementation Notes: ${referenceScreen.implementationNotes.join("; ")}` : null,
    ]
      .filter(Boolean)
      .join("\n"))
    .join("\n\n");

  return [
    `Overall Visual Style: ${referenceAnalysis.overallVisualStyle}`,
    "Design System Signals:",
    `- Palette: ${referenceAnalysis.designSystemSignals.palette}`,
    `- Typography: ${referenceAnalysis.designSystemSignals.typography}`,
    `- Surfaces: ${referenceAnalysis.designSystemSignals.surfaces}`,
    `- Iconography: ${referenceAnalysis.designSystemSignals.iconography}`,
    `- Density: ${referenceAnalysis.designSystemSignals.density}`,
    `- Motion Tone: ${referenceAnalysis.designSystemSignals.motionTone}`,
    "",
    "Screen Breakdown:",
    screenSections,
  ].join("\n");
};

const formatCreativeDirection = (creativeDirection: CreativeDirection) => [
  `Concept Name: ${creativeDirection.conceptName}`,
  `Style Essence: ${creativeDirection.styleEssence}`,
  `Color Story: ${creativeDirection.colorStory}`,
  `Typography Mood: ${creativeDirection.typographyMood}`,
  `Surface Language: ${creativeDirection.surfaceLanguage}`,
  `Iconography Style: ${creativeDirection.iconographyStyle}`,
  `Composition Principles: ${creativeDirection.compositionPrinciples.join("; ")}`,
  `Signature Moments: ${creativeDirection.signatureMoments.join("; ")}`,
  `Motion Tone: ${creativeDirection.motionTone}`,
  `Avoid: ${creativeDirection.avoid.join("; ")}`,
].join("\n");

async function analyzeReferenceImage({
  prompt,
  image,
  referenceMode,
}: {
  prompt: string;
  image?: PromptImagePayload | null;
  referenceMode?: ReferenceMode | null;
}) {
  const inlineImage = toInlineImage(image);
  if (!inlineImage) {
    return null;
  }

  try {
    const ai = createGeminiClient();
    const resolvedReferenceMode = normalizeReferenceMode(referenceMode);
    const policy = geminiPolicyForTask("project_planning", {
      systemInstruction: isStyleReferenceMode(resolvedReferenceMode)
        ? referenceAnalysisStyleInstruction
        : referenceAnalysisRecreateInstruction,
      responseMimeType: "application/json",
      temperature: 0.1,
    });
    const parts: Array<Record<string, unknown>> = [inlineImage];

    if (isStyleReferenceMode(resolvedReferenceMode)) {
      parts.push({
        text: `${styleReferenceInstruction} Extract reusable visual DNA and component/material construction cues. Do not treat this as the user's requested app layout.`,
      });
    }

    parts.push({
      text: prompt.trim()
        ? `User/Product Intent: "${prompt}"`
        : "Analyze the mobile UI reference image and describe the visible screen anatomy.",
    });

    const response = await ai.models.generateContent({
      model: policy.model,
      contents: { parts },
      config: policy.config,
    });

    const rawAnalysis = parseJsonResponse<unknown>(response.text || "{}");
    const parsed = ReferenceAnalysisSchema.safeParse(rawAnalysis);

    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function generateCreativeDirection({
  prompt,
  image,
  referenceMode,
  referenceAnalysis,
  designStyle,
}: {
  prompt: string;
  image?: PromptImagePayload | null;
  referenceMode?: ReferenceMode | null;
  referenceAnalysis?: ReferenceAnalysis | null;
  designStyle?: DesignStylePack | null;
}): Promise<ParsedCreativeDirection | null> {
  try {
    const ai = createGeminiClient();
    const policy = geminiPolicyForTask("project_planning", {
      systemInstruction: creativeDirectionInstruction,
      responseMimeType: "application/json",
      temperature: 0.35,
    });
    const parts: Array<Record<string, unknown>> = [];
    const inlineImage = toInlineImage(image);
    const resolvedReferenceMode = normalizeReferenceMode(referenceMode);
    const designStyleContract = formatDesignStyleContract(designStyle);

    if (designStyleContract) {
      parts.push({
        text: `${designStyleContract}\nArt direction rule: merge this style with the product domain and audience. Keep the style's structural grammar and anti-patterns visible in the final creative direction.`,
      });
    }

    if (inlineImage) {
      parts.push(inlineImage);
      if (isStyleReferenceMode(resolvedReferenceMode)) {
        parts.push({
          text: styleReferenceInstruction,
        });
      }
    }

    parts.push({
      text: prompt.trim()
        ? `Product Brief: "${prompt}"`
        : "Invent a premium mobile product design direction from the available cues.",
    });

    if (referenceAnalysis) {
      parts.push({
        text: `${referenceAnalysisLabel(resolvedReferenceMode)}:\n${formatReferenceAnalysis(referenceAnalysis)}`,
      });
    }

    const response = await ai.models.generateContent({
      model: policy.model,
      contents: { parts },
      config: policy.config,
    });

    const rawDirection = parseJsonResponse<unknown>(response.text || "{}");
    const parsed = CreativeDirectionSchema.safeParse(rawDirection);

    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export const extractCode = (text: string) => {
  const match = text.match(/```(?:html)?\n([\s\S]*?)\n```/i);
  if (match) {
    return match[1].trim();
  }

  return text.replace(/^```html\n/i, "").replace(/\n```$/, "").trim();
};

export async function planUiFlow({
  prompt,
  image,
  referenceMode,
  referenceId,
  designStyle,
  designTokens,
  projectContext,
  existingCharter,
  existingNavigationPlan,
  planningMode = "project",
  llmLog,
}: {
  prompt: string;
  image?: PromptImagePayload | null;
  referenceMode?: ReferenceMode | null;
  referenceId?: string | null;
  designStyle?: DesignStylePack | null;
  designTokens?: DesignTokens | null;
  projectContext?: string | null;
  existingCharter?: ProjectCharter | null;
  existingNavigationPlan?: NavigationPlan | null;
  planningMode?: PlanningMode;
  llmLog?: LlmLogFn;
}): Promise<PlannedUiFlow> {
  const ai = createGeminiClient();
  const parts: Array<Record<string, unknown>> = [];
  const resolvedReferenceMode = normalizeReferenceMode(referenceMode);
  const resolvedDesignStyle = designStyle ?? getDesignStylePack(existingCharter?.designStyle?.id) ?? null;
  const designStyleContract = formatDesignStyleContract(resolvedDesignStyle);
  const referenceAnalysis = await analyzeReferenceImage({ prompt, image, referenceMode: resolvedReferenceMode });
  const explicitScreenSections = parseExplicitScreenSections(prompt);
  const requestedScreenCount = parseRequestedScreenCount(prompt);
  const intentContract = compileGenerationIntentContract({
    prompt,
    planningMode,
    referenceMode: resolvedReferenceMode,
    referenceAnalysis,
    explicitScreenSections,
    requestedScreenCount,
  });
  const screenCountContract = buildScreenCountContract({
    intentContract,
    explicitScreenSections,
  });
  const forceFiniteFlowWithoutPersistentNav = looksLikeFiniteFlowWithoutPersistentNav(prompt, explicitScreenSections);
  const fallbackRequiresBottomNav = screenCountContract.disableSharedNavigation ? false : inferLegacyRequiresBottomNav({
    prompt,
    planningMode,
    referenceAnalysis,
  });
  const creativeDirection = projectContext?.trim()
    ? null
    : await generateCreativeDirection({
        prompt,
        image,
        referenceMode: resolvedReferenceMode,
        referenceAnalysis,
        designStyle: resolvedDesignStyle,
      });
  const resolvedCreativeDirection = projectContext?.trim()
    ? null
    : creativeDirection ?? fallbackCreativeDirection({ prompt, referenceAnalysis });
  const screenFamilyContract = buildScreenFamilyContract({
    referenceAnalysis,
    creativeDirection: resolvedCreativeDirection,
    designTokens,
    designStyle: resolvedDesignStyle,
    intentContract,
  });

  const inlineImage = resolvedReferenceMode === "user_recreate" ? toInlineImage(image) : null;
  if (inlineImage) {
    parts.push(inlineImage);
  }

  parts.push({
    text: prompt.trim() ? `User Prompt: "${prompt}"` : "Convert this sketch or reference UI in the image into a high-fidelity mobile UI.",
  });

  parts.push({
    text: formatScreenCountContract(screenCountContract),
  });

  parts.push({
    text: `Generation Intent Contract:\n${JSON.stringify(intentContractJson(intentContract), null, 2)}`,
  });

  parts.push({
    text: formatScreenFamilyContract(screenFamilyContract),
  });

  if (designStyleContract) {
    parts.push({
      text: `${designStyleContract}\nPlanner rule: every screen brief must translate this style into app-specific layout anatomy, components, navigation, and anti-pattern avoidance. Do not merely restyle generic cards.`,
    });
  }

  if (forceFiniteFlowWithoutPersistentNav) {
    parts.push({
      text: "This reads as a finite flow with onboarding/detail-style screens, not a peer bottom-tab app. Do not force persistent navigation unless the prompt explicitly asks for tabs/navigation.",
    });
  }

  if (referenceAnalysis) {
    parts.push({
      text: `${referenceAnalysisLabel(resolvedReferenceMode)}:\n${formatReferenceAnalysis(referenceAnalysis)}`,
    });
  }

  if (resolvedCreativeDirection) {
    parts.push({
      text: `Creative Direction:\n${formatCreativeDirection(resolvedCreativeDirection)}`,
    });
  }

  if (designTokens?.tokens) {
    parts.push({
      text: `Approved Token Context:\n${buildTokenPromptContext(designTokens, "compact_visual")}`,
    });
  }

  if (projectContext?.trim()) {
    parts.push({
      text: `Current Project Context:\n${projectContext}`,
    });
  }

  if (planningMode === "single-screen") {
    parts.push({
      text: "Planning Mode: Return exactly 1 additional screen for an existing project. Do not return a multi-screen flow.",
    });
  }

  const plannerMode = resolvedReferenceMode === "user_recreate" ? "recreate" : "style";
  const policy = geminiPolicyForTask("project_planning", {
    systemInstruction: plannerBlueprintStepInstruction(plannerMode),
    responseMimeType: "application/json",
    temperature: 0.1,
  });
  if (llmLog) {
    const si = typeof policy.config.systemInstruction === "string" ? policy.config.systemInstruction : "";
    llmLog(`[LLM INPUT] plan-ui-flow-blueprint`, {
      model: policy.model,
      planningMode,
      referenceMode: resolvedReferenceMode,
      referenceId: referenceId ?? null,
      intentContract: intentContractJson(intentContract),
      screenCountContract: screenCountContractJson(screenCountContract),
      systemInstructionLength: si.length,
      systemInstruction: si,
      userPartCount: parts.length,
      userParts: parts.map((p) => (typeof p.text === "string" ? p.text : "[image]")),
    });
  }

  const response = await ai.models.generateContent({
    model: policy.model,
    contents: { parts },
    config: policy.config,
  });

  if (llmLog && response.usageMetadata) {
    llmLog(`[TOKEN USAGE] plan-ui-flow-blueprint`, response.usageMetadata as Record<string, unknown>);
  }

  const rawBlueprint = parseJsonResponse<unknown>(response.text || "{}");
  const parsedBlueprint = ProjectBlueprintSchema.safeParse(rawBlueprint);
  let rawPlan: unknown = rawBlueprint;
  let parsed = PlanSchema.safeParse(rawPlan);

  if (parsedBlueprint.success) {
    const screenParts: Array<Record<string, unknown>> = [
      ...parts,
      {
        text: `Approved Project Blueprint:\n${JSON.stringify(parsedBlueprint.data, null, 2)}`,
      },
    ];
    const screenPolicy = geminiPolicyForTask("project_planning", {
      systemInstruction: plannerScreenBriefStepInstruction(plannerMode),
      responseMimeType: "application/json",
      temperature: 0.1,
    });

    if (llmLog) {
      const si = typeof screenPolicy.config.systemInstruction === "string" ? screenPolicy.config.systemInstruction : "";
      llmLog(`[LLM INPUT] plan-ui-flow-screen-briefs`, {
        model: screenPolicy.model,
        planningMode,
        referenceMode: resolvedReferenceMode,
        referenceId: referenceId ?? null,
        intentContract,
        screenCountContract,
        systemInstructionLength: si.length,
        systemInstruction: si,
        userPartCount: screenParts.length,
        userParts: screenParts.map((p) => (typeof p.text === "string" ? p.text : "[image]")),
      });
    }

    const screenResponse = await ai.models.generateContent({
      model: screenPolicy.model,
      contents: { parts: screenParts },
      config: screenPolicy.config,
    });

    if (llmLog && screenResponse.usageMetadata) {
      llmLog(`[TOKEN USAGE] plan-ui-flow-screen-briefs`, screenResponse.usageMetadata as Record<string, unknown>);
    }

    const rawScreenBriefs = parseJsonResponse<unknown>(screenResponse.text || "{}");
    const rawScreenItems = extractRawScreenArray(rawScreenBriefs);
    const parsedScreenBriefs = ScreenBriefsSchema.safeParse(
      rawScreenItems.length > 0 ? { screens: rawScreenItems } : rawScreenBriefs,
    );
    rawPlan = {
      ...parsedBlueprint.data,
      screens: parsedScreenBriefs.success
        ? parsedScreenBriefs.data.screens
        : rawScreenItems,
    };
    parsed = PlanSchema.safeParse(rawPlan);
  }

  if (!parsed.success) {
    const validationIssues = parsed.error.issues.map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`);
    const rawPlanKeys = isRecord(rawPlan) ? Object.keys(rawPlan) : [];
    const rawScreenCount = isRecord(rawPlan) && Array.isArray((rawPlan as Record<string, unknown>).screens)
      ? ((rawPlan as Record<string, unknown>).screens as unknown[]).length
      : 0;
    // -----------------------------------------------------------------------
    // DIAGNOSTIC: Log the exact Zod issues so silent fallbacks become visible.
    // -----------------------------------------------------------------------
    console.error(
      "[planUiFlow] PlanSchema validation failed — attempting screen salvage",
      {
        zodIssues: validationIssues,
        rawPlanKeys: rawPlanKeys.length > 0 ? rawPlanKeys : typeof rawPlan,
        rawScreenCount,
      },
    );

    // -------------------------------------------------------------------
    // SALVAGE: Try to independently recover the screens array even though
    // the full plan schema failed (e.g. a charter field was too long).
    // -------------------------------------------------------------------
    const salvaged = salvageScreensFromRawPlan(rawPlan);

    const navigationArchitecture = screenCountContract.disableSharedNavigation || forceFiniteFlowWithoutPersistentNav
      ? createNavigationArchitecture({ requiresBottomNav: false })
      : coerceNavigationArchitecture({
          parsedNavigationArchitecture: salvaged.navigationArchitecture,
          existingNavigationArchitecture: existingCharter?.navigationArchitecture,
          requiresBottomNav: salvaged.requiresBottomNav ?? fallbackRequiresBottomNav,
          lockToExistingArchitecture: Boolean(projectContext?.trim() && existingCharter?.navigationArchitecture),
        });

    const salvageSource = salvaged.screens.length > 0 ? "salvaged" : "fallback";
    const rawScreens = salvaged.screens.length > 0
      ? salvaged.screens.map((screenPlan) => resolvePlannedScreen({ screenPlan, navigationArchitecture }))
      : fallbackScreensFromReference({
          prompt,
          planningMode,
          referenceAnalysis,
        }).map((screenPlan) => resolvePlannedScreen({ screenPlan, navigationArchitecture }));
    const reconciledScreens = reconcileScreensWithPrompt({
      prompt,
      screens: rawScreens,
      planningMode,
    }).map((screenPlan) => resolvePlannedScreen({ screenPlan, navigationArchitecture }));
    const adjustedContract = { ...screenCountContract };
    if (
      adjustedContract.exactCount === 1 &&
      adjustedContract.source === "reference_image" &&
      rawScreenCount > 1
    ) {
      // The contract defaulted to 1 because no explicit count was detected,
      // but the LLM actually planned more screens. Trust the LLM's plan.
      adjustedContract.exactCount = Math.min(rawScreenCount, adjustedContract.maxScreens ?? INITIAL_PROJECT_SCREEN_LIMIT);
      adjustedContract.source = "open_project";
      adjustedContract.reason = `Overridden: raw plan contained ${rawScreenCount} screens but the screen count contract defaulted to 1.`;
    }

    const enforced = enforceScreenCountContract({
      screens: reconciledScreens,
      contract: adjustedContract,
      prompt,
      referenceAnalysis,
    });
    const screens = normalizeScreenBriefsWithFamilyContract({
      prompt,
      screenFamilyContract,
      screens: ensureBuilderGradeScreenBriefs({
      referenceAnalysis,
      screens: enforced.screens.map((screenPlan) => resolvePlannedScreen({ screenPlan, navigationArchitecture })),
      }),
    });
    const navigationPlan = normalizeNavigationPlan({
      navigationPlan: adjustedContract.disableSharedNavigation || forceFiniteFlowWithoutPersistentNav ? null : salvaged.navigationPlan ?? (planningMode === "single-screen" ? existingNavigationPlan : null),
      screens,
      navigationArchitecture,
      requiresBottomNav: deriveRequiresBottomNav(navigationArchitecture),
      strictScreenLinks: planningMode !== "single-screen",
    });
    const plannedScreens = applyNavigationPlanToScreens(screens, navigationPlan);

    console.warn(
      `[planUiFlow] Using ${salvageSource} screens (${screens.length}) after PlanSchema failure`,
      { salvageSource, screenCount: screens.length, screenNames: screens.map((s) => s.name) },
    );

    const planningDiagnostics: NonNullable<ProjectCharter["planningDiagnostics"]> = {
      source: salvaged.screens.length > 0 ? "partial_planner" : "reference_fallback",
      validationIssues,
      rawPlanKeys,
      rawScreenCount,
      recoveredScreens: plannedScreens.length,
      screenCountContract: screenCountContractJson(adjustedContract),
      intentContract: intentContractJson(intentContract),
      screenFamilyContract: screenFamilyContract as unknown as JsonValue,
      screenCountEnforcement: enforced.enforcement,
      notes: [
        "Recovered planner output independently instead of replacing the whole charter with generic fallback.",
        salvaged.screens.length > 0 ? "Screen plans came from valid planner screen objects." : "Screen plans came from reference analysis fallback because no usable planner screens were recovered.",
      ],
    };

    return {
      requiresBottomNav: deriveRequiresBottomNav(navigationArchitecture),
      navigationArchitecture,
      navigationPlan,
      charter: salvageProjectCharterFromRawPlan({
        rawPlan,
        prompt,
        image,
        referenceMode: resolvedReferenceMode,
        referenceAnalysis,
        creativeDirection: resolvedCreativeDirection,
        designStyle: resolvedDesignStyle,
        navigationArchitecture,
        existingCharter,
        diagnostics: planningDiagnostics,
      }),
      screens: plannedScreens,
      screenCountContract: adjustedContract,
      screenCountEnforcement: enforced.enforcement,
      intentContract,
      screenFamilyContract,
    };
  }

  const adjustedContract = { ...screenCountContract };
  const rawScreenCount = parsed.data.screens.length;
  if (
    adjustedContract.exactCount === 1 &&
    adjustedContract.source === "reference_image" &&
    rawScreenCount > 1
  ) {
    // The contract defaulted to 1 because no explicit count was detected,
    // but the LLM actually planned more screens. Trust the LLM's plan.
    adjustedContract.exactCount = Math.min(rawScreenCount, adjustedContract.maxScreens ?? INITIAL_PROJECT_SCREEN_LIMIT);
    adjustedContract.source = "open_project";
    adjustedContract.reason = `Overridden: raw plan contained ${rawScreenCount} screens but the screen count contract defaulted to 1.`;
  }

  const navigationArchitecture = adjustedContract.disableSharedNavigation || forceFiniteFlowWithoutPersistentNav
    ? createNavigationArchitecture({ requiresBottomNav: false })
    : coerceNavigationArchitecture({
        parsedNavigationArchitecture: parsed.data.navigation_architecture ?? null,
        existingNavigationArchitecture: existingCharter?.navigationArchitecture,
        requiresBottomNav: parsed.data.requires_bottom_nav ?? fallbackRequiresBottomNav,
        lockToExistingArchitecture: Boolean(projectContext?.trim() && existingCharter?.navigationArchitecture),
      });

  const charter = enrichProjectCharter({
    base: {
      ...parsed.data.charter,
      creativeDirection: parsed.data.charter.creativeDirection ?? resolvedCreativeDirection,
      designStyle: summarizeDesignStyle(resolvedDesignStyle) ?? existingCharter?.designStyle ?? null,
      navigationArchitecture,
    },
    source: "planner",
    referenceAnalysis,
    referenceMode: resolvedReferenceMode,
    designStyle: resolvedDesignStyle,
    navigationArchitecture,
    diagnostics: {
      source: "planner",
      rawPlanKeys: isRecord(rawPlan) ? Object.keys(rawPlan) : [],
      rawScreenCount: parsed.data.screens.length,
      recoveredScreens: parsed.data.screens.length,
      screenCountContract: screenCountContractJson(adjustedContract),
      intentContract: intentContractJson(intentContract),
      screenFamilyContract: screenFamilyContract as unknown as JsonValue,
    },
  });

  const parsedScreens = planningMode === "single-screen"
      ? parsed.data.screens.slice(0, 1)
      : parsed.data.screens;
  const rawScreens = parsedScreens.map((screenPlan) => ({
    name: screenPlan.name,
    type: screenPlan.type,
    description: screenPlan.description,
    assetNeeds: normalizeScreenAssetNeeds(screenPlan.name, screenPlan.asset_needs),
    chromePolicy: screenPlan.chrome_policy
      ? {
          chrome: screenPlan.chrome_policy.chrome,
          showPrimaryNavigation: screenPlan.chrome_policy.show_primary_navigation ?? false,
          showsBackButton: screenPlan.chrome_policy.shows_back_button ?? false,
        }
      : null,
  }));
  const reconciledScreens = reconcileScreensWithPrompt({
    prompt,
    screens: rawScreens,
    planningMode,
  }).map((screenPlan) => resolvePlannedScreen({
    screenPlan: {
      name: screenPlan.name,
      type: screenPlan.type,
      description: screenPlan.description,
      assetNeeds: screenPlan.assetNeeds ?? [],
      chromePolicy: screenPlan.chromePolicy ?? null,
    },
    navigationArchitecture,
  }));
  const enforced = enforceScreenCountContract({
    screens: reconciledScreens,
    contract: adjustedContract,
    prompt,
    referenceAnalysis,
  });
  const screens = normalizeScreenBriefsWithFamilyContract({
    prompt,
    screenFamilyContract,
    screens: ensureBuilderGradeScreenBriefs({
    referenceAnalysis,
    screens: enforced.screens.map((screenPlan) => resolvePlannedScreen({
      screenPlan: {
        name: screenPlan.name,
        type: screenPlan.type,
        description: screenPlan.description,
        assetNeeds: screenPlan.assetNeeds ?? [],
        chromePolicy: screenPlan.chromePolicy ?? null,
      },
      navigationArchitecture,
    })),
    }),
  });
  const navigationPlan = normalizeNavigationPlan({
    navigationPlan: adjustedContract.disableSharedNavigation || forceFiniteFlowWithoutPersistentNav ? null : toNavigationPlan(parsed.data.navigation_plan) ?? (planningMode === "single-screen" ? existingNavigationPlan : null),
    screens,
    navigationArchitecture,
    requiresBottomNav: deriveRequiresBottomNav(navigationArchitecture),
    strictScreenLinks: planningMode !== "single-screen",
  });
  const plannedScreens = applyNavigationPlanToScreens(screens, navigationPlan);

  return {
    requiresBottomNav: deriveRequiresBottomNav(navigationArchitecture),
    navigationArchitecture,
    navigationPlan,
    charter,
    screens: plannedScreens,
    screenCountContract: adjustedContract,
    screenCountEnforcement: enforced.enforcement,
    intentContract,
    screenFamilyContract,
  };
}

export async function generateDesignTokens({
  prompt,
  image,
  referenceMode,
  referenceId,
  designStyle,
  llmLog,
}: {
  prompt: string;
  image?: PromptImagePayload | null;
  referenceMode?: ReferenceMode | null;
  referenceId?: string | null;
  designStyle?: DesignStylePack | null;
  llmLog?: LlmLogFn;
}) {
  try {
    const ai = createGeminiClient();
    const policy = geminiPolicyForTask("design_tokens", {
      systemInstruction: designInstruction,
      responseMimeType: "application/json",
      temperature: 0.35,
    });
    const parts: Array<Record<string, unknown>> = [];
    const resolvedReferenceMode = normalizeReferenceMode(referenceMode);
    const designStyleContract = formatDesignStyleContract(designStyle);
    const referenceAnalysis = await analyzeReferenceImage({ prompt, image, referenceMode: resolvedReferenceMode });
    const creativeDirection = (await generateCreativeDirection({
      prompt,
      image,
      referenceAnalysis,
      referenceMode: resolvedReferenceMode,
      designStyle,
    })) ?? fallbackCreativeDirection({ prompt, referenceAnalysis });

    const inlineImage = toInlineImage(image);
    if (designStyleContract) {
      parts.push({
        text: `${designStyleContract}\nToken rule: adapt the token seed to this product domain and audience. Preserve the style's geometry, density, typography mood, and component intent. Do not blindly copy seed colors when the product domain requires a more suitable accent.`,
      });
    }

    if (inlineImage) {
      parts.push(inlineImage);
      if (isStyleReferenceMode(resolvedReferenceMode)) {
        parts.push({
          text: `${styleReferenceInstruction} Derive reusable tokens from the reference image's visual DNA only.`,
        });
      }
    }

    parts.push({
      text: prompt.trim()
        ? `User Prompt & Design Constraints: "${prompt}"`
        : "Create a modern, clean design system for a premium mobile app.",
    });

    if (referenceAnalysis) {
      parts.push({
        text: `${referenceAnalysisLabel(resolvedReferenceMode)}:\n${formatReferenceAnalysis(referenceAnalysis)}`,
      });
    }

    parts.push({
      text: `Creative Direction:\n${formatCreativeDirection(creativeDirection)}`,
    });

    if (llmLog) {
      const si = typeof policy.config.systemInstruction === "string" ? policy.config.systemInstruction : "";
      llmLog(`[LLM INPUT] design-tokens`, {
        model: policy.model,
        referenceMode: resolvedReferenceMode,
        referenceId: referenceId ?? null,
        systemInstructionLength: si.length,
        systemInstruction: si,
        userPartCount: parts.length,
        userParts: parts.map((p) => (typeof p.text === "string" ? p.text : "[image]")),
      });
    }

    const response = await ai.models.generateContent({
      model: policy.model,
      contents: { parts },
      config: policy.config,
    });

    if (llmLog && response.usageMetadata) {
      llmLog(`[TOKEN USAGE] design-tokens`, response.usageMetadata as Record<string, unknown>);
    }

    const rawTokens = parseJsonResponse<unknown>(response.text || "{}");
    const parsed = DesignTokensSchema.safeParse(rawTokens);

    if (!parsed.success) {
      return buildApprovedDesignTokens(rawTokens);
    }

    return buildApprovedDesignTokens(parsed.data as {
      system_schema?: string;
      meta?: DesignTokenMetadata;
      tokens?: DesignTokenValues;
    });
  } catch (error) {
    console.error("Failed to generate design tokens", error);
    throw error instanceof Error
      ? error
      : new Error("Failed to generate design tokens.");
  }
}

export async function* buildScreenStream(input: BuildScreenInput): AsyncGenerator<string, void, void> {
  const ai = createGeminiClient();
  const parts: Array<Record<string, unknown>> = [];
  const resolvedReferenceMode = normalizeReferenceMode(input.referenceMode);

  const inlineImage = toInlineImage(input.image);
  if (inlineImage) {
    parts.push(inlineImage);
    parts.push({
      text: isStyleReferenceMode(resolvedReferenceMode)
        ? `${styleReferenceInstruction} Reference id: ${input.referenceId ?? "user-upload"}.`
        : userRecreateReferenceInstruction,
    });
  }

  parts.push({
    text: [
      `Build the complete static HTML UI for ${input.screenPlan.name}.`,
      `Original context prompt: "${input.prompt || "No overarching prompt provided."}"`,
      "Return the full screen once, with no commentary, no markdown, and no abbreviated sections.",
    ].join("\n"),
  });

  const compactProjectContext = input.projectContext?.trim().slice(0, 6000);
  if (compactProjectContext) {
    parts.push({
      text: `Compact Existing Project Memory:\n${compactProjectContext}`,
    });
  }

  const buildInstruction = resolvedReferenceMode === "user_recreate"
    ? buildRecreateScreenInstruction
    : buildStyleScreenInstruction;
  const systemInstruction = buildInstruction({
    designTokens: input.designTokens,
    designStyle: input.designStyle,
    screenPlan: input.screenPlan,
    prompt: input.prompt,
    requiresBottomNav: input.requiresBottomNav,
    navigationArchitecture: input.navigationArchitecture,
    navigationPlan: input.navigationPlan,
    assetManifest: input.assetManifest,
  });

  const policy = geminiPolicyForTask("screen_build", {
    systemInstruction,
    temperature: 0.2,
  });

  if (input.onLlmInput) {
    const snapshot: LlmInputSnapshot = {
      screenName: input.screenPlan.name,
      model: policy.model,
      systemInstruction,
      userParts: parts
        .map((p) => (typeof p.text === "string" ? p.text : "[image]"))
        .filter(Boolean),
      hasImage: Boolean(toInlineImage(input.image)),
      referenceMode: resolvedReferenceMode,
      referenceSource: input.referenceSource ?? null,
      referenceId: input.referenceId ?? null,
    };
    input.onLlmInput(snapshot);
  }

  const responseStream = await ai.models.generateContentStream({
    model: policy.model,
    contents: { parts },
    config: policy.config,
  });

  for await (const chunk of responseStream) {
    input.onResponseChunk?.(chunk);
    if (chunk.text) {
      yield chunk.text;
    }
  }
}

export async function buildScreenCode(input: BuildScreenInput) {
  let rawText = "";

  for await (const chunk of buildScreenStream(input)) {
    rawText += chunk;
  }

  return {
    rawText,
    code: extractCode(rawText),
  };
}

export async function* editScreenStream({
  messages,
  screenCode,
  blockIndex,
  targetBlockIds,
  designTokens,
  navigationArchitecture,
  selectedElementHtml,
  selectedElementDrawgleId,
  llmLog,
  onResponseChunk,
}: {
  messages: Array<Pick<Message, "role" | "content">>;
  screenCode: string;
  blockIndex?: ScreenBlockIndex | null;
  targetBlockIds?: string[];
  designTokens?: DesignTokens | null;
  navigationArchitecture?: NavigationArchitecture | null;
  /** The outerHTML of a visually selected element (from the visual DOM selector). */
  selectedElementHtml?: string | null;
  /** Stable data-drawgle-id of the selected element when available. */
  selectedElementDrawgleId?: string | null;
  llmLog?: LlmLogFn;
  onResponseChunk?: (chunk: unknown) => void;
}) {
  const ai = createGeminiClient();
  const history = messages.map((message) => ({
    role: message.role === "model" ? "model" : "user",
    parts: [{ text: message.content }],
  }));

  const policy = geminiPolicyForTask("selected_region_edit", {
    systemInstruction: buildEditSystemInstruction({ designTokens, navigationArchitecture }),
    temperature: 0.7,
  });

  const chat = ai.chats.create({
    model: policy.model,
    history,
    config: policy.config,
  });

  const latestUserPrompt = [...messages].reverse().find((message) => message.role === "user")?.content ?? "";

  // ---------------------------------------------------------------------------
  // Priority 1: Visual element selection — the user clicked on an element in
  // the rendered screen.  This gives us the exact outerHTML, which is far more
  // precise than keyword-based block matching.
  // ---------------------------------------------------------------------------
  let editMessage: string;

  if (selectedElementHtml) {
    editMessage = [
      `User edit request: ${latestUserPrompt || "Apply the requested changes."}`,
      "",
      "The user **visually selected** the following element in the rendered screen.",
      selectedElementDrawgleId ? `Stable source target: data-drawgle-id="${selectedElementDrawgleId}". The replacement root for this selected element must preserve this exact id. Do not drop it, duplicate it, rename it, or move it to a child.` : null,
      "Apply the requested changes ONLY to this element and its children.",
      "Use <edit> blocks where the <search> content exactly matches the snippet below (or a portion of it).",
      "",
      "SELECTED ELEMENT:",
      "```html",
      selectedElementHtml,
      "```",
    ].filter(Boolean).join("\n");
  } else {
    // Priority 2: Block-index scoped context (existing path)
    const scopedContext = blockIndex && targetBlockIds && targetBlockIds.length > 0
      ? buildScopedEditContext({
          screenCode,
          blockIndex,
          targetBlockIds,
        })
      : null;

    editMessage = scopedContext
      ? [
          `User edit request: ${latestUserPrompt || "Apply the requested changes."}`,
          scopedContext,
          "Return ONLY <edit> blocks that match the provided snippets.",
        ].join("\n\n")
      : [
          `User edit request: ${latestUserPrompt || "Apply the requested changes."}`,
          "",
          "Here is the current code:",
          "```html",
          screenCode,
          "```",
          "",
          "Return ONLY <edit> blocks that modify the code to satisfy the user request.",
        ].join("\n");
  }

  const responseStream = await chat.sendMessageStream({
    message: editMessage,
  });

  if (llmLog) {
    const si = typeof policy.config.systemInstruction === "string" ? policy.config.systemInstruction : "";
    llmLog(`[LLM INPUT] edit: ${latestUserPrompt.slice(0, 80)}`, {
      model: policy.model,
      systemInstructionLength: si.length,
      systemInstruction: si,
      editMessage,
      hasSelectedElement: Boolean(selectedElementHtml),
    });
  }

  for await (const chunk of responseStream) {
    onResponseChunk?.(chunk);
    if (chunk.text) {
      yield chunk.text;
    }
  }
}

export async function editScreenCode({
  messages,
  screenCode,
  designTokens,
  navigationArchitecture,
}: {
  messages: Array<Pick<Message, "role" | "content">>;
  screenCode: string;
  designTokens?: DesignTokens | null;
  navigationArchitecture?: NavigationArchitecture | null;
}) {
  let rawText = "";

  for await (const chunk of editScreenStream({ messages, screenCode, designTokens, navigationArchitecture })) {
    rawText += chunk;
  }

  return {
    rawText,
    code: rawText.includes("<edit>") ? applyEdits(screenCode, rawText) : screenCode,
  };
}

export async function buildSectionRepairCode({
  screenName,
  screenPrompt,
  userPrompt,
  currentCode,
  repairTarget,
  missingAnchors = [],
  healthIssues = [],
  designTokens,
  projectCharter,
  navigationArchitecture,
  llmLog,
}: {
  screenName: string;
  screenPrompt: string;
  userPrompt?: string | null;
  currentCode: string;
  repairTarget: RepairTarget;
  missingAnchors?: string[];
  healthIssues?: string[];
  designTokens?: DesignTokens | null;
  projectCharter?: ProjectCharter | null;
  navigationArchitecture?: NavigationArchitecture | null;
  llmLog?: LlmLogFn;
}) {
  const ai = createGeminiClient();
  const surrounding = buildRepairSurroundingContext(currentCode, repairTarget);
  const policy = geminiPolicyForTask("repair", {
    temperature: 0.24,
    systemInstruction: [
      "You repair one damaged or incomplete section inside an existing mobile screen.",
      "Return ONLY the replacement HTML for the selected section. Do not return markdown fences, <edit> blocks, html/head/body tags, scripts, or unrelated screen sections.",
      "The replacement must fit exactly between the provided code-before and code-after context.",
      "Preserve the screen's existing visual language, copy/data intent, design tokens, and spacing rhythm, while completing missing content from the original brief.",
      "If the target section is too broken to understand, rebuild the same section role from the original screen brief and surrounding context.",
      "Do not add or modify persistent bottom navigation. Drawgle owns shared navigation outside screen code.",
      "Use Lucide icons with <i data-lucide=\"icon-name\"></i> or inline SVG when needed.",
      "Use Drawgle live token utility classes and CSS variables for canonical design-system styling. Avoid freezing token values as raw hex/pixels when a token variable exists.",
      "Keep the output as one coherent section/root fragment with balanced tags.",
      "Return static HTML only: no JSX, React, JavaScript expressions, arrays, .map(...), arrow functions, template literals, className, class={...}, style={{...}}, data attributes with {...}, or scripts. Manually expand repeated UI items.",
    ].join("\n"),
  });

  const userText = [
    `Screen name: ${screenName}`,
    `User repair/edit request: ${userPrompt?.trim() || "Repair the broken or incomplete selected section."}`,
    `Original screen brief:\n${screenPrompt || "No original screen prompt was saved."}`,
    projectCharter?.creativeDirection ? `Creative direction:\n${formatCreativeDirection(projectCharter.creativeDirection)}` : null,
    `Navigation architecture:\n${JSON.stringify(navigationArchitecture ?? null, null, 2)}`,
    `Token context:\n${buildTokenPromptContext(designTokens, "compact_visual")}`,
    missingAnchors.length > 0 ? `Missing required anchors that must be restored: ${missingAnchors.join(", ")}` : null,
    healthIssues.length > 0 ? `Detected health issues: ${healthIssues.join("; ")}` : null,
    `Repair target reason: ${repairTarget.reason}`,
    [
      "Code before target:",
      "```html",
      surrounding.before,
      "```",
    ].join("\n"),
    [
      "Broken/incomplete target section to replace:",
      "```html",
      repairTarget.snippet,
      "```",
    ].join("\n"),
    [
      "Code after target:",
      "```html",
      surrounding.after,
      "```",
    ].join("\n"),
  ].filter(Boolean).join("\n\n");

  if (llmLog) {
    const si = typeof policy.config.systemInstruction === "string" ? policy.config.systemInstruction : "";
    llmLog(`[LLM INPUT] repair: ${screenName}`, {
      model: policy.model,
      systemInstructionLength: si.length,
      systemInstruction: si,
      userTextLength: userText.length,
      userText,
    });
  }

  const response = await ai.models.generateContent({
    model: policy.model,
    contents: { parts: [{ text: userText }] },
    config: policy.config,
  });

  if (llmLog && response.usageMetadata) {
    llmLog(`[TOKEN USAGE] repair: ${screenName}`, response.usageMetadata as Record<string, unknown>);
  }

  return extractCode(response.text || "").trim();
}

const staticHtmlOutputRules = [
  "Return ONLY static HTML. Do not include markdown fences, scripts, html/head/body tags, React, JSX, JavaScript expressions, arrays, .map(...), arrow functions, template literals, className, class={...}, style={{...}}, or data attributes with {...}.",
  "Manually expand repeated items into concrete HTML elements. If there are seven days, output seven day elements. If there are three cards, output three card elements.",
  "Use Tailwind classes, Drawgle token utility classes, and normal quoted HTML attributes only. Inline style is allowed only as a normal string, e.g. style=\"height: 60%\".",
  "Use Lucide icons with <i data-lucide=\"icon-name\"></i> or inline SVG. Do not include a script to initialize icons.",
  "Never render planning/meta words as visible copy. Do not output placeholder phrases such as generic text, context text, generic date, placeholder content, sample text, or dummy copy.",
  "Do not add phone frames, status bars, html/head/body, or persistent shared bottom navigation.",
];

export async function buildSourceRegionReplacementCode({
  screenName,
  screenPrompt,
  userPrompt,
  currentCode,
  repairTarget,
  editOperation = "none",
  requiredRootDrawgleId,
  designTokens,
  projectCharter,
  navigationArchitecture,
  llmLog,
  onRawResponse,
}: {
  screenName: string;
  screenPrompt: string;
  userPrompt: string;
  currentCode: string;
  repairTarget: RepairTarget;
  editOperation?: "none" | "append_content" | "replace_region" | "restyle_region" | "rewrite_screen" | "repair_screen";
  requiredRootDrawgleId?: string | null;
  designTokens?: DesignTokens | null;
  projectCharter?: ProjectCharter | null;
  navigationArchitecture?: NavigationArchitecture | null;
  llmLog?: LlmLogFn;
  onRawResponse?: (rawText: string) => void;
}) {
  const ai = createGeminiClient();
  const surrounding = buildRepairSurroundingContext(currentCode, repairTarget);
  const policy = geminiPolicyForTask("selected_region_edit", {
    temperature: 0.26,
    systemInstruction: [
      "You replace exactly one selected region inside an existing mobile screen.",
      requiredRootDrawgleId
        ? "Return ONLY the replacement HTML for that selected element. The caller will parse the HTML and swap exactly the source node with the matching Drawgle id."
        : "Return ONLY the replacement HTML for that selected region. The caller will splice it into the original source by offsets.",
      "Satisfy the user's edit request while preserving the surrounding screen's visual language, spacing rhythm, tokens, and content intent.",
      requiredRootDrawgleId
        ? `SELECTED ELEMENT ID CONTRACT: The replacement must be exactly one root HTML element, and that root element MUST keep data-drawgle-id="${requiredRootDrawgleId}". Do not remove it, rename it, move it to a child, duplicate it on descendants, or use that id anywhere except the replacement root.`
        : null,
      editOperation === "append_content"
        ? "Append-content operation: preserve all existing meaningful children in the selected container and add new sibling items that match the existing pattern. Do not remove, rename, or restyle unrelated existing items."
        : null,
      "The replacement must fit between the provided before/after context and should keep the same semantic role unless the user asks to change that region's role.",
      repairTarget.reason === "screen_root_region"
        ? `Because the selected region is the screen root, return one complete screen root. The outermost element must be a <div> with w-full, min-h-screen, dg-bg-primary, dg-text-high, flex, flex-col, relative, and overflow-x-hidden classes. End the full screen with ${DRAWGLE_GENERATION_COMPLETE_SENTINEL}. Do not return only an inner section.`
        : null,
      ...staticHtmlOutputRules,
    ].filter(Boolean).join("\n"),
  });

  const userText = [
    `Screen name: ${screenName}`,
    `User edit request: ${userPrompt.trim() || "Improve the selected region."}`,
    `Original screen brief:\n${screenPrompt || "No original screen prompt was saved."}`,
    projectCharter?.creativeDirection ? `Creative direction:\n${formatCreativeDirection(projectCharter.creativeDirection)}` : null,
    `Navigation architecture:\n${JSON.stringify(navigationArchitecture ?? null, null, 2)}`,
    `Token context:\n${buildTokenPromptContext(designTokens, "compact_visual")}`,
    `Source target reason: ${repairTarget.reason}`,
    [
      "Code before selected region:",
      "```html",
      surrounding.before,
      "```",
    ].join("\n"),
    [
      "Selected source region to replace:",
      "```html",
      repairTarget.snippet,
      "```",
    ].join("\n"),
    [
      "Code after selected region:",
      "```html",
      surrounding.after,
      "```",
    ].join("\n"),
  ].filter(Boolean).join("\n\n");

  if (llmLog) {
    const si = typeof policy.config.systemInstruction === "string" ? policy.config.systemInstruction : "";
    llmLog(`[LLM INPUT] region-replace: ${screenName}`, {
      model: policy.model,
      systemInstructionLength: si.length,
      systemInstruction: si,
      userTextLength: userText.length,
      userText,
    });
  }

  const response = await ai.models.generateContent({
    model: policy.model,
    contents: { parts: [{ text: userText }] },
    config: policy.config,
  });

  if (llmLog && response.usageMetadata) {
    llmLog(`[TOKEN USAGE] region-replace: ${screenName}`, response.usageMetadata as Record<string, unknown>);
  }

  const rawText = response.text || "";
  onRawResponse?.(rawText);
  return extractCode(rawText).trim();
}

export async function buildFullScreenReconstructionCode({
  screenPlan,
  userPrompt,
  currentCode,
  designTokens,
  projectCharter,
  navigationArchitecture,
  navigationPlan,
  llmLog,
}: {
  screenPlan: ScreenPlan;
  userPrompt?: string | null;
  currentCode: string;
  designTokens?: DesignTokens | null;
  projectCharter?: ProjectCharter | null;
  navigationArchitecture?: NavigationArchitecture | null;
  navigationPlan?: NavigationPlan | null;
  llmLog?: LlmLogFn;
}) {
  const ai = createGeminiClient();
  const rebuildPromptContext = [userPrompt, projectCharter?.originalPrompt]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join("\n");
  const policy = geminiPolicyForTask("full_rebuild", {
    temperature: 0.24,
    systemInstruction: [
      buildStyleScreenInstruction({
        designTokens,
        screenPlan,
        prompt: rebuildPromptContext,
        requiresBottomNav: Boolean(navigationPlan?.enabled),
        navigationArchitecture,
        navigationPlan,
      }),
      "",
      "FULL-SCREEN RECONSTRUCTION MODE:",
      "The existing source is invalid or unrecoverable. Rebuild the complete screen from the screen brief, project direction, tokens, and useful visible intent in the broken source.",
      "Return one complete static screen root. Do not append to or duplicate the old source.",
      `End the response with this exact sentinel on its own final line: ${DRAWGLE_GENERATION_COMPLETE_SENTINEL}`,
      ...staticHtmlOutputRules,
    ].join("\n"),
  });

  const userText = [
    `User request: ${userPrompt?.trim() || "Reconstruct the broken screen as production-ready static HTML."}`,
    projectCharter?.originalPrompt ? `Original project prompt:\n${projectCharter.originalPrompt}` : null,
    projectCharter?.creativeDirection ? `Creative direction:\n${formatCreativeDirection(projectCharter.creativeDirection)}` : null,
    [
      "Current broken source, for visual/content intent only. Do not preserve invalid JSX, duplicated fragments, scripts, or broken structure:",
      "```html",
      currentCode.slice(0, 14000),
      "```",
    ].join("\n"),
  ].filter(Boolean).join("\n\n");

  if (llmLog) {
    const si = typeof policy.config.systemInstruction === "string" ? policy.config.systemInstruction : "";
    llmLog(`[LLM INPUT] full-rebuild: ${screenPlan.name}`, {
      model: policy.model,
      systemInstructionLength: si.length,
      systemInstruction: si,
      userTextLength: userText.length,
      userText,
    });
  }

  const response = await ai.models.generateContent({
    model: policy.model,
    contents: { parts: [{ text: userText }] },
    config: policy.config,
  });

  if (llmLog && response.usageMetadata) {
    llmLog(`[TOKEN USAGE] full-rebuild: ${screenPlan.name}`, response.usageMetadata as Record<string, unknown>);
  }

  return extractCode(response.text || "").trim();
}

const navigationDesignQualityRules = [
  "Treat quality as a critique standard, not a fixed visual recipe. Do not reuse a default dock, pill, tab bar, or layout pattern unless it is the right answer for this specific project.",
  "Infer the navigation anatomy from the user's request, project type, reference/style context, design tokens, and current screen language. The result may be full-width, floating, asymmetric, glassy, compact, expanded, action-led, text-led, icon-led, or another appropriate mobile nav form.",
  "Use the project's live token utility classes and CSS variables for canonical color, radius, elevation, typography, spacing, and icon treatment. Do not freeze project token values as raw hex/pixels unless it is a deliberate one-off detail.",
  "Preserve every planned label and data-nav-item-id exactly unless the user explicitly asks to rename, hide, add, or remove navigation items.",
  "Preserve the planned icon meanings unless the user explicitly asks for different icons.",
  "Check the tap target comfort, label legibility, active-state clarity, and visual harmony with the screen behind it.",
  "Design for a narrow 390px mobile viewport. The nav must fit without horizontal scrolling, clipped labels, overlapping icons, or unsafe bottom-edge placement.",
  "Keep the shell compact enough for app content: target 64-88px visual height including labels, and never create a giant bottom panel unless the navigation plan explicitly asks for an expanded action dock.",
  "If labels are shown, keep them short, stable, and aligned below their icons. If the available width is tight, use a compact icon-led treatment rather than squeezing text into collisions.",
  "Use a consistent item rhythm: equal touch targets, stable icon sizes, consistent label line-height, and one active-state shape. Do not mix unrelated margins, radii, or text sizes between nav items.",
  "Respect bottom safe-area behavior: include a small bottom inset/padding inside the nav surface, but do not push the shell so high that it covers core screen content.",
  "Do not add fake screen spacers or placeholder blocks. The renderer owns fixed placement; the nav shell owns only its own visual design.",
  "The renderer only sets data-active at runtime. All active/inactive visuals must be encoded in the nav HTML/CSS itself.",
];

async function refineNavigationShellCode({
  prompt,
  candidateShellCode,
  navigationPlan,
  designTokens,
  designStyle,
  projectCharter,
  llmLog,
}: {
  prompt: string;
  candidateShellCode: string;
  navigationPlan: NavigationPlan;
  designTokens?: DesignTokens | null;
  designStyle?: DesignStylePack | null;
  projectCharter?: ProjectCharter | null;
  llmLog?: LlmLogFn;
}) {
  const ai = createGeminiClient();
  const policy = geminiPolicyForTask("navigation_build", {
    temperature: 0.18,
    systemInstruction: [
      "You are the final design QA pass for a shared mobile navigation shell.",
      "Return ONLY the full improved replacement HTML for the nav shell.",
      "Keep the same one <nav data-drawgle-primary-nav> root and all planned data-nav-item-id values.",
      `End the response with this exact sentinel on its own final line: ${DRAWGLE_GENERATION_COMPLETE_SENTINEL}`,
      ...navigationDesignQualityRules,
      "If the candidate already meets the bar, return it with only small polish. If it looks amateur, rebuild it while honoring the user request and project tokens.",
    ].join("\n"),
  });

  const userText = [
    `User navigation request: ${prompt}`,
    projectCharter ? `Project charter: ${JSON.stringify(projectCharter, null, 2)}` : null,
    projectCharter?.creativeDirection ? `Creative direction: ${formatCreativeDirection(projectCharter.creativeDirection)}` : null,
    formatDesignStyleContract(designStyle),
    `Navigation plan: ${JSON.stringify(navigationPlan, null, 2)}`,
    `Token context: ${buildTokenPromptContext(designTokens, "compact_visual")}`,
    [
      "Candidate navigation shell to critique and improve:",
      "```html",
      candidateShellCode,
      "```",
    ].join("\n"),
  ].filter(Boolean).join("\n\n");

  if (llmLog) {
    const si = typeof policy.config.systemInstruction === "string" ? policy.config.systemInstruction : "";
    llmLog(`[LLM INPUT] nav-refine`, {
      model: policy.model,
      systemInstructionLength: si.length,
      systemInstruction: si,
      userTextLength: userText.length,
      userText,
    });
  }

  const response = await ai.models.generateContent({
    model: policy.model,
    contents: { parts: [{ text: userText }] },
    config: policy.config,
  });

  if (llmLog && response.usageMetadata) {
    llmLog(`[TOKEN USAGE] nav-refine`, response.usageMetadata as Record<string, unknown>);
  }

  const rawRefinedCode = extractCode(response.text || "").trim();
  const refinedCompletion = validateSourceCompletion({ code: rawRefinedCode, requireSentinel: true });
  const refinedCode = refinedCompletion.valid
    ? stripGenerationCompleteSentinel(rawRefinedCode)
    : candidateShellCode;
  return validateNavigationShell(refinedCode, navigationPlan) ? refinedCode : candidateShellCode;
}

export async function editNavigationShellCode({
  prompt,
  currentShellCode,
  navigationPlan,
  designTokens,
  designStyle,
  projectCharter,
  selectedElementHtml,
  llmLog,
}: {
  prompt: string;
  currentShellCode: string;
  navigationPlan: NavigationPlan;
  designTokens?: DesignTokens | null;
  designStyle?: DesignStylePack | null;
  projectCharter?: ProjectCharter | null;
  selectedElementHtml?: string | null;
  llmLog?: LlmLogFn;
}) {
  if (!navigationPlan.enabled || navigationPlan.kind === "none") {
    throw new Error("This project does not have shared navigation enabled.");
  }

  const ai = createGeminiClient();
  const policy = geminiPolicyForTask("navigation_build", {
    temperature: 0.32,
    systemInstruction: [
      "You edit the single shared project navigation shell for Drawgle.",
      "Return ONLY the full replacement HTML for the shared navigation shell. Do not return <edit> blocks, markdown fences, scripts, html, head, body, screen content, or placeholder spacers.",
      "The returned HTML must contain exactly one <nav data-drawgle-primary-nav> root.",
      "Preserve every planned data-nav-item-id exactly. Do not invent, remove, rename, or relabel navigation items unless the user's request explicitly changes the nav structure or labels.",
      "The renderer only pins a transparent host to the viewport bottom. Your HTML owns the visual design: full-width bar, dock, floating pill, action dock, radius, background, spacing, shadow, icons, labels, and active state.",
      "If the user asks for a dock, make the nav itself look like a dock. If they ask for full width, make the nav full width. Do not add fake space to the screen.",
      "Use Lucide icons with <i data-lucide=\"icon-name\"></i>.",
      "Use data-active=true selectors, inline styles, or scoped <style> rules inside the nav so active tab state works after the renderer sets data-active.",
      `End the response with this exact sentinel on its own final line: ${DRAWGLE_GENERATION_COMPLETE_SENTINEL}`,
      ...navigationDesignQualityRules,
    ].join("\n"),
  });
  const userText = [
    `User navigation edit request: ${prompt}`,
    projectCharter ? `Project charter: ${JSON.stringify(projectCharter, null, 2)}` : null,
    projectCharter?.creativeDirection ? `Creative direction: ${formatCreativeDirection(projectCharter.creativeDirection)}` : null,
    formatDesignStyleContract(designStyle),
    `Navigation plan: ${JSON.stringify(navigationPlan, null, 2)}`,
    `Token context: ${buildTokenPromptContext(designTokens, "compact_visual")}`,
    selectedElementHtml ? [
      "Selected navigation element:",
      "```html",
      selectedElementHtml,
      "```",
    ].join("\n") : null,
    [
      "Current shared navigation shell:",
      "```html",
      currentShellCode,
      "```",
    ].join("\n"),
  ].filter(Boolean).join("\n\n");

  if (llmLog) {
    const si = typeof policy.config.systemInstruction === "string" ? policy.config.systemInstruction : "";
    llmLog(`[LLM INPUT] nav-edit`, {
      model: policy.model,
      systemInstructionLength: si.length,
      systemInstruction: si,
      userTextLength: userText.length,
      userText,
    });
  }

  const response = await ai.models.generateContent({
    model: policy.model,
    contents: { parts: [{ text: userText }] },
    config: policy.config,
  });

  if (llmLog && response.usageMetadata) {
    llmLog(`[TOKEN USAGE] nav-edit`, response.usageMetadata as Record<string, unknown>);
  }

  const rawNextCode = extractCode(response.text || "").trim();
  const nextCompletion = validateSourceCompletion({ code: rawNextCode, requireSentinel: true });
  if (!nextCompletion.valid) {
    throw new Error(`Navigation edit returned incomplete markup: ${nextCompletion.issues.join(" | ")}`);
  }
  const nextCode = stripGenerationCompleteSentinel(rawNextCode);
  if (!validateNavigationShell(nextCode, navigationPlan)) {
    throw new Error("Navigation edit did not return valid shared navigation markup.");
  }

  return refineNavigationShellCode({
    prompt,
    candidateShellCode: nextCode,
    navigationPlan,
    designTokens,
    designStyle,
    projectCharter,
    llmLog,
  });
}

export async function buildNavigationShellCode({
  navigationPlan,
  designTokens,
  prompt,
  image: _image,
  referenceMode: _referenceMode,
  referenceId: _referenceId,
  designStyle,
  projectCharter,
  llmLog,
}: {
  navigationPlan: NavigationPlan;
  designTokens?: DesignTokens | null;
  prompt: string;
  image?: PromptImagePayload | null;
  referenceMode?: ReferenceMode | null;
  referenceId?: string | null;
  designStyle?: DesignStylePack | null;
  projectCharter?: ProjectCharter | null;
  llmLog?: LlmLogFn;
}) {
  if (!navigationPlan.enabled || navigationPlan.kind === "none") {
    return "";
  }

  const deterministicShellCode = renderDeterministicNavigationShell(navigationPlan);
  if (!validateNavigationShell(deterministicShellCode, navigationPlan)) {
    console.error("[navigation] Deterministic navigation shell failed validation", {
      navigationItemIds: navigationPlan.items.map((item) => item.id),
    });
    return deterministicShellCode;
  }

  try {
    return await refineNavigationShellCode({
      prompt,
      candidateShellCode: deterministicShellCode,
      navigationPlan,
      designTokens,
      designStyle,
      projectCharter,
      llmLog,
    });
  } catch (error) {
    console.warn("[navigation] Optional navigation refinement failed; using deterministic shell", {
      error: error instanceof Error ? error.message : String(error),
    });
    return deterministicShellCode;
  }
}
