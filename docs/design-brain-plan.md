# Design Brain Plan — Giving the Planner and Builder Spatial Judgment

Status: proposal. Scope: `lib/generation/*`, `lib/design-tokens.ts`, `lib/token-runtime.ts`, `trigger/generate-ui-flow.ts`.
Evidence base: project `6c6ff9da-1973-47d0-a3d3-78f3d1b4a996` ("Create a Premium cosmetics ios mobile app"), curated reference `cosmetics-ecommerce-minimal-light`, 5 ready screens read from production.

## 1. Thesis

Every design instruction in the pipeline today is **prose addressed to an LLM**. `prompts.ts` contains excellent-sounding rules — "one disciplined visual language", "strictly contrast micro-groupings with macro-sections", "avoid generic AI-app defaults" — but not one of them is a quantity that any code can evaluate. The only things we check deterministically are safety, completion, asset policy, token *aliasing*, and per-role radius *naming*.

A professional designer's judgment is almost entirely **relational**: this surface against that background, this radius inside that padding, this gap versus that gap, this block against the remaining viewport. Relations are exactly what prose loses and what code captures well.

So the plan is not "write better prompts". It is: **move design judgment out of adjectives and into checkable contracts**, and let the prompt carry only what code cannot decide.

## 2. Diagnosis, with evidence


### F1 — The curated reference's own design metadata is discarded after retrieval

`cosmetics-ecommerce-minimal-light.selectionProfile` (`lib/generation/curated-style-catalog.ts:1080`) states:

| Field | Catalog value |
|---|---|
| `colorCharacter` | clean-base, monochromatic-neutral, high-contrast-black |
| `typographyCharacter` | geometric-sans, functional-ui-sans |
| `materials` | matte, flat-layered |
| `incompatibleWith` | glassmorphism, tactile-depth, **heavy-shadows**, dark, … |

What the token generator actually produced for this project:

| Token | Value | Verdict |
|---|---|---|
| `typography.heading_font_family` | `'Cormorant Garamond', serif` | contradicts `geometric-sans` |
| `color.background.primary` / `.secondary` | `#F5F2ED` / `#E8D5C4` (warm beige) | contradicts `clean-base` |
| `shadows.surface` | `inset 0 1px 2px rgba(255,255,255,.8), 0 10px 30px rgba(0,0,0,.03)` | contradicts `matte` / `flat-layered` |
| `navigation.surface_material` / `backdrop_blur` | `glass` / `20px` | contradicts the explicit `glassmorphism` exclusion |

Cause: `buildCuratedStyleRetrievalDocument()` (`lib/generation/curated-style-index-core.ts:44`) is the **only** consumer of `selectionProfile`, and it exists solely to build the embedding used for retrieval. After a reference is selected, its profile is dropped. The token generator then free-associates off the raw JPEG with no constraint.

We already hand-authored the designer's read of every curated reference. We throw it away at the moment it becomes useful.

Related: the font-truthfulness guard at `lib/generation/service.ts:960-970` swaps to a system stack when the reference analysis doesn't name the family. It did **not** fire here, which means the reference analyzer itself named "Cormorant Garamond" for a reference the catalog labels geometric-sans. The guard works; the evidence it trusts was wrong, and nothing cross-checks the analyzer against the catalog.

### F2 — Tokens are validated key-by-key, never as a system

`sanitizeApprovedDesignTokens` → `enforcePlatformConstraints` (`lib/design-tokens.ts:350`) checks *shape*: is this a px string, is `inner < app`, is the status foreground contrasty. It never asks whether the values make sense **together**. Concrete defects shipped in this project:

- **`surface.card #FFFFFF` on `background.primary #F5F2ED`.** The card is pure neutral (zero chroma); the background is warm. A pro tints the surface into the same hue family and separates it by a deliberate lightness step. Pure white on cream reads as an unfinished asset, not as elevation. This is exactly the user's complaint.
- **The spacing scale has no 16px step** — `0/4/8/12/24/32/48/64` — yet `mobile_layout.element_gap` is `16px`. The most-used gap in the app is not a member of its own spacing scale. Step ratios run 1.5×, 1.5×, **2.0×**, 1.33×, 1.5×, 1.33×: no scale, just numbers.
- **`section_gap: 48px` with `element_gap: 16px`** — a 3× macro/micro ratio, combined with `screen_margin: 24px` and `hero_title: 44px/300`. On a 390×844 frame that budget fits roughly one and a half sections. This is the "big fonts, lots of air, nothing fits" look in screenshot 1.
- **`border_widths.standard: 0.75px`** — sub-pixel, renders inconsistently, and is paired with a `rgba(26,26,26,0.08)` divider that is effectively invisible.
- **`text.low_emphasis #A0A0A0`** is ~2.6:1 on `#FFFFFF` and worse on `#F5F2ED`. Below 3:1. We enforce contrast for status colors only (`normalizeStatusColors`), never for the text ramp.

### F3 — There is no concentric-radius law, and one global `radii.inner` guarantees mismatch

The tokens are `radii.app: 32px`, `radii.inner: 16px`. Generated code, Discover Feed:

```html
<article class="dg-surface-card dg-shadow-surface dg-radius-app …">      <!-- 32px -->
  <div class="relative h-[212px] dg-radius-inner m-[var(--dg-spacing-xs)] …">  <!-- 16px, 8px gap -->
```

Generated code, User Profile:

```html
<div class="dg-surface-card dg-radius-app p-[var(--dg-spacing-xs)]">     <!-- 32px, 8px pad -->
  <button class="… dg-radius-inner px-[var(--dg-spacing-md)] …">          <!-- 16px -->
```

The concentric rule every designer uses: **inner radius = outer radius − the gap between their edges**. Here that is 32 − 8 = **24px**. Both used 16px, so the inner curve is visibly tighter than the parent's — the "one looks extra one looks less" in screenshot 3.

This is not a model mistake, it is an architectural guarantee: **a single global `radii.inner` cannot be correct for more than one padding value.** And `normalizeGeneratedUiContracts()` (`lib/generation/ui-contract-normalizer.ts:121`) assigns radii by *component role* with no notion of nesting or gap — it cannot detect this, and would actively rewrite a correct 24px back to `radii.inner`.

Same container also has **8px padding with a 16px child gap**. Gap larger than the padding containing it reads as content escaping its box. Nothing checks that either.

### F4 — The screen brief is prose with no spatial arithmetic

The stored Discover Feed brief is well-written and hits all seven required labels. Every number in it is a *style* number (24px rail, 48px gap, 32px radius). There is not one statement about **how much vertical space a region gets or how much content fits in it**. `layout_contract` fields — `viewport_plan`, `focal_hierarchy`, `section_rhythm`, `component_density`, `cta_policy` — are all free text.

Result, visible in screenshot 2: the brief said *"Curated Collection Cards (asymmetric grid)"*. The builder rendered

```html
<div class="grid grid-cols-[1.12fr_.88fr] gap-… items-start">
  <article …>       <div class="h-[212px] …">   <!-- card A media -->
  <article class="… mt-[var(--dg-spacing-md)]"> <div class="h-[158px] …">  <!-- card B, offset 24px -->
```

Two different widths, two different media heights, a manual 24px vertical offset on one, different copy lengths, `items-start` — so the bottoms rag badly. And because neither card had a defined content budget, the builder filled each media well with an absolutely-positioned decorative blob and centered it.

Nothing in the contract said *"two cards in one row share one anatomy and one baseline."* That single missing rule produced the whole failure.

### F5 — QA has no design critic, and its storage isn't even live

`screen-quality.ts` covers safety, source completion, asset policy, health. `ui-contract-normalizer.ts` covers aliases, per-role radii, status colors, truncation, nav conflicts. **Nothing measures** nesting radius coherence, padding-vs-gap, sibling balance, vertical budget, surface/background relationship, decorative dead space, or radius vocabulary size.

Also: production `screens` rows returned by `select=*` do **not** include `quality_diagnostics`. Migration `20260809000100_screen_quality_diagnostics.sql` was never applied, so the compatibility fallback added in the 2026-08-09 hotfix is silently swallowing all QA telemetry. We are flying blind on exactly the signal this work needs.

## 3. The plan

Five layers. Four are deterministic and add **zero model cost**. Each ships behind a `DRAWGLE_*_ENABLED` flag, matching repo convention.

### Phase 0 — Unblock measurement (hours)

1. Apply `20260809000100_screen_quality_diagnostics.sql` to production and reload the PostgREST schema cache. Without it nothing below can be measured.
2. Confirm the reference analyzer named "Cormorant Garamond" for this reference (check the stored run metadata / `llmLog`). If confirmed, it's a truthfulness violation of the rule at `prompts.ts:548` and feeds directly into Phase 1.

### Phase 1 — Style Charter: carry the catalog's judgment forward (deterministic)

New `lib/generation/style-charter.ts`. Build a `StyleCharterV1` from `selectionProfile` (curated), or from reference analysis + design style pack (uploaded/prompt-only), and thread it through creative direction → tokens → planner → builder.

The charter converts catalog tags into **hard constraints**, not vibes:

| Tag | Constraint |
|---|---|
| `materials: matte, flat-layered` | `shadows.surface` clamped to hairline or none; separation must come from borders/tint |
| `incompatibleWith: heavy-shadows` | reject any shadow with blur > 16px or alpha > 0.10 |
| `incompatibleWith: glassmorphism` | `navigation.surface_material ∈ {solid, translucent}`, `backdrop_blur: 0px` |
| `colorCharacter: clean-base` | `background.primary` lightness ≥ 0.94, chroma ≤ 0.02 |
| `typographyCharacter: geometric-sans` | serif/display heading families rejected unless the *user prompt* explicitly asks; analyzer evidence alone is not enough |
| `density: balanced` | `section_gap` bounded to 24–32px |

Cross-check rule: when the reference analysis contradicts the catalog profile for the same reference id, **the catalog wins** and a diagnostic is recorded. The catalog is hand-authored; the analyzer is a per-run inference.

Touches: `curated-style-references.ts` (return the profile with the selection), `service.ts:4266` `generateDesignTokens`, `service.ts` creative direction, `prompts.ts` (charter section in planner + builder system instructions).

### Phase 2 — Token Relationship Validator (deterministic)

New `lib/design-tokens-relationships.ts`, invoked from `buildApprovedDesignTokens` (`service.ts:910`) after normalization, before persistence. It repairs relations and emits diagnostics. Rules:

1. **Surface/background hue coherence.** Convert both to OKLCH. If background chroma > 0.02 and card chroma < 0.25 × background chroma, retint the card to the background hue at ~0.3 × its chroma. (`#FFFFFF` on `#F5F2ED` → about `#FDFBF8`.)
2. **Surface/background lightness separation.** Require ΔL in 0.03–0.14 for light themes. Below 0.02: either widen ΔL or drop the shadow and require a divider border.
3. **Elevation conforms to charter material.** Flat/matte charters clamp `shadows.surface`; glass exclusions clamp navigation material and blur.
4. **Spacing-scale membership.** Rebuild `spacing` as a genuine base-4 scale (4/8/12/16/24/32/48/64) with monotonic ratios, then require `screen_margin`, `section_gap`, `element_gap`, and every `sizing.*` value to be **members**. Snap non-members to the nearest step and record a diagnostic. Fixes the missing-16px defect.
5. **Macro/micro ratio.** `section_gap ≤ 2 × element_gap` and `≤ 32px`, unless high-confidence measured geometry from the reference says otherwise (that path already exists via `trustedGeometryValue`).
6. **Border width snapping.** `{0.75px} → 1px`; allowed set `{1px, 1.5px, 2px}`. If width ≤ 1px, require divider alpha ≥ 0.10.
7. **Type scale vs viewport.** `hero_title ≤ 1.9 × screen_title`; `screen_title ≤ 32px` at 390px unless the charter declares an editorial hero; `line_height / size` in [1.05, 1.30] for display roles and [1.40, 1.60] for body/supporting.
8. **Contrast ramp.** Extend the existing `accessibleForeground` helper beyond status colors to `text.*` on `background.primary` and `surface.card`, `action.on_primary_text` on `action.primary`, and `navigation.content`/`muted_content` on `navigation.surface`. Floor: 4.5:1 for high/medium, 3:1 for low.

Every repair is recorded so we can see how often the model needs correcting, per rule.

### Phase 3 — Concentric geometry resolver (deterministic)

Replace the single global `radii.inner` with a **law plus derived tokens**.

- Keep `radii.app` as the one authored outer radius.
- Derive `innerRadius(gap) = clamp(app − gap, minRadius, app)`, `minRadius = 4px` (0 for sharp systems).
- Emit `--dg-radii-inset-xs|sm|md|lg`, one per spacing step, in `lib/token-runtime.ts`.
- Keep `radii.inner` as an alias for `app − element_gap` so existing screens keep rendering.

Builder prompt gains one concrete sentence in place of today's role table:
> A nested surface's radius equals its parent's radius minus the gap between their edges. If you pad a `dg-radius-app` container by `--dg-spacing-xs`, its children use `--dg-radii-inset-xs`.

Normalizer gains real nesting awareness (`ui-contract-normalizer.ts`, cheerio is already a dependency):

- **C1 concentric mismatch** — walk the tree; for any radiused element whose radiused ancestor has a resolvable padding/margin, compute the expected radius and repair. Deterministic, exactly-known, safe to auto-fix.
- **C2 gap > padding** — inside a padded container, child `gap-*` must not exceed the container padding. Repair when both resolve to known tokens; warn otherwise.

The existing role-based repair stays for elements with no radiused ancestor, but the concentric rule takes precedence when it applies. This must land as an ordering change, otherwise the role rule will keep undoing the correct value.

### Phase 4 — Layout Contract v3: make the planner do arithmetic

Extend `layout_contract` to version 3 with numeric fields. v2 stays readable (compatibility, per repo convention).

```jsonc
"viewport_budget": {
  "frame_height_px": 844,
  "above_fold_region_ids": ["hero", "collection-grid"],
  "regions": [
    { "id": "hero", "min_h_px": 300, "max_h_px": 400, "priority": "focal" },
    { "id": "collection-grid", "min_h_px": 260, "max_h_px": 320, "priority": "primary" }
  ]
},
"region_contracts": [
  {
    "id": "collection-grid",
    "arrangement": "two-column",
    "sibling_balance": "equal-height",
    "item_count": 2,
    "item_anatomy": ["media 4:5", "eyebrow", "title", "body", "text-link"],
    "copy_budget": { "title_max_chars": 22, "body_max_lines": 2 }
  }
]
```

A deterministic validator (extending `scope-contract.ts`, which already does bounded schema repair) enforces:

- Σ `min_h_px` of above-fold regions + safe areas + nav clearance ≤ `frame_height_px`. Over budget → demote the lowest-priority region below the fold.
- `max_h_px ≥ min_h_px`; every region id in `viewport_budget` exists in `regions`.
- Any `arrangement` of `two-column`/`grid` **must** declare `sibling_balance` and a `copy_budget`. Missing → default to `equal-height` deterministically rather than failing the brief.
- `item_anatomy` must be identical across siblings in a balanced arrangement.

The builder then receives, instead of "asymmetric grid":

> Region `collection-grid`: two columns, equal-height siblings, identical internal anatomy, media aspect 4:5 in **both**, title ≤ 22 chars, body ≤ 2 lines. Do not offset one card vertically. Do not vary media height between siblings.

That one contract fixes screenshot 2 by construction.

Also add to the planner's self-audit: **every region must justify its height with content.** A region taller than 120px whose anatomy declares no text and no asset is rejected at plan time — that is the "centered decorative blob" generator.

### Phase 5 — Design critic (deterministic, feeds diagnostics)

New `lib/generation/design-critic.ts`, run alongside `normalizeGeneratedUiContracts`. Beyond C1/C2 above:

| id | Check | Disposition |
|---|---|---|
| C3 | Siblings in one grid/flex row with differing declared heights, differing `mt-*`, or differing child counts | warn (high severity) |
| C4 | Subtree > 120px tall with no text node and no asset slot | warn (high severity) |
| C5 | `bg-white` / raw hex on a system surface when a token role exists | repair |
| C6 | Sum of declared above-fold heights vs 844 | warn |
| C7 | Rendered text contrast on its declared surface | warn |
| C8 | More than 4 distinct radius values on one screen | warn |

Retry policy is unchanged: **never buy a builder retry for cosmetic drift.** C1/C2/C5 repair deterministically. The rest warn into `quality_diagnostics`.

Optional, flagged, later: when ≥2 high-severity findings survive, run **one** bounded composition repair through the existing *edit* path (search/replace format, cheap model) rather than a full rebuild. This is the only realistic way to buy composition quality without doubling generation cost — but it should not ship until the critic's false-positive rate is measured.

### Phase 6 — Prove it

`GENERATION_V2_BENCHMARK_CASES` (`lib/generation/benchmark-cases.ts`) already has 15 prompt, style, recreate, scope, and historical cases. Add a scoring harness that runs the critic over generated HTML and reports per-rule pass rates, so "does it look better" becomes a number. The user's complaint is subjective; without this we cannot tell whether a prompt change helped or just moved the failure.

Add the cosmetics case as a **named regression fixture**: same prompt, same curated reference, assert charter conformance (no serif heading, no glass nav, no heavy shadow), tinted card surface, concentric radii, and balanced sibling cards.

## 4. Sequencing and cost

| Phase | Effort | Model cost | Risk |
|---|---|---|---|
| 0 — migration + analyzer check | hours | none | none |
| 1 — style charter | 1–2 d | none | low; catalog-vs-analyzer precedence needs care |
| 2 — token relationships | 1–2 d | none | low; all repairs recorded and reversible by flag |
| 3 — concentric geometry | 1–2 d | none | medium; normalizer rule ordering must change |
| 4 — layout contract v3 | 2–3 d | none | medium; planner schema change, v2 compatibility required |
| 5 — design critic | 1–2 d | none | low |
| 6 — benchmark scoring | 1 d | run cost only | low |

Phases 1–3 are independent and can land in any order. Phase 4 benefits from 1–3 being in place, since the planner should be reasoning inside an already-coherent token system. Phase 5 should land before Phase 4 so we can measure whether the new contract actually changed builder behavior.

## 5. What this deliberately does not do

- No per-screen "design review" LLM call. It doubles cost and adds latency for judgment that is mostly arithmetic.
- No visual-refinement pass or provisional low-quality builder. The 2026-08-09 progressive-generation work explicitly ruled those out; nothing here reopens them.
- No change to the existing failure gates. Everything new either repairs deterministically or warns. A usable screen still saves.
