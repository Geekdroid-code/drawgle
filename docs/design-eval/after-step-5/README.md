# After Step 5: sample photos for people and pets

Step 5 changes what the asset resolver does, so its effect shows on the next generation, not on the stored screens. What can be checked without a live provider is below: the pet project's own asset requirements, read from its generation runs and run through the new normalization, and the resolver's behaviour with a stubbed stock provider (`visual-assets-sample-imagery.test.ts`).

## What the pet project's runs asked for, and what happened

| Requirement | Screen | Role | Planned as | Result |
| --- | --- | --- | --- | --- |
| `pet-avatar-thumbnails`, 5 distinct | Daily Care Dashboard | avatar | `transparent_png` | `identity_requires_supplied_image`: initials and text where the pet photos belong |
| `pet-portraits`, 6 distinct | Pet Library | product cutout | `transparent_png` | `no_semantic_match`: no stock photo qualified |
| `pet-hero-detail` | Pet Detail Profile | product cutout | `transparent_png` | `no_semantic_match` |
| `pet-registration-form-section-photo-explicit-imagery` | Pet Registration Form | section photo | photo | resolved, but its alt text was the app prompt |

## Now

```text
pet-avatar-thumbnails   avatar          photo            alpha=false 1:1   distinct×5  identity=false  → "dog various domestic pets dog cat rabbit headshots portrait"
pet-portraits           product_cutout  transparent_png  alpha=true  1:1   distinct×6  identity=false  → "pet happy domestic pets dogs cats looking camera portrait"
pet-hero-detail         product_cutout  transparent_png  alpha=true  free  repeat×1   identity=false  → "animal close specific pet portrait"
recovered subject (and alt text): "Multi-pet family care Pet Registration Form section photo"
```

- **The identity rule is for the user's own face or logo.** A requirement is `user_specified` when the planner sets `userIdentity` (which the planner instructions describe) or names that origin. Only those avatars get the initials placeholder. Every other avatar, a family member or a pet, goes through the normal chain: internal library, then Pexels, then Pixabay.
- **A sample avatar is a square photo.** Whatever the planner asked for, an avatar becomes `photo`, opaque, 1:1, and an opaque avatar photo is cropped square when it is saved (the crop follows the most salient region, so a face or an animal stays in frame; it is done after the camera's orientation is applied and never enlarges).
- **Two things kept pets and people from matching stock at all**, and both are fixed for any role: the ranking required a "product" or "item" caption for a product cutout or product photo, which no caption of a dog says, and the search added "isolated product" for those roles. A person or a pet is now searched as a portrait and ranked like one. The category terms also list the common pets (rabbit, bird, parrot, hamster and so on) and people words (man, woman, boy, girl, child, senior), because stock captions name the subject rather than the category ("Brown rabbit on grass"), so most sample portraits and pets were filtered out.
- **Alt text is the requirement's subject.** It used to be the saved asset's own subject, which belongs to whichever project saved it first, and a recovered requirement's subject began with the app prompt. The recovered subject is now the product type, the screen and the role; the app prompt only helps to choose the category.

## The internal library

A read-only count on the drawgle database found the internal library (`visual_assets`, `drawgle_r2`) holds 22 assets, of which one is a person (a transparent avatar cutout) and none is a pet. The stock cache holds 104 Pexels and 49 Pixabay photos, 20 of them person avatars and 2 of them animals. Sample photos will now be fetched and cached as projects ask for them, but the library does not hold a reviewed set, so the plan's "seed it" is done as a tool and has **not been run**:

```bash
pnpm seed:sample-imagery                 # dry run: lists, per entry, the photos a search would add, with their source pages
pnpm seed:sample-imagery --only dog,cat  # a few entries
pnpm seed:sample-imagery --apply         # downloads them, crops them square and adds them to the library
```

The list is `lib/generation/sample-imagery.ts`: eight portraits of people of different ages and six kinds of pet, 46 photos in all, each stored as an `avatar` `photo` in the `person` or `animal` category with the source page, the licence and the credit. Adding a photo twice is harmless. It needs `PEXELS_API_KEY` or `PIXABAY_API_KEY` in the environment, and `--apply` also the database credentials. Look at the dry run before applying: the photos are chosen by caption, not by eye.

## Checked by

| Change | Test |
| --- | --- |
| A planner-inferred pet avatar reaches stock and comes back as a square photo, cached for the next project | `visual-assets-sample-imagery.test.ts` |
| The internal library is used before any stock search; the alt is the requirement's subject | `visual-assets-sample-imagery.test.ts` |
| A `user_specified` avatar still returns the initials placeholder and makes no search | `visual-assets-sample-imagery.test.ts`, `visual-assets.test.ts` |
| Avatars are normalized to square photos; the user's own identity survives a prompt that asks for portraits; other cutouts are untouched | `visual-assets-sample-imagery.test.ts` |
| The recovered subject does not contain the app prompt | `visual-assets-sample-imagery.test.ts` |
| Pets and people qualify for stock without a "product" caption; product wording is unchanged for real products | `visual-assets-sample-imagery.test.ts`, `visual-assets.test.ts` |
| Square crop: landscape, portrait, large, orientation | `visual-assets-sample-imagery.test.ts` |
| `userIdentity` becomes the `user_specified` origin and does not travel further | `service-asset-normalization.test.ts` |
| The planner is told sample people and pets are ordinary photos | `prompts-routing.test.ts` |
| The seed list covers people and pets, and a library entry built from it is found by the avatars a planner writes | `sample-imagery.test.ts` |
