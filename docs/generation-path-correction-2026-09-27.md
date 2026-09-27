# Generation-path correction — acceptance record

## Root causes addressed

- An unset progressive flag selected the old full-batch worker path. A complete preparation also sent the entire first batch to one child run, leaving the user waiting for every brief before the first screen. Both app and worker now use the progressive path by default; `DRAWGLE_PROGRESSIVE_GENERATION_ENABLED=false` remains an explicit rollback.
- An unset early-design flag prevented project token preparation. Both sides now use the same default project-wide token policy. `DRAWGLE_EARLY_PROJECT_DESIGN_MODE=shadow` or `off` remains an explicit rollback.
- Preparation dispatch errors were swallowed. The app now records a sanitized dispatch failure without logging prompts or credentials. A missing or stale preparation still uses the cold path.
- A warm full-batch plan now projects its first approved screen into the first child. Its remaining reviewed briefs can be reused during that build instead of making another planner call. Exact recreation retains its previous batch behavior.
- The v2 final builder previously never saw curated style pixels. The first new-project screen now receives one normalized, size-bounded style image; siblings continue from its accepted visual-family contract. The legacy v1 behavior is unchanged. Explicit user design requirements and the actual reference outrank inferred per-screen tint and decorative-border suggestions.

## Checks

- Full Vitest after the final changes: 106 files, 627 tests passed.
- Node canvas suite: 7 tests passed.
- TypeScript, curated-style index, and full ESLint passed; ESLint has one pre-existing warning in `PricingDialog.tsx`. Changed-file ESLint and TypeScript also passed after the final code edit.
- The final v1-compatibility assertion passed in a focused 16-test rerun.
- `pnpm.cmd run check` could not bootstrap pnpm because its registry signature verification failed. Its constituent checks were run directly through installed local binaries.

## Production evidence

No new live generation or side-by-side visual acceptance has been run on this code. The observed project had no early token or scope preparation task, and its build planned four screens after approval; the code paths above directly address those timings. The next real multi-screen run must confirm first visible screen time, reference fidelity, sibling consistency, navigation, mobile geometry, and credit accounting before this is called visually accepted. Attaching one compressed style image adds a small image input to the first builder call but no additional model call; warm-plan reuse avoids a redundant planning call when preparation exists.
