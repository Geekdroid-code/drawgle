# Planning and progressive-generation acceptance record

## Implemented locally

- Saved scope-review issues and reviewed revision drive one targeted repair on unchanged-input resume. Structural preflight identifies missing output identities and destinations before readiness review; a changed request invalidates the saved repair. The recovery card names the failed stage and a specific saved issue when one exists.
- Repeated identical product facts are no-ops. Changed facts require explicit supersession; dependent saved roadmap references are remapped in one database function call. Invalid links, inactive supersession targets, and schema failures receive distinct sanitized diagnostics.
- Prompt-only references may use a curated image or a recorded `prompt_synthesis` direction. The latter does not become permanent reference opt-out. Supplied-image recreation retains strict image verification.
- After a proposed approval card is saved, a service-only Trigger task prepares reference analysis, tokens, the first batch plan and briefs, and asset requirements. Its exact content/shared-design key is checked again at Build; a miss uses the cold path. Preparation does not create screens or touch credits. The additive table is restricted to service-role access.
- A cold Build dispatches the first approved screen alone, while planning for later outputs starts during that build. Warm Build consumes the matching first-batch preparation. Per-screen asset readiness, cancellation, output identity, and existing credit settlement remain in the current worker path.
- Sibling screens use visual vocabulary from the first accepted result rather than copying its layout. A failed first result does not start sibling builds. Named-family portraits without a supplied image use an intentional placeholder.
- The progressive worker renders each candidate with saved tokens and deterministic shared navigation at 390×844 and 320×640. It checks overflow, control overlap, active navigation assignment, primary action clipping, and navigation occlusion; one measured repair is allowed before the output remains retryable. Existing accepted source remains available on failure.
- Worker metadata records preparation hit/miss plus existing stage timings, first stream chunk, first screen row, first ready screen, asset outcomes, and model usage.

## Checks run

| Check | Result |
|---|---|
| Full Vitest suite, excluding the separately run Node-only file | 97 files, 575 tests passed |
| Node canvas-camera suite | 7 tests passed |
| `pnpm run check` | Curated style index, ESLint, and TypeScript passed |
| Chromium viewport fixtures | Included in the passing Vitest suite at both requested mobile widths |
| Read-only live UI inspection of projects `9cef36c9…` and `86523668…` | Both still show the saved planning-recovery state on the deployed version; no continuation or generation was triggered |

## Live acceptance not yet evidenced

This session's Supabase connection exposes a different project, and no Drawgle staging database/worker is connected. The new migration has **not** been applied from this session. Consequently, database grants and real concurrent connections, repaired approval cards for the two saved projects, the five-screen visual batch, two reference modes, warm/cold p90 timing, and production credit behavior have not been measured on the new build. The local tests do not prove those outcomes.

Deploy the additive migration before the compatible app and Trigger worker. Set `DRAWGLE_PLANNING_REPAIR_ENABLED=true` for the planning repair. Set `DRAWGLE_PROGRESSIVE_GENERATION_ENABLED=true` in both app and worker environments for preparation, warm/cold scheduling, and rendered acceptance. Both flags default off. Keep a disabled cohort while checking the two saved projects and the family-organizer batch on staging. Only report the under-60-second warm p90 target after real click-to-ready measurements and full-batch visual review.
