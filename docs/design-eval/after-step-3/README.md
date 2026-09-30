# After Step 3: numbers and materials out of the prose layers

Step 3 changes what the planners are told, so its effect on a rendered screen only shows once a project is regenerated with a live model. Nothing in this step changes the tokens, so re-rendering the pet project's stored screens gives the same contact sheet as [`../after-step-2`](../after-step-2/README.md). What the harness can show offline is the deterministic part: the backstop that removes values from a brief.

## Briefs of the baseline project

The five stored briefs of the pet project (harness check "brief px/hex/%", [baseline](../baseline/pets-family/checks.md)) run through `stripDesignValues`, the scrub that now closes `planUiFlow` and `planScreenBriefsForBuild` in style mode:

| Screen | px / hex / % before | after |
| --- | --- | --- |
| Daily Care Dashboard | 3 / 1 / 1 | 0 / 0 / 0 |
| Pet Library | 3 / 1 / 0 | 0 / 0 / 0 |
| Pet Detail Profile | 3 / 0 / 0 | 0 / 0 / 0 |
| Pet Registration Form | 2 / 0 / 0 | 0 / 0 / 0 |
| Routine & Appointment Editor | 1 / 0 / 0 | 0 / 0 / 0 |
| **Total** | **15** | **0** |

For example, "Each card uses a 32px radius and is separated by 24px macro-spacing" becomes "Each card uses a radius and is separated by macro-spacing", and the pixel decision is left to the tokens.

This is the backstop, not the fix. The fix is that the planner is never handed a value to copy, and never asked to write one. That is covered by tests that capture the model requests (see below).

## What changed, and how it is checked

| Change | Test |
| --- | --- |
| A style reference (an image or a stored analysis) skips `generateCreativeDirection`, in `generateDesignTokens` and in `planUiFlow`. One model call less per project. Prompt-only projects and explicit design styles keep it, and Image to UI is untouched. | `generate-design-tokens.test.ts`, `style-planner-input.test.ts` |
| The blueprint contract carries no `creativeDirection` object when the reference is the direction. | `prompts-routing.test.ts`, `style-planner-input.test.ts` |
| The screen family contract, the portable reference context, the transfer contract and the charter describe shape and depth as categories (`describeSurfaceClasses`), never as the analysis's cues. An older stored analysis that still holds "(#FDFBF0)" or "(24pt+)" is scrubbed at each of these choke points. | `style-planner-input.test.ts`, `reference-transfer.test.ts`, `design-value-scrub.test.ts` |
| The planner gets the approved tokens as words (`describeTokenLanguage`: fonts, shape and depth, the surface ladder), not as values. | `design-classes.test.ts`, `style-planner-input.test.ts` |
| Style-mode brief rules: MUST PRESERVE names structure only, "Material specificity" is dropped, and the eight-decisions self-audit is about content, hierarchy and components. Prompt mode keeps all three. | `prompts-routing.test.ts` |
| The discovery designer's component mapping (`experience.adaptations`) reaches the brief planner as its own labelled block, and the rule to name those components in KEY COMPONENTS. | `reference-component-mapping.test.ts`, `style-planner-input.test.ts` |
| A value that still slips into a style-mode brief or its contracts is removed after the planner returns. | `style-planner-input.test.ts` |

`style-planner-input.test.ts` asserts that no `\d+px`, `#[0-9a-f]{3,8}` or `\d+% opacity` substring appears in any part of the style-mode blueprint request, even when the stored analysis is full of them. With the scrub switched off, five of its tests fail.

## What this step does not do

- Preset component names (Step 1) are not passed to the brief planner yet: the mapping function accepts them, and Step 1 will supply them.
- The stored `referenceDna.analysis` keeps the analysis as it was recorded. Every prompt reads it through the portable context, which is scrubbed.
- The builder's own inputs (`qualityDetails` in the semantic primitives, the strict design contract) are Step 4.
