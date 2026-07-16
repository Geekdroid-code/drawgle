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
  ScreenScopeGroup,
  ScreenScopeScreen,
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

const SCREEN_NOUNS = "screens?|pages?|views?";
const ACTION_WORDS = "build|create|generate|make|design|recreate|convert|copy|render";
const MAX_SCOPE_COUNT = 200;
const MAX_MATERIALIZED_SCOPE_SCREENS = 24;
const MAX_INITIAL_VISIBLE_SCREENS = 5;

type PromptScreenIntent = {
  promptScreenCount: number | null;
  namedScreenCount: number | null;
  source: Extract<GenerationScopeCountSource, "prompt_count" | "named_screens"> | null;
  allScreensRequested: boolean;
  diagnostics: string[];
  groups?: ScreenScopeGroup[];
  screens?: ScreenScopeScreen[];
  confidence?: "high" | "medium" | "low";
  ambiguities?: string[];
  requiresConfirmation?: boolean;
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

  return Math.min(MAX_SCOPE_COUNT, Math.max(1, Math.round(numeric)));
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

const normalizeReferenceMode = (referenceMode?: ReferenceMode | null): ReferenceMode => {
  if (referenceMode === "user_style") return "user_style";
  if (referenceMode === "curated_style") return "curated_style";
  if (referenceMode === "internal_style") return "internal_style";
  return "user_recreate";
};

const isStyleReferenceMode = (referenceMode?: ReferenceMode | null) =>
  referenceMode === "user_style" || referenceMode === "curated_style";

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

const titleCase = (value: string) => value
  .replace(/[_-]+/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .replace(/\b\w/g, (character) => character.toUpperCase());

const defaultScopeScreenName = (kind: string, index: number, count: number) => {
  const normalized = kind.toLowerCase();
  if (/onboarding|welcome|intro/.test(normalized)) return count > 1 ? `Onboarding Step ${index}` : "Onboarding";
  if (/auth|login|sign.?up|register/.test(normalized)) return "Login / Signup";
  if (/home|dashboard/.test(normalized)) return normalized.includes("dashboard") ? "Dashboard" : "Home";
  const label = titleCase(kind || "Screen");
  return count > 1 ? `${label} ${index}` : label;
};

const screensFromGroups = (groups: ScreenScopeGroup[]) => {
  const screens: ScreenScopeScreen[] = [];
  for (const group of groups) {
    if (group.surfaceKind === "state") continue;
    for (let index = 0; index < group.count && screens.length < MAX_MATERIALIZED_SCOPE_SCREENS; index += 1) {
      screens.push({
        index: screens.length + 1,
        name: group.orderedNames[index] || defaultScopeScreenName(group.kind, index + 1, group.count),
        kind: group.kind,
        parentName: group.parentName ?? null,
      });
    }
  }
  return screens;
};

const inferGroupKind = (phrase: string) => {
  const normalized = phrase.toLowerCase();
  if (/onboarding|welcome|intro/.test(normalized)) return "onboarding";
  if (/login|sign.?up|register|auth/.test(normalized)) return "authentication";
  if (/home/.test(normalized)) return "home";
  if (/dashboard/.test(normalized)) return "dashboard";
  if (/profile|account/.test(normalized)) return "profile";
  if (/settings/.test(normalized)) return "settings";
  return "screen";
};

export function parsePromptScreenIntent(prompt: string): PromptScreenIntent {
  const normalized = prompt.trim();
  const diagnostics: string[] = [];
  const singleScreenName = normalized.match(/(?:^|\n)\s*Screen\s+name\s*:\s*([^\n]+)/i)?.[1]
    ?.replace(/[.\s]+$/, "")
    .trim()
    .slice(0, 100);
  const singleScreenRole = normalized.match(/(?:^|\n)\s*Screen\s+role\s*:\s*([^\n]+)/i)?.[1]
    ?.replace(/[.\s]+$/, "")
    .trim()
    .slice(0, 80);

  if (singleScreenName) {
    const kind = singleScreenRole || inferGroupKind(singleScreenName);
    diagnostics.push(`Detected explicit single-screen directive for ${singleScreenName}.`);
    return {
      promptScreenCount: 1,
      namedScreenCount: 1,
      source: "named_screens",
      allScreensRequested: false,
      diagnostics,
      groups: [{
        kind,
        count: 1,
        orderedNames: [singleScreenName],
        sourceText: singleScreenName,
        surfaceKind: "screen",
      }],
      screens: [{ index: 1, name: singleScreenName, kind }],
      confidence: "high",
      ambiguities: [],
      requiresConfirmation: false,
    };
  }

  const namedScreenCount = extractNamedScreenCount(normalized);

  if (namedScreenCount) {
    const namedMatches = Array.from(normalized.matchAll(/(?:^|\n)\s*Screen\s+(\d{1,2})\s*:\s*([^\n.]+)/gi));
    const screens = namedMatches.map((match, index) => ({
      index: index + 1,
      name: (match[2] || `Screen ${index + 1}`).trim().slice(0, 100),
      kind: inferGroupKind(match[2] || "screen"),
    }));
    diagnostics.push(`Detected ${namedScreenCount} named Screen N sections.`);
    return {
      promptScreenCount: namedScreenCount,
      namedScreenCount,
      source: "named_screens",
      allScreensRequested: true,
      diagnostics,
      groups: screens.map((screen) => ({ kind: screen.kind, count: 1, orderedNames: [screen.name], sourceText: screen.name, surfaceKind: "screen" })),
      screens,
      confidence: "high",
      ambiguities: [],
      requiresConfirmation: false,
    };
  }

  const token = "(\\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)";
  const quantityPattern = new RegExp(`\\b${token}\\b((?:\\s+[a-z][a-z/-]*){0,8})\\s+(?:${SCREEN_NOUNS})\\b`, "gi");
  const quantityMatches = Array.from(normalized.replace(/-/g, " ").matchAll(quantityPattern));
  const groups = quantityMatches.flatMap((match) => {
    const count = numberFromToken(match[1]);
    if (!count) return [];
    const phrase = `${match[2] ?? ""} screen`.trim();
    const kind = inferGroupKind(phrase);
    return [{
      kind,
      count,
      orderedNames: Array.from({ length: count }, (_, index) => defaultScopeScreenName(kind, index + 1, count)),
      sourceText: (match[0] ?? phrase).trim().slice(0, 240),
      surfaceKind: "screen" as const,
    } satisfies ScreenScopeGroup];
  });

  if (groups.length > 0) {
    const screens = screensFromGroups(groups);
    const count = groups.reduce((total, group) => total + group.count, 0);
    diagnostics.push(`Detected ${groups.length} additive screen group${groups.length === 1 ? "" : "s"} totaling ${count} screen${count === 1 ? "" : "s"}.`);
    return {
      promptScreenCount: count,
      namedScreenCount: null,
      source: "prompt_count",
      allScreensRequested: /\b(all|every|each|must have)\b/i.test(normalized),
      diagnostics,
      groups,
      screens,
      confidence: groups.length > 1 ? "medium" : "high",
      ambiguities: [],
      requiresConfirmation: false,
    };
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
      groups: [{ kind: "screen", count: trailingCount, orderedNames: [], sourceText: trailingActionCount?.[0] ?? normalized, surfaceKind: "screen" }],
      screens: screensFromGroups([{ kind: "screen", count: trailingCount, orderedNames: [], sourceText: trailingActionCount?.[0] ?? normalized, surfaceKind: "screen" }]),
      confidence: "medium",
      ambiguities: [],
      requiresConfirmation: false,
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
    groups: [],
    screens: [],
    confidence: "high",
    ambiguities: [],
    requiresConfirmation: false,
  };
}

const normalizeSemanticPromptIntent = (raw: unknown, prompt: string): PromptScreenIntent | null => {
  if (!isRecord(raw)) return null;
  const explicitFiniteScope = raw.explicitFiniteScope === true || raw.explicit_finite_scope === true;
  const rawGroups = readField(raw, ["groups", "screenGroups", "screen_groups"]);
  const groups = Array.isArray(rawGroups)
    ? rawGroups.filter(isRecord).slice(0, 24).flatMap((group) => {
        const count = clampScopeScreenCount(readField(group, ["count", "slotCount", "slot_count"]));
        if (!count) return [];
        const kind = textField(group, ["kind", "type", "role"], "screen", 80).toLowerCase().replace(/[^a-z0-9]+/g, "_");
        const orderedNames = textArray(readField(group, ["orderedNames", "ordered_names", "names"]), [], Math.min(count, MAX_MATERIALIZED_SCOPE_SCREENS), 100);
        const rawSurfaceKind = String(readField(group, ["surfaceKind", "surface_kind", "classification"]) ?? "screen").toLowerCase();
        const surfaceKind = rawSurfaceKind === "state" || rawSurfaceKind === "local_state" ? "state" as const : "screen" as const;
        const parentName = textField(group, ["parentName", "parent_name", "parentScreen", "parent_screen"], "", 100) || null;
        const useCanonicalNames = /onboarding|welcome|intro|auth|login|signup|register|home|dashboard/.test(kind);
        return [{
          kind,
          count,
          orderedNames: Array.from({ length: Math.min(count, MAX_MATERIALIZED_SCOPE_SCREENS) }, (_, index) => useCanonicalNames
            ? defaultScopeScreenName(kind, index + 1, count)
            : orderedNames[index] || defaultScopeScreenName(kind, index + 1, count)),
          sourceText: textField(group, ["sourceText", "source_text", "evidence"], prompt, 240),
          surfaceKind,
          parentName,
        } satisfies ScreenScopeGroup];
      })
    : [];
  const ambiguities = textArray(readField(raw, ["ambiguities", "uncertainties"]), [], 8, 240);
  const confidenceValue = String(readField(raw, ["confidence"]) ?? "").toLowerCase();
  let confidence: PromptScreenIntent["confidence"] = confidenceValue === "high" || confidenceValue === "medium" || confidenceValue === "low"
    ? confidenceValue
    : groups.length > 0 ? "medium" : "high";
  const diagnostics: string[] = [];

  if (!explicitFiniteScope || groups.length === 0) {
    return {
      promptScreenCount: null,
      namedScreenCount: null,
      source: null,
      allScreensRequested: raw.allScreensRequested === true || raw.all_screens_requested === true,
      diagnostics: ["Semantic scope interpreter found no explicit finite screen set."],
      groups: [],
      screens: [],
      confidence,
      ambiguities,
      requiresConfirmation: confidence === "low" || ambiguities.length > 0,
    };
  }

  const screens = screensFromGroups(groups);
  const parentScreenCount = groups.reduce((total, group) => total + (group.surfaceKind === "state" ? 0 : group.count), 0);
  const reportedTotal = clampScopeScreenCount(readField(raw, ["totalCount", "total_count", "screenCount", "screen_count"]));
  if (reportedTotal && reportedTotal !== parentScreenCount) {
    diagnostics.push(`Semantic scope total ${reportedTotal} disagreed with additive parent-screen total ${parentScreenCount}; structured group arithmetic won.`);
    confidence = confidence === "high" ? "medium" : confidence;
  }
  diagnostics.push(`Semantic scope interpreter resolved ${groups.length} group${groups.length === 1 ? "" : "s"} and ${parentScreenCount} parent screen${parentScreenCount === 1 ? "" : "s"}.`);

  return {
    promptScreenCount: parentScreenCount,
    namedScreenCount: null,
    source: "prompt_count",
    allScreensRequested: raw.allScreensRequested === true || raw.all_screens_requested === true,
    diagnostics,
    groups,
    screens,
    confidence,
    ambiguities,
    requiresConfirmation: confidence === "low" || ambiguities.length > 0,
  };
};

export async function analyzePromptScreenIntent({
  prompt,
  llmLog,
}: {
  prompt: string;
  llmLog?: LlmLogFn;
}): Promise<PromptScreenIntent> {
  const deterministic = parsePromptScreenIntent(prompt);
  if (!prompt.trim() || deterministic.namedScreenCount) return deterministic;

  try {
    const [{ createGeminiClient }, { geminiPolicyForTask }] = await Promise.all([
      import("@/lib/ai/gemini"),
      import("@/lib/ai/model-policy"),
    ]);
    const ai = createGeminiClient();
    const policy = geminiPolicyForTask("draft_plan", {
      responseMimeType: "application/json",
      temperature: 0,
      maxOutputTokens: 3000,
    });
    const instruction = [
      "Extract only the user's explicitly requested finite mobile app screen scope.",
      "Return JSON: { explicitFiniteScope, groups:[{kind,count,orderedNames,sourceText,surfaceKind:'screen|state',parentName:null|string}], totalCount, confidence:'high|medium|low', ambiguities:[], allScreensRequested }.",
      "Parent screen groups are additive. totalCount is the sum of groups whose surfaceKind is screen.",
      "A combined destination counts once unless the user explicitly requests separate destinations.",
      "A modal, sheet, picker, popover, active-tab body, confirmation, or other local variation of the same route uses surfaceKind state and names its parent; it does not increase totalCount.",
      "Do not treat version numbers, dimensions, product quantities, card counts, steps inside one non-screen workflow, or reference-image panel counts as prompt screen totals.",
      "If the user requests an app but does not enumerate a finite screen set, set explicitFiniteScope false and return no groups.",
      `User prompt: ${JSON.stringify(prompt.trim())}`,
    ].join("\n");

    llmLog?.("[LLM INPUT] semantic-screen-scope", { model: policy.model, promptLength: prompt.length });
    const response = await ai.models.generateContent({
      model: policy.model,
      contents: instruction,
      config: policy.config,
    });
    const semantic = normalizeSemanticPromptIntent(parseJsonResponse<unknown>(response.text || "{}"), prompt);
    return semantic ?? deterministic;
  } catch (error) {
    return {
      ...deterministic,
      diagnostics: [
        ...deterministic.diagnostics,
        `Semantic scope interpreter failed; deterministic additive fallback used: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }
}

const normalizeBoundingBox = (value: unknown) => {
  if (!isRecord(value)) return null;
  const number = (keys: string[]) => {
    const raw = readField(value, keys);
    const parsed = typeof raw === "number" ? raw : Number(raw);
    return Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : null;
  };
  const x = number(["x", "left"]);
  const y = number(["y", "top"]);
  const width = number(["width", "w"]);
  const height = number(["height", "h"]);
  if (x == null || y == null || width == null || height == null || width <= 0 || height <= 0) return null;
  return { x, y, width: Math.min(width, 1 - x), height: Math.min(height, 1 - y) };
};

export const normalizeReferenceAnalysis = (raw: unknown): ReferenceAnalysisResult => {
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
    compositionRules: textArray(readField(screen, ["compositionRules", "composition_rules", "layoutPrinciples", "layout_principles"]), [], 8, 260),
    spacingRules: textArray(readField(screen, ["spacingRules", "spacing_rules", "spacingPrinciples", "spacing_principles"]), [], 8, 260),
    componentRules: textArray(readField(screen, ["componentRules", "component_rules", "componentPrinciples", "component_principles"]), [], 8, 260),
    antiPatterns: textArray(readField(screen, ["antiPatterns", "anti_patterns", "avoid"]), [], 8, 260),
    boundingBox: normalizeBoundingBox(readField(screen, ["boundingBox", "bounding_box", "bounds", "frameBounds", "frame_bounds"])),
  }));

  const rawSignals = readField(raw, ["designSystemSignals", "design_system_signals", "signals"]);
  const signals = isRecord(rawSignals) ? rawSignals : {};
  const rawPrimaryNavigation = readField(raw, ["primaryNavigation", "primary_navigation", "navigationEvidence", "navigation_evidence"]);
  const primaryNavigationRecord = isRecord(rawPrimaryNavigation) ? rawPrimaryNavigation : null;
  const navigationAnatomies = new Set(["fixed-tab-rail", "floating-dock", "glass-dock", "compact-icon-rail", "center-action-dock"]);
  const navigationItemsRaw = primaryNavigationRecord
    ? readField(primaryNavigationRecord, ["items", "destinations", "tabs"])
    : null;
  const navigationItems = Array.isArray(navigationItemsRaw)
    ? navigationItemsRaw.filter(isRecord).slice(0, 5).map((item) => ({
        label: typeof item.label === "string" && item.label.trim() ? item.label.trim().slice(0, 40) : null,
        icon: textField(item, ["icon", "iconMeaning", "icon_meaning"], "unidentified icon", 120),
      }))
    : [];
  const rawNavigationCount = primaryNavigationRecord
    ? readField(primaryNavigationRecord, ["itemCount", "item_count", "count"])
    : null;
  const parsedNavigationCount = typeof rawNavigationCount === "number" && Number.isFinite(rawNavigationCount)
    ? Math.min(5, Math.max(0, Math.round(rawNavigationCount)))
    : navigationItems.length;
  const rawAnatomy = primaryNavigationRecord
    ? readField(primaryNavigationRecord, ["anatomy", "type"])
    : null;
  const primaryNavigation = primaryNavigationRecord
    ? {
        present: primaryNavigationRecord.present === true,
        repeatedAcrossScreens: primaryNavigationRecord.repeatedAcrossScreens === true || primaryNavigationRecord.repeated_across_screens === true,
        itemCount: parsedNavigationCount,
        items: navigationItems,
        anatomy: typeof rawAnatomy === "string" && navigationAnatomies.has(rawAnatomy) ? rawAnatomy as NonNullable<ReferenceAnalysis["primaryNavigation"]>["anatomy"] : null,
        geometry: textField(primaryNavigationRecord, ["geometry", "measurements"], "Navigation geometry was not measured.", 800),
        labels: ["always", "active-only", "hidden"].includes(String(primaryNavigationRecord.labels))
          ? primaryNavigationRecord.labels as NonNullable<ReferenceAnalysis["primaryNavigation"]>["labels"]
          : null,
        activeState: textField(primaryNavigationRecord, ["activeState", "active_state"], "Active state was not described.", 600),
        elevation: textField(primaryNavigationRecord, ["elevation", "surface"], "Elevation was not described.", 600),
        safeAreaRelationship: textField(primaryNavigationRecord, ["safeAreaRelationship", "safe_area_relationship"], "Safe-area relationship was not described.", 600),
        activeItemByScreen: Array.isArray(primaryNavigationRecord.activeItemByScreen)
          ? primaryNavigationRecord.activeItemByScreen.filter(isRecord).slice(0, 12).map((entry) => ({
              screenIndex: clampScopeScreenCount(readField(entry, ["screenIndex", "screen_index"])) ?? 1,
              itemIndex: clampScopeScreenCount(readField(entry, ["itemIndex", "item_index"])),
            }))
          : [],
      }
    : null;
  const rawCount = readField(raw, ["screenCountEstimate", "screen_count_estimate", "visibleScreenCount", "visible_screen_count", "screenCount", "screen_count"]);
  const parsedCount = clampScopeScreenCount(rawCount);
  const screenReferenceCount = screenReferences.length > 0 ? screenReferences.length : null;
  const screenCountEstimate = parsedCount ?? screenReferenceCount;

  if (!parsedCount) {
    validationIssues.push("Missing or invalid screenCountEstimate.");
  }

  if (parsedCount && screenReferenceCount && parsedCount !== screenReferenceCount) {
    diagnostics.push(`Reference analysis count mismatch: estimate=${parsedCount}, screenReferences=${screenReferenceCount}.`);
    validationIssues.push("screenCountEstimate must equal the number of screenReferences entries.");
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
    primaryNavigation,
    designSystemSignals: {
      palette: textField(signals, ["palette", "colors", "color"], "Use visible palette cues from the reference.", 1200),
      typography: textField(signals, ["typography", "type"], "Use visible typography cues from the reference.", 1200),
      surfaces: textField(signals, ["surfaces", "surfaceLanguage", "surface_language"], "Use visible surface and depth cues from the reference.", 1200),
      iconography: textField(signals, ["iconography", "icons"], "Use visible iconography cues from the reference.", 1200),
      density: textField(signals, ["density", "spacing"], "Use visible spacing and density cues from the reference.", 1200),
      motionTone: textField(signals, ["motionTone", "motion_tone", "motion"], "Use restrained mobile interaction motion.", 1200),
      layoutGrammar: textField(signals, ["layoutGrammar", "layout_grammar", "composition", "compositionGrammar", "composition_grammar"], "Use visible composition, hierarchy, and layout grammar from the reference.", 1200),
      componentGrammar: textField(signals, ["componentGrammar", "component_grammar", "componentConstruction", "component_construction"], "Use visible component construction logic from the reference.", 1200),
      spacingLogic: textField(signals, ["spacingLogic", "spacing_logic", "spacingDensity", "spacing_density"], "Use visible macro and micro spacing logic from the reference.", 1200),
      antiPatterns: textField(signals, ["antiPatterns", "anti_patterns", "avoid"], "Avoid flattening the reference into generic stacked cards or token-only mimicry.", 1200),
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
  promptIntent: providedPromptIntent,
}: {
  prompt: string;
  image?: PromptImagePayload | null;
  referenceMode?: ReferenceMode | null;
  planningMode?: PlanningMode;
  referenceAnalysisResult?: ReferenceAnalysisResult | null;
  promptIntent?: PromptScreenIntent | null;
}): GenerationScopeContract {
  const resolvedReferenceMode = normalizeReferenceMode(referenceMode);
  const promptIntent = providedPromptIntent ?? parsePromptScreenIntent(prompt);
  const promptScreenCount = promptIntent.promptScreenCount;
  const imageScreenCount = resolveImageScreenCount(referenceAnalysisResult);
  const imagePresent = Boolean(image);
  const diagnostics = [
    ...promptIntent.diagnostics,
    ...(referenceAnalysisResult?.diagnostics ?? []),
  ];
  let finalScreenCount: number | null = null;
  let countSource: GenerationScopeCountSource = "open_project";
  let confidence: GenerationScopeContract["confidence"] = promptIntent.confidence ?? "medium";
  let reason = "No exact screen count was requested; planner may choose the initial app slate.";

  if (planningMode === "single-screen") {
    finalScreenCount = 1;
    countSource = "planning_mode";
    confidence = promptIntent.confidence ?? "high";
    reason = "Single-screen planning mode always creates exactly one additional screen.";
  } else if (promptScreenCount) {
    finalScreenCount = promptScreenCount;
    countSource = promptIntent.source ?? "prompt_count";
    confidence = promptIntent.confidence ?? "high";
    reason = `The user explicitly requested ${promptScreenCount} screen${promptScreenCount === 1 ? "" : "s"}.`;
  } else if (resolvedReferenceMode === "user_recreate" && imagePresent && imageScreenCount) {
    finalScreenCount = Math.min(imageScreenCount, MAX_INITIAL_VISIBLE_SCREENS);
    countSource = "reference_image";
    confidence = referenceAnalysisResult?.confidence ?? "medium";
    reason = imageScreenCount > MAX_INITIAL_VISIBLE_SCREENS
      ? `The uploaded Image to UI reference appears to contain ${imageScreenCount} visible screens; the initial build will use the first ${MAX_INITIAL_VISIBLE_SCREENS}.`
      : `The uploaded Image to UI reference appears to contain ${imageScreenCount} visible screen${imageScreenCount === 1 ? "" : "s"}.`;
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

  const scopeScreens = promptIntent.screens?.length
    ? promptIntent.screens
    : finalScreenCount && (countSource === "reference_image" || countSource === "default_single")
      ? Array.from({ length: Math.min(finalScreenCount, MAX_MATERIALIZED_SCOPE_SCREENS) }, (_, index) => ({
          index: index + 1,
          name: referenceAnalysisResult?.analysis?.screenReferences[index]?.suggestedRole || `Reference Screen ${index + 1}`,
          kind: "reference",
        }))
      : [];
  const referenceAmbiguities = !promptScreenCount && imagePresent && resolvedReferenceMode === "user_recreate"
    ? referenceAnalysisResult?.validationIssues ?? []
    : [];
  const autoAcceptVisibleImageScope = planningMode !== "single-screen"
    && resolvedReferenceMode === "user_recreate"
    && imagePresent;
  const requiresConfirmation = autoAcceptVisibleImageScope
    ? false
    : Boolean(promptIntent.requiresConfirmation)
      || (!promptScreenCount
        && resolvedReferenceMode === "user_recreate"
        && imagePresent
        && (confidence === "low" || referenceAmbiguities.length > 0));

  return {
    version: 2,
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
    groups: promptIntent.groups ?? [],
    screens: scopeScreens,
    ambiguities: [...(promptIntent.ambiguities ?? []), ...referenceAmbiguities],
    requiresConfirmation,
  };
}

export async function preflightGenerationScope({
  prompt,
  image,
  referenceMode,
  planningMode = "project",
  cachedReferenceAnalysis,
  llmLog,
}: {
  prompt: string;
  image?: PromptImagePayload | null;
  referenceMode?: ReferenceMode | null;
  planningMode?: PlanningMode;
  cachedReferenceAnalysis?: ReferenceAnalysis | null;
  llmLog?: LlmLogFn;
}): Promise<{
  scopeContract: GenerationScopeContract;
  referenceAnalysis: ReferenceAnalysis | null;
  referenceAnalysisResult: ReferenceAnalysisResult;
}> {
  const useSemanticScope = process.env.DRAWGLE_GENERATION_ENGINE_VERSION !== "v1";
  const cachedReferenceAnalysisResult: ReferenceAnalysisResult | null = cachedReferenceAnalysis
    ? {
        analysis: cachedReferenceAnalysis,
        screenCountEstimate: cachedReferenceAnalysis.screenCountEstimate,
        screenReferenceCount: cachedReferenceAnalysis.screenReferences.length,
        confidence: "high",
        source: "salvaged_analysis",
        diagnostics: ["Reused cached project reference DNA; skipped multimodal reference analysis."],
      }
    : null;
  const [promptIntent, referenceAnalysisResult] = await Promise.all([
    useSemanticScope ? analyzePromptScreenIntent({ prompt, llmLog }) : Promise.resolve(parsePromptScreenIntent(prompt)),
    cachedReferenceAnalysisResult
      ? Promise.resolve(cachedReferenceAnalysisResult)
      : analyzeReferenceImageForScope({ prompt, image, referenceMode, llmLog }),
  ]);
  const scopeContract = resolveGenerationScopeContract({
    prompt,
    image,
    referenceMode,
    planningMode,
    referenceAnalysisResult,
    promptIntent,
  });

  return {
    scopeContract,
    referenceAnalysis: referenceAnalysisResult.analysis,
    referenceAnalysisResult,
  };
}
