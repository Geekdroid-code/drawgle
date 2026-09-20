# Canvas reference, state and gradient fixes

## Diagnosis (20 September 2026)

Read-only inspection of project `e50ed260-e207-45d9-af3d-0c69612d2075` confirmed:
- Action primary is `#DE7A51`, but `gradients.action_primary` still contains `#5879F2` and `#4059B3`. The editor edits different values from the gradient consumed by buttons.
- Paywall run `875cca34-e799-41ed-923b-d3d862e16a14` included an unrequested `plan-selected` variant. The worker falls back to model defaults when the approved state array is empty.
- A canvas restoration upload entered recreation mode. That branch discards existing tokens and persists newly extracted tokens and charter globally. Product-designer uploads also replace the durable project reference, and subsequent runs can inherit the latest chat upload.

## Intended behavior

1. Gradient controls edit the actual action gradient, retaining its geometry and other stops. Changing primary action color updates its action-gradient treatment. Unrelated gradients remain untouched. Legacy literal gradients remain supported.
2. The approved output list is authoritative. An empty or absent state selection never authorizes model-invented outputs. Manual state requests and approved recreation frames remain supported.
3. Canvas images are guidance for the current request/scope: layout, hierarchy, content and visual examples, adapted to the established project. They cannot reset global tokens, charter, navigation or the source reference. Initial project creation retains its chosen style/recreation mode. A project-wide redesign must be a separate intentional operation, not a side effect of an attachment.
4. Approval snapshots and retries retain this boundary. A scoped attachment may remain stored for retry but cannot become the next project's inherited reference. Product-planning attachments are stored separately from product input and cleared from the live draft after approval.

## Phases

- [x] 1. Repair gradient editing and add regression coverage.
- [x] 2. Enforce approved state selection before roadmap persistence and credit reservation.
- [x] 3. Enforce attachment authority at API, product designer, worker, inheritance and retry boundaries; clarify the composer.
- [x] 4. Run focused regressions, full available test suites and normal repository checks; record remaining live evaluation.

No production records are modified by this work. Existing unwanted screens are not deleted, credits are not silently changed, and source recreation at project creation is preserved.
