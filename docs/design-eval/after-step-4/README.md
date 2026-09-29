# After Step 4: the builder composes with the reference's components

Step 4 changes what the screen builder is told, so its effect on a render shows once a project is regenerated with a live model. The inputs can be checked offline, though. Below is the builder prompt for the pet project's **Pet Library** screen, assembled from the saved harness bundle (`buildStyleScreenInstruction` with the stored tokens and navigation plan), under the stored tokens and under the tokens generation now produces (the Step 2 what-if).

## The strict design contract describes the ladder

Stored tokens (the old 32px, blurred-shadow set):

```text
- Surface ladder, back to front: page (dg-bg-primary) → card (dg-surface-card) → one focal accent (dg-action-primary or a token gradient) → at most one strong dark control. Separate surfaces by stepping one rung, not by adding borders or shadows.
- Radius roles: card 32px (…); inner 20px (…); pill 9999px (capsule controls); circle 9999px on a square element (icon wells and avatars).
- Shadows: only where a token defines one. Surface shadow: 0px 4px 20px rgba(45, 41, 38, 0.04). …
```

Calibrated tokens (Step 2):

```text
- Surface ladder, back to front: page (dg-bg-primary) → card (dg-surface-card) → inset tile or field inside a card (dg-surface-inset) → pastel tint wells and chips (dg-tint-1 to dg-tint-3) → one focal accent (dg-action-primary or a token gradient) → at most one strong dark control. Separate surfaces by stepping one rung, not by adding borders or shadows.
- Radius roles: card 20px (…); inner 16px (…); pill 9999px (capsule controls); circle 9999px on a square element (icon wells and avatars).
- Shadows: only where a token defines one. Surface shadow: none, so cards separate by tone. …
```

Before this step both read "Outer surface radius: 32px (cards, sheets, panels, fields, and navigation shells)" and "Standard surface shadow: …", one card recipe for everything. A project whose tokens have no `surface.inset` or tints keeps only the rungs it has, and its ladder lists only those.

## The project says it has no navigation

The pet project's approved flow has shared navigation off. Its Pet Library builder prompt now contains:

```text
NO SHARED NAVIGATION:
This project has no persistent bottom navigation. Do not draw a tab bar, dock, bottom navigation, or a floating button that stands in for one. Use this screen's chrome: a top app bar or an anchored header.
```

Before this step `buildSharedNavigationContract` returned an empty string when navigation was off, so the only signal was the attached reference image, which shows a tab bar. That is where the local `nav.fixed.bottom-0` bar on Pet Library came from (harness check "local-nav", 1 in the [baseline](../baseline/pets-family/checks.md)). Image to UI does not get the section (it reproduces whatever the source frame shows), and neither does a legacy project whose screens draw their own primary navigation.

## The STYLE COMPONENTS block

A project whose reference DNA carries a specimen (`referenceDna.specimen.components`) now sends the builder one block: up to 10 components, whole and in order, inside 6,000 characters, one `name — when to use it — html` line each, under three rules (build from these wherever they fit; a new component uses the same ladder, radius roles, type roles and spacing; never reproduce the reference's sections, order or content). When the block is present the builder does not also get the semantic primitives' craft details, in the transfer contract's premium quality targets or as "Craft bar" lines in project memory, since they carried lines such as "Radius should be at least 24px" and restate what the markup and tokens show.

Nothing writes a specimen yet. Step 1 will write it from an approved curated preset, and Step 7 from an uploaded reference, through `createProjectReferenceDna({ specimen })`. Until then a project's builder prompt has no block and is otherwise unchanged.

## Checked by

| Change | Test |
| --- | --- |
| Block format, ten-component and 6,000-character caps, whole components only, malformed entries dropped | `style-components.test.ts` |
| Block reaches only a style builder, after the family contract; the size cap holds on every build | `prompts-routing.test.ts`, `product-build-input.test.ts` |
| Quality targets and craft bars are dropped with the block, and only then | `prompts-routing.test.ts`, `reference-transfer.test.ts`, `semantic-inspiration.test.ts`, `product-build-input.test.ts` |
| Ladder classes appear when the tokens have `surface.inset` and tints, and only those rungs | `prompts-routing.test.ts` |
| The no-navigation section, its chrome wording, and where it is absent | `prompts-routing.test.ts` |
| A specimen survives the charter's JSON round trip | `reference-dna.test.ts` |

Cost: the block adds about 1.5k input tokens per screen when it is present, as the plan estimated.
