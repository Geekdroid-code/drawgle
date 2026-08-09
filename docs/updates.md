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
- `DRAWGLE_UI_CONTRACT_REPAIR_ENABLED=false` changes the normalizer to diagnostics-only mode without removing telemetry.

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
