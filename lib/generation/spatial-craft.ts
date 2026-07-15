import type {
  ProjectCraftBlueprint,
  ScreenPlan,
  SpatialConstructionContract,
  SpatialCraftCategory,
  SpatialCraftSelection,
} from "@/lib/types";

export const SPATIAL_CRAFT_LIBRARY_VERSION = 1;
export const MAX_PROJECT_CRAFT_CANDIDATES = 8;
export const MAX_SCREEN_CRAFT_CANDIDATES = 6;
export const MAX_SELECTED_CRAFT_GRAMMARS = 3;

const OPTIONAL_CRAFT_TOKEN_PREFIXES = [
  "color.surface.inset",
  "color.surface.raised",
  "color.surface.glass",
  "radii.control",
  "radii.card",
  "radii.featured",
  "radii.sheet",
  "border_widths.hairline",
  "border_widths.emphasis",
  "shadows.inset",
  "shadows.raised",
  "shadows.floating",
  "shadows.glow",
  "gradients.atmosphere",
  "gradients.edge_light",
  "gradients.accent_glow",
  "effects.surface_blur",
  "effects.overlay_blur",
  "effects.edge_highlight_opacity",
  "iconography.stroke_width",
  "iconography.well_size",
] as const;

const isOptionalCraftTokenRole = (path: string) => OPTIONAL_CRAFT_TOKEN_PREFIXES.includes(
  path as (typeof OPTIONAL_CRAFT_TOKEN_PREFIXES)[number],
);

export interface SpatialCraftGrammar {
  id: string;
  label: string;
  version: number;
  category: SpatialCraftCategory;
  summary: string;
  compatibleRoles: string[];
  contentTags: string[];
  craftTags: string[];
  avoidTags?: string[];
  requiredTokenRoles: string[];
  viewportZones: string[];
  layerPlan: string[];
  geometryRules: string[];
  positioningRules: string[];
  tokenBindings: Record<string, string>;
  dataVisualization?: string | null;
  signatureDetail?: string | null;
  antiPatterns: string[];
}

const grammar = (value: SpatialCraftGrammar) => value;

export const SPATIAL_CRAFT_GRAMMARS: SpatialCraftGrammar[] = [
  grammar({
    id: "hero-connected-sheet",
    label: "Hero Connected Sheet",
    version: 1,
    category: "macro",
    summary: "A dominant upper hero flows into an edge-to-edge foreground sheet instead of becoming another card.",
    compatibleRoles: ["home", "dashboard", "overview", "detail", "wallet", "profile"],
    contentTags: ["metric", "balance", "media", "summary", "hero", "chart"],
    craftTags: ["layered", "immersive", "connected", "focal"],
    requiredTokenRoles: ["radii.sheet", "shadows.overlay", "gradients.atmosphere"],
    viewportZones: ["Reserve roughly the upper 32-42% for the focal hero.", "Let the foreground sheet own the remaining scrollable content."],
    layerPlan: ["Atmospheric background.", "Hero content or data plane.", "Foreground sheet overlapping the hero.", "Only intentional floating controls sit above both."],
    geometryRules: ["The sheet is edge-to-edge with only its upper corners using radii.sheet.", "The hero is not wrapped in another generic card."],
    positioningRules: ["Overlap the sheet into the hero by one large spacing unit.", "Keep the focal value and its immediate action clear of the overlap."],
    tokenBindings: { sheetRadius: "radii.sheet", sheetShadow: "shadows.overlay", atmosphere: "gradients.atmosphere" },
    signatureDetail: "Use the hero-to-sheet boundary as the memorable silhouette.",
    antiPatterns: ["Do not stack a second full-width card immediately inside the sheet.", "Do not turn the hero into a centered card on a blank background."],
  }),
  grammar({
    id: "edge-to-edge-data-plane",
    label: "Edge-to-Edge Data Plane",
    version: 1,
    category: "macro",
    summary: "A chart, map, timeline, or data field breaks the content rail and becomes the spatial backbone.",
    compatibleRoles: ["analytics", "market", "tracking", "detail", "performance", "dashboard"],
    contentTags: ["chart", "map", "timeline", "analytics", "market", "performance", "tracking"],
    craftTags: ["data", "full-bleed", "technical", "spatial"],
    avoidTags: ["settings", "form", "legal"],
    requiredTokenRoles: ["gradients.atmosphere", "border_widths.hairline", "shadows.raised"],
    viewportZones: ["Give the primary data field 28-46% of the initial viewport.", "Return supporting controls to the normal content rail."],
    layerPlan: ["Base canvas.", "Full-width plotted geometry.", "Compact controls and annotations above the plot.", "Supporting rows below."],
    geometryRules: ["The plot may clip at screen edges while labels stay within safe margins.", "Use a definite plot height and visible geometry."],
    positioningRules: ["Align the dominant metric to the plot, not to an unrelated card grid.", "Keep controls anchored to data edges or plot corners."],
    tokenBindings: { plotBorder: "border_widths.hairline", plotElevation: "shadows.raised", atmosphere: "gradients.atmosphere" },
    dataVisualization: "Construct the chart or map as real HTML/SVG geometry with a fixed visual budget and legible annotations.",
    antiPatterns: ["Do not place an empty chart rectangle inside a generic card.", "Do not repeat equal metric cards above the plot."],
  }),
  grammar({
    id: "asymmetric-module-cluster",
    label: "Asymmetric Module Cluster",
    version: 1,
    category: "macro",
    summary: "One dominant module and smaller supporting modules create hierarchy through unequal geometry.",
    compatibleRoles: ["home", "dashboard", "overview", "wellness", "commerce", "productivity"],
    contentTags: ["summary", "metrics", "actions", "recommendations", "status"],
    craftTags: ["asymmetric", "modular", "dynamic", "hierarchy"],
    requiredTokenRoles: ["radii.card", "radii.featured", "shadows.raised"],
    viewportZones: ["Place one dominant module in the first meaningful content zone.", "Use smaller modules to create a staggered second rhythm."],
    layerPlan: ["Base canvas.", "Dominant featured module.", "Supporting modules with lower elevation."],
    geometryRules: ["Use unequal spans or heights; featured and supporting cards cannot share identical geometry.", "Keep alignment rails deliberate even when spans differ."],
    positioningRules: ["The featured module should occupy roughly 55-70% of its row or visual cluster.", "Supporting modules align to one edge or baseline."],
    tokenBindings: { cardRadius: "radii.card", featuredRadius: "radii.featured", elevation: "shadows.raised" },
    signatureDetail: "Let one module visibly break the repeated grid rhythm.",
    antiPatterns: ["Do not use a uniform two-column grid of identical cards.", "Do not make every module equally colorful or elevated."],
  }),
  grammar({
    id: "editorial-content-rail",
    label: "Editorial Content Rail",
    version: 1,
    category: "macro",
    summary: "Typography, whitespace, dividers, and selective media replace card-heavy containment.",
    compatibleRoles: ["content", "article", "travel", "wellness", "profile", "detail", "portfolio"],
    contentTags: ["reading", "content", "story", "media", "recommendation", "editorial"],
    craftTags: ["editorial", "quiet", "typographic", "airy"],
    avoidTags: ["dense analytics", "operations"],
    requiredTokenRoles: ["border_widths.hairline", "radii.featured"],
    viewportZones: ["Use a strong typographic opening and a single calm reading rail.", "Allow one media or featured block to interrupt the rail."],
    layerPlan: ["Quiet canvas.", "Typography-led content rail.", "Selective full-bleed or offset media."],
    geometryRules: ["Prefer whitespace and fine rules over boxed sections.", "Use rounded geometry only for meaningful media or controls."],
    positioningRules: ["Vary text measure and indentation intentionally.", "Keep metadata close to its title while separating major sections generously."],
    tokenBindings: { divider: "border_widths.hairline", mediaRadius: "radii.featured" },
    antiPatterns: ["Do not convert every section into a beige or white card.", "Do not center all text and controls."],
  }),
  grammar({
    id: "immersive-atmospheric-canvas",
    label: "Immersive Atmospheric Canvas",
    version: 1,
    category: "macro",
    summary: "Content sits directly on a controlled atmospheric field with sparse chrome and localized light.",
    compatibleRoles: ["home", "focus", "wellness", "weather", "media", "assistant", "activity"],
    contentTags: ["focus", "daily", "immersive", "weather", "activity", "assistant"],
    craftTags: ["atmospheric", "minimal", "dark", "immersive"],
    requiredTokenRoles: ["gradients.atmosphere", "gradients.accent_glow", "shadows.glow"],
    viewportZones: ["Keep the main message or status in a broad uncluttered focal zone.", "Anchor secondary actions near natural screen edges."],
    layerPlan: ["Full-screen atmospheric field.", "Low-containment content groups.", "One restrained luminous action or status layer."],
    geometryRules: ["Most content should not need cards.", "Use containment only for actionable or stateful groups."],
    positioningRules: ["Preserve intentional negative space around the focal copy.", "Keep atmospheric light behind, never on top of, readable text."],
    tokenBindings: { atmosphere: "gradients.atmosphere", accentGlow: "gradients.accent_glow", glow: "shadows.glow" },
    signatureDetail: "Use one localized light field to establish depth and attention.",
    antiPatterns: ["Do not cover the canvas in translucent cards.", "Do not apply glow to every icon and label."],
  }),
  grammar({
    id: "split-focus-workspace",
    label: "Split Focus Workspace",
    version: 1,
    category: "macro",
    summary: "A strong primary work area is paired with a compact secondary control or context region.",
    compatibleRoles: ["editor", "builder", "compose", "compare", "detail", "workspace"],
    contentTags: ["edit", "compose", "compare", "preview", "workspace", "tools"],
    craftTags: ["split", "productive", "focused", "tool"],
    requiredTokenRoles: ["border_widths.hairline", "shadows.floating", "radii.control"],
    viewportZones: ["Allocate most space to the primary work surface.", "Keep secondary tools in a compact rail, panel, or anchored tray."],
    layerPlan: ["Primary work surface.", "Secondary context plane.", "Floating high-frequency controls."],
    geometryRules: ["The two regions must have visibly unequal importance.", "Use borders or tonal shifts before adding separate cards."],
    positioningRules: ["Anchor tools close to what they affect.", "Preserve a clear uninterrupted manipulation area."],
    tokenBindings: { divider: "border_widths.hairline", controls: "radii.control", floating: "shadows.floating" },
    antiPatterns: ["Do not split the viewport into equal generic panels.", "Do not scatter tool buttons across unrelated corners."],
  }),
  grammar({
    id: "inset-control-well",
    label: "Inset Control Well",
    version: 1,
    category: "component",
    summary: "Related controls sit in a recessed tonal well inside a larger surface.",
    compatibleRoles: ["form", "filters", "settings", "dashboard", "detail", "editor"],
    contentTags: ["controls", "filters", "segments", "input", "actions"],
    craftTags: ["inset", "contained", "tactile"],
    requiredTokenRoles: ["color.surface.inset", "radii.control", "shadows.inset"],
    viewportZones: ["Use only inside an existing focal or functional region."],
    layerPlan: ["Parent surface.", "Inset control well.", "Active control above the well."],
    geometryRules: ["The well radius is smaller than its parent surface radius.", "Controls share one inset boundary."],
    positioningRules: ["Keep equal internal padding around the control group."],
    tokenBindings: { surface: "color.surface.inset", radius: "radii.control", inset: "shadows.inset" },
    antiPatterns: ["Do not wrap a single ordinary button in an inset well.", "Do not nest more than one recessed layer."],
  }),
  grammar({
    id: "split-metric-card",
    label: "Split Metric Card",
    version: 1,
    category: "component",
    summary: "One card combines a dominant metric and a differently sized supporting visualization or action region.",
    compatibleRoles: ["dashboard", "analytics", "home", "detail", "finance", "health"],
    contentTags: ["metric", "chart", "progress", "balance", "score"],
    craftTags: ["split", "metric", "asymmetric"],
    requiredTokenRoles: ["radii.featured", "shadows.raised", "border_widths.hairline"],
    viewportZones: ["Use as a featured module, not a repeated list item."],
    layerPlan: ["Featured card.", "Primary metric zone.", "Supporting plot or action zone."],
    geometryRules: ["Use an unequal 40/60 or 45/55 split.", "Separate zones with space, tone, or a hairline rather than two nested cards."],
    positioningRules: ["Align the metric baseline with the most important plot or status cue."],
    tokenBindings: { radius: "radii.featured", elevation: "shadows.raised", divider: "border_widths.hairline" },
    dataVisualization: "Supporting geometry must be visible and scaled to its half of the card.",
    antiPatterns: ["Do not create two equal mini-cards inside the parent.", "Do not use this construction repeatedly in one viewport."],
  }),
  grammar({
    id: "layered-feature-card",
    label: "Layered Feature Card",
    version: 1,
    category: "component",
    summary: "A primary surface uses internal planes, edge detail, and controlled overlap to create depth.",
    compatibleRoles: ["home", "detail", "commerce", "finance", "media", "profile"],
    contentTags: ["featured", "primary", "summary", "product", "membership"],
    craftTags: ["layered", "depth", "premium"],
    requiredTokenRoles: ["radii.featured", "shadows.floating", "gradients.surface_highlight", "effects.edge_highlight_opacity"],
    viewportZones: ["Use for the single most important module in the viewport."],
    layerPlan: ["Featured base surface.", "Internal tonal or highlighted plane.", "One overlapping badge, control, or visual."],
    geometryRules: ["Keep internal planes related to the parent silhouette.", "Use one edge highlight and one elevation direction."],
    positioningRules: ["Overlap only one small element across an internal boundary."],
    tokenBindings: { radius: "radii.featured", elevation: "shadows.floating", sheen: "gradients.surface_highlight", edge: "effects.edge_highlight_opacity" },
    signatureDetail: "Use a restrained edge highlight to make the featured surface feel constructed.",
    antiPatterns: ["Do not add decorative layers without functional hierarchy.", "Do not combine glow, glass, bevel, and heavy shadow simultaneously."],
  }),
  grammar({
    id: "sheet-connected-card",
    label: "Sheet Connected Card",
    version: 1,
    category: "component",
    summary: "A card visually connects to a sheet or screen edge instead of floating independently.",
    compatibleRoles: ["detail", "checkout", "booking", "home", "media"],
    contentTags: ["detail", "summary", "checkout", "booking", "media"],
    craftTags: ["connected", "edge", "sheet"],
    requiredTokenRoles: ["radii.card", "radii.sheet", "border_widths.hairline"],
    viewportZones: ["Use near a sheet boundary or screen edge."],
    layerPlan: ["Parent sheet or canvas.", "Connected card sharing one edge relationship."],
    geometryRules: ["Flatten or reduce radii on the connected edge.", "Preserve stronger radii on exposed corners."],
    positioningRules: ["Align the connected card exactly with the parent edge or rail."],
    tokenBindings: { cardRadius: "radii.card", sheetRadius: "radii.sheet", seam: "border_widths.hairline" },
    antiPatterns: ["Do not leave an accidental tiny gap at the connection.", "Do not use the same silhouette for ordinary list cards."],
  }),
  grammar({
    id: "borderless-data-row",
    label: "Borderless Data Row",
    version: 1,
    category: "component",
    summary: "Dense repeated information uses alignment, rhythm, and restrained dividers instead of card containers.",
    compatibleRoles: ["list", "market", "transactions", "analytics", "settings", "operations"],
    contentTags: ["list", "rows", "transactions", "assets", "results", "activity"],
    craftTags: ["dense", "borderless", "data", "quiet"],
    requiredTokenRoles: ["border_widths.hairline", "radii.control"],
    viewportZones: ["Use within a clear list section or data surface."],
    layerPlan: ["Section surface or canvas.", "Aligned row content.", "Optional subtle divider."],
    geometryRules: ["Use consistent columns and text baselines.", "Reserve rounded geometry for badges and interactive wells."],
    positioningRules: ["Right-align comparable values and keep labels on a stable left rail."],
    tokenBindings: { divider: "border_widths.hairline", controlRadius: "radii.control" },
    antiPatterns: ["Do not place every row in its own rounded card.", "Do not vary value alignment between rows."],
  }),
  grammar({
    id: "floating-utility-island",
    label: "Floating Utility Island",
    version: 1,
    category: "component",
    summary: "A compact cluster of high-frequency controls floats near the content it affects.",
    compatibleRoles: ["editor", "map", "media", "dashboard", "detail", "camera"],
    contentTags: ["tools", "actions", "controls", "map", "media", "edit"],
    craftTags: ["floating", "compact", "utility"],
    requiredTokenRoles: ["color.surface.glass", "radii.control", "shadows.floating", "effects.surface_blur"],
    viewportZones: ["Anchor to a relevant content edge, never the center of reading flow."],
    layerPlan: ["Primary content.", "Floating utility surface.", "Active control state."],
    geometryRules: ["Use one compact shared surface instead of separate floating circles.", "Keep touch targets safe within the island."],
    positioningRules: ["Maintain safe-area and content clearance.", "Place the island closest to the manipulated content."],
    tokenBindings: { surface: "color.surface.glass", radius: "radii.control", elevation: "shadows.floating", blur: "effects.surface_blur" },
    antiPatterns: ["Do not scatter unrelated floating buttons.", "Do not compete with primary navigation."],
  }),
  grammar({
    id: "inset-chart-well",
    label: "Inset Chart Well",
    version: 1,
    category: "data",
    summary: "A chart is recessed into a larger metric surface with its own contained plotting plane.",
    compatibleRoles: ["analytics", "dashboard", "detail", "finance", "health"],
    contentTags: ["chart", "trend", "performance", "metric", "score"],
    craftTags: ["inset", "chart", "contained"],
    requiredTokenRoles: ["color.surface.inset", "radii.control", "shadows.inset"],
    viewportZones: ["Allocate enough height for visible plotted geometry and labels."],
    layerPlan: ["Metric surface.", "Inset plotting well.", "Plot and active marker."],
    geometryRules: ["The plotting well is smaller and visually quieter than its parent.", "Clip plot geometry to the well without clipping labels."],
    positioningRules: ["Keep the metric and plot on one visual axis."],
    tokenBindings: { plotSurface: "color.surface.inset", plotRadius: "radii.control", inset: "shadows.inset" },
    dataVisualization: "Use real SVG or HTML geometry with a highlighted current point or interval.",
    antiPatterns: ["Do not leave the plot blank or use decorative squiggles without scale.", "Do not nest the chart inside multiple cards."],
  }),
  grammar({
    id: "full-bleed-chart-field",
    label: "Full-Bleed Chart Field",
    version: 1,
    category: "data",
    summary: "The primary chart becomes a broad field behind or between content zones rather than a contained widget.",
    compatibleRoles: ["performance", "market", "analytics", "tracking", "detail"],
    contentTags: ["chart", "market", "performance", "timeline", "trend"],
    craftTags: ["full-bleed", "chart", "immersive"],
    requiredTokenRoles: ["gradients.atmosphere", "gradients.edge_light"],
    viewportZones: ["Give the plot a broad horizontal field and a definite vertical budget."],
    layerPlan: ["Atmospheric data field.", "Plot geometry.", "Foreground labels and controls."],
    geometryRules: ["Allow the plot fill or glow to reach screen edges while strokes remain legible.", "Use clipping intentionally at the field boundary."],
    positioningRules: ["Float only essential annotations above the field."],
    tokenBindings: { field: "gradients.atmosphere", highlight: "gradients.edge_light" },
    dataVisualization: "Construct a legible plotted series with controlled fill depth and a clear active segment.",
    antiPatterns: ["Do not place an opaque card behind the entire chart.", "Do not obscure plotted geometry with controls."],
  }),
  grammar({
    id: "radial-score-focus",
    label: "Radial Score Focus",
    version: 1,
    category: "data",
    summary: "A single score, progress state, or health signal anchors the hierarchy through radial geometry.",
    compatibleRoles: ["health", "fitness", "security", "progress", "dashboard", "result"],
    contentTags: ["score", "progress", "completion", "health", "security", "rating"],
    craftTags: ["radial", "score", "focal"],
    requiredTokenRoles: ["gradients.accent_glow", "shadows.glow"],
    viewportZones: ["Use the radial score in the first or second focal zone, not as secondary decoration."],
    layerPlan: ["Base surface.", "Radial track.", "Progress arc and central value.", "Supporting status."],
    geometryRules: ["Keep the arc thick enough to read at mobile scale.", "Use one active arc and one quiet track."],
    positioningRules: ["Align the score with its explanatory label and next action."],
    tokenBindings: { active: "gradients.accent_glow", glow: "shadows.glow" },
    dataVisualization: "Build the radial geometry with SVG and a meaningful progress ratio.",
    antiPatterns: ["Do not add several unrelated circular gauges.", "Do not use a radial chart when comparison across many values is required."],
  }),
  grammar({
    id: "localized-atmospheric-glow",
    label: "Localized Atmospheric Glow",
    version: 1,
    category: "lighting",
    summary: "One restrained radial light field establishes focal depth without washing the whole interface.",
    compatibleRoles: ["home", "detail", "media", "finance", "wellness", "assistant"],
    contentTags: ["hero", "focus", "premium", "dark", "atmosphere"],
    craftTags: ["glow", "atmospheric", "focal"],
    requiredTokenRoles: ["gradients.atmosphere", "gradients.accent_glow"],
    viewportZones: ["Place light behind the primary focal zone and fade it before dense content."],
    layerPlan: ["Base canvas.", "Localized light field.", "Readable content above."],
    geometryRules: ["The light field has an asymmetric origin and soft falloff.", "Keep contrast stable at text edges."],
    positioningRules: ["Offset the glow toward the focal object rather than centering it by default."],
    tokenBindings: { atmosphere: "gradients.atmosphere", accent: "gradients.accent_glow" },
    signatureDetail: "Let lighting explain the hierarchy instead of decorating every component.",
    antiPatterns: ["Do not use multiple unrelated neon glows.", "Do not place bright gradients behind body copy."],
  }),
  grammar({
    id: "inner-edge-illumination",
    label: "Inner Edge Illumination",
    version: 1,
    category: "lighting",
    summary: "A fine inner highlight clarifies a raised or glass surface without a heavy outer border.",
    compatibleRoles: ["home", "detail", "dashboard", "media", "commerce", "finance"],
    contentTags: ["card", "surface", "premium", "glass", "dark"],
    craftTags: ["edge", "highlight", "material"],
    requiredTokenRoles: ["gradients.edge_light", "effects.edge_highlight_opacity", "border_widths.hairline"],
    viewportZones: ["Apply only to featured or floating surfaces."],
    layerPlan: ["Surface fill.", "Hairline inner edge highlight.", "Content."],
    geometryRules: ["Follow the exact parent silhouette with a one-pixel or hairline edge.", "Keep illumination stronger on the implied light-facing edge."],
    positioningRules: ["Do not detach the highlight from the surface boundary."],
    tokenBindings: { edgeLight: "gradients.edge_light", opacity: "effects.edge_highlight_opacity", width: "border_widths.hairline" },
    signatureDetail: "Use directional edge light to make one important surface feel precisely built.",
    antiPatterns: ["Do not outline every card.", "Do not combine with a thick contrasting border."],
  }),
  grammar({
    id: "restrained-glass-depth",
    label: "Restrained Glass Depth",
    version: 1,
    category: "lighting",
    summary: "Translucency and blur are reserved for floating context layers over meaningful background depth.",
    compatibleRoles: ["map", "media", "home", "weather", "travel", "navigation"],
    contentTags: ["floating", "overlay", "map", "media", "atmosphere"],
    craftTags: ["glass", "blur", "layered"],
    avoidTags: ["dense list", "plain settings"],
    requiredTokenRoles: ["color.surface.glass", "effects.surface_blur", "border_widths.hairline", "shadows.floating"],
    viewportZones: ["Use glass only where content visibly passes behind a floating layer."],
    layerPlan: ["Meaningful background content.", "Translucent blurred surface.", "High-contrast foreground content."],
    geometryRules: ["Pair blur with a restrained tint and hairline boundary.", "Opaque content surfaces remain opaque."],
    positioningRules: ["Keep glass surfaces floating or overlaying, not filling every section."],
    tokenBindings: { surface: "color.surface.glass", blur: "effects.surface_blur", border: "border_widths.hairline", elevation: "shadows.floating" },
    antiPatterns: ["Do not use glass when no depth exists behind it.", "Do not make every card translucent."],
  }),
  grammar({
    id: "floating-navigation-island",
    label: "Floating Navigation Island",
    version: 1,
    category: "navigation",
    summary: "Shared navigation sits in a compact elevated island separated from the screen edge.",
    compatibleRoles: ["root", "home", "dashboard", "market", "social", "media"],
    contentTags: ["tabs", "navigation", "root", "destinations"],
    craftTags: ["floating", "navigation", "island"],
    requiredTokenRoles: ["navigation.surface", "navigation.shadow", "radii.sheet", "effects.surface_blur"],
    viewportZones: ["Reserve bottom safe-area clearance for the renderer-owned navigation island."],
    layerPlan: ["Screen content.", "Renderer-owned navigation island.", "Active item treatment."],
    geometryRules: ["Use one continuous island with a distinct active state.", "Keep item spacing even and touch targets safe."],
    positioningRules: ["Separate the island from side and bottom edges.", "Screen builders reserve clearance and never recreate it."],
    tokenBindings: { surface: "navigation.surface", elevation: "navigation.shadow", radius: "radii.sheet", blur: "effects.surface_blur" },
    antiPatterns: ["Do not add navigation markup inside screen HTML.", "Do not float each navigation item independently."],
  }),
  grammar({
    id: "quiet-edge-navigation",
    label: "Quiet Edge Navigation",
    version: 1,
    category: "navigation",
    summary: "Shared navigation stays close to the device edge with minimal containment and typographic active emphasis.",
    compatibleRoles: ["root", "content", "commerce", "wellness", "productivity"],
    contentTags: ["tabs", "navigation", "root", "content"],
    craftTags: ["quiet", "navigation", "minimal"],
    requiredTokenRoles: ["navigation.surface", "navigation.border", "border_widths.hairline"],
    viewportZones: ["Reserve normal bottom-navigation clearance without creating a large floating object."],
    layerPlan: ["Screen content.", "Quiet renderer-owned navigation edge.", "Active typographic or icon cue."],
    geometryRules: ["Use minimal surface contrast and a hairline or tonal boundary.", "Active state relies on weight, color, or a restrained marker."],
    positioningRules: ["Align navigation to the safe area and screen rail."],
    tokenBindings: { surface: "navigation.surface", border: "navigation.border", width: "border_widths.hairline" },
    antiPatterns: ["Do not add navigation markup inside screen HTML.", "Do not use a large pill behind every item."],
  }),
];

const normalizedWords = (value: string) => new Set(
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 1),
);

const containsPhrase = (input: string, phrase: string) => {
  const normalizedInput = ` ${input.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim()} `;
  const normalizedPhrase = phrase.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  return normalizedPhrase.length > 0 && normalizedInput.includes(` ${normalizedPhrase} `);
};

const overlapCount = (input: Set<string>, values: string[]) => values.reduce((score, value) => {
  const words = normalizedWords(value);
  return score + Array.from(words).filter((word) => input.has(word)).length;
}, 0);

const blueprintText = (blueprint?: ProjectCraftBlueprint | null) => blueprint
  ? [
      blueprint.compositionIntent,
      blueprint.layerStrategy,
      blueprint.geometryIntent,
      blueprint.lightingIntent,
      blueprint.elevationIntent,
      blueprint.borderIntent,
      blueprint.dataVisualizationIntent,
      blueprint.navigationIntent,
      blueprint.signatureConstructions.join(" "),
      blueprint.layoutPrinciples.join(" "),
      blueprint.preferredCraftTags.join(" "),
    ].join(" ")
  : "";

const scoreGrammar = ({
  grammar: item,
  input,
  preferredTags,
}: {
  grammar: SpatialCraftGrammar;
  input: string;
  preferredTags: Set<string>;
}) => {
  const inputWords = normalizedWords(input);
  const roleScore = overlapCount(inputWords, item.compatibleRoles) * 6;
  const contentScore = overlapCount(inputWords, item.contentTags) * 5;
  const craftScore = overlapCount(inputWords, item.craftTags) * 4;
  const preferredScore = item.craftTags.filter((tag) => preferredTags.has(tag)).length * 8;
  const phraseScore = [...item.compatibleRoles, ...item.contentTags].filter((term) => containsPhrase(input, term)).length * 3;
  const avoidScore = (item.avoidTags ?? []).filter((term) => containsPhrase(input, term)).length * 12;
  return roleScore + contentScore + craftScore + preferredScore + phraseScore - avoidScore;
};

const rankGrammars = ({
  input,
  blueprint,
}: {
  input: string;
  blueprint?: ProjectCraftBlueprint | null;
}) => {
  const combined = `${input} ${blueprintText(blueprint)}`.trim();
  const preferredTags = new Set((blueprint?.preferredCraftTags ?? []).map((tag) => tag.toLowerCase()));
  return SPATIAL_CRAFT_GRAMMARS
    .map((item) => ({ item, score: scoreGrammar({ grammar: item, input: combined, preferredTags }) }))
    .sort((first, second) => second.score - first.score || first.item.id.localeCompare(second.item.id));
};

const boundedByCategory = (ranked: Array<{ item: SpatialCraftGrammar; score: number }>, limit: number) => {
  const result: SpatialCraftGrammar[] = [];
  const categoryCounts = new Map<SpatialCraftCategory, number>();
  for (const candidate of ranked) {
    if (result.length >= limit) break;
    const categoryCount = categoryCounts.get(candidate.item.category) ?? 0;
    if (categoryCount >= 2) continue;
    if (candidate.score <= 0 && result.length >= Math.min(4, limit)) continue;
    result.push(candidate.item);
    categoryCounts.set(candidate.item.category, categoryCount + 1);
  }
  return result;
};

export const shortlistProjectCraftGrammars = (prompt: string) => boundedByCategory(
  rankGrammars({ input: prompt }),
  MAX_PROJECT_CRAFT_CANDIDATES,
);

export const shortlistScreenCraftGrammars = ({
  prompt,
  screen,
  blueprint,
  availableTokenPaths,
}: {
  prompt: string;
  screen: Pick<ScreenPlan, "name" | "type" | "description">;
  blueprint?: ProjectCraftBlueprint | null;
  availableTokenPaths?: ReadonlySet<string> | null;
}) => {
  const ranked = rankGrammars({
    input: `${prompt} ${screen.name} ${screen.type} ${screen.description}`,
    blueprint,
  }).filter(({ item }) => !availableTokenPaths || item.requiredTokenRoles.every((path) => (
    !isOptionalCraftTokenRole(path) || availableTokenPaths.has(path)
  )));
  const shortlist = boundedByCategory(ranked, MAX_SCREEN_CRAFT_CANDIDATES);
  if (!shortlist.some((item) => item.category === "macro")) {
    const macro = ranked.find((candidate) => candidate.item.category === "macro")?.item;
    if (macro) shortlist.unshift(macro);
  }
  return shortlist.slice(0, MAX_SCREEN_CRAFT_CANDIDATES);
};

export const formatCompactCraftCatalog = (items: SpatialCraftGrammar[]) => items
  .map((item) => `- ${item.id} [${item.category}]: ${item.summary} Best for ${item.compatibleRoles.join(", ")}.`)
  .join("\n");

export const findSpatialCraftGrammar = (id: string) => SPATIAL_CRAFT_GRAMMARS.find((item) => item.id === id) ?? null;

export const normalizeCraftSelection = (value: unknown): SpatialCraftSelection | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const rawMacro = typeof record.macro_id === "string"
    ? record.macro_id
    : typeof record.macroId === "string" ? record.macroId : null;
  const macroId = rawMacro && findSpatialCraftGrammar(rawMacro)?.category === "macro" ? rawMacro : null;
  const rawSupporting = Array.isArray(record.supporting_ids)
    ? record.supporting_ids
    : Array.isArray(record.supportingIds) ? record.supportingIds : [];
  const supportingIds = rawSupporting
    .filter((id): id is string => typeof id === "string")
    .filter((id) => {
      const found = findSpatialCraftGrammar(id);
      return Boolean(found && found.category !== "macro");
    })
    .filter((id, index, values) => values.indexOf(id) === index)
    .slice(0, MAX_SELECTED_CRAFT_GRAMMARS - (macroId ? 1 : 0));
  if (!macroId && supportingIds.length === 0) return null;
  return {
    macroId,
    supportingIds,
    rationale: typeof record.rationale === "string" ? record.rationale.trim().slice(0, 600) : "Selected for this screen's content and spatial role.",
  };
};

export const resolveSpatialConstructionContract = (
  selection?: SpatialCraftSelection | null,
): SpatialConstructionContract | null => {
  if (!selection) return null;
  const ids = [selection.macroId, ...selection.supportingIds]
    .filter((id): id is string => Boolean(id))
    .filter((id, index, values) => values.indexOf(id) === index)
    .slice(0, MAX_SELECTED_CRAFT_GRAMMARS);
  const selected = ids.map(findSpatialCraftGrammar).filter((item): item is SpatialCraftGrammar => Boolean(item));
  if (selected.length === 0) return null;
  return {
    version: 1,
    grammarIds: selected.map((item) => item.id),
    viewportZones: selected.flatMap((item) => item.viewportZones),
    layerPlan: selected.flatMap((item) => item.layerPlan),
    geometryRules: selected.flatMap((item) => item.geometryRules),
    positioningRules: selected.flatMap((item) => item.positioningRules),
    tokenBindings: Object.assign({}, ...selected.map((item) => item.tokenBindings)),
    dataVisualization: selected.find((item) => item.dataVisualization)?.dataVisualization ?? null,
    signatureDetail: selected.find((item) => item.signatureDetail)?.signatureDetail ?? null,
    antiPatterns: Array.from(new Set(selected.flatMap((item) => item.antiPatterns))),
  };
};

export const validateSpatialCraftLibrary = () => {
  const ids = new Set<string>();
  const issues: string[] = [];
  for (const item of SPATIAL_CRAFT_GRAMMARS) {
    if (ids.has(item.id)) issues.push(`Duplicate grammar id: ${item.id}`);
    ids.add(item.id);
    if (!item.summary.trim()) issues.push(`Missing summary: ${item.id}`);
    if (item.requiredTokenRoles.length === 0) issues.push(`Missing token roles: ${item.id}`);
    if (item.antiPatterns.length === 0) issues.push(`Missing anti-patterns: ${item.id}`);
  }
  return issues;
};
