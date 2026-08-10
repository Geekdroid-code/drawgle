# Generation Pipeline Updates

This file is the maintainer history for production generation behavior. Keep the current-logic section accurate and append dated entries; do not erase the reason a guardrail exists.

## Current Generation Logic

### Mode and image ownership

| Mode | Final builder image | Image role | Structural authority |
|---|---|---|---|
| Image to UI (`user_recreate`) | Required | `structural-reference` | Uploaded image and recreate screen target |
| Uploaded Style Reference (`user_style`) | Attached when the guarded contract is valid | `style-calibration` | Product screen layout and named target regions |
| Curated/internal style | Attached when a source image and guarded contract are available | `style-calibration` | Product screen layout and named target regions |
| Prompt only | Never | None | User prompt and planned screen contract |

`DRAWGLE_STYLE_REFERENCE_CALIBRATION_ENABLED=false` disables style-image attachment for new builds. Analysis, creative direction, tokens, and the text transfer contract remain available as the safe fallback.

### Planner and builder models

- Project blueprint and screen planning use the configured Gemini planning policies.
- The final screen builder is selected independently through the builder provider/model configuration.
- Attempt diagnostics record provider, requested builder model, actual attempted/completing model, and fallback use. They must not infer the builder from the Gemini planning policy.

### Style-reference evidence priority

1. Explicit user and product requirements.
2. Target screen layout regions and product-owned navigation semantics.
3. Version-2 reference-transfer calibration rules.
4. Approved design tokens and creative direction.
5. Raw image observation only inside the calibration rules.

The normalized per-screen description and layout contract go to the builder. Raw blueprint output and duplicated `Planner Brief` text do not.

### Style charter

- Every run resolves one `StyleCharterV1` before creative direction. Curated runs derive it from the reference's hand-authored `selectionProfile`; uploaded and prompt-only runs derive a weaker observational charter.
- Precedence is explicit user prompt, then curated catalog, then per-run reference analysis. A model-generated analysis never vetoes a hand-authored catalog profile; disagreements are recorded on the token metadata.
- The charter bounds surface elevation, shadow blur and alpha, glass and gradient permission, heading font class, base-color OKLCH band, accent chroma, and the section-gap band. It reaches creative direction, token generation, the planner, the builder, and edits.

### Token relationships

- Token sets are validated as a system after normalization and before persistence: surface/background hue and lightness relationship, charter conformance, spacing-scale coherence, layout-gap membership in that scale, macro/micro gap ratio, border width and divider visibility, type scale against the 844px frame, and the text contrast ramp.
- High and medium emphasis text targets 4.5:1. Low emphasis targets 3:1 — raising it further collapses the emphasis ladder into two indistinguishable tiers.
- Repairs are idempotent. `DRAWGLE_TOKEN_RELATIONSHIPS_ENABLED=false` makes them diagnostics-only.

### Concentric geometry

- A nested surface's radius equals its parent's radius minus the gap between their edges. `radii.inner` is derived from the element gap; `radii.inset_*` provides one correct value per spacing step, exposed as `dg-radius-inset-*`.
- The normalizer walks real DOM nesting and repairs radii that violate the law, running after the role-based rules so a correct value is not rewritten back to the generic token. Interactive controls and primary CTAs keep their shape-policy radius.
- A child gap wider than the padding of the surface containing it is a rhythm inversion and is corrected. `DRAWGLE_GEOMETRY_CONTRACT_ENABLED=false` makes both diagnostics-only.

### Layout contract v3

- Screen plans carry a numeric `viewportBudget` (per-region min/max heights, above-fold selection against the 844px frame) and `regionContracts` (arrangement, sibling balance, item count, shared item anatomy, copy budget).
- Multi-column arrangements are forced to equal-height siblings with one shared anatomy and a copy budget; only horizontal-scroll rails may use independent heights.
- A region reserving more than 120px must be carried by media, a chart, a list, a form, or a focal cluster, otherwise its minimum is clamped. Above-fold minimums that exceed the frame demote the lowest-priority region rather than shrinking everything.
- Values are derived deterministically when the planner omits them; stored v1/v2 contracts keep parsing and gain derived v3 values. Nothing here fails a plan.

### Design critic

- Static composition checks run alongside contract normalization: sibling imbalance in a row, decorative dead space, CSS-fabricated object art, above-fold budget, raw palette surfaces, surface text contrast, and off-system radius drift.
- Only raw palette surfaces are repaired. The rest warn into `quality_diagnostics` and never trigger a paid builder retry.
- Correct concentric radii are not counted as radius drift; drift means radii chosen outside the token ladder.

### Geometry and typography

- Reference analysis records component-role measurements with confidence, scope, source screens, and source layer.
- Phone shells, status bars, collage gutters, mockup backgrounds, and device corners are excluded from app tokens.
- High-confidence app measurements may deterministically set matching token roles. Missing or low-confidence measurements retain the generated-token fallback.
- A named font is accepted only when the reference analysis supports that family. Otherwise Style Reference runs use system-safe font stacks rather than an invented family.
- Scope confidence and visual-evidence confidence are separate. A reliable visible-screen count cannot make missing geometry, motifs, or navigation appearance look high-confidence.

### Builder continuity contract

- Every initial build, retry, add-screen build, and supported edit receives one compact `BuilderProjectContractV1`.
- It contains product identity, the current target screen and named regions, product-owned navigation, screen-family rules, and the approved component-shape policy.
- It never contains raw planner/roadmap JSON, `Planner Brief`, another screen's detailed topology, reference-domain content, or a duplicated original prompt.

### Prompt scope and image requirements

- Numbers describing layout anatomy (for example, a 2-column grid), quantities, cards, images, rows, and steps inside one screen never become screen counts.
- Descriptive mentions such as "the home shows..." and "tapping an item opens..." are product requirements, not automatically the complete finite project scope.
- A prompt caps generation to a named screen set only when it uses direct bounded screen language or explicit finite terms such as `only`, `exactly`, `following`, or `screens:`.
- Explicit image/image-grid requests make compatible non-icon asset requirements critical and user-owned. Stock-photo semantic matching uses category-specific vocabulary; nature imagery is not required to contain commerce words such as `product` or `item`.

### Motif locality

- Global material rules may apply across the project.
- Component-local motifs require a target region with the same function.
- Screen-local decoration is rejected unless the target independently requires it.
- An allowed motif can appear only inside its named target region. For example, dotted chart grid lines may appear inside an approved chart plot and nowhere else.

### Navigation ownership

- Product architecture owns whether navigation exists, its destinations, labels, links, and root/detail roles.
- Reference evidence may supply appearance without supplying destination semantics.
- A root dock remains valid appearance evidence even when detail reference screens intentionally omit it.
- Version-3 navigation renders from an appearance recipe rather than an anatomy-specific dimension template.
- Legacy version-1 and version-2 stored plans remain readable and render through their compatibility behavior.
- New project-native V3 dimensions come from navigation/design tokens. Reference-owned dimensions come only from validated measurements. Curated catalog tags may select coarse anatomy/material but never invent pixel measurements.
- Planned-but-unbuilt destinations remain in roadmap semantics and are not rendered as disabled V3 items.
- Explicit back, modal, immersive, checkout, authentication, or finite-flow chrome suppresses the bottom dock.

### UI contract repair and QA

- `normalizeGeneratedUiContracts()` runs before token-drift diagnostics and persistence for generated screens and screen edits.
- Exact known aliases and confident status/radius-role mistakes are repaired deterministically. There is no fuzzy token-name matching.
- Unknown variables, ambiguous artistic containers, truncation risks, and residual token drift are saved as warnings. They do not trigger a paid builder retry or fail a usable screen.
- Blank, unsafe, malformed, structurally broken, or genuinely unrenderable output still follows the existing failure gates.
- Owner previews report bounded rendered measurements after Tailwind and fonts are ready. Public/read-only previews never write telemetry; source HTML, prompts, image data, and full text content are never sent.
- QA telemetry is an optional side effect, never a screen-persistence dependency. If the telemetry migration or PostgREST schema cache is unavailable, the same screen write is retried once without `quality_diagnostics`; normal screen reads do not select the optional field.
- A failed screen query is an unavailable workspace, never an empty project. The project route stops and offers a retry instead of replacing persisted screens with an empty canvas.
- Generated iframe content remains hidden behind a style-runtime gate until a computed-style probe confirms Tailwind utilities are active. A Tailwind JavaScript global alone is not considered proof that CSS exists; bounded CDN retries run before a visible degraded-state message.
- `DRAWGLE_UI_CONTRACT_REPAIR_ENABLED=false` changes the normalizer to diagnostics-only mode without removing telemetry.

### Progressive planning, assets, and billing

- `/project/new` never blocks a normal open-ended app brief with a screen-scope confirmation modal. Low-confidence or non-finite scope remains diagnostic context and is resolved by the authoritative blueprint after redirect. Existing-project/add-screen ambiguity may still be clarified through the canvas chat workflow.
- New multi-screen projects first produce one authoritative `ProjectBlueprintPlanV1`: charter, navigation, screen-family rules, roadmap, and ordered screen seeds. It intentionally contains no detailed screen topology.
- The detailed planner briefs only the first seed initially. As soon as that brief and its reserved screen row are ready, Drawgle triggers the user-selected builder. Only after that trigger does one bounded call brief every remaining seed.
- Screen 1 keeps exclusive scheduler priority. Later parent screens retain the existing concurrency of two. Single-screen, add-screen, retry, and state-only paths retain their compatibility flow.
- Asset requirements resolve inside each child screen build. The builder streams styled empty slots while lookup runs; persistence waits for deterministic hydration, URL sanitization, and the existing critical-asset gate.
- Asset searches abort after 5 seconds, downloads after 8 seconds, and each requirement receives a 15-second budget. At most two requirements resolve concurrently per screen.
- Parent-screen credits are reserved from the blueprint before any builder starts. State variants discovered by the remaining brief tranche are appended atomically and idempotently; insufficient optional-state credits skip only those states.
- A later planning failure never rolls back a ready first screen. Outstanding reservations are released by normal run settlement.
- `DRAWGLE_PROGRESSIVE_FIRST_SCREEN_ENABLED=false` restores the all-screen planning and project-wide asset-resolution path for new runs.

## 2026-08-10 — Design Brain: Charter, Token Relationships, Concentric Geometry, Layout Budget

### Symptom

A "premium cosmetics" project matched to the curated reference `cosmetics-ecommerce-minimal-light` produced screens that contradicted that reference in four ways and failed basic spatial craft. Observed in production project `6c6ff9da-1973-47d0-a3d3-78f3d1b4a996`:

- Tokens used a serif heading family, a warm beige base, an inset-highlight plus drop-shadow surface, and a glass navigation dock at 20px blur. The catalog profile for that reference declares `geometric-sans`, `clean-base`, `matte`/`flat-layered`, and excludes `glassmorphism` and `heavy-shadows`.
- `surface.card #FFFFFF` sat on `background.primary #F5F2ED` with a 0.038 lightness step and a 0.03-alpha shadow; a neutral card on a warm page read as an error rather than a layer.
- `spacing` was `0/4/8/12/24/32/48/64` while `element_gap` was `16px`, so the most-used gap in the app was not a member of its own scale. `section_gap` was 3x `element_gap`. `border_widths.standard` was `0.75px`. `text.low_emphasis` was 2.6:1 on white.
- A 32px card contained a 16px-radius surface inset by 8px. The concentric value is 24px, so every nested corner read tighter than the shell around it.
- A two-card row used unequal fractional tracks, media wells of 212px and 158px, a manual 24px offset on one card, and `items-start`, then filled each media well with a CSS-drawn rectangle standing in for a product.

### Root cause

- `buildCuratedStyleRetrievalDocument()` was the only consumer of `selectionProfile`, and only to build the retrieval embedding. After a reference was selected its hand-authored profile was discarded, so creative direction invented a palette and type voice, token generation faithfully converted that invention, and the matched reference never constrained either.
- `enforcePlatformConstraints()` validated token *shapes* (is this a px string, is `inner` below `app`) and never token *relationships*.
- Radius normalization was role-based. A single global `radii.inner` cannot be correct for more than one nesting gap, and `normalizeGeneratedUiContracts()` had no view of nesting, so it could neither detect the mismatch nor avoid rewriting a correct value back to the generic token.
- `layout_contract` v2 was five prose fields. No quantity in it described vertical space or content volume, so "asymmetric grid" reached the builder with no baseline, anatomy, or copy budget attached.
- QA measured safety, completion, asset policy, and token naming. Nothing measured composition.

### Change

- Added `StyleCharterV1` (`lib/generation/style-charter.ts`). Curated `selectionProfile` tags become bounded constraints (elevation ceiling, shadow blur/alpha ceiling, glass and gradient permission, heading font class, base-color OKLCH band, accent chroma ceiling, section-gap band). Precedence is explicit user prompt, then curated catalog, then per-run reference analysis. Charter reaches creative direction, token generation, the builder, and the edit path; conflicts with the run's analysis are recorded, not silently resolved.
- Added `validateTokenRelationships()` (`lib/design-tokens-relationships.ts`) and OKLCH/contrast math (`lib/color-math.ts`). Repairs surface/background hue and lightness relationships, charter conformance, spacing-scale coherence and membership, macro/micro gap ratio, border width and divider visibility, type scale against the viewport, and the full text contrast ramp.
- Added the concentric radius law. `radii.inner` is derived from the element gap, and `radii.inset_xxs..inset_lg` are emitted per spacing step with matching `dg-radius-inset-*` utilities. `applyGeometryContract()` (`lib/generation/geometry-contract.ts`) walks real DOM nesting, repairs radii that violate the law, and flags child gaps wider than the padding containing them. It runs after the role-based rules so a correct concentric value is not undone.
- Added layout contract v3 (`lib/generation/layout-budget.ts`): `viewport_budget` with per-region min/max heights and an above-fold selection, and `region_contracts` with arrangement, sibling balance, item anatomy, and copy budget. Resolved deterministically for every plan including stored v1/v2 contracts.
- Added `runDesignCritic()` (`lib/generation/design-critic.ts`): sibling imbalance, decorative dead space, CSS-fabricated object art, above-fold budget, raw palette surfaces, surface text contrast, and off-system radius drift. Reported into `quality_diagnostics`.
- Added `scoreDesignBenchmark()` (`lib/generation/design-benchmark.ts`) for per-rule pass rates over a screen set.

### Safety invariants

- The style image and the curated profile still never own target information architecture, screen count, or navigation destinations.
- An explicit user request outranks the charter. A per-run reference analysis never does; where they disagree the catalog wins and the conflict is recorded.
- Only exactly-known defects are repaired. Sibling imbalance, dead space, fabricated object art, and budget overruns warn and save.
- No new model call, no visual-refinement pass, no per-screen design review. Every layer added here is deterministic.
- No paid builder retry is triggered by any rule in this change, preserving the existing rule that CSS and token drift never purchase another builder call.
- Token relationship repair is idempotent; re-normalizing a repaired token set produces no further changes.
- Where no element gap is known, radius derivation falls back to the previous proportional behavior, so stored token sets keep their exact hierarchy.

### Verification

- Full Vitest run: 49 files, 355 tests passed. `lib/canvas-camera.test.ts` remains a pre-existing `node:test` file that vitest cannot collect; it passes 7/7 under `node:test` on a clean tree.
- `pnpm run typecheck` clean. `pnpm run lint` reports zero errors and the one pre-existing `react-hooks/exhaustive-deps` warning in untouched `components/CanvasArea.tsx`.
- Scored against the five real screens and stored tokens of project `6c6ff9da`: benchmark pass rate 70.0% on the shipped output, 82.5% after token relationship repair alone, and 95.6% after token plus geometry repair, with 19 concentric-radius and gap repairs applied across the five screens. The two remaining findings are the ragged two-card row and the CSS-drawn product shape — both plan-time defects that layout contract v3 addresses at the planner, and both correctly reported rather than silently rewritten.
- Live Gemini/Luna acceptance for newly generated projects remains a deployment check; these numbers are replay against stored production output and do not claim a model-behavior result.

### Rollout and rollback

- No database migration. `screens.quality_diagnostics` is still absent in production, so critic output is dropped by the existing `PGRST204` compatibility path until `20260809000100_screen_quality_diagnostics.sql` is applied.
- `DRAWGLE_TOKEN_RELATIONSHIPS_ENABLED=false` makes relationship checks diagnostics-only.
- `DRAWGLE_GEOMETRY_CONTRACT_ENABLED=false` makes the concentric radius and gap rules diagnostics-only.
- `DRAWGLE_UI_CONTRACT_REPAIR_ENABLED=false` continues to disable all normalizer repair including the two above.
- Existing screens are never rewritten. Stored v1/v2 layout contracts keep parsing and gain derived v3 values.

## 2026-08-09 — Progressive First-Screen Generation

### Symptom

New projects waited for every detailed screen brief and every project asset before inserting or building the first screen. Production telemetry showed roughly 90 seconds before the first builder, 119 seconds before first streamed HTML, and 137 seconds before the first ready screen; slow remaining briefs or stock providers blocked screen 1 even when its own contract was ready.

### Root cause

- `planUiFlow()` combined the validated project blueprint with one all-screen detailed-planning call.
- Parent orchestration resolved the full project asset manifest before creating the first queued screen row.
- The existing scheduler already prioritized screen 1, but it received work only after both global barriers completed.
- The original credit RPC treated the first reservation manifest as immutable, so later-discovered state variants could not be billed safely.

### Change

- Added `planProjectBlueprint()` and ordered `ScreenPlanningSeed` output while keeping `planUiFlow()` as a compatibility wrapper.
- Added a bounded two-tranche planner: first seed, then one remaining-seed batch started only after the first builder trigger.
- Moved asset resolution into `build-screen`, added pending-slot builder instructions, bounded provider latency, and hydrated assets before ready persistence.
- Added `append_generation_credit_reservations(...)` and `appendGenerationCredits()` for atomic incremental state reservations.
- Added blueprint/brief/builder timestamps and per-screen asset timing to generation metadata.

### Invariants and failure behavior

- Blueprint screen identity/order, product purpose, navigation destinations, and family rules remain authoritative in both tranches.
- There is no provisional low-quality builder, per-screen planner fan-out, visual-refinement pass, or asset-hydration LLM call.
- Critical imagery still blocks only its own screen; supporting timeouts remain warnings/placeholders.
- If the first brief is invalid after its bounded repair, the first valid remaining brief is promoted. If remaining planning fails after handoff, completed screen 1 survives and unfinished roadmap credits are released.
- Planner model ownership remains Gemini; builder provider/model ownership remains user-selected Gemini or Luna/OpenRouter.

### Rollout and rollback

1. Apply `20260809000300_append_generation_credit_reservations.sql` and reload PostgREST schema.
2. Deploy Trigger tasks and the web application together.
3. Smoke-test with `DRAWGLE_PROGRESSIVE_FIRST_SCREEN_ENABLED=false`, then enable the default progressive path.
4. Roll back instantly with the flag; the additive database function is harmless if left installed.

### Verification

- Focused planner, prompt/asset-contract, visual-asset, scheduler, and credit tests cover the extracted contracts and compatibility behavior.
- Typecheck verifies both the legacy and progressive orchestration branches.
- Production latency targets require at least 20 representative deployed runs and must be evaluated from the new performance timestamps; local unit tests do not claim production timing.

## 2026-08-09 — New-Project Scope Confirmation Removed

- Symptom: an ordinary product prompt describing booking, service selection, time, map location, and payment was blocked on `/project/new` because it did not enumerate a finite screen list.
- Root cause: semantic scope uncertainty was incorrectly treated as a required pre-payment confirmation, and `ProjectLobby` rendered the server’s 409 as a page-level modal.
- Change: new-project scope uncertainty is now preserved as planner diagnostics and deferred to the canvas; the blueprint chooses the bounded initial batch. The lobby modal and its client retry state were removed.
- Invariant: explicit screen counts and names remain authoritative. Existing-project/add-screen requests may still request clarification through the canvas workflow. This does not relax the eight-output or credit-reservation limits.

## 2026-08-09 — Deterministic UI Contract and Runtime QA Hardening

### Symptom

Generated screens could silently lose spacing through unknown CSS variables, use different radii for the same control role, bypass semantic status colors, combine back chrome with a bottom dock, render the same generic navigation recipe, and miss visible truncation or collapsed layout. Tailwind configuration also executed before the CDN global existed.

### Root cause

- Style analysis did not consistently require navigation, geometry, and motif sections, while screen-count confidence was incorrectly reused as visual confidence.
- Navigation appearance was normalized incompletely, planner-authored transfer-region mappings were trusted, and deterministic fallback mappings were appended a second time.
- Builders had target screen briefs but no compact saved product/screen-family contract.
- Radius instructions described overlapping exceptions without one evidence-owned role map.
- Generated CSS had drift detection but no exact alias repair or unknown-variable registry.
- V3 navigation still mixed appearance contracts with template dimensions and rendered planned destinations as disabled items.
- The preview placed `tailwind.config` before the V3 Play CDN script and had no persisted rendered audit.

### Change

- Unified required reference-analysis evidence, added Gemini response schema validation, one bounded analysis repair, and separate scope/visual completeness diagnostics.
- Added `BuilderProjectContractV1` to generation, retry, and edit builder paths.
- Added semantic status roles, navigation tokens, and an evidence-gated `DesignComponentShapePolicy`.
- Added exact deterministic CSS alias/status/radius normalization with warning-only residual drift.
- Recomputed transfer-region assignments from primitive kind and target function; planner mappings can no longer create unrelated placements or duplicates.
- Made V3 reference geometry measurement-owned and project-native geometry token-owned; removed disabled unbuilt destinations and enforced back/dock exclusivity.
- Corrected Tailwind V3 script ordering with an idempotent config function used after initial and retry loads.
- Added nullable `screens.quality_diagnostics`, bounded owner-only persistence, stale-hash rejection, and non-blocking iframe audits.

### Repair, warn, and fail policy

- Repair: exact known alias, clearly semantic status color, or confidently identified standard control radius.
- Warn and save: unknown CSS variable, ambiguous radius role, raw non-semantic color, truncation risk, residual cosmetic drift, or rendered geometry warning.
- Fail: only existing structural, safety, malformed-source, blank-output, required-asset, or unrenderable-health failures.
- Never purchase another builder call solely for CSS/token drift.

### Shape-policy invariants

- Cards, panels, sheets, navigation shells, and fields use `radii.app`.
- Nested surfaces, standard buttons, segmented items, and active navigation states use `radii.inner`.
- Segmented containers use `radii.app`; chips, badges, avatars, and circular icon wells use `radii.pill`.
- Primary CTAs or segmented items use pill geometry only when user, reference, or design-style evidence explicitly links that component role to a capsule.

### Rollout and rollback

- New generation and subsequent edits use repair plus diagnostics by default. Existing screens are not rewritten.
- Set `DRAWGLE_UI_CONTRACT_REPAIR_ENABLED=false` for diagnostics-only behavior. The nullable JSONB column may remain during rollback.
- Style calibration attachment and its independent kill switch are unchanged. V1/V2 navigation stays on its compatibility renderer.

### Verification

- Relevant Vitest run: 31 files and 227 tests passed.
- `pnpm.cmd run typecheck` and the optimized Next.js production build passed.
- Final lint completed with zero errors and one pre-existing `react-hooks/exhaustive-deps` warning in untouched `components/CanvasArea.tsx`.
- The compiled canvas fixture reached `data-drawgle-style-ready="ready"` at the nominal 390x844 screen frame with Tailwind utilities applied, no `tailwind is not defined` error, no horizontal overflow, and no critical truncation after the audit's clipping check was corrected. The local browser backend clamped its attempted narrower override to the standard canvas width, so this handoff does not claim a narrower-frame visual result.
- Live Gemini/Luna acceptance remains a deployment task requiring production credentials and generation budget; unit tests do not claim a visual score.

## 2026-08-09 — Guarded Style Reference Builder Image Restoration

### Symptom

Style Reference projects retained little beyond broad color. Relative scale, density, restraint, component construction, optical balance, and navigation character were lost before the final builder. Generated screens looked like generic product-category templates.

### Root cause

Style images had been removed from final builder input. The removal protected against a real earlier failure where source-local details, such as dotted chart lines, spread across every generated screen. The binary attach/withhold policy was safe from copying but discarded too much visual evidence. Aggregate prose also conflated device-shell geometry with app geometry and treated local motifs as if they were reusable design-system rules.

### Change

- Restored uploaded, curated, and internal style images as `style-calibration` evidence.
- Required a version-2, `screen-purpose` transfer contract before attachment.
- Added named target regions, visual invariants, region-scoped composition adaptations, local motif decisions, and forbidden literal transfers.
- Added structured geometry and motif extraction, device/mockup exclusion, confidence preservation, and deterministic high-confidence token projection.
- Added a default-on production kill switch.

### Safety invariants

- The style image never owns target information architecture.
- It cannot introduce an unplanned region, component, source text/value/brand, or domain object.
- Local motifs cannot leave approved target regions.
- Invalid or missing calibration contracts withhold the image instead of sending unrestricted evidence.
- Asset-manifest and static-HTML restrictions are unchanged.

### Compatibility and rollback

No database migration is required because reference DNA and navigation plans are stored as JSON. Old contracts normalize into safe current contracts. Set `DRAWGLE_STYLE_REFERENCE_CALIBRATION_ENABLED=false` to restore analysis-only Style Reference builder input for new runs.

### Verification

- Automated contract, motif-locality, geometry/device-exclusion, prompt-boundary, and navigation tests are maintained in the generation test suites.
- Final typecheck, relevant Vitest suites, and lint are recorded in the implementing task handoff.
- A Gemini/Luna visual comparison using the finance-to-sneaker case remains a deployment acceptance check whenever production credentials and generation budget are available; do not claim a visual score from unit tests.

## 2026-08-09 — Builder Model Diagnostics Correction

### Symptom

Stored screen-build attempts could report Gemini even when the selected builder was Luna through OpenRouter.

### Root cause

Attempt diagnostics called the Gemini `screen_build` policy instead of observing the configured builder request and provider events. Planning and building are independent model stages.

### Change

Diagnostics now store provider, requested builder model, actual attempted/completing model, fallback use, image role, calibration version, navigation appearance source, and geometry-confidence summary. Image bytes are never logged.

### Verification

Pure diagnostics tests cover a Luna request and an OpenRouter fallback to a different model.

## 2026-08-09 — Optional QA Schema Compatibility Hotfix

### Symptom

Production builders completed and returned usable HTML, but every screen was marked failed while saving. PostgREST returned `PGRST204` because `screens.quality_diagnostics` was not yet present in its schema cache.

### Root cause

The hardening release described the new diagnostics column as nullable and non-blocking, but the generated-screen write included it unconditionally. Deploying application and Trigger code before the database migration therefore made optional telemetry a mandatory dependency. Core screen reads also selected the optional field, creating the same deployment-order risk on read paths. The repository's GitHub workflow deploys Trigger tasks only; it does not apply Supabase migrations, so pushing the migration file could not create the production column.

### Change

- Screen persistence now recognizes only the exact missing-`quality_diagnostics` schema error and retries the same database write once with that telemetry field omitted.
- The retry reuses the already generated HTML and does not call the builder again, consume model budget, downgrade status, or hide unrelated database errors.
- Initial generation, builder edits, deterministic element edits, and agent-driven direct edits share the compatibility behavior.
- Core screen queries no longer select optional QA telemetry. The owner-only telemetry endpoint returns an accepted/ignored response while its schema is unavailable.
- The migration explicitly asks PostgREST to reload its schema cache after adding the column.
- Pre-persistence logs no longer claim a screen was saved before the database write succeeds.

### Safety invariants

- Missing optional telemetry can never fail a usable paid screen.
- Only `PGRST204`/`42703` errors naming `quality_diagnostics` activate the fallback; permission, ownership, constraint, connectivity, and other schema failures still surface.
- The original patch is not mutated, and only the telemetry field is removed from the retry.

### Verification

- Regression coverage reproduces the exact production `PGRST204` message, confirms the second patch retains screen code/status/index data, and confirms unrelated failures are neither hidden nor retried.
- Focused tests, typecheck, lint, and production build results are recorded in the implementation handoff.

### Rollout and rollback

Deploy this code independently of the migration; it is safe before or after the column exists. The migration should still be applied to enable stored QA telemetry. Rolling application code back remains safe while the nullable column exists.

## 2026-08-09 — Scope, Preview Styling, and Asset Retrieval Reliability

### Symptom

A plant-care prompt mentioned a `2-column image grid`, described a Home screen and a Plant Details screen, and produced only those two screens. During streaming, raw HTML appeared without utility styling. After refresh, the canvas appeared empty even though generation reported success. Plant-photo requirements resolved entirely to placeholders.

### Root cause

- The semantic scope interpreter correctly ignored the grid's `2`, but incorrectly promoted descriptive Home/Details behavior into the complete finite project scope without explicit bounded-screen language.
- Both screen rows and complete generated HTML remained in production. The deployed project reader selected the optional, not-yet-migrated `quality_diagnostics` column; its failed query was converted to `[]`, falsely presenting a blank canvas.
- The iframe readiness path trusted `window.tailwind`, but Drawgle's config bootstrap can create that object before Tailwind has generated CSS. The pending-state function also left an earlier ready flag in place during rerenders, exposing raw HTML.
- Nature requirements using a product-card role were subjected to commerce-vocabulary matching. Valid plant photographs did not contain generic words such as `product` or `item`, so every candidate was rejected as `no_semantic_match`.

### Change

- Added a deterministic finite-scope gate after semantic interpretation. Layout quantities remain local anatomy, and screen descriptions remain open-ended unless the user directly requests a bounded screen set.
- Project screen-query failures now enter a retryable route error state rather than rendering an empty project.
- The preview hides generated content until a computed Tailwind probe passes, reruns readiness for every render payload, retries CDN loading within a bounded window, and reports a safe degraded state without exposing an unstyled skeleton.
- Plain image/image-grid requests are recognized as explicit imagery. Category-specific product vocabulary is enforced only when that category actually defines such vocabulary, allowing semantically matching nature imagery to qualify.

### Safety invariants

- Direct requests such as `Create a Home screen and a Plant Details screen` and explicitly finite lists remain bounded.
- Persisted screens are never represented as absent merely because their read failed.
- A failed styling runtime does not mutate or delete saved HTML.
- Stock candidates must still pass subject/category semantic matching; the change removes an inapplicable commerce gate rather than accepting arbitrary photos.

### Verification

- Regression tests cover the reported plant prompt, direct bounded screen syntax, explicit image-grid ownership, and a Monstera nature candidate without commerce terminology.
- ScreenNode coverage verifies the computed-style gate and rejects the former Tailwind-global readiness shortcut.
- Production database inspection confirmed both reported screen IDs, ready statuses, and non-empty HTML remained stored.

### Rollout and rollback

Deploy the web application as well as Trigger tasks. A Trigger-only GitHub Action deployment cannot update the project reader or iframe runtime. The changes require no database migration and do not rewrite existing screens.

## Future Entry Template

## YYYY-MM-DD — Short title

### Symptom

What users or production telemetry showed.

### Root cause

The verified code/data cause, including the previous reason for affected guardrails.

### Change

What behavior and interfaces changed.

### Safety invariants

What must remain true and which prior regressions must not return.

### Verification

Tests, live cases, model/provider matrix, and observed results.

### Rollout and rollback

Default state, feature switch, compatibility notes, and exact rollback path.
