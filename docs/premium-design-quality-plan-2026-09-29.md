# Premium design quality: diagnosis and implementation plan (2026-09-29)

This is the plan for a local Claude Code session to implement. It does not depend on the conversation that produced it.

**How to use it**

- Read sections 1 to 3 first: the test case, the evidence and the root causes.
- Then do section 4 in order. Each step lists why, what to change, where, tests, and when it is done.
- Section 7 has the working rules for this repo.

**Starting point**

- Branch `claude/drawgle-app-flow-planning-s19wmc` at `c4f54ed`. That is `main` (`766a5a3`) plus four commits documented in `docs/generation-quality-fix-2026-09-29.md`. Those commits already:
  - stop built screens being saved as failed;
  - attach the reference image to every screen build;
  - add a design-thinking step and the brief/reference authority split to the builder prompt;
  - style the navigation after the reference (capsule renderer), add a contrast floor, and fix realtime token loss;
  - cut cost (scope preparation opt-in, deterministic nav tidy, blueprint reuse for later batches).
- Merge that branch first. This plan builds on it.

---

## 1. The test case

Project `0ce99a06…`, "An app for families with multiple pets", was prompt-only. Discovery picked the curated reference `mindfulness-meditation-beige-light`:

- Image: `https://pub-7c8c3c7444724a39ba3eeb8accbbca4a.r2.dev/curated-library/mindfulness-meditation-beige-light.jpg`
- It is three phone screens. Look at it before starting.

Five screens were built: Daily Care Dashboard, Pet Library, Pet Detail Profile, Pet Registration Form, Routine & Appointment Editor. The founder's verdict:

- Nowhere near the reference.
- A 32px radius everywhere; the founder's rule is that up to 24px works best if a default is needed.
- Blurred "overlay" shadows by default.
- Stark white cards on cream.
- A generic 2022-style nav.
- The same reference in image-to-UI mode would have matched well, and sleek.design with no reference looked cleaner and more premium.

### What makes the reference premium

- **Tone-on-tone surfaces.** Cards are a lighter cream than the page, and tiles inside cards are a step darker. There are no shadows; separation comes from tone.
- **Radius hierarchy.**
  - Cards are about 16 to 20pt at a 390pt screen width (estimated by eye).
  - Tiles inside cards are smaller.
  - Chips are pills, and icon wells and buttons are circles.
- **Weight-contrast typography.** "Balance Your **Mind** and **Life**": a regular-weight headline with bold keywords. Headings are near-black.
- **A small, consistent component vocabulary:**
  - an avatar greeting header with a round bell button;
  - a pill chip rail with a filled apricot active chip;
  - an emoji mood row in a card with a `…` menu;
  - a section header with an arrow;
  - action tiles with a pastel icon square;
  - a search pill with a round mic button and a round filter button;
  - illustrated chips;
  - a media card with a round play button and a duration pill;
  - a gradient row card (apricot to lime) with a near-black round pause button;
  - a calendar strip with the selected day as a vertical apricot capsule;
  - two stat tiles inside a card;
  - a donut chart card with a legend;
  - a bottom bar: full width, attached, rounded top corners, five line icons, the active icon in a yellow-lime gradient circle.
- **One strong dark control** (the pause button) against an otherwise soft palette.

---

## 2. Evidence: where the premium signal was lost

### 2.1 Measured colors against generated tokens

These were sampled from the reference pixels (5×5 averages with `sharp`, after scaling the image to 1200px wide):

| Role | Measured in the reference | Generated token or brief |
| --- | --- | --- |
| Page background | `#ECE9D6` | `#F9F6F0`; the analysis said `#FDFBF0` |
| Card | `#F7F5E9` | `#FFFFFF` |
| Tile inside a card | `#EFE9D9` | no such token |
| Inactive chip | `#F5F2E7` | n/a |
| Active chip, selected day, mic button | `#FFC068` | action.primary `#E89F71` |
| Nav active well | `#F4D583`, a gradient to lime | n/a |
| Strongest control (pause button) | `#010C19`, near-black | the analysis said "avoid pure black" |
| Card shadow | none visible | `0 4px 20px rgba(45,41,38,0.04)`; briefs said "4% opacity soft shadow" |
| Card radius | about 16 to 20pt | `radii.app` 32px, inner 20px |
| Fonts | geometric grotesk, weight contrast | Plus Jakarta Sans and Inter |

Every guessed value drifted toward the same clichés: whiter, rounder, and shadowed.

### 2.2 The amplification chain

Every stage paraphrases the stage before and pushes it toward the common pattern:

1. **Runtime reference analysis** (`analyzeReferenceImageForScope`, LLM on the curated image, stored in `project_charter.referenceDna`):
   - Its cues were "High corner radius (24pt+)", "Soft drop shadows with low spread", and "Floating glass-morphism navigation bar".
   - `primaryNavigation.items` was `[]` with `itemCount` 0.
   - **It described one of the three phones.** The run diagnostics say `referenceAnalysisDiagnostics.source: "salvaged_analysis"` and "count mismatch: estimate=3, screenReferences=1". The truncated analysis was accepted.
   - It produced two composition primitives out of roughly 15 components. One was `soft-card-stacking`, with "Radius should be at least 24px" and "Shadows must be soft".
2. **Creative direction** (`generateCreativeDirection`, `lib/generation/service.ts:2705`, called from `generateDesignTokens` at `:3946`):
   - "Highly rounded **(32px)** cards with soft, low-spread shadows and glass-morphism navigation docks."
   - "Layered depth: Cards must be lighter than the background."
   - colorStory "Warm Cream (#F9F6F0) background with Off-White cards."
   - **This is where 32px first appears.**
3. **Tokens** (`generateDesignTokens`, thinking level `minimal`, temperature 0.35). The token prompt demands "a single standard surface radius, … a single standard surface shadow" (`lib/generation/prompts.ts:617-618`, `:677-682`). The result:
   - `radii.app` 32px;
   - card `#FFFFFF` on `#F9F6F0`;
   - a blurred surface shadow.
4. **Charter** (blueprint planner):
   - imageReferenceSummary: "high corner radii (32px)".
   - designRationale: "white cards with 32px radii".
5. **Screen briefs** (planner). Every brief carries the values as commands, although the planner prompt forbids raw values (`prompts.ts:327`):
   - "Each card uses a 32px radius";
   - "off-white cards sit on a #F9F6F0 cream base with a 4% opacity soft shadow";
   - "Status badges use a 'glass' effect with a subtle blur";
   - "MUST PRESERVE: The 32px corner radius on all cards".
6. **Builder.** The strict design contract (`prompts.ts:737-769`) offers one outer radius "for cards, sheets, panels, fields, and navigation shells" and one surface shadow. The Dashboard became a stack of identical `dg-surface-card rounded-[var(--dg-radii-app)] dg-shadow-surface` cards.

The discovery designer had read the reference well. Its `productPlanning.experience` includes:

- adaptations: "'Mood History' row → 'Pet Selection' row", "'Daily Activities' timeline → 'Daily Care Dashboard'", "'Emotional Check-ins' chart → 'Health Progress' donut";
- navigation: "persistent bottom bar with five distinct icons".

**None of this reached the briefs.** No screen has a donut, calendar strip, stat tiles, emoji row or the reference nav.

The builder had the reference image, so the image alone does not fix this. The text contract and the tokens bind the builder to the wrong values; the image can only suggest.

### 2.3 Navigation

- `enforceNavigationEvidencePolicy` (`lib/generation/service.ts:1766-1828`) removed the shared nav:
  - The planner labeled its evidence "explicit-prompt", but the prompt never asked for navigation.
  - The flow had 2 peer root areas (Dashboard, Pet Library), and the rule needs 3.
  - The stored reason: "Persistent navigation was removed because the user did not explicitly request it and the roadmap did not establish at least three peer root product areas."
- With the nav disabled, the builder gets **no navigation instruction at all**: `buildSharedNavigationContract` returns `""` at `prompts.ts:910`.
- The builder saw a bottom bar in the reference image, so Pet Library drew its own `<nav>` tab bar and a FAB. That is the "2022 nav". The other screens have none.

### 2.4 Imagery

- The planner requested 5 pet avatars as critical: `assetRequirements[0]`, role `avatar`, category `animal`, `transparent_png`.
- `lib/generation/visual-assets.ts:1021-1028` rejects **every** `role: "avatar"` as a real identity (`identity_requires_supplied_image`) and returns the placeholder "Use initials or a person icon…". The asset metrics show `placeholderRate: 1`.
- The pet UI therefore shows initials and text where the photos should be. Premium tools use sample photos in mockups.
- The only image in the project (Registration Form) has its alt text set to the app prompt.

### 2.5 Model settings

From `lib/ai/model-policy.ts`:

- Screen builds use `gemini-3-flash-preview` with thinking `low`.
- Design tokens use thinking `minimal` at temperature 0.35 (`service.ts:3944`). The most consequential design decision gets the least reasoning.

### 2.6 Cost of this project

Measured from `generation_runs.metadata.performanceV1`, at Flash prices of $0.50/M input and $3/M output:

| Stage | Tokens | Cost |
| --- | --- | --- |
| Blueprint and briefs (batch 1, 2 calls) | 32.5k in / 3.8k out | about $0.028 |
| Look-ahead briefs for batch 2 (1 call) | 16.7k in / 4.2k out | about $0.021 |
| 5 screen builds | 47.7k in / 14.6k out | about $0.068 |
| **Total recorded** | | **about $0.12 for 5 screens** |

The analysis, creative direction, token and discovery calls come on top; `performanceV1` does not record them.

---

## 3. Root causes, ranked by impact

1. **Numbers are guessed by language models instead of measured.** Hex values, radii and shadows are estimated in prose and re-estimated at each stage. Each estimate drifts toward the same clichés, and the pixels were available the whole time.
2. **The reference reaches the builder as lossy prose, never as something it can copy.**
   - The builder imitates code far better than descriptions. That is why image-to-UI (recreate) mode matches well.
   - In style and prompt modes the reference's component vocabulary survives as two generic primitives.
   - For curated references this lossy analysis is recomputed for every project, although the 46 images never change.
3. **The token system cannot express what premium references do.** It has one card surface, one radius and one shadow. There is no inset surface, tint set or radius hierarchy, so every section becomes the same card.
4. **Prose layers carry values as commands.** Creative direction, the charter and the briefs repeat numbers and materials ("32px", "glass", "4% shadow"), and "MUST PRESERVE" locks them in. The builder obeys the text over the image.
5. **Navigation is decided by a heuristic the user never sees.** When shared nav is off, the builder is not told, so it invents a nav.
6. **Sample imagery is refused.** Avatars of sample pets and people are treated as identities that need a user upload.
7. **Reasoning is thin where it matters.** Tokens use minimal thinking; builds use low thinking. Unknown until measured: whether a stronger build model is worth its price.

**Why this should work.** The same builder already reproduces this reference well in image-to-UI mode. The plan gives style and prompt modes what image-to-UI mode has:

- values measured from the pixels;
- a code specimen of the reference's components in Drawgle's own classes;
- text layers that no longer contradict the image.

It verifies each step visually before rollout (Step 0). No live Gemini run was possible in the cloud session that wrote this, so Step 0 comes first.

---

## 4. Implementation plan

Order: 0 → 2 → 3 → 4 → 5 → 1 → 6 → 7 → 8 → 9.

- Steps 2 to 5 are code-only, and the harness can check each one.
- Step 1 needs the founder to review presets, and it builds on Steps 2 and 4.

### Step 0: Visual eval harness (do first)

**Why.** Every earlier "fix" was judged only by the founder in production. Nothing here can be verified without looking, so there must be a repeatable before and after.

**What**

- `scripts/design-eval/snapshot.ts --project <id> [--out <dir>]`
  - Loads the project's screens, tokens, navigation and reference with the existing admin Supabase client.
  - Reads credentials only through the app's env helpers (`lib/env/server.ts`). Never read or print `.env*` files.
  - Builds each screen's standalone HTML with `buildStandaloneHtmlExport` / `resolveScreenNavigationCode` from `lib/export-pipeline`. That is what the canvas uses (`components/ScreenNode.tsx`), plus the token CSS from `lib/token-runtime.ts`.
  - Renders each screen in Playwright at 390×844 @2x and writes `contact-sheet.png`: the reference image on the left, then the screens in sort order.
  - `scripts/generate-showcase-screenshots.ts` and `scripts/compare-generation-v2-html.ts` already contain the Playwright and sharp plumbing to reuse.
- `scripts/design-eval/checks.ts` runs cheap automatic checks on the rendered DOM and prints a table per screen:
  - elements that are not pills with a computed `border-radius` over 24px;
  - cards with a non-`none` `box-shadow` when the reference elevation is flat;
  - ΔE between card and page background, for tone-on-tone references;
  - a `<nav>` or tab bar drawn inside a screen while shared nav is disabled;
  - root screens without shared nav when the approved flow has nav;
  - asset placeholders where the brief asks for imagery;
  - `px`, hex or `% opacity` inside the stored briefs (`screens.prompt`).
- **Eval set** (`scripts/design-eval/cases.json`):
  - Six prompt-only projects: this pet family app, personal finance, a fitness coach, recipes, a travel journal and team tasks. They go through discovery, which picks curated references.
  - Two uploaded style references.
  - `lib/generation/benchmark-cases.ts` already has prompts to draw from.
  - Create the projects through the local stack (`pnpm dev` plus `npx trigger.dev dev`) so the real pipeline runs, then snapshot them.
- **Baseline:** snapshot `0ce99a06…` and the eval set before changing anything.

**Done when** one command produces a contact sheet and a check table for any project id, and the baseline is saved in `docs/design-eval/baseline/`. Commit small PNGs only; keep the rest local.

### Step 2: Measured colors and calibrated geometry for generated tokens

**Why.** This removes root cause 1 at the source. Colors come from the pixels, and geometry follows a small set of design rules the founder set, applied in code the same way as the existing contrast floor (`ensureLegibleGeneratedTokens`).

**What**

1. **`lib/generation/reference-palette.ts` (new, pure, deterministic)**

   ```ts
   export type NormalizedBox = { x: number; y: number; width: number; height: number }; // 0..1, as in screenReferences[].boundingBox
   export type MeasuredColor = { hex: string; area: number };
   export type MeasuredPalette = {
     theme: "light" | "dark";
     background: MeasuredColor;
     raised: MeasuredColor | null;  // card: neutral, lighter than the page (also in dark themes)
     inset: MeasuredColor | null;   // tile or field inside a card
     accents: MeasuredColor[];      // chroma >= 25 (Lab C*), ranked by area x chroma, max 4
     ink: MeasuredColor;            // darkest cluster with area >= 0.3%
   };
   export async function measureReferencePalette(image: Buffer, boxes: NormalizedBox[]): Promise<MeasuredPalette>;
   ```

   - Crop each screen box with `sharp` and downsample it to about 120px wide.
   - Quantize in Lab: k-means with k=10 and a fixed seed, or median cut.
   - Background is the dominant low-chroma cluster in the outer ring of each box.
   - Raised is the most common neutral cluster lighter than the background by ΔL 1.5 to 8. Inset is a neutral cluster between the two, or just below the background.
   - With no boxes, use the whole image minus a 4% border.
   - Tests build synthetic images with `sharp`: a cream page, lighter cards, darker tiles, an orange pill and black text blocks. Assert each role within ΔE 3.
   - Add one fixture test on the curated image, allowing ΔE ≤ 4 against the table in 2.1: background `#ECE9D6`, raised `#F7F5E9`, inset `#EFE9D9`, top accent `#FFC068`.
2. **Categories instead of numbers in the analysis prompts** (`prompts.ts`: the full-analysis schema around `:398-520` and the style-analysis schema around `:520-602`):
   - Add `radiusClass`: `"square" | "soft" | "rounded" | "very-rounded"` for 0–4, 6–10, 12–16 and 18–24pt, judged against a 390pt screen width. Code maps these to 4, 10, 16 and 20px.
   - Add `surfaceElevation`: `"flat-tone" | "hairline" | "soft-shadow" | "strong-shadow"`.
   - Scope "Use real numbers, not adjectives" (`:414`) and the exact-shadow-values cues (`:482`, `:489`) to recreate mode only. In style mode the model classifies and the code measures.
   - Parse both new fields in `lib/generation/scope-contract.ts` (`normalizeReferenceAnalysis`) and store them in the reference DNA.
3. **The token prompt uses the measurements** (`prompts.ts:608-716`, `generateDesignTokens` in `service.ts:3902`):
   - When a palette exists, add a "MEASURED COLORS (from the reference pixels; authoritative)" block. The model assigns roles and does not invent hues.
   - Replace "prefer a single standard surface radius, a single standard border width, and a single standard surface shadow" (`:617-618`) and the matching rules (`:677-682`) with the **surface ladder**:
     - page → card (raised) → inset (tiles and fields inside cards) → tints (pastel wells and chips) → one focal accent or gradient surface → at most one strong dark control;
     - radius hierarchy: card ≤ 24px, inset = inner, controls = pill, icon wells = circle;
     - `shadows.surface` is `none` unless the evidence shows cast shadows.
4. **`calibrateGeneratedTokens(tokens, evidence)` in `lib/design-tokens.ts`**
   - Apply it inside `buildApprovedDesignTokens` next to `ensureLegibleGeneratedTokens`. Generated tokens only; a user's token edits stay as written.
   - `radii.app` = min(app, 24px), the founder's rule.
   - `radii.inner` = clamp(inner, 6px, min(16px, app − 4px)) when app ≥ 10px.
   - Leave `radii.pill` unchanged.
   - `shadows.surface`:
     - `none` when elevation is `flat-tone`, `hairline` or unknown;
     - for `soft-shadow`, cap blur at 16px and alpha at 0.08;
     - for `strong-shadow`, keep the model's shadow, because the reference shows it.
   - `shadows.overlay`: cap alpha at 0.16.
   - With a palette: `background.primary` = background, `surface.card` = raised, and the new `surface.inset` = inset.
   - Without a raised color, derive it as a tone step: the same hue, ΔL +3 to +5 in light themes.
   - Snap `action.primary` to the nearest measured accent when it is within ΔE 12.
   - **User-stated colors win.** If the design requirements name colors, skip the snapping for the roles they name. The pet project's facts asked for "Soft Sage" and "Warm Cream".
5. **New optional tokens** (backward compatible):
   - `color.surface.inset`;
   - `color.accent_tints`: 3 or 4 pastel tints, each an accent mixed about 70% toward the background.
   - Add utilities in `lib/token-runtime.ts` (`buildDrawgleTokenCss`): `dg-surface-inset` and `dg-tint-1` to `dg-tint-4`, with text colors that pass the contrast floor.
   - Check every place that enumerates token keys or `dg-*` classes: the builder prompt's utility list, the token editor UI, `lib/design-md.ts`, `lib/generators/*` and `lib/export-pipeline`.
   - Missing tokens must fall back to the card or background values, so old projects render unchanged.

**Tests**

- Palette tests: synthetic images plus the fixture.
- Calibration tests:
  - 32px becomes 24px;
  - the inner radius is clamped;
  - flat evidence gives `shadows.surface: "none"`;
  - strong-shadow evidence keeps the shadow;
  - a user-edited token set is unchanged;
  - a missing `inset` is derived.
- Update the prompt routing tests (`lib/generation/prompts-routing.test.ts`).

**Done when**, on the harness, rebuilding the pet project gives cards ≤ 24px, no card shadows, and card and page colors within ΔE 4 of the measured values.

### Step 3: Keep numbers and materials out of the prose layers

**Why.** Values written in prose are copied downstream as orders, and every later stage amplifies them. Remove them at the source, instead of adding rules that forbid copying them.

**What**

1. **Skip `generateCreativeDirection` when a style reference exists** (curated or uploaded; `service.ts:3946`).
   - It paraphrases an image the builder already sees, and it was the first place that said "32px", "glass-morphism dock" and "cards must be lighter than the background".
   - Keep it for no-reference prompt mode, where it is the only art direction.
   - `generateDesignTokens` then takes the reference analysis plus the measured palette as its evidence.
   - Check the callers that expect `charter.creativeDirection` to be set:
     - the planner blueprint input;
     - `buildDesignThinking("prompt")` in `prompts.ts`;
     - `savedProjectBlueprint` in `lib/generation/saved-blueprint.ts`, which already accepts null.
   - This saves one model call per project.
2. **Nothing numeric in the planner's input in style mode.**
   - With Step 2's categories and item 1 above, the analysis cues and charter no longer carry px, hex or opacity values. Check every field the blueprint and brief prompts receive in style mode: reference DNA, the screen family contract, the transfer contract and `imageReferenceSummary`.
   - The screen family contract builder in `lib/generation/service.ts` (around `:1372`, `portableCraftCues`) copies the first four `stylingCues` verbatim into `consistencyRules`, for example "Warm cream background (#FDFBF0)" and "High corner radius (24pt+)". Pass categories there instead.
3. **Planner rules in style mode** (`prompts.ts:225-340`):
   - "MUST PRESERVE" names structure only: which components, the focal element and the content order. It never names token values or materials.
   - Drop the "Material specificity" rule (`:333`) in style mode. Materials belong to the reference and its preset. Keep the rule in prompt mode.
   - Reword "at least 8 concrete visible layout and composition decisions" (`:340`) so the 8 decisions are about content, hierarchy and components, not values.
4. **Pass the discovery designer's component mapping to the brief planner.**
   - `productPlanning.experience.adaptations` holds lines such as "Mood History row → Pet Selection row" and "Emotional Check-ins chart → Health Progress donut". Today it only feeds `lib/product-planning/project-design-preparation.ts:37`; confirm with a grep.
   - Add it, and later the preset component names from Step 1, to the screen-brief input. Briefs can then say "use the calendar strip for the week selector", "the stat-tile pair for Meals and Meds" and "the donut card for vaccination status".

**Tests**

- A style-mode planner-input test asserts that no `\d+px`, `#[0-9a-f]{3,8}` or `\d+% opacity` substrings come from the charter, analysis or contracts.
- A generation test with a style reference makes no creative-direction call. Mock the model and count calls, as `lib/product-planning/planner.test.ts` does.
- The harness check "px/hex in briefs" reads 0 on the eval set.

### Step 4: The builder composes with the reference's components

**Why.** The reference's premium feel is a component vocabulary on a surface ladder. The builder never received that in a form it can copy, so it fell back to one card recipe.

**What** (`lib/generation/prompts.ts`, builder instruction and `buildStrictDesignContract` at `:737-769`)

1. **STYLE COMPONENTS block.** It comes from the preset in Step 1, or the project specimen in Step 7.
   - Each line is `name — when to use it — html`. Cap it at 10 components and about 6k characters.
   - Rules:
     - build this screen's content from these components wherever they fit its job;
     - a new component must use the same surface ladder, radius roles, type roles and spacing;
     - never reproduce the reference's sections, their order or its content.
   - When the block is present, do not also send the semantic-primitive `qualityDetails` (`reference-transfer.ts`, `semantic-inspiration.ts`). They carried "Radius should be at least 24px" and duplicate what the code shows.
2. **The strict design contract describes the ladder.**
   - Page, card, inset, tint and focal accent, with their classes. Radius roles: card, inner, pill and circle.
   - "Shadows: only where the token defines one."
   - This replaces the single "outer surface radius for cards, sheets, panels, fields, and navigation shells".
3. **Say so when there is no shared nav.** `buildSharedNavigationContract` returns `""` when nav is disabled (`:910`). Return instead: "This project has no persistent bottom navigation. Do not draw a tab bar, dock, bottom navigation, or a floating button that stands in for one. Use this screen's chrome: <chrome_policy>." That prevents the local 2022 nav on Pet Library.
4. Keep what is already on the branch: the reference image on every screen, the design-thinking step and the authority split.

**Tests**

- Prompt tests for the no-nav sentence and for the components block and its size cap.
- The builder prompt contains the ladder classes when the tokens have `surface.inset`.

### Step 5: Sample imagery for avatars and pets

**Why.** Mockups sell with sample photos. The identity rule is right for the user's own face or logo, and wrong for sample content.

**What** (`lib/generation/visual-assets.ts:1021-1028`, `resolveRequirement`)

- Apply the placeholder rule only to identity avatars: `origin: "user_specified"`, or a requirement flagged as the user's own identity. Add that flag to the planner's asset requirement schema if it does not exist.
- Planner-inferred avatars (sample people and pets) go through the normal chain: internal library, then Pexels, then Pixabay. Use a square crop and `assetType: "photo"` instead of `transparent_png`; stock photos are rarely transparent, and a circular avatar does not need it.
- Check that the internal library (`visual_assets`, provider `drawgle_r2`) has people portraits and common pets (dogs, cats, rabbits, birds). Seed it if not; `scripts/audit-repair-visual-assets.ts` is a starting point.
- Alt text: use the requirement subject, never the app prompt.

**Tests**

- A planner-inferred avatar in category `animal` reaches stock candidates.
- A `user_specified` avatar still returns the placeholder.
- Alt text comes from the subject.

### Step 1: Curated style presets, reviewed once and used every time

**Why.** Prompt-to-UI is the main entry path, and it always runs through a curated reference.

- The 46 curated images never change, yet every project re-analyzes its reference at runtime.
- In this project that pass saw one of three phones, invented 32px and glass, and missed the nav items.
- The fix is to compute these facts once with the best model, have the founder check them visually, and reuse them. This is more reliable and cheaper per project.

**What**

1. **Data: `lib/generation/generated/curated-style-presets.json`,** keyed by reference id:

   ```ts
   type CuratedStylePreset = {
     catalogHash: string;          // the catalog entry hash it was built from (see curated-style-index-core.ts)
     approved: boolean;            // set by the founder after visual review; only approved presets are used
     analysis: ReferenceAnalysis;  // complete: every phone in the image
     measured: MeasuredPalette;    // Step 2
     tokens: DesignTokens;         // calibrated (Step 2)
     navigation: ReferenceNavigationEvidence | null; // anatomy, labels, activeTreatment, inactiveTreatment, width, material, item count
     components: Array<{ name: string; use: string; html: string }>; // Step 4 block, <= 10, <= 700 chars each
   };
   ```

   Validate it with zod at load time. A malformed or unapproved entry means there is no preset.
2. **Offline builder: `scripts/curated/build-presets.ts [--id <id> | --all] [--approve <id>]`.** It runs locally with the founder's keys through the env helpers. For each reference it:
   1. Downloads the image.
   2. Runs the full analysis with every screen required, using the strongest configured model. It fails loudly on a screen-count mismatch instead of salvaging.
   3. Measures the palette per screen box.
   4. Generates tokens (`generateDesignTokens`) and calibrates them.
   5. Builds a **specimen**: it runs the recreate builder on the most component-rich phone.
      - It adds one line to that call: "mark each reusable component's root element with `data-dg-component="<kebab-name>"`".
      - It extracts one instance per component name with jsdom, shortening the text content to short samples.
   6. Renders the specimen next to the reference crop into `scripts/curated/out/<id>.png` (git-ignored).
   7. Writes the preset with `approved: false`. `--approve <id>` flips it after the founder has looked at the PNG.
   - One-time cost is about 46 × (analysis + tokens + one build). That is a few dollars even with a Pro model.
3. **Runtime,** for a curated reference whose preset is approved and whose `catalogHash` matches:
   - **Reference DNA** uses `preset.analysis` and `preset.measured`, and skips `analyzeReferenceImageForScope`. The reference DNA is set up in `trigger/generate-ui-flow.ts` around `:2381`; also check `lib/product-planning/project-design-preparation.ts`.
   - **Tokens** are `preset.tokens`.
     - When the user stated colors or fonts (`designRequirements` or approved facts), run the token model seeded with the preset to recolor only the roles they named.
     - Geometry, the ladder structure and shadows stay from the preset.
     - Otherwise make no token call.
   - **Creative direction** is not generated (Step 3).
   - **Navigation style** comes from `preset.navigation`, through `applyReferenceNavigationStyle` (`lib/project-navigation.ts`).
   - **The builder** gets `preset.components` (Step 4).
   - With no approved preset, today's path runs unchanged.
4. **`pnpm run check`.** Extend `scripts/build-curated-style-index.ts --check` to fail on a preset whose `catalogHash` is stale, and to list catalog entries without an approved preset without failing. Presets roll out one by one.

**Tests**

- The preset schema test.
- Selection: an approved preset with a matching hash is used; otherwise the fallback runs.
- With a preset, the model mock sees no analysis, creative-direction or token call when there are no stated colors.

**Done when** the mindfulness preset is approved and the pet project, rebuilt on the harness, uses its components and nav. The founder should prefer it to the baseline.

### Step 6: Navigation is decided in the approved flow (P1)

**Why.** Whether the product has persistent navigation is a product decision. Today a hidden heuristic makes it, and here it contradicted the discovery designer's own description. The user approves the screen list, so they should approve the navigation too.

**What**

- Add `navigation: { persistent: boolean; destinations: Array<{ label: string; screenKey: string | null }>; rationale: string }` to the scope proposal. Update the product-planning model (`lib/product-planning/model.ts`), the proposal schema and prompt, and the approval card.
  - The card shows, for example, "Bottom navigation: Today · Pets · Routines · Family".
  - Destinations without a screen in this flow become `availability: "planned"`.
- Blueprint: an approved decision is explicit evidence (`evidence.source: "approved-scope"`). `enforceNavigationEvidencePolicy` passes it through. An approved "no navigation" stays none.
- Keep the heuristic only for legacy or unapproved flows.
- Renderer: this reference's bar is icon-only and attached, with rounded top corners and the active item in a gradient circle. Render it through `applyReferenceNavigationStyle` on the harness. If the renderer cannot draw a gradient active well, add `activeFill: "solid" | "gradient"` to `NavigationDesignContract` (`lib/types.ts:502-515`) and draw it in `lib/project-navigation.ts`, using `gradients.action_primary`.

**Tests**

- A 2-root approved flow with `persistent: true` keeps its nav.
- An approved `false` stays none.
- A renderer test covers the icon-only circle-active bar.

### Step 7: Uploaded style references get the same treatment (P1)

- Measure the palette (Step 2) whenever an upload is analyzed. It is deterministic and cheap.
- At the project's first generation, build a specimen from the upload's main screen with the recreate builder, the same way as Step 1.2.5. Run it in parallel with planning.
  - Store it in `project_charter.referenceDna.specimen`. Later batches already reuse the project DNA (`trigger/generate-ui-flow.ts:2381`).
  - The cost is one extra build, about $0.013 with Flash.

### Step 8: Complete analysis for multi-screen images (P1)

- When `screenReferences.length < screenCountEstimate`, request the missing screens only, cropped by their bounding boxes, instead of accepting `salvaged_analysis`.
- The salvage path is in `lib/generation/scope-contract.ts` (`:691`, `:1014`) and `lib/generation/service.ts:3140`.
- Curated references avoid this entirely through presets.

### Step 9: Model and reasoning settings (P1; decide on the harness)

- Design tokens: change thinking `minimal` to `low` and drop the 0.35 temperature override (`lib/ai/model-policy.ts`, `service.ts:3944`). With presets, this call mostly disappears for curated references.
- Screen builds: run an A/B on the eval set.
  - Thinking `low` against `high`.
  - Flash against the current Gemini Pro model, through `DRAWGLE_GEMINI_FULL_BUILD_MODEL`. Check the provider's model list for the current id.
  - Record tokens and cost per screen. At about 9k in and 3k out, Pro costs roughly 4× Flash per build: about $0.05 against $0.013.
- Choose per mode on evidence. For example, the Pro model could be used only for the first screen of a project.

---

## 5. Cost impact (per project, Flash)

| Change | Effect |
| --- | --- |
| Curated preset (Step 1) | Removes the runtime analysis, creative-direction and usually the token calls |
| Creative direction skipped for style references (Step 3) | −1 call |
| STYLE COMPONENTS block (Step 4) | About +1.5k input tokens per screen, about +$0.0008 |
| Upload specimen (Step 7) | +1 build per project with an uploaded style reference, about +$0.013 |
| Tokens thinking `low` (Step 9) | Small; one call per project |
| Pro build model (Step 9, only if chosen) | About ×4 build cost |

Net: cheaper per curated project than today, unless a stronger build model is chosen on evidence.

## 6. What not to do

- **Do not add prose rules to the builder prompt to fix a look.** Every extra rule is text competing with the image. Fix the inputs: measured tokens, components and clean briefs.
- **Do not add validation that rejects model output and retries.** It costs a call and does not improve design.
- **Do not lower the build temperature.** Gemini 3 is tuned for its default, and the branch already removed the 0.2 override.
- **Do not hardcode this reference's colors or components anywhere.** They come from its preset.
- **Do not bring back the viewport repair rebuild** that was removed on this branch.

## 7. Launch acceptance

- On the eval set, the founder prefers the new output to the baseline for at least 5 of the 6 prompt cases and at least 1 of the 2 upload cases.
- Harness checks:
  - no card radius over 24px;
  - no card shadows for flat references;
  - card and page within ΔE 4 of the measured values for curated references;
  - no screen-local tab bar while shared nav is off;
  - sample avatars and pets are photos;
  - no px, hex or opacity values in briefs.
- Recorded cost per screen within +20% of today on Flash.
- `pnpm run check` passes, and so do `pnpm exec vitest run` and `pnpm run test:canvas`.

## 8. Working rules for the implementing session

- Read `AGENTS.md` first:
  - **Never** read, grep or print `.env` or `.env.*` files, keys or tokens. To know which variables exist, read `.env.example` or `process.env.*` references in code.
  - Use explicit enum casts in SQL (`public.generation_status`, `public.project_status`).
- Run `pnpm run check` and the Vitest suite before every push.
  - The suite needs Chromium for the viewport tests. Locally, `pnpm exec playwright install chromium` is enough.
  - The cloud container needed a browser path shim; locally you should not.
- Commit in small steps, one step of section 4 per commit, each with its tests. Work on `claude/drawgle-app-flow-planning-s19wmc` or a branch from it. Open a PR only when the founder asks.
- After each step, run the harness on the pet project and at least two other eval cases. Put the contact sheets in the commit message or the PR, so the founder can judge.
