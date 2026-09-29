# Screen-flow planning: prevention instead of gates — 2026-09-29

## What was failing, from production data

Every product-planning turn since 2026-09-14 was read from Supabase (`project_messages.metadata.productPlanningFailure` and `planningPerformanceV1`).

| Project | Failure | Cause |
| --- | --- | --- |
| `8968251e…` (answer turn) | `scope_validation / SCOPE_VALIDATION_UNAVAILABLE` | Fingerprint `f6c6b232d59f` = `"Clarify the product's jobs."` The proposal saved a plan with no `jobs` fact, and a check that ran *after* the save rejected it. |
| `2f7c810c…` (repair turn) | same fingerprint | Same missing `jobs` fact. |
| `8968251e…` (after the 2026-09-28 "Astra" fix) | `proposal / PROPOSAL_UNAVAILABLE` after 1.3 s, 0 tokens | The fix pushed the requirement into a stricter Gemini response schema (grouped facts with `minItems`/`maxItems`). The very next call failed before any output. There were no retries and no logging, so the cause was invisible. |
| `0c219849…`, `2f7c810c…` (first turns) | `flow_review / REVIEW_UNAVAILABLE` | A second model ("coverage review") gated every plan. Its schema has nested `maxItems: 100`, integer bounds and enums of every saved ID. |
| Legacy-loop projects (Sep 16–27) | `FACT_ID_CONFLICT`, `SCOPE_OUTPUTS_MISSING`, `INVALID_TOOL_ARGUMENTS`, `FLOW_REVIEW_FAILED` | The same pattern: model output checked against rules it had not satisfied, with the whole turn failing. |

Hidden costs and bugs found in the same data:

- The evidence assessment was **repaired on 100 % of turns**: one extra model call every time. Its validator rejected output that could simply be normalized (an unexplained `delegation` field that had to be an exact quote, preview lines over 180 characters, key formats).
- A typical successful first turn cost six or more model calls: assessment, repair, proposal, fact-evidence check, reference inspection and coverage review. Repair loops added up to six more.
- The **Continue screen design** button posted `"Repair the saved screen-flow review issues…"` as a *user* message. It became planning evidence and leaked into the saved plan. `2f7c810c`'s scope goal became "Repair and formalize the core premium task management flow.", and that goal is the generation prompt.
- A user upload that conflicted with a written requirement stopped planning with `USER_REFERENCE_CONFLICT`. No card existed to resolve it, so Continue looped forever.

## The change

The model proposes; the server builds a valid plan from whatever it returns. Only genuine user decisions pause planning: the at most two question cards before a proposal, then the approval card.

1. **Proposal (`proposal-runner.ts`, `proposal-candidate.ts`, `proposal-response.ts`)**
   - The response schema is the flat, known-good format with no count or length constraints. Bounds live in normalization.
   - `normalizeDesignFlowCandidate` reads the response leniently: invalid refs, duplicate names, long text, missing fields, and the old grouped shape.
   - `ensureStructuralFacts` derives a missing identity, surface or journey from the request and plan as labelled assumptions. No fact category is mandatory in product mode.
   - `candidateRoadmap` resolves references by ref, saved key or screen name.
     - An unknown destination becomes an inline action (label and outcome kept).
     - Unknown fact refs fall back to the plan's surface and journey.
     - A name that collides with a planned screen edits it; a collision with a built screen is treated as a reference to that screen.
     - Dependency cycles are broken, and selection falls back to the screens the plan describes.
   - Flow: one proposal call → deterministic assembly → atomic commit → reference inspection only when the visual direction is missing or stale → approval card. A transient provider fault is retried; an unreadable response gets exactly one more attempt.
2. **Removed gates**: the coverage-review model (`readiness.ts`, `readiness-contract.ts`, `flow-preflight.ts`, journey bookkeeping in `flow-review.ts`), the fact-evidence model (`review-fact-evidence.ts`), and every proposal repair loop.
3. **Fact provenance (`designer-patch.ts`)**: a `source: "user"` fact must quote the user, as before. Its wording must also be grounded in the user's words (deterministic, ≥ 70 % of content words). Otherwise the fact is stored in the user's own quoted words. "Premium habit tracker" can never become a confirmed "biometric tracker for high-performance users". This replaces the fact-evidence model call.
4. **Evidence assessment (`assess-evidence.ts`)**: one call. Output is normalized: over-long text is shortened, keys are fixed, non-quoted delegation is dropped, and unrenderable questions are dropped. Exact recreation still requires a readable judgement.
5. **Reference inspection (`inspect-reference.ts`)** keeps its premium-quality role:
   - Curated candidates still need an explicit compatible verdict.
   - Long descriptions are shortened instead of discarding a good reference.
   - A user's own upload is never rejected: conflicts are recorded and explicit written requirements take precedence.
   - Shortlisting and inspection retry transient faults.
6. **Transient faults (`lib/ai/provider-retry.ts`)**: 408/429/5xx and dropped connections are retried twice (≈0.6 s, ≈1.8 s). Other errors surface unchanged and are logged with status and a short message; prompts are not logged.
7. **Continue (`designer.ts`, `questions.ts`, `ProductPlanningRecovery.tsx`)**
   - The click is stored as a `product_planning_continue` control message.
   - It is excluded from evidence, conversation and planner input, as are the legacy "Repair the saved…" messages.
   - It reuses a saved assessment that already allows a proposal, then re-plans with one call.
   - The recovery card no longer repeats the failure text or labels an outage as a "screen-flow review".
8. Product-mode canvas planning ("add an orders flow") now uses the same proposal planner. Exact recreation keeps its reconstruction loop, without the removed model gates. `DRAWGLE_DESIGN_FLOW_PLANNER=legacy` still selects the old tool loop.

## Cost and latency per first turn (prompt-only project, no questions)

| | Before | After |
| --- | --- | --- |
| Model calls when nothing fails | 6+ (assessment, assessment repair, proposal, fact evidence, reference, coverage review) | 3 (assessment, proposal, reference) |
| Extra reference calls when a library candidate is rejected | up to 2 | up to 2 (unchanged) |
| Extra calls on a bookkeeping mismatch | up to 6 (structure/coverage repair + evidence + review) | 0 |
| Largest removed input | coverage review ≈ 5–10 k tokens per call | — |

Answering question cards costs one proposal call, plus one reference inspection if the direction is not yet set. Continue after a stop usually costs one proposal call. It also re-assesses only when the saved assessment still has open questions, and re-inspects only when the visual direction is missing or stale.

## Verification

- Vitest: **107 files, 641 tests passed**. The three viewport-health tests need the pinned Playwright Chromium, as before. Node canvas suite: 7 passed. `pnpm run check` passes: curated index current (56), ESLint has 0 errors with the existing `PricingDialog` warning, and `tsc` passes.
- `planning-replay.test.ts` replays sanitized copies of the failed production projects through the real designer, the proposal planner and an in-memory database:
  - `8968251e` answer turn, with the exact saved plan that failed (no jobs, self-link, decision ref): reaches the approval card with one proposal and one reference inspection.
  - `2f7c810c` Continue from its saved failure: reaches the approval card with one proposal call, no re-assessment and no re-inspection. The "Repair…" text never reaches the planner, and the polluted goal is replaced.
- Not verified here: a live Gemini call. This session has no provider credentials. The proposal schema is the one used successfully in production before 2026-09-28, minus one property. Watch the first live turns; failures now log `Screen-flow proposal provider failure` with the HTTP status.

## Merge and deploy

At push time, branch `claude/drawgle-app-flow-planning-s19wmc` was this work on top of `main` at `7aef359`. If `main` has not moved, the merge is a fast-forward. Pushing `main` deploys the app (Vercel) and the Trigger.dev tasks together (`.github/workflows/deploy-trigger.yml` runs `pnpm run check` first). No database migration and no new environment variable are needed. `DRAWGLE_PLANNING_REPAIR_ENABLED` is no longer read.

Existing stopped projects recover with **Continue screen design** after deploy. Roll back with `git revert` of this commit.
