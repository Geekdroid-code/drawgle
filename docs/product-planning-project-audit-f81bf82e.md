# Tacozz planning incident — 2026-09-15

Project: `f81bf82e-b085-41cd-9ed4-61e16cf0272d`.

Read-only investigation of the signed-in Drawgle conversation, project planning JSON and canonical roadmap in Supabase, and the matching Vercel request. No project decisions were modified and generation was not started.

## Observed execution

- Project created at 2026-09-14 19:02:04 UTC (00:32:04 IST).
- Four question rounds, two questions each. The user selected the first recommendation for all eight questions.
- Last answer persisted at 19:06:02 UTC; fallback assistant message persisted at 19:07:07 UTC. About five minutes elapsed from project creation to the failed outcome, including time spent answering.
- Matching Vercel request: `648rm-1789412759029-b641c82a6af8`, started 19:05:59 UTC, duration 68.9 seconds, HTTP 200. No warning/error/fatal console entry was displayed for that request.
- Project remains in discovery, revision 33, scope draft, no generation run on the scope, zero screens. The assessment records both readiness flags true and no gaps.
- Reference provenance is correctly `curated`, with style/adaptation mode. This is separate from the earlier no-image/recreation bug.

## Concrete validation blocker

The saved scope selects:

1. `screen:onboarding-narrative`
2. `screen:hero-drop`
3. `state:hero-drop:active-sale-v3`
4. `screen:product-detail`

The complete persisted roadmap contains only the three screen rows. There is no state row, including dismissed rows.

`snapshotFunctionalScope()` in `lib/product-planning/functional-store.ts` rejects any selected output absent from the active roadmap. For the observed snapshot its error is deterministically: `The selected output state:hero-drop:active-sale-v3 is not on the active roadmap.`

The exact earlier reason the state write did not persist is **not recorded** in project message metadata or the visible Vercel console. The `v3` suffix is not sufficient evidence to establish how many attempts occurred or why they failed. Do not attribute this to a database constraint or provider error without further evidence.

`runProductDesigner()` catches tool failures and returns them to the model, but normal route invocations do not supply its optional trace callback. An attempted proposal with no successful proposal is replaced by one generic fallback, losing the actionable failure detail and returning HTTP 200. The saved snapshot establishes a blocker, but does not reconstruct every tool call in the failed turn.

## Product architecture failure

The original prompt explicitly requests the complete app flow, not just main screens. Yet the three persisted product surfaces cover only brand onboarding, the hero drop, and product detail. Scope rationale emphasizes establishing the visual language. The saved plan does not connect the user’s stated job to a completed outcome across the app. The requirement is coherent product behavior, shared context and connected transitions—not mandatory screen names or a commerce template.

The product-detail action says “Add to Bag,” describes adding to a cart, but its destination is `screen:hero-drop`. This is a concrete example of an action pointing to an existing but semantically unrelated destination. It passes identity/link existence checks while failing the intended user journey. Renaming the action or requiring a particular extra screen would not solve that general defect. The onboarding row describes a multi-step experience as one output; distinct onboarding steps are not mapped.

The blueprint stores “Complete app flow” as a journey requirement without actually decomposing the purchase journey. The assessment nevertheless calls the brief comprehensive after resolving visual choices. This shows a gap between syntactic validity, conversation readiness, and semantic journey coverage.

## Question review

| Question | Assessment |
| --- | --- |
| Dropshipping versus limited-drop brand | A catalog/release-model question can matter, but this wording introduces dropshipping without evidence. The recommended answer bundles scarcity/countdowns with a premium-style rationale. |
| Brand storytelling versus immediate shopping | Useful ambiguity given the onboarding request, but the recommended narrative should not automatically imply an elaborate manifesto or forced introductory sequence. |
| Hero, grid, or horizontal gallery | Usually a designer recommendation based on product mechanics and reference evidence, not a required discovery answer. |
| Size bar, fit specifications, or size guide | False exclusivity: selection and fit guidance can coexist. The meaningful product question is whether sizing needs special support, not which widget the user prefers. |
| Registration during onboarding | Guest versus required account can materially change the journey. Its connection to checkout should have been considered earlier, without tying it to preserving a visual narrative. |
| Archive navigation | Could be recommended provisionally; first establish what users can actually do with past drops. |
| Countdown morph/animation | A low-risk interaction design decision. It should not block product understanding. |
| Desaturated versus stacked archive visuals | A low-risk presentation choice. It should not block product understanding. |

The cards improved answer entry, but did not solve question selection. Their first-option recommendations introduced additional design premises; subsequent rounds asked the user to refine those premises. Choosing the recommended options is valid acceptance, but the system must not rely on that to justify the quality of its original recommendations.

## Required follow-up work

1. Keep structured tool failure diagnostics, with tool, stage, error code/reason and turn ID, without secrets or complete prompts. Show an actionable recovery state instead of ending with generic chat text.
2. Validate scope identities against the persisted roadmap before saving them; return concrete available/missing identities for repair. Fix the state-write failure once its actual cause is established. Never bypass validation or simply drop the requested state.
3. Separate user-dependent product ambiguities from designer-owned visual recommendations. Rank the questions by their effect on the current journey; avoid repeated rounds of cosmetic decisions. Retain optional custom answers and skipping.
4. Establish the actual job-to-outcome journey before treating discovery as ready. A full-flow request cannot silently become an aesthetic sample. Existing ID checks need semantic coverage checks for outcomes, transitions and requested scope.
5. Keep user selections intact during recovery, repair the broader roadmap and selected scope, and obtain explicit approval before generation. Do not repair this project by forcing approval or inventing user-confirmed answers.

This incident is a live product-quality and observability failure that prior mocked/unit checks did not establish safety against. Regression tests must cover the coupled conversation, roadmap persistence, proposal and recovery behavior, alongside live evaluation of question usefulness.

## Implemented follow-up — 2026-09-15

See phase 6.3 in `product-designer-upgrade-progress.md` for delivery and verification.

- User-dependent decisions are classified and validated independently from tentative visual recommendations. Answered/skipped decision identities persist beyond the recent chat window.
- Review maps active actors, jobs and journeys to actual entry, transition and completion outputs. Deterministic checks enforce saved identities, reachability and full-request coverage; semantic review checks what the actions and outcomes mean. There are no industry-specific required screens.
- Scope selection now validates against saved roadmap outputs before persistence. The agent receives missing/available identities, can repair incrementally within its existing bounded turn, and retains a controlled recovery diagnostic when unfinished.
- The existing failure message is recognized by the same ChatPanel and offers click-only continuation. It does not approve generation or restart project creation.
- An isolated PostgreSQL reproduction with the actual identity trigger found a separate confirmed RPC defect: two states with the same state key on different parents collide because insertion temporarily clears the parent. Migration `20260915030014_product_functional_state_parents.sql` attaches parents during insertion and preserves atomicity and identity guards. This does **not** establish that the historical incident had that same SQL cause; its missing diagnostic cannot be reconstructed.

No production project data was changed during this implementation. Live question usefulness, semantic review accuracy and complete generated-flow quality remain evaluation gates.
