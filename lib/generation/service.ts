import "server-only";

import { z } from "zod";

import { createGeminiClient } from "@/lib/ai/gemini";
import { hasApprovedDesignTokens, normalizeDesignTokens } from "@/lib/design-tokens";
import { applyEdits } from "@/lib/diff-engine";
import { buildScopedEditContext } from "@/lib/generation/block-index";
import { createNavigationArchitecture, deriveRequiresBottomNav, resolveScreenChromePolicy } from "@/lib/navigation";
import {
  applyNavigationPlanToScreens,
  normalizeNavigationPlan,
  validateNavigationShell,
} from "@/lib/project-navigation";
import {
  buildSystemInstruction,
  buildEditSystemInstruction,
  creativeDirectionInstruction,
  designInstruction,
  plannerInstruction,
  referenceAnalysisInstruction,
} from "@/lib/generation/prompts";
import { appendRequiredAnchors, extractRequiredAnchors } from "@/lib/generation/screen-quality";
import { buildRepairSurroundingContext, type RepairTarget } from "@/lib/generation/screen-repair";
import { buildTokenPromptContext } from "@/lib/token-runtime";
import type {
  BuildScreenInput,
  CreativeDirection,
  DesignTokenMetadata,
  DesignTokenValues,
  DesignTokens,
  Message,
  NavigationArchitecture,
  NavigationPlan,
  PlanningMode,
  PlannedUiFlow,
  PromptImagePayload,
  ProjectCharter,
  ScreenBlockIndex,
  ScreenPlan,
} from "@/lib/types";

const ScreenPlanSchema = z.object({
  name: z.string().trim().min(1).max(100),
  type: z.enum(["root", "detail"]).default("detail"),
  description: z.string().trim().min(1).max(8000),
  chrome_policy: z.object({
    chrome: z.enum(["bottom-tabs", "top-bar", "top-bar-back", "modal-sheet", "immersive"]),
    show_primary_navigation: z.boolean().optional(),
    shows_back_button: z.boolean().optional(),
  }).optional(),
});

const NavigationArchitectureSchema = z.object({
  kind: z.enum(["bottom-tabs-app", "hierarchical", "single-screen"]),
  primary_navigation: z.enum(["bottom-tabs", "none"]).default("none"),
  root_chrome: z.enum(["bottom-tabs", "top-bar", "top-bar-back", "modal-sheet", "immersive"]),
  detail_chrome: z.enum(["bottom-tabs", "top-bar", "top-bar-back", "modal-sheet", "immersive"]),
  consistency_rules: z.array(z.string().trim().min(1).max(500)).min(1).max(10),
  rationale: z.string().trim().min(1).max(2400),
});

const NavigationPlanSchema = z.object({
  enabled: z.boolean(),
  kind: z.enum(["bottom-tabs", "none"]),
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
    chrome: z.enum(["bottom-tabs", "top-bar", "top-bar-back", "modal-sheet", "immersive"]),
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
  requires_bottom_nav: z.boolean().optional(),
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
  const numeric = prompt.match(/\b(?:generate|create|build|make|design)?\s*(\d{1,2})[-\s]*(?:screen|screens|page|pages)\b/i);
  if (numeric) {
    return Number(numeric[1]);
  }

  const word = prompt.match(/\b(one|two|three|four|five|six|seven|eight)[-\s]*(?:screen|screens|page|pages)\b/i);
  if (word) {
    return NUMBER_WORDS[word[1].toLowerCase()] ?? null;
  }

  return null;
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
    const sectionText = prompt.slice(start, end).trim();
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
    chromePolicy: explicitSectionChromePolicy(section, index, forceNoPersistentNav) ?? existing?.chromePolicy ?? null,
  };
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
  referenceAnalysis,
  creativeDirection,
  navigationArchitecture,
  existingCharter,
}: {
  prompt: string;
  image?: PromptImagePayload | null;
  referenceAnalysis?: ReferenceAnalysis | null;
  creativeDirection?: CreativeDirection | null;
  navigationArchitecture: NavigationArchitecture;
  existingCharter?: ProjectCharter | null;
}): ProjectCharter => ({
  originalPrompt: prompt.trim() || existingCharter?.originalPrompt || "Create a polished mobile app experience from the provided reference.",
  imageReferenceSummary: image
    ? referenceAnalysis
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
    : existingCharter?.designRationale ?? "Prioritize clarity, mobile ergonomics, and a coherent design system that can scale across future screens.",
  creativeDirection: creativeDirection === undefined
    ? existingCharter?.creativeDirection ?? fallbackCreativeDirection({ prompt, referenceAnalysis })
    : creativeDirection,
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
  navigationArchitecture,
  diagnostics,
}: {
  base: ProjectCharter;
  source: NonNullable<ProjectCharter["charterSource"]>;
  referenceAnalysis?: ReferenceAnalysis | null;
  navigationArchitecture: NavigationArchitecture;
  diagnostics?: ProjectCharter["planningDiagnostics"] | null;
}): ProjectCharter => ({
  ...base,
  imageReferenceSummary: base.imageReferenceSummary
    ?? (referenceAnalysis ? `Use the uploaded reference as a structural and stylistic blueprint. ${referenceAnalysis.overallVisualStyle}` : null),
  navigationArchitecture,
  referenceScreens: base.referenceScreens?.length ? base.referenceScreens : referenceScreensForCharter(referenceAnalysis),
  designSystemSignals: base.designSystemSignals ?? referenceAnalysis?.designSystemSignals ?? null,
  planningDiagnostics: diagnostics ?? base.planningDiagnostics ?? { source },
  charterSource: source,
});

const salvageProjectCharterFromRawPlan = ({
  rawPlan,
  prompt,
  image,
  referenceAnalysis,
  creativeDirection,
  navigationArchitecture,
  existingCharter,
  diagnostics,
}: {
  rawPlan: unknown;
  prompt: string;
  image?: PromptImagePayload | null;
  referenceAnalysis?: ReferenceAnalysis | null;
  creativeDirection?: CreativeDirection | null;
  navigationArchitecture: NavigationArchitecture;
  existingCharter?: ProjectCharter | null;
  diagnostics: NonNullable<ProjectCharter["planningDiagnostics"]>;
}): ProjectCharter => {
  const fallback = fallbackProjectCharter({
    prompt,
    image,
    referenceAnalysis,
    creativeDirection,
    navigationArchitecture,
    existingCharter,
  });

  if (!isRecord(rawPlan) || !isRecord(rawPlan.charter)) {
    return enrichProjectCharter({
      base: fallback,
      source: "reference_fallback",
      referenceAnalysis,
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
    },
    source: "partial_planner",
    referenceAnalysis,
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

const coerceScreenPlanFromRawItem = (item: unknown): ScreenPlan | null => {
  const parsed = ScreenPlanSchema.safeParse(item);
  if (parsed.success) {
    return {
      name: parsed.data.name,
      type: parsed.data.type,
      description: parsed.data.description,
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

  const rawType = typeof item.type === "string" ? item.type.toLowerCase() : "";
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

  return {
    name,
    type: rawType === "root" ? "root" : "detail",
    description,
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
  if (Array.isArray(raw.screens)) {
    const validScreens: ScreenPlan[] = [];
    for (const item of raw.screens) {
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
  const requiresBottomNav = typeof raw.requires_bottom_nav === "boolean" ? raw.requires_bottom_nav : null;

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
}: {
  prompt: string;
  image?: PromptImagePayload | null;
}) {
  const inlineImage = toInlineImage(image);
  if (!inlineImage) {
    return null;
  }

  try {
    const ai = createGeminiClient();
    const parts: Array<Record<string, unknown>> = [inlineImage];

    parts.push({
      text: prompt.trim()
        ? `User/Product Intent: "${prompt}"`
        : "Analyze the mobile UI reference image and describe the visible screen anatomy.",
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: { parts },
      config: {
        systemInstruction: referenceAnalysisInstruction,
        responseMimeType: "application/json",
        temperature: 0.1,
      },
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
  referenceAnalysis,
}: {
  prompt: string;
  image?: PromptImagePayload | null;
  referenceAnalysis?: ReferenceAnalysis | null;
}): Promise<ParsedCreativeDirection | null> {
  try {
    const ai = createGeminiClient();
    const parts: Array<Record<string, unknown>> = [];
    const inlineImage = toInlineImage(image);

    if (inlineImage) {
      parts.push(inlineImage);
    }

    parts.push({
      text: prompt.trim()
        ? `Product Brief: "${prompt}"`
        : "Invent a premium mobile product design direction from the available cues.",
    });

    if (referenceAnalysis) {
      parts.push({
        text: `Reference Screen Analysis:\n${formatReferenceAnalysis(referenceAnalysis)}`,
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: { parts },
      config: {
        systemInstruction: creativeDirectionInstruction,
        responseMimeType: "application/json",
        temperature: 0.35,
      },
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
  designTokens,
  projectContext,
  existingCharter,
  existingNavigationPlan,
  planningMode = "project",
}: {
  prompt: string;
  image?: PromptImagePayload | null;
  designTokens?: DesignTokens | null;
  projectContext?: string | null;
  existingCharter?: ProjectCharter | null;
  existingNavigationPlan?: NavigationPlan | null;
  planningMode?: PlanningMode;
}): Promise<PlannedUiFlow> {
  const ai = createGeminiClient();
  const parts: Array<Record<string, unknown>> = [];
  const referenceAnalysis = await analyzeReferenceImage({ prompt, image });
  const explicitScreenSections = parseExplicitScreenSections(prompt);
  const requestedScreenCount = parseRequestedScreenCount(prompt);
  const forceFiniteFlowWithoutPersistentNav = looksLikeFiniteFlowWithoutPersistentNav(prompt, explicitScreenSections);
  const fallbackRequiresBottomNav = inferLegacyRequiresBottomNav({
    prompt,
    planningMode,
    referenceAnalysis,
  });
  const creativeDirection = projectContext?.trim()
    ? null
    : await generateCreativeDirection({
        prompt,
        image,
        referenceAnalysis,
      });
  const resolvedCreativeDirection = projectContext?.trim()
    ? null
    : creativeDirection ?? fallbackCreativeDirection({ prompt, referenceAnalysis });

  const inlineImage = toInlineImage(image);
  if (inlineImage) {
    parts.push(inlineImage);
  }

  parts.push({
    text: prompt.trim() ? `User Prompt: "${prompt}"` : "Convert this sketch or reference UI in the image into a high-fidelity mobile UI.",
  });

  if (planningMode !== "single-screen" && (requestedScreenCount || explicitScreenSections.length > 0)) {
    parts.push({
      text: [
        "Explicit screen-count contract:",
        requestedScreenCount ? `- The user requested exactly ${requestedScreenCount} screen${requestedScreenCount === 1 ? "" : "s"}. Return that many screens unless the prompt itself contains fewer named screens.` : null,
        explicitScreenSections.length > 0
          ? `- The user explicitly named these screens. Preserve them in order: ${explicitScreenSections.map((section) => `Screen ${section.index}: ${section.name}`).join("; ")}.`
          : null,
        forceFiniteFlowWithoutPersistentNav
          ? "- This reads as a finite flow with onboarding/detail-style screens, not a peer bottom-tab app. Do not force persistent navigation unless the prompt explicitly asks for tabs/navigation."
          : null,
      ].filter(Boolean).join("\n"),
    });
  }

  if (referenceAnalysis) {
    parts.push({
      text: `Reference Screen Analysis:\n${formatReferenceAnalysis(referenceAnalysis)}`,
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

  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-lite-preview",
    contents: { parts },
    config: {
      systemInstruction: plannerInstruction,
      responseMimeType: "application/json",
      temperature: 0.1,
    },
  });

  const rawPlan = parseJsonResponse<unknown>(response.text || "{}");
  const parsed = PlanSchema.safeParse(rawPlan);

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

    const navigationArchitecture = forceFiniteFlowWithoutPersistentNav
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
    const screens = ensureBuilderGradeScreenBriefs({
      referenceAnalysis,
      screens: reconcileScreensWithPrompt({
        prompt,
        screens: rawScreens,
        planningMode,
      }).map((screenPlan) => resolvePlannedScreen({ screenPlan, navigationArchitecture })),
    });
    const navigationPlan = normalizeNavigationPlan({
      navigationPlan: forceFiniteFlowWithoutPersistentNav ? null : salvaged.navigationPlan ?? (planningMode === "single-screen" ? existingNavigationPlan : null),
      screens,
      navigationArchitecture,
      requiresBottomNav: deriveRequiresBottomNav(navigationArchitecture),
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
        referenceAnalysis,
        creativeDirection: resolvedCreativeDirection,
        navigationArchitecture,
        existingCharter,
        diagnostics: planningDiagnostics,
      }),
      screens: plannedScreens,
    };
  }

  const navigationArchitecture = forceFiniteFlowWithoutPersistentNav
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
      navigationArchitecture,
    },
    source: "planner",
    referenceAnalysis,
    navigationArchitecture,
    diagnostics: {
      source: "planner",
      rawPlanKeys: isRecord(rawPlan) ? Object.keys(rawPlan) : [],
      rawScreenCount: parsed.data.screens.length,
      recoveredScreens: parsed.data.screens.length,
    },
  });

  const parsedScreens = planningMode === "single-screen" ? parsed.data.screens.slice(0, 1) : parsed.data.screens;
  const rawScreens = parsedScreens.map((screenPlan) => ({
    name: screenPlan.name,
    type: screenPlan.type,
    description: screenPlan.description,
    chromePolicy: screenPlan.chrome_policy
      ? {
          chrome: screenPlan.chrome_policy.chrome,
          showPrimaryNavigation: screenPlan.chrome_policy.show_primary_navigation ?? false,
          showsBackButton: screenPlan.chrome_policy.shows_back_button ?? false,
        }
      : null,
  }));
  const screens = ensureBuilderGradeScreenBriefs({
    referenceAnalysis,
    screens: reconcileScreensWithPrompt({
      prompt,
      screens: rawScreens,
      planningMode,
    }).map((screenPlan) => resolvePlannedScreen({
      screenPlan: {
        name: screenPlan.name,
        type: screenPlan.type,
        description: screenPlan.description,
        chromePolicy: screenPlan.chromePolicy ?? null,
      },
      navigationArchitecture,
    })),
  });
  const navigationPlan = normalizeNavigationPlan({
    navigationPlan: forceFiniteFlowWithoutPersistentNav ? null : toNavigationPlan(parsed.data.navigation_plan) ?? (planningMode === "single-screen" ? existingNavigationPlan : null),
    screens,
    navigationArchitecture,
    requiresBottomNav: deriveRequiresBottomNav(navigationArchitecture),
  });
  const plannedScreens = applyNavigationPlanToScreens(screens, navigationPlan);

  return {
    requiresBottomNav: deriveRequiresBottomNav(navigationArchitecture),
    navigationArchitecture,
    navigationPlan,
    charter,
    screens: plannedScreens,
  };
}

export async function generateDesignTokens({
  prompt,
  image,
}: {
  prompt: string;
  image?: PromptImagePayload | null;
}) {
  try {
    const ai = createGeminiClient();
    const parts: Array<Record<string, unknown>> = [];
    const referenceAnalysis = await analyzeReferenceImage({ prompt, image });
    const creativeDirection = (await generateCreativeDirection({
      prompt,
      image,
      referenceAnalysis,
    })) ?? fallbackCreativeDirection({ prompt, referenceAnalysis });

    const inlineImage = toInlineImage(image);
    if (inlineImage) {
      parts.push(inlineImage);
    }

    parts.push({
      text: prompt.trim()
        ? `User Prompt & Design Constraints: "${prompt}"`
        : "Create a modern, clean design system for a premium mobile app.",
    });

    if (referenceAnalysis) {
      parts.push({
        text: `Reference Screen Analysis:\n${formatReferenceAnalysis(referenceAnalysis)}`,
      });
    }

    parts.push({
      text: `Creative Direction:\n${formatCreativeDirection(creativeDirection)}`,
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: { parts },
      config: {
        systemInstruction: designInstruction,
        responseMimeType: "application/json",
        temperature: 0.35,
      },
    });

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

  const inlineImage = toInlineImage(input.image);
  if (inlineImage) {
    parts.push(inlineImage);
    parts.push({
      text: "Use the uploaded sketch or wireframe for layout inspiration while still honoring the provided design tokens.",
    });
  }

  parts.push({
    text: `Build the UI for ${input.screenPlan.name}. Original context prompt: "${input.prompt || "No overarching prompt provided."}"`,
  });

  if (input.projectContext?.trim()) {
    parts.push({
      text: `Existing Project Memory:\n${input.projectContext}`,
    });
  }

  const responseStream = await ai.models.generateContentStream({
    model: "gemini-3.1-flash-lite-preview",
    contents: { parts },
    config: {
      systemInstruction: buildSystemInstruction({
        designTokens: input.designTokens,
        screenPlan: input.screenPlan,
        requiresBottomNav: input.requiresBottomNav,
        navigationArchitecture: input.navigationArchitecture,
        navigationPlan: input.navigationPlan,
      }),
      temperature: 0.2,
    },
  });

  for await (const chunk of responseStream) {
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
}) {
  const ai = createGeminiClient();
  const history = messages.map((message) => ({
    role: message.role === "model" ? "model" : "user",
    parts: [{ text: message.content }],
  }));

  const chat = ai.chats.create({
    model: "gemini-3.1-flash-lite-preview",
    history,
    config: {
      systemInstruction: buildEditSystemInstruction({ designTokens, navigationArchitecture }),
      temperature: 0.7,
    },
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
      selectedElementDrawgleId ? `Stable source target: data-drawgle-id="${selectedElementDrawgleId}". Prefer matching this attribute in <search> blocks.` : null,
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

  for await (const chunk of responseStream) {
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
}) {
  const ai = createGeminiClient();
  const surrounding = buildRepairSurroundingContext(currentCode, repairTarget);
  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-lite-preview",
    contents: {
      parts: [{
        text: [
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
        ].filter(Boolean).join("\n\n"),
      }],
    },
    config: {
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
    },
  });

  return extractCode(response.text || "").trim();
}

const staticHtmlOutputRules = [
  "Return ONLY static HTML. Do not include markdown fences, scripts, html/head/body tags, React, JSX, JavaScript expressions, arrays, .map(...), arrow functions, template literals, className, class={...}, style={{...}}, or data attributes with {...}.",
  "Manually expand repeated items into concrete HTML elements. If there are seven days, output seven day elements. If there are three cards, output three card elements.",
  "Use Tailwind classes, Drawgle token utility classes, and normal quoted HTML attributes only. Inline style is allowed only as a normal string, e.g. style=\"height: 60%\".",
  "Use Lucide icons with <i data-lucide=\"icon-name\"></i> or inline SVG. Do not include a script to initialize icons.",
  "Do not add phone frames, status bars, html/head/body, or persistent shared bottom navigation.",
];

export async function buildSourceRegionReplacementCode({
  screenName,
  screenPrompt,
  userPrompt,
  currentCode,
  repairTarget,
  designTokens,
  projectCharter,
  navigationArchitecture,
}: {
  screenName: string;
  screenPrompt: string;
  userPrompt: string;
  currentCode: string;
  repairTarget: RepairTarget;
  designTokens?: DesignTokens | null;
  projectCharter?: ProjectCharter | null;
  navigationArchitecture?: NavigationArchitecture | null;
}) {
  const ai = createGeminiClient();
  const surrounding = buildRepairSurroundingContext(currentCode, repairTarget);
  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-lite-preview",
    contents: {
      parts: [{
        text: [
          `Screen name: ${screenName}`,
          `User edit request: ${userPrompt.trim() || "Improve the selected region."}`,
          `Original screen brief:\n${screenPrompt || "No original screen prompt was saved."}`,
          projectCharter?.creativeDirection ? `Creative direction:\n${formatCreativeDirection(projectCharter.creativeDirection)}` : null,
          `Navigation architecture:\n${JSON.stringify(navigationArchitecture ?? null, null, 2)}`,
          `Token context:\n${buildTokenPromptContext(designTokens, repairTarget.snippet.length > 6000 ? "full_generation" : "compact_visual")}`,
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
        ].filter(Boolean).join("\n\n"),
      }],
    },
    config: {
      temperature: 0.26,
      systemInstruction: [
        "You replace exactly one selected region inside an existing mobile screen.",
        "Return ONLY the replacement HTML for that selected region. The caller will splice it into the original source by offsets.",
        "Satisfy the user's edit request while preserving the surrounding screen's visual language, spacing rhythm, tokens, and content intent.",
        "The replacement must fit between the provided before/after context and should keep the same semantic role unless the user asks to change that region's role.",
        ...staticHtmlOutputRules,
      ].join("\n"),
    },
  });

  return extractCode(response.text || "").trim();
}

export async function buildFullScreenReconstructionCode({
  screenPlan,
  userPrompt,
  currentCode,
  designTokens,
  projectCharter,
  navigationArchitecture,
  navigationPlan,
}: {
  screenPlan: ScreenPlan;
  userPrompt?: string | null;
  currentCode: string;
  designTokens?: DesignTokens | null;
  projectCharter?: ProjectCharter | null;
  navigationArchitecture?: NavigationArchitecture | null;
  navigationPlan?: NavigationPlan | null;
}) {
  const ai = createGeminiClient();
  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-lite-preview",
    contents: {
      parts: [{
        text: [
          `User request: ${userPrompt?.trim() || "Reconstruct the broken screen as production-ready static HTML."}`,
          projectCharter?.originalPrompt ? `Original project prompt:\n${projectCharter.originalPrompt}` : null,
          projectCharter?.creativeDirection ? `Creative direction:\n${formatCreativeDirection(projectCharter.creativeDirection)}` : null,
          [
            "Current broken source, for visual/content intent only. Do not preserve invalid JSX, duplicated fragments, scripts, or broken structure:",
            "```html",
            currentCode.slice(0, 14000),
            "```",
          ].join("\n"),
        ].filter(Boolean).join("\n\n"),
      }],
    },
    config: {
      temperature: 0.24,
      systemInstruction: [
        buildSystemInstruction({
          designTokens,
          screenPlan,
          requiresBottomNav: Boolean(navigationPlan?.enabled),
          navigationArchitecture,
          navigationPlan,
        }),
        "",
        "FULL-SCREEN RECONSTRUCTION MODE:",
        "The existing source is invalid or unrecoverable. Rebuild the complete screen from the screen brief, project direction, tokens, and useful visible intent in the broken source.",
        "Return one complete static screen root. Do not append to or duplicate the old source.",
        ...staticHtmlOutputRules,
      ].join("\n"),
    },
  });

  return extractCode(response.text || "").trim();
}

const navigationDesignQualityRules = [
  "Treat quality as a critique standard, not a fixed visual recipe. Do not reuse a default dock, pill, tab bar, or layout pattern unless it is the right answer for this specific project.",
  "Infer the navigation anatomy from the user's request, project type, reference/style context, design tokens, and current screen language. The result may be full-width, floating, asymmetric, glassy, compact, expanded, action-led, text-led, icon-led, or another appropriate mobile nav form.",
  "Use the project's live token utility classes and CSS variables for canonical color, radius, elevation, typography, spacing, and icon treatment. Do not freeze project token values as raw hex/pixels unless it is a deliberate one-off detail.",
  "Preserve every planned label and data-nav-item-id exactly unless the user explicitly asks to rename, hide, add, or remove navigation items.",
  "Preserve the planned icon meanings unless the user explicitly asks for different icons.",
  "Check the tap target comfort, label legibility, active-state clarity, and visual harmony with the screen behind it.",
  "Do not add fake screen spacers or placeholder blocks. The renderer owns fixed placement; the nav shell owns only its own visual design.",
  "The renderer only sets data-active at runtime. All active/inactive visuals must be encoded in the nav HTML/CSS itself.",
];

async function refineNavigationShellCode({
  prompt,
  candidateShellCode,
  navigationPlan,
  designTokens,
  projectCharter,
}: {
  prompt: string;
  candidateShellCode: string;
  navigationPlan: NavigationPlan;
  designTokens?: DesignTokens | null;
  projectCharter?: ProjectCharter | null;
}) {
  const ai = createGeminiClient();
  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-lite-preview",
    contents: {
      parts: [{
        text: [
          `User navigation request: ${prompt}`,
          projectCharter ? `Project charter: ${JSON.stringify(projectCharter, null, 2)}` : null,
          projectCharter?.creativeDirection ? `Creative direction: ${formatCreativeDirection(projectCharter.creativeDirection)}` : null,
          `Navigation plan: ${JSON.stringify(navigationPlan, null, 2)}`,
          `Token context: ${buildTokenPromptContext(designTokens, "compact_visual")}`,
          [
            "Candidate navigation shell to critique and improve:",
            "```html",
            candidateShellCode,
            "```",
          ].join("\n"),
        ].filter(Boolean).join("\n\n"),
      }],
    },
    config: {
      temperature: 0.18,
      systemInstruction: [
        "You are the final design QA pass for a shared mobile navigation shell.",
        "Return ONLY the full improved replacement HTML for the nav shell.",
        "Keep the same one <nav data-drawgle-primary-nav> root and all planned data-nav-item-id values.",
        ...navigationDesignQualityRules,
        "If the candidate already meets the bar, return it with only small polish. If it looks amateur, rebuild it while honoring the user request and project tokens.",
      ].join("\n"),
    },
  });

  const refinedCode = extractCode(response.text || "").trim();
  return validateNavigationShell(refinedCode, navigationPlan) ? refinedCode : candidateShellCode;
}

export async function editNavigationShellCode({
  prompt,
  currentShellCode,
  navigationPlan,
  designTokens,
  projectCharter,
  selectedElementHtml,
}: {
  prompt: string;
  currentShellCode: string;
  navigationPlan: NavigationPlan;
  designTokens?: DesignTokens | null;
  projectCharter?: ProjectCharter | null;
  selectedElementHtml?: string | null;
}) {
  if (!navigationPlan.enabled || navigationPlan.kind === "none") {
    throw new Error("This project does not have shared navigation enabled.");
  }

  const ai = createGeminiClient();
  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-lite-preview",
    contents: {
      parts: [{
        text: [
          `User navigation edit request: ${prompt}`,
          projectCharter ? `Project charter: ${JSON.stringify(projectCharter, null, 2)}` : null,
          projectCharter?.creativeDirection ? `Creative direction: ${formatCreativeDirection(projectCharter.creativeDirection)}` : null,
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
        ].filter(Boolean).join("\n\n"),
      }],
    },
    config: {
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
        ...navigationDesignQualityRules,
      ].join("\n"),
    },
  });

  const nextCode = extractCode(response.text || "").trim();
  if (!validateNavigationShell(nextCode, navigationPlan)) {
    throw new Error("Navigation edit did not return valid shared navigation markup.");
  }

  return refineNavigationShellCode({
    prompt,
    candidateShellCode: nextCode,
    navigationPlan,
    designTokens,
    projectCharter,
  });
}

export async function buildNavigationShellCode({
  navigationPlan,
  designTokens,
  prompt,
  image,
  projectCharter,
}: {
  navigationPlan: NavigationPlan;
  designTokens?: DesignTokens | null;
  prompt: string;
  image?: PromptImagePayload | null;
  projectCharter?: ProjectCharter | null;
}) {
  if (!navigationPlan.enabled || navigationPlan.kind === "none") {
    return "";
  }

  try {
    const ai = createGeminiClient();
    const parts: Array<Record<string, unknown>> = [];
    const inlineImage = toInlineImage(image);

    if (inlineImage) {
      parts.push(inlineImage);
      parts.push({
        text: "Reference image: inspect the bottom navigation treatment, shell placement, icon/label style, material, radius, elevation, active state, and how it relates to the screen content. Recreate the navigation style family, not just the tab labels.",
      });
    }

    parts.push({
      text: [
        `Project prompt: ${prompt || "No prompt provided."}`,
        projectCharter ? `Project charter: ${JSON.stringify(projectCharter, null, 2)}` : null,
        projectCharter?.creativeDirection ? `Creative direction: ${formatCreativeDirection(projectCharter.creativeDirection)}` : null,
        `Navigation plan: ${JSON.stringify(navigationPlan, null, 2)}`,
        `Token context: ${buildTokenPromptContext(designTokens, "full_generation")}`,
      ].filter(Boolean).join("\n\n"),
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: { parts },
      config: {
        temperature: 0.28,
        systemInstruction: [
          "You are an elite mobile product designer building the single shared bottom navigation shell for a mobile app preview system.",
          "Return ONLY valid HTML for the navigation shell. Do not include markdown fences, html, head, body, scripts, or the screen content.",
          "The nav must be project-specific and must follow the provided navigation plan and design tokens.",
          "Use the reference image and creative direction as high-priority visual evidence. If the reference uses a compact tab rail, floating dock, glass pill, sculpted card, or minimal bottom text/icon row, match that style family.",
          "Avoid generic 2015 bottom tabs: no plain full-width white rectangle with evenly spaced gray icons unless the reference clearly shows that.",
          "Use one <nav data-drawgle-primary-nav> root. The nav root may be full-width, a floating dock, a compact action nav, or another bottom navigation form that fits the project.",
          "Each item must be a button or anchor with data-nav-item-id exactly matching the plan item id.",
          "Use Lucide icons with <i data-lucide=\"icon-name\"></i>.",
          "The renderer mounts the shell in a fixed bottom viewport host. The HTML you return owns the nav's visual geometry, width, radius, surface, spacing, and active state.",
          "Make active/inactive states explicit through data-active=true selectors, utility classes, or inline CSS variables. The renderer will set data-active at runtime.",
          "Do not hard-code generic tab labels. Use only the planned item labels and preserve them exactly.",
          ...navigationDesignQualityRules,
        ].join("\n"),
      },
    });

    const code = extractCode(response.text || "").trim();
    if (!validateNavigationShell(code, navigationPlan)) {
      throw new Error("Navigation shell generation did not produce valid project navigation markup.");
    }

    return refineNavigationShellCode({
      prompt,
      candidateShellCode: code,
      navigationPlan,
      designTokens,
      projectCharter,
    });
  } catch (error) {
    console.error("Failed to generate navigation shell", error);
    throw error instanceof Error
      ? error
      : new Error("Failed to generate navigation shell.");
  }
}
