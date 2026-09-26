# Proposal planner acceptance record — 2026-09-26

The new planner is behind `DRAWGLE_DESIGN_FLOW_PLANNER=proposal` and is assigned only when a new standard design project is created. The default is `legacy`; exact recreation and existing projects retain the prior planner. The saved product-fact, functional-roadmap, scope and approval formats are unchanged, and the existing owner/revision-checked database function applies a candidate atomically.

## Completed checks

| Check | Result |
|---|---|
| Single candidate, server-assigned identities, linked screen actions, fact repetition/supersession, missing destinations | Focused tests pass |
| Marked project creation, flagged designer route, approval-card persistence, review repair, stale commit and duplicate-operation guard | Focused tests pass |
| Global project-token and scope-preparation keys; shared-design change creates a different key | Focused tests pass |
| Full Vitest suite | 105 files, 605 tests passed |
| Node camera suite | 7 tests passed |
| TypeScript, curated style index, ESLint | Passed; ESLint retains one unrelated existing `PricingDialog.tsx` warning |

`pnpm run check` could not start because the local pnpm launcher refused its registry-signature/version switch. Its three constituent checks were run directly from the installed local binaries and passed. No application database migration was added or applied.

## Still required before enabling the flag

- Run the saved-state replay of the reported prompt-only failures and a real owner-scoped PostgreSQL transaction check in a connected Drawgle test database. The available Supabase connection did not expose the Drawgle project during this session.
- Build representative family-organizer and doctor-booking scopes through the new planner in a disposable project. Review the complete screen families, navigation, assets and mobile viewports side by side against the legacy path.
- Compare the newly recorded model token usage and elapsed stages with matched legacy runs. Confirm no accepted visual regression or increased planning cost per approved scope. Record first useful response, approval-card and first-ready-screen timings.
- Deploy compatible app and Trigger worker code before changing the server flag. Keep `DRAWGLE_EARLY_PROJECT_DESIGN_MODE=on` only if its own visual comparison has passed. Turning the new planner flag back to `legacy` routes marked projects through the compatible existing path.
