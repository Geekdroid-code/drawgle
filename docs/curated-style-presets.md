# Curated style presets

A curated reference (one of the catalogue's images) never changes, yet every project used to analyse it again when it was generated. That pass could see one phone of three, invent a 32px radius and miss the navigation items. A **preset** holds what a complete offline pass found. You look at it once, and every project that picks the reference reuses it. It is more reliable, and cheaper per project.

## What a preset holds

`lib/generation/generated/curated-style-presets.json`, keyed by reference id. Each entry is checked with zod when it is loaded (`lib/generation/curated-style-presets.ts`).

| Field | What it is |
| --- | --- |
| `catalogHash` | The catalogue entry it was built from: a hash of its id, image address and text. Editing the entry makes the preset stale. |
| `approved` | Set by you, after looking at the preview. Only an approved preset is used. |
| `analysis` | A complete analysis: every phone in the image, each with its bounding box, and the card radius and elevation classes the tokens are calibrated from. |
| `measured` | The palette measured from the pixels, per phone box: the page, the raised card, the inset, the accents and the ink. |
| `tokens` | Calibrated design tokens: the surface ladder, a card radius of 24px or less, the shadows, the type. |
| `navigation` | How the reference's own bar is built: anatomy, labels, active and inactive treatment, width, material, items. |
| `components` | At most 10 reusable components, each `name`, `use` and `html` (700 characters or less). |

A malformed, unapproved or stale entry means there is no preset, and the run-time path runs exactly as it did before.

## What a run does with one

For a project whose reference is a curated one with an approved preset that matches the catalogue entry as it is now:

- **No analysis call.** `analyzeReferenceImageForScope` returns the preset's analysis, with its own navigation evidence.
- **No token call**, when the user named no colours or fonts. The project's tokens are the preset's. When they did name some, the token model is asked once, with the preset's analysis and measured palette as its evidence, and only the roles they named are taken from its answer: the preset keeps the radii, the shadows, the spacing and the type.
- **No creative direction**, for any style reference.
- **The reference's own navigation** builds the project's shared navigation (`applyReferenceNavigationStyle`).
- **The builder gets the components** for every screen, from the project's reference DNA (`referenceDna.specimen`), so later batches have them too.

## Building a preset

It runs on your machine with your own keys and reads them only from the environment.

```bash
pnpm curated:presets --id mindfulness-meditation-beige-light
pnpm curated:presets --all                # every reference that has no preset yet
pnpm curated:presets --all --rebuild      # and those that do (this un-approves them)
```

Use `--model <id>` for the model that does the analysis and the tokens, and `--build-model <id>` for the model that builds the specimen. Without them the configured models are used. Pick the strongest one you have, since the cost is a few dollars for the whole catalogue and the result is used for every project.

A build does this, and refuses instead of salvaging:

1. Loads the image.
2. Runs the full analysis. It stops if the analysis was salvaged, describes fewer phones than it counts, has a phone without a box, or does not classify the radius and the elevation.
3. Measures the palette on each phone's box.
4. Generates the tokens with the runtime pipeline and its calibration, without any preset.
5. Builds the specimen: the recreate builder on the phone with the most components, with each reusable component marked `data-dg-component`. The components are read back out of the markup, one instance per name, with their text cut to short samples and repeated items trimmed. The status bar and the bottom navigation are left out, because the renderer draws them.
6. Writes the preset with `approved: false`, and a preview to `scripts/curated/out/<id>.png` (git-ignored) with the specimen's HTML next to it.

## Approving one

Open `scripts/curated/out/<id>.png`. [An example](design-eval/after-step-1/review-sheet-example.png) is in the repository; it was made from the fixture with stubbed model output, not from an approved preset. Left to right it shows the reference, the phone the specimen recreates, the specimen with the bar the renderer will draw under it, and every component drawn with the preset's tokens, as the builder will copy them.

Check that:

- the analysis found every phone, and the palette and the card radius read right;
- the bar under the specimen is the reference's (for the mindfulness reference: icon-only, attached to the bottom edge with rounded top corners, the active item in a gradient circle). It is built from the preset's `navigation`, with sample destinations, exactly as every project's shared navigation will be; only the destinations are the product's;
- the specimen looks like the reference's phone, and each component looks right on its own and carries no content of the reference's (no names, numbers or copy that belong to one product);
- there are enough components to build most screens from: a handful or more.

Then:

```bash
pnpm curated:presets --approve mindfulness-meditation-beige-light
```

If a preset is wrong, edit the JSON by hand (a component's `use` line, say) or build it again. A rebuild starts unapproved.

## The check

`pnpm run check` runs `curated:styles:check`, which now also reads the presets file. It fails on a preset that is malformed, that was built from a catalogue entry that has since changed (rebuild it), or that belongs to no catalogue entry. It lists the references that have no approved preset, and does not fail on them: presets roll out one reference at a time.

## Limits

- The hash covers the entry's id, image address and text. An image replaced at the same address is not noticed; build again when you replace one.
- An uploaded reference has no preset. It gets the same treatment at run time instead: its colours are measured when its tokens are made, and at the project's first generation its main screen is rebuilt with the reusable components marked (`lib/generation/upload-specimen.ts`, built while the approval card is shown), so its components reach every screen's builder as markup. Nobody reviews that specimen.
- Presets are used for prompt-to-UI, where a curated reference is chosen for the project. Image to UI is not touched.
