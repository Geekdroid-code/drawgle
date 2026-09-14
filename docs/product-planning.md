# Product planning on the canvas

New projects are created by `POST /api/projects`. The migration's `create_planning_project` transaction creates a draft project and its initial `project_messages` row together. The client request UUID is the project UUID, so retries are idempotent. No screen, credit reservation, reference selection model, or generation task runs at creation.

The usual project page accepts an empty screen array. ChatPanel initializes the product conversation once and displays a compact scope approval card. Reference uploads now work in its existing composer. Realtime remains the main refresh path; completed requests also refresh project, messages and generation runs to recover missed subscription events.

## Product truth and execution scope

`projects.product_planning` is nullable for legacy projects. Its versioned structure contains:

- An explicit `discovery` / `canvas` phase.
- A blueprint of identified facts: identity, actors, jobs, capabilities, entities, journeys, surfaces, constraints, decisions, questions, preferences and roadmap.
- Fact provenance (`user` or `assumption`), supporting evidence, source message and supersession history. Downstream prompts include only active facts.
- A separate current scope referencing ordered surface IDs, with draft/proposed/approved status and approved revision.
- Initial reference inputs, initialization state and a bounded turn lease.

The agent requests incremental additions/supersessions and scope updates. Zod validates each change set, referenced IDs and provenance. Related changes can be atomic; multiple tool calls execute sequentially. Replacing a fact retires its prior version and rewires factual links. Changing scope never deletes the blueprint. Updates use project/owner/revision compare-and-swap, and any new product turn invalidates a pending proposal until reviewed again.

Missing evidence cannot make an inference user-confirmed: it is retained as an assumption and the model is told so. Evidence quoting is a mechanical provenance check, not a guarantee that the inference accurately represents the quotation; semantic quality still requires evaluation.

## Agent and generation handoff

`/api/agent` reads project state before invoking the canvas router. Unfinished projects go directly to the small product-designer module. It uses the existing Gemini client/model policy, existing project read tools, and `project_messages`. Its four tools read product truth, apply fact deltas, select scope, and propose scope. There is no generic agent framework or additional chat store.

Before proposing, structural readiness checks run, followed by a bounded product architecture assessment. This assessment checks useful journey outcomes and rejects deferral of essential product behavior merely for aesthetics. It does not hardcode screens by industry. Supplied-image recreation bypasses this extra assessment and requires only narrow reference/screen context.

Only the explicit approval button calls `/api/generations` with a revision. The server loads the approved state, checks credits and active runs, ignores client-supplied plans, and derives the existing `GenerationScopeContract`. It reserves a turn lease and snapshots the product state on the generation run and Trigger payload. On queue acceptance, phase becomes `canvas`; on dispatch failure, the current proposal is restored if no newer work replaced it. Retries retain the original snapshot. Once dispatched, worker execution owns the job even if a subsequent HTTP metadata update fails.

`planUiFlow` remains the screen planner. It receives the approved blueprint/scope alongside reference evidence, enforces approved screen identities, and grounds product-facing charter fields in blueprint facts. It retains existing reference analysis, design tokens, navigation, screen briefs, roadmap batching and rendering. Blueprint-approved batches do not implicitly select extra state variants. The existing five-parent-screen first-batch limit is shown with its credit cost in the card; remaining screens use the existing roadmap continuation behavior.

Empty but real projects are treated as first generations for reference policy, preserving curated references. Approved recreation stays on the exact-recreate contract. Once screens exist, normal canvas routing continues; the product-planning action handles new flows/decisions and the existing project read tools expose product memory. Existing edits, selected elements, navigation and screen-state tools remain in place.

## Migration and rollout

Apply `supabase/migrations/20260914053035_product_planning.sql` before releasing the application/worker code. Deploy the corresponding Trigger worker with the application. The migration adds a nullable column, a service-only atomic creation function, and an invoker trigger that protects product state from direct client writes. Existing owner RLS and message storage remain in use. No production migration or Trigger deployment is performed by the repository checks.

The isolated database check executes the actual migration and existing projects owner policy in PGlite. It checks atomic/idempotent creation, malformed state, legacy rows, owner/anonymous isolation, protected state, and stale revisions. Run `node scripts/check-product-planning-migration.mjs <path-to-temporary-pglite-package.json>` with PGlite 0.5.8 installed in a temporary directory; it is not an application dependency.

`scripts/check-product-designer-live.ts --live` evaluates synthetic Tacozz conversation turns with the configured model and in-memory storage. It does not write production data or generate screens, but uses provider API credits. Offline tests cover creation/routing boundaries, scope approval, concurrent updates, readiness, planner inputs, recreation and approval UI.

Evaluate real conversations and image quality before rollout: especially incomplete commerce ideas, product corrections that affect multiple journeys, onboarding-only scope, later flow additions and multi-frame recreation. The latest live readiness assessment has not been validated because the configured Gemini API returned depleted prepayment credits. Full authenticated Supabase/Trigger/browser integration still requires a migrated test environment.
