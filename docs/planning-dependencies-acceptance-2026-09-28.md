# Planning dependency simplification — 2026-09-28

## Incident evidence and its limits

Reported project: `2f7c810c-79e8-40aa-91c6-f6eca787ec53`.
The screenshot stops at “Analyzing design direction” but displays a screen-flow review error.
Source inspection confirms that one catch block previously reported failures in reference inspection, saving the reference, validating scope, reviewing coverage, and saving the proposal as `flow_review / REVIEW_UNAVAILABLE`.
It also stored technical exceptions as review issues, allowing a later attempt to treat a service failure as a reason to change the design.

At the earlier checkpoint, the exact exception in this production project had **not** been recovered. The Supabase connection listed only the unrelated `seo-blog-writer` project; no Drawgle credentials were inherited by the shell. No secret files were read at that checkpoint. See the later authorized diagnosis below, which supersedes this access limitation.

## Changes to the shared pipeline

1. **Remove prompt-only synthesis as a required model call.** The existing brief and explicit requirements now establish the prompt-only source directly. The project token generator still receives the original brief through `projectDesignPrompt`. Token and screen models still make the visual choices. This removes a redundant model response and its JSON/schema failure modes; it does not substitute a fixed palette or a screen template.
2. **Make optional references optional through persistence and the outer planner.** Curated search, retrieval, candidate rejection, and optional image storage failures can use that prompt basis. The outer assessment and inspection stages share the same reference-loading policy. A missing speculative curated image invalidates its old analysis before the proposal can reuse it. Inspection service failure stops further candidate calls immediately; genuine incompatibility still allows another candidate. The result records `prompt_synthesis` provenance without recording a permanent user opt-out. Supplied-image inspection, compatibility, exact recreation, and references belonging to an established canvas remain strict.
3. **Remove reviewer copying obligations.** The reviewer chooses semantic journey endpoints and a user-message index. The server derives memberships from the saved graph and preserves the exact evidence text. A rejected flow can return specific issues without constructing a complete approval map. An approved flow still needs a valid journey decision and passes the existing independent coverage/reachability checks.
4. **Preserve the actual failure boundary.** Reference inspection, reference persistence, scope validation, review, and scope persistence have distinct sanitized failure codes. Schema paths and error fingerprints are saved without raw provider responses. Technical failures are not inserted into `reviewIssues`; real design gaps still are. The recovery card displays the actual summary for these stages.

There are no new approval steps, model calls, feature flags, database migrations, or retry loops. Successful curated-reference inspections keep their image path. Existing saved experience records remain readable. A prompt-only result can change visual guidance because the redundant synthesis inference is removed; identical generated pixels are not claimed.

## Automated acceptance

| Check | Result |
| --- | --- |
| Full Vitest suite | **644 passed**, 108 files |
| Node canvas suite | **7 passed** |
| TypeScript (`tsc --noEmit --incremental false`) | Passed |
| ESLint (`eslint .`) | Passed, zero errors; existing `PricingDialog.tsx:90` navigation warning |
| Curated index validation | Passed, 56 references |
| `git diff --check` | Passed |

Focused cases cover prompt-only requirements with zero synthesis calls; rejected or unavailable optional candidates; failed optional storage reads/writes; strict supplied-image and established-canvas behavior; server-derived evidence/membership; genuine missing transitions; malformed review output; reference outages; atomic proposal conflicts; and failures saving references or approval. Existing graph cases cover shared dashboard entries, separate actor entries, deferred scope, inactive identities, and missing jobs.

The integration cases run the real designer, assessment, proposal, reference policy, coverage review, and save modules against a synthetic database adapter and fake model responses. A fresh prompt-only project and a project with a missing speculative curated image both reach a saved approval card in exactly three model requests (assessment, proposal, coverage review), with no synthesis request, screen creation, or generation job. These are integration checks, not live provider or PostgreSQL concurrency tests.

The `pnpm run check` launcher refused to start because it could not fetch/verify the pinned pnpm registry signature. Its three constituent checks were run with the installed binaries and passed as recorded above. Vitest and Node tests required execution outside the Windows sandbox because child-process creation returned `EPERM` inside it.

## Delivery boundary at the earlier checkpoint

Changes are local and tested; they have not been pushed or deployed in this turn. Live replay of the reported project and production provider behavior remain unverified until the Drawgle Supabase connection is available. This record establishes removal of the listed failure dependencies, not a claim that an unavailable external provider or database can never fail. No measured production latency or visual-equivalence claim is made.

## Follow-up: confirmed missing task facts

After explicit permission to load credentials privately for a read-only diagnostic, inspected project `2f7c810c-79e8-40aa-91c6-f6eca787ec53`. No credentials, conversation text, or raw records were printed; no production records were changed.

- Saved revision 11/content revision 3 has three selected outputs, one identity, one actor, one journey, and **zero jobs** (user-task facts).
- Evidence permits proposal, there are no blocking questions or removed surfaces, and the saved reference passes compatibility and requirements checks.
- The most recent saved failure is `scope_validation / SCOPE_VALIDATION_UNAVAILABLE`. Re-evaluating the saved scope locally identifies `REQUIRED_FACTS_MISSING`, specifically `jobs`.
- That saved turn's measured wall time was 18,755 ms; proposal repair took 12,798 ms. These timings describe the saved server turn, not how long the screenshot's UI appeared busy.

The producer previously accepted a flat fact list with no required categories. Approval separately required identity, actors, jobs, and journeys, only after saving the candidate and inspecting its reference. This mismatch explains this confirmed failure; it does not establish the cause of every older incident.

The proposal's structured response now has explicit core fact groups. A category absent from accepted state requires at least one fact; existing categories can remain untouched. Other fact types keep one shared array to avoid duplicating a schema for every optional category. Server parsing returns the existing flat persistence format. The required-category definition is shared with approval. Existing readiness checks run before the atomic candidate commit and reference inspection, including after removals and supersessions. Scope-validation progress is reported under flow review rather than leaving reference analysis active.

No new model request, retry loop, approval step, flag, or migration was added. Models, generation prompts, rendering, and independent semantic coverage review remain unchanged. The proposal response format and its instructions changed; this is not a claim of identical model output or a measured reduction in total token cost. Array constraints are within [Gemini's documented structured-output subset](https://ai.google.dev/gemini-api/docs/structured-output#json-schema-support); live provider acceptance of this complete new schema has not been exercised in this turn.

Verification: **655 Vitest tests across 109 files passed**, **7 Node tests passed**, TypeScript passed, ESLint passed with the existing PricingDialog warning, and the curated index check passed (56 references). Regressions cover every missing required category, incomplete existing drafts, preserving screen identities/reference reuse, and preventing removal of the last required fact from reaching persistence. `pnpm run check` itself still fails during pinned-package signature verification/fetch; its installed constituent binaries passed. `git diff --check` passed.

These changes are local, not pushed or deployed. The live project remains unchanged. Its next planning turn can supply the missing task facts through the corrected contract after deployment; approval and generation have not been run against production with this change.
