# Contextual editor and recovery acceptance

Updated: 2026-10-02. Status: **locally verified; deployed migrations and writer compatibility remain unverified**.

## Delivered behavior

- Inspector code is extracted into `components/visual-editor/` and pure `lib/visual-editor/` modules. Text, button, image, card, and layout-group selections expose their approved compact controls and one More section. Existing gradients, mixed spacing/corners, custom shadows, grids, responsive classes, and real token references remain unchanged until edited.
- Desktop opens the inspector through the existing bottom Edit tool and hides it when leaving Edit. Mobile selection never opens it; the separate toggle beside the profile opens the right drawer. Measured obstacles keep bottom controls clear at mobile and narrow desktop widths.
- Undo, redo, and History appear only in the inspector. History replaces the properties body, with Back to properties, a contained change list, and a preview/restore view. No floating history sheet remains.
- A history entry has explicit Before change and After change states. Before is the default. Restore uses exactly the previewed snapshot, so a Deleted element entry can restore its removed element. Restoring an already-matching version reports that it is unchanged.
- One draft previews styles, leaf text, and local images reversibly. Draft and local redo survive panel toggles and rehydration. Image upload happens on Apply; explicit changes commit as one batch. Failed uploads/saves retain the draft; retries keep their request ID. A replay fingerprint safely acknowledges lost responses, including deletion/duplication.
- Selection/context changes, navigation actions, AI work, and exports resolve pending changes through Apply / Discard / Cancel. Refresh/close uses the native unsaved warning. External revisions mark drafts stale and disable Apply. Cancelable same-document browser Back/Forward uses the Navigation API before routing, with repeated Cancel preserving the draft and explicit Discard proceeding. Browsers without this API cannot show the custom dialog for SPA history traversal; document navigation still uses the native unload warning. Noncancelable browser escape traversals are respected, as required by the Navigation API.
- Local undo/redo has priority while local history exists, including redo after returning to the baseline. Focused text inputs keep native undo. Saved history is contextual and owner-scoped, retaining 20 changes. Conflicting saves, uploads, generation, and recovery are locked out.
- Recovery reloads the selected screen source even after element deletion clears its element selection. Root/shared-navigation-root element deletion is prohibited. Other element deletion is confirmed and recoverable; whole-screen deletion remains separately permanent.
- The recovery code interlock, environment opt-in dependency, and disable branches are removed. Missing migrations or failed operations produce honest errors.

## Writer audit

| Accepted-source writer | Persistence path |
| --- | --- |
| Inspector and deterministic element edits | Common history commit RPC |
| Deterministic chat and AI screen/navigation edits | Common history persistence in API/edit runner |
| Generation/regeneration completion | Accepted-source history RPCs in workers |
| Project token saves | Owner-scoped token history commit |
| Navigation repair | Navigation history commit, including screen assignments |
| Visual asset repair command | Common history commit |
| Initial screen/navigation inserts | Initial baselines |
| Queued/building/failed generation states | Transient writes; last accepted code protected separately |

The unused direct `updateProjectFields.designTokens` write path was removed. Published templates are outside project history. Curated-library and sidebar work are untouched. This audit covers repository writers, not unknown external scripts or older deployed workers.

## Verification evidence

| Check | Result |
| --- | --- |
| Full Vitest suite | Passed: 175 files / 1,374 tests in the final integrated run |
| Separate Node canvas runner | 7 passed |
| Application and scripts TypeScript | Passed using installed binaries; final application recheck passed |
| Full ESLint | Passed with zero errors and one existing PricingDialog warning; final recheck passed |
| Curated style index | 107 references current, unchanged |
| Embedded PostgreSQL-compatible acceptance | Passed, including the deleted-element Before snapshot restoration |
| Real PostgreSQL 17.11 | Passed acceptance and controlled independent-connection concurrency tests |

The disposable PostgreSQL instance uses an isolated temporary directory and loopback-only access. No production data or credential files were read. The test instance was stopped after verification. Tests cover:

- Save/save, save/undo, recovery/delayed AI, and screen deletion/late worker lock ordering.
- Undo/redo request replay, CAS, owner/grant isolation, stale cursors, retention, and new branches after undo.
- Failed history insertion rolls back source; navigation restoration/rollback spans multiple screen rows.
- Combined Apply → Undo → Redo → independent-connection reload → export preserves expected source.
- Deletion entry Before/After previews differ; Restore before brings the element back, Undo removes it, and Redo restores it. Repeating the restore request replays safely.
- Deterministic request fingerprints reject a reused ID with different operations or ownership.

Browser Back → Cancel → Back → Cancel retained text and preview; explicit Discard then returned to the workspace. The guard does not insert synthetic history entries. Browser checks used the existing local application without submitting saved project edits or generation jobs. Draft adjustment/undo/redo, guard Cancel/Discard, original DOM restoration, panel toggles, and unchanged zoom were exercised. Light/dark layouts were checked at 1440×900, 1024×768, 768×1024, 390×844, and 360×640. A basic card has three fields and fits its default controls at desktop 900px height. Smaller panel bodies scroll while header/footer remain accessible; History stays contained; navigation has no editor tools. Popover bounds and keyboard dismissal were checked.

`pnpm run check` cannot launch pinned pnpm 10.33.2 because its registry signature/fetch verification fails here. All check components were run directly with installed local binaries. No signature bypass, dependency version, package-manager version, or lockfile changes were made.

## Deployment requirements

Install migrations first:

1. Existing foundations: `20260922120107_developer_export_context.sql` and `20260922120546_contextual_design_history.sql`.
2. New: `20261002160100_manual_edit_request_replay.sql`.
3. New: `20261002164500_history_before_snapshot_restore.sql`.

The Before/After restore correction requires the last migration. Existing legacy after-version RPC behavior remains compatible. Do not test the new restore flow against an unmigrated database and treat it as deployed.

Deploy compatible application and worker versions together, confirm all deployed saved-source writers, and drain incompatible in-flight jobs before exposing recovery. Run staging authorization, Apply/Undo/Redo/reload/export, failed-generation recovery, and navigation restoration. **No production/staging migrations or deployments were performed in this task.** Local tests do not certify deployed-writer compatibility.

Retain history tables on rollback. Reconcile affected heads after old-version or bypass writes before presenting saved undo as safe.

Developer handoff export remains independently controlled by `DRAWGLE_PRODUCT_HANDOFF_ENABLED`, which was not changed. Its real multi-screen Agent Pack acceptance in a separate test repository remains outstanding.

Navigation behavior follows the [Navigation API specification](https://wicg.github.io/navigation-api/), including its deliberate limits on canceling browser traversals.
