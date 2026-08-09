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
