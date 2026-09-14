# Product designer upgrade: evaluation record

Local implementation evaluation, 2026-09-14. This record distinguishes conversation behavior from generated visual quality. No production projects, customer messages or Drawgle credit balances were used for live conversation tests.

## Live conversation samples

The evaluation calls the real `runProductDesigner()` and configured Gemini model, with synthetic projects/messages and in-memory reference storage. Curated selection and image inspection use the real existing reference infrastructure. Rendering and normal generation are not invoked.

| Scenario | Observed result |
| --- | --- |
| Incomplete Tacozz brief: premium T-shirt app with onboarding | Four sampled starts retained an empty design scope and asked product/onboarding questions before proposing screens. The questions varied in usefulness: some repeated a brand-versus-marketplace distinction inferable from the brief, or framed onboarding with too much emphasis on personalization. A follow-up instruction discourages loaded alternatives and asks for the minimal useful behavior. Broader judgment-quality evaluation remains necessary. |
| Detailed guest-shopping brief, onboarding only | Successful samples inspected a real curated reference and proposed two or three onboarding frames. Shopping and checkout remained in broader product context. Frame count varied with the proposed story; it was not fixed at five. |
| Change current scope to purchase flow | The final three-turn run produced a validated proposal for Storefront Feed, Product Detail, Shipping Details, Payment Info and Order Success, preserving onboarding for later. It retained guest checkout and size/color selection. This five-frame result is one product-specific plan, not evidence of a five-screen limit. Larger scope execution is covered separately by deterministic tests. |
| Exact supplied-image recreation | The supplied Watchtower image reached an approved narrow Dashboard proposal with source-frame index 1 and no broad discovery questions. Actual pixels were inspected. There was an internal tool retry to add the minimal journey link required by validation. No rendering was performed. |

## Failures found through live testing and fixed

1. The model confused blueprint surface IDs with roadmap screen keys and sometimes omitted required state fields. Tool schemas now distinguish those identities, require concrete scope keys, describe state requirements, and return current usable IDs after rejected writes. Invalid deltas remain atomic. A later run repaired these errors and completed both proposals.
2. Narrowing scope initially required removing action links to deferred screens. Approval snapshots now record deferred navigation boundaries without modifying the canonical roadmap. Generation prerequisites still require selected or already-built outputs.
3. A model reply claimed approval was ready after proposal validation failed. The designer now returns an explicit unfinished-plan message when a proposal was attempted but never validated; no misleading approval card or generation is exposed.
4. A paraphrased delegation quote caused the assessment to fail. Quote checks now tolerate harmless case/quotation/whitespace differences and allow one bounded model repair; nonexistent user authorization still fails closed.
5. Earlier provider access failed with 429/prepayment depletion. Access subsequently recovered and the samples above were run successfully. Provider funding is no longer the current blocker.

## Reproduction

Run with the repository's configured model credentials. These commands use provider tokens but do not render screens or mutate production projects:

```powershell
pnpm.cmd exec tsx --env-file-if-exists=.env.local --conditions=react-server scripts/check-product-designer-live.ts --live --first-turn-only
pnpm.cmd exec tsx --env-file-if-exists=.env.local --conditions=react-server scripts/check-product-designer-live.ts --live
pnpm.cmd exec tsx --env-file-if-exists=.env.local --conditions=react-server scripts/check-product-designer-live.ts --live --recreate-reference
```

The script asserts no generation starts, no concrete scope appears for the incomplete first brief, detailed follow-ups reach validated proposals, and exact recreation avoids material discovery gaps. It prints the assessment, reference experience, scope, active facts and tool outcomes for review. Structural assertions alone do not score designer judgment.

## Remaining release evaluation

- Deploy the migration, application and matching Trigger workers together in an isolated test environment. Verify actual child dispatch, process interruptions, cancellation, resume, Supabase realtime and browser continuity against that environment.
- Render and review complete journeys, including a scope above five parents/eight outputs and parent-dependent states. Compare cross-screen navigation, content hierarchy, state fidelity, reference adherence and visual composition against the current image-to-UI baseline.
- Repeat with different business mechanics, an uploaded style image, conflicting mode requests, changed actor responsibilities, and later-flow requests on an existing product. Assess both unnecessary questions and unjustified assumptions.
- Measure conversation latency and repeated tool corrections. Current recovery succeeds in sampled cases but may still produce long turns near the API's runtime budget.

Premium visual parity and production end-to-end reliability are not established by these local samples.
