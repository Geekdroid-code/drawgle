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
| `components` | At most 10 reusable components, each `name`, `use` and `html` (1200 characters or less; a screen build is given about 9000 characters of them, which is what ten composed components come to). The limit was 700 until the first mindfulness build showed its featured card, search field and highlighted row at 1147, 719 and 790 characters once trimmed: with 700, only chips and badges fit. |

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
pnpm curated:presets --id mindfulness-meditation-beige-light --components   # only the components, again
pnpm curated:presets --all                # every reference that has no preset yet
pnpm curated:presets --all --rebuild      # and those that do (this un-approves them)
```

`--components` keeps a built preset's analysis, palette and tokens and makes its components again: one build per phone, no analysis or token call, and the preset is unapproved afterwards. Use it to try another idea for the components. It does not change the type or the spacing, which live in the tokens: a fault in those is a fault in how the tokens are made, so build the preset in full after fixing it.

`--closeups` keeps a built preset's tokens, components and saved specimens and reads the close-ups again: six small calls (a full build is about twelve calls) that print what each phone answered and correct the analysis's typography line and bottom bar. A serif or monospaced font in the tokens is replaced when the letters read as a sans, and the sheet is drawn again from the specimens the last build saved. Use it to try another wording of the close-up questions, or to see whether the phones agree on a second reading.

Use `--model <id>` for the model that does the analysis and the tokens, and `--build-model <id>` for the model that builds the specimen. Without them the configured models are used. Pick the strongest one you have, since the cost is a few dollars for the whole catalogue and the result is used for every project.

A build does this, and refuses instead of salvaging:

1. Loads the image.
2. Runs the full analysis. It stops if the analysis was salvaged, describes fewer phones than it counts, has a phone without a box, or does not classify the radius and the elevation.
3. Looks closely at the top and the bottom of each phone (four at most), with two small questions each (`lib/generation/reference-focus.ts`). A picture of three phones leaves two things to chance: the first pass read the mindfulness reference's typeface as "an elegant serif" in one run and as a geometric sans in another, and its attached bottom bar as a floating capsule in both. A close-up of the top asks what the letters of the headings are, and a close-up of the bottom asks whether the bar is attached to the screen's edges or floats, how many icons it has and how its active item is drawn. The phones vote, and only an answer that more than half of them agree on is used. It corrects the analysis's typography line and its bottom bar, and sets `typefaceClass`, from which the tokens keep a sans in a sans reference. It prints what it found as `close-up:` lines, and where the phones disagree or nothing answers, the first read stands. It costs about six small calls.
4. Measures the palette on each phone's box.
5. Generates the tokens with the runtime pipeline and its calibration, without any preset. For a curated reference the analysis and the token model are also given the catalogue's notes on its typeface and density (`lib/generation/curated-reference-notes.ts`), as a check on how they read the image.
6. Builds a specimen of each phone, four at most and the richest first: the recreate builder on the phone, with each reusable component marked `data-dg-component`. It is asked to mark composed units (a whole card with its content, a list row, a field with its buttons, a header row), at most eight and never the same look twice, to rank them (1 for the one that most makes the reference look like itself), and to draw no status bar or bottom navigation of its own. A marked element inside a component that is kept whole is left out: it is already in that component's markup. The components are then chosen one phone at a time, each phone's most distinctive first, until ten are chosen or the 9000-character block a screen build is given has no room for another, and what is left out is named. It is also told to size every image, illustration and media area from the image and not to default to a portrait ratio: the first two builds made a featured card 1.4 times the screen's width where the reference's is 0.9. The components are read back out of the markup, one instance per name (the richest phone's first), with their text cut to short samples and repeated items trimmed. The status bar and the bottom navigation are left out, because the renderer draws them. A build that stops before it finishes (the second mindfulness build's rebuild of its media player ended in the middle of a tag, and its media card became a stump) is built again once, and left out if it stops again; a phone whose build fails is left out and named, and the build stops only when none gives a component.
7. Writes the preset with `approved: false`, a preview to `scripts/curated/out/<id>.png` (git-ignored) with each specimen's HTML next to it, and prints a report for each rebuilt phone (see below).

## Approving one

Open `scripts/curated/out/<id>.png`. [An example](design-eval/after-step-1/review-sheet-example.png) is in the repository; it was made from the fixture with stubbed model output, not from an approved preset. Left to right it shows the reference, the phone the specimen recreates, the specimen with the bar the renderer will draw under it, and every component drawn with the preset's tokens, as the builder will copy them.

Check that:

- the analysis found every phone, and the palette and the card radius read right;
- the bar under the specimen is the reference's (for the mindfulness reference: icon-only, attached to the bottom edge with rounded top corners, the active item in a gradient circle). The analysis decides attached or floating by the bar's edges: attached when its bottom and side edges reach the screen's edges, floating only when page background shows below and beside it. A phone mockup's rounded corners are not a gap, and a bar drawn as a floating capsule under a reference that has an attached one is a misreading to fix in the prompt, not in the JSON; It is built from the preset's `navigation`, with sample destinations, exactly as every project's shared navigation will be; only the destinations are the product's;
- the specimen looks like the reference's phone, and each component looks right on its own and carries no content of the reference's (no names, numbers or copy that belong to one product);
- there are enough components to build most screens from: a handful or more;
- the `close-up:` lines say what each phone answered and what the analysis was corrected to (the typeface class, and whether the bar is attached). Zoom into the reference's own bottom bar and check it: the bar's answers are two facts the eye can check (does its surface reach the phone frame on the left and on the right, and is it wider than the cards above it), and where the phones split the first read stands, which is the case to look at;
- the numbers printed under each rebuilt phone agree with the reference. Look at the picture with them:
  - **the title.** A title beside a back arrow is `dg-type-nav-title`, one line, at the size of the reference's small top-bar title. A `CHECK` line names it when it is built as a screen title, wraps, or is set in a generic keyword or a font the page did not load;
  - **the fonts.** The heading and body fonts are the reference's own typeface. A reference set in one typeface, with a light word beside a bold one, has one family for both roles;
  - **the space between blocks.** Compare the gaps with the reference's: neighbouring blocks a step apart, and more space only before a new titled section. If every gap is the same large number, the rhythm was flattened;
  - **the tallest block** as a multiple of the screen width, against the same block in the reference;
  - **no round control stretched into an oval.**

The report is facts about the render with a few flags for things that are wrong in any design. It is a prompt to look, not a verdict, and nothing in it changes a preset.

Then:

```bash
pnpm curated:presets --approve mindfulness-meditation-beige-light
```

If a preset is wrong, build it again. A rebuild starts unapproved. Editing a component's `use` line by hand is fine. Do not edit the tokens, the fonts or the analysis by hand: a preset that needs it shows a fault in how presets are made, every other reference will have the same fault, and the fix belongs in the prompts or the tooling (the first mindfulness build had a serif heading font, 32px between every block and a 28px title in the top bar; each was a wrong instruction, and fixing the instruction fixes every reference).

## The check

`pnpm run check` runs `curated:styles:check`, which now also reads the presets file. It fails on a preset that is malformed, that was built from a catalogue entry that has since changed (rebuild it), or that belongs to no catalogue entry. It lists the references that have no approved preset, and does not fail on them: presets roll out one reference at a time.

## Limits

- The hash covers the entry's id, image address and text. An image replaced at the same address is not noticed; build again when you replace one.
- An uploaded reference has no preset. It gets the same treatment at run time instead: its colours are measured when its tokens are made, and at the project's first generation its main screen is rebuilt with the reusable components marked (`lib/generation/upload-specimen.ts`, built while the approval card is shown), so its components reach every screen's builder as markup. Nobody reviews that specimen.
- Presets are used for prompt-to-UI, where a curated reference is chosen for the project. Image to UI is not touched.
