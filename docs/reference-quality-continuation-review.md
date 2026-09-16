# Review of the resumed reference-quality upgrade

Reviewed on 2026-09-16 at `02eea17`, including `38dcd03`, against the plan and baseline `8018d44`.

**Verdict: substantial corrections are present, but the upgrade is not completely wired. No production-release green flag yet.** These are findings about the code, not about which assistant wrote it. Some incomplete work from the interrupted handoff remains in the committed result.

This pass changed no application code. It independently ran the checks, traced the alternate entry points and added temporary negative probes. The probes were removed after execution; their bodies are archived in `reference-quality-continuation-review-probes.txt`.

## Checks independently run

| Check | Result |
| --- | --- |
| `pnpm.cmd run check` | Passed: curated index, ESLint, TypeScript |
| `pnpm.cmd exec vitest run --exclude lib/canvas-camera.test.ts --maxWorkers=4` | 79 files / 476 tests passed |
| `pnpm.cmd exec tsx --test lib/canvas-camera.test.ts` | 7 passed |
| Two additional runtime probes through `runProductDesigner()` | Both expected-safe-behavior assertions failed; details below |

The temporary probes mock storage/provider boundaries, not the designer implementation or downstream prompt compiler. No paid model generation, production database mutation or deployment was performed. No new migration was introduced by these commits.

## Remaining findings

### 1. P1 — normal canvas chat still bypasses reference policy and snapshot fixes

Locations: `app/api/agent/route.ts:1741–1747,1783–1788`; `lib/agent/screen-plan-approval.ts:169–190,248–274`.

The new reference-aware lookup and frozen context are wired into `/api/generations`. However, the ordinary ChatPanel add-screen route constructs its own proposal and triggers the worker through `screen-plan-approval.ts` directly. It still chooses `projectCharter.referenceDna.sourceImagePath` or `findLatestProjectPromptImagePath()`, and classifies any inherited image as `project_reference`.

Consequences:

- After explicitly opting out, an ordinary add-screen request can revive an earlier curated image from charter/run history.
- Curated evidence is again classified as a project upload on that path.
- The approved proposal/run carries neither `productContextSnapshot` nor the compiled `productContent`. The worker falls back to mutable current project state, so retries are not bound to the same product/design decisions.

Correction: share reference/context resolution between both generation entry points. Persist that contract in the chat proposal, approved run and worker payload; preserve it for retries. Test the real canvas proposal/approval path, not just the newer API helper.

### 2. P1 — corrections to existing tokens are not persisted to the canvas

Locations: `trigger/generate-ui-flow.ts:2032–2033,2378–2383`; renderer: `components/ScreenNode.tsx:697` and `components/ProjectShell.tsx:1696`.

When tokens already exist, the worker first writes those old tokens to the project. Later, semantic reconciliation can return corrected tokens, but this branch updates only the local variable. The later generation metadata snapshot does contain the revised tokens; the project's `design_tokens` does not.

The builder and tokenization therefore use one value while the live canvas/export CSS uses the old project value. A confirmed accent/font/radius correction can appear ignored or render differently from the builder's output. Initial token generation does persist its corrected tokens, so helper tests and fresh-project tests miss this branch.

Correction: persist the validated final token state consistently before dispatching builds, with the existing project's token-edit concurrency policy. Cover an existing-token correction and assert the project's rendered token CSS reflects it.

### 3. P1 — existing-project recreation can still receive adaptive product requirements

Locations: `trigger/generate-ui-flow.ts:2004,2347–2352,2833`; `lib/product-planning/design-requirements.ts:15–16`; normal upload entry: `app/api/agent/route.ts:1736–1747`.

The worker knows the current run is `user_recreate`, but requirement compilation/reconciliation and charter grounding use `productPlanning.input.imageReferenceMode`. These are not always the same. After initial generation the project's mode is deliberately changed to `style`; a normal canvas image upload does not rewrite that product state or supply a reconstruction snapshot.

For an existing product with confirmed design preferences, a fresh recreation upload therefore reaches token generation and semantic reconciliation with the old adaptive product requirements. Charter grounding can also reintroduce the old product. The initial approved recreation path is better isolated, but that does not protect this alternate entry point.

Correction: enforce source-only behavior using the resolved execution reference mode at every mutation boundary, independently of historical project input. Test a `user_recreate` run whose durable project state remains `style`, with deliberately conflicting product preferences.

### 4. P2 — the dedicated reconstruction module is dead code

Locations: `lib/product-planning/reconstruction.ts`; `lib/product-planning/designer.ts:89,96`.

Neither `reconstructionInstructions` nor `reconstructionProductContext` has a runtime caller. The designer always uses the full product-designer instructions and sends all active blueprint facts. The independent assessment and reference inspector do have source-specific instructions, but the central tool-calling assistant does not use the module added to isolate its responsibilities.

Runtime probe: ran `runProductDesigner()` with saved recreation mode and pixels, captured the actual provider configuration and compared it with the reconstruction instructions. It used `designerInstructions`; the assertion failed.

Correction: wire the module into the existing assistant according to authoritative current mode, and test the actual instructions/context sent. Keep the same tools, chat, project, approval and credit controls.

### 5. P1 — a new recreation source can lose its explicit request downstream

Locations: `lib/product-planning/designer.ts:67–78`; `lib/product-planning/generation-context.ts:23–27`; `lib/product-planning/inspect-reference.ts:180`.

`recreationRequest` is initialized by project creation, and `recreationChanges` exists in the schema, but neither is consumed by reconstruction. A follow-up only appends to `originalRequest` when the *previous* mode was recreation. Uploading a new recreation image while the project was in style mode stores the image/mode but does not capture the new source-specific request. The downstream prompt compiler and inspector prefer the old product request.

Runtime reproduction: start with `originalRequest = "Build a shopping app."`; submit a new source with `"Recreate this timer screenshot exactly, changing only its title to Focus."`. After the real designer turn, `scopedGenerationPrompt()` still starts with `"Build a shopping app."` and omits the timer/title instruction.

Additionally, appending all follow-ups into `originalRequest` and taking the last 30,000 characters can eventually discard the initial request and duplicate a partially retried turn.

Correction: keep the original product brief separate from the current source's reconstruction request and message-bound changes. Set the source request on new uploads, consume it during inspection/planning, and make follow-up persistence idempotent.

### 6. P2 — recreation retries/batches discard their same-source token system

Locations: `trigger/generate-ui-flow.ts:2011–2017,2340–2356`; coordinator: `trigger/generate-product-flow.ts:98–99`.

Every recreation worker unconditionally sets `designTokens = null`, including retries and later execution batches carrying tokens already extracted from the same approved source. It then calls token generation again and writes the result to the project's shared token state.

Rejecting unrelated inherited product tokens is necessary. Discarding already-established source tokens is different: this adds repeated model work, destabilizes prepared-plan keys and can change the shared CSS used by already-rendered frames when another batch/retry completes. The repeated call/write is certain; the amount of visible variation is model-dependent and needs live evaluation.

Correction: bind extracted token snapshots to the approved source hash and reuse them within that source's execution/retries. Re-extract for a different source, without silently restyling unrelated existing screens.

## Correctly implemented foundations

- Broad keyword-to-color substitutions are removed. The new bounded semantic patcher validates cited fact IDs, existing paths and exact before values, preserving the original artifact.
- New curated compatibility verdicts are required. Rejected/unreviewed candidates are not saved, and candidate search is bounded.
- Current-requirement checks gate proposal and approval; stale curated evidence is reselected.
- The explicit reference-preference tool and recovery-card choice are connected to the designer. Skip and generic delegation do not opt out. A new designer upload clears the earlier opt-out.
- Approved product generation distinguishes curated evidence from uploads and supports explicit no-reference execution.
- Explicit design requirements travel in the independent content contract used by builds and manual states; the entry-point/snapshot gaps above still need repair.
- Planner/builder memory suppression for recreation, source-detail storage, independent crop verification and derivative hash checks are implemented. These establish useful safeguards, not measured visual fidelity.
- No wholesale removal of the blueprint, scope approval, manual state feature, supplied-state direct rendering, credit mechanisms or parallel scheduler was found in the inspected diff.
- The `vitest.setup.ts` change safely guards DOM-only setup for Node tests; it does not disable assertions.

## Documentation and release confidence

The progress log's final claim that all phases are implemented and verified is premature. Its old phase-3 section still describes removed hardcoded colors. Its claim of “zero false positives” is also too strong: the relevant tests mock an empty semantic-review response, so they prove that no keyword rewrite happens, not that a real model never misinterprets those examples.

No live comparison evidence establishes preservation of premium design quality, recreation fidelity or latency/cost. Complete the runtime fixes, add tests of both generation entry points and the rendered token state, then evaluate initial creation, normal canvas additions, new-source recreation and retries against the plan's visual matrix.

The current passing suite is valid evidence of covered behavior. It is not a completion or production-quality green flag.

## Reproducing the additional probes

Copy `lib/product-planning/designer.test.ts` to `lib/product-planning/continuation-review.audit.test.ts`, insert the archived probe bodies immediately before the final `});`, then run:

```powershell
pnpm.cmd exec vitest run lib/product-planning/continuation-review.audit.test.ts -t 'audit:' --maxWorkers=1
```

Remove the temporary copy afterward. The two probes intentionally express the expected corrected behavior and fail on reviewed commit `02eea17`.
