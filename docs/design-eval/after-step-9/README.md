# After Step 9: model and reasoning settings

Step 9 asks for one change to make and one thing to decide on evidence. The change is made. The decision needs builds from a real model, which this session could not run, so **no screen-build default has been changed**. What is here is what makes the decision cheap: the settings can be switched without a code change, and a command runs the comparison and prices it.

## Made: the design-token call

`design_tokens` now thinks at `low` (it was `minimal`) and runs at Gemini's own temperature (the `0.35` override in `generateDesignTokens` is gone). It is one call per project and it sets every screen's colours, radii and type, so a little thinking is cheap next to what it decides. With approved presets (Step 1) it is not made at all for a curated reference that names no colours or fonts.

| Behaviour | Test |
| --- | --- |
| The token call's thinking level is `low`, its output budget is unchanged, it sets no temperature, and it is the level of the planning it follows from | `lib/ai/model-policy.test.ts` |
| The request `generateDesignTokens` sends has `thinkingLevel: "low"` and no temperature | `lib/generation/generate-design-tokens.test.ts` |

The creative-direction call still sets `0.35`. It is a different call and the plan does not list it. Step 3 already stopped making it for every style reference; it is still made for a prompt-only project and for Image to UI.

## Made possible: comparing the screen build's thinking level and model

- **`DRAWGLE_GEMINI_SCREEN_BUILD_THINKING`** sets the thinking level of screen builds to `minimal`, `low`, `medium` or `high`. It is `low` unless set, which is what a screen build used, and a value that is not a level falls back to `low` rather than change a build over a typo. It changes screen builds only: every other task keeps its level, and neither the build's temperature nor its output budget is touched. The model was already a setting, `DRAWGLE_GEMINI_FULL_BUILD_MODEL`. (`lib/ai/model-policy.test.ts`)
- **`pnpm design:ab`** runs one arm of the comparison on a saved bundle and records the time, the tokens in, out and thinking, and the cost of every build, then renders the rebuilt screens through the harness. `--report` puts the arms side by side. How to run it is in [`docs/design-eval/README.md`](../README.md). **It makes a live model call per screen on your account, so it does nothing without `--yes`:** without it, it prints the arm, the screens and a rough cost (three Flash builds are about $0.04, three Pro builds about $0.16) and stops. I ran it that way on the stored pet project; I did not run it with `--yes`. Its parts are tested without a model: reading usage from a provider chunk, choosing the screens, building the input from a stored screen, the cost against the plan's own figures (about $0.0135 on Flash and $0.054 on Pro for 9k in and 3k out), a failed build recorded without its error, and the tables. (`scripts/design-eval/cost.test.ts`, `scripts/design-eval/ab-run.test.ts`)
- I ran its input building against the real stored pet project with a stand-in for the model: the request it produces is the builder's own (the reference image, the style-mode instruction, the screen's brief in the system instruction, `gemini-3-flash-preview` at thinking `low` with no temperature). It is about 25k characters of text plus the image, roughly the plan's "about 9k tokens in" (that is about 6k tokens of text, plus the image); the real count is what the tool records on a live run.

## Decided by the A/B, not made

| Question | How to answer it |
| --- | --- |
| Thinking `low` or `high` for screen builds | Two arms on the pet project and at least two other cases: `--label flash-low` and `--label flash-high --thinking high` |
| Flash or the current Pro model | A `--label pro-low --model <the provider's current Pro id>` arm; check the provider's model list for the id, and the price if it is not $2 and $12 |
| Per mode, for example Pro only for a project's first screen | From the cost per build and the contact sheets of the arms: if Pro's first screens are clearly better and its later ones are not, that is the split; if no arm is clearly better, the default stays |

What to look for, in the plan's terms: the checks table of each arm (radius, shadow, tone, local nav, placeholders), the contact sheets side by side, the time per build (the person waits for it), and the cost per build against the plan's budget (+20% per project).

## Not checked

- **Any real build.** Nothing in this step was compared on a live model, so nothing about the quality, time or cost of `high` against `low`, or Pro against Flash, is known here.
- **The token call's new setting on a live model.** `low` thinking costs a few hundred thinking tokens on one call per project; the design-token quality it buys is for the next generation to show.
- **OpenRouter.** The A/B refuses to run when the screen builder is set to OpenRouter, whose reasoning is its own setting (`getOpenRouterScreenBuildReasoning`).
