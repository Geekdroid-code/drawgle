import type {
  ReferenceAnalysis,
  ScreenSemanticCapability,
  SemanticCompositionPrimitive,
  SemanticCompositionPrimitiveKind,
  SemanticTransferDecision,
} from "@/lib/types";

const CAPABILITIES: ScreenSemanticCapability[] = [
  "onboarding",
  "sequential-workflow",
  "conversation",
  "data-monitoring",
  "exploration",
  "transaction",
  "form-entry",
  "editorial-reading",
  "spatial-navigation",
  "media-immersive",
  "profile-configuration",
  "collection-browsing",
  "detail-inspection",
  "search-discovery",
  "status-feedback",
];

const PRIMITIVE_KINDS: SemanticCompositionPrimitiveKind[] = [
  "progressive-sequence",
  "focal-anchor",
  "layered-depth",
  "editorial-rhythm",
  "spatial-cluster",
  "data-comparison",
  "immersive-canvas",
  "anchored-action",
  "content-stream",
  "modular-workspace",
  "split-context",
  "reveal-on-demand",
];

const capabilitySet = new Set(CAPABILITIES);
const primitiveKindSet = new Set(PRIMITIVE_KINDS);
const SOURCE_SPECIFIC_ANATOMY = /\b(connector|spine|section order|object position|exact geometry|hero scaffold|card topology|grid placement|panel placement)\b|\b(?:one|two|three|four|five|six|\d+)\s+(?:cards?|modules?|panels?|sections?)\b|\b(?:stack|row|grid|cluster|connect(?:ed|ing)?)\b.{0,40}\b(cards?|modules?|panels?)\b|\b(cards?|modules?|panels?)\b.{0,40}\b(?:stack|row|grid|cluster|connect(?:ed|ing)?)\b/i;

const compact = (value: unknown, fallback = "", limit = 360) => {
  const text = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  if (!text) return fallback;
  return text.length > limit ? `${text.slice(0, limit - 3).trimEnd()}...` : text;
};

const uniqueStrings = (value: unknown, limit = 8) => {
  const values = Array.isArray(value) ? value : [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of values) {
    const text = compact(item);
    if (!text || seen.has(text.toLowerCase())) continue;
    seen.add(text.toLowerCase());
    result.push(text);
    if (result.length >= limit) break;
  }
  return result;
};

const normalizeCapabilities = (value: unknown, fallback: ScreenSemanticCapability[]) => {
  const values = Array.isArray(value) ? value : [];
  const normalized = values.filter(
    (item): item is ScreenSemanticCapability => typeof item === "string" && capabilitySet.has(item as ScreenSemanticCapability),
  );
  return normalized.length ? [...new Set(normalized)] : fallback;
};

const slug = (value: string) => value
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "")
  .slice(0, 60);

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const portablePrimitiveText = (value: unknown, fallback: string, limit: number) => {
  const candidate = compact(value, fallback, limit);
  return SOURCE_SPECIFIC_ANATOMY.test(candidate) ? fallback : candidate;
};

const portablePrimitiveList = (value: unknown, fallback: string[], limit: number) => {
  const candidates = uniqueStrings(value, limit).filter((item) => !SOURCE_SPECIFIC_ANATOMY.test(item));
  return candidates.length ? candidates : fallback;
};

export function classifyScreenCapabilities({
  name,
  description,
  type,
}: {
  name: string;
  description?: string;
  type?: "root" | "detail";
}): ScreenSemanticCapability[] {
  const haystack = `${name} ${description ?? ""}`.toLowerCase();
  const matches: ScreenSemanticCapability[] = [];
  const add = (capability: ScreenSemanticCapability, pattern: RegExp) => {
    if (pattern.test(haystack)) matches.push(capability);
  };

  add("onboarding", /\b(onboard|welcome|intro|getting started|setup journey|first run)\b/);
  add("conversation", /\b(chat|conversation|message|messaging|assistant|inbox|thread)\b/);
  add("data-monitoring", /\b(dashboard|analytics|metric|monitor|insight|report|log|telemetry|performance)\b/);
  add("spatial-navigation", /\b(map|route|location|nearby|navigation|geospatial)\b/);
  add("media-immersive", /\b(player|camera|video|music|media|immersive|gallery viewer)\b/);
  add("form-entry", /\b(form|create|edit|compose|apply|checkout details|enter|input|verification)\b/);
  add("transaction", /\b(checkout|payment|purchase|booking|order|transfer|subscribe|confirm)\b/);
  add("profile-configuration", /\b(profile|settings|preferences|account|configuration)\b/);
  add("search-discovery", /\b(search|discover|find|browse|explore|results)\b/);
  add("collection-browsing", /\b(catalog|library|collection|feed|list|inventory|products)\b/);
  add("editorial-reading", /\b(article|story|news|reader|guide|detail copy|editorial)\b/);
  add("sequential-workflow", /\b(step|stage|progress|workflow|pipeline|wizard|timeline|process|deployment|review flow)\b/);
  add("status-feedback", /\b(status|success|error|empty state|loading|processing|complete|result)\b/);
  add("detail-inspection", /\b(detail|receipt|summary|overview|inspection|item view)\b/);
  add("exploration", /\b(home|explore|discover|browse|recommend|overview)\b/);

  if (!matches.length) matches.push(type === "detail" ? "detail-inspection" : "exploration");
  return [...new Set(matches)].slice(0, 4);
}

type PrimitiveTemplate = Omit<SemanticCompositionPrimitive, "id" | "sourceScreenIndex">;

const templates: Record<SemanticCompositionPrimitiveKind, PrimitiveTemplate> = {
  "progressive-sequence": {
    kind: "progressive-sequence",
    label: "Legible progression",
    purpose: "Turn genuinely ordered stages into one comprehensible journey while keeping the current state dominant.",
    sourceEvidence: "Directional continuity and differentiated states make separate moments read as a purposeful sequence.",
    transferableTraits: ["ordered emphasis", "directional continuity", "completed-current-future differentiation"],
    suitableFor: ["onboarding", "sequential-workflow", "status-feedback"],
    avoidFor: ["conversation", "editorial-reading", "spatial-navigation", "collection-browsing"],
    adaptationGuidance: "Use only when target content has a real order or dependency; invent target-native geometry and components.",
    qualityDetails: ["Make the current stage dominant and adjacent stages subordinate.", "Keep continuity cues quieter than content so they clarify rather than decorate."],
    strength: "primary",
  },
  "focal-anchor": {
    kind: "focal-anchor",
    label: "Single focal anchor",
    purpose: "Give the screen one unmistakable first read before supporting content enters the hierarchy.",
    sourceEvidence: "Scale, contrast, and protected space establish one dominant visual or message.",
    transferableTraits: ["one dominant first read", "protected negative space", "controlled supporting contrast"],
    suitableFor: ["onboarding", "sequential-workflow", "conversation", "data-monitoring", "exploration", "transaction", "form-entry", "editorial-reading", "spatial-navigation", "media-immersive", "profile-configuration", "collection-browsing", "detail-inspection", "search-discovery", "status-feedback"],
    avoidFor: [],
    adaptationGuidance: "Choose a focal object native to the target task; preserve hierarchy mechanics, never the source hero anatomy.",
    qualityDetails: ["Only one region should carry peak scale or contrast.", "Reserve enough negative space around the focal anchor to prevent equal-weight competition."],
    strength: "primary",
  },
  "layered-depth": {
    kind: "layered-depth",
    label: "Purposeful depth",
    purpose: "Use surface hierarchy and overlap to clarify containment, state, or action priority.",
    sourceEvidence: "Distinct material planes create readable foreground, content, and background roles.",
    transferableTraits: ["clear plane hierarchy", "restrained overlap", "material-specific elevation"],
    suitableFor: ["onboarding", "conversation", "data-monitoring", "transaction", "detail-inspection", "media-immersive"],
    avoidFor: [],
    adaptationGuidance: "Rebuild depth around the target information architecture and use elevation only where it explains hierarchy.",
    qualityDetails: ["Limit elevation to a small, legible set of planes.", "Pair overlap with containment or priority; decorative floating surfaces alone are not sufficient."],
    strength: "supporting",
  },
  "editorial-rhythm": {
    kind: "editorial-rhythm",
    label: "Editorial rhythm",
    purpose: "Create premium pacing through type scale, line length, grouped whitespace, and deliberate density changes.",
    sourceEvidence: "Typography and negative space create cadence instead of relying on repeated containers.",
    transferableTraits: ["macro-micro spacing contrast", "controlled line length", "density modulation"],
    suitableFor: ["editorial-reading", "onboarding", "detail-inspection", "exploration", "conversation"],
    avoidFor: [],
    adaptationGuidance: "Apply the cadence to target-native content, with containers introduced only when grouping or interaction requires them.",
    qualityDetails: ["Make gaps between semantic groups visibly larger than gaps inside them.", "Avoid turning every text group into an equal-radius card."],
    strength: "supporting",
  },
  "spatial-cluster": {
    kind: "spatial-cluster",
    label: "Spatial clustering",
    purpose: "Make related objects read as a meaningful cluster through proximity, alignment, and controlled overlap.",
    sourceEvidence: "Proximity and shared alignment communicate relationships before borders or labels do.",
    transferableTraits: ["proximity-based grouping", "shared alignment anchors", "selective overlap"],
    suitableFor: ["exploration", "collection-browsing", "data-monitoring", "spatial-navigation"],
    avoidFor: ["form-entry"],
    adaptationGuidance: "Cluster only target entities with a real relationship and select a geometry native to their content.",
    qualityDetails: ["Use proximity before adding outlines or background boxes.", "Keep one stable alignment anchor so asymmetry feels intentional."],
    strength: "supporting",
  },
  "data-comparison": {
    kind: "data-comparison",
    label: "Comparison field",
    purpose: "Make differences, trends, and outliers visible without forcing users to parse equal-weight metric cards.",
    sourceEvidence: "Shared scales and deliberate emphasis turn multiple values into a comparison rather than a collection.",
    transferableTraits: ["shared comparison basis", "outlier emphasis", "quiet supporting labels"],
    suitableFor: ["data-monitoring", "detail-inspection", "status-feedback"],
    avoidFor: ["onboarding", "conversation", "form-entry"],
    adaptationGuidance: "Choose chart, table, or spatial comparison geometry from the target data relationship, not from the screenshot.",
    qualityDetails: ["Keep labels subordinate to the values or trend being compared.", "Avoid one detached card per metric when a shared visual field explains relationships better."],
    strength: "primary",
  },
  "immersive-canvas": {
    kind: "immersive-canvas",
    label: "Immersive canvas",
    purpose: "Let a map, media object, or manipulable space become the working surface instead of a card inside the page.",
    sourceEvidence: "A dominant visual plane carries the task while controls occupy restrained overlays.",
    transferableTraits: ["task-dominant visual plane", "edge-aware overlays", "minimal control chrome"],
    suitableFor: ["spatial-navigation", "media-immersive", "exploration"],
    avoidFor: ["form-entry", "conversation", "editorial-reading"],
    adaptationGuidance: "Use only when direct manipulation or spatial/media context is central to the target task.",
    qualityDetails: ["Protect the canvas from oversized cards and redundant headers.", "Keep overlays compact and preserve legibility over variable content."],
    strength: "primary",
  },
  "anchored-action": {
    kind: "anchored-action",
    label: "Anchored commitment",
    purpose: "Keep a high-value action predictably available after users have enough context to commit.",
    sourceEvidence: "Action placement and contrast create a stable endpoint without competing with the content journey.",
    transferableTraits: ["stable action endpoint", "clear primary-secondary weight", "safe-area discipline"],
    suitableFor: ["transaction", "form-entry", "onboarding", "detail-inspection"],
    avoidFor: ["conversation", "data-monitoring"],
    adaptationGuidance: "Anchor only the target task's true commitment action and preserve content/navigation clearance.",
    qualityDetails: ["Use one primary commitment action at peak emphasis.", "Keep the action visually connected to the decision context rather than floating arbitrarily."],
    strength: "supporting",
  },
  "content-stream": {
    kind: "content-stream",
    label: "Continuous content stream",
    purpose: "Support chronological or conversational scanning with a stable reading axis and asymmetric authorship or state cues.",
    sourceEvidence: "Repeated content follows one reading axis while variation communicates speaker, time, or state.",
    transferableTraits: ["stable reading axis", "authorship/state differentiation", "continuity across variable lengths"],
    suitableFor: ["conversation", "editorial-reading", "collection-browsing", "status-feedback"],
    avoidFor: ["onboarding", "transaction"],
    adaptationGuidance: "Let target message or feed semantics determine grouping, width, and alignment; do not convert unrelated source modules into bubbles.",
    qualityDetails: ["Vary grouping by semantic continuity instead of enclosing every item identically.", "Keep timestamps, metadata, and system states subordinate to primary content."],
    strength: "primary",
  },
  "modular-workspace": {
    kind: "modular-workspace",
    label: "Modular workspace",
    purpose: "Organize independent tools or datasets into zones while preserving one dominant task path.",
    sourceEvidence: "Modules share a system but vary in weight, density, and interaction according to their role.",
    transferableTraits: ["role-based module weight", "shared alignment system", "density variation"],
    suitableFor: ["data-monitoring", "exploration", "profile-configuration"],
    avoidFor: ["conversation", "onboarding"],
    adaptationGuidance: "Derive module count and geometry from target workflows; never repeat the source card topology.",
    qualityDetails: ["Give modules unequal visual weight according to decision value.", "Use a shared alignment rail without forcing every module into the same dimensions."],
    strength: "primary",
  },
  "split-context": {
    kind: "split-context",
    label: "Context-and-action split",
    purpose: "Keep source context visible while users inspect details or act on a selected object.",
    sourceEvidence: "A stable context plane and a focused action/detail plane remain visually related.",
    transferableTraits: ["persistent context", "focused secondary plane", "clear plane ownership"],
    suitableFor: ["spatial-navigation", "detail-inspection", "data-monitoring", "media-immersive"],
    avoidFor: ["onboarding", "conversation"],
    adaptationGuidance: "Use only when the target task benefits from simultaneous context and detail on a mobile viewport.",
    qualityDetails: ["Keep the secondary plane compact enough that context remains useful.", "Use depth and edge treatment to clarify which plane is interactive."],
    strength: "supporting",
  },
  "reveal-on-demand": {
    kind: "reveal-on-demand",
    label: "Progressive disclosure",
    purpose: "Protect the primary task from secondary controls or detail until the user requests them.",
    sourceEvidence: "Secondary information recedes into expandable, modal, or contextual states.",
    transferableTraits: ["primary-task protection", "contextual disclosure", "state-aware depth"],
    suitableFor: ["form-entry", "detail-inspection", "data-monitoring", "profile-configuration", "conversation"],
    avoidFor: [],
    adaptationGuidance: "Hide only genuinely secondary target content and preserve discoverability of the reveal affordance.",
    qualityDetails: ["Keep the collapsed state informative enough to predict what will appear.", "Use disclosure to reduce cognitive load, not to conceal required actions."],
    strength: "supporting",
  },
};

const detectionRules: Array<{ kind: SemanticCompositionPrimitiveKind; pattern: RegExp }> = [
  { kind: "progressive-sequence", pattern: /\b(sequence|progress|step|stage|timeline|connector|spine|flow|journey|completed|current state)\b/i },
  { kind: "focal-anchor", pattern: /\b(hero|focal|dominant|first read|visual hierarchy|large type|centerpiece|primary emphasis)\b/i },
  { kind: "layered-depth", pattern: /\b(layer|depth|overlap|elevat|shadow|sheet|floating|foreground|background plane|glass)\b/i },
  { kind: "editorial-rhythm", pattern: /\b(editorial|typograph|rhythm|negative space|whitespace|line length|cadence|breathing room)\b/i },
  { kind: "spatial-cluster", pattern: /\b(cluster|proximity|constellation|grouping|shared alignment|spatial)\b/i },
  { kind: "data-comparison", pattern: /\b(chart|metric|trend|comparison|analytics|gauge|bar|axis|data)\b/i },
  { kind: "immersive-canvas", pattern: /\b(map|canvas|immersive|media plane|full bleed|video|camera|route)\b/i },
  { kind: "anchored-action", pattern: /\b(anchored|sticky|bottom action|primary cta|commitment|continue button|fixed action)\b/i },
  { kind: "content-stream", pattern: /\b(chat|conversation|message|feed|chronological|stream|thread|reading axis)\b/i },
  { kind: "modular-workspace", pattern: /\b(dashboard|modular|widget|workspace|grid system|independent tools)\b/i },
  { kind: "split-context", pattern: /\b(split|context plane|detail plane|map sheet|side-by-side|master detail)\b/i },
  { kind: "reveal-on-demand", pattern: /\b(disclosure|expand|collapse|modal|drawer|popover|on demand|progressive reveal)\b/i },
];

export function normalizeSemanticCompositionPrimitives(value: unknown): SemanticCompositionPrimitive[] {
  if (!Array.isArray(value)) return [];
  const result: SemanticCompositionPrimitive[] = [];
  const seen = new Set<string>();

  for (const item of value.slice(0, 10)) {
    const record = asRecord(item);
    if (!record || typeof record.kind !== "string" || !primitiveKindSet.has(record.kind as SemanticCompositionPrimitiveKind)) continue;
    const kind = record.kind as SemanticCompositionPrimitiveKind;
    const template = templates[kind];
    const id = slug(compact(record.id, `${kind}-${result.length + 1}`, 80)) || `${kind}-${result.length + 1}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const screenIndex = typeof record.sourceScreenIndex === "number"
      ? Math.max(1, Math.round(record.sourceScreenIndex))
      : typeof record.source_screen_index === "number"
        ? Math.max(1, Math.round(record.source_screen_index))
        : undefined;
    result.push({
      id,
      kind,
      label: portablePrimitiveText(record.label, template.label, 120),
      purpose: portablePrimitiveText(record.purpose, template.purpose, 500),
      sourceEvidence: portablePrimitiveText(record.sourceEvidence ?? record.source_evidence, template.sourceEvidence, 500),
      transferableTraits: portablePrimitiveList(
        record.transferableTraits ?? record.transferable_traits,
        template.transferableTraits,
        6,
      ),
      suitableFor: normalizeCapabilities(record.suitableFor ?? record.suitable_for, template.suitableFor),
      avoidFor: normalizeCapabilities(record.avoidFor ?? record.avoid_for, template.avoidFor),
      adaptationGuidance: portablePrimitiveText(
        record.adaptationGuidance ?? record.adaptation_guidance,
        template.adaptationGuidance,
        500,
      ),
      qualityDetails: portablePrimitiveList(
        record.qualityDetails ?? record.quality_details,
        template.qualityDetails,
        6,
      ),
      strength: record.strength === "primary" || record.strength === "accent" ? record.strength : "supporting",
      ...(screenIndex ? { sourceScreenIndex: screenIndex } : {}),
    });
  }
  return result;
}

export function deriveSemanticCompositionPrimitives(referenceAnalysis: ReferenceAnalysis) {
  const result: SemanticCompositionPrimitive[] = [];
  const usedKinds = new Set<SemanticCompositionPrimitiveKind>();

  for (const screen of referenceAnalysis.screenReferences) {
    const evidence = [
      screen.suggestedRole,
      screen.layoutSummary,
      screen.visualHierarchy,
      ...screen.components,
      ...screen.stylingCues,
      ...(screen.compositionRules ?? []),
      ...(screen.spacingRules ?? []),
      ...(screen.componentRules ?? []),
    ].join(" ");

    for (const rule of detectionRules) {
      if (usedKinds.has(rule.kind) || !rule.pattern.test(evidence)) continue;
      const template = templates[rule.kind];
      result.push({
        ...template,
        id: `${rule.kind}-screen-${screen.index}`,
        sourceScreenIndex: screen.index,
      });
      usedKinds.add(rule.kind);
    }
  }

  if (!usedKinds.has("focal-anchor")) {
    result.push({ ...templates["focal-anchor"], id: "focal-anchor-reference", sourceScreenIndex: 1 });
  }
  if (!usedKinds.has("editorial-rhythm")) {
    result.push({ ...templates["editorial-rhythm"], id: "editorial-rhythm-reference", sourceScreenIndex: 1 });
  }
  return result.slice(0, 8);
}

export function ensureSemanticCompositionPrimitives(referenceAnalysis: ReferenceAnalysis): ReferenceAnalysis {
  const normalized = normalizeSemanticCompositionPrimitives(referenceAnalysis.semanticCompositionPrimitives);
  return {
    ...referenceAnalysis,
    semanticCompositionPrimitives: normalized.length
      ? normalized
      : deriveSemanticCompositionPrimitives(referenceAnalysis),
  };
}

const hasStagedTargetIntent = (description: string) =>
  /\b(stage|step|progress|timeline|pipeline|tool execution|processing sequence|ordered (?:flow|workflow|stages?)|workflow stages?|dependency chain)\b/i.test(description);

const sourceCapabilitiesFor = (primitive: SemanticCompositionPrimitive, analysis: ReferenceAnalysis) => {
  const source = primitive.sourceScreenIndex
    ? analysis.screenReferences.find((screen) => screen.index === primitive.sourceScreenIndex)
    : analysis.screenReferences[0];
  return classifyScreenCapabilities({
    name: source?.suggestedRole ?? "Reference screen",
    description: source?.layoutSummary,
  });
};

const suitabilityFor = ({
  primitive,
  targetCapabilities,
  screenDescription,
  referenceAnalysis,
}: {
  primitive: SemanticCompositionPrimitive;
  targetCapabilities: ScreenSemanticCapability[];
  screenDescription: string;
  referenceAnalysis: ReferenceAnalysis;
}) => {
  const targetCapability = targetCapabilities.find((capability) => primitive.suitableFor.includes(capability))
    ?? targetCapabilities[0];
  const suitable = targetCapabilities.some((capability) => primitive.suitableFor.includes(capability));
  const avoided = targetCapabilities.some((capability) => primitive.avoidFor.includes(capability));
  const sameRole = sourceCapabilitiesFor(primitive, referenceAnalysis)
    .some((capability) => targetCapabilities.includes(capability));
  let score = 30 + (suitable ? 45 : 0) + (avoided ? -65 : 0) + (sameRole ? 15 : 0) + (primitive.strength === "primary" ? 5 : 0);

  if (primitive.kind === "progressive-sequence" && targetCapabilities.includes("conversation")) {
    score = hasStagedTargetIntent(screenDescription) ? Math.min(65, Math.max(score, 55)) : Math.min(score, 20);
  }
  score = Math.max(0, Math.min(100, score));
  return { score, targetCapability, sameRole, avoided };
};

const portableCraftTargets = (analysis: ReferenceAnalysis) => {
  const structuralCue = SOURCE_SPECIFIC_ANATOMY;
  const candidates = analysis.screenReferences.flatMap((screen) => [
    ...screen.stylingCues,
    ...(screen.spacingRules ?? []),
    ...(screen.componentRules ?? []),
  ]);
  const seen = new Set<string>();
  return candidates.filter((item) => {
    const text = compact(item);
    const key = text.toLowerCase();
    if (!text || structuralCue.test(text) || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 4);
};

export function buildSemanticTransferPlan({
  referenceAnalysis,
  screenName,
  screenDescription = "",
  screenType,
}: {
  referenceAnalysis: ReferenceAnalysis;
  screenName: string;
  screenDescription?: string;
  screenType?: "root" | "detail";
}): {
  targetCapabilities: ScreenSemanticCapability[];
  semanticDecisions: SemanticTransferDecision[];
  premiumQualityTargets: string[];
} {
  const analysis = ensureSemanticCompositionPrimitives(referenceAnalysis);
  const targetCapabilities = classifyScreenCapabilities({ name: screenName, description: screenDescription, type: screenType });
  const semanticDecisions = (analysis.semanticCompositionPrimitives ?? []).map((primitive): SemanticTransferDecision => {
    const suitability = suitabilityFor({
      primitive,
      targetCapabilities,
      screenDescription: `${screenName} ${screenDescription}`,
      referenceAnalysis: analysis,
    });
    const decision = suitability.score >= 75 ? "preserve" : suitability.score >= 50 ? "reinterpret" : "reject";
    const rationale = decision === "reject"
      ? `${primitive.label} does not serve the target's ${suitability.targetCapability} job${suitability.avoided ? " and risks importing source-specific anatomy" : ""}.`
      : suitability.sameRole
        ? `${primitive.label} serves the same functional capability, so its principle may transfer while geometry remains target-native.`
        : `${primitive.label} can support the target's ${suitability.targetCapability} job only through a new target-native composition.`;
    return {
      primitiveId: primitive.id,
      decision,
      suitabilityScore: suitability.score,
      targetCapability: suitability.targetCapability,
      rationale,
      adaptation: decision === "reject"
        ? null
        : `${primitive.adaptationGuidance} For ${screenName}, use ${primitive.transferableTraits.join(", ")}.`,
      qualityTargets: decision === "reject" ? [] : primitive.qualityDetails.slice(0, 3),
    };
  });

  const selectedQuality = semanticDecisions
    .filter((decision) => decision.decision !== "reject")
    .flatMap((decision) => decision.qualityTargets);
  const premiumQualityTargets = [...new Set([
    ...selectedQuality,
    ...portableCraftTargets(analysis),
    "Create one dominant first read, then a visibly quieter supporting hierarchy; avoid equal-weight card repetition.",
    "Make macro gaps between semantic groups clearly larger than micro gaps inside components.",
  ])].slice(0, 10);

  return { targetCapabilities, semanticDecisions, premiumQualityTargets };
}

export function formatSemanticCompositionLibrary(referenceAnalysis: ReferenceAnalysis) {
  const analysis = ensureSemanticCompositionPrimitives(referenceAnalysis);
  const primitives = analysis.semanticCompositionPrimitives ?? [];
  if (!primitives.length) return "";
  return [
    "SEMANTIC COMPOSITION LIBRARY (principles, never source geometry)",
    ...primitives.map((primitive) => [
      `- ${primitive.id} ? ${primitive.label} [${primitive.strength}; ${primitive.kind}]: ${primitive.purpose}`,
      `  Why it works: ${primitive.sourceEvidence}`,
      `  Transfer: ${primitive.transferableTraits.join("; ")}`,
      `  Suitable for: ${primitive.suitableFor.join(", ") || "only when functionally justified"}`,
      primitive.avoidFor.length ? `  Avoid for: ${primitive.avoidFor.join(", ")}` : null,
      `  Adaptation rule: ${primitive.adaptationGuidance}`,
      `  Craft bar: ${primitive.qualityDetails.join("; ")}`,
    ].filter(Boolean).join("\n")),
  ].join("\n");
}