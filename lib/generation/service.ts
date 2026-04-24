import "server-only";

import { z } from "zod";

import { createGeminiClient } from "@/lib/ai/gemini";
import { hasApprovedDesignTokens, normalizeDesignTokens } from "@/lib/design-tokens";
import { applyEdits } from "@/lib/diff-engine";
import { buildScopedEditContext } from "@/lib/generation/block-index";
import { createNavigationArchitecture, deriveRequiresBottomNav, resolveScreenChromePolicy } from "@/lib/navigation";
import {
  buildSystemInstruction,
  buildEditSystemInstruction,
  creativeDirectionInstruction,
  designInstruction,
  plannerInstruction,
  referenceAnalysisInstruction,
} from "@/lib/generation/prompts";
import type {
  BuildScreenInput,
  CreativeDirection,
  DesignTokenMetadata,
  DesignTokenValues,
  DesignTokens,
  Message,
  NavigationArchitecture,
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
      rationale: z.object({
        color: z.string().trim().max(1200).optional(),
        typography: z.string().trim().max(1200).optional(),
        spacing: z.string().trim().max(1200).optional(),
        radii: z.string().trim().max(1200).optional(),
        shadows: z.string().trim().max(1200).optional(),
        surfaces: z.string().trim().max(1200).optional(),
      }).partial().optional(),
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
        title_large: TypographyScaleSchema.optional(),
        title_main: TypographyScaleSchema.optional(),
        body_primary: TypographyScaleSchema.optional(),
        body_secondary: TypographyScaleSchema.optional(),
        caption: TypographyScaleSchema.optional(),
        button_label: TypographyScaleSchema.optional(),
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
  requiresBottomNav: boolean | null;
} => {
  const empty = { screens: [], navigationArchitecture: null, requiresBottomNav: null };

  if (!isRecord(rawPlan)) {
    return empty;
  }

  const raw = rawPlan as Record<string, unknown>;

  // --- screens ---
  let screens: ScreenPlan[] = [];
  if (Array.isArray(raw.screens)) {
    const validScreens: ScreenPlan[] = [];
    for (const item of raw.screens) {
      const parsed = ScreenPlanSchema.safeParse(item);
      if (parsed.success) {
        validScreens.push({
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
        });
      } else {
        console.warn(
          "[salvageScreensFromRawPlan] Skipping invalid screen",
          {
            screenName: isRecord(item) ? (item as Record<string, unknown>).name : "unknown",
            issues: parsed.error.issues.map((i) => i.path.join(".") + ": " + i.message),
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

  // --- requires_bottom_nav ---
  const requiresBottomNav = typeof raw.requires_bottom_nav === "boolean" ? raw.requires_bottom_nav : null;

  return { screens, navigationArchitecture, requiresBottomNav };
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
      model: "gemini-3-flash-preview",
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
      model: "gemini-3-flash-preview",
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
  planningMode = "project",
}: {
  prompt: string;
  image?: PromptImagePayload | null;
  designTokens?: DesignTokens | null;
  projectContext?: string | null;
  existingCharter?: ProjectCharter | null;
  planningMode?: PlanningMode;
}): Promise<PlannedUiFlow> {
  const ai = createGeminiClient();
  const parts: Array<Record<string, unknown>> = [];
  const referenceAnalysis = await analyzeReferenceImage({ prompt, image });
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
      text: `Approved Design Tokens:\n${JSON.stringify(designTokens.tokens, null, 2)}`,
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
    model: "gemini-3-flash-preview",
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
    // -----------------------------------------------------------------------
    // DIAGNOSTIC: Log the exact Zod issues so silent fallbacks become visible.
    // -----------------------------------------------------------------------
    console.error(
      "[planUiFlow] PlanSchema validation failed — attempting screen salvage",
      {
        zodIssues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          code: issue.code,
          message: issue.message,
        })),
        rawPlanKeys: isRecord(rawPlan) ? Object.keys(rawPlan) : typeof rawPlan,
        rawScreenCount: isRecord(rawPlan) && Array.isArray((rawPlan as Record<string, unknown>).screens)
          ? ((rawPlan as Record<string, unknown>).screens as unknown[]).length
          : 0,
      },
    );

    // -------------------------------------------------------------------
    // SALVAGE: Try to independently recover the screens array even though
    // the full plan schema failed (e.g. a charter field was too long).
    // -------------------------------------------------------------------
    const salvaged = salvageScreensFromRawPlan(rawPlan);

    const navigationArchitecture = coerceNavigationArchitecture({
      parsedNavigationArchitecture: salvaged.navigationArchitecture,
      existingNavigationArchitecture: existingCharter?.navigationArchitecture,
      requiresBottomNav: salvaged.requiresBottomNav ?? fallbackRequiresBottomNav,
      lockToExistingArchitecture: Boolean(projectContext?.trim() && existingCharter?.navigationArchitecture),
    });

    const salvageSource = salvaged.screens.length > 0 ? "salvaged" : "fallback";
    const screens = salvaged.screens.length > 0
      ? salvaged.screens.map((screenPlan) => resolvePlannedScreen({ screenPlan, navigationArchitecture }))
      : fallbackScreensFromReference({
          prompt,
          planningMode,
          referenceAnalysis,
        }).map((screenPlan) => resolvePlannedScreen({ screenPlan, navigationArchitecture }));

    console.warn(
      `[planUiFlow] Using ${salvageSource} screens (${screens.length}) after PlanSchema failure`,
      { salvageSource, screenCount: screens.length, screenNames: screens.map((s) => s.name) },
    );

    return {
      requiresBottomNav: deriveRequiresBottomNav(navigationArchitecture),
      navigationArchitecture,
      charter: fallbackProjectCharter({
        prompt,
        image,
        referenceAnalysis,
        creativeDirection: resolvedCreativeDirection,
        navigationArchitecture,
        existingCharter,
      }),
      screens,
    };
  }

  const navigationArchitecture = coerceNavigationArchitecture({
    parsedNavigationArchitecture: parsed.data.navigation_architecture ?? null,
    existingNavigationArchitecture: existingCharter?.navigationArchitecture,
    requiresBottomNav: parsed.data.requires_bottom_nav ?? fallbackRequiresBottomNav,
    lockToExistingArchitecture: Boolean(projectContext?.trim() && existingCharter?.navigationArchitecture),
  });

  const charter = {
    ...parsed.data.charter,
    creativeDirection: parsed.data.charter.creativeDirection ?? resolvedCreativeDirection,
    navigationArchitecture,
  };

  const parsedScreens = planningMode === "single-screen" ? parsed.data.screens.slice(0, 1) : parsed.data.screens;
  const screens = parsedScreens.map((screenPlan) => resolvePlannedScreen({
    screenPlan: {
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
    },
    navigationArchitecture,
  }));

  return {
    requiresBottomNav: deriveRequiresBottomNav(navigationArchitecture),
    navigationArchitecture,
    charter,
    screens,
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
      model: "gemini-3-flash-preview",
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
    model: "gemini-3-flash-preview",
    contents: { parts },
    config: {
      systemInstruction: buildSystemInstruction({
        designTokens: input.designTokens,
        screenPlan: input.screenPlan,
        requiresBottomNav: input.requiresBottomNav,
        navigationArchitecture: input.navigationArchitecture,
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
}: {
  messages: Array<Pick<Message, "role" | "content">>;
  screenCode: string;
  blockIndex?: ScreenBlockIndex | null;
  targetBlockIds?: string[];
  designTokens?: DesignTokens | null;
  navigationArchitecture?: NavigationArchitecture | null;
}) {
  const ai = createGeminiClient();
  const history = messages.map((message) => ({
    role: message.role === "model" ? "model" : "user",
    parts: [{ text: message.content }],
  }));

  const chat = ai.chats.create({
    model: "gemini-3-flash-preview",
    history,
    config: {
      systemInstruction: buildEditSystemInstruction({ designTokens, navigationArchitecture }),
      temperature: 0.7,
    },
  });

  const latestUserPrompt = [...messages].reverse().find((message) => message.role === "user")?.content ?? "";
  const scopedContext = blockIndex && targetBlockIds && targetBlockIds.length > 0
    ? buildScopedEditContext({
        screenCode,
        blockIndex,
        targetBlockIds,
      })
    : null;

  const editMessage = scopedContext
    ? [
        `User edit request: ${latestUserPrompt || "Apply the requested changes."}`,
        scopedContext,
        "Return ONLY <edit> blocks that match the provided snippets.",
      ].join("\n\n")
    : `Here is the current code:\n\n\`\`\`html\n${screenCode}\n\`\`\``;

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