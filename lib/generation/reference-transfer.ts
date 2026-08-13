import {
  buildSemanticTransferPlan,
  classifyScreenCapabilities,
  ensureSemanticCompositionPrimitives,
  formatSemanticCompositionLibrary,
} from "@/lib/generation/semantic-inspiration";
import type {
  CreativeDirection,
  ReferenceAnalysis,
  ReferenceCompositionAdaptation,
  ReferenceLocalMotifRule,
  ReferenceTransferContract,
  ScreenLayoutRegion,
  SemanticCompositionPrimitive,
  SemanticTransferDecision,
} from "@/lib/types";

export type ReferenceTransferMode = "recreate" | "style" | "prompt";

const compact = (value: string | null | undefined, limit = 360) => {
  const text = value?.replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.length > limit ? `${text.slice(0, limit - 3).trimEnd()}...` : text;
};

const unique = (values: Array<string | null | undefined>, limit: number) => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = compact(value);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
    if (result.length >= limit) break;
  }

  return result;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const stringArray = (value: unknown, limit: number) =>
  unique(
    Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [],
    limit,
  );

const containsWholeSourceTerm = (text: string, term: string) => {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`).test(text);
};

export const findSourceContentQuarantineLeaks = ({
  text,
  contract,
  allowedProductText = "",
}: {
  text: string;
  contract?: ReferenceTransferContract | null;
  allowedProductText?: string;
}) => {
  const haystack = text.replace(/\s+/g, " ").trim().toLowerCase();
  const allowed = allowedProductText.replace(/\s+/g, " ").trim().toLowerCase();
  return (contract?.sourceContentQuarantine ?? [])
    .map((term) => term.replace(/\s+/g, " ").trim().toLowerCase())
    .filter((term) => term.length >= 4 && term.length <= 120)
    .filter((term) => !containsWholeSourceTerm(allowed, term) && containsWholeSourceTerm(haystack, term))
    .filter((term, index, all) => all.indexOf(term) === index);
};

// Reject literal source anatomy, not useful design grammar. Relationships such
// as grouping, rows, grids, layering, and hierarchy are portable when they are
// remapped to a target-owned region and functional purpose.
const SOURCE_ANATOMY_CUE_PATTERN = /\b(section order|followed by|object positions?|exact coordinates?|same coordinates?|spine|connected cards?|paired (?:cards?|modules?|panels?)|hero scaffold|card topology|full[- ]screen anatomy|source[- ]specific anatomy|literal component arrangement|exact geometry|grid placement|panel placement)\b|\b(?:source|reference|same|exact)\b.{0,36}\b(?:layout|composition|anatomy|section|position|arrangement|topology)\b|\b(?:one|two|three|four|five|six|\d+)\s+(?:specific\s+)?(?:cards?|modules?|panels?|sections?)\b/i;
const STRUCTURAL_COPY_PATTERN = /\b(copy|clone|same|exact|point[\s-]to[\s-]point)\b.*\b(layout|composition|anatomy|screen|reference)\b/i;

export function buildPortableReferenceContext(referenceAnalysis: ReferenceAnalysis) {
  const analysis = ensureSemanticCompositionPrimitives(referenceAnalysis);
  const signals = analysis.designSystemSignals;
  const craftCues = unique(
    analysis.screenReferences.flatMap((screen) => [
      ...screen.stylingCues,
      ...(screen.spacingRules ?? []),
      ...(screen.componentRules ?? []),
    ]).filter((cue) => !SOURCE_ANATOMY_CUE_PATTERN.test(cue)),
    10,
  );
  const measuredGeometry = analysis.geometryProfile?.measurements
    .filter((measurement) => measurement.confidence === "high" && measurement.sourceLayer === "app-ui")
    .map((measurement) => `${measurement.role}=${measurement.minPx}-${measurement.maxPx}px (${measurement.scope})`)
    .slice(0, 16) ?? [];
  const motifPolicy = (analysis.motifs ?? []).map((motif) =>
    `${motif.id} is ${motif.scope}; function=${motif.functionalPurpose}; never treat it as project-wide anatomy unless scope is global-material.`);
  const sourceQuarantine = unique([
    analysis.sourceContentEvidence?.domainSummary,
    ...(analysis.sourceContentEvidence?.terms ?? []),
    ...(analysis.sourceContentEvidence?.entities ?? []),
    ...(analysis.sourceContentEvidence?.actions ?? []),
    ...(analysis.sourceContentEvidence?.copyFragments ?? []),
    ...analysis.screenReferences.flatMap((screen) => screen.copyPatterns ?? []),
  ], 40);
  const portableLayoutGrammar = !signals.layoutGrammar || SOURCE_ANATOMY_CUE_PATTERN.test(signals.layoutGrammar)
    ? null
    : signals.layoutGrammar;
  const portableComponentGrammar = !signals.componentGrammar || SOURCE_ANATOMY_CUE_PATTERN.test(signals.componentGrammar)
    ? null
    : signals.componentGrammar;

  return [
    "PORTABLE REFERENCE INVARIANTS",
    "The source screenshot's coordinates, section order, object positions, role-specific components, and literal decorative anatomy are excluded. Its design intelligence is preserved below as visual invariants, craft recipes, and function-tested composition principles.",
    `Palette: ${signals.palette}`,
    `Typography: ${signals.typography}`,
    `Surfaces/materials: ${signals.surfaces}`,
    `Iconography: ${signals.iconography}`,
    `Density: ${signals.density}`,
    portableLayoutGrammar ? `Portable layout relationships: ${portableLayoutGrammar}` : null,
    portableComponentGrammar ? `Portable component grammar: ${portableComponentGrammar}` : null,
    signals.spacingLogic ? `Macro/micro spacing logic: ${signals.spacingLogic}` : null,
    `Motion tone: ${signals.motionTone}`,
    craftCues.length ? `Portable craft recipes: ${craftCues.join("; ")}` : null,
    measuredGeometry.length ? `Trusted app-UI measurements: ${measuredGeometry.join("; ")}` : null,
    motifPolicy.length ? `Motif locality evidence: ${motifPolicy.join("; ")}` : null,
    signals.antiPatterns ? `Avoid: ${signals.antiPatterns}` : null,
    sourceQuarantine.length ? `SOURCE-CONTENT QUARANTINE (never use as target product content, labels, entities, actions, requirements, or copy): ${sourceQuarantine.join(" | ")}` : null,
    formatSemanticCompositionLibrary(analysis),
  ].filter(Boolean).join("\n");
}

const portableCreativeField = (value: string, fallback: string) =>
  SOURCE_ANATOMY_CUE_PATTERN.test(value) || STRUCTURAL_COPY_PATTERN.test(value)
    ? fallback
    : value;

export function toPortableCreativeDirection(
  creativeDirection?: CreativeDirection | null,
): CreativeDirection | null {
  if (!creativeDirection) return null;
  const portablePrinciples = creativeDirection.compositionPrinciples
    .filter((principle) => !SOURCE_ANATOMY_CUE_PATTERN.test(principle) && !STRUCTURAL_COPY_PATTERN.test(principle));
  const portableMoments = creativeDirection.signatureMoments
    .filter((moment) => !SOURCE_ANATOMY_CUE_PATTERN.test(moment) && !STRUCTURAL_COPY_PATTERN.test(moment));

  return {
    ...creativeDirection,
    conceptName: portableCreativeField(creativeDirection.conceptName, "Portable Product System"),
    styleEssence: portableCreativeField(
      creativeDirection.styleEssence,
      "Preserve the approved visual tone and craft while deriving composition from each screen's job.",
    ),
    surfaceLanguage: portableCreativeField(
      creativeDirection.surfaceLanguage,
      "Use the approved material, edge, depth, and elevation language without source-specific arrangements.",
    ),
    compositionPrinciples: unique([
      ...portablePrinciples,
      "Derive each screen's information architecture and dominant composition from that screen's user job.",
      "Keep product-wide spacing, typography, material, color, and icon decisions consistent while varying screen anatomy.",
      "Reuse a compositional principle only when its purpose is suitable for the target screen.",
    ], 7),
    signatureMoments: unique([
      ...portableMoments,
      "Invent one screen-purpose-specific focal moment from an approved semantic composition principle.",
    ], 5),
  };
}

const emptySemanticPlan = ({
  screenName,
  screenDescription,
  screenType,
}: {
  screenName: string;
  screenDescription?: string;
  screenType?: "root" | "detail";
}) => ({
  targetCapabilities: classifyScreenCapabilities({ name: screenName, description: screenDescription, type: screenType }),
  semanticDecisions: [] as SemanticTransferDecision[],
  premiumQualityTargets: [
    "Create one dominant first read, then a visibly quieter supporting hierarchy; avoid equal-weight card repetition.",
    "Make macro gaps between semantic groups clearly larger than micro gaps inside components.",
  ],
});

const regionMatchesPurpose = (region: ScreenLayoutRegion, purpose: string) => {
  const text = `${purpose} ${region.purpose}`.toLowerCase();
  if (/chart|graph|plot|axis|grid line|data visual/.test(text)) return region.contentKind === "chart";
  if (/list|row|ledger|feed|table|collection/.test(text)) return region.contentKind === "list";
  if (/form|field|input|entry/.test(text)) return region.contentKind === "form";
  if (/media|image|photo|video|illustration/.test(text)) return region.contentKind === "media";
  if (/button|action|cta|control/.test(text)) return region.contentKind === "action";
  return false;
};

const buildLocalMotifRules = (
  referenceAnalysis: ReferenceAnalysis | null | undefined,
  regions: ScreenLayoutRegion[],
): ReferenceLocalMotifRule[] => (referenceAnalysis?.motifs ?? []).slice(0, 12).map((motif) => {
  const targetRegionIds = regions
    .filter((region) => regionMatchesPurpose(region, `${motif.description} ${motif.functionalPurpose}`))
    .map((region) => region.id);
  const allowed = targetRegionIds.length > 0 && motif.scope !== "global-material";
  return {
    motifId: motif.id,
    decision: allowed ? "allow-local" : "reject",
    targetRegionIds: allowed ? targetRegionIds : [],
    requiredFunction: motif.functionalPurpose,
    repetition: "per-approved-region",
    rationale: allowed
      ? "The target has a named region with the same functional purpose; keep the motif inside that region only."
      : motif.scope === "global-material"
        ? "Project-wide material evidence belongs in visual invariants, not in a repeatable local-motif rule."
        : "No target region independently requires this source-local motif, so it must not transfer.",
  };
});

const NAVIGATION_PRIMITIVE_PATTERN = /\b(?:navigation|bottom nav|tab bar|nav dock|floating dock|app chrome|back control)\b/i;

const compatibleRegionsForPrimitive = (
  primitive: SemanticCompositionPrimitive,
  regions: ScreenLayoutRegion[],
) => {
  // The primitive kind already describes the source. Compatibility must be
  // proven by the target region itself; including primitive purpose here made
  // every region appear compatible whenever the source contained a keyword.
  const purposeMatches = (region: ScreenLayoutRegion, pattern: RegExp) => pattern.test(region.purpose);
  switch (primitive.kind) {
    case "anchored-action":
      return regions.filter((region) => region.contentKind === "action");
    case "data-comparison":
      return regions.filter((region) => region.contentKind === "chart" || purposeMatches(region, /\bcompar(?:e|ison|ative)|trend|metric\b/i));
    case "content-stream":
      return regions.filter((region) => region.contentKind === "list" || purposeMatches(region, /\bfeed|stream|timeline|activity|ledger|history\b/i));
    case "immersive-canvas":
      return regions.filter((region) => (region.contentKind === "media" || region.contentKind === "focal") && purposeMatches(region, /\bmedia|canvas|map|visual|preview|hero\b/i));
    case "progressive-sequence":
      return regions.filter((region) => purposeMatches(region, /\bstep|stage|progress|sequence|timeline|onboard\b/i));
    case "focal-anchor":
      return regions.filter((region) => region.contentKind === "focal");
    case "reveal-on-demand":
      return regions.filter((region) => purposeMatches(region, /\bexpand|reveal|disclos|accordion|details on demand\b/i));
    case "editorial-rhythm":
      return regions.filter((region) => purposeMatches(region, /\beditorial|article|story|reading|narrative\b/i));
    case "layered-depth":
      return regions.filter((region) => purposeMatches(region, /\blayer|overlay|sheet|depth|stacked context\b/i));
    case "spatial-cluster":
      return regions.filter((region) => ["focal", "media", "list"].includes(region.contentKind) && purposeMatches(region, /\bcluster|spatial|browse|collection|group\b/i));
    case "modular-workspace":
      return regions.filter((region) => ["supporting", "list", "form"].includes(region.contentKind) && purposeMatches(region, /\bmodule|workspace|tool|editor|dashboard\b/i));
    case "split-context":
      return regions.filter((region) => ["focal", "supporting"].includes(region.contentKind) && purposeMatches(region, /\bsplit|context|master|detail|comparison\b/i));
    default:
      return [];
  }
};

const buildCompositionAdaptations = (
  decisions: SemanticTransferDecision[],
  regions: ScreenLayoutRegion[],
  referenceAnalysis?: ReferenceAnalysis | null,
): ReferenceCompositionAdaptation[] => decisions
  .filter((decision) => decision.decision !== "reject" && decision.adaptation)
  .slice(0, 8)
  .flatMap((decision) => {
    const primitive = referenceAnalysis?.semanticCompositionPrimitives?.find((candidate) => candidate.id === decision.primitiveId);
    if (!primitive || NAVIGATION_PRIMITIVE_PATTERN.test(`${primitive.label} ${primitive.purpose} ${primitive.sourceEvidence}`)) return [];
    const targetRegions = compatibleRegionsForPrimitive(primitive, regions).slice(0, 3);
    if (!targetRegions.length) return [];
    return [{
      sourcePrimitiveId: primitive.id,
      sourcePrimitiveKind: primitive.kind,
      principle: decision.adaptation ?? decision.rationale,
      targetRegionIds: targetRegions.map((region) => region.id),
      functionalPurpose: decision.rationale,
    }];
  })
  .filter((item, index, all) => {
    const key = `${item.sourcePrimitiveId}|${[...item.targetRegionIds].sort().join(",")}`;
    return all.findIndex((candidate) => `${candidate.sourcePrimitiveId}|${[...candidate.targetRegionIds].sort().join(",")}` === key) === index;
  });

const enforceRegionCompatibility = (
  decisions: SemanticTransferDecision[],
  regions: ScreenLayoutRegion[],
  referenceAnalysis?: ReferenceAnalysis | null,
) => decisions.map((decision) => {
  if (decision.decision === "reject") return decision;
  const primitive = referenceAnalysis?.semanticCompositionPrimitives?.find((candidate) => candidate.id === decision.primitiveId);
  if (!primitive) return { ...decision, decision: "reject" as const, adaptation: null, qualityTargets: [], rationale: "The source primitive could not be resolved safely." };
  if (NAVIGATION_PRIMITIVE_PATTERN.test(`${primitive.label} ${primitive.purpose} ${primitive.sourceEvidence}`)) {
    return { ...decision, decision: "reject" as const, adaptation: null, qualityTargets: [], rationale: "Navigation and chrome evidence is owned exclusively by NavigationAppearanceContract." };
  }
  if (compatibleRegionsForPrimitive(primitive, regions).length > 0) return decision;
  if (primitive.kind === "editorial-rhythm" || primitive.kind === "layered-depth") {
    return {
      ...decision,
      adaptation: null,
      rationale: "No target region explicitly requires this composition; retain only its non-structural craft traits as visual invariants.",
    };
  }
  return {
    ...decision,
    decision: "reject" as const,
    adaptation: null,
    qualityTargets: [],
    rationale: "No named target region has both a compatible content kind and matching functional purpose.",
  };
});

export function createReferenceTransferContract({
  mode,
  screenName,
  screenDescription = "",
  screenType,
  referenceAnalysis,
  screenLayoutRegions = [],
}: {
  mode: ReferenceTransferMode;
  screenName: string;
  screenDescription?: string;
  screenType?: "root" | "detail";
  referenceAnalysis?: ReferenceAnalysis | null;
  screenLayoutRegions?: ScreenLayoutRegion[];
}): ReferenceTransferContract {
  const signals = referenceAnalysis?.designSystemSignals;
  const sourceContentQuarantine = unique([
    referenceAnalysis?.sourceContentEvidence?.domainSummary,
    ...(referenceAnalysis?.sourceContentEvidence?.terms ?? []),
    ...(referenceAnalysis?.sourceContentEvidence?.entities ?? []),
    ...(referenceAnalysis?.sourceContentEvidence?.actions ?? []),
    ...(referenceAnalysis?.sourceContentEvidence?.copyFragments ?? []),
    ...(referenceAnalysis?.screenReferences.flatMap((screen) => screen.copyPatterns ?? []) ?? []),
  ], 40);
  const rawSemanticPlan = mode === "style" && referenceAnalysis
    ? buildSemanticTransferPlan({ referenceAnalysis, screenName, screenDescription, screenType })
    : emptySemanticPlan({ screenName, screenDescription, screenType });
  const semanticPlan = mode === "style"
    ? {
        ...rawSemanticPlan,
        semanticDecisions: enforceRegionCompatibility(rawSemanticPlan.semanticDecisions, screenLayoutRegions, referenceAnalysis),
      }
    : rawSemanticPlan;

  if (mode === "recreate") {
    return {
      version: 2,
      layoutSource: "reference",
      preserve: unique([
        referenceAnalysis?.overallVisualStyle,
        signals?.surfaces,
        signals?.typography,
        signals?.spacingLogic ?? signals?.density,
      ], 5),
      adapt: [
        `Adapt copy and product details to ${screenName} without changing the observed source hierarchy.`,
      ],
      reject: [
        "Do not invent unrelated sections or replace the observed composition with a generic app template.",
      ],
      rationale: "Image-to-UI mode makes the selected reference frame the structural authority.",
      ...semanticPlan,
      visualInvariants: unique([
        referenceAnalysis?.overallVisualStyle,
        signals?.surfaces,
        signals?.typography,
        signals?.spacingLogic ?? signals?.density,
      ], 8),
      compositionAdaptations: [],
      localMotifs: [],
      forbiddenLiteralTransfers: ["Unseen source content and unrelated product-domain details."],
      // Recreate mode intentionally treats the selected source frame as
      // structural/content evidence. Literal quarantine is a style-mode wall.
      sourceContentQuarantine: [],
    };
  }

  if (mode === "style") {
    const accepted = semanticPlan.semanticDecisions.filter((decision) => decision.decision !== "reject");
    const rejected = semanticPlan.semanticDecisions.filter((decision) => decision.decision === "reject");
    return {
      version: 2,
      layoutSource: "screen-purpose",
      preserve: unique([
        signals?.palette,
        signals?.typography,
        signals?.surfaces,
        signals?.iconography,
        signals?.density,
      ], 5),
      adapt: unique([
        ...accepted.map((decision) => decision.adaptation),
        `Translate the approved material and emphasis hierarchy into a composition designed specifically for ${screenName}.`,
      ], 8),
      reject: unique([
        ...rejected.map((decision) => `${decision.primitiveId}: ${decision.rationale}`),
        "Do not reuse any reference screen's section order, object positions, or role-specific component arrangement.",
        "Do not repeat a source decorative motif, connector, hero scaffold, or card topology unless a suitability decision explicitly approves its underlying function.",
      ], 10),
      rationale: "Style-reference mode transfers visual craft and suitable composition logic; the target screen's user job owns layout, geometry, and information architecture.",
      ...semanticPlan,
      visualInvariants: unique([
        signals?.palette,
        signals?.typography,
        signals?.surfaces,
        signals?.iconography,
        signals?.density,
        ...(referenceAnalysis?.semanticCompositionPrimitives ?? [])
          .filter((primitive) => (primitive.kind === "editorial-rhythm" || primitive.kind === "layered-depth")
            && !compatibleRegionsForPrimitive(primitive, screenLayoutRegions).length)
          .flatMap((primitive) => primitive.transferableTraits),
      ], 8),
      compositionAdaptations: buildCompositionAdaptations(semanticPlan.semanticDecisions, screenLayoutRegions, referenceAnalysis),
      localMotifs: buildLocalMotifRules(referenceAnalysis, screenLayoutRegions),
      forbiddenLiteralTransfers: [
        "Source text, values, names, branding, and domain-specific content.",
        "Exact coordinates, section order, object positions, and full-screen anatomy.",
        "Any decorative motif outside an explicitly approved target region.",
      ],
      sourceContentQuarantine,
    };
  }

  return {
    version: 2,
    layoutSource: "screen-purpose",
    preserve: [],
    adapt: [
      `Create a composition native to ${screenName} and the product brief.`,
    ],
    reject: [
      "Do not fall back to a generic dashboard, repeated equal-weight card stack, or unrelated app-category template.",
    ],
    rationale: "No structural reference exists; product intent is the only layout authority.",
    ...semanticPlan,
    visualInvariants: [],
    compositionAdaptations: [],
    localMotifs: [],
    forbiddenLiteralTransfers: ["Invented reference evidence or source-specific anatomy."],
    sourceContentQuarantine: [],
  };
}

const mergePlannerSemanticDecisions = (
  canonical: SemanticTransferDecision[],
  value: unknown,
) => {
  const raw = Array.isArray(value) ? value.map(asRecord).filter(Boolean) as Record<string, unknown>[] : [];
  return canonical.map((decision) => {
    const planner = raw.find((item) => (item.primitive_id ?? item.primitiveId) === decision.primitiveId);
    if (!planner || decision.decision === "reject") return decision;
    const plannerDecision = planner.decision;
    if (plannerDecision === "reject") {
      return {
        ...decision,
        decision: "reject" as const,
        adaptation: null,
        qualityTargets: [],
        rationale: compact(typeof planner.rationale === "string" ? planner.rationale : null, 500) ?? decision.rationale,
      };
    }
    const plannerAdaptation = decision.adaptation
      ? compact(typeof planner.adaptation === "string" ? planner.adaptation : null, 600)
      : null;
    const safeAdaptation = plannerAdaptation
      && !SOURCE_ANATOMY_CUE_PATTERN.test(plannerAdaptation)
      && !STRUCTURAL_COPY_PATTERN.test(plannerAdaptation)
      ? plannerAdaptation
      : decision.adaptation;
    const plannerTargets = stringArray(planner.quality_targets ?? planner.qualityTargets, 5)
      .filter((target) => !SOURCE_ANATOMY_CUE_PATTERN.test(target) && !STRUCTURAL_COPY_PATTERN.test(target));
    return {
      ...decision,
      adaptation: safeAdaptation,
      qualityTargets: unique([...plannerTargets, ...decision.qualityTargets], 5),
    };
  });
};

export function normalizeReferenceTransferContract({
  value,
  mode,
  screenName,
  screenDescription = "",
  screenType,
  referenceAnalysis,
  screenLayoutRegions = [],
}: {
  value: unknown;
  mode: ReferenceTransferMode;
  screenName: string;
  screenDescription?: string;
  screenType?: "root" | "detail";
  referenceAnalysis?: ReferenceAnalysis | null;
  screenLayoutRegions?: ScreenLayoutRegion[];
}): ReferenceTransferContract {
  const fallback = createReferenceTransferContract({
    mode,
    screenName,
    screenDescription,
    screenType,
    referenceAnalysis,
    screenLayoutRegions,
  });
  const record = asRecord(value);
  if (!record) return fallback;

  const expectedLayoutSource = mode === "recreate" ? "reference" : "screen-purpose";
  const preserve = stringArray(record.preserve, 8);
  const adapt = stringArray(record.adapt, 8);
  const reject = stringArray(record.reject, 10);
  const approvedAdapt = mode === "style"
    ? adapt.filter((item) => !SOURCE_ANATOMY_CUE_PATTERN.test(item) && !STRUCTURAL_COPY_PATTERN.test(item))
    : adapt;
  const rationale = compact(
    typeof record.rationale === "string" ? record.rationale : null,
    600,
  );
  const approvedPreserve = mode === "style"
    ? preserve.filter((item) => !SOURCE_ANATOMY_CUE_PATTERN.test(item))
    : preserve;
  const semanticDecisions = mode === "style"
    ? mergePlannerSemanticDecisions(
        fallback.semanticDecisions,
        record.semantic_decisions ?? record.semanticDecisions,
      )
    : fallback.semanticDecisions;
  const premiumQualityTargets = mode === "style"
    ? unique([
        ...stringArray(record.premium_quality_targets ?? record.premiumQualityTargets, 8)
          .filter((target) => !SOURCE_ANATOMY_CUE_PATTERN.test(target) && !STRUCTURAL_COPY_PATTERN.test(target)),
        ...semanticDecisions.flatMap((decision) => decision.qualityTargets),
        ...fallback.premiumQualityTargets,
      ], 10)
    : fallback.premiumQualityTargets;
  const compositionAdaptations = mode === "style"
    ? buildCompositionAdaptations(semanticDecisions, screenLayoutRegions, referenceAnalysis)
    : fallback.compositionAdaptations ?? [];
  const plannerMotifs = Array.isArray(record.local_motifs ?? record.localMotifs)
    ? (record.local_motifs ?? record.localMotifs as unknown[])
    : [];
  const plannerMotifDecisions = new Map((plannerMotifs as unknown[]).flatMap((item) => {
    const entry = asRecord(item);
    const id = entry && typeof (entry.motif_id ?? entry.motifId) === "string" ? String(entry.motif_id ?? entry.motifId) : null;
    const decision = entry?.decision === "reject" ? "reject" as const : entry?.decision === "allow-local" ? "allow-local" as const : null;
    return id && decision ? [[id, decision] as const] : [];
  }));
  const localMotifs = (fallback.localMotifs ?? []).map((motif) => plannerMotifDecisions.get(motif.motifId) === "reject"
    ? { ...motif, decision: "reject" as const, targetRegionIds: [], rationale: "Planner rejected this motif for the target screen; rejection overrides source evidence." }
    : motif);

  return {
    version: 2,
    layoutSource: expectedLayoutSource,
    preserve: approvedPreserve.length ? approvedPreserve : fallback.preserve,
    adapt: unique([
      ...semanticDecisions.filter((decision) => decision.decision !== "reject").map((decision) => decision.adaptation),
      ...approvedAdapt,
      ...fallback.adapt,
    ], 10),
    reject: unique([
      ...semanticDecisions.filter((decision) => decision.decision === "reject").map((decision) => `${decision.primitiveId}: ${decision.rationale}`),
      ...reject,
      ...fallback.reject,
    ], 12),
    rationale: mode === "style" && rationale && (SOURCE_ANATOMY_CUE_PATTERN.test(rationale) || STRUCTURAL_COPY_PATTERN.test(rationale))
      ? fallback.rationale
      : rationale ?? fallback.rationale,
    targetCapabilities: fallback.targetCapabilities,
    semanticDecisions,
    premiumQualityTargets,
    visualInvariants: unique([
      ...stringArray(record.visual_invariants ?? record.visualInvariants, 10).filter((item) => !SOURCE_ANATOMY_CUE_PATTERN.test(item)),
      ...(fallback.visualInvariants ?? []),
    ], 10),
    compositionAdaptations,
    localMotifs,
    forbiddenLiteralTransfers: unique([
      ...stringArray(record.forbidden_literal_transfers ?? record.forbiddenLiteralTransfers, 12),
      ...(fallback.forbiddenLiteralTransfers ?? []),
    ], 12),
    // Literal source content is analyzer-owned evidence. The visual planner may
    // neither delete it nor add target-product terms to the deny-list.
    sourceContentQuarantine: fallback.sourceContentQuarantine ?? [],
  };
}

export function formatReferenceTransferContract(contract?: ReferenceTransferContract | null) {
  if (!contract) return "";

  return [
    `- Contract version: ${contract.version ?? 1}`,
    `- Layout authority: ${contract.layoutSource}`,
    contract.targetCapabilities.length ? `- Target capabilities: ${contract.targetCapabilities.join(", ")}` : null,
    contract.preserve.length ? `- Preserve visual invariants: ${contract.preserve.join(" | ")}` : "- Preserve: product-approved tokens and explicit user constraints.",
    contract.semanticDecisions.length ? [
      "- Semantic composition decisions:",
      ...contract.semanticDecisions.map((decision) =>
        `  - ${decision.primitiveId}: ${decision.decision.toUpperCase()} (${decision.suitabilityScore}/100 for ${decision.targetCapability}). ${decision.rationale}${decision.adaptation ? ` Adaptation: ${decision.adaptation}` : ""}`,
      ),
    ].join("\n") : null,
    contract.adapt.length ? `- Approved adaptations: ${contract.adapt.join(" | ")}` : null,
    contract.reject.length ? `- Rejected transfer: ${contract.reject.join(" | ")}` : null,
    contract.premiumQualityTargets.length ? `- Premium quality targets: ${contract.premiumQualityTargets.join(" | ")}` : null,
    contract.visualInvariants?.length ? `- Exact visual invariants: ${contract.visualInvariants.join(" | ")}` : null,
    contract.compositionAdaptations?.length ? `- Region-scoped composition: ${contract.compositionAdaptations.map((item) => `${item.targetRegionIds.join(",") || "no approved region"}: ${item.principle}`).join(" | ")}` : null,
    contract.localMotifs?.length ? `- Local motif policy: ${contract.localMotifs.map((item) => `${item.motifId}=${item.decision}${item.targetRegionIds.length ? ` only in ${item.targetRegionIds.join(",")}` : ""}`).join(" | ")}` : null,
    contract.forbiddenLiteralTransfers?.length ? `- Forbidden literal transfer: ${contract.forbiddenLiteralTransfers.join(" | ")}` : null,
    contract.sourceContentQuarantine?.length ? `- SOURCE CONTENT QUARANTINE (must not appear in target copy/content): ${contract.sourceContentQuarantine.join(" | ")}` : null,
    `- Rationale: ${contract.rationale}`,
  ].filter(Boolean).join("\n");
}
