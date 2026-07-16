export const CURATED_STYLE_THEMES = ["light", "dark", "mixed"] as const;
export const CURATED_STYLE_DENSITIES = ["airy", "balanced", "dense"] as const;

export type CuratedStyleTheme = (typeof CURATED_STYLE_THEMES)[number];
export type CuratedStyleDensity = (typeof CURATED_STYLE_DENSITIES)[number];

export type CuratedStyleSelectionProfile = {
  theme: CuratedStyleTheme;
  productArchetypes: string[];
  interactionArchetypes: string[];
  compositions: string[];
  materials: string[];
  geometries: string[];
  navigation: string[];
  density: CuratedStyleDensity;
  assetBias: string;
  colorCharacter: string[];
  typographyCharacter: string[];
  moods: string[];
  incompatibleWith: string[];
};

export type CuratedStyleReference = {
  id: string;
  imageUrl: string;
  styleIntent: string;
  selectionProfile: CuratedStyleSelectionProfile;
};

const TAG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const assertTag = (value: string, path: string) => {
  if (value.length > 80 || !TAG_PATTERN.test(value)) {
    throw new Error(`Invalid curated style tag at ${path}: ${JSON.stringify(value)}`);
  }
};

const assertTagArray = (values: string[], path: string, allowEmpty = false) => {
  if (!allowEmpty && values.length === 0) {
    throw new Error(`Curated style field must not be empty: ${path}`);
  }
  if (values.length > 12) {
    throw new Error(`Curated style field contains too many tags: ${path}`);
  }
  if (new Set(values).size !== values.length) {
    throw new Error(`Curated style field contains duplicate tags: ${path}`);
  }
  values.forEach((value, index) => assertTag(value, `${path}[${index}]`));
};

export function assertCuratedStyleCatalog(references: CuratedStyleReference[]) {
  const ids = new Set<string>();
  for (const reference of references) {
    assertTag(reference.id, `${reference.id || "<unknown>"}.id`);
    if (ids.has(reference.id)) {
      throw new Error(`Duplicate curated style reference id: ${reference.id}`);
    }
    ids.add(reference.id);
    if (!reference.imageUrl.startsWith("/")) {
      try {
        const imageUrl = new URL(reference.imageUrl);
        if (imageUrl.protocol !== "http:" && imageUrl.protocol !== "https:") {
          throw new Error("Unsupported protocol");
        }
      } catch {
        throw new Error(`Invalid curated style image URL for ${reference.id}`);
      }
    }
    if (reference.styleIntent.trim().length < 40) {
      throw new Error(`Curated style intent is too short for ${reference.id}`);
    }

    const profile = reference.selectionProfile;
    if (!CURATED_STYLE_THEMES.includes(profile.theme)) {
      throw new Error(`Invalid curated style theme for ${reference.id}: ${profile.theme}`);
    }
    if (!CURATED_STYLE_DENSITIES.includes(profile.density)) {
      throw new Error(`Invalid curated style density for ${reference.id}: ${profile.density}`);
    }
    assertTagArray(profile.productArchetypes, `${reference.id}.productArchetypes`);
    assertTagArray(profile.interactionArchetypes, `${reference.id}.interactionArchetypes`);
    assertTagArray(profile.compositions, `${reference.id}.compositions`);
    assertTagArray(profile.materials, `${reference.id}.materials`);
    assertTagArray(profile.geometries, `${reference.id}.geometries`);
    assertTagArray(profile.navigation, `${reference.id}.navigation`);
    assertTag(profile.assetBias, `${reference.id}.assetBias`);
    assertTagArray(profile.colorCharacter, `${reference.id}.colorCharacter`);
    assertTagArray(profile.typographyCharacter, `${reference.id}.typographyCharacter`);
    assertTagArray(profile.moods, `${reference.id}.moods`);
    assertTagArray(profile.incompatibleWith, `${reference.id}.incompatibleWith`, true);
  }
}

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
  {
    "id": "fintech-minimalist-grain-cream",
    "imageUrl": "https://pub-7c8c3c7444724a39ba3eeb8accbbca4a.r2.dev/curated-library/fintech-minimalist-grain-cream.jpg",
    "styleIntent": "Sophisticated light-mode fintech interface utilizing an editorial, cream-toned layout with subtle grainy textures, monochrome control elements, and low-contrast data visualization grids.",
    "selectionProfile": {
      "theme": "light",
      "productArchetypes": ["data-dense-dashboard", "finance-banking", "analytics-operations"],
      "interactionArchetypes": ["status-overview", "monitoring", "data-visualization"],
      "compositions": ["asymmetric", "clean-spatial", "modular-vertical"],
      "materials": ["grainy", "matte", "flat-layered"],
      "geometries": ["rounded", "pill-shaped"],
      "navigation": ["bottom-pill-dock", "top-context-bar"],
      "density": "airy",
      "assetBias": "typographic",
      "colorCharacter": ["pastel-accent", "monochromatic-neutral", "cream-base"],
      "typographyCharacter": ["editorial-sans", "geometric-sans"],
      "moods": ["premium", "sophisticated", "calm", "focused"],
      "incompatibleWith": ["dark", "neon-accent", "tactile-depth", "glassmorphism", "bento-grid", "heavy-shadows", "commerce-operations"]
    }
  },
  {
    "id": "fintech-skeuomorphic-clean-light",
    "imageUrl": "https://pub-7c8c3c7444724a39ba3eeb8accbbca4a.r2.dev/curated-library/fintech-skeuomorphic-clean-light.jpg",
    "styleIntent": "Clean light-mode financial interface blending skeuomorphic physical elements, like a detailed stitched leather card holder wallet, with flat, high-contrast typography and structured transactional layouts.",
    "selectionProfile": {
      "theme": "light",
      "productArchetypes": ["finance-banking", "e-commerce-wallet", "data-dense-dashboard"],
      "interactionArchetypes": ["control-panel", "status-overview", "transaction-history"],
      "compositions": ["modular-vertical", "stacked-cards", "clean-spatial"],
      "materials": ["skeuomorphic-leather", "flat-layered", "matte"],
      "geometries": ["rounded", "pill-shaped"],
      "navigation": ["floating-dock", "top-context-bar"],
      "density": "balanced",
      "assetBias": "mixed",
      "colorCharacter": ["restrained-neutral", "monochromatic-neutral", "brand-accent"],
      "typographyCharacter": ["geometric-sans"],
      "moods": ["premium", "precise", "clean", "trustworthy"],
      "incompatibleWith": ["dark", "neon-accent", "glassmorphism", "bento-grid", "airy", "editorial-flow"]
    }
  },
  {
    "id": "crypto-wallet-glowing-dark",
    "imageUrl": "https://pub-7c8c3c7444724a39ba3eeb8accbbca4a.r2.dev/curated-library/crypto-wallet-glowing-dark.jpg",
    "styleIntent": "Premium dark-mode crypto wallet interface utilizing vibrant atmospheric blue gradients, frosted glassmorphic overlay cards, fluid performance line graphs, and a clean, high-contrast asset breakdown panel.",
    "selectionProfile": {
      "theme": "dark",
      "productArchetypes": ["crypto-web3", "finance-banking", "investment-tracking"],
      "interactionArchetypes": ["status-overview", "dashboard", "data-visualization"],
      "compositions": ["layered-stack", "asymmetric-split", "modular-vertical"],
      "materials": ["glassmorphism", "atmospheric-gradient", "matte"],
      "geometries": ["rounded", "pill-shaped"],
      "navigation": ["bottom-nav-bar", "top-context-bar"],
      "density": "balanced",
      "assetBias": "mixed",
      "colorCharacter": ["neon-accent", "vibrant-gradient", "restrained-neutral"],
      "typographyCharacter": ["geometric-sans"],
      "moods": ["premium", "futuristic", "sleek", "focused"],
      "incompatibleWith": ["light", "airy", "editorial-flow", "skeuomorphic", "commerce-operations"]
    }
  },
  {
    "id": "edtech-kids-3d-playful",
    "imageUrl": "https://pub-7c8c3c7444724a39ba3eeb8accbbca4a.r2.dev/curated-library/edtech-kids-3d-playful.jpg",
    "styleIntent": "Vibrant and friendly edtech interface for kids, blending rich 3D claymation illustrations with soft lavender pastel backgrounds, rounded card containers, and clean gamified navigation elements.",
    "selectionProfile": {
      "theme": "light",
      "productArchetypes": ["education-learning", "gamified-platform", "kids-entertainment"],
      "interactionArchetypes": ["onboarding", "status-overview", "content-discovery"],
      "compositions": ["modular-vertical", "stacked-cards", "playful-asymmetric"],
      "materials": ["matte", "3d-rendered", "flat-layered"],
      "geometries": ["rounded", "pill-shaped"],
      "navigation": ["floating-dock"],
      "density": "balanced",
      "assetBias": "illustration-heavy",
      "colorCharacter": ["pastel-base", "playful-accent"],
      "typographyCharacter": ["playful-sans", "geometric-sans"],
      "moods": ["playful", "engaging", "cheerful", "friendly"],
      "incompatibleWith": ["dark", "neon-accent", "glassmorphism", "bento-grid", "finance-banking", "data-dense-dashboard"]
    }
  },
  {
    "id": "productivity-planner-minimal-light",
    "imageUrl": "https://pub-7c8c3c7444724a39ba3eeb8accbbca4a.r2.dev/curated-library/productivity-planner-minimal-light.jpg",
    "styleIntent": "Minimalist light-mode scheduling and task interface featuring modular stacked cards, desaturated pastel event containers, interactive task checklists, and a compact floating utility dock.",
    "selectionProfile": {
      "theme": "light",
      "productArchetypes": ["productivity-task", "calendar-scheduling", "personal-organizer"],
      "interactionArchetypes": ["status-overview", "task-management", "control-panel"],
      "compositions": ["stacked-cards", "clean-spatial", "modular-vertical"],
      "materials": ["matte", "flat-layered", "subtle-shadow"],
      "geometries": ["rounded", "pill-shaped"],
      "navigation": ["floating-pill-dock", "top-context-bar"],
      "density": "balanced",
      "assetBias": "typographic",
      "colorCharacter": ["pastel-accent", "restrained-neutral", "clean-base"],
      "typographyCharacter": ["geometric-sans", "functional-ui-sans"],
      "moods": ["clean", "focused", "organized", "calm"],
      "incompatibleWith": ["dark", "neon-accent", "glassmorphism", "bento-grid", "skeuomorphic", "heavy-shadows", "data-dense-dashboard"]
    }
  },
  {
    "id": "crypto-analytics-clean-light",
    "imageUrl": "https://pub-7c8c3c7444724a39ba3eeb8accbbca4a.r2.dev/curated-library/crypto-analytics-clean-light.jpg",
    "styleIntent": "Clean light-mode crypto and web3 intelligence dashboard featuring vibrant sentiment bar charts, multi-colored progress indicator metrics, minimal line graphs, and structured analytical tables enclosed in soft rounded frames.",
    "selectionProfile": {
      "theme": "light",
      "productArchetypes": ["crypto-web3", "analytics-operations", "investment-tracking"],
      "interactionArchetypes": ["dashboard", "data-visualization", "status-overview"],
      "compositions": ["modular-vertical", "stacked-cards", "clean-spatial"],
      "materials": ["matte", "flat-layered", "subtle-shadow"],
      "geometries": ["rounded", "pill-shaped"],
      "navigation": ["bottom-pill-dock", "top-context-bar"],
      "density": "balanced",
      "assetBias": "mixed",
      "colorCharacter": ["vibrant-accent", "restrained-neutral", "clean-base"],
      "typographyCharacter": ["geometric-sans"],
      "moods": ["clean", "precise", "focused", "sophisticated"],
      "incompatibleWith": ["dark", "neon-accent", "glassmorphism", "skeuomorphic", "heavy-shadows", "editorial-flow"]
    }
  },
  {
    "id": "travel-tracker-airy-light",
    "imageUrl": "https://pub-7c8c3c7444724a39ba3eeb8accbbca4a.r2.dev/curated-library/travel-tracker-airy-light.jpg",
    "styleIntent": "Minimalist light-mode travel and savings tracker featuring a soft-masked hero image, airy spatial construction, ticket-style modular cards with subtle drop shadows, and a clean bottom navigation bar with a prominent action button.",
    "selectionProfile": {
      "theme": "light",
      "productArchetypes": ["travel-operations", "finance-tracker", "utility"],
      "interactionArchetypes": ["onboarding", "status-overview", "list-view"],
      "compositions": ["hero-header", "clean-spatial", "stacked-cards"],
      "materials": ["matte", "soft-shadow", "flat-layered"],
      "geometries": ["rounded", "pill-shaped"],
      "navigation": ["bottom-tab-bar", "prominent-fab"],
      "density": "airy",
      "assetBias": "mixed",
      "colorCharacter": ["clean-base", "brand-accent", "restrained-neutral"],
      "typographyCharacter": ["geometric-sans", "functional-ui-sans"],
      "moods": ["calm", "clean", "trustworthy", "approachable"],
      "incompatibleWith": ["dark", "neon-accent", "tactile-depth", "glassmorphism", "bento-grid", "data-dense-dashboard", "skeuomorphic"]
    }
  },
  {
    "id": "productivity-dashboard-machined-dark",
    "imageUrl": "https://pub-7c8c3c7444724a39ba3eeb8accbbca4a.r2.dev/curated-library/productivity-dashboard-machined-dark.jpeg",
    "styleIntent": "Deep dark-mode productivity dashboard featuring a machined, tactical aesthetic with high-contrast typography, inline hero iconography, neon green performance accents, and structured list modules.",
    "selectionProfile": {
      "theme": "dark",
      "productArchetypes": ["productivity-task", "calendar-scheduling", "performance-tracking"],
      "interactionArchetypes": ["dashboard", "status-overview", "list-view"],
      "compositions": ["typographic-header", "modular-vertical", "stacked-rows"],
      "materials": ["matte", "flat-layered", "subtle-border"],
      "geometries": ["rounded", "pill-shaped"],
      "navigation": ["bottom-fab", "top-context-bar"],
      "density": "balanced",
      "assetBias": "typographic",
      "colorCharacter": ["deep-black-base", "neon-accent", "monochromatic-neutral"],
      "typographyCharacter": ["geometric-sans", "high-contrast"],
      "moods": ["precise", "focused", "tactical", "premium"],
      "incompatibleWith": ["light", "playful", "airy", "skeuomorphic", "glassmorphism", "illustration-heavy"]
    }
  },
  {
    "id": "health-tracker-clinical-dark",
    "imageUrl": "https://pub-7c8c3c7444724a39ba3eeb8accbbca4a.r2.dev/curated-library/health-tracker-clinical-dark.jpeg",
    "styleIntent": "Data-dense dark-mode health tracker interface emphasizing clinical precision with electric blue gradient area charts, multi-colored status gauges, and highly structured list menus on a true black canvas.",
    "selectionProfile": {
      "theme": "dark",
      "productArchetypes": ["health-medical", "fitness-tracking", "data-dense-dashboard"],
      "interactionArchetypes": ["data-visualization", "monitoring", "settings-menu"],
      "compositions": ["modular-vertical", "list-view", "dashboard-grid"],
      "materials": ["matte", "flat-layered"],
      "geometries": ["rounded", "circular-gauges"],
      "navigation": ["bottom-tab-bar", "segmented-control"],
      "density": "dense",
      "assetBias": "data-viz",
      "colorCharacter": ["deep-black-base", "electric-accent", "status-indicator-colors"],
      "typographyCharacter": ["functional-ui-sans", "data-readability"],
      "moods": ["clinical", "precise", "focused", "analytical"],
      "incompatibleWith": ["light", "playful", "airy", "3d-rendered", "skeuomorphic", "glassmorphism"]
    }
  },
  {
    "id": "gamified-profile-neon-dark",
    "imageUrl": "https://pub-7c8c3c7444724a39ba3eeb8accbbca4a.r2.dev/curated-library/gamified-profile-neon-dark.jpeg",
    "styleIntent": "Gamified dark-mode profile dashboard emphasizing high-contrast acid green accents against a true black canvas, structured within a clean bento grid and featuring polished 3D rendered assets for achievement tracking.",
    "selectionProfile": {
      "theme": "dark",
      "productArchetypes": ["gaming-platform", "gamified-utility", "profile-dashboard"],
      "interactionArchetypes": ["status-overview", "achievement-tracking", "dashboard"],
      "compositions": ["bento-grid", "modular-vertical", "horizontal-scroll"],
      "materials": ["3d-rendered", "matte", "flat-layered"],
      "geometries": ["rounded", "pill-shaped"],
      "navigation": ["bottom-tab-bar", "top-context-bar"],
      "density": "balanced",
      "assetBias": "3d-illustration",
      "colorCharacter": ["neon-accent", "deep-black-base", "monochromatic-neutral"],
      "typographyCharacter": ["geometric-sans"],
      "moods": ["bold", "futuristic", "engaging", "playful"],
      "incompatibleWith": ["light", "airy", "editorial-flow", "skeuomorphic", "clinical", "data-dense-dashboard"]
    }
  },
  {
    "id": "nutrition-tracker-bento-light",
    "imageUrl": "https://pub-7c8c3c7444724a39ba3eeb8accbbca4a.r2.dev/curated-library/nutrition-tracker-bento-light.jpeg",
    "styleIntent": "Crisp light-mode nutrition tracking interface utilizing a structured bento grid, vibrant multi-colored data visualizations for macro tracking, minimal wireframe iconography, and high-contrast black action pills.",
    "selectionProfile": {
      "theme": "light",
      "productArchetypes": ["health-fitness", "nutrition-tracker", "data-dense-dashboard"],
      "interactionArchetypes": ["data-visualization", "daily-logging", "status-overview"],
      "compositions": ["bento-grid", "modular-vertical", "calendar-strip"],
      "materials": ["flat-layered", "matte"],
      "geometries": ["rounded", "pill-shaped"],
      "navigation": ["bottom-tab-bar", "horizontal-scroll"],
      "density": "balanced",
      "assetBias": "data-viz",
      "colorCharacter": ["clean-base", "vibrant-accent", "high-contrast-black"],
      "typographyCharacter": ["functional-ui-sans", "numeric-heavy"],
      "moods": ["clean", "organized", "clinical", "focused"],
      "incompatibleWith": ["dark", "tactile-depth", "glassmorphism", "skeuomorphic", "3d-rendered", "atmospheric-gradient"]
    }
  },
  {
    "id": "security-vault-glass-dark",
    "imageUrl": "https://pub-7c8c3c7444724a39ba3eeb8accbbca4a.r2.dev/curated-library/security-vault-glass-dark.jpeg",
    "styleIntent": "Secure dark-mode vault interface featuring high-end glassmorphism, atmospheric background gradients, polished rounded cards, and tactile, glow-accented interactive elements for a premium privacy-focused experience.",
    "selectionProfile": {
      "theme": "dark",
      "productArchetypes": ["security-utility", "privacy-vault", "password-manager"],
      "interactionArchetypes": ["status-overview", "list-management", "security-audit"],
      "compositions": ["stacked-lists", "modular-cards", "fluid-layout"],
      "materials": ["glassmorphism", "atmospheric-blur", "layered-depth"],
      "geometries": ["rounded", "pill-shaped"],
      "navigation": ["bottom-fab", "top-context-bar"],
      "density": "balanced",
      "assetBias": "iconography-heavy",
      "colorCharacter": ["monochromatic-neutral", "deep-black-base", "subtle-glow-accent"],
      "typographyCharacter": ["geometric-sans", "clean-legible"],
      "moods": ["secure", "premium", "trustworthy", "futuristic"],
      "incompatibleWith": ["light", "playful", "skeuomorphic", "bento-grid", "airy", "vibrant-gradient"]
    }
  },
  {
    "id": "biomarker-tracker-clean-light",
    "imageUrl": "https://pub-7c8c3c7444724a39ba3eeb8accbbca4a.r2.dev/curated-library/biomarker-tracker-clean-light.jpg",
    "styleIntent": "Clinical light-mode health interface focusing on lab diagnostics and biomarker analysis, utilizing a clean bento grid layout, pastel data status bars, precise line graphs, and an AI chat assistant interface.",
    "selectionProfile": {
      "theme": "light",
      "productArchetypes": ["health-medical", "analytics-operations", "data-dense-dashboard"],
      "interactionArchetypes": ["dashboard", "data-visualization", "conversational-agent"],
      "compositions": ["bento-grid", "modular-vertical", "chat-interface"],
      "materials": ["matte", "flat-layered"],
      "geometries": ["rounded", "pill-shaped"],
      "navigation": ["bottom-tab-bar", "prominent-fab"],
      "density": "balanced",
      "assetBias": "data-viz",
      "colorCharacter": ["clean-base", "pastel-accent", "restrained-neutral"],
      "typographyCharacter": ["functional-ui-sans", "data-readability"],
      "moods": ["clinical", "precise", "calm", "organized"],
      "incompatibleWith": ["dark", "neon-accent", "glassmorphism", "skeuomorphic", "heavy-shadows", "playful"]
    }
  },
  {
    "id": "creator-dashboard-airy-light",
    "imageUrl": "https://pub-7c8c3c7444724a39ba3eeb8accbbca4a.r2.dev/curated-library/creator-dashboard-airy-light.jpg",
    "styleIntent": "Minimalist light-mode workflow and analytics tool for creators, blending clean editorial structures, low-contrast bento style card blocks, smooth frosted glass bottom nav bars, and high-end photographic content assets.",
    "selectionProfile": {
      "theme": "light",
      "productArchetypes": ["productivity-task", "analytics-operations", "social-media-management"],
      "interactionArchetypes": ["dashboard", "status-overview", "data-visualization"],
      "compositions": ["clean-spatial", "bento-grid", "modular-vertical"],
      "materials": ["matte", "glassmorphism", "flat-layered"],
      "geometries": ["rounded", "pill-shaped"],
      "navigation": ["floating-pill-dock", "segmented-control"],
      "density": "balanced",
      "assetBias": "photo-heavy",
      "colorCharacter": ["clean-base", "restrained-neutral", "monochromatic-neutral"],
      "typographyCharacter": ["geometric-sans", "functional-ui-sans"],
      "moods": ["premium", "sophisticated", "organized", "calm"],
      "incompatibleWith": ["dark", "neon-accent", "tactile-depth", "skeuomorphic", "heavy-shadows", "clinical"]
    }
  },
  {
    "id": "fitness-tracker-minimalist-light",
    "imageUrl": "https://pub-7c8c3c7444724a39ba3eeb8accbbca4a.r2.dev/curated-library/fitness-tracker-minimalist-light.jpg",
    "styleIntent": "Clean, light-mode fitness and nutrition tracker featuring structured asymmetric bento zones, vibrant lime-green progress gauges, minimal high-contrast typography, and explicit pill-shaped action buttons.",
    "selectionProfile": {
      "theme": "light",
      "productArchetypes": ["health-fitness", "fitness-tracking", "nutrition-tracker"],
      "interactionArchetypes": ["dashboard", "status-overview", "data-visualization"],
      "compositions": ["bento-grid", "modular-vertical", "asymmetric"],
      "materials": ["matte", "flat-layered"],
      "geometries": ["rounded", "pill-shaped", "circular-gauges"],
      "navigation": ["bottom-pill-dock", "segmented-control"],
      "density": "balanced",
      "assetBias": "mixed",
      "colorCharacter": ["clean-base", "neon-accent", "monochromatic-neutral"],
      "typographyCharacter": ["geometric-sans", "functional-ui-sans"],
      "moods": ["clean", "precise", "focused", "organized"],
      "incompatibleWith": ["dark", "glassmorphism", "tactile-depth", "heavy-shadows", "skeuomorphic", "editorial-flow"]
    }
  },
  {
    "id": "crypto-trading-precision-dark",
    "imageUrl": "https://pub-7c8c3c7444724a39ba3eeb8accbbca4a.r2.dev/curated-library/crypto-trading-precision-dark.jpeg",
    "styleIntent": "High-density dark-mode crypto trading dashboard focusing on financial precision, featuring complex candlestick and volume charts with bright green and red data states, muted grid lines, and stacked token pair modules.",
    "selectionProfile": {
      "theme": "dark",
      "productArchetypes": ["crypto-web3", "analytics-operations", "investment-tracking"],
      "interactionArchetypes": ["dashboard", "data-visualization", "monitoring"],
      "compositions": ["modular-vertical", "stacked-lists", "dashboard-grid"],
      "materials": ["matte", "flat-layered"],
      "geometries": ["rounded", "pill-shaped"],
      "navigation": ["bottom-pill-dock", "segmented-control"],
      "density": "dense",
      "assetBias": "data-viz",
      "colorCharacter": ["deep-black-base", "status-indicator-colors", "monochromatic-neutral"],
      "typographyCharacter": ["functional-ui-sans", "numeric-heavy"],
      "moods": ["precise", "analytical", "focused", "premium"],
      "incompatibleWith": ["light", "playful", "airy", "skeuomorphic", "glassmorphism", "illustration-heavy"]
    }
  },
  {
    "id": "photo-gallery-collection-light",
    "imageUrl": "https://pub-7c8c3c7444724a39ba3eeb8accbbca4a.r2.dev/curated-library/photo-gallery-collection-light.jpg",
    "styleIntent": "Minimalist, light-mode media sharing and photo gallery interface utilizing stacked card layers, frosted glass dynamic category blurs, high-contrast primary call-to-actions, and clean typographic spacing for a premium social-memory sharing experience.",
    "selectionProfile": {
      "theme": "light",
      "productArchetypes": ["social-networking", "media-entertainment", "personal-organizer"],
      "interactionArchetypes": ["content-discovery", "onboarding", "list-view"],
      "compositions": ["stacked-cards", "clean-spatial", "hero-header"],
      "materials": ["glassmorphism", "matte", "flat-layered"],
      "geometries": ["rounded", "pill-shaped"],
      "navigation": ["bottom-pill-dock", "prominent-fab"],
      "density": "airy",
      "assetBias": "photo-heavy",
      "colorCharacter": ["clean-base", "brand-accent", "restrained-neutral"],
      "typographyCharacter": ["geometric-sans"],
      "moods": ["clean", "premium", "approachable", "sophisticated"],
      "incompatibleWith": ["dark", "neon-accent", "tactile-depth", "bento-grid", "data-dense-dashboard", "clinical", "trading-precision"]
    }
  },
  {
    "id": "construction-management-bento-light",
    "imageUrl": "https://pub-7c8c3c7444724a39ba3eeb8accbbca4a.r2.dev/curated-library/construction-management-bento-light.jpg",
    "styleIntent": "Clean, light-mode operations dashboard for industrial and construction management, utilizing a soft orange accent identity, structural bento modules, timeline status progress trackers, and highly scannable analytical charts inside frosted glass container layouts.",
    "selectionProfile": {
      "theme": "light",
      "productArchetypes": ["monitoring-operations", "productivity-task", "analytics-operations"],
      "interactionArchetypes": ["dashboard", "status-overview", "data-visualization"],
      "compositions": ["bento-grid", "modular-vertical", "timeline-view"],
      "materials": ["matte", "glassmorphism", "flat-layered"],
      "geometries": ["rounded", "pill-shaped"],
      "navigation": ["bottom-pill-dock", "segmented-control"],
      "density": "balanced",
      "assetBias": "data-viz",
      "colorCharacter": ["clean-base", "brand-accent", "status-indicator-colors"],
      "typographyCharacter": ["geometric-sans", "functional-ui-sans"],
      "moods": ["precise", "organized", "clean", "premium"],
      "incompatibleWith": ["dark", "neon-accent", "tactile-depth", "skeuomorphic", "gaming-platform", "illustration-heavy"]
    }
  },
  {
    "id": "crypto-wallet-transaction-light",
    "imageUrl": "https://pub-7c8c3c7444724a39ba3eeb8accbbca4a.r2.dev/curated-library/crypto-wallet-transaction-light.jpg",
    "styleIntent": "Approachable light-mode Web3 transaction interface featuring clean spatial card stacking, a vibrant custom interactive slider for gas speed optimization, soft illustrative branding elements, and high-contrast primary confirmation bars.",
    "selectionProfile": {
      "theme": "light",
      "productArchetypes": ["crypto-web3", "finance-banking", "utility"],
      "interactionArchetypes": ["control-panel", "transaction-history", "status-overview"],
      "compositions": ["stacked-cards", "clean-spatial", "modular-vertical"],
      "materials": ["matte", "flat-layered"],
      "geometries": ["rounded", "pill-shaped"],
      "navigation": ["bottom-pill-dock", "top-context-bar"],
      "density": "balanced",
      "assetBias": "mixed",
      "colorCharacter": ["clean-base", "vibrant-gradient", "monochromatic-neutral"],
      "typographyCharacter": ["geometric-sans", "numeric-heavy"],
      "moods": ["clean", "approachable", "precise", "trustworthy"],
      "incompatibleWith": ["dark", "neon-accent", "tactile-depth", "glassmorphism", "bento-grid", "data-dense-dashboard", "skeuomorphic"]
    }
  },
  {
    "id": "rideshare-carpool-tracker-light",
    "imageUrl": "https://pub-7c8c3c7444724a39ba3eeb8accbbca4a.r2.dev/curated-library/rideshare-carpool-tracker-light.jpg",
    "styleIntent": "Clean, light-mode carpooling and rideshare tracking interface featuring a minimal linear timeline route indicator, soft ambient green glow containers for pricing context, high-contrast primary call-to-actions, and precise typographic structure.",
    "selectionProfile": {
      "theme": "light",
      "productArchetypes": ["travel-operations", "utility", "mobility-logistics"],
      "interactionArchetypes": ["status-overview", "monitoring", "control-panel"],
      "compositions": ["timeline-view", "modular-vertical", "clean-spatial"],
      "materials": ["matte", "flat-layered", "atmospheric-blur"],
      "geometries": ["rounded", "pill-shaped"],
      "navigation": ["bottom-pill-dock", "top-context-bar"],
      "density": "balanced",
      "assetBias": "typographic",
      "colorCharacter": ["clean-base", "monochromatic-neutral", "pastel-accent"],
      "typographyCharacter": ["geometric-sans", "functional-ui-sans"],
      "moods": ["clean", "precise", "approachable", "organized"],
      "incompatibleWith": ["dark", "neon-accent", "tactile-depth", "glassmorphism", "bento-grid", "data-dense-dashboard", "skeuomorphic"]
    }
  },
  {
    "id": "edtech-homework-community-light",
    "imageUrl": "https://pub-7c8c3c7444724a39ba3eeb8accbbca4a.r2.dev/curated-library/edtech-homework-community-light.jpg",
    "styleIntent": "Playful yet structured light-mode educational helper interface blending a soft pastel palette of lavenders, sage greens, and warm yellows with clean, distinct outline geometries, high-contrast typography, and explicit micro-interaction pill controls.",
    "selectionProfile": {
      "theme": "light",
      "productArchetypes": ["education-learning", "social-networking", "utility"],
      "interactionArchetypes": ["onboarding", "content-discovery", "search-results"],
      "compositions": ["stacked-lists", "modular-vertical", "asymmetric-split"],
      "materials": ["matte", "flat-layered"],
      "geometries": ["rounded", "pill-shaped", "bordered-containers"],
      "navigation": ["bottom-pill-dock", "segmented-control"],
      "density": "balanced",
      "assetBias": "typographic",
      "colorCharacter": ["pastel-base", "playful-accent", "monochromatic-neutral"],
      "typographyCharacter": ["playful-sans", "geometric-sans"],
      "moods": ["friendly", "organized", "approachable", "clean"],
      "incompatibleWith": ["dark", "neon-accent", "tactile-depth", "glassmorphism", "finance-banking", "data-dense-dashboard"]
    }
  },
  {
    "id": "prop-trading-dashboard-dark",
    "imageUrl": "https://pub-7c8c3c7444724a39ba3eeb8accbbca4a.r2.dev/curated-library/prop-trading-dashboard-dark.png",
    "styleIntent": "Data-dense dark-mode prop trading dashboard combining analytical precision with performance metrics, featuring custom circular trade distribution gauges, color-coded P&L status markers, and structured task lists on an ultra-dark background.",
    "selectionProfile": {
      "theme": "dark",
      "productArchetypes": ["investment-tracking", "analytics-operations", "finance-banking"],
      "interactionArchetypes": ["dashboard", "data-visualization", "status-overview"],
      "compositions": ["modular-vertical", "dashboard-grid", "stacked-lists"],
      "materials": ["matte", "flat-layered"],
      "geometries": ["rounded", "pill-shaped", "circular-gauges"],
      "navigation": ["bottom-tab-bar", "prominent-fab"],
      "density": "dense",
      "assetBias": "data-viz",
      "colorCharacter": ["deep-black-base", "status-indicator-colors", "gold-accent"],
      "typographyCharacter": ["functional-ui-sans", "numeric-heavy"],
      "moods": ["precise", "analytical", "focused", "serious"],
      "incompatibleWith": ["light", "playful", "airy", "skeuomorphic", "glassmorphism", "illustration-heavy"]
    }
  },
  {
    "id": "health-wellness-bento-light",
    "imageUrl": "https://pub-7c8c3c7444724a39ba3eeb8accbbca4a.r2.dev/curated-library/health-wellness-bento-light.jpg",
    "styleIntent": "Clean and vibrant light-mode health tracker employing a pastel-colored bento grid configuration, clean tracking line graphs, high-contrast numeric metric callouts, and smooth rounded card containers for balanced day-to-day wellness monitoring.",
    "selectionProfile": {
      "theme": "light",
      "productArchetypes": ["health-fitness", "fitness-tracking", "personal-organizer"],
      "interactionArchetypes": ["dashboard", "status-overview", "data-visualization"],
      "compositions": ["bento-grid", "modular-vertical", "asymmetric-split"],
      "materials": ["matte", "flat-layered"],
      "geometries": ["rounded", "pill-shaped", "circular-gauges"],
      "navigation": ["bottom-pill-dock", "segmented-control"],
      "density": "balanced",
      "assetBias": "mixed",
      "colorCharacter": ["pastel-base", "playful-accent", "clean-base"],
      "typographyCharacter": ["geometric-sans", "functional-ui-sans"],
      "moods": ["clean", "cheerful", "organized", "approachable"],
      "incompatibleWith": ["dark", "neon-accent", "tactile-depth", "glassmorphism", "skeuomorphic", "heavy-shadows", "clinical"]
    }
  },
  {
    "id": "logistics-tracking-stark-light",
    "imageUrl": "https://pub-7c8c3c7444724a39ba3eeb8accbbca4a.r2.dev/curated-library/logistics-tracking-stark-light.jpg",
    "styleIntent": "High-contrast light-mode logistics and shipping dashboard combining bold black primary modules with clean line timelines, soft blue background status fills, and explicit data layout grids for immediate delivery tracking clarity.",
    "selectionProfile": {
      "theme": "light",
      "productArchetypes": ["mobility-logistics", "travel-operations", "utility"],
      "interactionArchetypes": ["status-overview", "monitoring", "list-view"],
      "compositions": ["stacked-cards", "timeline-view", "modular-vertical"],
      "materials": ["matte", "flat-layered"],
      "geometries": ["rounded", "pill-shaped"],
      "navigation": ["bottom-pill-dock", "top-context-bar"],
      "density": "balanced",
      "assetBias": "typographic",
      "colorCharacter": ["high-contrast-black", "clean-base", "monochromatic-neutral"],
      "typographyCharacter": ["geometric-sans", "functional-ui-sans"],
      "moods": ["clean", "precise", "organized", "trustworthy"],
      "incompatibleWith": ["dark", "neon-accent", "tactile-depth", "glassmorphism", "bento-grid", "playful", "illustration-heavy"]
    }
  },
  {
    "id": "fintech-neo-brutalism-split",
    "imageUrl": "https://pub-7c8c3c7444724a39ba3eeb8accbbca4a.r2.dev/curated-library/fintech-neo-brutalism-split.png",
    "styleIntent": "Vibrant mixed-theme financial interface blending light and dark modes with a soft neo-brutalist aesthetic, featuring high-contrast solid emerald-green and coral modules, clean geometric ring progress charts, and stylized pattern-filled progress meters.",
    "selectionProfile": {
      "theme": "mixed",
      "productArchetypes": ["finance-banking", "investment-tracking", "personal-organizer"],
      "interactionArchetypes": ["dashboard", "data-visualization", "status-overview"],
      "compositions": ["asymmetric-split", "modular-vertical", "calendar-grid"],
      "materials": ["flat-layered", "matte", "pattern-fills"],
      "geometries": ["rounded", "pill-shaped", "circular-gauges"],
      "navigation": ["top-context-bar", "segmented-control"],
      "density": "balanced",
      "assetBias": "typographic",
      "colorCharacter": ["vibrant-accent", "high-contrast-black", "clean-base"],
      "typographyCharacter": ["geometric-sans", "numeric-heavy"],
      "moods": ["bold", "organized", "clean", "premium"],
      "incompatibleWith": ["glassmorphism", "tactile-depth", "skeuomorphic", "heavy-shadows", "clinical", "atmospheric-gradient"]
    }
  },
  {
    "id": "edtech-analytics-neon-dark",
    "imageUrl": "https://pub-7c8c3c7444724a39ba3eeb8accbbca4a.r2.dev/curated-library/edtech-analytics-neon-dark.jpg",
    "styleIntent": "Gamified dark-mode e-learning and performance analytics interface prioritizing deep charcoal canvases, vibrant neo-pastel yellow and pink accents, custom vertical leaderboard bars, and a structured habit-tracking contribution calendar.",
    "selectionProfile": {
      "theme": "dark",
      "productArchetypes": ["education-learning", "analytics-operations", "gamified-platform"],
      "interactionArchetypes": ["dashboard", "data-visualization", "achievement-tracking"],
      "compositions": ["modular-vertical", "calendar-grid", "asymmetric-split"],
      "materials": ["matte", "flat-layered"],
      "geometries": ["rounded", "pill-shaped"],
      "navigation": ["bottom-pill-dock", "top-context-bar"],
      "density": "balanced",
      "assetBias": "mixed",
      "colorCharacter": ["deep-black-base", "neon-accent", "pastel-accent"],
      "typographyCharacter": ["geometric-sans", "functional-ui-sans"],
      "moods": ["focused", "precise", "engaging", "premium"],
      "incompatibleWith": ["light", "airy", "glassmorphism", "skeuomorphic", "heavy-shadows", "finance-banking", "commerce-operations"]
    }
  },
  {
    "id": "fitness-tracker-bento-dark",
    "imageUrl": "https://pub-7c8c3c7444724a39ba3eeb8accbbca4a.r2.dev/curated-library/fitness-tracker-bento-dark.jpg",
    "styleIntent": "Premium dark-mode fitness tracking dashboard utilizing an organized bento grid layout with high-contrast pastel accent cards, smooth circular progress indicators, and custom vertical macro pills over a deep charcoal canvas.",
    "selectionProfile": {
      "theme": "dark",
      "productArchetypes": ["health-fitness", "fitness-tracking", "nutrition-tracker"],
      "interactionArchetypes": ["dashboard", "status-overview", "data-visualization"],
      "compositions": ["bento-grid", "modular-vertical", "stacked-rows"],
      "materials": ["matte", "flat-layered"],
      "geometries": ["rounded", "pill-shaped", "circular-gauges"],
      "navigation": ["top-context-bar", "segmented-control"],
      "density": "balanced",
      "assetBias": "mixed",
      "colorCharacter": ["deep-black-base", "pastel-accent", "monochromatic-neutral"],
      "typographyCharacter": ["geometric-sans", "functional-ui-sans"],
      "moods": ["clean", "focused", "organized", "premium"],
      "incompatibleWith": ["light", "airy", "glassmorphism", "tactile-depth", "skeuomorphic", "heavy-shadows", "editorial-flow"]
    }
  },
  {
    "id": "ai-developer-workspace-dark",
    "imageUrl": "https://pub-7c8c3c7444724a39ba3eeb8accbbca4a.r2.dev/curated-library/ai-developer-workspace-dark.jpg",
    "styleIntent": "Technical, dark-mode AI code generation and workspace environment utilizing deep charcoal layers, colorful code syntax highlighting, flat-layered chat panels, and inline multi-colored utility prompt tags.",
    "selectionProfile": {
      "theme": "dark",
      "productArchetypes": ["developer-tools", "productivity-task", "analytics-operations"],
      "interactionArchetypes": ["conversational-agent", "control-panel", "list-view"],
      "compositions": ["modular-vertical", "stacked-lists", "chat-interface"],
      "materials": ["matte", "flat-layered"],
      "geometries": ["rounded", "pill-shaped"],
      "navigation": ["bottom-pill-dock", "segmented-control"],
      "density": "balanced",
      "assetBias": "typographic",
      "colorCharacter": ["deep-black-base", "monochromatic-neutral", "syntax-highlight-accents"],
      "typographyCharacter": ["monospace-code", "geometric-sans"],
      "moods": ["precise", "focused", "technical", "premium"],
      "incompatibleWith": ["light", "playful", "airy", "skeuomorphic", "glassmorphism", "bento-grid", "finance-banking"]
    }
  },
  {
    "id": "calorie-counter-bento-light",
    "imageUrl": "https://pub-7c8c3c7444724a39ba3eeb8accbbca4a.r2.dev/curated-library/calorie-counter-bento-light.jpg",
    "styleIntent": "Clean, airy light-mode nutrition tracking interface configured with asymmetric bento cards, incorporating bright pastel blue, green, and yellow status containers, minimal circular completion gauges, and highly scannable vertical data pills.",
    "selectionProfile": {
      "theme": "light",
      "productArchetypes": ["health-fitness", "nutrition-tracker", "personal-organizer"],
      "interactionArchetypes": ["dashboard", "status-overview", "data-visualization"],
      "compositions": ["bento-grid", "modular-vertical", "calendar-strip"],
      "materials": ["matte", "flat-layered"],
      "geometries": ["rounded", "pill-shaped", "circular-gauges"],
      "navigation": ["bottom-pill-dock", "segmented-control"],
      "density": "balanced",
      "assetBias": "mixed",
      "colorCharacter": ["clean-base", "pastel-base", "monochromatic-neutral"],
      "typographyCharacter": ["geometric-sans", "functional-ui-sans"],
      "moods": ["clean", "approachable", "organized", "focused"],
      "incompatibleWith": ["dark", "neon-accent", "glassmorphism", "tactile-depth", "heavy-shadows", "skeuomorphic", "clinical"]
    }
  },
  {
    "id": "profile-gamified-sleep-light",
    "imageUrl": "https://pub-7c8c3c7444724a39ba3eeb8accbbca4a.r2.dev/curated-library/profile-gamified-sleep-light.jpg",
    "styleIntent": "Clean, structured light-mode user profile dashboard that balances biometrics and gamification, featuring a multi-colored block timeline for sleep phase distribution, swipe-to-action list components, and clean rank badge systems.",
    "selectionProfile": {
      "theme": "light",
      "productArchetypes": ["health-fitness", "social-networking", "gamified-platform"],
      "interactionArchetypes": ["dashboard", "list-management", "status-overview"],
      "compositions": ["stacked-lists", "modular-vertical", "clean-spatial"],
      "materials": ["matte", "flat-layered"],
      "geometries": ["rounded", "pill-shaped"],
      "navigation": ["segmented-control", "top-context-bar"],
      "density": "balanced",
      "assetBias": "mixed",
      "colorCharacter": ["clean-base", "monochromatic-neutral", "vibrant-accent"],
      "typographyCharacter": ["geometric-sans", "functional-ui-sans"],
      "moods": ["clean", "organized", "approachable", "focused"],
      "incompatibleWith": ["dark", "neon-accent", "glassmorphism", "tactile-depth", "heavy-shadows", "skeuomorphic", "data-dense-dashboard"]
    }
  },
  {
    "id": "gamified-habit-tracker-light",
    "imageUrl": "https://pub-7c8c3c7444724a39ba3eeb8accbbca4a.r2.dev/curated-library/gamified-habit-tracker-light.jpg",
    "styleIntent": "Ultra-clean, minimalist light-mode routine and habit tracking interface leveraging concentric colored progress rings, playful reward badge overlays with festive confetti elements, crisp list check-offs, and micro-timer modules.",
    "selectionProfile": {
      "theme": "light",
      "productArchetypes": ["personal-organizer", "health-fitness", "gamified-platform"],
      "interactionArchetypes": ["dashboard", "list-management", "achievement-tracking"],
      "compositions": ["clean-spatial", "modular-vertical", "stacked-lists"],
      "materials": ["matte", "flat-layered"],
      "geometries": ["rounded", "pill-shaped", "circular-gauges"],
      "navigation": ["bottom-pill-dock", "prominent-fab"],
      "density": "airy",
      "assetBias": "mixed",
      "colorCharacter": ["clean-base", "monochromatic-neutral", "vibrant-accent"],
      "typographyCharacter": ["geometric-sans", "functional-ui-sans"],
      "moods": ["clean", "approachable", "cheerful", "organized"],
      "incompatibleWith": ["dark", "neon-accent", "glassmorphism", "tactile-depth", "heavy-shadows", "skeuomorphic", "data-dense-dashboard"]
    }
  },
  {
    "id": "cardiology-health-tracker-light",
    "imageUrl": "https://pub-7c8c3c7444724a39ba3eeb8accbbca4a.r2.dev/curated-library/cardiology-health-tracker-light.jpg",
    "styleIntent": "Clean and clinical light-mode health interface focusing on cardiology diagnostics and hardware pairing, using asymmetrical bento configurations, soft pastel blue, green, and yellow containers, interactive ECG waveform panels, and high-contrast typographic labels.",
    "selectionProfile": {
      "theme": "light",
      "productArchetypes": ["health-medical", "fitness-tracking", "monitoring-operations"],
      "interactionArchetypes": ["dashboard", "data-visualization", "control-panel"],
      "compositions": ["bento-grid", "modular-vertical", "asymmetric-split"],
      "materials": ["matte", "flat-layered"],
      "geometries": ["rounded", "pill-shaped"],
      "navigation": ["bottom-pill-dock", "top-context-bar"],
      "density": "balanced",
      "assetBias": "mixed",
      "colorCharacter": ["clean-base", "pastel-base", "monochromatic-neutral"],
      "typographyCharacter": ["geometric-sans", "functional-ui-sans"],
      "moods": ["clinical", "precise", "organized", "trustworthy"],
      "incompatibleWith": ["dark", "neon-accent", "glassmorphism", "tactile-depth", "heavy-shadows", "skeuomorphic", "playful"]
    }
  },
  {
    "id": "food-delivery-bento-light",
    "imageUrl": "https://pub-7c8c3c7444724a39ba3eeb8accbbca4a.r2.dev/curated-library/food-delivery-bento-light.jpg",
    "styleIntent": "Vibrant and clean light-mode food delivery interface featuring a soft pastel green and blue color palette, structured bento-style card blocks, prominent high-quality food product renders, and high-contrast primary call-to-actions.",
    "selectionProfile": {
      "theme": "light",
      "productArchetypes": ["commerce-operations", "mobility-logistics", "utility"],
      "interactionArchetypes": ["content-discovery", "product-detail", "status-overview"],
      "compositions": ["bento-grid", "modular-vertical", "stacked-lists"],
      "materials": ["matte", "flat-layered"],
      "geometries": ["rounded", "pill-shaped"],
      "navigation": ["bottom-pill-dock", "top-context-bar"],
      "density": "balanced",
      "assetBias": "photo-heavy",
      "colorCharacter": ["clean-base", "pastel-base", "monochromatic-neutral"],
      "typographyCharacter": ["geometric-sans", "functional-ui-sans"],
      "moods": ["approachable", "cheerful", "clean", "organized"],
      "incompatibleWith": ["dark", "neon-accent", "tactile-depth", "glassmorphism", "clinical", "trading-precision"]
    }
  },
  {
    "id": "smart-home-iot-dark",
    "imageUrl": "https://pub-7c8c3c7444724a39ba3eeb8accbbca4a.r2.dev/curated-library/smart-home-iot-dark.jpg",
    "styleIntent": "Sleek and atmospheric dark-mode smart home control panel, featuring translucent blurred glass overlays, neon violet and deep blue status highlights, rounded asymmetric bento container layout blocks, and precise circular dimming dials.",
    "selectionProfile": {
      "theme": "dark",
      "productArchetypes": ["iot-smart-devices", "utility", "productivity-task"],
      "interactionArchetypes": ["control-panel", "dashboard", "status-overview"],
      "compositions": ["bento-grid", "modular-vertical", "asymmetric"],
      "materials": ["glassmorphism", "matte", "flat-layered"],
      "geometries": ["rounded", "pill-shaped", "circular-gauges"],
      "navigation": ["bottom-pill-dock", "segmented-control"],
      "density": "balanced",
      "assetBias": "mixed",
      "colorCharacter": ["deep-black-base", "vibrant-accent", "monochromatic-neutral"],
      "typographyCharacter": ["geometric-sans", "functional-ui-sans"],
      "moods": ["precise", "focused", "premium", "organized"],
      "incompatibleWith": ["light", "playful", "airy", "skeuomorphic", "heavy-shadows", "clinical", "trading-precision"]
    }
  },
  {
    "id": "food-delivery-commerce-dark",
    "imageUrl": "https://pub-7c8c3c7444724a39ba3eeb8accbbca4a.r2.dev/curated-library/food-delivery-commerce-dark.jpg",
    "styleIntent": "Atmospheric, dark-mode food ordering and e-commerce application utilizing a rich warm orange brand identity, high-contrast product staging photography, structured product cards, and prominent primary buy actions.",
    "selectionProfile": {
      "theme": "dark",
      "productArchetypes": ["commerce-operations", "mobility-logistics", "utility"],
      "interactionArchetypes": ["content-discovery", "product-detail", "onboarding"],
      "compositions": ["bento-grid", "modular-vertical", "stacked-lists"],
      "materials": ["matte", "flat-layered"],
      "geometries": ["rounded", "pill-shaped"],
      "navigation": ["bottom-tab-bar", "top-context-bar"],
      "density": "balanced",
      "assetBias": "photo-heavy",
      "colorCharacter": ["deep-black-base", "vibrant-accent", "monochromatic-neutral"],
      "typographyCharacter": ["geometric-sans", "functional-ui-sans"],
      "moods": ["premium", "approachable", "focused", "organized"],
      "incompatibleWith": ["light", "pastel-base", "glassmorphism", "tactile-depth", "skeuomorphic", "clinical", "trading-precision"]
    }
  },
  {
    "id": "bakery-commerce-premium-dark",
    "imageUrl": "https://pub-7c8c3c7444724a39ba3eeb8accbbca4a.r2.dev/curated-library/bakery-commerce-premium-dark.jpg",
    "styleIntent": "Sophisticated, premium dark-mode bakery e-commerce interface using a deep charcoal canvas paired with rich warm copper and orange typographic accents, immersive macro food staging hero photography, and an editorial product customization layer.",
    "selectionProfile": {
      "theme": "dark",
      "productArchetypes": ["commerce-operations", "media-entertainment"],
      "interactionArchetypes": ["content-discovery", "product-detail"],
      "compositions": ["asymmetric-split", "modular-vertical", "stacked-lists"],
      "materials": ["matte", "flat-layered"],
      "geometries": ["rounded", "pill-shaped"],
      "navigation": ["bottom-tab-bar", "top-context-bar"],
      "density": "balanced",
      "assetBias": "photo-heavy",
      "colorCharacter": ["deep-black-base", "vibrant-accent", "monochromatic-neutral"],
      "typographyCharacter": ["geometric-sans", "functional-ui-sans"],
      "moods": ["premium", "sophisticated", "clean", "focused"],
      "incompatibleWith": ["light", "pastel-base", "glassmorphism", "neon-accent", "tactile-depth", "bento-grid", "clinical", "data-dense-dashboard"]
    }
  },
  {
    "id": "team-collaboration-chat-light",
    "imageUrl": "https://pub-7c8c3c7444724a39ba3eeb8accbbca4a.r2.dev/curated-library/team-collaboration-chat-light.jpg",
    "styleIntent": "Clean, light-mode enterprise communication and productivity application featuring a workspace organization matrix, clean spatial chat bubbles with threaded replies, clear status indicator badges, and soft micro-bordered bento modules for inline task and document management.",
    "selectionProfile": {
      "theme": "light",
      "productArchetypes": ["social-networking", "productivity-task", "utility"],
      "interactionArchetypes": ["conversational-agent", "dashboard", "list-view"],
      "compositions": ["chat-interface", "stacked-lists", "modular-vertical"],
      "materials": ["matte", "flat-layered"],
      "geometries": ["rounded", "pill-shaped", "bordered-containers"],
      "navigation": ["bottom-pill-dock", "segmented-control"],
      "density": "balanced",
      "assetBias": "mixed",
      "colorCharacter": ["clean-base", "monochromatic-neutral", "pastel-accent"],
      "typographyCharacter": ["geometric-sans", "functional-ui-sans"],
      "moods": ["organized", "clean", "precise", "approachable"],
      "incompatibleWith": ["dark", "neon-accent", "glassmorphism", "tactile-depth", "skeuomorphic", "heavy-shadows", "finance-banking"]
    }
  },
  {
    "id": "gamified-language-learning-light",
    "imageUrl": "https://pub-7c8c3c7444724a39ba3eeb8accbbca4a.r2.dev/curated-library/gamified-language-learning-light.png",
    "styleIntent": "Highly approachable, vibrant light-mode language learning platform emphasizing gamified progression maps, playful character illustrations, high-contrast flat interactive choice cards, and motivational milestone tracking metrics.",
    "selectionProfile": {
      "theme": "light",
      "productArchetypes": ["education-learning", "gamified-platform", "social-networking"],
      "interactionArchetypes": ["achievement-tracking", "onboarding", "content-discovery"],
      "compositions": ["linear-timeline-path", "grid-layout", "stacked-lists"],
      "materials": ["matte", "flat-layered"],
      "geometries": ["rounded", "pill-shaped", "circular-nodes"],
      "navigation": ["bottom-pill-dock", "top-context-bar"],
      "density": "airy",
      "assetBias": "illustration-heavy",
      "colorCharacter": ["clean-base", "vibrant-accent", "playful-accent"],
      "typographyCharacter": ["playful-sans", "geometric-sans"],
      "moods": ["cheerful", "friendly", "engaging", "approachable"],
      "incompatibleWith": ["dark", "neon-accent", "glassmorphism", "tactile-depth", "heavy-shadows", "skeuomorphic", "data-dense-dashboard", "finance-banking"]
    }
  },
  {
    "id": "apparel-ecommerce-sky-light",
    "imageUrl": "https://pub-7c8c3c7444724a39ba3eeb8accbbca4a.r2.dev/curated-library/apparel-ecommerce-sky-light.jpg",
    "styleIntent": "Clean and airy light-mode e-commerce interface using a soft sky-blue ambient top gradient background, organized product grid cards, rounded category filter capsules, and a high-contrast dark primary checkout button.",
    "selectionProfile": {
      "theme": "light",
      "productArchetypes": ["commerce-operations", "utility"],
      "interactionArchetypes": ["content-discovery", "list-management", "shopping-cart"],
      "compositions": ["grid-layout", "stacked-lists", "modular-vertical"],
      "materials": ["matte", "atmospheric-gradient", "flat-layered"],
      "geometries": ["rounded", "pill-shaped"],
      "navigation": ["bottom-pill-dock", "top-context-bar"],
      "density": "balanced",
      "assetBias": "photo-heavy",
      "colorCharacter": ["clean-base", "pastel-base", "monochromatic-neutral"],
      "typographyCharacter": ["geometric-sans", "functional-ui-sans"],
      "moods": ["clean", "approachable", "organized"],
      "incompatibleWith": ["dark", "neon-accent", "glassmorphism", "tactile-depth", "heavy-shadows", "skeuomorphic", "data-dense-dashboard"]
    }
  },
  {
    "id": "cosmetics-ecommerce-minimal-light",
    "imageUrl": "https://pub-7c8c3c7444724a39ba3eeb8accbbca4a.r2.dev/curated-library/cosmetics-ecommerce-minimal-light.jpg",
    "styleIntent": "Minimalist and high-end light-mode cosmetics e-commerce interface using a clean white base, fluid dynamic product staging imagery with splashing milk effects, clean vertical product cards, soft pill filter tags, and high-contrast black call-to-action details.",
    "selectionProfile": {
      "theme": "light",
      "productArchetypes": ["commerce-operations", "utility"],
      "interactionArchetypes": ["product-detail", "content-discovery", "shopping-cart"],
      "compositions": ["asymmetric-split", "modular-vertical", "stacked-lists"],
      "materials": ["matte", "flat-layered"],
      "geometries": ["rounded", "pill-shaped"],
      "navigation": ["bottom-pill-dock", "top-context-bar"],
      "density": "balanced",
      "assetBias": "photo-heavy",
      "colorCharacter": ["clean-base", "monochromatic-neutral", "high-contrast-black"],
      "typographyCharacter": ["geometric-sans", "functional-ui-sans"],
      "moods": ["premium", "clean", "sophisticated", "organized"],
      "incompatibleWith": ["dark", "neon-accent", "glassmorphism", "tactile-depth", "heavy-shadows", "skeuomorphic", "data-dense-dashboard"]
    }
  },
  {
    "id": "ai-cookbook-recipes-light",
    "imageUrl": "https://pub-7c8c3c7444724a39ba3eeb8accbbca4a.r2.dev/curated-library/ai-cookbook-recipes-light.png",
    "styleIntent": "Minimalist and airy light-mode AI culinary assistant featuring precise typographic layouts, standalone flat sticker-style ingredient assets, clean card borders, a unified inline prompt bar, and structured vertical milestone cooking timelines.",
    "selectionProfile": {
      "theme": "light",
      "productArchetypes": ["personal-organizer", "education-learning", "utility"],
      "interactionArchetypes": ["conversational-agent", "dashboard", "list-view"],
      "compositions": ["clean-spatial", "modular-vertical", "stacked-lists"],
      "materials": ["matte", "flat-layered"],
      "geometries": ["rounded", "pill-shaped"],
      "navigation": ["top-context-bar", "segmented-control"],
      "density": "airy",
      "assetBias": "mixed",
      "colorCharacter": ["clean-base", "monochromatic-neutral", "vibrant-accent"],
      "typographyCharacter": ["geometric-sans", "functional-ui-sans"],
      "moods": ["clean", "approachable", "organized", "friendly"],
      "incompatibleWith": ["dark", "neon-accent", "glassmorphism", "tactile-depth", "heavy-shadows", "skeuomorphic", "data-dense-dashboard", "finance-banking"]
    }
  },
  {
    "id": "longevity-health-tracker-light",
    "imageUrl": "https://pub-7c8c3c7444724a39ba3eeb8accbbca4a.r2.dev/curated-library/longevity-health-tracker-light.jpg",
    "styleIntent": "Clean, tech-forward light-mode health and longevity tracking interface leveraging high-contrast vibrant blue accents, soft depth-layered card containers, fluid organic data visualization shapes, and distinct typographic metric focus.",
    "selectionProfile": {
      "theme": "light",
      "productArchetypes": ["health-fitness", "fitness-tracking", "analytics-operations"],
      "interactionArchetypes": ["dashboard", "data-visualization", "onboarding"],
      "compositions": ["modular-vertical", "clean-spatial", "stacked-cards"],
      "materials": ["matte", "flat-layered"],
      "geometries": ["rounded", "pill-shaped", "custom-organic-shapes"],
      "navigation": ["segmented-control", "top-context-bar"],
      "density": "balanced",
      "assetBias": "mixed",
      "colorCharacter": ["clean-base", "vibrant-accent", "monochromatic-neutral"],
      "typographyCharacter": ["geometric-sans", "functional-ui-sans"],
      "moods": ["clean", "focused", "precise", "modern"],
      "incompatibleWith": ["dark", "neon-accent", "glassmorphism", "tactile-depth", "heavy-shadows", "skeuomorphic", "bento-grid"]
    }
  },
  {
    "id": "neura-smart-glasses-light",
    "imageUrl": "https://pub-7c8c3c7444724a39ba3eeb8accbbca4a.r2.dev/curated-library/neura-smart-glasses-light.jpg",
    "styleIntent": "Technical and ultra-clean hardware interface utilizing a monochromatic light gray base, high-fidelity 3D product renders, spatial radar data visualization dials, clean technical line charts, and stark black interactive anchors.",
    "selectionProfile": {
      "theme": "light",
      "productArchetypes": ["iot-smart-devices", "utility", "monitoring-operations"],
      "interactionArchetypes": ["control-panel", "dashboard", "onboarding"],
      "compositions": ["modular-vertical", "clean-spatial", "stacked-cards"],
      "materials": ["matte", "flat-layered"],
      "geometries": ["rounded", "pill-shaped", "circular-gauges"],
      "navigation": ["bottom-pill-dock", "top-context-bar"],
      "density": "balanced",
      "assetBias": "mixed",
      "colorCharacter": ["clean-base", "monochromatic-neutral", "high-contrast-black"],
      "typographyCharacter": ["geometric-sans", "functional-ui-sans"],
      "moods": ["precise", "technical", "clean", "premium"],
      "incompatibleWith": ["dark", "neon-accent", "glassmorphism", "tactile-depth", "heavy-shadows", "skeuomorphic", "playful", "bento-grid"]
    }
  },
  {
    "id": "mindfulness-meditation-beige-light",
    "imageUrl": "https://pub-7c8c3c7444724a39ba3eeb8accbbca4a.r2.dev/curated-library/mindfulness-meditation-beige-light.jpg",
    "styleIntent": "Warm and serene light-mode health and mental wellness interface utilizing a soft cream and beige background palette, friendly custom character illustrations, rounded modular content cards, expressive mood tracking emojis, and organic multi-colored donut progress charts.",
    "selectionProfile": {
      "theme": "light",
      "productArchetypes": ["health-fitness", "personal-organizer", "gamified-platform"],
      "interactionArchetypes": ["dashboard", "status-overview", "data-visualization"],
      "compositions": ["bento-grid", "modular-vertical", "clean-spatial"],
      "materials": ["matte", "flat-layered"],
      "geometries": ["rounded", "pill-shaped", "circular-gauges"],
      "navigation": ["bottom-pill-dock", "segmented-control"],
      "density": "balanced",
      "assetBias": "illustration-heavy",
      "colorCharacter": ["clean-base", "pastel-base", "vibrant-accent"],
      "typographyCharacter": ["geometric-sans", "functional-ui-sans"],
      "moods": ["approachable", "friendly", "calm", "organized"],
      "incompatibleWith": ["dark", "neon-accent", "glassmorphism", "tactile-depth", "heavy-shadows", "skeuomorphic", "clinical", "trading-precision"]
    }
  },
  {
    "id": "cyberpunk-fitness-tracker-dark",
    "imageUrl": "https://pub-7c8c3c7444724a39ba3eeb8accbbca4a.r2.dev/curated-library/cyberpunk-fitness-tracker-dark.jpg",
    "styleIntent": "Stark, high-contrast dark-mode bodybuilding and workout logging application featuring stylized dot-matrix/pixelated muscle anatomy visualizations, retro digital monospace typography, flat modular list sections, and a clean circular check-off calendar strip.",
    "selectionProfile": {
      "theme": "dark",
      "productArchetypes": ["health-fitness", "fitness-tracking", "utility"],
      "interactionArchetypes": ["list-view", "status-overview", "dashboard"],
      "compositions": ["modular-vertical", "stacked-lists", "clean-spatial"],
      "materials": ["matte", "flat-layered"],
      "geometries": ["rounded", "pill-shaped", "circular-nodes"],
      "navigation": ["bottom-pill-dock", "calendar-strip"],
      "density": "balanced",
      "assetBias": "illustration-heavy",
      "colorCharacter": ["deep-black-base", "monochromatic-neutral", "vibrant-accent"],
      "typographyCharacter": ["monospace-code", "functional-ui-sans"],
      "moods": ["technical", "precise", "focused", "retro-futuristic"],
      "incompatibleWith": ["light", "airy", "pastel-base", "glassmorphism", "tactile-depth", "heavy-shadows", "skeuomorphic", "playful"]
    }
  },
  {
    "id": "premium-finance-banking-dark",
    "imageUrl": "https://pub-7c8c3c7444724a39ba3eeb8accbbca4a.r2.dev/curated-library/premium-finance-banking-dark.jpg",
    "styleIntent": "Premium dark-mode personal finance dashboard utilizing deep charcoal canvases paired with multi-layered container depths, subtle neon blue and crimson glows on linear progress elements, smooth vertical bar charts, and clear toggle utility rows.",
    "selectionProfile": {
      "theme": "dark",
      "productArchetypes": ["finance-banking", "analytics-operations", "utility"],
      "interactionArchetypes": ["dashboard", "data-visualization", "control-panel"],
      "compositions": ["modular-vertical", "stacked-lists", "bento-grid"],
      "materials": ["matte", "flat-layered"],
      "geometries": ["rounded", "pill-shaped"],
      "navigation": ["bottom-pill-dock", "top-context-bar"],
      "density": "balanced",
      "assetBias": "mixed",
      "colorCharacter": ["deep-black-base", "vibrant-accent", "monochromatic-neutral"],
      "typographyCharacter": ["geometric-sans", "functional-ui-sans"],
      "moods": ["precise", "focused", "premium", "organized"],
      "incompatibleWith": ["light", "playful", "airy", "glassmorphism", "skeuomorphic", "heavy-shadows", "illustration-heavy"]
    }
  },
];

assertCuratedStyleCatalog(CURATED_STYLE_REFERENCES);
