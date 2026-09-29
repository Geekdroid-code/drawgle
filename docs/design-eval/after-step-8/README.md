# After Step 8: an analysis of a multi-screen image is complete

An analysis of an image of several screens used to be accepted when it counted them all and described some (on a curated reference it saw one phone of three). Every screen it left out was then built from a placeholder that says "look at the image". The analysis now asks for the missing screens only, each from a crop of its own box, and merges them in.

Whether a real model does this well is not checked here: the calls are a stand-in in every test. What is checked is what is asked for, what is done with the answers, and what happens when they are wrong.

## What it does

When the analysis counts N screens and describes fewer (`screenReferences.length < screenCountEstimate`, or none at all, which a salvage fills with placeholders):

1. **One short look at the whole image** finds where the screens are: N boxes, numbered left to right, given the boxes of those already described so the numbering stays consistent. It is a short output.
2. **One description per missing screen**, in parallel, from a crop of that screen's box, with the same instruction the first pass uses (style or recreate, by the mode), asked for one screen only. The crops are the ones in the picture below.
3. **Merged in order**, each new screen carrying the box it was found at. What the first pass saw of the whole image (the radius and elevation classes, the navigation, the style) is kept.
4. It is a `full_analysis` with high confidence and no validation issues when every screen is described. If it is not (a box could not be found, a description came back empty), it is a `salvaged_analysis` exactly as before, with the remaining issue and a diagnostic saying what was missing.

![The whole reference, then the crops the two missing screens would be described from](completion-crops.png)

Left: the whole reference, where a first pass counted three phones and described one. Right: the crops for screens 2 and 3, made with the code the analysis uses, from the boxes a locating model would report. The picture is made with a stand-in for the model; the crops are real.

Two places called a complete analysis "salvaged" for no reason: one a project's saved reference DNA reused, the other an analysis a caller supplied. They are now `full_analysis` when they describe every screen they count, and `salvaged_analysis` only when they do not (`resultForKnownAnalysis`).

## What is checked without a model

| Behaviour | Test |
| --- | --- |
| Which screens are missing: the numbers no described screen took; never more than are missing when the model repeated or misnumbered one; nothing to do for a complete analysis, or one without an analysis | `reference-completion.test.ts` |
| Only the missing screens are described, each from a crop of its own box, and merged in order with their boxes; the first screen is untouched; the result is complete, high-confidence and free of the count issues | `reference-completion.test.ts` |
| An analysis that described none is completed for every screen and its placeholders are dropped; the one screen of an image needs no locating and uses the whole image | `reference-completion.test.ts` |
| A screen with no box, a box that covers a described screen, a box too small to be a screen, a description that failed: the others are kept, the analysis stays salvaged with its issue and says why | `reference-completion.test.ts` |
| A locating call that fails, or no description coming back, leaves the analysis as it was; more missing screens than the cap (8) is left alone; other validation issues are kept | `reference-completion.test.ts` |
| Through `analyzeReferenceImageForScope` with a three-phone image: four model calls (the analysis, the locating, two descriptions), real crops of phone size, the style or the recreate instruction, the numbered note, a full analysis with the first pass's classes kept; a failed locating gives the old salvaged result after two calls; a complete first pass makes one call | `reference-completion-runtime.test.ts` |
| An Image to UI scope over the completed analysis has no ambiguity and counts three screens | `reference-completion-runtime.test.ts` |
| The boxes a model reports are read under the names models use and numbered by position when it forgets; what is not a box is dropped | `reference-completion-runtime.test.ts` |
| A known analysis is full only when it describes every screen it counts | `reference-completion-runtime.test.ts` |
| The preset builder still refuses an analysis that is salvaged | `curated-preset-builder.test.ts` |

## Choices that differ from the plan's wording

- **The boxes of the missing screens come from a short locating call**, not from the first pass. A first pass that describes one phone usually gives that phone's box only, and a missing screen cannot be cropped without one. The described screens' boxes are given to it so the numbering stays consistent.
- **The missing screens are described with the analysis' own instruction**, not a new one, so a screen described from a crop follows the same rules as one described in the first pass. It is asked to leave out the fields that describe the whole image.
- **Nothing is retried or re-asked beyond that.** A screen that cannot be located or described stays missing and the analysis stays salvaged, as it was before. That keeps the cost to one extra call and one per missing screen, and only for an image the first pass under-described.
- **Curated references are unchanged**: an approved preset is the analysis, and no model is asked. The preset builder's analysis is made by the same function, so it is complete more often (not tested on its own), and the builder still refuses one that is not.

## Not checked

- **A real model's locating and descriptions**: whether it reports boxes that enclose the tilted or overlapping phones of a real mockup, and whether a description from a crop is as good as one from the whole image. The diagnostics it writes (`no box was found for screen 3`, `screen 2 could not be described`) are where to look on a live run.
- **Cost and latency** on the eval set. The calls are one locating call and up to eight descriptions, in parallel, and only for an image that was under-described.
