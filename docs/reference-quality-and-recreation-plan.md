# Reference quality and faithful recreation plan

Status: proposed implementation plan. No runtime changes are included in this document.

## Product decision

Preserve reference-led generation as Drawgle's default. A detailed prompt is not proof that image-free generation will match the current design quality. Do not introduce a classifier that decides a brief is long or detailed enough to remove visual evidence automatically.

Instead, choose and apply references according to the user's product and explicit visual direction. A curated image can support a rich brief, but cannot silently replace that brief's design choices. Keep exact recreation as a dependable way to bring existing designs into Drawgle, with product design available afterward on the same canvas and in the same ChatPanel.

The founder's quality objective remains: prompt and style-reference projects should produce premium, coherent product designs while preserving the strong recreation capability.

## Confirmed codebase findings

- `lib/product-planning/inspect-reference.ts` loads an existing image or selects a curated match, inspects its pixels, and persists the curated image through `storePlanningReference()`.
- `lib/product-planning/designer.ts` saves that path into `input.imagePath`. `input.referenceSource` and `planningReferenceContext()` already distinguish curated and user evidence in planning.
- `lib/product-planning/experience.ts`, `model.ts` and `approval.ts` currently require image-backed experience state for version-2 proposals/approvals. A rich user specification alone cannot pass this gate.
- `trigger/generate-ui-flow.ts` forces `user_upload` when an approved product snapshot has an image path. The API and reference-policy resolver also infer user-upload status from image presence. Planning provenance therefore does not survive execution consistently.
- `lib/generation/service.ts` injects product truth and grounds the charter for recreation as well as product design. The `exact_recreate` intent does not remove the injected context. `generation-context.ts` also compiles product-oriented instructions into the execution prompt.
- `shouldAttachReferenceImage()` intentionally sends pixels to the final builder only for exact recreation. Style references currently influence inspection, art direction and tokens. Preserve this distinction during the compatibility work; do not start attaching curated pixels to the final builder as an incidental fix.
- `normalizeReferenceImage()` reduces stored planning images to fit 1024 by 1024 and encodes WebP at quality 88. This can limit detail in multi-screen composites. It is a fidelity risk to evaluate, not a proven explanation for every mismatch.
- Recent production fixes already provide source-index binding, direct image rendering for supplied state frames, independent canvas grouping, immutable reference hashes, manual derived states and bounded parallel generation. Preserve those fixes.

`4f9fdd5` is the product-planning integration commit. Its parent, `1383250`, is the historical recreation comparison point. Use a separate checkout for comparison; do not roll back the current repository wholesale.

## Invariants

1. User-selected recreation/style mode is project state, never reclassified from conversational wording or image presence.
2. Explicit user product and design choices remain authoritative in product-design modes. Assumptions stay distinguishable and can be superseded through existing incremental updates.
3. Curated evidence supports unspecified design decisions. It does not supply product features, user demographics, domain vocabulary or hidden requirements.
4. Exact recreation uses supplied frame evidence and explicit requested changes. Inferred product improvements cannot alter the frames.
5. Reference-led generation remains the default, including for rich prompts. No prompt-length threshold or model-certified quality-equivalence gate.
6. Preserve the existing brief format, builder architecture, visual-quality instructions and reference-to-design workflow unless a measured regression requires a specific change.
7. No new discovery dashboard, large generic agent framework, industry screen lists or mandatory visual questionnaire.
8. No paid screen generation before explicit scope approval. A reference suggestion or direction choice is not generation approval.
9. Historical approved runs keep their evidence, outputs, prices and identities. New interpretation must not silently rewrite an immutable approval.

## Expected behavior

| Situation | Behavior |
| --- | --- |
| Rich product and visual brief | Retrieve compatible visual evidence; preserve explicit choices and use it to develop unspecified details. |
| Detailed screen flow, vague visual direction | Keep the product flow; recommend a concrete reference-backed visual direction. |
| Partially specified visual direction | Bind the explicit choices; reference evidence can guide the remaining choices. |
| Existing designed project | Continue its established design system. Do not silently retrieve a replacement aesthetic. |
| User-supplied style reference | Inspect it and adapt its craft to the product. Explicit user changes override corresponding reference details. |
| Exact recreation | Identify requested source frames and reproduce them directly. No product discovery or curated fallback. |
| No compatible curated candidate | Offer one concise recommendation/choice in existing chat. Do not silently apply the nearest conflicting reference. |
| User explicitly chooses no external reference | Honor that choice without hidden curated injection. Do not claim proven parity with reference-backed generation. |

For example, a brief specifying cream backgrounds, restrained typography, dense lists and no gradients must not inherit a dark terminal aesthetic because the closest library image is a fintech design. A candidate can still contribute suitable typography or component treatment if those transferable characteristics remain useful after respecting the user's requirements.

## Phase 0 — establish the quality baseline

Before changing execution behavior:

- Save representative input/output examples from the current implementation for prompt, style-reference, exact recreation and existing-project continuation.
- Include sparse and rich briefs, partial visual requirements, deliberately conflicting references, two/three-frame composites and a supplied frame depicting a state.
- Compare recreation against `1383250` using identical source images and matching model/provider settings where available. Record any unavailable historical settings rather than attributing all variation to the code.
- Record reference source/hash, actual image dimensions sent to each stage, selected candidate, compiled briefs, tokens, output HTML/screenshots, latency and cost. Do not log credentials.
- Separate product-flow evaluation from visual-craft and reference-fidelity evaluation. A prettier output can still fail if it changes the user's requested design.

Deliverable: a small reproducible evaluation manifest and baseline results, with live runs explicitly identified. No claim of quality preservation based only on tests.

## Phase 1 — preserve reference provenance through execution

Trace and update the full path: planning inspection → project state → approval snapshot → generation API → coordinator → worker → reference DNA/project memory → retries and prepared-plan caches.

- Extend existing reference contracts only as needed. Keep origin (user, curated, existing project) separate from purpose (recreate, style evidence, project continuity).
- Continue storing cached images safely if useful. A shared storage bucket/path is not itself the problem; the stored file's existence must not redefine its origin or authority.
- Pass curated reference ID and catalog revision/hash where available. Do not lose them when caching the image under the project owner.
- Replace the worker's unconditional `user_upload` override and API inference with the frozen approved reference context.
- Resolve older states from reliable stored provenance, such as `referenceSource` and the matching experience reference ID/path. Do not classify ambiguous historical images from filenames alone.
- Invalidate incompatible new cache entries when the reference contract changes. Keep old approvals stable and use explicit compatibility adapters where needed.
- Derive progress labels from the same resolved context; message wording is a consequence of correct behavior, not the primary fix.

Acceptance: a curated reference remains curated in every execution/retry stage, and its pixels/identity do not change unexpectedly. A genuine upload remains user evidence. This phase should preserve existing output behavior apart from incorrect source interpretation.

## Phase 2 — select compatible references without weakening design craft

Primary extension points: `inspect-reference.ts`, `curated-style-selection.ts`, `curated-style-references.ts`, the existing experience schema and product fact compilation.

### Use explicit requirements, not invented restrictions

- Compile active, evidenced user preferences and relevant constraints from existing blueprint facts. Retain their fact IDs/revision and distinguish confirmed choices from assumptions.
- Represent only meaningful requirements: palette, typography, density, composition, imagery, brand rules and explicit exclusions when the user actually specifies them.
- Avoid turning words such as premium or sophisticated into arbitrary fixed fonts, colors or layouts.
- Keep derived compatibility information compact in existing experience state. Do not create a competing design system or regenerate the blueprint every turn.

### Retrieve, inspect and decide compatibility

- Use explicit visual requirements in the existing retrieval query alongside product context.
- Extend the existing retrieval result to expose a small bounded shortlist if necessary. Inspect actual candidate pixels; embedding similarity alone cannot establish visual compatibility.
- Prefer integrating compatibility assessment into the existing reference-inspection call rather than adding repeated agent conversations.
- Validate a compact result: candidate identity, conflicting explicit requirements, useful transferable characteristics, and a rationale. The model evaluates compatibility, not whether a text prompt can guarantee equal design quality.
- Reject a candidate when respecting the user's requirements would remove its central useful characteristics. Do not approve every candidate merely because colors could theoretically be changed.
- Bound candidate inspection and retry work. When no candidate fits, return a clear unresolved direction to chat rather than looping or secretly applying the highest similarity score.
- On changed visual requirements, re-evaluate a saved curated match; the existing saved path must not prevent a better selection. Reuse a still-compatible match without unnecessary inspection.
- For a supplied style reference that conflicts with explicit instructions, preserve the explicit instructions and explain material tradeoffs. Do not substitute a library image without the user's direction.

Acceptance: rich briefs still benefit from appropriate evidence; incompatible reference characteristics cannot become defaults merely because an image was retrieved. Vague briefs retain the current creative freedom and visual richness.

## Phase 3 — preserve explicit choices in tokens and briefs

Use existing experience direction, design-token generation and screen-brief inputs. Avoid a wholesale planner or builder rewrite.

- Compile the confirmed requirements and permitted reference influence once from approved state, then provide them consistently to inspection, token generation and detailed screen planning.
- Make source precedence clear: explicit current user requirements first; established project choices next unless intentionally changed; compatible reference characteristics for the remaining decisions; designer judgment for unresolved details.
- Retain full visual descriptions, hierarchy, component relationships and asset planning. Do not replace rich briefs with a checklist or reduce the designer to token matching.
- Preserve current style-mode image attachment behavior. Any experiment with direct style pixels in the builder must be a separate measured change.
- Add a focused consistency check of generated tokens and builder-ready briefs against explicit requirements. Use deterministic checks for exact values where appropriate and a narrow semantic review for meaning. Correct only identified conflicts through a bounded retry/patch path.
- Do not let the review redesign otherwise valid screens, invent stricter requirements, or endlessly revise subjective choices.
- Carry the approved constraints through builder context and retry paths without relying on truncated chat history. Include their revision in prepared-plan reuse decisions.

Acceptance: an explicit cream palette/no-gradients request survives token generation and brief preparation, while unspecified design decisions remain creative. Live output review verifies whether those constraints also survive rendering.

## Phase 4 — handle reference exceptions without a questionnaire

Keep reference-backed readiness as the default. Do not automatically bypass matching because a prompt is long, structured or judged visually complete.

- If the chosen evidence is compatible, proceed naturally through the existing scope conversation. Do not add a compulsory separate style approval.
- If no candidate fits, provide one concise recommendation using existing optional question/action-card conventions: choose a compatible alternative, supply evidence, or explicitly proceed from the user's design specification.
- An explicit no-reference choice must have a durable representation and corresponding readiness/approval validation. It must also disable curated fallback in downstream execution and retries, not merely skip `inspect_reference`.
- Update image-backed experience validation only for these explicit exceptions and for legitimate existing-project continuity. Do not loosen readiness globally.
- Reuse the existing question budget and skipped-question handling. Avoid cosmetic preference interrogation when the assistant can make a low-risk assumption.
- Show material recommendations in plain language, such as preserving the user's palette and layout while borrowing typography treatment. No implementation metadata in the product UI.

Acceptance: users cannot be trapped by a mandatory reference error, and choosing to proceed without external evidence never causes a hidden curated image to be applied later.

## Phase 5 — isolate exact recreation

Preserve the same project, ChatPanel, approval controls, credit accounting and rendering infrastructure. Introduce a small reconstruction-specific preparation module rather than a second assistant or duplicated generation stack.

- The recreation branch receives source frames, their verified identities/order, observed structure and explicit requested changes. It does not receive the full product blueprint as an instruction to redesign the source.
- Bypass product discovery/readiness questions that are irrelevant to reproducing visible frames. Ask only when frame selection, boundaries or a requested change is materially ambiguous.
- Keep the existing `planUiFlow()` recreation machinery where useful, but remove product-truth injection, product-grounded charter overrides and adaptive experience instructions from this branch. Use a minimal source-grounded charter if downstream code needs one.
- Preserve the original user request separately from generated product prompts. Do not feed `scopedGenerationPrompt()` product adaptation language into reconstruction.
- Retain direct image rendering for supplied state frames and independent parent/state canvas grouping. No clone-and-edit fallback for a frame with its own source evidence.
- Each source frame owns its visible chrome, composition and copy. Shared navigation, the first rendered screen, inherited product tokens and domain-copy review cannot override it.
- Keep product memory available to the assistant after import. Adding a new flow uses normal product design grounded in the existing app; recreating the imported frames does not require understanding the whole future product first.
- Preserve explicit generation approval and price disclosure without forcing a product questionnaire for a clear recreation request.

### Preserve usable source detail

- Audit normalization from upload through every provider request before changing dimensions. Preserve an original/high-detail source separately from lightweight inspection previews where needed.
- For multi-screen composites, derive and validate per-frame crops from verified frame bounds, retaining the composite as context. Do not rely on invented bounds or silently cut off overlays/shadows.
- If reliable crop boundaries are unavailable, use sufficiently detailed composite evidence or request the smallest necessary clarification; never manufacture source content.
- Preserve frame coordinates, source hash, derivative identity and transformation version through approval/retry. Do not silently replace the evidence of an older approval.
- Avoid repeated lossy normalization. Choose provider-compatible image sizes from measured fidelity and resource use, not a blanket resolution increase.

Acceptance: all supplied frames receive their correct image evidence and source-only instructions. Visual comparison verifies layout, typography, overlays, chrome and copy against the source and the historical baseline. Exact pixel equality is not promised by a routing test.

## Phase 6 — regression gates and rollout

Automated coverage must include:

- Curated/user/project provenance through creation, approval, child execution, retry and reference-memory reuse.
- Rich briefs retaining compatible references rather than triggering automatic text-only generation.
- A conflicting candidate rejected and another compatible candidate accepted; invalid reviewer responses cannot silently authorize a mismatch.
- Changed explicit preferences invalidate incompatible reference assessments and cached prepared briefs.
- Explicit user tokens/preferences take precedence; assumptions do not acquire user-confirmed status.
- No-compatible-match recovery is bounded and does not spend screen-generation credits.
- Explicit no-reference mode disables matching and fallback through execution and retry.
- Recreation planner and actual builder inputs exclude product adaptation instructions while including the correct source pixels/frame index.
- Supplied state-frame rendering, historical prices, output identities, manual states and existing-screen edits remain intact.
- Old project parsing, historical approvals, cancellation, credit idempotency and parallel continuation remain compatible.

Run the repository's normal `pnpm.cmd run check`, full Vitest suite excluding the separate Node camera test, and the Node camera suite. Run isolated migration/SQL checks if protected state or database contracts change. Do not run lint after every small edit.

Live evaluation must cover prompt-only, supplied style reference, exact recreation and existing-project continuation across multiple product domains. Compare visual craft, full-flow coherence, explicit-design adherence, fidelity, latency and cost separately. Model-based compatibility and semantic review can be wrong; retain human visual review as the release gate.

Roll out in independently verifiable changes: baseline → provenance → compatible selection → constraint preservation/exception handling → recreation isolation → evidence-resolution improvements. Separate recreation context isolation from crop/resolution changes in comparisons so regressions can be attributed. Preserve earlier credit/concurrency fixes when reverting a failed experiment.

Apply any required additive state/schema changes before dependent application and Trigger worker releases. Keep compatibility with older saved states; do not retroactively reinterpret approved work. No production migration or deployment is authorized merely by writing this plan.

## Progress logging during implementation

Create `docs/reference-quality-and-recreation-progress.md` when implementation begins. For each phase record the traced behavior, actual changes, tests/results, deviations from this plan and remaining live checks. Do not mark visual quality as preserved until the comparison evidence exists. Keep helpers in focused modules rather than further expanding the generation worker or ChatPanel.

## Scope of this plan

This plan changes reference compatibility, design precedence and recreation isolation. It does not replace the product blueprint, add a new screen planner, alter credit prices, remove the curated library, promise hallucination-free output or claim text-only quality parity. The current builder's visual capability is a baseline to protect throughout implementation.
