# Generation rescue: first useful screen and one coherent product

Status: implementation plan and original diagnosis. Local implementation and verification are recorded in [generation-acceptance-2026-09-25.md](generation-acceptance-2026-09-25.md). Live acceptance remains separate from local code checks.

## Evidence and release bar

Production run `899c29ac-affa-4dc7-baf8-6f4352f3237f` on 2026-09-24 is the baseline. The `generate-ui-flow` worker ran from about 07:27:38 to 07:30:39 UTC. It received neither design tokens nor screen briefs. It generated the visual direction, tokens, blueprint and all five briefs before triggering the first screen at 07:29:10; the first child completed at about 07:29:35. Thus the worker alone spent roughly 117 seconds before the first ready screen. The approved five-screen run completed technically while the canvas showed inconsistent composition, poor content density and unusable visual hierarchy. The user also reported broken navigation. We have not read that run's saved navigation HTML, so its exact fault remains unverified.

Targets for a controlled launch evaluation, measured from the user's click and separately from worker start:

- First useful response to a planning message: p90 under 20 seconds. A status spinner does not count; a concrete screen/flow answer does.
- First **ready, actually rendered** screen after Build: p90 under 60 seconds on a warm prepared scope. Publish the cold-path distribution separately; do not hide misses inside the warm number.
- Five-screen batch: one typography/spacing/surface/navigation family, five task-specific compositions, no severe text collision, clipped action, blank focal visual, or horizontal overflow at 390×844 and 320×640. All five must pass; cherry-picking one does not count.
- Navigation: each root destination has one correct active item and sufficient content clearance; detail screens have a usable back action and no duplicated persistent shell.
- Product trust: failed preparation never changes approved scope, never charges credits, and never produces stale screens. Do not publish a screen as ready based only on valid HTML.

Use this run plus two different real references and one prompt-only project. Record timings, rendered screenshots, nav actions, and user acceptance before enabling for general users. If the same five-screen case still fails after one bounded rescue cycle, narrow the product offer instead of continuing with prompt-only patches.

## Current critical path and why existing work was insufficient

1. `lib/product-planning/designer.ts` saves the proposed scope and ends the designer turn. No design-token or generation-plan preparation starts while the user reviews it.
2. `lib/product-planning/approval.ts` verifies the proposed revision and image, then `app/api/generations/route.ts` queues generation. The coordinator in `trigger/generate-product-flow.ts` selects the first batch.
3. `trigger/generate-ui-flow.ts` loads reference context, generates tokens when absent, then calls `planUiFlow`. `planUiFlow` performs a blueprint call and one call containing **every** screen brief. Navigation shell creation and asset planning follow. The first builder cannot start until these shared stages finish.
4. Per-screen asset resolution and rolling two-wide builds now overlap once planning finishes. This helped the latter part of the run but cannot shorten the preceding serial path. Existing prepared-plan lookahead works only for a later batch, not the first one.
5. The planner computes `screenFamilyContract`, but the individual builder previously received no explicit copy. Tokens express values, not layout grammar. Sibling root screens get no top-chrome continuity evidence because that mechanism covers top bars and sheets only. The screen-health check catches malformed source and missing anchors, not rendered visual failure.
6. The saved product prompt and reference observations for the baseline specifically favored soft, high-radius cards. The engine translated that into too many bordered containers. Future preparation must distinguish reusable *material* from the reference's screen topology and let the target task own density and layout.

## Phase A — make preparation happen while the user is reviewing scope

Start a service-only `prepare-generation` Trigger task when a validated scope becomes `proposed`, after the approval card is persisted. This task may spend provider tokens but creates no screens, reserves no user credits and never changes approval state. It builds the design-token document, the first-batch blueprint and builder-ready briefs, and saves them as a versioned preparation record. Do not block the designer's response on its completion.

The preparation key must hash the exact user facts/content revision, proposed manifest and output order, reference identity/hash and mode, design requirements, project token/navigation revisions, and preparation schema version. Exclude volatile lease and chat timestamps. An approval can consume the record only when all identities still match. A changed answer, reference, selected scope, token edit, or navigation edit invalidates it. Preparation work finishing after invalidation is discarded, never applied to the project.

Store the record outside `projects.design_tokens` and `project_charter`; it is speculative until approval. Use an additive, service-only table or restricted transaction with project ownership checks, a unique `(project_id, preparation_key)`, bounded retention, and a short claim lease to deduplicate requests. A preparation failure leaves the proposed scope and approval card intact. The approval path remains one click with no extra user gate. It can show `Preparing visual system` while the user reads the scope.

On Build, the coordinator passes the preparation identity to the worker. The worker verifies the key against the immutable approved snapshot and current design revisions before using any token or brief. A cache hit skips repeat provider calls. A miss uses the cold path and records why; do not silently accept a near match. Deploy the compatible worker and application together. An older worker must ignore rather than misread new preparation data.

## Phase B — remove the cold-path all-briefs barrier

Preparation can miss when the user approves immediately, so it is not enough by itself. Split planning into a validated blueprint plus an **anchor-screen brief** and remaining briefs. Once the blueprint fixes screen identities and navigation, plan the first approved screen's brief and assets, and build that screen while other briefs and assets run. Preserve the approved manifest order and stable keys. No provisional/random screen is generated; the anchor is the first paid, approved output.

Navigation shell creation depends on blueprint/tokens, not on the last brief; run it alongside anchor briefing. Asset requirements for the anchor come from its finished brief; later requirements can resolve independently. A builder may start only after its own brief, own asset manifest, current token revision, and required navigation shell are ready. Never show an unfinished asset result as final. Keep the existing credit reservation and per-screen capture rules; a failed anchor does not consume a sibling's credit or make its placeholder ready.

If the first screen fails to render correctly, do not use it as the family's style exemplar. The other plans can finish, but further builds should wait for a valid visual basis or fail clearly. Keep the existing cancellation, idempotency and regeneration fences when decoupling tasks. Record queue time, token time, blueprint time, anchor brief time, nav time, asset time, first byte and first ready per screen so a future 3-minute run identifies its blocking edge.

## Phase C — enforce one visual family without cloning one layout

Pass the already planned `screenFamilyContract` to each builder (local change made). Scope it to typography, edge/surface treatment, spacing, controls, imagery, and navigation. A Today screen, form and calendar should have different composition because they serve different tasks. No rule should turn every region into a bordered card just because the reference contains one.

Before building siblings, derive a small **component/style evidence** object from the first valid rendered screen: actual heading/button/input styles, screen rail, surface roles and icon weight. Reuse those properties, not the first screen's HTML tree or section order. Evidence is tied to token revision and generation run. A failed/replaced anchor invalidates it. Exact screenshot recreation bypasses this mechanism because each supplied frame owns its structure.

Navigation is a renderer-owned component. The current v2 shell is already deterministic; the next investigation is its plan, screen assignments and iframe clearance, **not** another navigation prompt. Render and check it with each root/detail role. Do not ask every screen builder to improvise a second nav. Diagnose the baseline's saved plan and assignments before changing the shell; a screenshot alone does not prove whether plan identity, assignment or viewport clearance failed.

Asset identity is part of this family contract. Do not substitute an unrelated stock face for a named child or family member. Where no user-provided image exists, use an intentional initials/illustration placeholder. Keep asset fetching outside the first-screen critical path when the asset is optional; an essential approved image must resolve or fail clearly.

## Phase D — judge the result users actually see

The current source checks in `lib/generation/screen-quality.ts` remain necessary but are not visual acceptance. Add a bounded renderer check at the same viewport and token/nav combination used by the canvas. Measure viewport width overflow, overlapping visible text/control rectangles, CTA/nav occlusion, missing shared-nav clearance and empty primary visual regions. Store the rendered evidence and check result with the generation run. One bounded repair may address a concrete defect; never loop indefinitely or regenerate the whole batch because a subjective score is low.

Cross-screen visual acceptance needs both automated evidence and human review. Compare the five resulting screenshots side by side for density, typography, spacing, surfaces and navigation. Automated geometry checks cannot decide whether a layout is contemporary or tasteful. Do not label structurally valid HTML `healthy` as proof of good design. For production, a screen that fails a blocking render check stays failed/retryable, with its previous accepted design preserved and credit handling following the existing failure path.

## Sequencing, rollback and acceptance

1. Keep the family-contract wiring behind the existing generation route and verify style, prompt-only and recreate behavior. No database deployment is needed for this step.
2. Add the preparation store/task with exact-key tests, cancellation, changed-scope and changed-reference tests. Run it in observation mode first; compare its output to the ordinary worker without consuming it.
3. Consume exact preparation hits and instrument warm/cold timing. Then split the cold-path anchor brief and asset path, with cancellation and credit regression tests. Do not add a second planning approval.
4. Add renderer/navigation/asset identity checks and review the baseline project plus two diverse cases in a browser. Check 320px and 390px widths and actual exported HTML, not only the canvas thumbnail.
5. Enable by cohort; track p50/p90 first useful response, first rendered screen, batch finish, preparation hit rate, quality failures, manual regenerations, refunds, and explicit user acceptance. Roll back preparation consumption or new builder coordination independently; retain records for diagnosis.

See the acceptance record for completed wiring, checks, and deployment evidence. No production deployment or new paid generation was performed in that implementation session.
