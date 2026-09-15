# Production fixes progress

Plan: [fixes-for-production.md](fixes-for-production.md).

## 2026-09-15 — implementation started

- Baseline: tracked working tree clean; the supplied plan is an untracked user file and will be preserved.
- Traced functional roadmap validation, immutable scope snapshots, coordinator claims, screen/state workers, proposal approval, and evidence validation.
- Confirmed one-parent batches, a five-screen worker slice, and a state editor which receives no reference pixels.
- Compatibility rule: existing approved scopes retain output identities and prices. New/revised scopes use the manual-state policy. No production deployment or paid live evaluation is included in local checks.

| Phase | Status | Verification |
| --- | --- | --- |
| 1. Output and rendering contracts | Implemented; local checks passed | Policy, refreshed-draft approval and legacy compatibility tests |
| 2. Manual canvas state creation | Implemented; local checks passed | Dialog, atomic SQL claim, credit idempotency and uncertain dispatch retry tests |
| 3. Image recreation routing | Implemented; local checks passed | Actual builder input, frame identity, reference hash and historical pricing tests |
| 4. Evidence and audience content | Implemented; local checks passed | Entailment verdict validation, content isolation and copy correction tests |
| 5. Bounded parallel scheduling | Implemented; local checks passed | Rolling concurrency, cancellation, 13-output continuation and prepared-plan SQL tests |
| 6. Regression checks and evaluation guide | Local verification complete; live evaluation pending | 73 Vitest suites / 434 tests, 7 Node tests, normal check and isolated SQL integration |

## Implementation notes

1. New/revised scopes enforce manual additional states in the functional store, scope snapshot and worker. Ordinary behavior stays on its parent. Historical approvals keep their prices and outputs. Rendering strategy is distinct from canvas relationship.
2. Added a screen menu action and a small dialog through existing canvas callbacks. The same project message storage records requests. The new server-only SQL function commits approval, state roadmap identity, run and queued activity atomically. Parent source is bound by SHA-256; uncertain dispatch retries reuse a stable run identity.
3. Supplied recreation state frames are included among image-aware builds. All frames receive their source index; immutable mode and image hash govern execution. State grouping is attached independently and credit reservation still uses the approved output kind.
4. Added independent evidence entailment review, incremental `content` facts, an explicit builder content contract, and targeted copy corrections on builder-ready briefs. Reference observations do not become audience/content truth.
5. Coordinator batches admit up to eight eligible outputs; worker scheduling rolls two builds with an initial visual anchor where needed. Audited additional planner schema/count limits. Full prepared plans (including family/intent/navigation contracts) are cached in existing run metadata; next-batch preparation overlaps current rendering and is fenced against cancellation/resume.

## Verification checkpoints

- Initial typecheck caught a conversation-context shape mismatch; corrected it.
- Initial targeted run: 116 passed, two tests used the previous automatic-state/single-parent behavior. Updating them to cover the new behavior while retaining legacy approved-state tests.
- First SQL integration attempt exposed an active child left by the cancellation fixture; isolated the manual-state test from that earlier fixture. No production database was touched.
- Supabase changelog markdown fetch was unsupported by the browsing tool; current JSON state docs and transaction guidance were read. Migration generated through the Supabase CLI.

## Final implementation checkpoints

### Phase 1 — output policy

- New/revised functional deltas and approval snapshots reject additional paid states in prompt/style modes. Inline requirements and substantial product screens remain supported. No industry-specific screen list was added.
- Older drafts containing automatic states must be refreshed explicitly. Existing approved snapshots retain their outputs, prices and legacy derived-state execution.

### Phase 2 — canvas state creation

- Ready main screens expose **More actions → Create state**. A small dialog accepts one description and shows the existing 10-credit price; no subsequent chat approval is required.
- Requests use project message IDs as stable identities. The migration commits the state roadmap item, approval, generation run and activity together. Dispatch uses the saved payload and a run-specific idempotency key.
- The parent is checked for ownership, readiness and its exact code revision before approval and before editing. Existing state editing remains available. The description survives busy-state changes and retryable request errors while the dialog is open.

### Phase 3 — reference recreation

- Supplied state frames now use direct image builds with their original source indices. Their state relationship and original price remain independent of rendering.
- Each exact-recreation frame owns its visible navigation/chrome. Shared injected navigation and earlier-screen chrome evidence cannot replace the supplied layout.
- A new actual-builder-input test initially found a conflicting navigation instruction. Corrected that branch and verified the second frame's pixels/index and source-owned chrome contract.
- Retry identities use full roadmap keys for derived states, so two parents with an `empty` state cannot reuse each other's failed output. Historical style reference indices cannot accidentally reroute a state into recreation.

### Phase 4 — product language

- The existing incremental fact patch is reviewed for full-claim entailment before persistence. Unsupported user-confirmed additions become marked assumptions; incomplete/invalid verdicts cannot silently validate facts.
- Added a compact `content` fact section and compiled audience/content contract. It travels separately from truncated project context into planning, screen builds, state edits and retry metadata.
- A focused semantic review makes exact, validated copy replacements in screen descriptions. It preserves screen identity and visual planning. Recreation preserves source text.
- These are model-based quality controls, not a guarantee against all hallucinations. Previously saved erroneous facts are not silently rewritten by this migration.

### Phase 5 — generation scheduling

- One coordinator child at a time can build up to eight approved outputs. The complete product scope is not truncated to this batch size.
- New visual systems establish the first screen before parallel siblings; exact recreation skips that design dependency. The rolling scheduler keeps two eligible builds running, filling a free slot without waiting for a slow sibling.
- The next batch's full planner result is prepared while current screens render. Approval, content, reference and shared design context participate in its cache identity.
- Prepared plans merge through a short, service-only SQL transaction, with cancellation/attempt fencing and a four-entry cache bound. No oversized metadata equality filter or whole-row overwrite is used for this cache.
- Removed a remaining five-key limit from prepared product roadmap compilation while preserving the legacy default for non-product callers.

### Phase 6 — verification and rollout

Completed locally:

- `pnpm.cmd run check`: curated reference index (56 references), ESLint and TypeScript passed.
- `pnpm.cmd exec vitest run --exclude lib/canvas-camera.test.ts`: **73 suites, 434 tests passed**. Existing jsdom navigation/scroll and local-storage warnings are non-failing test-environment limitations.
- `pnpm.cmd exec tsx --test lib/canvas-camera.test.ts`: **7 tests passed**.
- `node scripts/check-product-designer-database.mjs <temporary-PGlite-package.json>`: actual migrations passed atomic roadmap, owner isolation, attempt fencing, fulfillment, manual state, credit reservation/capture/release and prepared-plan cache checks. This uses an isolated database, never production.

Rollout requirements:

1. Apply `supabase/migrations/20260915045831_atomic_manual_state_generation.sql` before releasing the API/worker code. It adds `claim_screen_state_generation` and `save_product_prepared_plan`, callable only by the service role.
2. Release the matching Next.js application and Trigger worker together. Do not route new approvals into an older worker which lacks the new rendering/batch contracts.
3. No deployment, production data rewrite or paid generation was performed during implementation. Existing project content and approval snapshots are preserved.

Founder live evaluation before launch:

- Rerun the habit tracker and two-frame payment examples from projects `58dba9f1-8a8f-48c8-8853-d0db8a364698` and `3c9daace-5143-4295-8af2-3b87090b5fec` using fresh/reviewed scopes. Check complete tasks, natural audience vocabulary and absence of unsolicited paid states.
- Inspect both recreated frames against the original image, especially floating payment pills, visible wallet card and blurred background. Routing tests do not establish pixel fidelity.
- Exercise manual states, repeated clicks, dispatch interruption/retry, insufficient credits, parent edits, cancellation and generation retry. Confirm one delivered state/charge and an unchanged parent.
- Compare prompt-only, user style-reference and exact recreation across several domains (consumer habits, shopping, booking and an actually technical product). Verify that references influence visual quality without changing the audience or inventing claims.
- Measure time to first screen and total completion, including flows longer than eight outputs. Confirm real overlap and cache hits in production telemetry; local scheduler tests do not establish provider latency or rate-limit behavior.
- Recording inline behavior describes requirements for the static HTML output; it does not make the generated prototype a fully functional app.
