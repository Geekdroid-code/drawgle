import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
import { loadEnvConfig } from "@next/env";
import { createGeminiClient } from "../../lib/ai/gemini";
import {
  assertCuratedStyleCatalog,
  CURATED_STYLE_REFERENCES,
  type CuratedStyleReference,
} from "../../lib/generation/curated-style-catalog";
import { uploadBytesToR2, type R2UploadConfig } from "../../lib/r2-upload-core";

loadEnvConfig(process.cwd());

const CURATED_DIR = "C:\\Users\\harva\\Downloads\\curated";
const STAGE_FILE = path.resolve(process.cwd(), "scripts/curated/out/staged-curated-batch.json");

export type StagedReferenceItem = {
  index: number;
  originalFilename: string;
  fileSha256: string;
  fileSizeBytes: number;
  imageDimensions: { width: number; height: number; format: string };
  schema: CuratedStyleReference;
  r2Key: string;
  publicUrl: string;
  uploaded: boolean;
  verified: boolean;
};

const SYSTEM_PROMPT = `You are a Principal Mobile Design System Architect.
Analyze the provided mobile application UI reference screenshot.
Your task is to extract its reusable visual and spatial design system DNA into a strict JSON schema.

SCHEMA SPECIFICATION:
{
  "id": string, // lowercase kebab-case matching /^[a-z0-9]+(?:-[a-z0-9]+)*$/, max 60 chars. E.g. "pet-care-training-light-pill" or "crypto-wallet-dark-neon". Must reflect domain, theme, and distinguishing visual traits.
  "styleIntent": string, // 60 to 200 characters. Describe the visual and spatial style DNA, layout hierarchy, surfaces, depth, color story, and navigation anatomy. DO NOT mention specific dummy copy, names, or literal text from the mockup. Focus on reusable design system attributes.
  "selectionProfile": {
    "theme": "light" | "dark" | "mixed",
    "density": "airy" | "balanced" | "dense",
    "productArchetypes": string[], // 1 to 5 kebab-case tags. E.g. "food-delivery", "consumer-commerce", "finance-banking", "pet-care", "health-fitness", "crypto-web3", "productivity-task", "travel-operations", "education-learning", "real-estate", "social-networking", "media-entertainment", "mobility-logistics", "smart-home-iot".
    "interactionArchetypes": string[], // 1 to 5 kebab-case tags. E.g. "catalog-discovery", "product-detail", "dashboard", "control-panel", "profile", "settings-list", "task-management", "timeline-history", "data-visualization", "form-workflow", "status-overview", "content-feed".
    "compositions": string[], // 1 to 5 kebab-case tags. E.g. "modular-grid", "stacked-list", "bento-grid", "edge-to-edge", "card-grid", "hero-header", "asymmetric", "editorial-flow", "horizontal-scroll", "split-plane".
    "materials": string[], // 1 to 5 kebab-case tags. E.g. "flat", "soft-elevated", "glass", "tactile", "subtle-shadow", "layered", "high-contrast", "grainy", "atmospheric".
    "geometries": string[], // 1 to 4 kebab-case tags. E.g. "rounded", "pill-shaped", "inset", "mixed", "capsule", "circular-nodes".
    "navigation": string[], // 1 to 3 kebab-case tags. E.g. "floating-dock", "floating-pill-dock", "bottom-tab-bar", "fixed-tabs", "top-bar", "bottom-fab".
    "assetBias": string, // EXACTLY 1 kebab-case tag. E.g. "product", "photo-heavy", "data", "iconography-heavy", "illustration-heavy", "control", "mixed", "typographic".
    "colorCharacter": string[], // 1 to 5 kebab-case tags. E.g. "vivid-accent", "clean-base", "restrained-neutral", "pastel", "neon-accent", "monochrome", "warm-organic", "cool-clinical", "cream-base", "deep-black-base", "vibrant-accent".
    "typographyCharacter": string[], // 1 to 4 kebab-case tags. E.g. "geometric-sans", "clean-legible", "neutral-sans", "display-led", "editorial-sans", "high-contrast", "humanist-sans".
    "moods": string[], // 2 to 6 kebab-case tags. E.g. "clean", "modern", "approachable", "friendly", "premium", "bold", "calm", "playful", "precise", "energetic", "trustworthy", "sophisticated".
    "incompatibleWith": string[] // 1 to 6 kebab-case tags that this reference clearly clashes with. E.g. ["dark", "data-dense", "cyberpunk", "text-workspace"] if light and airy, or ["light", "airy", "pastel", "playful"] if dark high-tech.
  }
}

CRITICAL RULES:
1. Every string in all tag arrays must match the regex /^[a-z0-9]+(?:-[a-z0-9]+)*$/. No uppercase, no spaces, no underscores, no special characters!
2. No duplicate tags in any array.
3. Every array must have at least 1 element (except incompatibleWith which can have 0-6 elements).
4. No array can exceed 12 elements.
5. styleIntent must be >= 40 characters and <= 260 characters.
6. theme MUST be "light", "dark", or "mixed".
7. density MUST be "airy", "balanced", or "dense".
8. assetBias MUST be a single string matching the tag regex.
9. Return ONLY valid raw JSON without markdown code fences or conversational text.
`;

const cleanTag = (str: string) =>
  str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const cleanTagArray = (arr: unknown[], fallback: string[] = []): string[] => {
  if (!Array.isArray(arr)) return fallback;
  const set = new Set<string>();
  for (const item of arr) {
    if (typeof item === "string") {
      const cleaned = cleanTag(item);
      if (cleaned.length > 0 && cleaned.length <= 80) set.add(cleaned);
    }
  }
  const result = Array.from(set).slice(0, 12);
  return result.length > 0 ? result : fallback;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function analyzeWithGemini(
  filePath: string,
  assignedIds: Set<string>,
): Promise<CuratedStyleReference> {
  const filename = path.basename(filePath);
  const buffer = fs.readFileSync(filePath);
  const ai = createGeminiClient();

  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            inlineData: {
              data: buffer.toString("base64"),
              mimeType: "image/jpeg",
            },
          },
          SYSTEM_PROMPT,
          `Original file name: "${filename}"`,
        ],
        config: {
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      });

      const text = response.text?.trim() || "";
      const raw = JSON.parse(text);

      let id = cleanTag(raw.id || filename.replace(/\.[^/.]+$/, ""));
      if (!id || id.length < 3) {
        id = `curated-${cleanTag(filename.replace(/\.[^/.]+$/, "")).slice(0, 30)}`;
      }
      let finalId = id;
      let counter = 1;
      while (assignedIds.has(finalId)) {
        counter++;
        finalId = `${id}-${counter}`;
      }

      let styleIntent = (raw.styleIntent || "").trim();
      if (styleIntent.length < 40) {
        styleIntent = `${styleIntent} Featuring clean typographic hierarchy, calibrated surface elevation, and coherent modern mobile navigation.`.trim();
      }
      if (styleIntent.length > 260) {
        styleIntent = styleIntent.slice(0, 257) + "...";
      }

      const p = raw.selectionProfile || {};
      const theme = ["light", "dark", "mixed"].includes(p.theme) ? p.theme : "light";
      const density = ["airy", "balanced", "dense"].includes(p.density) ? p.density : "balanced";

      const selectionProfile = {
        theme,
        density,
        productArchetypes: cleanTagArray(p.productArchetypes, ["utility"]),
        interactionArchetypes: cleanTagArray(p.interactionArchetypes, ["dashboard"]),
        compositions: cleanTagArray(p.compositions, ["modular-cards"]),
        materials: cleanTagArray(p.materials, ["flat", "soft-elevated"]),
        geometries: cleanTagArray(p.geometries, ["rounded"]),
        navigation: cleanTagArray(p.navigation, ["bottom-tab-bar"]),
        assetBias: cleanTag(p.assetBias || "mixed") || "mixed",
        colorCharacter: cleanTagArray(p.colorCharacter, ["clean-base", "restrained-neutral"]),
        typographyCharacter: cleanTagArray(p.typographyCharacter, ["geometric-sans"]),
        moods: cleanTagArray(p.moods, ["modern", "clean"]),
        incompatibleWith: cleanTagArray(p.incompatibleWith || [], []),
      };

      const candidate: CuratedStyleReference = {
        id: finalId,
        imageUrl: `https://pub-7c8c3c7444724a39ba3eeb8accbbca4a.r2.dev/curated-library/${finalId}.jpg`,
        styleIntent,
        selectionProfile,
      };

      assertCuratedStyleCatalog([candidate]);
      assignedIds.add(finalId);
      return candidate;
    } catch (err: any) {
      console.warn(`[Attempt ${attempt}/4] Error analyzing ${filename}: ${err.message}`);
      if (attempt === 4) throw err;
      await sleep(1500 * Math.pow(2, attempt - 1));
    }
  }
  throw new Error(`Failed to analyze ${filename}`);
}

async function main() {
  const mode = process.argv[2] || "--analyze"; // --analyze, --upload, --verify, --all
  fs.mkdirSync(path.dirname(STAGE_FILE), { recursive: true });

  let stagedItems: StagedReferenceItem[] = [];
  if (fs.existsSync(STAGE_FILE)) {
    try {
      stagedItems = JSON.parse(fs.readFileSync(STAGE_FILE, "utf8"));
    } catch {
      stagedItems = [];
    }
  }

  const existingCatalogIds = new Set(CURATED_STYLE_REFERENCES.map((r) => r.id));
  const assignedIds = new Set<string>(existingCatalogIds);
  for (const item of stagedItems) {
    if (item.schema?.id) assignedIds.add(item.schema.id);
  }

  const files = fs.readdirSync(CURATED_DIR).sort();
  console.log(`Found ${files.length} files in ${CURATED_DIR}`);

  // STAGE 1: ANALYZE ALL IMAGES
  if (mode === "--analyze" || mode === "--all") {
    console.log("\n=== STAGE 1: Visual Schema Extraction ===");
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const filePath = path.join(CURATED_DIR, file);
      const existing = stagedItems.find((item) => item.originalFilename === file);

      if (existing && existing.schema) {
        console.log(`[${i + 1}/${files.length}] Already analyzed: ${file} -> ${existing.schema.id}`);
        continue;
      }

      console.log(`[${i + 1}/${files.length}] Analyzing with Gemini Vision: "${file}"...`);
      const buffer = fs.readFileSync(filePath);
      const hash = crypto.createHash("sha256").update(buffer).digest("hex");
      const meta = await sharp(buffer).metadata();

      const schema = await analyzeWithGemini(filePath, assignedIds);
      console.log(`  -> ID: ${schema.id}`);
      console.log(`  -> Theme: ${schema.selectionProfile.theme}, Density: ${schema.selectionProfile.density}`);
      console.log(`  -> Style Intent: ${schema.styleIntent.slice(0, 80)}...`);

      const r2Key = `curated-library/${schema.id}.jpg`;
      const publicUrl = `https://pub-7c8c3c7444724a39ba3eeb8accbbca4a.r2.dev/${r2Key}`;
      schema.imageUrl = publicUrl;

      const item: StagedReferenceItem = {
        index: i + 1,
        originalFilename: file,
        fileSha256: hash,
        fileSizeBytes: buffer.length,
        imageDimensions: {
          width: meta.width || 0,
          height: meta.height || 0,
          format: meta.format || "jpeg",
        },
        schema,
        r2Key,
        publicUrl,
        uploaded: false,
        verified: false,
      };

      const existingIdx = stagedItems.findIndex((it) => it.originalFilename === file);
      if (existingIdx >= 0) stagedItems[existingIdx] = item;
      else stagedItems.push(item);

      fs.writeFileSync(STAGE_FILE, JSON.stringify(stagedItems, null, 2), "utf8");
      await sleep(1000); // polite pause between Gemini calls
    }
    console.log(`\nCompleted Stage 1! ${stagedItems.length} items staged in ${STAGE_FILE}`);
  }

  // STAGE 2: UPLOAD TO CLOUDFLARE R2
  if (mode === "--upload" || mode === "--all") {
    console.log("\n=== STAGE 2: Cloudflare R2 Upload ===");
    const r2Config: R2UploadConfig = {
      accountId: process.env.R2_ACCOUNT_ID!,
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      bucket: process.env.R2_BUCKET || "drawgle-assets",
      publicBaseUrl: process.env.R2_PUBLIC_BASE_URL || "https://pub-7c8c3c7444724a39ba3eeb8accbbca4a.r2.dev",
    };

    for (let i = 0; i < stagedItems.length; i++) {
      const item = stagedItems[i];
      if (item.uploaded) {
        console.log(`[${i + 1}/${stagedItems.length}] Already uploaded: ${item.r2Key}`);
        continue;
      }
      const filePath = path.join(CURATED_DIR, item.originalFilename);
      const buffer = fs.readFileSync(filePath);
      console.log(`[${i + 1}/${stagedItems.length}] Uploading ${item.originalFilename} -> ${item.r2Key} (${buffer.length} bytes)...`);

      const uploadedUrl = await uploadBytesToR2({
        config: r2Config,
        key: item.r2Key,
        bytes: buffer,
        contentType: "image/jpeg",
        cacheControl: "public, max-age=31536000, immutable",
      });

      console.log(`  -> Uploaded: ${uploadedUrl}`);
      item.uploaded = true;
      item.publicUrl = uploadedUrl;
      item.schema.imageUrl = uploadedUrl;
      fs.writeFileSync(STAGE_FILE, JSON.stringify(stagedItems, null, 2), "utf8");
    }
    console.log("\nCompleted Stage 2! All staged items uploaded to R2.");
  }

  // STAGE 3: VERIFY REACHABILITY
  if (mode === "--verify" || mode === "--all") {
    console.log("\n=== STAGE 3: Verify Public HTTP URLs ===");
    let verifiedCount = 0;
    for (let i = 0; i < stagedItems.length; i++) {
      const item = stagedItems[i];
      try {
        const res = await fetch(item.publicUrl, { method: "HEAD" });
        if (res.ok) {
          item.verified = true;
          verifiedCount++;
          console.log(`[${i + 1}/${stagedItems.length}] VERIFIED (HTTP ${res.status}): ${item.publicUrl}`);
        } else {
          console.error(`[${i + 1}/${stagedItems.length}] FAILED (HTTP ${res.status}): ${item.publicUrl}`);
        }
      } catch (err: any) {
        console.error(`[${i + 1}/${stagedItems.length}] ERROR: ${item.publicUrl} - ${err.message}`);
      }
    }
    fs.writeFileSync(STAGE_FILE, JSON.stringify(stagedItems, null, 2), "utf8");
    console.log(`\nCompleted Stage 3! ${verifiedCount}/${stagedItems.length} verified via HTTP.`);
  }

  // STAGE 4: VALIDATE FULL CATALOG
  console.log("\n=== STAGE 4: Catalog Schema Validation ===");
  const allReferences = [...CURATED_STYLE_REFERENCES, ...stagedItems.map((item) => item.schema)];
  assertCuratedStyleCatalog(allReferences);
  console.log(`All ${allReferences.length} references (56 existing + ${stagedItems.length} new) passed assertCuratedStyleCatalog validation!`);
}

main().catch((err) => {
  console.error("FATAL ERROR in process-curated-library:", err);
  process.exit(1);
});
