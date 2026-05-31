import {
  referenceAnalysisRecreateInstruction,
  referenceAnalysisStyleInstruction,
} from "@/lib/generation/prompts";
import type {
  GenerationScopeContract,
  GenerationScopeCountSource,
  LlmLogFn,
  PromptImagePayload,
  ReferenceAnalysis,
  ReferenceAnalysisResult,
  ReferenceMode,
  PlanningMode,
} from "@/lib/types";

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};

const SCREEN_NOUNS = "screens?|pages?|views?|panels?|states?|modules?|frames?|mockups?";
const ACTION_WORDS = "build|create|generate|make|design|recreate|convert|copy|render";

type PromptScreenIntent = {
  promptScreenCount: number | null;
  namedScreenCount: number | null;
  source: Extract<GenerationScopeCountSource, "prompt_count" | "named_screens"> | null;
  allScreensRequested: boolean;
  diagnostics: string[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export const clampScopeScreenCount = (value: unknown) => {
  const numeric = typeof value === "number"
    ? value
    : typeof value === "string" && value.trim()
      ? Number(value.trim())
      : NaN;

  if (!Number.isFinite(numeric)) {
    return null;
  }

  return Math.min(12, Math.max(1, Math.round(numeric)));
};

const numberFromToken = (value: string | undefined | null) => {
  if (!value) return null;
  const cleaned = value.toLowerCase().trim();
  return clampScopeScreenCount(NUMBER_WORDS[cleaned] ?? Number(cleaned));
};

const readField = (record: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) {
      return record[key];
    }
  }
  return undefined;
};

const textField = (record: Record<string, unknown>, keys: string[], fallback: string, maxLength: number) => {
  const value = readField(record, keys);
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim().replace(/[ \t]{2,}/g, " ");
  return trimmed ? trimmed.slice(0, maxLength) : fallback;
};

const textArray = (value: unknown, fallback: string[], maxItems: number, maxLength: number) => {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const normalized = value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim().replace(/[ \t]{2,}/g, " ").slice(0, maxLength))
    .slice(0, maxItems);

  return normalized.length > 0 ? normalized : fallback;
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
            return JSON.parse(cleaned.slice(startIdx, i + 1)) as T;
          }
        }
      }
    }

    throw new Error("The model did not return valid JSON.");
  }
};

const normalizeReferenceMode = (referenceMode?: ReferenceMode | null): Exclude<ReferenceMode, "internal_style"> => {
  if (referenceMode === "user_style") return "user_style";
  if (referenceMode === "curated_style" || referenceMode === "internal_style") return "curated_style";
  return "user_recreate";
};

const isStyleReferenceMode = (referenceMode?: ReferenceMode | null) =>
  normalizeReferenceMode(referenceMode) !== "user_recreate";

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

const extractNamedScreenCount = (prompt: string) => {
  const matches = Array.from(prompt.matchAll(/(?:^|\n)\s*Screen\s+(\d{1,2})\s*:/gi));
  if (matches.length === 0) {
    return null;
  }

  const indexes = matches
    .map((match) => clampScopeScreenCount(match[1]))
    .filter((value): value is number => Boolean(value));

  return indexes.length > 0 ? Math.max(...indexes) : matches.length;
};

export function parsePromptScreenIntent(prompt: string): PromptScreenIntent {
  const normalized = prompt.trim();
  const diagnostics: string[] = [];
  const namedScreenCount = extractNamedScreenCount(normalized);

  if (namedScreenCount) {
    diagnostics.push(`Detected ${namedScreenCount} named Screen N sections.`);
    return {
      promptScreenCount: namedScreenCount,
      namedScreenCount,
      source: "named_screens",
      allScreensRequested: true,
      diagnostics,
    };
  }

  const token = "(\\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)";
  const patterns = [
    new RegExp(`\\b${token}\\s*(?:[- ]?)(?:${SCREEN_NOUNS})\\b`, "i"),
    new RegExp(`\\b(?:these|those|the|all)\\s+${token}\\s*(?:${SCREEN_NOUNS})?\\b`, "i"),
    new RegExp(`\\b(?:${ACTION_WORDS})\\s+(?:all\\s+|the\\s+|these\\s+|those\\s+)?${token}\\b`, "i"),
    new RegExp(`\\b${token}\\s+(?:mobile\\s+|app\\s+|ui\\s+){0,3}(?:${SCREEN_NOUNS})\\b`, "i"),
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    const count = numberFromToken(match?.[1]);
    if (count) {
      diagnostics.push(`Detected prompt-requested screen count ${count} from "${match?.[0] ?? "prompt"}".`);
      return {
        promptScreenCount: count,
        namedScreenCount: null,
        source: "prompt_count",
        allScreensRequested: /\b(all|every|each)\b/i.test(match?.[0] ?? normalized),
        diagnostics,
      };
    }
  }

  const trailingActionCount = normalized.match(new RegExp(`\\b(?:${ACTION_WORDS})\\b[\\s\\S]{0,80}\\b${token}\\s*$`, "i"));
  const trailingCount = numberFromToken(trailingActionCount?.[1]);
  if (trailingCount) {
    diagnostics.push(`Detected prompt-requested screen count ${trailingCount} from trailing action count.`);
    return {
      promptScreenCount: trailingCount,
      namedScreenCount: null,
      source: "prompt_count",
      allScreensRequested: /\b(all|every|each)\b/i.test(normalized),
      diagnostics,
    };
  }

  const allScreensRequested = /\b(?:all|every|each)\b[\s\S]{0,80}\b(?:screens?|pages?|views?|panels?|states?|shown|visible|image|reference)\b/i.test(normalized)
    || /\b(?:build|create|generate|make|design|recreate|convert)\b[\s\S]{0,80}\b(?:them|these|those)\s+all\b/i.test(normalized);

  if (allScreensRequested) {
    diagnostics.push("Detected an all-screens request without an explicit numeric count.");
  }

  return {
    promptScreenCount: null,
    namedScreenCount: null,
    source: null,
    allScreensRequested,
    diagnostics,
  };
}

const normalizeReferenceAnalysis = (raw: unknown): ReferenceAnalysisResult => {
  const diagnostics: string[] = [];
  const validationIssues: string[] = [];

  if (!isRecord(raw)) {
    return {
      analysis: null,
      screenCountEstimate: null,
      screenReferenceCount: null,
      confidence: "low",
      source: "none",
      diagnostics: ["Reference analysis response was not an object."],
      validationIssues,
    };
  }

  const rawScreens = readField(raw, ["screenReferences", "screen_references", "screens", "visibleScreens", "visible_screens"]);
  const screenRecords = Array.isArray(rawScreens) ? rawScreens.filter(isRecord) : [];
  const screenReferences = screenRecords.slice(0, 12).map((screen, index) => ({
    index: clampScopeScreenCount(readField(screen, ["index", "screenIndex", "screen_index", "number"])) ?? index + 1,
    suggestedRole: textField(screen, ["suggestedRole", "suggested_role", "role", "name", "title"], `Reference Screen ${index + 1}`, 200),
    layoutSummary: textField(screen, ["layoutSummary", "layout_summary", "layout", "structure"], "Visible layout was not described by the model.", 2500),
    visualHierarchy: textField(screen, ["visualHierarchy", "visual_hierarchy", "hierarchy"], "Visible hierarchy was not described by the model.", 2500),
    components: textArray(readField(screen, ["components", "componentList", "component_list"]), ["Visible component details were not enumerated."], 20, 400),
    stylingCues: textArray(readField(screen, ["stylingCues", "styling_cues", "styleCues", "style_cues"]), ["Visible styling cues were not enumerated."], 20, 400),
    interactionCues: textArray(readField(screen, ["interactionCues", "interaction_cues"]), [], 20, 400),
    copyPatterns: textArray(readField(screen, ["copyPatterns", "copy_patterns"]), [], 20, 400),
    implementationNotes: textArray(readField(screen, ["implementationNotes", "implementation_notes", "notes"]), [], 20, 400),
  }));

  const rawSignals = readField(raw, ["designSystemSignals", "design_system_signals", "signals"]);
  const signals = isRecord(rawSignals) ? rawSignals : {};
  const rawCount = readField(raw, ["screenCountEstimate", "screen_count_estimate", "visibleScreenCount", "visible_screen_count", "screenCount", "screen_count"]);
  const parsedCount = clampScopeScreenCount(rawCount);
  const screenReferenceCount = screenReferences.length > 0 ? screenReferences.length : null;
  const screenCountEstimate = parsedCount ?? screenReferenceCount;

  if (!parsedCount) {
    validationIssues.push("Missing or invalid screenCountEstimate.");
  }

  if (parsedCount && screenReferenceCount && parsedCount !== screenReferenceCount) {
    diagnostics.push(`Reference analysis count mismatch: estimate=${parsedCount}, screenReferences=${screenReferenceCount}.`);
  }

  if (screenReferences.length === 0) {
    validationIssues.push("No usable screenReferences array was present.");
  }

  if (!screenCountEstimate) {
    return {
      analysis: null,
      screenCountEstimate: null,
      screenReferenceCount,
      confidence: "low",
      source: "none",
      diagnostics: [...diagnostics, "No reference screen count could be salvaged."],
      validationIssues,
    };
  }

  const analysis: ReferenceAnalysis = {
    overallVisualStyle: textField(raw, ["overallVisualStyle", "overall_visual_style", "visualStyle", "visual_style"], "Reference visual style was not described by the model.", 3000),
    screenCountEstimate,
    screenReferences: screenReferences.length > 0
      ? screenReferences
      : Array.from({ length: screenCountEstimate }, (_, index) => ({
          index: index + 1,
          suggestedRole: `Reference Screen ${index + 1}`,
          layoutSummary: "Visible screen count was detected, but detailed layout analysis was not available.",
          visualHierarchy: "Use the uploaded reference image directly for structural hierarchy.",
          components: ["Use visible components from the uploaded reference image."],
          stylingCues: ["Use visible styling cues from the uploaded reference image."],
          interactionCues: [],
          copyPatterns: [],
          implementationNotes: ["Builder must inspect the attached full reference image for this target screen."],
        })),
    designSystemSignals: {
      palette: textField(signals, ["palette", "colors", "color"], "Use visible palette cues from the reference.", 1200),
      typography: textField(signals, ["typography", "type"], "Use visible typography cues from the reference.", 1200),
      surfaces: textField(signals, ["surfaces", "surfaceLanguage", "surface_language"], "Use visible surface and depth cues from the reference.", 1200),
      iconography: textField(signals, ["iconography", "icons"], "Use visible iconography cues from the reference.", 1200),
      density: textField(signals, ["density", "spacing"], "Use visible spacing and density cues from the reference.", 1200),
      motionTone: textField(signals, ["motionTone", "motion_tone", "motion"], "Use restrained mobile interaction motion.", 1200),
    },
  };

  return {
    analysis,
    screenCountEstimate,
    screenReferenceCount,
    confidence: validationIssues.length === 0 ? "high" : "medium",
    source: validationIssues.length === 0 ? "full_analysis" : "salvaged_analysis",
    diagnostics,
    validationIssues,
  };
};

const countOnlyFallback = async ({
  prompt,
  image,
  referenceMode,
  llmLog,
}: {
  prompt: string;
  image: PromptImagePayload;
  referenceMode?: ReferenceMode | null;
  llmLog?: LlmLogFn;
}): Promise<ReferenceAnalysisResult> => {
  const inlineImage = toInlineImage(image);
  if (!inlineImage) {
    return {
      analysis: null,
      screenCountEstimate: null,
      screenReferenceCount: null,
      confidence: "low",
      source: "none",
      diagnostics: ["No image was available for count-only fallback."],
    };
  }

  try {
    const [{ createGeminiClient }, { geminiPolicyForTask }] = await Promise.all([
      import("@/lib/ai/gemini"),
      import("@/lib/ai/model-policy"),
    ]);
    const ai = createGeminiClient();
    const policy = geminiPolicyForTask("project_planning", {
      responseMimeType: "application/json",
      temperature: 0,
    });
    const instruction = [
      "Count visible mobile app screens/panels in the uploaded image.",
      "Return strictly valid JSON only: { \"screenCountEstimate\": number, \"confidence\": \"high|medium|low\", \"reasoning\": string }.",
      "Count only visible phone screens, panels, pages, or distinct app mockup frames.",
      "Do not count bottom nav tabs, segmented controls, menu labels, carousel dots, or rows inside one screen.",
      isStyleReferenceMode(referenceMode)
        ? "This is style-reference mode; count is diagnostic only."
        : "This is Image to UI mode; count is used to decide how many screens to recreate.",
      prompt.trim() ? `User prompt: "${prompt.trim()}"` : "No user prompt was provided.",
    ].join("\n");

    llmLog?.("[LLM INPUT] reference-count-only", {
      model: policy.model,
      referenceMode: normalizeReferenceMode(referenceMode),
      userParts: ["[image]", instruction],
    });

    const response = await ai.models.generateContent({
      model: policy.model,
      contents: { parts: [inlineImage, { text: instruction }] },
      config: policy.config,
    });
    const raw = parseJsonResponse<unknown>(response.text || "{}");
    const count = isRecord(raw)
      ? clampScopeScreenCount(readField(raw, ["screenCountEstimate", "screen_count_estimate", "count"]))
      : null;
    const confidenceRaw = isRecord(raw) && typeof raw.confidence === "string" ? raw.confidence.toLowerCase() : "";
    const confidence = confidenceRaw === "high" || confidenceRaw === "medium" ? confidenceRaw : "low";

    return {
      analysis: null,
      screenCountEstimate: count,
      screenReferenceCount: null,
      confidence,
      source: count ? "count_only" : "none",
      diagnostics: [
        count ? `Count-only fallback estimated ${count} visible screen${count === 1 ? "" : "s"}.` : "Count-only fallback did not return a usable count.",
        isRecord(raw) && typeof raw.reasoning === "string" ? raw.reasoning.slice(0, 500) : "",
      ].filter(Boolean),
    };
  } catch (error) {
    return {
      analysis: null,
      screenCountEstimate: null,
      screenReferenceCount: null,
      confidence: "low",
      source: "none",
      diagnostics: [`Count-only fallback failed: ${error instanceof Error ? error.message : String(error)}`],
    };
  }
};

export async function analyzeReferenceImageForScope({
  prompt,
  image,
  referenceMode,
  llmLog,
}: {
  prompt: string;
  image?: PromptImagePayload | null;
  referenceMode?: ReferenceMode | null;
  llmLog?: LlmLogFn;
}): Promise<ReferenceAnalysisResult> {
  const inlineImage = toInlineImage(image);
  if (!inlineImage || !image) {
    return {
      analysis: null,
      screenCountEstimate: null,
      screenReferenceCount: null,
      confidence: "low",
      source: "none",
      diagnostics: ["No reference image was available for visual analysis."],
    };
  }

  try {
    const [{ createGeminiClient }, { geminiPolicyForTask }] = await Promise.all([
      import("@/lib/ai/gemini"),
      import("@/lib/ai/model-policy"),
    ]);
    const ai = createGeminiClient();
    const resolvedReferenceMode = normalizeReferenceMode(referenceMode);
    const policy = geminiPolicyForTask("project_planning", {
      systemInstruction: isStyleReferenceMode(resolvedReferenceMode)
        ? referenceAnalysisStyleInstruction
        : referenceAnalysisRecreateInstruction,
      responseMimeType: "application/json",
      temperature: 0.1,
    });
    const promptPartText = prompt.trim()
      ? `User/Product Intent: "${prompt}"`
      : "Analyze the mobile UI reference image and describe the visible screen anatomy.";
    const parts: Array<Record<string, unknown>> = [
      inlineImage,
      {
        text: promptPartText,
      },
    ];

    llmLog?.("[LLM INPUT] reference-analysis", {
      model: policy.model,
      referenceMode: resolvedReferenceMode,
      userParts: ["[image]", promptPartText],
    });

    const response = await ai.models.generateContent({
      model: policy.model,
      contents: { parts },
      config: policy.config,
    });
    const rawAnalysis = parseJsonResponse<unknown>(response.text || "{}");
    const normalized = normalizeReferenceAnalysis(rawAnalysis);

    if (normalized.screenCountEstimate) {
      return normalized;
    }

    const fallback = await countOnlyFallback({ prompt, image, referenceMode, llmLog });
    return {
      ...fallback,
      diagnostics: [
        ...normalized.diagnostics,
        ...(normalized.validationIssues ?? []),
        ...fallback.diagnostics,
      ],
      validationIssues: normalized.validationIssues,
    };
  } catch (error) {
    const fallback = await countOnlyFallback({ prompt, image, referenceMode, llmLog });
    return {
      ...fallback,
      diagnostics: [
        `Reference analysis failed: ${error instanceof Error ? error.message : String(error)}`,
        ...fallback.diagnostics,
      ],
    };
  }
}

const resolveImageScreenCount = (result?: ReferenceAnalysisResult | null) => {
  const estimate = clampScopeScreenCount(result?.screenCountEstimate);
  const referenceCount = clampScopeScreenCount(result?.screenReferenceCount);
  if (estimate && referenceCount && estimate !== referenceCount) {
    return Math.max(estimate, referenceCount);
  }
  return estimate ?? referenceCount ?? null;
};

export function resolveGenerationScopeContract({
  prompt,
  image,
  referenceMode,
  planningMode,
  referenceAnalysisResult,
}: {
  prompt: string;
  image?: PromptImagePayload | null;
  referenceMode?: ReferenceMode | null;
  planningMode?: PlanningMode;
  referenceAnalysisResult?: ReferenceAnalysisResult | null;
}): GenerationScopeContract {
  const resolvedReferenceMode = normalizeReferenceMode(referenceMode);
  const promptIntent = parsePromptScreenIntent(prompt);
  const promptScreenCount = promptIntent.promptScreenCount;
  const imageScreenCount = resolveImageScreenCount(referenceAnalysisResult);
  const imagePresent = Boolean(image);
  const diagnostics = [
    ...promptIntent.diagnostics,
    ...(referenceAnalysisResult?.diagnostics ?? []),
  ];
  let finalScreenCount: number | null = null;
  let countSource: GenerationScopeCountSource = "open_project";
  let confidence: GenerationScopeContract["confidence"] = "medium";
  let reason = "No exact screen count was requested; planner may choose the initial app slate.";

  if (planningMode === "single-screen") {
    finalScreenCount = 1;
    countSource = "planning_mode";
    confidence = "high";
    reason = "Single-screen planning mode always creates exactly one additional screen.";
  } else if (promptScreenCount) {
    finalScreenCount = promptScreenCount;
    countSource = promptIntent.source ?? "prompt_count";
    confidence = "high";
    reason = `The user explicitly requested ${promptScreenCount} screen${promptScreenCount === 1 ? "" : "s"}.`;
  } else if (resolvedReferenceMode === "user_recreate" && imagePresent && imageScreenCount) {
    finalScreenCount = imageScreenCount;
    countSource = "reference_image";
    confidence = referenceAnalysisResult?.confidence ?? "medium";
    reason = `The uploaded Image to UI reference appears to contain ${imageScreenCount} visible screen${imageScreenCount === 1 ? "" : "s"}.`;
  } else if (resolvedReferenceMode === "user_recreate" && imagePresent) {
    finalScreenCount = 1;
    countSource = "default_single";
    confidence = "low";
    reason = "Image to UI could not reliably detect multiple visible screens, so it defaults to one screen.";
  }

  const conflictResolution = promptScreenCount && imageScreenCount && promptScreenCount !== imageScreenCount
    ? {
        policy: "user_wins" as const,
        promptScreenCount,
        imageScreenCount,
        resolvedCount: promptScreenCount,
        reason: `Prompt count ${promptScreenCount} overrides image count ${imageScreenCount}.`,
      }
    : null;

  if (conflictResolution) {
    diagnostics.push(conflictResolution.reason);
  }

  return {
    version: 1,
    referenceMode: resolvedReferenceMode,
    promptScreenCount,
    namedScreenCount: promptIntent.namedScreenCount,
    imageScreenCount,
    finalScreenCount,
    countSource,
    confidence,
    conflictResolution,
    allScreensRequested: promptIntent.allScreensRequested,
    reason,
    diagnostics,
  };
}

export async function preflightGenerationScope({
  prompt,
  image,
  referenceMode,
  planningMode = "project",
  llmLog,
}: {
  prompt: string;
  image?: PromptImagePayload | null;
  referenceMode?: ReferenceMode | null;
  planningMode?: PlanningMode;
  llmLog?: LlmLogFn;
}): Promise<{
  scopeContract: GenerationScopeContract;
  referenceAnalysis: ReferenceAnalysis | null;
  referenceAnalysisResult: ReferenceAnalysisResult;
}> {
  const referenceAnalysisResult = await analyzeReferenceImageForScope({
    prompt,
    image,
    referenceMode,
    llmLog,
  });
  const scopeContract = resolveGenerationScopeContract({
    prompt,
    image,
    referenceMode,
    planningMode,
    referenceAnalysisResult,
  });

  return {
    scopeContract,
    referenceAnalysis: referenceAnalysisResult.analysis,
    referenceAnalysisResult,
  };
}
