import type {
  CreativeDirection,
  ReferenceAnalysis,
  ReferenceTransferContract,
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
const SOURCE_ANATOMY_CUE_PATTERN = /\b(layout|section order|object position|connector|spine|hero scaffold|card (?:stack|arrangement|topology)|component topology|grid placement|panel placement)\b/i;
const STRUCTURAL_COPY_PATTERN = /\b(copy|clone|same|exact|point[\s-]to[\s-]point)\b.*\b(layout|composition|anatomy|screen|reference)\b/i;


export function buildPortableReferenceContext(referenceAnalysis: ReferenceAnalysis) {
  const signals = referenceAnalysis.designSystemSignals;
  const craftCues = unique(
    referenceAnalysis.screenReferences.flatMap((screen) => screen.stylingCues)
      .filter((cue) => !SOURCE_ANATOMY_CUE_PATTERN.test(cue)),
    8,
  );

  return [
    "PORTABLE REFERENCE INVARIANTS",
    "The source screenshot's layout, section order, object positions, role-specific components, and decorative composition are intentionally excluded.",
    `Palette: ${signals.palette}`,
    `Typography: ${signals.typography}`,
    `Surfaces/materials: ${signals.surfaces}`,
    `Iconography: ${signals.iconography}`,
    `Density: ${signals.density}`,
    `Motion tone: ${signals.motionTone}`,
    craftCues.length ? `Portable craft cues: ${craftCues.join("; ")}` : null,
    signals.antiPatterns ? `Avoid: ${signals.antiPatterns}` : null,
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
    compositionPrinciples: [
      "Derive each screen's information architecture and dominant composition from that screen's user job.",
      "Keep product-wide spacing, typography, material, color, and icon decisions consistent while varying screen anatomy.",
      "Reuse a compositional motif only when it has a functional role on the target screen.",
    ],
    signatureMoments: [
      "Invent one screen-purpose-specific focal moment instead of repeating a previous screen's hero or decorative scaffold.",
    ],
  };
}
export function createReferenceTransferContract({
  mode,
  screenName,
  referenceAnalysis,
}: {
  mode: ReferenceTransferMode;
  screenName: string;
  referenceAnalysis?: ReferenceAnalysis | null;
}): ReferenceTransferContract {
  const signals = referenceAnalysis?.designSystemSignals;

  if (mode === "recreate") {
    return {
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
    };
  }

  if (mode === "style") {
    return {
      layoutSource: "screen-purpose",
      preserve: unique([
        signals?.palette,
        signals?.typography,
        signals?.surfaces,
        signals?.iconography,
        signals?.density,
      ], 5),
      adapt: [
        `Translate the material and emphasis hierarchy into a composition designed specifically for ${screenName}.`,
        "Create a new focal moment from the target screen's primary user task.",
      ],
      reject: [
        "Do not reuse any reference screen's section order, object positions, or role-specific component arrangement.",
        "Do not repeat a source decorative motif, connector, hero scaffold, or card topology unless the target screen functionally requires it.",
      ],
      rationale: "Style-reference mode inherits visual craft; the target screen's user job owns layout and information architecture.",
    };
  }

  return {
    layoutSource: "screen-purpose",
    preserve: [],
    adapt: [
      `Create a composition native to ${screenName} and the product brief.`,
    ],
    reject: [
      "Do not fall back to a generic dashboard, repeated equal-weight card stack, or unrelated app-category template.",
    ],
    rationale: "No structural reference exists; product intent is the only layout authority.",
  };
}

export function normalizeReferenceTransferContract({
  value,
  mode,
  screenName,
  referenceAnalysis,
}: {
  value: unknown;
  mode: ReferenceTransferMode;
  screenName: string;
  referenceAnalysis?: ReferenceAnalysis | null;
}): ReferenceTransferContract {
  const fallback = createReferenceTransferContract({
    mode,
    screenName,
    referenceAnalysis,
  });
  const record = asRecord(value);
  if (!record) return fallback;

  const expectedLayoutSource = mode === "recreate" ? "reference" : "screen-purpose";
  const preserve = stringArray(record.preserve, 8);
  const adapt = stringArray(record.adapt, 6);
  const reject = stringArray(record.reject, 8);
  const rationale = compact(
    typeof record.rationale === "string" ? record.rationale : null,
    600,
  );
  const approvedPreserve = mode === "style"
    ? preserve.filter((item) => !SOURCE_ANATOMY_CUE_PATTERN.test(item))
    : preserve;

  return {
    layoutSource: expectedLayoutSource,
    preserve: approvedPreserve.length ? approvedPreserve : fallback.preserve,
    adapt: adapt.length ? adapt : fallback.adapt,
    reject: unique([...reject, ...fallback.reject], 8),
    rationale: mode === "style" && rationale && (SOURCE_ANATOMY_CUE_PATTERN.test(rationale) || STRUCTURAL_COPY_PATTERN.test(rationale))
      ? fallback.rationale
      : rationale ?? fallback.rationale,
  };
}

export function formatReferenceTransferContract(contract?: ReferenceTransferContract | null) {
  if (!contract) return "";

  return [
    `- Layout authority: ${contract.layoutSource}`,
    contract.preserve.length ? `- Preserve: ${contract.preserve.join(" | ")}` : "- Preserve: product-approved tokens and explicit user constraints.",
    contract.adapt.length ? `- Adapt: ${contract.adapt.join(" | ")}` : null,
    contract.reject.length ? `- Reject: ${contract.reject.join(" | ")}` : null,
    `- Rationale: ${contract.rationale}`,
  ].filter(Boolean).join("\n");
}
