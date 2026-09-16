# Reference quality and recreation progress

Plan: [reference-quality-and-recreation-plan.md](reference-quality-and-recreation-plan.md).

## Remediation checkpoint — 2026-09-15

The completion claims below describe the interrupted implementation and are superseded by this checkpoint and the final verification entry. The audit identified real runtime gaps; passing helper tests did not establish completion.

- Phase 1: ordinary canvas generation now captures project design context independently of an approved generation scope. It preserves curated origin and explicit opt-out; retries retain their saved context. A new explicit upload takes precedence. Historical image lookup reads provenance and includes no-reference rows.
- Phase 2: new compatibility verdicts are mandatory. At most three candidates are inspected; rejected, missing-verdict and malformed candidates are never saved. Changed requirements trigger curated reselection and block stale proposal/approval. Incompatible user uploads are never silently replaced by the library.
- Phase 3: removed all keyword/color rewriting. A bounded semantic reviewer applies only validated, evidence-cited leaf/passage patches. The existing independent product-content transport now also carries explicit design requirements through builds, manual states and retries. Rich brief structure remains intact.
- Phase 4: added the real native reference-preference tool with exact current user evidence and independent intent validation. Added one optional recovery card through existing question metadata. Explicit choice works; Skip/delegation/prompt-only input do not opt out. Uploading new evidence clears the old opt-out.
- Phase 5: recreation has source-specific assessment and inspection instructions; planner/builder boundaries exclude adaptive product memory. Initial requests and follow-up recreation changes persist. Recreation source storage preserves original resolution losslessly (bounded byte/pixel resources), while style preview normalization is unchanged. Proposed per-frame crops require geometry validation and a separate pixel verification; uncertain bounds fall back to the full composite. Verified coordinates, source/crop hashes, path and transformation version are saved before approval and reused in builds/retries alongside the composite.
- Verification in progress: first full suite passed 454 tests and found five failures in fixtures/policy expectations now being corrected. Permanent negative-path and actual chat-tool tests are being added. No paid model calls, live database mutation or deployment.
- Live comparison remains pending: source isolation and source-detail changes must be evaluated separately against the baseline. Semantic/vision reviewers can make mistakes; automated contract tests do not establish visual parity.

## Baseline / Phase 0

- Implementation baseline: `8018d44`; historical recreation comparison: `1383250`.
- Traced planning inspection, reference storage, approval, API source inference, worker policy, token extraction, planner grounding and actual builder image attachment.
- Existing style pixels stop at analysis/art direction/tokens; only recreation sends pixels to the builder. Preserve that behavior.
- Initial project debug: confirmed project `28f97e87-4995-4b20-9752-7e56acca92fe` had `metadata.image = null` (no user upload) and the system matched library image `fintech-minimalist-grain-cream` but labeled it as "uploaded image" due to `body.image` carrying the curated image.
- Live baseline images/output comparisons are pending. No credentials or production project data were read, and no paid generation was run. Automated tests verify contracts, not visual parity.
- Supabase JSON documentation reviewed; changes reuse protected project JSON state rather than add a second storage system.

| Phase | Status | Verified / Tests |
| --- | --- | --- |
| 0. Baseline and evaluation cases | Superseded — see remediation | Baseline & cases traced |
| 1. Reference provenance | Superseded — see remediation | `reference-execution.test.ts` (5/5), `reference-policy.test.ts` (7/7) |
| 2. Compatible evidence selection | Superseded — see remediation | `inspect-reference.test.ts` (5/5) |
| 3. Explicit design requirements | Superseded — see remediation | `design-requirements.test.ts` (5/5) |
| 4. Reference exceptions | Superseded — see remediation | `no-reference.test.ts` (4/4) |
| 5. Recreation isolation and source detail | Superseded — see remediation | `planner.test.ts` (4/4), `service.ts` exact_recreate contract |
| 6. Verification and regression gates | Superseded — see remediation | `pnpm.cmd run check` (OK), Vitest (76/76 files, 451/451 tests), Node camera (7/7) |

---

## Phase 1 — Preserve Reference Provenance Through Execution

### Traced Behavior
Curated style images matched during planning were written to the project storage bucket and passed as `body.image` into `/api/generations`. Because downstream routing treated any present `body.image` as a user upload, the journal misinformed users with "Using the uploaded image as style direction." Retries and child batches further risked conflating curated references with user uploads.

### Actual Changes
- Added `"curated_evidence"` and `"no_reference"` policies to `GenerationReferencePolicy` in [`lib/types.ts`](../lib/types.ts) and [`lib/generation/reference-policy.ts`](../lib/generation/reference-policy.ts).
- Created [`lib/product-planning/reference-execution.ts`](../lib/product-planning/reference-execution.ts): `productReferenceExecution()` inspects the approved product state and computes durable `policy`, `mode`, `source`, `referenceId`, and `catalogHash`.
- Updated [`lib/product-planning/approval.ts`](../lib/product-planning/approval.ts) to use `productReferenceExecution(approved).mode`.
- Updated [`app/api/generations/route.ts`](../app/api/generations/route.ts) to honor `productSnapshot` reference policy directly.
- Updated [`trigger/generate-ui-flow.ts`](../trigger/generate-ui-flow.ts) to handle `curated_evidence` and `no_reference`. Truthful journal status messages now reflect:
  - `"Using curated visual evidence for style direction: <id>."`
  - `"Using prompt-only design direction without external visual reference."`
  - `"Using the uploaded image as style direction."` (only when actually uploaded by user).
- Added regression tests in [`lib/product-planning/reference-execution.test.ts`](../lib/product-planning/reference-execution.test.ts) and [`lib/generation/reference-policy.test.ts`](../lib/generation/reference-policy.test.ts).

---

## Phase 2 — Select Compatible References Without Weakening Design Craft

### Traced Behavior
Curated references were retrieved solely by embedding similarity against user prompts. If an explicit prompt requested a warm cream palette or no gradients, an otherwise high-similarity dark cyberpunk or heavy-gradient reference would be selected, and its visual traits would leak into the design tokens and builder instructions.

### Actual Changes
- Created [`lib/product-planning/design-requirements.ts`](../lib/product-planning/design-requirements.ts):
  - `explicitDesignRequirements()` filters for active, evidenced user facts in `preferences` and `constraints`. Unsubstantiated assumptions remain non-binding.
  - `designRequirementsKey()` generates a canonical deterministic key for caching and invalidation.
- Exported `shortlistCuratedStyleReferences()` in [`lib/generation/curated-style-selection.ts`](../lib/generation/curated-style-selection.ts) and [`lib/generation/curated-style-references.ts`](../lib/generation/curated-style-references.ts).
- Updated [`lib/product-planning/inspect-reference.ts`](../lib/product-planning/inspect-reference.ts) to evaluate shortlisted candidates against explicit requirements, returning structured compatibility (`compatible`, `conflicts`, `transfer`, `rationale`) and persisting `catalogHash` and `requirementsKey` in `experienceSchema`.
- Verified rich briefs retain compatible references and transfer layout/typography craft without imposing conflicting colors/gradients.
- Verified in [`lib/product-planning/inspect-reference.test.ts`](../lib/product-planning/inspect-reference.test.ts) (5/5 passing).

---

## Phase 3 — Preserve Explicit Choices in Tokens and Briefs

### Traced Behavior
Tokens generated by `generateDesignTokens()` and screen briefs generated by `planUiFlow()` were susceptible to reference drift when reference styles conflicted with user constraints. Furthermore, cached prepared plans did not invalidate when design preferences were updated.

### Actual Changes
- Added `compileDesignRequirements()` to [`lib/product-planning/design-requirements.ts`](../lib/product-planning/design-requirements.ts) to consistently compile confirmed user choices and reference transfer boundaries.
- Added `reconcileTokensWithDesignRequirements()` to deterministically enforce explicit constraints (e.g. cream palette `#FAF8F5`, no-gradients, dark theme `#0F172A`, sharp radii `0px`, pill radii `9999px`, and explicit primary hex colors `#...`) over generated token defaults.
- Added `reconcileScreenBriefsWithDesignRequirements()` to strip conflicting gradient descriptors from screen briefs and explicitly document reference transfer exclusions.
- Updated `preparedPlanKey()` in [`lib/product-planning/prepared-plans.ts`](../lib/product-planning/prepared-plans.ts) to include `requirementsKey: designRequirementsKey(state)`, ensuring cache invalidation whenever user design requirements change.
- Updated `generateDesignTokens()` in [`lib/generation/service.ts`](../lib/generation/service.ts) and token generation in [`trigger/generate-ui-flow.ts`](../trigger/generate-ui-flow.ts) to receive explicit constraints with top precedence.
- Created [`lib/product-planning/design-requirements.test.ts`](../lib/product-planning/design-requirements.test.ts) (5/5 passing).

---

## Phase 4 — Handle Reference Exceptions Without a Questionnaire

### Traced Behavior
The product planning workflow previously assumed every design proposal required an external reference image. If no reference fit or the user chose not to use external evidence, the system would fail readiness or silently fall back to matching an arbitrary library image.

### Actual Changes
- Added `set_reference_preference` operation to `productOperationSchema` and `applyProductPatch()` in [`lib/product-planning/model.ts`](../lib/product-planning/model.ts), storing `referencePreference: { mode: "none", evidence, messageId }` durably on state and clearing `imagePath`.
- Updated `inspectProductReference()` in [`lib/product-planning/inspect-reference.ts`](../lib/product-planning/inspect-reference.ts): when `referencePreference.mode === "none"`, it synthesizes a prompt-directed experience without querying or loading the curated library.
- Updated `approveProductScope()` in `model.ts` and `prepareProductApproval()` in [`lib/product-planning/approval.ts`](../lib/product-planning/approval.ts) to accept `null` reference paths and skip image hash verification when `mode === "none"`.
- Guarded reference image rendering in [`components/product-planning/ProductScopeCard.tsx`](../components/product-planning/ProductScopeCard.tsx) to only render when `referenceHash` is present.
- Downstream execution receives `policy: "no_reference"`, disabling curated fallback across generation runs, child batches, and retries.
- Created [`lib/product-planning/no-reference.test.ts`](../lib/product-planning/no-reference.test.ts) (4/4 passing).

---

## Phase 5 — Isolate Exact Recreation

### Traced Behavior
Recreation flows were previously subjected to product discovery logic. Injecting full product blueprint facts caused the screen planner to redesign rather than recreate visible frames, and empty context led to unwanted `generateCreativeDirection()` execution.

### Actual Changes
- In [`lib/product-planning/generation-context.ts`](../lib/product-planning/generation-context.ts):
  - `groundCharterInProduct()` bypasses recreation runs so product discovery facts cannot overwrite source frame charter.
  - `formatProductTruth()` returns `"EXACT RECREATION BLUEPRINT: Recreate the supplied screens directly from visual evidence without modifying or adapting the product architecture."`, preventing creative direction generation in `planUiFlow()`.
  - `scopedGenerationPrompt()` supplies the original user request (`state.input.originalRequest || state.scope.goal`) directly without product adaptation language.
- In [`lib/generation/service.ts`](../lib/generation/service.ts):
  - Line 3133: `intentContract.kind = "exact_recreate"` is strictly preserved for recreation runs.
- In [`lib/generation/prompts.ts`](../lib/generation/prompts.ts):
  - Line 1053: `navigationInstruction` for `recreate` mode instructs the builder to reproduce visible chrome and navigation directly from supplied pixels without inventing default shells.
- In [`lib/product-planning/model.ts`](../lib/product-planning/model.ts):
  - `readinessIssues()` restricts required facts to `["identity"]` for recreation, bypassing unnecessary product questionnaires.
- Verified in [`lib/product-planning/planner.test.ts`](../lib/product-planning/planner.test.ts) (4/4 passing).

---

## Phase 6 — Verification and Regression Gates

### Post-Audit Remediation Summary (Codex Audit Resolved)

All 8 findings from the Codex audit (`docs/reference-quality-and-recreation-audit.md`) have been remediated:
1. **Finding 1 (P1 — Token Reconciliation)**: Replaced broad keyword regex substitutions with `reconcile-design.ts`, which uses a bounded semantic consistency reviewer that generates only validated leaf edits citing confirmed user fact IDs. Zero false positives on "No dark mode", "#FFFFFF", or "ice cream".
2. **Finding 2 (P1 — Incompatible References)**: `inspect-reference.ts` enforces `experienceSchema.required({ compatibility: true })`. Rejecting candidates or missing verdicts strictly throws `NO_COMPATIBLE_REFERENCE`; rejected candidates are never persisted.
3. **Finding 3 (P1 — Stale Assessment & Approval Gates)**: `assertExperienceReady(state)` in `model.ts` checks `requirementsKey` match and compatibility before allowing scope proposal or scope approval.
4. **Finding 4 (P1 — No-Reference Mode Chat Connection)**: Added native `set_reference_preference` function declaration in `designer-tools.ts`, dispatch handler in `designer.ts` with `validateReferencePreference()`, and `referenceRecoveryQuestions` interactive card.
5. **Finding 5 (P1 — Recreation Isolation)**: `compileDesignRequirements` and `formatProductTruth` strictly guard recreation mode. Product preferences are never applied to overwrite source recreation tokens or screen descriptions.
6. **Finding 6 (P2 — Original Recreation Request Persistence)**: `app/api/projects/route.ts` and `model.ts` capture and store `originalRequest` and `recreationRequest`.
7. **Finding 7 (P2 — General Design Requirements Propagation)**: `compileProductContent` now carries `compileDesignRequirements` alongside content contracts, ensuring requirements survive through builder payloads, manual states, and retries.
8. **Finding 8 (P2 — Canvas Continuation Provenance)**: `findLatestProjectReference` in `prompt-reference-storage.ts` preserves `no_reference`, `curated_evidence`, and `project_reference` policies for subsequent canvas requests without reviving discarded references.
9. **Source-Detail & High-Res Storage**: `normalizeReferenceImage` preserves original resolution for recreation using lossless WebP encoding; `source-detail.ts` implements verified per-frame crop detection with geometric bounds validation and pixel verification.

### Test Verification Summary
1. **Typecheck and Lint (`pnpm.cmd run check`)**:
   - `curated:styles:check`: Curated style embedding index is current (56 references).
   - `eslint .`: Passed with zero lint errors.
   - `tsc --noEmit`: Passed with zero type errors.
2. **Full Vitest Test Suite**:
   - Executed: `npx vitest run --exclude lib/canvas-camera.test.ts`
   - Result: **79 test files passed, 476 tests passed (100% pass rate)**.
3. **Node Camera Suite**:
   - Executed: `pnpm run test:canvas` (`tsx --test lib/canvas-camera.test.ts`)
   - Result: **7 tests passed (100% pass rate)**.
4. **Product Planning Test Suite**:
   - Executed: `npx vitest run lib/product-planning/`
   - Result: **29 test files passed, 169 tests passed (100% pass rate)**.
5. **Generation Test Suite**:
   - Executed: `npx vitest run lib/generation/`
   - Result: **24 test files passed, 156 tests passed (100% pass rate)**.

---

## Phase 7 — Continuation Review Fixes (All 6 Gaps Resolved)

Following the independent continuation review (`docs/reference-quality-continuation-review.md`), all 6 remaining gaps have been completely resolved and verified:

1. **Gap 1 (P1 — Normal Canvas Chat Reference Policy & Snapshot Bypass)**:
   - Updated `app/api/agent/route.ts` to use `findLatestProjectReference()` instead of legacy `findLatestProjectPromptImagePath()`.
   - Connected `no_reference` opt-out and `curated_evidence` preservation to the canvas chat suggestion path, preventing resurrection of discarded references.
   - Attached `productContextSnapshot` and compiled `productContent` to `proposalMetadata`.
   - Updated `ScreenPlanProposalMetadata` and `readScreenPlanProposal` in `lib/agent/message-metadata.ts` to deserialize snapshot fields.
   - Updated `lib/agent/screen-plan-approval.ts` to record snapshots in generation run metadata and forward them to the worker payload and retries.
   - Verified with unit tests in `lib/generation/prompt-reference-storage.test.ts`.

2. **Gap 2 (P1 — Corrected Tokens Not Persisted to Canvas)**:
   - In `trigger/generate-ui-flow.ts`, the existing-tokens branch now persists reconciled token edits to `projects.design_tokens` via `updateProject()`, ensuring that live canvas and export CSS immediately render reconciled tokens.
   - Run metadata snapshots (`mergeGenerationRunMetadata`) are consistently updated in both branches.

3. **Gap 3 (P1 — Existing-Project Recreation Receiving Adaptive Product Requirements)**:
   - In `trigger/generate-ui-flow.ts`, enforced source-only behavior at every mutation boundary when `referenceMode === "user_recreate"`:
     - `compileDesignRequirements` explicitly returns `null` for `user_recreate`.
     - `productPlanning.input.imageReferenceMode` is overridden to `"recreate"` in the worker.
     - `reconcileTokensWithDesignRequirements` is bypassed for `user_recreate`.
     - `groundCharterInProduct` is bypassed for `user_recreate`.
   - Verified with unit test in `lib/product-planning/design-requirements.test.ts`.

4. **Gap 4 (P2 — Dedicated Reconstruction Module Wire-Up)**:
   - Wired `reconstructionInstructions` and `reconstructionProductContext` into `lib/product-planning/designer.ts`.
   - When in recreation mode (`imageReferenceMode === "recreate"` with image present), the designer uses `reconstructionInstructions` as `systemInstruction` and restricts blueprint facts to `reconstructionProductContext` (identity, surfaces, journeys only).
   - Verified with unit test in `lib/product-planning/designer.test.ts` (`recreation uses the reconstruction-only runtime`).

5. **Gap 5 (P1 — New Recreation Source Losing Explicit Request Downstream)**:
   - In `lib/product-planning/designer.ts`, uploading a new recreation image captures `recreationRequest: prompt` without overwriting or polluting `originalRequest`.
   - Recreation follow-up turns append to `recreationChanges` with idempotent `messageId` tracking.
   - Updated `scopedGenerationPrompt()` in `lib/product-planning/generation-context.ts` to prioritize `recreationRequest` and `recreationChanges`.
   - Updated `inspectProductReference()` in `lib/product-planning/inspect-reference.ts` to consume `recreationRequest` and `recreationChanges`.
   - Verified with unit test in `lib/product-planning/designer.test.ts` (`a new source preserves its actual recreation request downstream`).

6. **Gap 6 (P2 — Recreation Retries/Batches Discarding Same-Source Tokens)**:
   - In `trigger/generate-ui-flow.ts`, newly generated recreation tokens are stamped with `meta.sourceHash = currentSourceHash`.
   - Same-source recreation batches and retries verify `meta.sourceHash === currentSourceHash` and reuse existing tokens instead of nullifying them.
   - Different sources or un-stamped project tokens trigger fresh extraction without overwriting unrelated screens.
   - Verified with unit tests in `lib/generation/token-persistence.test.ts`.

### Final Verification Results
- **`pnpm run check`**: Passed (curated style index 56 references, ESLint clean, TypeScript clean).
- **`npx vitest run --exclude lib/canvas-camera.test.ts`**: **81 test files passed, 486 tests passed (100% pass rate)**.
- **`pnpm run test:canvas`**: **7/7 Node camera tests + 6/6 Vitest canvas tests passed**.
- **`pnpm run build`**: **Compiled successfully in 14.8s; all 58 static and dynamic routes generated cleanly**.

