import "server-only";

import { z } from "zod";

import { createGeminiClient } from "@/lib/ai/gemini";
import { applyEdits } from "@/lib/diff-engine";
import { buildScopedEditContext } from "@/lib/generation/block-index";
import {
  buildSystemInstruction,
  designInstruction,
  editInstruction,
  plannerInstruction,
  referenceAnalysisInstruction,
} from "@/lib/generation/prompts";
import type {
  BuildScreenInput,
  DesignTokens,
  Message,
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
});

const PlanSchema = z.object({
  requires_bottom_nav: z.boolean().default(false),
  charter: z.object({
    originalPrompt: z.string().trim().min(1).max(10000),
    imageReferenceSummary: z.string().trim().max(4000).nullable().optional(),
    appType: z.string().trim().min(1).max(120),
    targetAudience: z.string().trim().min(1).max(240),
    navigationModel: z.string().trim().min(1).max(240),
    keyFeatures: z.array(z.string().trim().min(1).max(240)).min(1).max(16),
    designRationale: z.string().trim().min(1).max(4000),
  }),
  screens: z.array(ScreenPlanSchema).min(1).max(8),
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

const DesignTokensSchema = z
  .object({
    system_schema: z.string().optional(),
    tokens: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

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

const fallbackScreenPlan = (prompt: string): ScreenPlan => ({
  name: "New Screen",
  type: "root",
  description: prompt.trim() || "Convert this concept into a polished mobile screen.",
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

const fallbackProjectCharter = ({
  prompt,
  image,
  referenceAnalysis,
}: {
  prompt: string;
  image?: PromptImagePayload | null;
  referenceAnalysis?: ReferenceAnalysis | null;
}): ProjectCharter => ({
  originalPrompt: prompt.trim() || "Create a polished mobile app experience from the provided reference.",
  imageReferenceSummary: image
    ? referenceAnalysis
      ? `Use the uploaded reference as a structural and stylistic blueprint. ${referenceAnalysis.overallVisualStyle}`
      : "Use the uploaded reference as inspiration for layout hierarchy, tone, and composition while adapting it into a polished product UI."
    : null,
  appType: "Mobile application",
  targetAudience: "General product users",
  navigationModel: "Single-root mobile flow",
  keyFeatures: ["Primary workflow", "Supporting detail views"],
  designRationale: referenceAnalysis
    ? `Prioritize clarity, mobile ergonomics, and a coherent design system that preserves this visual DNA: ${referenceAnalysis.designSystemSignals.palette} ${referenceAnalysis.designSystemSignals.surfaces} ${referenceAnalysis.designSystemSignals.typography}`
    : "Prioritize clarity, mobile ergonomics, and a coherent design system that can scale across future screens.",
});

export const getDefaultDesignTokens = (): DesignTokens => ({
  system_schema: "mobile_universal_core",
  tokens: {
    color: {
      background: {
        primary: "#ffffff",
        secondary: "#f9fafb",
      },
      surface: {
        card: "#ffffff",
        bottom_sheet: "#ffffff",
        modal: "#ffffff",
      },
      text: {
        high_emphasis: "#111827",
        medium_emphasis: "#6b7280",
        low_emphasis: "#9ca3af",
      },
      action: {
        primary: "#111827",
        secondary: "#6b7280",
        on_primary_text: "#ffffff",
        disabled: "#e5e7eb",
      },
      border: {
        divider: "#e5e7eb",
        focused: "#111827",
      },
    },
    typography: {
      font_family: "Geist, Inter, sans-serif",
      title_large: {
        size: "32px",
        weight: 700,
        line_height: "40px",
      },
      title_main: {
        size: "28px",
        weight: 700,
        line_height: "32px",
      },
      body_primary: {
        size: "16px",
        weight: 400,
        line_height: "24px",
      },
      body_secondary: {
        size: "14px",
        weight: 400,
        line_height: "20px",
      },
      caption: {
        size: "12px",
        weight: 400,
        line_height: "16px",
      },
      button_label: {
        size: "16px",
        weight: 600,
        line_height: "24px",
      },
    },
    spacing: {
      none: "0px",
      xxs: "4px",
      xs: "8px",
      sm: "12px",
      md: "16px",
      lg: "24px",
      xl: "32px",
      xxl: "48px",
    },
    mobile_layout: {
      screen_margin: "16px",
      safe_area_top: "44px",
      safe_area_bottom: "34px",
      section_gap: "24px",
      element_gap: "16px",
    },
    sizing: {
      min_touch_target: "48px",
      standard_button_height: "48px",
      standard_input_height: "48px",
      icon_small: "20px",
      icon_standard: "24px",
      bottom_nav_height: "80px",
    },
    radii: {
      sharp: "0px",
      sm: "4px",
      md: "8px",
      lg: "12px",
      xl: "16px",
      pill: "9999px",
    },
    border_widths: {
      none: "0px",
      hairline: "1px",
      thin: "2px",
      thick: "4px",
    },
    shadows: {
      none: "none",
      sm: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
      md: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
      lg: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
      upward: "0 -4px 6px -1px rgba(0, 0, 0, 0.1)",
    },
    opacities: {
      transparent: "0",
      disabled: "0.38",
      scrim_overlay: "0.50",
      pressed: "0.12",
      opaque: "1",
    },
    z_index: {
      base: "0",
      sticky_header: "10",
      bottom_nav: "20",
      bottom_sheet: "30",
      modal_dialog: "40",
      toast_snackbar: "50",
    },
  },
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
  planningMode = "project",
}: {
  prompt: string;
  image?: PromptImagePayload | null;
  designTokens?: DesignTokens | null;
  projectContext?: string | null;
  planningMode?: PlanningMode;
}): Promise<PlannedUiFlow> {
  const ai = createGeminiClient();
  const parts: Array<Record<string, unknown>> = [];
  const referenceAnalysis = await analyzeReferenceImage({ prompt, image });

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
    return {
      requiresBottomNav: false,
      charter: fallbackProjectCharter({ prompt, image, referenceAnalysis }),
      screens: fallbackScreensFromReference({
        prompt,
        planningMode,
        referenceAnalysis,
      }),
    };
  }

  return {
    requiresBottomNav: parsed.data.requires_bottom_nav,
    charter: parsed.data.charter,
    screens: planningMode === "single-screen" ? parsed.data.screens.slice(0, 1) : parsed.data.screens,
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

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts },
      config: {
        systemInstruction: designInstruction,
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    });

    const rawTokens = parseJsonResponse<unknown>(response.text || "{}");
    const parsed = DesignTokensSchema.safeParse(rawTokens);

    if (!parsed.success) {
      return getDefaultDesignTokens();
    }

    return parsed.data as DesignTokens;
  } catch (error) {
    console.error("Failed to generate design tokens", error);
    return getDefaultDesignTokens();
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
}: {
  messages: Array<Pick<Message, "role" | "content">>;
  screenCode: string;
  blockIndex?: ScreenBlockIndex | null;
  targetBlockIds?: string[];
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
      systemInstruction: editInstruction,
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
}: {
  messages: Array<Pick<Message, "role" | "content">>;
  screenCode: string;
}) {
  let rawText = "";

  for await (const chunk of editScreenStream({ messages, screenCode })) {
    rawText += chunk;
  }

  return {
    rawText,
    code: rawText.includes("<edit>") ? applyEdits(screenCode, rawText) : screenCode,
  };
}