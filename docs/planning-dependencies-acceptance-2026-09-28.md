# Planning dependency simplification — 2026-09-28

## Incident evidence and its limits

Reported project: `2f7c810c-79e8-40aa-91c6-f6eca787ec53`.
The screenshot stops at “Analyzing design direction” but displays a screen-flow review error.
Source inspection confirms that one catch block previously reported failures in reference inspection, saving the reference, validating scope, reviewing coverage, and saving the proposal as `flow_review / REVIEW_UNAVAILABLE`.
It also stored technical exceptions as review issues, allowing a later attempt to treat a service failure as a reason to change the design.

The exact exception in this production project has **not** been recovered. The available Supabase connection lists only the unrelated `seo-blog-writer` project; no Drawgle credentials are inherited by the shell. No secret files were read. No live database records, generations, credits, or flags were modified.

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

## Delivery boundary

Changes are local and tested; they have not been pushed or deployed in this turn. Live replay of the reported project and production provider behavior remain unverified until the Drawgle Supabase connection is available. This record establishes removal of the listed failure dependencies, not a claim that an unavailable external provider or database can never fail. No measured production latency or visual-equivalence claim is made.
