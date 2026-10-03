# Shared navigation edits

The reported Health Dashboard / Training Tracker failures exposed two separate paths: a missing shared shell fell back to screen generation, and V2 redesigns were handled by a small keyword switch. A broad request such as “new premium nav” could therefore do nothing, while a reuse request could generate a different local bar or hit full-screen source validation.

The habit tracker project (9cde5aef) then showed what the redesign path still lacked: the designer could never change which tabs the app has, it was handed the rejected bar's markup to start from, it ran at a forced low temperature that produces the generic bar, and the chat card described the request instead of the result.

## Intent

The semantic router reads what the person wants changed and returns it as `navigationChange` on `modify_existing_ui`, in the same call that already routes the turn:

- `reuse`: put the accepted nav on a screen, or make navs consistent. Look and tabs stay; only the active tab changes per screen. Complaints about an unwanted new nav are reuse.
- `restyle`: change how the nav looks; the tabs stay.
- `redesign`: a new, better, premium, creative or more fitting nav, or dissatisfaction with it. Both the look and which tabs the app needs are open.
- `destinations`: add, remove, rename, reorder or re-icon specific tabs; the look stays.

`lib/navigation-edit-intent.ts` is a text backstop used only when the router gives no value (router failure or an older client). Mentioning navigation as a constraint on another edit does not change that edit's scope.

## Execution contract

- The router treats primary navigation as a project component even without an element selection. It keeps the destination screen and records a referenced source separately.
- Reuse reads the canonical plan and renders it without a design-generation call. Only screen assignments change. Ambiguous tab membership may require semantic resolution, but returned IDs are checked against the existing plan and model-proposed icons/items are ignored.
- If there is no shared nav, an identifiable bottom bar can be adopted from an explicitly referenced screen or the project's sole candidate. Multiple conflicting bars require a source; arbitrary SVGs or ambiguous containers are not guessed. If there is no usable bar, generation creates a shared plan and component, never a screen-local substitute.
- Restyle and redesign are one generation call each. The designer gets a product brief (app, audience, features, each built screen's role and whether it can be a tab, planned roadmap screens), the project's own style signals instead of the full charter, the tokens, and up to two screens the bar sits on with their old local bars removed. It runs at the model's default temperature, as screen builds do.
- A restyle sees the current bar's markup and edits it. A redesign sees only a one-line description of the rejected bar, so it does not start from it.
- A redesign returns its tabs with the design. Tabs that open built screens are kept with their id, label and icon; new tabs open a built top-level screen or are planned until their screen exists. Forms, details and states are never tabs. 2 to 5 tabs, or the plan's own minimum.
- A destinations edit is one small JSON call. It may remove a built tab because the person asked; the bar keeps its look.
- Screens follow the tabs: a screen whose tab was removed stops showing the bar, and a built screen that a new tab opens shows it with that tab active. Screen HTML is never rewritten.
- Generated appearance is stored as component-kit templates. Incomplete output, invalid templates and invalid tabs are rejected with the reason fed back for one retry. An unchanged kit, or a redesign changing fewer than two appearance parts, is also retried once; this is a no-op guard, not a guarantee of aesthetic quality.
- The chat card shows the designer's own title and summary from the same output that produced the bar, and the tab changes as computed from the saved plan. New tabs without screens are named, with an offer to create them.
- Existing navigation and assignments save through revision-checked design history. Initial creation uses the existing atomic navigation-repair RPC. Existing independent actions must retain their icon inventory.
- Canvas and export strip old local bottom bars using the same existing sanitizer, leaving content and unrelated top navigation in place.

## Boundaries and release validation

No schema migration or new persistence layer is required. Planned tabs are not written to the screen roadmap; the planner already sees them in the navigation plan when a screen is drafted later. Initial nav creation uses the established RPC behavior; subsequent edits retain history/undo.

Unit tests use mocked generation and persistence. They cover the router field, the text backstop, tab review, the protected built tabs, detail screens refused as tabs, the prompt's contents, screens following tab changes and the computed card. They do not measure design quality.

Before relying on it, replay on the habit tracker: ask for a premium redesign and check that the bar takes its look from the screens, that the tab count suits the app, and that the card matches what is on the canvas; then ask for a tab change and a reuse on another screen, and check undo.
