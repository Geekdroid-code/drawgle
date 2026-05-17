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

  const fallback = CURATED_STYLE_REFERENCES.find((reference) => reference.fallback) ?? CURATED_STYLE_REFERENCES[0];
  return fallback
    ? {
        reference: fallback,
        score: best?.score ?? 0,
        matchedTags: best?.matchedTags ?? [],
      }
    : null;
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

const loadPublicStyleReferenceImage = async (publicPath: string): Promise<PromptImagePayload> => {
  const normalizedPath = publicPath.replace(/^\/+/, "");
  if (!normalizedPath || normalizedPath.includes("..")) {
    throw new Error(`Invalid curated public image path: ${publicPath}`);
  }

  const filePath = join(process.cwd(), "public", normalizedPath);
  const data = await readFile(filePath);
  return {
    data: Buffer.from(data).toString("base64"),
    mimeType: mimeTypeForPath(filePath),
  };
};

export async function loadCuratedStyleReferenceImage(reference: CuratedStyleReference): Promise<PromptImagePayload | null> {
  try {
    if (reference.imageUrl.startsWith("/")) {
      return await loadPublicStyleReferenceImage(reference.imageUrl);
    }

    const response = await fetch(reference.imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to load curated style reference ${reference.id}: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return {
      data: Buffer.from(arrayBuffer).toString("base64"),
      mimeType: response.headers.get("content-type") || "image/jpeg",
    };
  } catch (error) {
    console.warn("[curated-style-reference] Unable to load image", {
      referenceId: reference.id,
      imageUrl: reference.imageUrl,
      error,
    });
    return null;
  }
}
