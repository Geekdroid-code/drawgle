# After Step 7: uploaded style references get the same treatment

> **Updated 2026-09-30, after the review.** Components are up to 1,200 characters. The specimen is built by the configured screen builder (OpenRouter by default, not Flash), so its cost is that model's price. A caller waits at most 60 seconds for it after its own planning (`UPLOAD_SPECIMEN_WAIT_MS`), and a later revision of the approval card reuses the specimen an earlier preparation built from the same upload. The text below records the step as it was built.

A curated reference has a preset: its colours measured, its tokens calibrated, its components as markup. An uploaded style reference now gets the same, at the project's first generation, without a person reviewing it. The reference's own components reach every screen's builder as markup to copy, instead of a description of them.

Nothing here could be run against a real upload: the specimen is a model build. Everything around it (when it runs, what it is given, what is read out of it, where it is stored, what happens when it fails) is tested with a stand-in for the builder.

## What an uploaded reference gets

| | Curated reference | Uploaded style reference |
| --- | --- | --- |
| Palette measured from the pixels, tokens calibrated | Once, offline, in the preset | At token time, every run. This was already so after Step 2; a test now pins it for an upload (`generate-design-tokens.test.ts`) |
| Components as markup | The preset's, reviewed and approved | A specimen built at the project's first generation |

The specimen is the recreate builder run on the upload's main screen (the phone with the most components, cropped out by its box, or the whole image when it shows one screen), with each reusable component marked, drawn with the project's own calibrated tokens. The components are read back out of the markup by the same extraction the preset builder uses: at most ten, 700 characters each, sample text cut short, repeats trimmed, the status bar and the navigation left out. They are stored in `project_charter.referenceDna.specimen`, which every later batch reuses, and reach each builder as the STYLE COMPONENTS block from Step 4.

## When and where it runs

- **When:** an uploaded reference used as *style* (not Image to UI), at the project's first generation, for the project's reference and not a single screen's attachment, when the upload was analysed and the project has tokens, and the project does not already carry a specimen.
- **Where:** in the scope preparation task, while the person reads the approval card, beside the planner. Most first generations reuse that prepared plan, so a specimen built only at generation would make them wait for the whole build. If the plan was not prepared ahead, generation builds it, beside planning. A plan that was prepared without one does not make generation try again: a build that marked nothing would only fail the same way.
- **Cost:** one build, about $0.013 with Flash, once per project. It never blocks the generation beyond its own duration and never fails it: any error, or a build that marks nothing usable, leaves the project as it was before this step.

## What is checked without a model

| Behaviour | Test |
| --- | --- |
| It applies at a first generation to an analysed upload used as style, and does not for a later generation, an unknown start, a screen's attachment, Image to UI, a curated reference, a prompt-only project, the project's saved upload, an unanalysed or empty analysis, a project without tokens, a project that already has a specimen, or a plan prepared ahead | `upload-specimen.test.ts` |
| The phone with the most components is cropped out of the upload by its box and rebuilt as a recreate build with marking on, from the reference's own words and the project's tokens, never the project's request | `upload-specimen.test.ts` |
| An upload of one screen with no box is rebuilt whole; an upload of several screens with no box is not rebuilt as a collage | `upload-specimen.test.ts` |
| A build that marks nothing usable gives no specimen and says why; a thin one is kept and noted; the status bar and navigation are never kept | `upload-specimen.test.ts` |
| It starts beside the caller's other work, answers null without building when it does not apply, and answers null, reporting the error, when the build fails | `upload-specimen.test.ts` |
| The specimen is put on the charter's reference DNA once, never replaces one already there, and is what `styleComponentsOf` gives every later builder | `upload-specimen.test.ts` |
| An uploaded style reference is measured and calibrated at token time with no catalogue id and no preset | `generate-design-tokens.test.ts` |
| The preset builder still makes the same specimen through the shared code | `curated-preset-builder.test.ts`, `scripts/curated` |

## Choices that differ from the plan's wording

- **It is built during scope preparation, not only at generation.** The plan says to run it beside planning; in the common path the planning happens at preparation time, so that is where the specimen is built. Generation keeps the same build for the paths that were not prepared.
- **A multi-screen upload with no box gets no specimen.** Rebuilding the whole collage teaches nothing. Step 8 makes the analysis complete for multi-screen images, which is what supplies the boxes.
- **The pieces shared with the preset builder moved to `lib/generation/specimen-build.ts`** (choosing and cropping the phone, and the recreate build's input), so the two cannot drift apart. `curated-preset-builder.ts` still exports the two functions it used to.
- **No person approves an upload's specimen.** A preset is reviewed once because it is used by every project that picks the reference; an upload's belongs to one project and is made at run time. What limits a poor one is the extraction (ten components, 700 characters, no navigation or status bar) and the block's own instruction never to reproduce the reference's sections or content.

## Not checked

- **A real specimen from a real upload.** Whether a Flash build marks a useful set of components, how many, and how well it reproduces the phone. The notes it logs (skipped components, a thin set) are where to look first.
- **Latency and cost.** The build runs beside planning; how much of it a first generation still waits for has to be measured on a live run.
- **A later batch that does not reuse the DNA.** Later batches reuse the project's reference DNA when the project's saved upload is the reference. A generation that analyses the upload again and makes a new DNA would not carry the specimen. I found no such path in the approved-flow route and did not change the others.
