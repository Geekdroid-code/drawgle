# Early project design preparation — acceptance record

## Implemented

- `DRAWGLE_EARLY_PROJECT_DESIGN_MODE=off|shadow|on` defaults to `off`. Shadow prepares project-wide tokens without Build reuse; on reuses a matching candidate. Saved/manual tokens take precedence. Exact recreation remains on its strict path.
- Reference inspection can enqueue owner-scoped, service-only token preparation. The speculative result is keyed to the visual input and expires after 24 hours; it does not create screens or charge user credits.
- Scope preparation saves its reviewed blueprint, navigation, and briefs before planning assets. Build can use the approved first screen from that plan while the remaining assets are pending. The first-screen child never consumes assets for a different named screen; ambiguous duplicate names fall back to screen-specific asset planning.
- Preparation identity survives approval bookkeeping, and content, reference, requirements, or shared-design changes invalidate it. Build keeps the cold path on misses or preparation failures.

## Checks completed

- Full Vitest: 100 files, 586 tests passed.
- Node canvas suite: 7 tests passed.
- TypeScript `tsc --noEmit --incremental false`: passed.
- ESLint for every changed TypeScript file: passed.
- Curated-style index: current, 56 references.
- `pnpm run check` could not start because the pnpm bootstrap rejected its registry signature; its three constituent checks were run directly instead. Full ESLint passed before the final small test edit, and changed-file ESLint passed after the implementation edits.

## Release evidence still required

- Apply `20260926045614_early_project_design_preparation.sql` before deploying compatible app and Trigger workers. No Drawgle database migration was applied in this workspace.
- Keep the flag `off` until a shadow run compares project-wide tokens and complete screen families against the current path. The paired family-organizer and doctor-booking visual review, staging browser timing, and real database behavior were not available here, so visual equivalence and the under-60-second warm target are not claimed.
- A Next.js production build was not completed: sandboxed execution could not spawn a child process, and the unsandboxed request was rejected by automatic approval review because the build would load `.env.local`, which the repository explicitly prohibits agents from inspecting.
