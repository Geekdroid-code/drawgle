# Product designer upgrade progress

Implementation follows `product-designer-upgrade-plan.md`. Premium reference-to-UI quality is the outcome to evaluate, not a claim implied by completing code changes.

## Phase 0 — Repository trace (complete)

- Confirmed immediate project creation, explicit discovery routing, continuous project messages and the refresh/remount fix are already present.
- Confirmed the proposal gate can pass model-invented facts; curated reference pixels are absent from discovery; product surfaces currently map one-to-one to screens.
- Confirmed roadmap dependencies and parent-state generation can be reused. Five-parent and eight-output bounds currently leak into planning. Credit keys alone do not deduplicate across continuation runs.
- The implementation plan is present; no production changes have been made by this work.

## Phase 1 — Evidence-aware conversation (implemented; live evaluation pending)

- Added an independent evidence assessment before the designer's tool loop. Material product gaps hide and server-block concrete screen planning; unresolved product/experience gaps block proposals even after the agent fills the blueprint.
- Added provenance for direct statements, accepted recommendations, delegation, inferred assumptions and reference observations. User quotes and recommendation-message links are validated; delegation never turns an assumption into confirmed user intent.
- Retained incremental facts, supersessions, project_messages, explicit discovery routing, multi-tool turns and turn leases. Substantive revisions are separate from lease-only CAS revisions.
- Deterministic regression tests cover incomplete evidence, unsupported delegation, blocked proposal attempts and legacy compatibility. These verify gates, not actual model conversation quality.

## Phase 2 — Reference evidence and experience direction (implemented)

- Added multimodal inspection of actual uploaded or curated reference pixels. No-upload projects retrieve real curated evidence after product context exists; a selected published preset contributes its actual description/style contract.
- Persisted observations, hierarchy, navigation, adaptations and direction with the stored image path and content hash. Missing uploaded evidence cannot silently become a different curated reference. Approval verifies the current reference bytes.
- Every downstream chunk receives the same approved experience direction. Existing downstream style extraction versus raw-image recreation behavior is retained. Exact recreation uses explicit source-frame indices and a narrow readiness path.

## Phase 3 — Functional journeys/screens/states (implemented)

- Concrete deliverables live in existing project_screen_roadmap metadata, updated with small validated deltas. Product surfaces can map to several frames; inline states remain unbilled parent requirements.
- Each deliverable records behavior, information, actions/outcomes, journey/surface/decision links, generation prerequisites and state-parent relationships. Validators reject missing links, orphaned states, duplicate identities and cyclic generation prerequisites.
- New migration atomically commits roadmap changes with the project revision. Built/running outputs cannot be repurposed by discovery edits. Superseded fact links must be resolved before approval.
- Current scope selects roadmap keys and freezes an approval snapshot; changing the selected scope preserves broader product truth and unselected roadmap work.

## Phase 4 — Complete scope approval (implemented)

- Extended the existing ChatPanel card with grouped screens/states, behavior, experience, assumptions and the complete quote. Shared client-safe pricing remains 20 credits per parent and 10 per separate state.
- Approval binds substantive revision, functional manifest and verified reference. The full balance is checked before approval; subsequent execution reserves only bounded batches.
- The existing GenerationScopeContract is derived from selected execution identities. No competing editable scope model was added.

## Phase 5 — Durable execution (implemented; local verification passed)

- Added a small Trigger coordinator around the existing generate-ui-flow worker. It executes the entire approved manifest in bounded chunks, favoring each parent's states before later parents. Legacy five-parent planning limits remain confined to legacy/per-request paths; they no longer truncate the new approved product scope.
- Each child sees the full immutable product/experience/global flow and a separate list of execution keys. A one-screen chunk cannot automatically suppress product navigation. Existing charter, tokens, navigation and reference evidence carry forward.
- Added owner-protected fulfillment records unique by approval/output key. Database claims and Trigger idempotency protect cross-run dispatch/replay. Resume preserves completed outputs and uncertain queued dispatches; failed frames use the existing worker retry identity mechanism.
- Coordinator attempt fencing prevents an old canceled/resumed task overwriting a new attempt. Updated the existing active-run index to allow one approval coordinator plus one child, while retaining one active top-level run per project.
- Chat shows whole-scope progress and resume/stop controls. Cancellation stops future scheduling after the current child settles. Credit shortage preserves remaining approved work.
- Follow-up audit fixed base-state parents being miscounted as failed, full-flow context being lost between batches, and interrupted queued dispatch becoming unrecoverable.
- Approved functional identities bypass legacy name-based roadmap reconciliation. Immutable approved keys cannot be removed or repurposed by a later planning delta; revised work receives a new identity.
- Reference source indices use the existing one-based recreation convention. The scope card includes the real inspected image through an owner-scoped preview endpoint.

## Phase 6 — Local verification complete; staging and visual gates pending

- Final broad regression run: **62 suites / 372 tests passed** (`pnpm.cmd exec vitest run --exclude lib/canvas-camera.test.ts`). The camera file uses Node's runner and passed separately: **7/7** (`pnpm.cmd exec tsx --test lib/canvas-camera.test.ts`).
- `pnpm.cmd run check` passed: curated embedding index current (56 references), lint zero errors, TypeScript clean. Lint retains the pre-existing `CanvasArea.tsx:667` missing `handleRetryScreen` dependency warning. `git diff --check` passed.
- The isolated PostgreSQL migration harness passes atomic revision/roadmap rollback, owner isolation, cross-run claims, completed-output preservation, queued-dispatch recovery, cancellation and stale-coordinator fencing. It includes the existing active-run index and the actual reserve/capture/release functions, verifying failed retry refunds and no duplicate debit/capture. The original product-planning migration harness also passes.
- Gemini access recovered after the earlier prepayment error. Live Tacozz conversation and exact-recreation samples have now run. They exposed tool identity/validation problems, unsupported delegation quotes and misleading proposal text; fixes and observed outcomes are documented in [the evaluation record](product-designer-upgrade-evaluation.md).
- Scope snapshots now preserve navigation boundaries to deferred outputs instead of forcing the agent to rewrite the broader roadmap. Tests cover that separation and decision supersession.

## Phase 6.1 — Interactive product decision cards UX (completed)

- Replaced prose question dumps with structured, optional interactive question cards in `ChatPanel`.
- Structured questions present three distinct choices with the primary grounded recommendation marked with a `Recommended` badge.
- Added a 4th write-in choice ("Write my own answer…") that expands an inline custom answer field with submit/cancel controls.
- Added frictionless keyboard shortcuts: keys `1`, `2`, `3` immediately choose corresponding options, key `4` triggers custom input, and `Escape` cancels custom input.
- Added visual number shortcut pills (`[1]`, `[2]`, `[3]`, `[4]`) on the right of each row matching reference specifications.
- Styled `[ Skip ]` as a distinct secondary button; skipping delegates a tentative recommendation that is recorded as an assumption rather than confirmed product truth.
- Visual smoke test verified with `scripts/preview-product-question-card.tsx` across light and dark themes. Full unit and regression coverage passed.

## Test-environment rollout order

1. Apply the new `20260914104053_product_designer_execution.sql` migration after the existing planning/roadmap/credit migrations. It preserves legacy records and separates the active coordinator index from the active child index.
2. Deploy matching `generate-product-flow` and `generate-ui-flow` workers, then the application that creates v2 scopes. Keep old workers compatible with existing v1 payloads while their runs finish.
3. Exercise empty-project conversation and exact recreation, then approve a scope crossing the execution limit. Verify parent/state ordering, total delivered count and actual ledger entries.
4. Exercise interruption before and after dispatch, partial failure, credit shortage, stop/resume and browser reload. Verify the same canvas/chat survives and no completed output is charged again.
5. Review rendered journeys against the visual baseline before production release. These deployment and visual gates are still pending.
