# Reference quality and recreation implementation audit

Verdict: **not ready for a completion/release green flag**. The implementation contains useful changes, but several required behaviors are disconnected or fail open. Some new reconciliation logic can actively reduce design fidelity.

Scope: current local working tree against `8018d44`, the implementation plan, and `C:/Users/harva/Downloads/walkthrough.md`. This was a review, not a remediation pass. Application code was not changed. The existing progress log was left intact; its completed-phase claims should be corrected after resolving the findings below.

## Verification performed

- Read the tracked diff and new implementation/test files.
- Traced project creation, designer tool declarations/dispatch, incremental patch translation, inspection, proposal/approval gates, API normalization/reference policy, worker token generation/reuse, planner inputs, builder context, retries, and project image lookup.
- Independently ran `pnpm.cmd run check`: passed curated index (56 references), ESLint and TypeScript.
- Independently ran `pnpm.cmd exec vitest run --exclude lib/canvas-camera.test.ts`: **76 suites / 451 tests passed**.
- Independently ran `pnpm.cmd exec tsx --test lib/canvas-camera.test.ts`: **7 passed**.
- Added a temporary nine-case audit suite exercising omitted negative cases against the actual functions. **All nine expected-safe-behavior assertions failed**, confirming the defects below. No paid model calls or production database access were used; only provider/storage responses were mocked.
- Preserved that suite as `docs/reference-quality-and-recreation-audit-repros.ts.txt`, then removed the temporary executable test so the review does not silently change the normal test suite. To reproduce, copy it to `lib/product-planning/reference-upgrade.audit.test.ts` and run `pnpm.cmd exec vitest run lib/product-planning/reference-upgrade.audit.test.ts`.
- `git diff --check` reports trailing blank lines in `reference-policy.ts`, `reference-policy.test.ts` and `inspect-reference.ts`. These are housekeeping issues, not the release blockers.

Passing the existing suite is real, but does not establish the missing end-to-end behaviors or visual quality. The new tests primarily exercise successful helpers. In particular, no-reference tests call `applyProductPatch()` directly, bypassing the agent tool path users actually use.

## Findings

### 1. P1 — semantic requirements were replaced with unsafe keyword-to-token rewriting

Location: `lib/product-planning/design-requirements.ts:51`, `:70`, `:102`; called by `trigger/generate-ui-flow.ts:2337` and `:2365`.

The new reconciler concatenates all labels, details and evidence, then performs unrelated regex matches. It does not understand negation, which component a requirement applies to, or which value belongs to which token. It also invents exact values and additional choices: any mention of cream sets the screen to `#FAF8F5`, cards to white and text to brown; dark mode sets a fixed navy palette.

Confirmed reproductions:

| User requirement | Actual result |
| --- | --- |
| `No dark mode; keep the white background` | Background becomes `#0F172A`. |
| `Background #FFFFFF and brand primary #10B981` | Primary becomes `#FFFFFF`, the first hex in the text. |
| `Show ice cream photographs on the white product cards` | Background becomes `#FAF8F5`. |

This violates the plan's instruction to preserve explicit choices without inventing restrictions. It can overwrite good generated or existing project tokens, even when the original generation interpreted the user correctly.

Required correction: remove these broad substitutions. Use validated, semantically bound requirements; deterministic overrides are suitable only for a known token/component explicitly associated with an exact value. Use a bounded semantic consistency review for the remainder, preserving valid design decisions. Test negation, multiple colors, component-specific requirements and domain language.

### 2. P1 — rejected or unreviewed curated candidates are still accepted

Location: `lib/product-planning/inspect-reference.ts:47`, `:129–155`; `experience.ts:9`.

Every iteration assigns `chosenExperience` and `chosenImage` before testing compatibility. If all inspected candidates return `compatible: false`, the loop ends and persists the last rejected image. If compatibility is omitted, `compatibility?.compatible !== false` evaluates true, accepting the first image without a verdict. The provider schema and Zod schema both allow the compatibility object to be absent.

Confirmed with separate tests: both an all-incompatible shortlist and a missing verdict resolve successfully and save the image. This defeats the central purpose of phase 2 and leaves no bounded no-compatible-match recovery path for users.

Required correction: require a validated verdict for new curated inspections, select only a compatible candidate, and return a structured recoverable result when none qualifies. Do not apply the fallback image or proceed toward approval. Preserve legacy parsing separately from strict validation of new responses.

### 3. P1 — changed requirements do not invalidate the reference assessment or block approval

Location: `lib/product-planning/inspect-reference.ts:86`, `:159–177`; `model.ts:174–195`.

`requirementsKey` is persisted but never compared before reference reuse or approval. Changing preferences leaves the old experience in place. When a saved image exists, inspection never enters shortlist retrieval, even if the new inspection rejects that image. Proposal and approval only check that experience/path/manifest exist; neither checks compatibility or the current requirements key.

A direct reproduction successfully proposes and approves a state whose saved experience is both explicitly incompatible and marked with a stale requirements key. Prepared-plan cache invalidation does not solve this: it replans from the same stale reference.

Required correction: invalidate or revalidate incompatible experience when confirmed requirements change. Re-select curated evidence when needed. Validate the requirements revision and compatible decision at proposal and final approval, with a compatibility path for already-approved historical runs. User uploads should be handled as user-directed adaptation, without automatic library substitution.

### 4. P1 — the no-reference choice is unreachable from the actual assistant

Location: `lib/product-planning/model.ts:89`; `designer-tools.ts:50`; `designer-patch.ts:7`; `designer.ts:118`.

The operation exists in the model schema and has direct unit tests, but there is no corresponding tool declaration, designer dispatch branch, patch translation or UI action. `prepareDesignerPatch()` only builds fact/supersession operations or a scope operation. A user asking for no references cannot invoke the new state transition through the normal conversation.

The temporary test confirms no agent tool exposes that choice. Instructions also still state that a reference must always be inspected. Merely adding the schema operation does not implement the user-facing capability.

Required correction: expose a small tool through the existing designer runtime, validate actual user evidence/explicit selection before applying it, and integrate no-match recovery into existing question cards. Clear/reinspect incompatible experience on preference changes. A subsequent explicit image upload must resolve the old opt-out intentionally rather than leave `referencePreference: none` overriding the new upload. Test actual `runProductDesigner()` calls and card answers, not only direct state mutation.

### 5. P1 — the new reconciliation path still rewrites exact recreation

Location: `design-requirements.ts:32`, `:121`; `service.ts:3758`; `trigger/generate-ui-flow.ts:2336`, `:2364`.

`compileDesignRequirements()` has a recreation guard, but the two mutating reconciliation functions do not. Both are invoked whenever a product snapshot exists. Thus removing the blueprint text does not isolate the actual render inputs.

Confirmed reproductions: an exact-recreation state with a cream preference recolors the source token system; an exact-recreation screen with `Recreate the visible gradient background` becomes `Recreate the visible solid background` when a product preference mentions no gradients.

The rewritten inspection system instruction also removed the old explicit recreation-preservation sentence and now universally asks for product adaptation. `mode` is still present in input data, but the instructions no longer clearly establish a source-only branch. General product evidence assessment remains in the recreation conversation. Existing project context can still append inherited charter, creative direction and reference DNA via `lib/generation/context.ts:548–566`.

Required correction: enforce recreation isolation at the execution/module boundary, including inspection, token reuse, briefing and builder inputs. Do not run product preference reconciliation on recreation. Preserve explicitly requested changes through a separate source-grounded request contract. Add tests of actual planner and worker/build inputs with deliberately conflicting product preferences and inherited context.

### 6. P2 — the original recreation request field is never populated

Location: `lib/product-planning/generation-context.ts:23`; `model.ts:59`; creation at `app/api/projects/route.ts:27`.

`scopedGenerationPrompt()` now returns `state.input.originalRequest || state.scope.goal` for recreation, but the new `originalRequest` field has no production assignment. Project creation and designer turns do not persist it. In practice it falls back to the assistant-generated scope goal, so explicit requested deviations from the reference are not durably handed through this new path.

Required correction: persist the authoritative initial request and subsequent explicit recreation changes, or derive them from identified project messages. Ensure the selected batch still receives its exact source-frame mapping. Avoid replacing source instructions with an inferred scope summary.

### 7. P2 — general design requirements are not carried independently into builds/state edits/retries

Location: `trigger/generate-ui-flow.ts:3025–3026`, `:3262`, `:1360`, `:1446`; `lib/product-planning/content-contract.ts`.

The design contract reaches initial token generation and product planning, but the actual builder payload only receives the existing `productContent` contract. That contract excludes preference facts and compatibility transfer rules. Normal project batches set `projectContext` to null; retry paths also deliberately drop that field. State editing receives the same content-only contract. Therefore preferences such as exact typography, component density or an explicit exclusion are not independently guaranteed to survive when the brief omits them or a retry rewrites it.

The replacement for the planned semantic brief review is a small regex substitution covering gradients and cream, not a general validated consistency check.

Required correction: pass the compact approved design requirements alongside content through actual builder and state/retry inputs, preserving existing rich prompts and style-mode image attachment behavior. Add targeted tests where an explicit requirement is absent from the screen description and where retry drops project context.

### 8. P2 — reference provenance/opt-out is not durable for normal canvas continuation

Location: `app/api/generations/route.ts:761–787`; `lib/generation/prompt-reference-storage.ts:18–40`; `trigger/generate-ui-flow.ts:1996–2003`.

Approved product snapshots now resolve provenance correctly, but normal canvas requests without a product approval still use `findLatestProjectPromptImagePath()`. It retrieves only an image path, not its source or the project's reference preference. The API labels that path `project_reference`, and the worker labels it `project_upload`. A cached curated image can therefore become a supposed user image on later canvas work. A future reachable no-reference choice can also be bypassed by that lookup finding an older non-null image.

Required correction: carry provenance with inherited reference lookup, and consult durable current preference on ordinary continuation without overriding a new explicit upload. For retries, preserve the original run's approved contract rather than applying later mutable preferences. Test both paths separately.

## Plan coverage

| Phase | Audit result |
| --- | --- |
| 0: baseline | Evaluation cases are recorded; live current/historical output comparisons and measured results are still pending. Not complete. |
| 1: provenance | Approved product path improved; ordinary continuation remains incomplete. |
| 2: compatibility | Shortlist and pixel inspection implemented; rejection and stale-assessment gates fail open. |
| 3: design requirements | Requirements reach planning/tokens, but broad substitutions introduce regressions; semantic review and independent downstream transport are incomplete. |
| 4: exceptions | Direct state helpers work, but the chat action and no-match UX are not wired. |
| 5: recreation | Blueprint/charter suppression partly implemented; actual inputs remain subject to product rewriting. Original request storage and source-detail work are missing. |
| 6: verification | Existing tests pass; nine added negative probes fail; live visual gates have not run. |

Source-detail work is not implemented: `normalizeReferenceImage()` still resizes the persisted source to a 1024-pixel bounding box at quality 88. There is no new original/high-detail storage path, validated per-frame crop mechanism, or derivative provenance in this diff. The existing source-index tests do not establish crop/detail fidelity. This remains planned work, not evidence of a new resolution regression.

## What is preserved / useful

- Same canvas, ChatPanel, durable project blueprint and existing project message storage.
- Existing scope approval and credit mechanisms, manual state creation, supplied state-frame direct rendering and parallel scheduler are not removed by this diff.
- Existing style-mode rule still keeps curated/style pixels out of the final builder; recreation still supplies image evidence.
- Approved product runs now distinguish curated origin from user upload and preserve a catalog ID/hash where available.
- Evidence-backed preference extraction and prepared-plan key changes are useful foundations.
- No large framework or replacement screen-generation engine was introduced.

These observations and the passing existing suite support keeping the sound portions of the work. They do not offset the confirmed rendering and approval defects.

## Documentation and commit hygiene

- The progress log's statement that all phases are complete is inaccurate. Phase 0 explicitly says live comparisons are pending, and phase 5 cites pre-existing behavior in unchanged files as proof of newly completed isolation/source-detail work.
- `lib/seo/config.ts` changes the home-page title. It is unrelated to this plan; retain it only as an intentional separate change.
- `tsconfig.tsbuildinfo` is generated and was already modified when this review began. Do not mistake it for feature implementation.
- Include intended new source files when eventually committing; many remain untracked. Do not commit just the tracked diff.

## Recommended correction sequence

1. Remove unsafe keyword-driven token/brief rewriting and stop all such reconciliation for recreation.
2. Make new candidate verdicts mandatory and enforce rejection/freshness at selection and approval.
3. Connect the explicit reference preference to real chat tools/cards with evidence validation and bounded recovery.
4. Complete downstream requirement/provenance propagation, including normal canvas continuation and retries.
5. Finish recreation request/context isolation and the planned source-detail work in separately measurable changes.
6. Convert the archived negative probes into permanent regressions, add actual runtime wiring tests, rerun checks and then run the live comparison matrix.

A checkpoint commit for further development is possible, but this audit does not approve the work as a completed upgrade or a production release candidate.
