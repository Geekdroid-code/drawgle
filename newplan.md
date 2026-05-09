# Plan: Screen Cost Reduction & Failure Fix

## Status: Draft — awaiting user approval

---

## Root Cause Analysis

### Issue 1 — "Half-built" screens (stuck spinner)
The screen is NOT actually half-written HTML. What happens:
1. Placeholder spinner HTML is inserted at `screens.code` with `status="building"` when the task starts.
2. buildScreenTask runs up to 3 LLM attempts internally. If ALL fail → `failWithoutSavingGeneratedCode()` is called.
3. `failWithoutSavingGeneratedCode` only fails the Trigger.dev task. It does NOT update `screens.status` to "failed" or `screens.error`. The screen stays forever at `status="building"` showing the spinner.
4. Result: user sees a screen stuck in the "loading" state — looks half-built.

#### Action - The fix is not a code logic fix — it's a model config fix in model-policy.ts - Implemented.

### Issue 2 — Cost (15 INR/screen, target <5 INR)
Three compounding cost drivers:

**A. Unbounded thinking tokens (dominant cost)**
- `gemini-3-flash-preview` uses `thinkingLevel: "medium"` for screen_build — no fixed cap
- Thinking tokens billed at premium output rate; for complex screens, 4,000–10,000 thinking tokens per call
- With 2–3 retries per failed screen → thinking cost multiplied 2–3×
#### Action - Implemented.

**B. `full_generation` token mode in system instruction (wasteful)**
- `buildSystemInstruction()` and `buildEditSystemInstruction()` both call `buildTokenPromptContext(designTokens, "full_generation")`
- full_generation = JSON.stringify(entire token object with 2-space indent) + 80-line usage guide ≈ 9,800 chars = ~2,450 tokens
- `compact_visual` mode for same tokens = ~2,800 chars = ~700 tokens
- **Saving: ~1,750 tokens per screen build just from this change**

**C. Redundant/bloated payload fields sent to builder LLM**
- `projectCharter.originalPrompt`: the FULL 500-word user prompt — DUPLICATE of the top-level `prompt` field
- `projectCharter.navigationArchitecture`: DUPLICATE of top-level `navigationArchitecture` field
- `projectCharter.planningDiagnostics`: internal pipeline metadata, zero value to LLM
- `navigationPlan.visualBrief`: ~100-word prose description sent on EVERY screen build (only needed for nav shell generation)
- `navigationPlan.screenChrome`: chrome mappings for ALL screens, not just the current one
- Typography role contract appears in 3 places (prompts.ts ×2, context.ts ×1)
- Navigation architecture contract appears in 2 places (system instruction + project context)

---

## Plan: Screen Cost Reduction & Failure Fix

**TL;DR:** Fix stuck-building screens by writing `status="failed"` on all failure paths, then cut per-screen LLM cost by ~65% via compact token mode, deduplication, and targeted thinking budget control — all without changing model quality.

---

## Phase 0 — Diagnose Actual Failures (2 hrs)

1. Use Supabase MCP to query the latest 4-screen project: join `generation_runs` (metadata column → `screenBuildDiagnostics`) and `screens` (status, error) to identify which exact error codes dominated failures.
2. Check Trigger.dev logs for that run to confirm whether failures are: `missing_completion_sentinel`, `invalid_static_html`, `health_failure`, or `max_tokens`.
3. Result gates what Phase 1 fix is highest priority (stuck-building fix vs validation relaxation vs token fix).

**Relevant files:** `lib/supabase/database.types.ts`, `lib/generation/screen-quality.ts`, `trigger/generate-ui-flow.ts`

---

## Phase 1 — Fix Stuck-Building Screens (2–3 hrs, unblocks Phase 0 verification)

4. In `trigger/generate-ui-flow.ts`, locate `failWithoutSavingGeneratedCode` (helper or inline pattern used at 3 failure points: completion, static HTML, health). **Before** returning the task failure, add a Supabase update: `screens.status = "failed"`, `screens.error = errorMessage`. This makes failures visible in the UI instead of showing the spinner forever.

   - All 3 failure paths in `buildScreenTask`: completion failure (L~349), static HTML failure (L~396), health failure (L~467)
   - After adding `status=failed` writes, test that the UI surfaces the error correctly

**Relevant files:** `trigger/generate-ui-flow.ts`, `lib/supabase/queries.ts` (updateScreenCode has status parameter)

---

## Phase 2 — Token Mode Switch (1 hr, ~1,750 tokens saved per screen)

5. In `lib/generation/prompts.ts`, change both `buildTokenPromptContext(designTokens, "full_generation")` calls (line ~419 in `buildEditSystemInstruction`, line ~511 in `buildSystemInstruction`) to `buildTokenPromptContext(designTokens, "compact_visual")`.

   - `compact_visual` mode still includes all color, typography, spacing, sizing, radii tokens — just omits the JSON dump and verbose usage prose
   - Saves ~7,000 chars = ~1,750 input tokens per build AND per edit call
   - **Lowest-risk change with highest token savings**

**Relevant files:** `lib/generation/prompts.ts` (lines 419, 511)

---

## Phase 3 — Payload Deduplication (2–3 hrs, ~1,000–1,500 tokens saved per screen)

For all fields that go through `compactBuildContext()` → screen build payload, strip redundant data before passing to `buildScreenTask`. Most efficiently done in `trigger/generate-ui-flow.ts` when assembling the task trigger payload.

6. Strip from `projectCharter` before sending to the builder:
   - `originalPrompt` (duplicate of top-level `prompt`)
   - `navigationArchitecture` (duplicate of top-level field)
   - `planningDiagnostics` (internal metadata)
   - `referenceScreens` if empty array
   - `imageReferenceSummary` if null
   - `designSystemSignals` if null

7. Compact `navigationPlan` for the builder payload:
   - Remove `visualBrief` (only needed when generating the nav shell, not individual screens)
   - Remove `screenChrome` array (only the current screen's chrome is needed, already in `screenPlan.chromePolicy`)

8. Replace the full `prompt` field in the screen build payload with a compact 50–80 word "builder brief":
   - Pattern: `${creativeDirection.conceptName}: ${creativeDirection.colorStory}. Build the ${screenPlan.name} screen — ${screenPlan.description.slice(0, 300)}`
   - This replaces ~667 prompt tokens with ~100 builder brief tokens per screen

9. Remove typography contract from `buildSystemInstruction()` — it's already included via `compactBuildContext()` → `formatTypographyRoleContract()`. One authoritative source.

**Relevant files:** `trigger/generate-ui-flow.ts`, `lib/generation/prompts.ts`, `lib/generation/context.ts`

---

## Phase 4 — Thinking Budget Control (2–3 hrs, ~40–60% cost reduction)

10. For `screen_build` task in `lib/ai/model-policy.ts`: change from `thinkingLevel: "medium"` to a fixed low budget.
    - Option A: If `gemini-3-flash-preview` supports `thinkingBudget` (check @google/genai types), set `thinkingBudget: 512` — enough to resolve ambiguity, not enough to burn 6,000 tokens
    - Option B: If only `thinkingLevel` is supported on Gemini 3, test `thinkingLevel: "low"` for screen builds (if available in API)
    - Option C: Switch screen_build to `gemini-2.5-flash` with `thinkingBudget: 0` — cheapest, good HTML quality. Use env var `DRAWGLE_GEMINI_FULL_BUILD_MODEL` to test without code change.

11. For `repair` task: same treatment — repair is also structured HTML gen, doesn't need heavy thinking.

12. Keep `thinkingLevel: "high"` only for `project_planning` and `design_tokens` where reasoning quality matters.

**Relevant files:** `lib/ai/model-policy.ts`

---

## Phase 5 — Agentic Context Selection (4–6 hrs, selective spend)

This is the "LLM decides what context to send" approach the user mentioned, implemented without extra LLM round-trips via static classification rules:

13. In `trigger/generate-ui-flow.ts`, add a `buildMinimalScreenPayload()` helper that selects context based on screen characteristics:
    - `isFirstScreen` (index === 0): include full creativeDirection + keyFeatures + designRationale
    - `isNavigationScreen` (requiresBottomNav && navigationPlan.enabled): include navigationPlan.items list only
    - `isDetailScreen` (chrome === "top-bar-back"): skip nav plan entirely
    - `isImmersive` (chrome === "immersive"): skip nav plan, skip bottom nav rules
    - Subsequent screens: include only `creativeDirection.conceptName + colorStory + avoid` list (3 fields, ~60 words)

14. For the edit flow (`buildEditSystemInstruction()`), skip project context entirely for block-scoped edits — the surrounding code context is sufficient.

**Relevant files:** `trigger/generate-ui-flow.ts`, `lib/generation/prompts.ts`, `app/api/edit/route.ts`

---

## Verification

1. After Phase 1: re-generate the 4-screen test project — screens should now show "failed" state instead of stuck spinner when generation fails.
2. After Phase 2: check Trigger.dev run → inspect input token count via Gemini API response metadata. Should see ~1,750 token reduction.
3. After Phase 3: generate a new 3-screen project. Check actual billed tokens per run in Google AI Studio console or Trigger.dev logs.
4. After Phase 4: compare per-run cost in Google AI console before/after thinking budget change. Target: ≤5 INR per screen.
5. After Phase 5: verify screen quality is not degraded (especially for 2nd+ screens in a project lacking full creative context).

---

## Decisions & Scope

- **In scope**: token reduction, stuck-screen fix, thinking budget control, payload deduplication, agentic context rules
- **Out of scope**: replacing the generation pipeline architecture, changing quality validators substantially, navigation shell changes
- **Key decision pending**: Phase 4 model swap (keep gemini-3 with reduced thinking vs switch to gemini-2.5-flash). Recommend testing Option C (env var switch) first before code change.

---

## Estimated Token Budget (after all phases)

| Section | Before | After |
|---------|--------|-------|
| System instruction token context | ~2,450 tokens | ~700 tokens |
| Project context (charter + nav) | ~1,500 tokens | ~750 tokens |
| Prompt / builder brief | ~667 tokens | ~100 tokens |
| Rules + contracts | ~1,125 tokens | ~800 tokens (removed dup typography) |
| Thinking tokens | 4,000–10,000 | 0–512 |
| **Total input** | **~5,742 + thinking** | **~2,350 + 512** |

At 2,862 total tokens vs ~10,000+ previously, cost drops by ~70–75%. At <5 INR per screen, target is achievable.
