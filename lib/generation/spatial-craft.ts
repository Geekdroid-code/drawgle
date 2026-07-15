import type {
  ProjectCraftBlueprint,
  ScreenPlan,
  SpatialConstructionContract,
  SpatialCraftCategory,
  SpatialCraftSelection,
} from "@/lib/types";

export const SPATIAL_CRAFT_LIBRARY_VERSION = 2;
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

const UNIQUE_CRAFT_ID_LIMIT = MAX_SELECTED_CRAFT_GRAMMARS;

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
  grammar({
    id: "showcase-command-stage",
    label: "Showcase Command Stage",
    version: 1,
    category: "macro",
    summary: "A single oversized task or status stage carries the first viewport while secondary information stays structurally quieter.",
    compatibleRoles: ["home", "dashboard", "care", "health", "reminder", "finance", "commerce"],
    contentTags: ["next", "dose", "reminder", "primary action", "status", "balance", "summary", "order"],
    craftTags: ["showcase-derived", "command", "focal", "stage", "accessible"],
    requiredTokenRoles: ["radii.featured", "color.action.primary", "spacing.lg"],
    viewportZones: ["Reserve 42-58% of the first viewport for one unmistakable command stage.", "Let the next section begin visibly below it without competing for equal weight."],
    layerPlan: ["Quiet app canvas and compact identity header.", "One oversized command stage.", "Custom focal visualization or primary value inside the stage.", "Action integrated into the stage boundary.", "Secondary content rail below."],
    geometryRules: ["The stage is one composed silhouette, not a heading plus several nested cards.", "Use a large uninterrupted interior and one custom geometric visual, then anchor the action to its lower edge."],
    positioningRules: ["Keep stage content on an intentional top/middle/bottom axis.", "Allow a following rail or section edge to peek into the viewport to signal continuation."],
    tokenBindings: { stageRadius: "radii.featured", accent: "color.action.primary", internalSpace: "spacing.lg" },
    signatureDetail: "Derived from the showcase command surfaces: one memorable stage with an embedded action, not a dashboard grid.",
    antiPatterns: ["Do not surround every datum inside the stage with another card.", "Do not repeat the same stage silhouette for secondary rows."],
  }),
  grammar({
    id: "showcase-unboxed-metric-flow",
    label: "Showcase Unboxed Metric Flow",
    version: 1,
    category: "macro",
    summary: "Metrics, actions, and progress rows sit directly on the canvas; alignment and plotted geometry replace card containment.",
    compatibleRoles: ["analytics", "dashboard", "health", "finance", "tracking", "performance", "status"],
    contentTags: ["metrics", "progress", "budget", "timeline", "activity", "health", "sleep", "performance"],
    craftTags: ["showcase-derived", "unboxed", "data", "continuous", "precise"],
    requiredTokenRoles: ["border_widths.hairline", "color.text.medium_emphasis", "spacing.md"],
    viewportZones: ["Open with one unboxed metric or date anchor.", "Use the center of the viewport for plotted or progressive information.", "Continue into aligned rows without individual card shells."],
    layerPlan: ["Continuous base canvas.", "Free-standing metric and action groups.", "Progress or chart geometry.", "Aligned data rows separated by space or hairlines."],
    geometryRules: ["Action icons may use wells, but their labels and related values remain unboxed.", "Repeated rows share baselines and plot widths instead of rounded outer containers."],
    positioningRules: ["Use stable left and right rails for comparable labels and values.", "Let progress geometry span most of the content width."],
    tokenBindings: { divider: "border_widths.hairline", secondaryText: "color.text.medium_emphasis", rhythm: "spacing.md" },
    dataVisualization: "Use real bars, arcs, tracks, or SVG paths as first-class layout geometry rather than decorating a card.",
    signatureDetail: "Derived from the Neobank and performance showcase screens where data lives on the canvas instead of inside repeated tiles.",
    antiPatterns: ["Do not wrap every budget, activity, or metric row in a rounded white card.", "Do not use identical icon-left/text-middle/value-right cards for the whole screen."],
  }),
  grammar({
    id: "showcase-editorial-product-stage",
    label: "Showcase Editorial Product Stage",
    version: 1,
    category: "macro",
    summary: "Copy and a dominant image, illustration, or object share an asymmetric stage with deliberate cropping and an anchored conversion action.",
    compatibleRoles: ["commerce", "product", "food", "travel", "media", "discovery", "detail"],
    contentTags: ["product", "food", "shop", "order", "discover", "collection", "media", "image"],
    craftTags: ["showcase-derived", "editorial", "asymmetric", "media", "conversion"],
    requiredTokenRoles: ["radii.featured", "color.action.primary", "spacing.lg"],
    viewportZones: ["Use a broad editorial opening with copy on one side and a dominant visual crossing the opposite edge.", "Keep discovery rails or product grids below the stage."],
    layerPlan: ["Quiet background.", "Asymmetric feature stage.", "Text and CTA plane.", "Cropped or transparent visual plane.", "Discovery content below."],
    geometryRules: ["The visual occupies roughly 42-58% of the stage and may crop against one edge.", "The CTA is part of the composition, not a generic full-width button below it."],
    positioningRules: ["Maintain separation between the text measure and visual focal mass.", "Use controlled edge cropping to create depth without overlap on copy."],
    tokenBindings: { stageRadius: "radii.featured", action: "color.action.primary", gap: "spacing.lg" },
    signatureDetail: "Derived from showcase commerce screens with a designed product stage rather than a generic promotional card.",
    antiPatterns: ["Do not center a small placeholder image above centered copy.", "Do not turn the stage into a conventional banner with equal padding on every side."],
  }),
  grammar({
    id: "showcase-partial-peek-rail",
    label: "Showcase Partial-Peek Rail",
    version: 1,
    category: "component",
    summary: "A horizontal rail intentionally reveals part of the next unequal item to communicate continuation and create visual tension.",
    compatibleRoles: ["home", "discovery", "commerce", "analytics", "finance", "media"],
    contentTags: ["carousel", "categories", "statistics", "products", "cards", "recommendations", "rail"],
    craftTags: ["showcase-derived", "rail", "peek", "asymmetric", "scroll"],
    requiredTokenRoles: ["radii.card", "spacing.md"],
    viewportZones: ["Use at a section boundary where more content exists horizontally."],
    layerPlan: ["Section heading rail.", "Horizontal overflow track.", "Primary item and partially visible continuation item."],
    geometryRules: ["Items may have unequal widths when their content importance differs.", "Clip the rail at the viewport, never each item independently."],
    positioningRules: ["Start on the main content rail and let the track extend to the viewport edge.", "Expose roughly 12-24% of the next item."],
    tokenBindings: { itemRadius: "radii.card", gap: "spacing.md" },
    antiPatterns: ["Do not squeeze the whole rail into equal columns.", "Do not show a tiny accidental sliver that reads as overflow damage."],
  }),
  grammar({
    id: "showcase-embedded-action-capsule",
    label: "Showcase Embedded Action Capsule",
    version: 1,
    category: "component",
    summary: "A wide action capsule embeds direction, label, and a contrasting circular terminal control into one custom silhouette.",
    compatibleRoles: ["home", "detail", "commerce", "care", "finance", "onboarding"],
    contentTags: ["primary action", "next", "continue", "taken", "order", "send", "confirm"],
    craftTags: ["showcase-derived", "action", "capsule", "directional", "custom"],
    requiredTokenRoles: ["radii.pill", "color.action.primary", "sizing.standard_button_height"],
    viewportZones: ["Use once at the terminal edge of a focal surface or workflow section."],
    layerPlan: ["Capsule base.", "Leading direction or context cue.", "Centered action label.", "Contrasting terminal circular control."],
    geometryRules: ["The terminal control is inset inside the capsule and nearly matches its height.", "Use asymmetric internal spacing so the label remains optically centered."],
    positioningRules: ["Anchor the capsule to the lower boundary of the focal construction."],
    tokenBindings: { radius: "radii.pill", action: "color.action.primary", height: "sizing.standard_button_height" },
    signatureDetail: "Derived from the Neo Mint showcase action capsule with an embedded directional endpoint.",
    antiPatterns: ["Do not use the construction for every button.", "Do not place a detached floating arrow beside a normal button."],
  }),
  grammar({
    id: "showcase-custom-gauge-stage",
    label: "Showcase Custom Gauge Stage",
    version: 1,
    category: "data",
    summary: "A gauge or progress visualization is custom-drawn as the main object of a stage and paired with a strong semantic value.",
    compatibleRoles: ["finance", "health", "progress", "care", "performance", "dashboard"],
    contentTags: ["progress", "completion", "score", "expenses", "adherence", "readiness", "status"],
    craftTags: ["showcase-derived", "gauge", "focal", "custom", "data"],
    requiredTokenRoles: ["color.action.primary", "border_widths.hairline", "radii.featured"],
    viewportZones: ["Give the gauge a dedicated focal field with enough height to be immediately legible."],
    layerPlan: ["Focal stage.", "Quiet gauge track.", "Active arc or segmented geometry.", "Central value and semantic label.", "Related action below or embedded."],
    geometryRules: ["Construct the gauge with SVG paths or deliberate HTML arcs, including a meaningful inactive track.", "Use one active progression and no decorative duplicate rings."],
    positioningRules: ["Center the semantic value inside or directly beneath the plotted geometry.", "Keep annotations outside the arc's active stroke."],
    tokenBindings: { active: "color.action.primary", edge: "border_widths.hairline", stageRadius: "radii.featured" },
    dataVisualization: "Build a real SVG arc, segmented semicircle, or ring with an explicit progress ratio and readable track contrast.",
    signatureDetail: "Derived from showcase focal gauges that behave as layout objects, not small dashboard widgets.",
    antiPatterns: ["Do not substitute a generic circular percentage ring when the stage supports a more expressive semicircle or segmented path.", "Do not place several gauges side by side."],
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

const conflictsWithExplicitConstraint = (item: SpatialCraftGrammar, input: string) => {
  const normalized = input.toLowerCase();
  const required = new Set(item.requiredTokenRoles);
  if (/\b(?:no|without|avoid)\s+(?:any\s+)?gradients?\b/.test(normalized)
    && Array.from(required).some((path) => path.startsWith("gradients."))) return true;
  if (/\b(?:no|without|avoid)\s+(?:any\s+)?(?:glass|glassmorphism|blur)\b/.test(normalized)
    && (required.has("color.surface.glass") || Array.from(required).some((path) => path.startsWith("effects.") && path.includes("blur")))) return true;
  if (/\b(?:no|without|avoid)\s+(?:any\s+)?(?:shadows?|elevation)\b/.test(normalized)
    && Array.from(required).some((path) => path.startsWith("shadows."))) return true;
  if (/\b(?:no|without|avoid)\s+(?:any\s+)?glow\b/.test(normalized)
    && (required.has("shadows.glow") || required.has("gradients.accent_glow"))) return true;
  return false;
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
      (blueprint.preferredCraftIds ?? []).join(" "),
      blueprint.preferredCraftTags.join(" "),
    ].join(" ")
  : "";

const scoreGrammar = ({
  grammar: item,
  input,
  preferredTags,
  preferredIds,
}: {
  grammar: SpatialCraftGrammar;
  input: string;
  preferredTags: Set<string>;
  preferredIds: Set<string>;
}) => {
  const inputWords = normalizedWords(input);
  const roleScore = overlapCount(inputWords, item.compatibleRoles) * 6;
  const contentScore = overlapCount(inputWords, item.contentTags) * 5;
  const craftScore = overlapCount(inputWords, item.craftTags) * 4;
  const preferredScore = item.craftTags.filter((tag) => preferredTags.has(tag)).length * 8;
  const preferredIdScore = preferredIds.has(item.id) ? 40 : 0;
  const phraseScore = [...item.compatibleRoles, ...item.contentTags].filter((term) => containsPhrase(input, term)).length * 3;
  const avoidScore = (item.avoidTags ?? []).filter((term) => containsPhrase(input, term)).length * 12;
  return roleScore + contentScore + craftScore + preferredScore + preferredIdScore + phraseScore - avoidScore;
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
  const preferredIds = new Set(blueprint?.preferredCraftIds ?? []);
  return SPATIAL_CRAFT_GRAMMARS
    .filter((item) => !conflictsWithExplicitConstraint(item, input))
    .map((item) => ({ item, score: scoreGrammar({ grammar: item, input: combined, preferredTags, preferredIds }) }))
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

export function findSpatialCraftGrammar(id: string) {
  return SPATIAL_CRAFT_GRAMMARS.find((item) => item.id === id) ?? null;
}

export const normalizeProjectCraftBlueprint = (
  blueprint: ProjectCraftBlueprint,
  fallbackIds: string[] = [],
): ProjectCraftBlueprint => {
  const rawIds = [
    ...(blueprint.preferredCraftIds ?? []),
    ...blueprint.preferredCraftTags,
    ...blueprint.signatureConstructions,
  ];
  const selectedIds = Array.from(new Set(rawIds
    .map((value) => value.trim().toLowerCase())
    .filter((value) => Boolean(findSpatialCraftGrammar(value)))))
    .slice(0, UNIQUE_CRAFT_ID_LIMIT);
  const resolvedIds = (selectedIds.length > 0
    ? selectedIds
    : fallbackIds.filter((id) => Boolean(findSpatialCraftGrammar(id))))
    .slice(0, UNIQUE_CRAFT_ID_LIMIT);
  const selected = resolvedIds
    .map(findSpatialCraftGrammar)
    .filter((item): item is SpatialCraftGrammar => Boolean(item));
  if (selected.length === 0) {
    return {
      ...blueprint,
      preferredCraftIds: [],
      preferredCraftTags: [],
      requiredTokenRoles: [],
    };
  }
  return {
    ...blueprint,
    preferredCraftIds: selected.map((item) => item.id),
    preferredCraftTags: Array.from(new Set(selected.flatMap((item) => item.craftTags))).slice(0, 12),
    requiredTokenRoles: Array.from(new Set(selected.flatMap((item) => item.requiredTokenRoles))).slice(0, 24),
    signatureConstructions: blueprint.signatureConstructions.length > 0
      ? blueprint.signatureConstructions.slice(0, 4)
      : selected.map((item) => item.summary).slice(0, 4),
  };
};

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
  .map((item) => [
    `- ${item.id} [${item.category}]: ${item.summary}`,
    `Best for ${item.compatibleRoles.join(", ")}.`,
    `Construction: ${item.geometryRules[0]} ${item.positioningRules[0]}`,
    `Avoid: ${item.antiPatterns[0]}`,
    `Live roles: ${item.requiredTokenRoles.join(", ")}.`,
  ].join(" "))
  .join("\n");

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
