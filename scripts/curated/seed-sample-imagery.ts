/**
 * Fills the internal image library with sample portraits and pets, so that a mockup's family members,
 * team and pets are the same reviewed photos project after project instead of whatever a stock search
 * finds that day. The list is lib/generation/sample-imagery.ts.
 *
 *   pnpm seed:sample-imagery                      dry run: lists the photos each search would add
 *   pnpm seed:sample-imagery --only dog,cat       only these entries of the list
 *   pnpm seed:sample-imagery --apply              downloads them, crops them square and adds them to the library
 *
 * Provider and database credentials come only from the process environment through the app's env
 * helpers. Nothing here reads or prints env files. Adding a photo twice is harmless: the library
 * ignores an image it already holds.
 */
import { parseArgs } from "node:util";

import { getOptionalPexelsApiKey, getOptionalPixabayApiKey } from "@/lib/env/server";
import { SAMPLE_IMAGERY_SPECS, libraryEntryFor, specRequirement } from "@/lib/generation/sample-imagery";
import { findStockCandidates, importCuratedVisualAsset } from "@/lib/generation/visual-assets";

const usage = `Usage:
  seed:sample-imagery [--only <id,id,...>] [--apply]

Entries: ${SAMPLE_IMAGERY_SPECS.map((spec) => spec.id).join(", ")}`;

const { values } = parseArgs({
  options: {
    apply: { type: "boolean", default: false },
    only: { type: "string" },
    help: { type: "boolean", default: false },
  },
  strict: true,
});

async function createAdmin() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Database credentials are not present in the process environment.");
  }
  // Loaded lazily: it imports server-only modules that need --conditions=react-server.
  const { createAdminClient } = await import("@/lib/supabase/admin");
  return createAdminClient();
}

async function main() {
  if (values.help) {
    console.log(usage);
    return;
  }
  if (!getOptionalPexelsApiKey() && !getOptionalPixabayApiKey()) {
    throw new Error("No stock provider key is present in the process environment.");
  }
  const wanted = values.only ? new Set(values.only.split(",").map((id) => id.trim()).filter(Boolean)) : null;
  const specs = SAMPLE_IMAGERY_SPECS.filter((spec) => !wanted || wanted.has(spec.id));
  const unknown = [...(wanted ?? [])].filter((id) => !SAMPLE_IMAGERY_SPECS.some((spec) => spec.id === id));
  if (unknown.length > 0) throw new Error(`Unknown entries: ${unknown.join(", ")}.\n${usage}`);

  const admin = values.apply ? await createAdmin() : null;
  let found = 0;
  let added = 0;
  for (const spec of specs) {
    const candidates = (await findStockCandidates(specRequirement(spec), spec.count)).slice(0, spec.count);
    found += candidates.length;
    console.log(`\n${spec.id}: ${candidates.length} of ${spec.count} photos for "${spec.subject}"`);
    for (const candidate of candidates) {
      console.log(`  ${candidate.provider} ${candidate.providerAssetId}  ${candidate.width ?? "?"}x${candidate.height ?? "?"}  ${candidate.description || "(no caption)"}\n    ${candidate.sourceUrl ?? candidate.imageUrl}`);
      if (!admin) continue;
      try {
        await importCuratedVisualAsset({
          admin,
          imageUrl: candidate.imageUrl,
          role: "avatar",
          assetType: "photo",
          hasAlpha: false,
          semanticCategory: spec.category,
          ...libraryEntryFor(spec, candidate),
        });
        added += 1;
      } catch (error) {
        console.warn(`    not added: ${error instanceof Error ? error.message : "unknown error"}`);
      }
    }
  }
  console.log(values.apply
    ? `\nAdded ${added} of ${found} photos to the internal library.`
    : `\nDry run: ${found} photos found. Run again with --apply to add them.`);
}

main().catch((error) => {
  // Only messages written in this script are safe to show; provider and database errors may carry details.
  const message = error instanceof Error ? error.message : "";
  const safe = /^(Usage:|Unknown entries|No stock provider key|Database credentials)/;
  console.error(safe.test(message) ? message : "The seed failed; no sensitive error details were printed.");
  process.exitCode = 1;
});
