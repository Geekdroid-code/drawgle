import "server-only";

import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";

import type { PlanningMode, ProjectCharter, PromptImagePayload } from "@/lib/types";

type CuratedStyleReference = {
  id: string;
  imageUrl: string;
  domainTags: string[];
  screenRoles: string[];
  visualFamilies: string[];
  moodTags: string[];
  keywords: string[];
  negativeKeywords: string[];
  styleIntent: string;
  fallback?: boolean;
};

export type CuratedStyleReferenceMatch = {
  reference: CuratedStyleReference;
  score: number;
  matchedTags: string[];
};

const MIN_CONFIDENT_SCORE = 12;

export const CURATED_STYLE_REFERENCES: CuratedStyleReference[] = [
  {
    id: "security-watchtower-light-score",
    imageUrl: "/password-manager.png",
    domainTags: ["security", "password", "privacy", "vault", "identity", "cybersecurity", "monitoring"],
    screenRoles: ["dashboard", "home", "overview", "accounts", "security score", "monitor"],
    visualFamilies: ["clean-ios", "soft-minimal", "premium-light", "score-dashboard", "security-green"],
    moodTags: ["trust", "calm", "safe", "precise", "premium", "airy"],
    keywords: [
      "watchtower",
      "security score",
      "password manager",
      "accounts",
      "vault",
      "breach monitoring",
      "two factor",
      "privacy",
      "score",
      "very good",
    ],
    negativeKeywords: ["commerce", "checkout", "crypto exchange", "dark", "food", "fitness", "shopping"],
    styleIntent: "Light premium security dashboard with a dominant score hero, calibrated ruler scale, mint trust accents, soft glass cards, app-account rows, and calm bottom navigation.",
  },
  {
  "id": "smart-home-iot-tactile-dark",
  "imageUrl": "https://pub-7c8c3c7444724a39ba3eeb8accbbca4a.r2.dev/curated-library/smart-home-iot-tactile-dark.jpg",
  "domainTags": ["smart-home", "iot", "home-automation", "appliances", "lighting-control", "climate-control", "hardware"],
  "screenRoles": ["dashboard", "home", "control-panel", "edit-mode", "widget-configuration"],
  "visualFamilies": ["dark-mode", "tactile-depth", "bento-grid", "glowing-gradients", "glassmorphism", "machined-ui"],
  "moodTags": ["premium", "futuristic", "sleek", "cozy", "tactile", "focused"],
  "keywords": [
    "smart home",
    "iot dashboard",
    "bento widgets",
    "dark mode layout",
    "light dimmer control",
    "timer widget",
    "climate card",
    "edit layout state",
    "floating nav bar",
    "glowing cards",
    "ambient lighting",
    "russian ui"
  ],
  "negativeKeywords": ["light-mode", "white", "flat-design", "e-commerce", "fintech", "crypto", "analytics-dashboard", "saas-b2b", "minimalist-airy"],
  "styleIntent": "Premium dark-mode smart home control center featuring a modular bento-style card grid with vivid ambient glow state indicators, deep tactile glassmorphism borders, a dedicated widget configuration/edit view with contextual action badges, and a floating dock navigation bar."
},
{
  "id": "sneaker-ecom-futuristic-light",
  "imageUrl": "https://pub-7c8c3c7444724a39ba3eeb8accbbca4a.r2.dev/curated-library/sneaker-ecom-store.jpg",
  "domainTags": ["e-commerce", "shopping", "retail", "fashion", "footwear", "sneakers", "streetwear"],
  "screenRoles": ["home", "product-listing", "product-detail", "pdp", "storefront"],
  "visualFamilies": ["clean-light", "soft-shadows", "high-contrast", "futuristic-tech", "asymmetric-layout"],
  "moodTags": ["energetic", "premium", "modern", "trendy", "sporty", "crisp"],
  "keywords": [
    "sneakers",
    "shoe store",
    "product detail page",
    "pdp",
    "vertical size selector",
    "color dot matrix",
    "swipe to buy slider",
    "hero product carousel",
    "product card grid",
    "category horizontal tabs",
    "floating navigation dock",
    "soft drop shadows",
    "high-tech apparel"
  ],
  "negativeKeywords": ["dark-mode", "dashboard", "analytics", "fintech", "crypto", "b2b-saas", "medical", "productivity", "data-charts"],
  "styleIntent": "Premium light-themed lifestyle and footwear e-commerce storefront showcasing a modular product card catalog with floating design elements, soft drop-shadow depth, and a dedicated product detail layout optimized with vertical choice configurations and a high-contrast 'swipe-to-buy' primary action slider."
},
{
  "id": "femtech-period-tracker-circular-light",
  "imageUrl": "https://pub-7c8c3c7444724a39ba3eeb8accbbca4a.r2.dev/curated-library/femtech-period-tracker-circular-light.png",
  "domainTags": ["health-and-fitness", "femtech", "medical-wellness", "period-tracker", "fertility", "biometrics"],
  "screenRoles": ["dashboard", "home", "overview", "tracker-main"],
  "visualFamilies": ["clean-ios", "soft-minimal", "premium-light", "pastel-accents", "circular-progress-ui"],
  "moodTags": ["calm", "safe", "clinical", "empathetic", "clean", "precise"],
  "keywords": [
    "cycle tracker",
    "ovulation wheel",
    "fertility window",
    "period days",
    "health dashboard",
    "circular progress indicator",
    "soft card grid",
    "menstrual cycle chart",
    "medical minimal"
  ],
  "negativeKeywords": ["dark-mode", "b2b-saas", "fintech", "crypto", "e-commerce", "gaming", "neon-gradients", "heavy-shadows"],
  "styleIntent": "Minimalist light-themed femtech dashboard centered around a multi-segmented circular cycle dial with color-coded status rings, supported by high-legibility typographic hierarchy and soft, low-contrast modular tracking metrics blocks."
},
{
  "id": "fitness-calorie-tracker-pastel-minimal",
  "imageUrl": "https://pub-7c8c3c7444724a39ba3eeb8accbbca4a.r2.dev/curated-library/fitness-calorie-tracker-pastel-minimal.png",
  "domainTags": ["health-and-fitness", "diet-and-nutrition", "calorie-counter", "wellness", "macro-tracking", "biometrics"],
  "screenRoles": ["dashboard", "home", "analytics", "history-log", "meal-tracker", "social-sharing"],
  "visualFamilies": ["soft-minimal", "clean-ios", "pastel-palette", "capsule-geometry", "bento-grid", "flat-vector-cards"],
  "moodTags": ["friendly", "inviting", "airy", "motivating", "organized", "clean"],
  "keywords": [
    "calorie counter",
    "macro split",
    "food journal",
    "weekly calendar strip",
    "capsule charts",
    "water intake bar",
    "social fitness board",
    "breakfast logging",
    "pastel badges",
    "floating bottom dock"
  ],
  "negativeKeywords": ["dark-mode", "fintech", "heavy-3d", "skeuomorphic", "e-commerce", "gaming", "neon-gradients", "dense-data-tables", "cyberpunk"],
  "styleIntent": "Friendly and airy light-themed nutrition and calorie tracking interface utilizing a soft pastel color palette, modular rounded capsule data visualizations, clean typographic hierarchy, a weekly horizontal date selector strip, and collaborative health sharing elements."
},
{
  "id": "fitness-kalo-progress-dark",
  "imageUrl": "https://pub-7c8c3c7444724a39ba3eeb8accbbca4a.r2.dev/curated-library/fitness-kalo-progress-dark.png",
  "domainTags": ["health-and-fitness", "diet-and-nutrition", "analytics", "biometrics", "weight-tracking", "calorie-counter"],
  "screenRoles": ["dashboard", "analytics", "progress-report", "history-log", "home"],
  "visualFamilies": ["dark-mode", "premium-dark", "neon-accents", "bento-grid", "data-dense", "clean-ios"],
  "moodTags": ["focused", "premium", "sleek", "disciplined", "motivating", "precise"],
  "keywords": [
    "calorie analytics",
    "weight trend line chart",
    "weekly bar graph",
    "macro distribution ring",
    "streak indicator",
    "segmented period tabs",
    "floating primary action button",
    "chartreuse accents",
    "dark interface",
    "kalo app"
  ],
  "negativeKeywords": ["light-mode", "white", "minimalist-airy", "e-commerce", "fintech", "crypto-exchange", "pastel-palette", "brutalist"],
  "styleIntent": "Premium dark-mode health and fitness analytics dashboard featuring data-dense metrics layout, customized chartreuse accent line and bar charts, a multi-column insights grid with macro ring charts, and an ergonomic bottom tab navigation displaying a prominent floating action button."
},
{
  "id": "diet-nutrition-journal-pastel",
  "imageUrl": "https://pub-7c8c3c7444724a39ba3eeb8accbbca4a.r2.dev/curated-library/diet-nutrition-journal-pastel.png",
  "domainTags": ["health-and-fitness", "diet-and-nutrition", "meal-planning", "calorie-counter", "wellness", "education"],
  "screenRoles": ["dashboard", "home", "meal-tracker", "journal", "article-listing", "discovery"],
  "visualFamilies": ["soft-minimal", "clean-ios", "pastel-palette", "bento-grid", "wavy-dividers", "glassmorphism"],
  "moodTags": ["friendly", "inviting", "airy", "organized", "playful", "wholesome"],
  "keywords": [
    "meal plan card",
    "food journal rows",
    "macro progress rings",
    "educational article feed",
    "curved wave graphics",
    "glassmorphism tab bar",
    "pastel grid blocks",
    "recipe collection preview",
    "bright yellow primary buttons",
    "author verified badge"
  ],
  "negativeKeywords": ["dark-mode", "fintech", "heavy-shadows", "crypto", "analytics-dense", "monochrome", "brutalist", "sharp-edges"],
  "styleIntent": "Vibrant and cheerful light-themed nutrition hub showcasing a distinct pastel color-coded modular grid, asymmetrical wavy organic card backgrounds, minimal donut micro-charts for progress tracking, and a sleek, translucent glassmorphism floating menu dock."
},

  {
    id: "finance-light-soft-banking-home",
    imageUrl: "/finance.jpeg",
    domainTags: ["finance", "fintech", "banking", "wallet", "budget", "payments", "money", "personal finance"],
    screenRoles: ["home", "dashboard", "overview", "wallet", "balance", "payments", "transactions"],
    visualFamilies: ["clean-ios", "soft-minimal", "premium-light", "rounded-cards", "floating-dock"],
    moodTags: ["calm", "friendly", "trust", "premium", "airy"],
    keywords: [
      "total balance",
      "income",
      "expense",
      "pay bills",
      "recent transactions",
      "transfer",
      "withdraw",
      "received",
      "money",
      "card",
      "minimal",
      "ios",
    ],
    negativeKeywords: ["dark", "crypto exchange", "commerce inventory", "password", "security score", "product list"],
    styleIntent: "Soft light banking home with oversized decimal balance typography, pill icon buttons, rounded white payment modules, gentle shadows, and a floating dark bottom dock.",
    fallback: true,
  },
  {
    id: "crypto-dark-exchange-payment",
    imageUrl: "/payment.jpeg",
    domainTags: ["crypto", "finance", "fintech", "exchange", "wallet", "payment", "trading", "banking"],
    screenRoles: ["payment", "exchange", "transfer", "checkout", "buy", "detail", "form", "swap"],
    visualFamilies: ["dark-premium", "minimal-dark", "high-contrast", "form-card", "crypto-command"],
    moodTags: ["focused", "premium", "serious", "secure", "minimal"],
    keywords: [
      "btc",
      "usd",
      "exchange",
      "buy btc",
      "estimate fee",
      "gas fee",
      "balance",
      "crypto",
      "swap",
      "payment",
      "dark",
    ],
    negativeKeywords: ["light", "ecommerce inventory", "password manager", "health", "fitness", "soft pastel"],
    styleIntent: "Dark premium exchange/payment flow with two stacked currency panels, centered swap control, high-contrast pill CTA, restrained metadata rows, and deep graphite surfaces.",
  },
  {
    id: "ecommerce-light-inventory-store-suite",
    imageUrl: "/ecommerce.jpg",
    domainTags: ["commerce", "ecommerce", "retail", "store", "inventory", "marketplace", "shopping"],
    screenRoles: ["dashboard", "products", "profile", "inventory", "storefront", "list", "settings", "orders"],
    visualFamilies: ["clean-ios", "premium-light", "retail-dashboard", "soft-cards", "orange-accent"],
    moodTags: ["friendly", "business", "organized", "premium", "bright"],
    keywords: [
      "customers",
      "orders",
      "products",
      "stock",
      "out of stock",
      "archive",
      "profile",
      "store",
      "shipping",
      "inventory",
      "overview",
      "weekly",
      "shop",
      "seller",
    ],
    negativeKeywords: ["crypto", "dark", "password", "security score", "fitness", "bank balance"],
    styleIntent: "Bright retail admin suite with a soft gray app canvas, orange gradient accents, rounded stat cards, product list rows with image wells, profile metrics, and simple bottom tabs.",
  },
];

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const hasTerm = (input: string, term: string) => {
  const normalized = normalizeText(term);
  if (!normalized) {
    return false;
  }

  return new RegExp(`(?:^|\\s)${normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\s|$)`).test(input);
};

const collectMatches = (input: string, terms: string[]) =>
  terms.filter((term) => hasTerm(input, term));

const projectContextText = (charter?: ProjectCharter | null) =>
  [
    charter?.appType,
    charter?.targetAudience,
    charter?.navigationModel,
    charter?.keyFeatures?.join(" "),
    charter?.designRationale,
    charter?.creativeDirection?.conceptName,
    charter?.creativeDirection?.styleEssence,
    charter?.creativeDirection?.surfaceLanguage,
  ].filter(Boolean).join(" ");

export function matchCuratedStyleReference({
  prompt,
  planningMode,
  existingCharter,
}: {
  prompt: string;
  planningMode?: PlanningMode;
  existingCharter?: ProjectCharter | null;
}): CuratedStyleReferenceMatch | null {
  const input = normalizeText([
    prompt,
    projectContextText(existingCharter),
    planningMode === "single-screen" ? "single screen detail focused" : "full project app",
  ].filter(Boolean).join(" "));

  if (!input) {
    return null;
  }

  const scored = CURATED_STYLE_REFERENCES.map((reference) => {
    const domainMatches = collectMatches(input, reference.domainTags);
    const roleMatches = collectMatches(input, reference.screenRoles);
    const visualMatches = collectMatches(input, reference.visualFamilies);
    const moodMatches = collectMatches(input, reference.moodTags);
    const keywordMatches = collectMatches(input, reference.keywords);
    const negativeMatches = collectMatches(input, reference.negativeKeywords);
    const score =
      domainMatches.length * 10 +
      roleMatches.length * 8 +
      visualMatches.length * 5 +
      moodMatches.length * 5 +
      keywordMatches.length * 3 -
      negativeMatches.length * 12;

    return {
      reference,
      score,
      matchedTags: Array.from(new Set([...domainMatches, ...roleMatches, ...visualMatches, ...moodMatches, ...keywordMatches])),
    };
  }).sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (best && best.score >= MIN_CONFIDENT_SCORE) {
    return best;
  }

  // Low-confidence prompts intentionally stay image-free. A universal reference
  // silently biases unrelated products toward whichever domain owns the fallback.
  return null;
}

const mimeTypeForPath = (path: string) => {
  switch (extname(path).toLowerCase()) {
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".jpg":
    case ".jpeg":
    default:
      return "image/jpeg";
  }
};

const fetchStyleReferenceImage = async (imageUrl: string): Promise<PromptImagePayload> => {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to load curated style reference image: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return {
    data: Buffer.from(arrayBuffer).toString("base64"),
    mimeType: response.headers.get("content-type") || mimeTypeForPath(imageUrl),
  };
};

const publicAssetBaseUrlCandidates = () => {
  const candidates = [
    process.env.CURATED_REFERENCE_BASE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.APP_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    "https://drawgle.vercel.app",
  ];

  return Array.from(new Set(candidates.filter((value): value is string => Boolean(value?.trim()))))
    .map((value) => value.replace(/\/+$/, ""));
};

const loadPublicStyleReferenceImage = async (publicPath: string): Promise<PromptImagePayload> => {
  const normalizedPath = publicPath.replace(/^\/+/, "");
  if (!normalizedPath || normalizedPath.includes("..")) {
    throw new Error(`Invalid curated public image path: ${publicPath}`);
  }

  try {
    const filePath = join(process.cwd(), "public", normalizedPath);
    const data = await readFile(filePath);
    return {
      data: Buffer.from(data).toString("base64"),
      mimeType: mimeTypeForPath(filePath),
    };
  } catch (localError) {
    let lastFetchError: unknown = localError;

    for (const baseUrl of publicAssetBaseUrlCandidates()) {
      try {
        return await fetchStyleReferenceImage(`${baseUrl}/${normalizedPath}`);
      } catch (fetchError) {
        lastFetchError = fetchError;
      }
    }

    throw lastFetchError instanceof Error
      ? lastFetchError
      : new Error(`Unable to load curated public image path: ${publicPath}`);
  }
};

export async function loadCuratedStyleReferenceImage(reference: CuratedStyleReference): Promise<PromptImagePayload | null> {
  try {
    if (reference.imageUrl.startsWith("/")) {
      return await loadPublicStyleReferenceImage(reference.imageUrl);
    }

    return await fetchStyleReferenceImage(reference.imageUrl);
  } catch (error) {
    console.warn("[curated-style-reference] Unable to load image", {
      referenceId: reference.id,
      imageUrl: reference.imageUrl,
      error,
    });
    return null;
  }
}
