# Undo/Redo and developer handoff acceptance record

Status: **implementation under release gate; recovery controls must remain disabled**.

## Implemented

- Export: one owner-scoped database snapshot supplies saved screens, tokens, navigation, and per-screen approval sources. The deterministic compiler emits versioned product-spec Markdown/JSON, gaps, boundaries, and stable output mappings. Agent Pack, single-screen copy/Markdown, and HTML use this snapshot. Richer handoff is controlled by `DRAWGLE_PRODUCT_HANDOFF_ENABLED`.
- History: additive revisions, target heads and 20 retained before/after changes; owner-scoped service RPCs; optimistic concurrency, atomic commits, undo/redo/restore, no-op handling, stale-cursor reconciliation, navigation compatibility, and last-good screen recovery. The contextual client controls are implemented but gated by both `DRAWGLE_DESIGN_RECOVERY_ENABLED` and the code interlock `RECOVERY_WRITERS_VERIFIED = false`.
- Final application writes migrated: manual element operations, deterministic chat edits, AI screen/navigation edits, regeneration's accepted screen result, design-token saves, legacy editor saves, navigation repair, and the visual-asset repair command. Three unreferenced hardcoded legacy repair scripts that bypassed history were retired. Initial screen and navigation creation establish baselines. Whole-screen deletion remains confirmed and permanent.

## Evidence collected locally

| Check | Result |
| --- | --- |
| Vitest, excluding the Node-runner-only `lib/canvas-camera.test.ts` | 90 files, 531 tests passed |
| Node runner for `lib/canvas-camera.test.ts` | 7 passed |
| Isolated PostgreSQL-compatible migration/authorization test (`scripts/check-design-history-database.mjs` via PGlite) | Passed: ownership/grants, revision CAS, retry, undo/redo/restore, retention, independent contexts, stale reconciliation, atomic failure injection, failed-generation source, navigation repair rollback, screen deletion |
| TypeScript | `tsc --noEmit` passed |
| Curated style index | 56 references current |
| ESLint | Full repository passed |

The requested `pnpm run check` command could not start: the installed launcher could not verify/fetch the project's pinned pnpm release. Its three check components were run directly from installed local binaries. No lockfile or dependency version was changed.

## Remaining release blockers

1. **Real PostgreSQL concurrency:** Run the migrations and two-connection tests in a disposable staging database. The local PGlite test proves transaction rollback and authorization but cannot prove concurrent lock ordering. Test save/save, save/undo, delayed AI completion, replay after intervening writes, screen deletion versus late worker, and multi-row navigation rollback.
2. **Deployment writer audit:** Confirm that every deployed app and worker uses this commit and no external repair process writes saved source directly. Generation's queued/building/failed placeholder writes are transient and protected by the `last_accepted_code` trigger; initial inserts are baselines. A pre-existing or outside-the-repository writer can still invalidate a cursor, so reconcile before enablement.
3. **Staging workflow:** Apply additive migrations, deploy compatible app and worker, drain old jobs, then test real auth and ownership, refresh, browser keyboard/mobile controls, failed regeneration, and restore. Keep recovery disabled until this passes.
4. **Real handoff:** Export a real approved multi-screen project into a separate test repository and verify that a coding agent finds the behavior, identifies assumptions and gaps, and does not build deferred screens. Then enable `DRAWGLE_PRODUCT_HANDOFF_ENABLED` independently.

On rollback, retain history tables. Before re-enabling recovery after any old-version or bypass write, reconcile each affected head against live design and establish a fresh baseline; never display a stale cursor as safe Undo.
