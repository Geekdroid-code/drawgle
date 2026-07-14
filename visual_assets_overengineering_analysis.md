# Visual Assets System — Over-Engineering Analysis

Your instinct is right. For what the system actually needs to do — **put images into generated UI screens** — there is significant unnecessary complexity. Here's the breakdown.

---

## 🔴 Clearly Over-Engineered / Unused

### 1. `visual_asset_variants` table — Mostly Wasted Effort

The system generates **4 variants** for every single asset: `original`, `thumb_256`, `preview_512`, `display_1024`.

**The problem:**
- `thumb_256` is **never read anywhere** in the codebase. It's generated, uploaded to R2, stored in the DB, and then... nothing. Dead storage cost.
- `preview_512` is only referenced as a fallback in [getDisplayVariant()](file:///c:/Users/harva/Downloads/work/drawgle-main/lib/generation/visual-assets.ts#L654-L668) — it's never directly requested by any consumer.
- In practice, the generated screen HTML hardcodes `display_1024` URLs directly (see the [public/screens/](file:///c:/Users/harva/Downloads/work/drawgle-main/public/screens) HTML files). The variant system doesn't drive any responsive `<picture>` / `srcset` logic.
- **No frontend code, no component, no hook, no action** ever queries the `visual_asset_variants` table. It's only read inside [visual-assets.ts](file:///c:/Users/harva/Downloads/work/drawgle-main/lib/generation/visual-assets.ts) during asset resolution to pick the display URL.

**What it could have been:** Just store the original + one display-ready size. Or better: just serve the original through a CDN with on-the-fly resizing (Cloudflare Images, imgproxy, etc). The whole table and the Sharp processing pipeline is overkill for "put an image URL into an HTML `<img>` tag".

---

### 2. `dominant_colors` and `safe_area` columns on `visual_assets` — Never Used

- `dominant_colors` (`jsonb`, defaults to `'[]'`) is defined in the schema but **never written to** by any application code. The only reference is in [publish-showcase-templates.ts](file:///c:/Users/harva/Downloads/work/drawgle-main/scripts/publish-showcase-templates.ts#L184) where it's blindly copied during template promotion. No code ever reads it for color extraction, palette matching, or design token coordination.
- `safe_area` (`jsonb`, nullable) — same story. Defined, copied during publishing, but **never populated or read** by any generation or rendering logic.

These are "maybe someday" columns sitting in the schema adding noise.

---

### 3. The Full Diagnostics System — Developer Debugging Jammed Into Production

The entire `AssetResolutionDiagnostic` type ([types.ts:L141-165](file:///c:/Users/harva/Downloads/work/drawgle-main/lib/types.ts#L141-L165)) and the `collectSearchDiagnostics` function ([visual-assets.ts:L670-702](file:///c:/Users/harva/Downloads/work/drawgle-main/lib/generation/visual-assets.ts#L670-L702)) is called **6 times** inside `findReusableAsset` — once on every single code path (exact hit, vector hit, vector miss, fallback, error, etc.).

Each call runs an **additional database query** against `visual_assets` fetching up to 24 rows, processing them, and building rejection-reason strings. This diagnostic data is:
1. Saved into `generation_run` metadata ([generate-ui-flow.ts:L1845](file:///c:/Users/harva/Downloads/work/drawgle-main/trigger/generate-ui-flow.ts#L1845))
2. **Never displayed to the user**. No UI, no admin panel, no debug page renders it.

This means every asset resolution makes **extra DB queries purely for debugging info that nobody looks at** in production.

---

### 4. `asset_generation_jobs` table — Entirely Dead

This table was designed for async AI image generation (has a `fal_request_id` column for [fal.ai](https://fal.ai) integration, status tracking with `queued → submitted → processing → completed → failed`).

**It is never written to or read from** by any application code. The `AssetGenerationJobRow` type is exported from [database.types.ts](file:///c:/Users/harva/Downloads/work/drawgle-main/lib/supabase/database.types.ts#L739) but imported by nothing. The table exists, has RLS policies, has indexes — all for zero usage. It's a speculative schema for a feature that was never built.

---

### 5. AI-Powered Asset Verification — Expensive and Questionable

[verifyAsset()](file:///c:/Users/harva/Downloads/work/drawgle-main/lib/generation/visual-assets.ts#L941-L1022) sends every AI-generated or critical asset's **full image bytes base64-encoded** to a Gemini model call asking "is this image good enough for a premium mobile UI?".

For the actual use case (picking a curated library image to place in a generated screen), this is a Gemini API call that:
- Costs real money per invocation
- Adds latency to every asset save
- Mostly verifies images that were **already curated and pre-approved** (the `importCuratedVisualAsset` function explicitly overrides verification with `score: 0.92`)

The only time this does actual work is for `ai_generated` source images — a source type that doesn't seem to be actively used given the dead `asset_generation_jobs` table.

---

### 6. The Heuristic Inference System — 100+ Lines of Regex

[inferAssetRequirementForScreen()](file:///c:/Users/harva/Downloads/work/drawgle-main/lib/generation/visual-assets.ts#L361-L468) is a chain of ~10 regex patterns (`productIntentPattern`, `personIntentPattern`, `foodIntentPattern`, etc.) that guesses what asset a screen might need based on keyword matching against the prompt text.

This runs **after** the AI planner has already produced `screen.assetNeeds[]` (which is the authoritative source of what assets are needed). The inferred requirements are only used as gap-fillers for screens the planner didn't attach assets to. It's a safety net that duplicates work the LLM planner should be doing, and adds rigid brittle regex logic that will break as the product evolves.

---

## 🟡 Questionable But Defensible

### 1. `project_asset_usages` table

This is a junction table tracking "which asset ended up on which screen in which project during which generation run." It's only written to in two places:
- [recordUsage()](file:///c:/Users/harva/Downloads/work/drawgle-main/lib/generation/visual-assets.ts#L1668-L1691) during generation
- [instantiate_published_template()](file:///c:/Users/harva/Downloads/work/drawgle-main/supabase/migrations/20260607000100_published_templates.sql#L203-L221) SQL function during template cloning

It's **never read from the frontend** — no component, hook, or action queries it. Its only consumer is the [publish-showcase-templates.ts](file:///c:/Users/harva/Downloads/work/drawgle-main/scripts/publish-showcase-templates.ts#L135) script which uses it to find which assets need to be promoted into published templates.

This is defensible for the publishing pipeline, but it's over-built for runtime — the `generation_run.metadata` blob already stores the full `assetManifest` including all asset-to-screen mappings. The table is essentially a normalized duplicate of data already in JSON.

### 2. The 3-Tier Lookup Cascade (exact → vector → tag_fallback)

For picking a curated image, the system tries:
1. **Exact match** by `reuse_key` + filters
2. **Vector similarity search** via `match_visual_assets` RPC (generates an embedding via Gemini, queries pgvector)
3. **Tag fallback** — tokenizes the subject, scans up to 48 rows, scores them by word overlap

This is a lot of machinery. The vector search alone requires maintaining 768-dimensional embeddings on every asset and calling the Gemini embedding API per requirement at resolution time. For a curated library of maybe a few hundred images, a simpler text-matching approach would likely work just as well.

### 3. Visibility System (`public_reusable`, `owner_private`, `project_private`)

The 3-tier visibility model with privacy-detecting regex patterns ([privateSubjectPattern](file:///c:/Users/harva/Downloads/work/drawgle-main/lib/generation/visual-assets.ts#L225), [personSubjectPattern](file:///c:/Users/harva/Downloads/work/drawgle-main/lib/generation/visual-assets.ts#L227), [productSubjectPattern](file:///c:/Users/harva/Downloads/work/drawgle-main/lib/generation/visual-assets.ts#L229)) is forward-looking design for when users can upload their own images and reuse others'. It's not harmful, but it's complexity built for a future that may or may not arrive.

---

## 🟢 Reasonable / Necessary

| Component | Why It's Fine |
|-----------|---------------|
| `visual_assets` table core columns | You need to store images somewhere with basic metadata |
| R2 upload + public URL | Standard CDN-backed storage |
| Stock photo fallback (Pexels/Pixabay) | Prevents empty/placeholder screens — good UX |
| Content hash dedup | Prevents storing the same image twice — saves real $$ |
| RLS policies | Security requirement, not over-engineering |

---

## Bottom Line

> **For the goal of "put appropriate images into generated UI screens," this system is doing the work of roughly 3–4x the code it needs.**

The core need is: *given a screen that needs a "sneaker cutout", find a matching image from the library and give the code generator its URL.* That could be done with a simple table + text search.

Instead, the system maintains:
- A dead AI generation queue table
- A multi-variant image processing pipeline (3 of 4 variants unused)
- An embedding-based semantic search (for a small curated library)
- A Gemini-powered image verification step
- A full diagnostic/rejected-candidates logging system nobody reads
- Multiple unused schema columns (`dominant_colors`, `safe_area`)
- A regex-based heuristic inference system that duplicates the planner's job

The publishing/template pipeline is the only part that justifies the `project_asset_usages` table, and even that could be simplified since the data already lives in `generation_run.metadata`.
