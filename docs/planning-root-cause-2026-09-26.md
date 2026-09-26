# Planning failures from the two September 26 projects

Observed in the supplied screenshots:

- `e68d6f27-abf2-4076-921e-c2aff9909890` stopped during product-scope assessment. The connected Supabase account does not expose Drawgle, so its exact saved assessment and provider error could not be read.
- `725fae9f-c0ea-4b07-ac6e-a0bf7e0b486d` showed a retired fact target, a failed flow review, and a selected scope that did not match the saved flow. Its production Trigger run confirms project-design token preparation completed; token preparation did not itself report a failure.

The code had four independent ways to create or prolong these states. An optional assessment could retain a blocking gap without the answer choices needed to render its card. The designer reused its opening product snapshot after later tool writes changed active fact IDs. Multiple model tool calls could execute `set_design_scope` or `propose_scope` before the facts, roadmap, and reference they depend on. A roadmap update mutated live in-memory facts before its database transaction succeeded and could recreate a retired fact ID as a generic new assumption.

This change validates card renderability before saving an assessment, uses the existing independent flow review when an optional prompt-mode assessment cannot be validated, refreshes the current product snapshot for each model round, orders tool writes by dependency, and reconciles roadmap fact IDs on a copy before persistence. Repeated identical fact supersessions are no-ops. A changed decision still requires the active fact identity; it is never silently overwritten. A failed planning result now has a failed progress status instead of “Product design ready.” Exact recreation remains strict.

Verification: full Vitest 101 files / 594 tests passed, along with seven Node tests, TypeScript, full ESLint (zero errors, one existing PricingDialog warning), and the curated-style index check. No production database records were changed, and the two projects were not live-replayed. Drawgle Supabase access and a staging replay are needed to confirm their exact saved-state paths before claiming the observed incidents fully resolved.
