# Shared navigation edits

The reported Health Dashboard / Training Tracker failures exposed two separate paths: a missing shared shell fell back to screen generation, and V2 redesigns were handled by a small keyword switch. A broad request such as “new premium nav” could therefore do nothing, while a reuse request could generate a different local bar or hit full-screen source validation.

## Execution contract

- The semantic router treats primary navigation as a project component even without an element selection. It keeps the destination screen and records a referenced source separately. A conservative text backstop covers common add/reuse/redesign wording; mentioning navigation as a constraint on another edit does not change that edit's scope.
- Reuse reads the canonical plan and renders it without a design-generation call. Only screen assignments change. Ambiguous tab membership may require semantic resolution, but returned IDs are checked against the existing plan and model-proposed icons/items are ignored.
- If there is no shared nav, an identifiable bottom bar can be adopted from an explicitly referenced screen or the project's sole candidate. Multiple conflicting bars require a source; arbitrary SVGs or ambiguous containers are not guessed. If there is no usable bar, generation creates a shared plan and component, never a screen-local substitute.
- Redesign uses project tokens, charter, saved navigation and screen style evidence. Generated appearance is stored using the existing component-kit templates. The saved plan owns destination IDs, labels, order and icons. Incomplete output and invalid templates are rejected. An unchanged kit or a redesign changing fewer than two appearance parts is retried once; this is a no-op guard, not a guarantee of aesthetic quality.
- Existing navigation and assignments save through revision-checked design history. Initial creation uses the existing atomic navigation-repair RPC. Source screen HTML is not rewritten. Existing independent actions must retain their icon inventory when a kit is redesigned.
- Canvas and export strip old local bottom bars using the same existing sanitizer, leaving content and unrelated top navigation in place.

## Boundaries and release validation

No schema migration or new persistence layer is required. Existing generation paths, credit accounting and source-integrity validation remain in place. Initial nav creation uses the established RPC behavior; subsequent edits retain history/undo.

Regression tests cover the reported wording, adoption of a pill plus separate action, canonical icons, new shared creation, assignment preservation, generation failures, no-op retries and concurrent-save rejection. Unit tests use mocked generation and persistence; they do not establish a production success percentage.

Before deployment, replay on the two reported projects with production-equivalent model output: add from Health Dashboard to Training Tracker with and without an element selection, confirm identical icons and a different active state, request a visibly new premium nav, and verify preview/export plus navigation undo. The local changes do not modify those live projects or establish that their existing sources are healthy.
