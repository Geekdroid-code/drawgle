export const CURATED_STYLE_THEMES = ["light", "dark", "mixed"] as const;
export const CURATED_STYLE_DENSITIES = ["airy", "balanced", "dense"] as const;
export const CURATED_STYLE_ASSET_BIASES = ["data", "text", "photo", "control", "product", "mixed"] as const;
export const CURATED_STYLE_COLOR_CHARACTERS = [
  "restrained-neutral",
  "pastel",
  "vivid-accent",
  "neon-accent",
  "monochrome",
  "warm-organic",
  "cool-clinical",
  "multicolor",
] as const;
export const CURATED_STYLE_TYPOGRAPHY_CHARACTERS = [
  "neutral-sans",
  "geometric-sans",
  "humanist-sans",
  "editorial-serif",
  "technical-mono",
  "display-led",
] as const;

export const CURATED_STYLE_PRODUCT_ARCHETYPES = [
  "security-utility",
  "device-control",
  "monitoring-operations",
  "consumer-commerce",
  "commerce-operations",
  "health-tracking",
  "health-analytics",
  "wellness",
  "personal-finance",
  "trading",
  "productivity",
  "education",
  "booking",
  "editorial-content",
  "social-discovery",
  "travel",
  "media",
  "other",
] as const;

export const CURATED_STYLE_INTERACTION_ARCHETYPES = [
  "status-overview",
  "metric-dashboard",
  "monitoring",
  "control-panel",
  "catalog-discovery",
  "product-detail",
  "transaction-flow",
  "form-workflow",
  "timeline-history",
  "schedule",
  "content-feed",
  "text-workspace",
  "media-player",
  "settings-list",
  "profile",
  "social-feed",
] as const;

export const CURATED_STYLE_COMPOSITIONS = [
  "dominant-metric-hero",
  "bento-grid",
  "stacked-list",
  "split-plane",
  "editorial-flow",
  "full-bleed-media",
  "edge-to-edge",
  "inset-sheet",
  "modular-grid",
  "data-dense",
  "asymmetric",
  "centered-focus",
] as const;

export const CURATED_STYLE_MATERIALS = [
  "flat",
  "soft-elevated",
  "glass",
  "tactile",
  "layered",
  "high-contrast",
  "atmospheric",
  "photographic",
  "illustrated",
] as const;

export const CURATED_STYLE_GEOMETRIES = [
  "rounded",
  "capsule",
  "sharp",
  "organic",
  "sheet-connected",
  "inset",
  "edge-to-edge",
  "mixed",
] as const;

export const CURATED_STYLE_NAVIGATION = [
  "floating-dock",
  "fixed-tabs",
  "minimal-chrome",
  "top-bar",
] as const;

export const CURATED_STYLE_MOODS = [
  "calm",
  "precise",
  "premium",
  "energetic",
  "playful",
  "serious",
  "clinical",
  "friendly",
  "focused",
  "futuristic",
  "cozy",
  "disciplined",
  "trustworthy",
  "bold",
  "serene",
  "professional",
  "accessible",
] as const;

export type CuratedStyleTheme = (typeof CURATED_STYLE_THEMES)[number];
export type CuratedStyleDensity = (typeof CURATED_STYLE_DENSITIES)[number];
export type CuratedStyleAssetBias = (typeof CURATED_STYLE_ASSET_BIASES)[number];
export type CuratedStyleColorCharacter = (typeof CURATED_STYLE_COLOR_CHARACTERS)[number];
export type CuratedStyleTypographyCharacter = (typeof CURATED_STYLE_TYPOGRAPHY_CHARACTERS)[number];
export type CuratedStyleProductArchetype = (typeof CURATED_STYLE_PRODUCT_ARCHETYPES)[number];
export type CuratedStyleInteractionArchetype = (typeof CURATED_STYLE_INTERACTION_ARCHETYPES)[number];
export type CuratedStyleComposition = (typeof CURATED_STYLE_COMPOSITIONS)[number];
export type CuratedStyleMaterial = (typeof CURATED_STYLE_MATERIALS)[number];
export type CuratedStyleGeometry = (typeof CURATED_STYLE_GEOMETRIES)[number];
export type CuratedStyleNavigation = (typeof CURATED_STYLE_NAVIGATION)[number];
export type CuratedStyleMood = (typeof CURATED_STYLE_MOODS)[number];

export type CuratedStyleSelectionProfile = {
  theme: CuratedStyleTheme;
  productArchetypes: CuratedStyleProductArchetype[];
  interactionArchetypes: CuratedStyleInteractionArchetype[];
  compositions: CuratedStyleComposition[];
  materials: CuratedStyleMaterial[];
  geometries: CuratedStyleGeometry[];
  navigation: CuratedStyleNavigation[];
  density: CuratedStyleDensity;
  assetBias: CuratedStyleAssetBias;
  colorCharacter: CuratedStyleColorCharacter[];
  typographyCharacter: CuratedStyleTypographyCharacter[];
  moods: CuratedStyleMood[];
  incompatibleWith: string[];
};

export type CuratedStyleReference = {
  id: string;
  imageUrl: string;
  styleIntent: string;
  selectionProfile: CuratedStyleSelectionProfile;
};

/**
 * Authoring catalog for prompt-only style transfer. Add new references by
 * describing reusable visual/spatial DNA, not literal copy visible in the image.
 */
export const CURATED_STYLE_REFERENCES: CuratedStyleReference[] = [
  {
    id: "security-watchtower-light-score",
    imageUrl: "/password-manager.png",
    styleIntent: "Light trust-oriented utility with a dominant score hero, calibrated scale, softly separated status surface, precise account rows, and quiet fixed navigation.",
    selectionProfile: {
      theme: "light",
      productArchetypes: ["security-utility", "monitoring-operations"],
      interactionArchetypes: ["status-overview", "metric-dashboard", "monitoring", "settings-list"],
      compositions: ["dominant-metric-hero", "stacked-list", "edge-to-edge"],
      materials: ["flat", "soft-elevated"],
      geometries: ["rounded", "inset"],
      navigation: ["fixed-tabs"],
      density: "balanced",
      assetBias: "data",
      colorCharacter: ["cool-clinical", "restrained-neutral"],
      typographyCharacter: ["neutral-sans"],
      moods: ["calm", "precise", "trustworthy", "accessible"],
      incompatibleWith: ["dark", "photo", "full-bleed-media", "playful", "consumer-commerce"],
    },
  },
  {
    id: "smart-home-iot-tactile-dark",
    imageUrl: "https://pub-7c8c3c7444724a39ba3eeb8accbbca4a.r2.dev/curated-library/smart-home-iot-tactile-dark.jpg",
    styleIntent: "Dark tactile control center with modular bento zones, luminous state feedback, deep glass edges, configurable controls, and a compact floating dock.",
    selectionProfile: {
      theme: "dark",
      productArchetypes: ["device-control", "monitoring-operations"],
      interactionArchetypes: ["control-panel", "status-overview", "monitoring"],
      compositions: ["bento-grid", "modular-grid", "asymmetric"],
      materials: ["glass", "tactile", "layered", "atmospheric"],
      geometries: ["rounded", "inset", "mixed"],
      navigation: ["floating-dock"],
      density: "balanced",
      assetBias: "control",
      colorCharacter: ["neon-accent", "restrained-neutral"],
      typographyCharacter: ["geometric-sans"],
      moods: ["premium", "futuristic", "cozy", "precise"],
      incompatibleWith: ["light", "airy", "editorial-flow", "photo", "commerce-operations"],
    },
  },
  {
    id: "sneaker-ecom-futuristic-light",
    imageUrl: "https://pub-7c8c3c7444724a39ba3eeb8accbbca4a.r2.dev/curated-library/sneaker-ecom-store.jpg",
    styleIntent: "Photo-led lifestyle storefront with asymmetric product staging, floating selection controls, restrained soft depth, high-contrast commerce actions, and compact dock navigation.",
    selectionProfile: {
      theme: "light",
      productArchetypes: ["consumer-commerce", "social-discovery"],
      interactionArchetypes: ["catalog-discovery", "product-detail"],
      compositions: ["asymmetric", "full-bleed-media", "editorial-flow", "modular-grid"],
      materials: ["photographic", "soft-elevated", "layered"],
      geometries: ["rounded", "mixed"],
      navigation: ["floating-dock"],
      density: "balanced",
      assetBias: "product",
      colorCharacter: ["vivid-accent", "restrained-neutral"],
      typographyCharacter: ["display-led", "geometric-sans"],
      moods: ["energetic", "premium", "bold"],
      incompatibleWith: ["dark", "data-dense", "clinical", "text-workspace", "commerce-operations"],
    },
  },
  {
    id: "femtech-period-tracker-circular-light",
    imageUrl: "https://pub-7c8c3c7444724a39ba3eeb8accbbca4a.r2.dev/curated-library/femtech-period-tracker-circular-light.png",
    styleIntent: "Calm clinical tracker centered on a segmented circular status focal point, supported by highly legible hierarchy and quiet modular metric regions.",
    selectionProfile: {
      theme: "light",
      productArchetypes: ["health-tracking", "health-analytics", "wellness"],
      interactionArchetypes: ["status-overview", "metric-dashboard", "timeline-history"],
      compositions: ["dominant-metric-hero", "modular-grid", "centered-focus"],
      materials: ["flat", "soft-elevated"],
      geometries: ["rounded", "capsule", "inset"],
      navigation: ["fixed-tabs"],
      density: "balanced",
      assetBias: "data",
      colorCharacter: ["pastel", "cool-clinical"],
      typographyCharacter: ["humanist-sans"],
      moods: ["calm", "clinical", "precise", "accessible"],
      incompatibleWith: ["dark", "photo", "data-dense", "bold", "atmospheric", "commerce-operations"],
    },
  },
  {
    id: "fitness-calorie-tracker-pastel-minimal",
    imageUrl: "https://pub-7c8c3c7444724a39ba3eeb8accbbca4a.r2.dev/curated-library/fitness-calorie-tracker-pastel-minimal.png",
    styleIntent: "Friendly light tracker with pastel-coded metrics, capsule visualizations, a weekly date rail, modular logging regions, and approachable social-health details.",
    selectionProfile: {
      theme: "light",
      productArchetypes: ["health-tracking", "wellness", "social-discovery"],
      interactionArchetypes: ["metric-dashboard", "timeline-history", "social-feed"],
      compositions: ["bento-grid", "modular-grid", "stacked-list"],
      materials: ["flat", "illustrated"],
      geometries: ["rounded", "capsule"],
      navigation: ["floating-dock"],
      density: "balanced",
      assetBias: "data",
      colorCharacter: ["pastel", "multicolor"],
      typographyCharacter: ["humanist-sans"],
      moods: ["friendly", "playful", "accessible"],
      incompatibleWith: ["dark", "serious", "high-contrast", "data-dense", "commerce-operations"],
    },
  },
  {
    id: "fitness-kalo-progress-dark",
    imageUrl: "https://pub-7c8c3c7444724a39ba3eeb8accbbca4a.r2.dev/curated-library/fitness-kalo-progress-dark.png",
    styleIntent: "Dark disciplined analytics surface with tightly grouped trends, bright chart accents, compact metric clusters, segmented time controls, and an ergonomic action-led tab shell.",
    selectionProfile: {
      theme: "dark",
      productArchetypes: ["health-analytics", "health-tracking"],
      interactionArchetypes: ["metric-dashboard", "timeline-history", "status-overview"],
      compositions: ["data-dense", "bento-grid", "modular-grid"],
      materials: ["flat", "high-contrast", "layered"],
      geometries: ["rounded", "mixed"],
      navigation: ["fixed-tabs"],
      density: "dense",
      assetBias: "data",
      colorCharacter: ["neon-accent", "restrained-neutral"],
      typographyCharacter: ["geometric-sans"],
      moods: ["focused", "premium", "disciplined", "precise"],
      incompatibleWith: ["light", "airy", "pastel", "photo", "consumer-commerce"],
    },
  },
  {
    id: "diet-nutrition-journal-pastel",
    imageUrl: "https://pub-7c8c3c7444724a39ba3eeb8accbbca4a.r2.dev/curated-library/diet-nutrition-journal-pastel.png",
    styleIntent: "Cheerful journal and discovery hub with organic pastel regions, wavy separators, lightweight progress visuals, educational content previews, and a translucent dock.",
    selectionProfile: {
      theme: "light",
      productArchetypes: ["health-tracking", "wellness", "editorial-content"],
      interactionArchetypes: ["content-feed", "timeline-history", "catalog-discovery"],
      compositions: ["editorial-flow", "modular-grid", "asymmetric"],
      materials: ["glass", "illustrated", "layered"],
      geometries: ["organic", "rounded", "mixed"],
      navigation: ["floating-dock"],
      density: "balanced",
      assetBias: "mixed",
      colorCharacter: ["pastel", "multicolor", "warm-organic"],
      typographyCharacter: ["humanist-sans"],
      moods: ["friendly", "playful", "serene"],
      incompatibleWith: ["dark", "serious", "data-dense", "sharp", "commerce-operations"],
    },
  },
  {
    id: "finance-light-soft-banking-home",
    imageUrl: "/finance.jpeg",
    styleIntent: "Soft light banking overview with oversized balance typography, pill actions, rounded payment modules, gentle depth, transaction rows, and a dark floating dock.",
    selectionProfile: {
      theme: "light",
      productArchetypes: ["personal-finance"],
      interactionArchetypes: ["status-overview", "metric-dashboard", "transaction-flow", "timeline-history"],
      compositions: ["dominant-metric-hero", "bento-grid", "stacked-list"],
      materials: ["soft-elevated"],
      geometries: ["rounded", "capsule"],
      navigation: ["floating-dock"],
      density: "balanced",
      assetBias: "data",
      colorCharacter: ["pastel", "restrained-neutral"],
      typographyCharacter: ["neutral-sans"],
      moods: ["calm", "friendly", "trustworthy"],
      incompatibleWith: ["dark", "sharp", "photo", "editorial-flow", "data-dense", "professional"],
    },
  },
  {
    id: "crypto-dark-exchange-payment",
    imageUrl: "/payment.jpeg",
    styleIntent: "Dark focused transaction flow with two stacked currency planes, a central swap affordance, one high-contrast pill action, restrained metadata, and deep graphite surfaces.",
    selectionProfile: {
      theme: "dark",
      productArchetypes: ["trading", "personal-finance"],
      interactionArchetypes: ["transaction-flow", "form-workflow", "product-detail"],
      compositions: ["split-plane", "centered-focus", "edge-to-edge"],
      materials: ["flat", "high-contrast"],
      geometries: ["rounded", "capsule", "inset"],
      navigation: ["top-bar", "minimal-chrome"],
      density: "balanced",
      assetBias: "control",
      colorCharacter: ["monochrome", "restrained-neutral"],
      typographyCharacter: ["geometric-sans"],
      moods: ["serious", "precise", "premium"],
      incompatibleWith: ["light", "playful", "pastel", "content-feed", "photo", "health-tracking"],
    },
  },
  {
    id: "ecommerce-light-inventory-store-suite",
    imageUrl: "/ecommerce.jpg",
    styleIntent: "Bright retail operations suite with compact stat blocks, product inventory rows, profile metrics, low-friction settings groups, and straightforward fixed tabs.",
    selectionProfile: {
      theme: "light",
      productArchetypes: ["commerce-operations"],
      interactionArchetypes: ["metric-dashboard", "catalog-discovery", "settings-list", "profile"],
      compositions: ["modular-grid", "stacked-list", "data-dense"],
      materials: ["flat", "soft-elevated"],
      geometries: ["rounded", "inset"],
      navigation: ["fixed-tabs"],
      density: "dense",
      assetBias: "mixed",
      colorCharacter: ["vivid-accent", "multicolor"],
      typographyCharacter: ["neutral-sans"],
      moods: ["friendly", "professional", "precise"],
      incompatibleWith: ["dark", "full-bleed-media", "atmospheric", "serene", "personal-finance", "productivity"],
    },
  },
];
