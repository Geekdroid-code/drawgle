# Proposal planner acceptance record — 2026-09-26

The single-candidate planner is now the default for standard discovery, including existing projects still in discovery. `DRAWGLE_DESIGN_FLOW_PLANNER=legacy` or `off` is an explicit rollback. Exact recreation and canvas edits retain their specialized paths. The saved product-fact, functional-roadmap, scope and approval formats are unchanged, and the existing owner/revision-checked database function applies a candidate atomically.

The `fab2ef25-3974-46ac-8f87-9cad3c678282` screenshots show the legacy tool sequence. That sequence can save provisional facts and a roadmap before flow review, then ask the model to repair the saved state. A repair that reuses an existing fact ID with changed meaning raises `FACT_ID_CONFLICT`, while subsequent tools in the same batch can still report a secondary flow-review error. The standard discovery route now bypasses this multi-tool sequence. Repeated fact descriptions map to saved identities; an unsupported correction cannot retire a user-confirmed fact. This diagnosis is based on the screenshot and code path; the connected Supabase account did not expose Drawgle, so the precise saved fact ID and stage durations were not independently read.

## Completed checks

| Check | Result |
|---|---|
| Single candidate, server-assigned identities, linked screen actions, fact repetition/supersession, missing destinations and evidence downgrades | Focused tests pass |
| Default standard project creation, existing discovery project route, exact-recreation exclusion, approval-card persistence, review repair, stale commit and duplicate-operation guard | Focused tests pass |
| Global project-token and scope-preparation keys; shared-design change creates a different key | Focused tests pass |
| Full Vitest suite | 105 files, 609 tests passed after the planner-mode test was updated |
| Node camera suite | 7 tests passed |
| TypeScript, curated style index, ESLint | Passed; ESLint retains one unrelated existing `PricingDialog.tsx` warning |

`pnpm run check` could not start because the local pnpm launcher refused its registry-signature/version switch. Its three constituent checks were run directly from the installed local binaries and passed. No application database migration was added or applied.

## Still required for live release acceptance

- Run the saved-state replay of the reported prompt-only failures and a real owner-scoped PostgreSQL transaction check in a connected Drawgle test database. The available Supabase connection did not expose the Drawgle project during this session.
- Build representative family-organizer and doctor-booking scopes through the new planner in a disposable project. Review the complete screen families, navigation, assets and mobile viewports side by side against the legacy path.
- Compare the newly recorded model token usage and elapsed stages with matched legacy runs. Confirm no accepted visual regression or increased planning cost per approved scope. Record first useful response, approval-card and first-ready-screen timings.
- Deploy compatible app and Trigger worker code together. Keep `DRAWGLE_EARLY_PROJECT_DESIGN_MODE=on` only if its own visual comparison has passed. Setting the new planner flag to `legacy` returns standard discovery to the prior tool loop if rollback is needed.
