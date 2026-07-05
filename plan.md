Fix Plan: Stop Style Drift, Enforce Tokens, Upgrade Shared Navigation
Summary
The drift is coming from three weak links: later screens do not receive enough concrete visual memory from the premium first screen, tokenization only fixes exact token-value matches, and the shared nav fallback/refinement can still produce generic pill-tab UI. The fix should harden all three without blindly inflating prompts again.
Key Changes
Add a canonical existing-screen style memory path.
When extending an existing project, include a compact CANONICAL VISUAL SYSTEM section in project context, derived from ready existing screens, not only semantic screen summaries.
Extract concrete cues from saved screen code: root background token/class, major surface classes, radius/shadow/border language, action/accent usage, typography token classes, nav/chrome cues, and any suspicious raw colors.
Treat this as style continuity evidence only: reuse visual system, not content/layout.

Improve screen summaries used for retrieval.
Update generateScreenSummary so future summaries include visual/token/style details, not only purpose and controls.
Remove the current “do not mention HTML/Tailwind/CSS” restriction because it hides the exact evidence needed to keep later screens token-aligned.
Keep summaries short, but include token/style language such as background, surfaces, radii, shadows, density, and key token utilities.

Add token drift detection and one retry path.
After tokenizeStaticDrawgleHtml, scan generated screen HTML for generic Tailwind palette classes, raw hex/rgba system colors, and arbitrary radii/spacing that should have used Drawgle variables.
Allow raw/custom values only for deliberate art details: charts, maps, illustrations, SVG geometry, media overlays, and asset-specific effects.
If severe drift is found, retry the screen build once with a focused token-drift instruction: replace invented system colors/radii/spacing with nearest approved Drawgle token utility or CSS variable.
Record drift warnings in build diagnostics so failures are visible instead of silent.

Strengthen builder token instruction slightly.
Add a concise rule near output rules: major app surfaces, text, actions, cards, nav-adjacent regions, radii, shadows, and spacing must use dg-* utilities or var(--dg-*); do not use bg-white, bg-gray-*, text-black, etc. when a token role exists.
Keep existing fidelity and token sections intact.

Upgrade shared navigation quality.
Change the deterministic nav fallback so two-tab projects do not become two giant active/inactive pills.
Use a compact dock baseline with token variables, stable icon sizing, small active indicator/icon well, and restrained labels.
Update nav QA rules to explicitly reject amateur giant-pill tab treatments unless the nav visual brief asks for that exact form.
Run token drift detection on nav shell output too; if refinement drifts, fall back to the deterministic token-safe nav.

Public Interfaces / Compatibility
No database migration required.
No public API shape change required.
screens.summary content becomes richer for future screens, but remains plain text.
Existing out-of-sync screens will not be silently rewritten. They will need regeneration or a later explicit “resync screen to tokens” repair action.
Test Plan
Unit test canonical style extraction from saved screen HTML with token classes and raw fallback colors.
Unit test token drift detection:flags bg-gray-*, bg-white, raw #..., non-token arbitrary colors on major UI.
allows chart/media/SVG one-off values.
ignores exact values that tokenizeStaticDrawgleHtml converts to variables.

Unit test deterministic nav renderer:two-item nav does not create full-width giant active pills.
uses token variables/classes for background, active state, radii, shadow, text.
preserves every data-nav-item-id.

Run pnpm.cmd exec tsc --noEmit --pretty false.
Do not run full lint unless the implementation touches enough code to justify it.
Assumptions
Primary goal is future generation consistency plus a safe path to repair bad outputs, not an automatic migration rewriting existing user screens.
The first ready screen, plus close semantic matches, should act as canonical visual memory for later screens.
Token consistency is more important than allowing the builder to invent “close enough” colors for app surfaces.