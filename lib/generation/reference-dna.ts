import type {
  ProjectCharter,
  ProjectReferenceDna,
  ReferenceAnalysis,
  ReferenceDesignSystemSignals,
  ReferenceMode,
  ScreenFamilyContract,
} from "@/lib/types";

export const PROJECT_REFERENCE_DNA_SCHEMA_VERSION = 1 as const;

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const nonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const stringArray = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => nonEmptyString(item)).map((item) => item.trim())
    : [];

const isReferenceMode = (value: unknown): value is ReferenceMode =>
  value === "user_recreate"
  || value === "user_style"
  || value === "curated_style"
  || value === "internal_style";

const isReferenceAnalysis = (value: unknown): value is ReferenceAnalysis => {
  const record = asRecord(value);
  const signals = asRecord(record?.designSystemSignals);
  return Boolean(
    record
    && nonEmptyString(record.overallVisualStyle)
    && typeof record.screenCountEstimate === "number"
    && Array.isArray(record.screenReferences)
    && signals
    && nonEmptyString(signals.palette)
    && nonEmptyString(signals.typography)
    && nonEmptyString(signals.surfaces)
    && nonEmptyString(signals.iconography)
    && nonEmptyString(signals.density)
    && nonEmptyString(signals.motionTone),
  );
};

const isScreenFamilyContract = (value: unknown): value is ScreenFamilyContract => {
  const record = asRecord(value);
  return Boolean(
    record
    && nonEmptyString(record.summary)
    && nonEmptyString(record.surfaces)
    && nonEmptyString(record.typography)
    && nonEmptyString(record.spacing)
    && nonEmptyString(record.navigation)
    && nonEmptyString(record.imagery)
    && Array.isArray(record.consistencyRules),
  );
};

export const isProjectReferenceDna = (value: unknown): value is ProjectReferenceDna => {
  const record = asRecord(value);
  return Boolean(
    record
    && record.schemaVersion === PROJECT_REFERENCE_DNA_SCHEMA_VERSION
    && (record.source === "image_analysis" || record.source === "legacy_reconstruction")
    && isReferenceMode(record.referenceMode)
    && (record.sourceReferenceId === undefined || record.sourceReferenceId === null || nonEmptyString(record.sourceReferenceId))
    && (
      record.sourceReferenceCatalogHash === undefined
      || record.sourceReferenceCatalogHash === null
      || nonEmptyString(record.sourceReferenceCatalogHash)
    )
    && nonEmptyString(record.createdAt)
    && isReferenceAnalysis(record.analysis)
    && isScreenFamilyContract(record.screenFamilyContract),
  );
};

const signal = (
  signals: ProjectCharter["designSystemSignals"],
  key: keyof ReferenceDesignSystemSignals,
  fallback: string,
) => {
  const value = signals?.[key];
  return nonEmptyString(value) ? value.trim() : fallback;
};

export function reconstructReferenceAnalysisFromCharter(
  charter?: ProjectCharter | null,
): ReferenceAnalysis | null {
  if (!charter?.designSystemSignals) return null;

  const creative = charter.creativeDirection;
  const signals = charter.designSystemSignals;
  const overallVisualStyle = charter.imageReferenceSummary?.trim()
    || creative?.styleEssence.trim()
    || charter.designRationale.trim();
  if (!overallVisualStyle) return null;

  const referenceScreens = (charter.referenceScreens ?? []).map((screen) => ({
    index: screen.index,
    suggestedRole: screen.suggestedRole,
    layoutSummary: screen.layoutSummary,
    visualHierarchy: screen.visualHierarchy,
    components: screen.components,
    stylingCues: screen.stylingCues,
    interactionCues: screen.interactionCues ?? [],
    copyPatterns: screen.copyPatterns ?? [],
    implementationNotes: screen.implementationNotes ?? [],
    compositionRules: [] as string[],
    spacingRules: [] as string[],
    componentRules: [] as string[],
    antiPatterns: [] as string[],
  }));

  return {
    overallVisualStyle,
    screenCountEstimate: Math.max(referenceScreens.length, 1),
    screenReferences: referenceScreens,
    designSystemSignals: {
      palette: signal(signals, "palette", creative?.colorStory ?? "Preserve the approved project color tokens."),
      typography: signal(signals, "typography", creative?.typographyMood ?? "Preserve the approved project type hierarchy."),
      surfaces: signal(signals, "surfaces", creative?.surfaceLanguage ?? "Preserve the approved project surface language."),
      iconography: signal(signals, "iconography", creative?.iconographyStyle ?? "Preserve the approved project iconography."),
      density: signal(signals, "density", "Preserve the established project density and information rhythm."),
      motionTone: signal(signals, "motionTone", creative?.motionTone ?? "Preserve the established interaction tone."),
      layoutGrammar: signal(signals, "layoutGrammar", creative?.compositionPrinciples.join(" ") ?? "Preserve the established layout grammar."),
      componentGrammar: signal(signals, "componentGrammar", "Preserve the established component grammar."),
      spacingLogic: signal(signals, "spacingLogic", "Preserve the established spacing rhythm."),
      antiPatterns: signal(signals, "antiPatterns", creative?.avoid.join(" ") ?? "Avoid visual patterns that conflict with the project."),
    },
    primaryNavigation: null,
  };
}

export function reconstructScreenFamilyContractFromCharter(
  charter?: ProjectCharter | null,
): ScreenFamilyContract | null {
  const storedContract = asRecord(charter?.planningDiagnostics)?.screenFamilyContract;
  if (isScreenFamilyContract(storedContract)) {
    return storedContract;
  }

  const analysis = reconstructReferenceAnalysisFromCharter(charter);
  if (!analysis) return null;

  const creative = charter?.creativeDirection;
  const signals = analysis.designSystemSignals;
  return {
    summary: creative?.styleEssence ?? analysis.overallVisualStyle,
    surfaces: signals.surfaces,
    typography: signals.typography,
    spacing: signals.spacingLogic ?? signals.density,
    navigation: charter?.navigationModel ?? "Preserve the approved project navigation architecture.",
    imagery: "Use imagery consistently with the established project and its original reference.",
    consistencyRules: [
      ...(creative?.compositionPrinciples ?? []).slice(0, 4),
      ...(signals.layoutGrammar ? [signals.layoutGrammar] : []),
      ...(signals.componentGrammar ? [signals.componentGrammar] : []),
      ...(signals.antiPatterns ? [`Avoid: ${signals.antiPatterns}`] : []),
    ].slice(0, 8),
  };
}

export function createProjectReferenceDna({
  analysis,
  screenFamilyContract,
  referenceMode,
  source = "image_analysis",
  sourceImagePath = null,
  sourceReferenceId = null,
  sourceReferenceCatalogHash = null,
  createdAt = new Date().toISOString(),
}: {
  analysis: ReferenceAnalysis;
  screenFamilyContract: ScreenFamilyContract;
  referenceMode: ReferenceMode;
  source?: ProjectReferenceDna["source"];
  sourceImagePath?: string | null;
  sourceReferenceId?: string | null;
  sourceReferenceCatalogHash?: string | null;
  createdAt?: string;
}): ProjectReferenceDna {
  return {
    schemaVersion: PROJECT_REFERENCE_DNA_SCHEMA_VERSION,
    source,
    referenceMode,
    sourceImagePath,
    sourceReferenceId,
    sourceReferenceCatalogHash,
    createdAt,
    analysis,
    screenFamilyContract,
  };
}

export function resolveProjectReferenceDna(
  charter?: ProjectCharter | null,
): { dna: ProjectReferenceDna; cacheSource: "persisted" | "legacy_reconstruction" } | null {
  if (isProjectReferenceDna(charter?.referenceDna)) {
    return { dna: charter.referenceDna, cacheSource: "persisted" };
  }

  const analysis = reconstructReferenceAnalysisFromCharter(charter);
  const screenFamilyContract = reconstructScreenFamilyContractFromCharter(charter);
  if (!analysis || !screenFamilyContract) return null;

  return {
    dna: createProjectReferenceDna({
      analysis,
      screenFamilyContract,
      referenceMode: "user_style",
      source: "legacy_reconstruction",
    }),
    cacheSource: "legacy_reconstruction",
  };
}

export function selectProjectReferenceImagePath({
  dna,
  latestImagePath,
}: {
  dna?: ProjectReferenceDna | null;
  latestImagePath?: string | null;
}) {
  return dna?.sourceImagePath?.trim() || latestImagePath?.trim() || null;
}

export function formatProjectReferenceDnaForPrompt(dna: ProjectReferenceDna) {
  const referenceScreens = dna.analysis.screenReferences.slice(0, 3).map((screen) =>
    `${screen.index}. ${screen.suggestedRole}: ${screen.layoutSummary} Components: ${screen.components.slice(0, 8).join(", ")}.`,
  );

  return [
    `Visual style: ${dna.analysis.overallVisualStyle}`,
    `Palette: ${dna.analysis.designSystemSignals.palette}`,
    `Typography: ${dna.analysis.designSystemSignals.typography}`,
    `Surfaces: ${dna.analysis.designSystemSignals.surfaces}`,
    `Layout grammar: ${dna.analysis.designSystemSignals.layoutGrammar ?? dna.screenFamilyContract.summary}`,
    `Component grammar: ${dna.analysis.designSystemSignals.componentGrammar ?? dna.screenFamilyContract.consistencyRules.join(" ")}`,
    `Spacing: ${dna.analysis.designSystemSignals.spacingLogic ?? dna.screenFamilyContract.spacing}`,
    `Avoid: ${dna.analysis.designSystemSignals.antiPatterns ?? "Conflicting visual patterns."}`,
    ...referenceScreens,
  ].join("\n");
}
