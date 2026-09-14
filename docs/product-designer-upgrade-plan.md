# Product designer upgrade: implementation plan

Status: accepted plan; implementation and verification are tracked in [the phase log](product-designer-upgrade-progress.md). Live conversation findings are recorded in [the evaluation record](product-designer-upgrade-evaluation.md).

Finalized against the current repository on 2026-09-14. Implementation requires application, database and Trigger worker changes; the existing canvas refresh fix is retained.

## Outcome

Drawgle should develop a useful understanding of the user's actual product through the existing ChatPanel, agree on a design direction and a complete current scope, then deliver the approved journeys, screens and meaningful states on the same canvas. The number of generated frames is a consequence of the agreed work, not the starting point.

## Mode and reference contract

These behaviors are requirements of this upgrade, not interchangeable paths:

| User intent | Product conversation | How the image is used |
| --- | --- | --- |
| Reference-to-UI: design the user's product using an uploaded reference | Resolve material product and experience gaps; do not treat a reference as a complete product specification | The product designer sees the actual image, reasons about visible structure, content hierarchy and styling, and records what to transfer or adapt |
| Prompt without uploaded image | The same product-design process; resolve the relevant product context before committing to reference selection | Retrieve suitable actual images from the existing curated library, inspect them multimodally, and establish reference-backed design direction before approval |
| Image-to-UI: recreate supplied screens | Narrow, fast path; no broad discovery or redesign by default | Inspect the actual supplied frames, preserve their composition and visible behavior, and recreate the requested outputs without inventing missing product flows |

The current product designer already receives uploaded image bytes through `inlineData` in both style and recreate modes. A curated preset currently reaches it as a slug, not an inspected reference image. Close that gap by reusing curated retrieval earlier in experience planning. Do not claim the model has inspected an image when it has only received its name, tags or generated description.

Resolve behavior from the explicit mode plus the current request, not merely the presence of an upload or a stale project flag. If a user selects recreation but explicitly asks to invent a broader app, clarify that specific conflict rather than silently switching behavior. A later request to extend a recreated product uses product planning for the new scope and keeps the original screens intact.

For reference-to-UI, record three distinct kinds of evidence: visible observations, inferred intent, and the user's confirmed requirements. A visible action is evidence of an affordance, not proof of hidden business rules. The reference can justify a useful question or a layout recommendation; it cannot silently establish account requirements, checkout rules or other unseen product mechanics.

Persist reference identity/content hash, intended role, relevant frame/region mapping, analysis and the agreed transfer/adaptation decisions in existing reference/design context. Bind that evidence to scope approval and pass it through the existing downstream reference pipeline. Later generation must not silently select a different design direction. Raw images need not be sent to every model call: the experience reasoning must inspect the pixels, and downstream steps must receive the appropriate stable evidence and existing image inputs for their responsibilities.

Uploading/replacing a reference invalidates affected design assessment and proposal, while preserving confirmed product facts. Reuse analysis when the content is unchanged. Surface image loading/analysis failures; do not silently act as if a missing reference was inspected. Existing exact-recreation processing and fidelity remain protected, including multi-frame inputs and supplied state screens. Broader states are added only when requested and approved.

## Findings from the current implementation

- `lib/product-planning/designer-tools.ts` encourages useful questions but allows low-risk assumptions without a concrete boundary between incidental details and decisions that substantially change the product. All four tools, including `propose_scope`, are available immediately.
- `model.ts` structurally checks that identity, actors, jobs and journeys exist. A model can fill every section itself and pass. Missing blocking questions do not prove that important unknowns were resolved.
- `readiness.ts` reviews coherence of the supplied blueprint and latest message. It does not adequately establish whether major mechanics reflect user evidence, accepted recommendations or unsupported invention.
- `generation-context.ts` turns each selected product surface into exactly one named screen. A capability such as onboarding may require several steps/screens, or multiple capabilities may share one screen.
- The five-parent limit appears in planner intent contracts, roadmap selection, reconciliation and worker truncation. An additional eight-output reservation limit includes states. These execution constraints currently affect what gets designed.
- Blueprint-approved runs explicitly deselect generated states. The approval scope has no structured way to authorize those states first.
- The worker already supports parent-linked state generation from the parent's actual code, but ordinarily processes state groups after the parent batches. Reuse this capability and change its scheduling.
- Existing screen state, roadmap, navigation, credit reservation, retry and reference infrastructure should remain the foundation. Avoid creating another independent screen catalog or scope contract.

## 1. Make readiness depend on evidence and unresolved decisions

Extend the existing project planning state with a compact readiness assessment tied to the current product revision and reference inputs. Track the reason planning is waiting: product behavior, experience/design direction, scope review or generation. These are internal work states within the same chat, not a wizard or a required sequence of screens.

The assessment must distinguish:

- Facts directly supplied by the user or visible in an exact recreation reference.
- Recommendations the user has accepted, with a reference to the recommendation and response.
- Assumptions explicitly delegated to Drawgle.
- Incidental, reversible assumptions that can safely remain visible assumptions.
- Unresolved decisions that materially affect the selected journey, information architecture or experience.

Keep existing incremental updates, evidence, supersession history and optimistic concurrency. Do not convert delegated assumptions into claims that the user supplied those facts. Resolving a decision must retire the corresponding question and update affected journeys and scope.

Assess gaps against the user's actual brief, relevant conversation evidence, references and the blueprint. The absence of a model-created question must not count as evidence of readiness. Use a bounded assessment with structured gap/reason/evidence results, then enforce the resulting gate on the server. The writing agent must not be able to approve its own unsupported facts simply by adding more facts.

Do not expose the scope-proposal tool while material gaps remain. Retain server validation even when tools are filtered. Editing facts or references invalidates the relevant assessment and any stale approval.

An incomplete first prompt must lead to a useful product conversation before an approval card. A detailed brief or exact recreation can be ready immediately. Do not impose an arbitrary minimum number of turns.

## 2. Give the conversation a concrete design practice

On an incomplete idea, the first response should briefly reflect what Drawgle understood, identify the most consequential ambiguity and ask one or two connected questions. Include a recommendation where that helps the user answer. Avoid a long feature checklist or a speculative screen list.

For Tacozz, a possible first response is:

> I'll treat Tacozz as a focused shopping app with a restrained visual direction. Is it mainly a few limited drops or a catalog people browse year-round? And should onboarding simply introduce the brand, or collect information that actually changes the shopping experience?

These questions are examples of reasoning, not an ecommerce branch in code. Their answers change what Drawgle should explore next. Do not ask for information already supplied, and do not repeatedly ask the user to restate the whole product.

After answers, summarize the meaningful consequence and explore the next material gap. Offer product recommendations rather than requiring the user to design every interaction. A user who says "make those decisions for me" can delegate; record the chosen assumptions and expose them for correction.

Before final scope approval, give a concise synthesis of how the product works. User corrections should modify that understanding, not start a new isolated plan.

## 3. Collaborate on experience and reference direction

Add a compact experience brief linked to the product blueprint and reference evidence. It should capture the main task, information priorities, navigation approach, relevant content/data expectations and selected visual direction.

Interpret user references early enough to discuss what is useful about them. For prompts without a user reference, reuse curated reference retrieval so Drawgle's recommendation has concrete visual evidence. References influence composition and styling; they cannot establish unsupported product capabilities.

Ask about layout when the answer changes the experience: for example, a product-led shopping feed versus a campaign-led landing experience, or a task-focused dashboard versus a monitoring overview. Explain the tradeoff and recommend a direction. Do not ask the user to specify every component, spacing value or typography choice.

Keep this discussion in existing messages and small reference/action cards where helpful. Do not create a discovery dashboard, a separate assistant or a mandatory style-selection step. Clear references or an explicit delegation can satisfy this stage without extra questions.

Distinguish pre-approval experience reasoning from the existing downstream detailed screen/design planning. Screen-generation credits and rendering still wait for explicit approval.

## 4. Plan journeys, concrete screens and meaningful states

Keep the blueprint as broader product truth. Extend the current scope to identify the journeys and concrete roadmap items the user wants now. Reuse stable roadmap keys and existing screen/state types; do not derive an exact frame count from the number of product surfaces.

A functional plan should record, with incremental validated updates:

- Journey entry conditions, steps, branches and useful outcome.
- Screen purpose, information requirements, primary actions and navigation destinations.
- State parent, trigger/condition, meaningful content or behavior changes and recovery/next action.
- Whether a state requires a separate canvas output or is an interaction within its parent.
- Product decisions and reference/experience requirements supporting each item.

One product surface may map to multiple screens; multiple closely related capabilities may share one screen. The reasoning should explain the decomposition. Do not force onboarding into one frame, and do not automatically expand it to three without a purpose.

Validate coverage against the selected journey: missing prerequisites, disconnected actions, orphaned states, contradictory branches and absent outcomes. Partial scopes are allowed when intentional; show their boundaries and dependencies clearly. Do not insist that an onboarding-only request also generates the whole shopping app.

Separate business-level outcomes from visual presentations. Not every validation error, spinner or modal needs a new frame. Only distinct, useful design deliverables contribute to the quoted output count.

## 5. Approve the whole current scope, not an arbitrary batch

Extend the current in-chat approval card to summarize:

- The agreed product behavior and experience direction.
- The selected journeys, with expandable screen/state details and parent grouping.
- Important assumptions and intentional scope boundaries.
- Total parent screens, separately generated states and the full credit quote.
- What remains in the broader product roadmap.

Bind approval to an immutable revision containing the selected output identities, state dependencies and approved budget. The existing GenerationScopeContract remains the concrete execution contract; derive it from the approved deliverables and extend its state references if necessary.

If product/design planning later discovers a need to add an output, return that scope change to chat for approval. Do not silently generate extras or omit approved work to satisfy a limit.

## 6. Separate planning breadth from execution limits

Audit every five-screen, three-state, 24-item and eight-output boundary across schemas, prompts, validation, credit calculations and worker code. Remove limits that silently dictate or truncate product architecture. Keep explicit operational bounds for provider requests, concurrency and reservations.

Plan incrementally by journey when the product is large. A technical ceiling must produce a clear continuation or narrowing choice, not an apparently complete truncated plan. Do not simply change five to another arbitrary design target.

Use the existing roadmap and generation-run records to execute an approved scope across bounded batches. An approval may span several runs, all linked to the same immutable approved scope. The next batch must consume pending approved items rather than re-plan the product or substitute different screens.

Keep per-output idempotency and reservation/capture/release semantics. Check the full quoted cost on approval; reserve bounded batches using existing credit machinery. If balance becomes insufficient between batches, pause visibly with unfinished approved items intact. Never spend beyond the approved scope/budget or claim delivery is complete after a partial run.

## 7. Generate each state as a dependent design

Preserve existing reference selection, token generation, shared navigation/chrome and any initial design-anchor dependencies. Extend the current worker scheduling so a parent's approved states become eligible immediately after that parent is generated and validated, instead of waiting for all parent screens to finish.

Prioritize eligible state work within bounded concurrency. Reuse `buildStateVariantsForParent` and the saved parent's code, tokens, chrome and assets. Generate the specified state changes while preserving the parent design.

Parent failures block their states with a visible reason. Retries reuse stable output identities and regenerate only failed/missing items without duplicate charges. Product corrections during generation create a new revision; they must not mutate the approved work already executing.

Canvas and chat progress should distinguish completed, pending, blocked and failed work across batches. Preserve the refresh/remount fix and the continuous conversation.

## Implementation sequence

1. Add failing behavioral evaluations for premature proposals and incomplete journeys. Capture the current Tacozz behavior as a baseline.
2. Implement evidence-aware readiness, conditional tool availability and the conversational behavior. Make incomplete briefs reliably produce useful questions before expanding execution.
3. Extend functional journey/screen/state planning and the experience brief using existing durable state and roadmap identities.
4. Update approval, count/quote derivation and immutable scope snapshots. Remove the surface-equals-screen assumption.
5. Update planner contracts and implement continuation across bounded generation runs. Make parent/state execution dependent and resumable.
6. Run compatibility, credit and lifecycle regressions; evaluate actual conversations and generated app flows in a migrated test environment.

Use small modules for assessments, functional-plan validation, scope derivation and execution scheduling. Extract touched orchestration from large existing files where useful; do not expand the current monolithic route/service/worker with another embedded subsystem.

Schema additions must be backward-compatible and validated. Existing projects without a blueprint keep opening/editing normally. Existing planning records require a versioned reader/upgrade path; do not invalidate completed outputs or infer new user approvals during migration. Preserve approvals already executing and require review only when their scope changes.

## Concrete integration boundaries

| Existing code | Implementation responsibility |
| --- | --- |
| `app/api/projects/route.ts`, `ProjectLobby`, `ProjectShell`, `ChatPanel` | Keep immediate project creation and the same empty canvas/chat; extend existing cards and reference messages only |
| `app/api/agent/route.ts`, `lib/agent/router.ts` | Preserve explicit discovery routing before canvas intent routing; retain normal editing and product-planning handoff in canvas mode |
| `lib/product-planning/model.ts`, `store.ts` | Versioned project planning state, incremental validated decisions, readiness/experience revisions and current scope references; preserve CAS and turn leases |
| `designer.ts`, `designer-tools.ts`, `readiness.ts` | Evidence-aware gap assessment, conditional proposal availability, natural conversation, functional-plan deltas and server-enforced readiness |
| `curated-style-selection.ts`, `curated-style-references.ts`, `reference-image.ts`, `reference-dna.ts`, `reference-transfer.ts` | Resolve and inspect concrete references during experience planning; persist and reuse the approved evidence through generation |
| `lib/generation/project-roadmap.ts`, `ProjectRoadmapItem`, `ScreenStateVariantPlan` | Canonical concrete screen/state identities, parents, dependencies and progress; extend validated metadata for functional requirements and journey transitions |
| `lib/product-planning/approval.ts`, `generation-context.ts`, `ProductScopeCard` | Approve and quote the complete functional scope; derive concrete parent/state contracts and immutable approval snapshot |
| `lib/generation/service.ts` / `planUiFlow()` | Produce detailed layout/design briefs for approved identities using approved experience/reference context; remove arbitrary count truncation and product rediscovery |
| `app/api/generations/route.ts`, `trigger/generate-ui-flow.ts` | Start and continue bounded runs from the approved output manifest; schedule states after parent validation and expose overall scope progress |
| `lib/generation/credit-reservations.ts` and existing reservation RPCs | Preserve per-output reservation/capture/release; enforce approved totals and prevent cross-run duplicate fulfillment |

### State ownership and consistency

Use `projects.product_planning` for product facts, experience/reference approval pointers, assessment and the current user-selected scope. Concrete deliverables belong to the existing project screen roadmap; the scope selects their stable identities. Inline-only interactions are functional requirements on their parent, not separate billable roadmap state outputs.

The roadmap already has screen/state kind, parent links, dependency keys, sequence, metadata and generation status. Extend these shapes instead of maintaining a second screen list in the blueprint. Approved snapshots are historical execution records, not a second editable source of truth. Blueprint surfaces retain their broader product meaning and link to roadmap identities through an explicit mapping.

Functional-plan edits that affect both project planning revision and roadmap rows must commit atomically through a narrowly scoped server transaction/RPC. Validate references, ownership and expected revision. Do not leave the approval gate dependent on partially written JSON and roadmap rows. Protect new fields and functions with the same server-write and owner-access boundaries as existing planning state. Create a new migration; do not rewrite the previously deployed planning migration.

Distinguish substantive product/experience/scope revision from transient turn-lease updates so readiness does not invalidate itself on every persistence operation. Bind an assessment to the specific substantive inputs it reviewed. Approval must compare those revisions and the reference hash, not a model-supplied readiness boolean.

### Functional planning versus visual planning

The pre-approval agent establishes functional decomposition, meaningful states, information priorities and the reference-backed experience brief. It does not call normal screen rendering or produce the detailed implementation briefs merely to hold a conversation.

After approval, `planUiFlow()` translates that established intent into layout contracts, reference transfer, assets, shared chrome and detailed screen briefs. It can refine visual implementation within the approved requirements, but cannot collapse three agreed onboarding steps into one frame, swap screen identities or add billable states. A material incompatibility returns a proposed scope change rather than silently repairing the approved product into a different one.

The current style-mode planner deliberately receives extracted reference evidence rather than raw image parts; recreation receives the raw image. Preserve that downstream distinction unless visual evaluation justifies a change. The new experience reasoning must inspect the actual uploaded/curated pixels and persist its agreed interpretation. Also explicitly pass the approved experience direction into planner context: the existing `projectContext` branch skips new creative-direction generation, so merely supplying a blueprint does not guarantee an adequate design brief.

### Approval and continuation mechanics

Freeze the full output manifest, product/experience/reference snapshot and quote on the initial generation run. Subsequent runs reference that immutable root approval and receive only their selected manifest items. Use existing run metadata for linkage and add indexed, validated identifiers where required for atomic claims; do not depend on scanning arbitrary metadata to enforce uniqueness.

Current output credit keys contain the generation run ID. They protect retries within a run, but do not by themselves protect the same approved output from being generated and charged in two continuation runs. Add a durable fulfillment/claim identity for `(approval ID, output stable key)` with a database uniqueness guarantee. Associate attempts with existing generation runs and reservations. A failed attempt can release its credit and retry; a completed output cannot be claimed again by another continuation.

Quote with the existing costs: 20 credits per parent screen and 10 per separately generated state. For example, seven parents plus four states cost 180 credits. Move shared pricing constants to a client-safe module for the card if necessary; do not duplicate literal prices or import server-only reservation code into the client.

Retain the existing eight-output reservation bound per run initially. Choose bounded manifests in dependency order, favoring each parent's states; never truncate the overall approval. A server-owned continuation coordinator claims pending approved outputs and dispatches the next run, respecting existing active-run protection. Do not rely on an open browser or a newly clicked roadmap recommendation to finish already approved work.

Handle the dispatch boundary explicitly: retain recoverable dispatch state and use Trigger idempotency for each claimed batch so a crash after database commit or task acceptance cannot strand or duplicate work. The recovery path reconciles existing claims and run status before retrying. Cancellation stops future scheduling and settles reservations; insufficient credit pauses continuation. Neither condition erases approved pending work.

Detailed planning may operate in bounded chunks, but every chunk sees the same product, experience, reference and global flow contract. Validate cross-chunk actions and dependencies. Preserve generated design anchors and shared chrome for later chunks; do not select a fresh style on continuation.

## Delivery gates

1. Conversation gate: repeated incomplete-brief evaluations demonstrate useful questions before proposal, while detailed briefs and recreation avoid needless discussion.
2. Plan gate: a complete selected journey includes justified screens, states, transitions, boundaries and an accurate quote without count-driven omissions.
3. Execution gate: a scope crossing multiple run limits completes its approved outputs with parent/state fidelity, resumable failures and correct charges.
4. Compatibility gate: legacy projects, existing edits, exact recreation, reference fidelity and stable chat lifecycle regressions pass.
5. Rollout gate: versioned migration, application and matching worker are verified together in a test environment before production release. Preserve existing in-flight run contracts across deployment.

Run `pnpm run check`, relevant Vitest suites and the camera tests. Extend database integration checks for atomic revisions and cross-run claims. These are implementation checks to run when code changes; no runtime tests are claimed for this planning-only document.

## Acceptance criteria and evaluation

Deterministic tests:

- Material unsupported decisions prevent proposal even if every blueprint section is populated.
- Relevant user evidence, accepted recommendations and explicit delegation are handled distinctly.
- Corrections supersede old facts and invalidate dependent plans/approvals.
- Onboarding can map to multiple approved screens; narrowing scope does not erase the broader product.
- A scope larger than five parents and eight total outputs retains all items through planning, batching and completion.
- Approved states are scheduled after their own parent is ready; failed parents block state work.
- Retries, duplicate requests, partial failures and concurrent changes do not duplicate outputs or charges.
- Old projects, exact recreation, selected-element edits, later-flow requests and stable chat refresh remain supported.

Live behavioral evaluations, with repeated runs rather than a single happy path:

- Incomplete Tacozz brief: asks a relevant product question, avoids premature approval and invented personalization.
- Explicit onboarding-only request: discusses its purpose and relevant steps without requiring unrelated product detail.
- Distinct product mechanics: different answers cause different journeys and screen/state plans.
- A detailed brief: proceeds without redundant interrogation.
- Exact supplied-screen recreation: stays narrow and fast.
- A vague visual adjective: yields a grounded design recommendation/reference discussion, not invented architecture.
- Uploaded style reference: verify actual image input reaches experience reasoning and its visible features influence the recommendation without overwriting product requirements.
- No uploaded image: verify an actual curated reference is selected and inspected before design approval, rather than passing only a preset slug.
- The same product with different references: visual direction changes appropriately while confirmed business behavior remains stable.
- The same image in style versus recreation mode: product adaptation in the former, faithful requested-frame recreation in the latter.
- Replaced/unavailable references: invalidate only affected decisions, prevent stale approval and report missing evidence honestly.
- A user changes an actor/onboarding responsibility: all affected product meaning and scope stay consistent.
- "Add the orders flow now": uses existing product truth and visual context.

End-to-end visual evaluation must inspect a complete approved journey, including meaningful states. Review task completion, information hierarchy, transition consistency, parent/state fidelity and reference adherence. Compare against the current baseline. Question count, JSON validity and passing unit tests alone are not measures of product-designer quality.

Do not claim the quality upgrade is validated until these live conversation and generated-flow checks have actually passed. If provider access blocks them, report that limitation explicitly.
