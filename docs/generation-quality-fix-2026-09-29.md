# Screen generation: lost screens, reference fidelity, cost (2026-09-29)

This follows `planning-flow-fix-2026-09-29.md`. It covers project `8968251e` ("Build a premium task management app"), tested after that fix was deployed.

## 1. Built screens were saved as failed

**What users saw.** All three screens streamed onto the canvas, but chat reported "0 of 3 delivered · 3 failed". The flow stopped as "blocked by a failed prerequisite".

**Cause.** The `build-screen` Trigger run failed with `page.evaluate: ReferenceError: __name is not defined` at `inspectScreenViewport` (`lib/generation/viewport-health.ts`), called from `trigger/generate-ui-flow.ts`.

- The Trigger.dev bundler (esbuild `keepNames`) wraps inner functions in a `__name()` helper that exists only in Node.
- The mobile layout check passed such a function into headless Chromium, so every production check threw. This happened after the screen had streamed and before it was saved.
- The row stayed a placeholder (`design_revision` 0) and credits were released.

A local esbuild `keepNames` bundle reproduces the exact error.

**Fix: prevention, no new checks.**

- The in-page probe is plain source text (`VIEWPORT_PROBE_SOURCE`), which no bundler rewrites.
  - The same keepNames bundle now runs clean and still detects overflow.
  - `viewport-probe.test.ts` pins the rule that only source text is sent into the page.
- The layout measurement runs **after** the save and is recorded as diagnostics (`screenBuildDiagnostics:*`, `viewportIssues`).
  - It no longer pays for a full rebuild or marks a screen failed. That repair path would have gone live with the `__name` fix alone.
  - A fault in the browser is logged as `viewportInspection: "unavailable"` and cannot discard a screen.
- A failure to queue the memory refresh no longer fails a saved screen.
- The orchestrator decides success from the saved `screens` row, not from the child run's exit status.

**Resume.** "Your description could not be processed" under **Resume remaining work** was not a Resume failure; Resume works (`resume_product_generation` clears failed claims). Two things caused the message:

1. The coordinator described failed work as "blocked". It now says: "Some approved screens could not be built…".
2. `cleanErrorMessage` mapped any text containing "blocked" to the safety-block message. It now matches only real provider safety signals.

## 2. The reference was not reaching the design

This is where each design decision was lost, with the evidence for this project.

| Where | What happened |
| --- | --- |
| Builder input | The reference image was attached only to the first screen of a new project. Every other screen, including every later batch, built from text. |
| Planner | In style mode the planner writes screen briefs without the image. The brief asked for "Priority task cards (white, 24px radius, cobalt priority indicator)", which the builder drew as a colored left border. The builder was told to treat the brief as "a concrete implementation spec". |
| Transfer contract | Boilerplate "reject" lines forbade "card topology" and "hero scaffold". That covers the reference's own focal device, a saturated cobalt card over a stacked queue. |
| Sampling | Screen builds ran at `temperature: 0.2`. Gemini 3 is tuned for its default (1.0), and low values push output toward the most common, dated patterns. |
| Navigation | The style-analysis schema had no `primaryNavigation` field, so the reference nav was never recorded. The planner is told not to "reuse a floating pill by habit". The renderer draws every nav as equal grid cells with the icon above the label, and "compact-chip" fills the whole cell: the rounded "Today" square seen in every project. |
| Tokens | Inactive nav icons were generated at `#D1D1D1` on white, about 1.5:1 contrast. |

**Changes**

1. Every screen of a project built from a style reference now gets the reference image.
   - The image is normalized once to 1024px, about 1k input tokens per screen.
   - Screen-scoped canvas edits still attach only an explicit local upload.
2. The builder has a design thinking step (`buildDesignThinking` in `lib/generation/prompts.ts`):
   - Read the reference's signature moves.
   - Give the screen one focal element, built with the reference's focal device.
   - Use the reference's own controls.
   - Show status and priority with chips, dots or icons, never side borders.
   - Final check: "same product, same designer".
   - It also names the dated habits to avoid. Prompt-only projects use the creative direction the same way.
3. Authority split: the brief decides what a screen does; the reference decides how it looks. Visual devices in a brief that the reference does not use yield to the reference.
4. Planner briefs say what must stand out, not how to decorate it. The transfer contract still forbids copying page structure, but allows reusing the reference's focal devices and components.
5. Screen builds use the model's default temperature.
6. Navigation:
   - Style and full analyses report the observed nav in the renderer's vocabulary: `activeTreatment`, `inactiveTreatment`, `width` and `material`.
   - A newly planned nav in style mode is built like the reference's nav (`applyReferenceNavigationStyle`), while the product keeps its own destinations.
   - The renderer draws `labels: active-only` with `activeTreatment: compact-chip` as an expanding capsule: an icon and label capsule, with round targets and optional circular icon wells (`inactiveTreatment: "well"`).
   - Existing navs with that combination re-render as the capsule after deploy. Before and after renders were compared with the reference.
7. Generated muted text and inactive nav icons get at least 3:1 contrast (WCAG 1.4.11). A user's own token edits are kept as written.

**Not verified here:** a live Gemini generation. This session has no provider credentials. The first new style-reference project after deploy is the real test. The changes do not alter the pipeline shape, the output format or any validation.

## 3. Cost

Measured for this project:

| Step | Tokens |
| --- | --- |
| Planning turn (after the planning fix) | 1 call, 2.2k in / 1.3k out |
| First batch, blueprint and briefs | 27k in / 3.4k out, 2 calls |
| Look-ahead briefs for the next batch | 27.6k in / 4.7k out, 2 calls; the next batch used them and made 0 planning calls |

A healthy build on 2026-09-27 used about 8k input and 3k output tokens per screen.

**Removed waste**

- **Speculative scope preparation** is now opt-in (`DRAWGLE_SCOPE_PREPARATION=on`).
  - It ran a full planning pass (blueprint, briefs, content review, asset planning) every time an approval card was shown.
  - Production data: 0 hits. Two lookups missed, and both saved preparations belong to projects that were never built.
- **Viewport repair rebuild** removed: up to one extra full build per flagged screen.
- **Navigation repair call** replaced by deterministic tidying (`tidyNavigationBlueprint`): duplicate or filler destinations are dropped, and planned destinations are unlinked. The model is asked again only for issues that need judgment, as before.

- **Blueprint reuse for later batches.** Every batch planned its own blueprint (charter, navigation, roadmap), including the look-ahead for the next batch, although the approved flow already fixed the screen list and the project already had a charter and navigation. Most of the answer was discarded, but the new charter was saved over the project's charter, so each batch rewrote the app's direction.
  - `savedProjectBlueprint` (`lib/generation/saved-blueprint.ts`) now rebuilds the blueprint from the saved charter, the saved navigation and the approved manifest.
  - Only the screen-brief call runs, saving one call per later batch (about $0.012 at this project's token counts). The charter stays stable across batches.
  - The first batch of a new project still plans normally, because it has no saved navigation yet.
  - A canvas project without navigation also plans normally, so newly added root screens can still bring navigation in.
  - When anything the blueprint needs is missing, the previous path runs unchanged.

**Added:** about 1k image tokens per screen plus about 0.5k prompt tokens, roughly $0.0008 per screen.

## Verification

- Vitest: 111 files, 657 tests passed. The Chromium tests used the pinned Playwright shim.
  - `planner.test.ts` shows that a later batch with a saved charter and navigation makes one model call (screen briefs) and keeps the saved charter and navigation.
  - A project without saved navigation still gets the blueprint step first.
- `pnpm run check`: curated index current, 0 ESLint errors (the existing `PricingDialog` warning remains), and `tsc` passes.
- A keepNames bundle of `viewport-health.ts` reproduces `ReferenceError: __name is not defined` before the fix. After it, the bundle returns `[]` for a clean screen and flags overflow for a 450px screen.
- Rendered this project's saved nav and the reference-style nav in Chromium with the project's tokens. Before: a grid with a square "Today" chip. After: a pill with an icon and label capsule and circular wells.

## Merge and deploy

This branch is `main` plus this change; the planning fix was already merged as PR #4. No migration is needed. There is one new optional environment variable, `DRAWGLE_SCOPE_PREPARATION`, which is off by default. Pushing `main` deploys the app and the Trigger.dev tasks together.

After deploy, check `generation_runs.metadata`:

- `screenBuildDiagnostics:*` now carries `viewportIssues` (or `viewportInspection: "unavailable"`) for every screen. This is the first real data on mobile layout defects.
- `performanceV1.usageByStage.build` appears again for successful screens.
