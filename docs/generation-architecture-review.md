# Design Generation Architecture Review

Status: **Phases 1–2 implemented; design-brain prompt layer removed** (2026-08-11 to 2026-08-12). Phases 3–4 planned. See §10/§12 for handoff, §13 for the measurement that justified removal, §14 for what was deleted, and §11 for a live production issue still open.
Scope: the full path from builder output to persisted screen, plus token schema, prompts, and edit flows.

## 0. Verified findings

Each claim below was checked against the code, not accepted from analysis.

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 1 | The design critic rewrites raw neutral Tailwind colors on every `[class]` element | **Confirmed** | `checkRawSurfaceColors` in `lib/generation/design-critic.ts` matches `RAW_SURFACE_CLASS` on `$("[class]")` and maps `bg-*` → `dg-surface-card`, `text-*` → `dg-text-high` |
| 2 | `DRAWGLE_UI_CONTRACT_REPAIR_ENABLED=false` is not a true bypass | **Confirmed** | `ui-contract-normalizer.ts:236` runs `normalizedCode = $.root().html()` unconditionally; the DOM is parsed and reserialized even in diagnostics mode |
| 3 | Radius and gap geometry is rewritten after generation | **Confirmed** | role-based `applyRadiusRole` plus `applyGeometryContract` concentric repair and `nested_gap_exceeds_padding` gap rewriting |
| 4 | Token relationship logic mutates the token set | **Confirmed** | `validateTokenRelationships` clamps base color, accent chroma, shadows, glass, gradients, spacing ladder, section gap, border width, type scale, and the contrast ramp |
| 5 | The builder prompt contains contradictory instructions | **Confirmed** | the style charter asserted authority over "the attached image" while recreate mode declared the image highest-priority structural evidence (partially fixed 2026-08-10) |
| 6 | Five separate stages mutate generated HTML before persistence | **Confirmed** | `sanitizeScreenCodeForSharedNavigation` → `normalizeSharedNavigationClearanceHtml` → `normalizeGeneratedUiContracts` → `tokenizeStaticDrawgleHtml` → `ensureDrawgleIds` |

### Additional finding not previously identified

`DRAWGLE_GEOMETRY_CONTRACT_ENABLED=false` gates `applyGeometryContract` but **not** `runDesignCritic`. Both mutate the same DOM inside `normalizeGeneratedUiContracts`, so disabling the geometry contract still leaves the color rewriting active. The flag set is not a coherent control surface.

### Attribution

Findings 1, 3 (concentric half), 4, and the flag gap originate in the 2026-08-10 "Design Brain" work in this repository's recent history. Finding 2 predates it. This review does not treat that work as sacred.

## 0b. Revision 2 — external review accepted, with new evidence

An external review of revision 1 raised eight objections. All eight are accepted and folded into the plan below. Two further findings came out of verifying them.

### New evidence: the critic rule is dangerous but rarely fires

Measured class usage in the stored `Training Dashboard` screen (project `64a97a16`):

```
total classes          395
dg-* utility classes    42
var(--dg-*) arbitrary  148
TOKEN-BOUND TOTAL      190
raw palette colors       0
raw hex values           0
raw radii                0
raw spacing values       0
raw shadows              0
```

Zero unbound styling values. Across the five cosmetics screens the critic also reported `raw_surface_color` on **0 of 5**.

This measurement is taken *after* `tokenizeStaticDrawgleHtml`, so it cannot by itself prove the builder was already compliant. But the critic runs *before* the tokenizer and found nothing to rewrite, which does establish that the builder is not emitting raw palette colors in current production.

**Correction to both revision 1 and the external diagnosis:** `bg-black → dg-surface-card` was ranked as the primary cause of quality loss. The evidence does not support that. It is a loaded gun that has mostly not fired. It must still be removed — it will fire precisely on the high-contrast premium designs this product exists to produce, and its failure mode is a full inversion — but it is **not** the explanation for the screens currently being rejected. Ranking it as *the* P0 would have sent the first implementation phase at the wrong target.

The likelier causes of current visual quality, in order: prompt over-constraint, geometry/radius rewriting, and the absence of rendered feedback.

### New requirement: measure the tokenizer before removing it

Whether `tokenizeStaticDrawgleHtml` is load-bearing for live editing is **unmeasured**, and the review's objection #2 turns on exactly that. It returns `{ code, changed }`; instrument the substitution count per screen across a sample of real generations before deciding the sequencing.

- If near-zero, the builder is self-binding and removal is safe on its own.
- If material, blind tokenization is genuinely holding the moat together and semantic coverage must ship in the same release.

**Measured.** `tokenizeStaticDrawgleHtml` was run against raw builder output captured by `scripts/design-ab.ts` — output that has never passed through the tokenizer:

| Sample | dg-* classes authored | `var(--dg-*)` before | after | substitutions added |
|---|---|---|---|---|
| design-brain-off | 83 | 15 | 22 | **7** |
| design-brain-on | 129 | 71 | 73 | **2** |

The builder authors 83-129 token references per screen unprompted. The tokenizer contributes 2-7 more, roughly **2-8% of total token binding**.

**Conclusion: blind tokenization is not load-bearing.** It is a thin backstop on an already-compliant builder, not the mechanism holding live editing together. Phase 1 may therefore remove it without shipping semantic coverage in the same release, and the phases stay separate.

Caveat: n=2, both prompt-only, one project. Re-measure across image-to-UI and style-reference before treating this as settled — those modes may bind less. But the direction is strong enough to unblock sequencing.

This decision was made by measurement, not argument. It gated the Phase 1/2 boundary.

### Accepted corrections

| # | Correction | Effect on plan |
|---|---|---|
| 1 | Byte-identical raw-output-to-persisted is the wrong global invariant | §4 acceptance criterion rewritten; equality now asserted only on `normalizeGeneratedUiContracts({repairEnabled:false})`, with an explicit allowlist of legitimate platform transforms |
| 2 | Don't remove blind tokenization without semantic coverage shipping alongside | Phases 1 and 2 merge into one release when the measurement above shows the tokenizer is load-bearing |
| 3 | Don't preserve all token-relationship repairs on past benchmark evidence | §8 rewritten; rules split into hard invariants and aesthetic heuristics |
| 4 | Prompt simplification must be early, not late | Moved into the first release |
| 5 | Semantic roles must own **properties**, not whole components | §2 rewritten with a per-property ownership table |
| 6 | Rendered auto-repair needs a high-confidence trigger allowlist | §4 Phase 3 rewritten; `empty_visual_region` and `undersized_touch_target` are diagnostics-only |
| 7 | Deprecated CSS variables must survive as runtime aliases; version the schema | §5 amended; schema becomes `mobile_universal_core_v2` |
| 8 | Kill-switch wording was wrong | Corrected below |

### Correction to the kill-switch claim in §0

Revision 1 implied there was no way to stop the critic's rewriting. That was wrong. `DRAWGLE_UI_CONTRACT_REPAIR_ENABLED=false` sets `repairEnabled=false`, which **does** disable the critic's `raw_surface_color` mutation.

The accurate statement is narrower: `DRAWGLE_GEOMETRY_CONTRACT_ENABLED=false` disables geometry repair but not the critic, so the two mutation systems sharing one DOM do not share one switch; and the master switch's diagnostics-only mode still parses and reserializes the HTML, so it is not byte-preserving.

### Refinement to correction 3

The split between invariant and heuristic runs *within* individual rules, not only between them. The spacing work is the clearest case:

- **Not an invariant today.** `section_gap` and `element_gap` are independent CSS values in the current schema, not references to spacing keys. A project whose section gap is `18px` while the scale lacks `18px` is not malformed — it is a bespoke semantic spacing value. Calling non-membership a referential-integrity defect imported a constraint the schema never declared, and the current validator really does snap these values today.
- **Two legitimate options.** Either model the relationship explicitly in v2 (`element_gap: "md"` resolving to `spacing.md`), at which point membership becomes a real invariant; or leave the values independent and report non-membership as a diagnostic. Do not silently snap.
- **Heuristic either way:** *which* ladder replaces a broken one. `0/4/8/12/16/24/32/48` is taste and must never overwrite an authored scale.

Rules must be decomposed this way before any of them is kept, and a rule only counts as an invariant when the schema actually states the relationship it enforces.

## 1. Root causes, ranked

> **Ranking revised in 0b.** The order below is by *severity of the failure mode*, not by observed contribution to current quality. On measured evidence the raw-color rewrite fires rarely today, while prompt over-constraint and geometry rewriting fire on every build. Implementation order in §4 follows observed contribution; this list follows blast radius. Both matter: one tells you what to fix first, the other tells you what can never be allowed to remain.

### P0 — Deterministic code makes aesthetic decisions on the write path

The system infers *meaning from appearance* and then edits the design. `bg-black` carries no semantic content: it can be a CTA, a nav dock, a hero, a chart mark, or deliberate contrast. Guessing "card" from it and rewriting to `dg-surface-card` — while also rewriting the paired `text-white` to `dg-text-high` — inverts a black button with white text into a white card with dark text.

Same class of error: rewriting a `rounded-full` capsule to the project's standard button radius, and recomputing a nested surface's radius from a concentric formula.

These are design decisions taken after the designer finished designing.

### P0 — There is no genuine bypass

The documented rollback switch parses and reserializes the model's HTML regardless. Any Cheerio round trip can normalize attribute order, quoting, whitespace, and void-element form. The repository has no test asserting `result.code === originalCode`, so byte preservation was never actually claimed or verified.

### P1 — Global tokens are enforced by value matching rather than ownership

`tokenizeStaticDrawgleHtml` converts literal values that happen to equal a token value into `var(--dg-*)` references. A deliberate local `16px` becomes globally themed. The system cannot distinguish "this is the card surface" from "this is currently the same color as the card surface."

### P1 — The token schema conflates four different kinds of thing

Global visual identity, component recipes, runtime invariants, and validator constants are all stored as "design tokens." Users can in principle theme `z_index` and `min_touch_target`; the builder is handed navigation indicator dimensions as if they were brand identity.

### P1 — Prompt interference

Multiple contracts restate the same information with different emphasis and occasional direct contradiction. The measured runtime delta of the design-brain layer is 2,057 chars on a ~27k prompt — smaller than previously claimed, so prompt *size* is not the main issue. Prompt *conflict* is.

### P2 — Compliance measured instead of quality

The 70% → 95.6% benchmark replayed the system's own rules against stored screens. Adding automatic compliance necessarily raises a compliance score. It says nothing about whether a screen looks good, and the same screens the score improved on are the ones users are rejecting.

### P2 — No rendered feedback before acceptance

`quality_diagnostics.rendered` exists but runs after persistence and feeds nothing back. Content-fit failures are unknowable from markup: a `h-[152px]` card whose `aspect-square` tile plus two type lines total 146px inside 136px of usable height is only detectable after layout.

## 2. Target architecture

### Principle

> The builder owns aesthetics. Drawgle owns the visual vocabulary and validates the result. Drawgle does not silently redesign the result.

### Two styling domains

**Token-owned system UI** — must reference project tokens so live editing works:
page backgrounds, card/sheet/modal surfaces, text hierarchy, standard actions, form fields, navigation surfaces, standard borders, the radius vocabulary, spacing rhythm, standard surface shadows.

**Locally-owned art** — the builder is free and Drawgle never rewrites:
hero treatments, charts, one-off gradients, decorative geometry, illustrations, maps, media compositions, intentional high-contrast sections, local effects, deliberate asymmetry.

### Ownership is declared, never inferred

The builder authors intent; Drawgle reads it.

```html
<div data-dg-role="card">              <!-- surface.card, radii.app, shadows.surface -->
<button data-dg-role="primary-action"> <!-- action.primary + on_primary_text -->
<input data-dg-role="field">
<nav data-dg-role="navigation">
<section data-dg-scope="local">        <!-- escape hatch: never audited, never rewritten -->
```

Naming should follow the existing `data-drawgle-id` / block-index conventions in `lib/drawgle-dom.ts` rather than inventing a parallel vocabulary — confirm during implementation.

With a declared role, deterministic repair becomes safe: the question changes from *"what does #000000 mean?"* to *"what token owns a primary action?"*

### Ownership is per property, never per component

A role must not license Drawgle to restyle a whole element. `primary-action` tells us which token owns the *fill and its foreground*; it says nothing about whether that CTA should be a pill, oversized, floating, or icon-led. Binding the whole component to a role would replace blind color inference with blind role enforcement — the same failure one level up.

| Role | Required global | Recommended | Local, never touched |
|---|---|---|---|
| `primary-action` | `action.primary`, `action.on_primary_text`, `typography.button_label` | `sizing.standard_button_height`, standard radius | shape, width, layout, elevation, effects |
| `system-card` | `surface.card` | `radii.app`, `shadows.surface` | padding, internal composition, aspect, decoration |
| `inverse-surface` | inverse surface + its paired foreground | — | everything else |
| `accent-surface` | `action.primary` family | — | everything else |
| `field` | `border.divider`, `typography.body` | `sizing.standard_input_height`, field radius, fill | affordances, icons, internal layout |
| `navigation` | navigation colors | `border`, `shadow` | anatomy, geometry, indicator treatment |

Only the **required** column may be repaired deterministically, and a required binding must name **exactly one** target token. Any rule phrased as "token A or token B" is diagnostics-only by definition — if deterministic code has to choose, it is guessing, which is the original defect.

A generic `card` role is deliberately absent. A premium screen routinely carries a normal card, an inverse card, an accent card and a media card; collapsing them into one role and forcing `surface.card` would re-flatten exactly what this work exists to stop. Surfaces declare which system surface they are, or they declare nothing and stay local.

**Recommended** is reported and never rewritten. **Local** is invisible to the ownership audit.

`data-dg-scope="local"` exempts an element from **token-ownership and aesthetic enforcement only**. Security sanitization, structural validation, asset policy, and objective rendered measurement still apply to everything. A local gradient is free; a local `javascript:` URL is not.

### Pipeline

Current:

```
builder → HTML → sanitize nav → clearance → contract normalize (radii, colors,
geometry, critic) → tokenize literals → ids → persist
```

Target:

```
builder → HTML
  → safety sanitize            (scripts, event handlers, javascript: URLs, control chars)
  → structural validation      (completion, balance, single root)
  → id assignment
  → token-coverage audit       (INSPECT ONLY — reports violations by declared role)
  → rendered measurement       (390x844, real browser)
  → bounded targeted repair    (only certain-answer fixes, or one scoped builder pass)
  → persist
```

Everything between structural validation and repair becomes read-only. Only two things may mutate design: a deterministic fix where the declared role makes the answer unambiguous, and a scoped builder repair explicitly forbidden from touching composition.

## 3. Token schema changes

Reclassify rather than delete. Four destinations:

**A. Global design tokens (keep, user-themeable, live)**
`color.background.{primary,secondary}`; `color.surface.{card,bottom_sheet,modal}`; `color.text.{high,medium,low}_emphasis`; `color.action.{primary,secondary,on_primary_text,disabled}`; `color.border.{divider,focused}`; `color.status.*`; `typography.{heading,body}_font_family` and the nine semantic roles; `spacing.*`; `mobile_layout.{screen_margin,section_gap,element_gap}`; `radii.{app,inner,pill}`; `border_widths.standard`; `shadows.{surface,overlay}`; `sizing.{standard_button_height,standard_input_height}`; navigation **colors only** (`surface`, `content`, `muted_content`, `active_surface`, `active_content`, `border`).

**B. Component recipe (move out of tokens, keep as project config)**
Navigation anatomy, width, labels, active treatment, surface material, container height, max width, insets, padding, gaps, icon/label sizing, indicator dimensions, backdrop blur. `componentShapePolicy` moves here and becomes **builder guidance in the prompt**, not post-generation enforcement.

**C. Runtime invariants (move out of tokens entirely)**
`safe_area_top/bottom`, `min_touch_target`, `z_index`. These are device and engineering constants.

`bottom_nav_height` is **not** one of them — it belongs to the navigation recipe in group B, alongside `container_height`, because a floating compact dock and a fixed tab rail legitimately differ. The renderer computes the resulting content clearance from the recipe. `--dg-sizing-bottom-nav-height` survives only as a compatibility alias for screens that already reference it. Users must not theme them; the renderer owns them.

**D. Remove or demote**
`shadows.none`; `elevation` (duplicates shadows); `action.on_surface_white_bg` (bakes a light-theme assumption into a semantic name); `action.primary_gradient_start/end` (second source of truth for `gradients.action_primary`); legacy typography aliases (`title_large`, `title_main`, `body_primary`, `body_secondary`); `gradients.{app_background,surface_highlight,accent_ring}` demoted to optional — required global gradients are a major cause of every screen looking generated from one recipe; `radii.inset_*` retained as **optional utilities only**, with concentric enforcement removed.

Files: `lib/types.ts`, `lib/design-tokens.ts`, `lib/token-runtime.ts`, `components/DesignSystemEditor.tsx`, `lib/project-navigation.ts`.

## 4. Phased implementation

Four phases. Each ships independently and is separately reversible.

### Phase 1 — Stop the bleeding (P0, small, no schema change)

1. `runDesignCritic` becomes diagnostics-only. Delete the mutation branch in `checkRawSurfaceColors` outright; do not gate it behind a flag.
2. Make the bypass real: when repair is disabled, return the **original string**. Audit on a cloned DOM. Add the missing test: `expect(result.code).toBe(originalCode)`.
3. Disable radius-role rewriting, concentric radius repair, and gap rewriting on the generation write path. Keep every report.
4. Stop `tokenizeStaticDrawgleHtml` rewriting new builder output. The builder already receives the token system; converting coincidentally-matching literals is value inference, the same error class as #1.

Files: `design-critic.ts`, `ui-contract-normalizer.ts`, `geometry-contract.ts`, `trigger/generate-ui-flow.ts`, `lib/token-runtime.ts`.

**Acceptance criterion (revised).** Not raw-output equality. Persistence performs legitimate structural work — security sanitization, sentinel handling, id assignment, asset hydration, shared-navigation handling, nav clearance. The invariant is:

> No aesthetic or layout property may change after builder output except through an explicitly allowlisted platform transform.

Plus one exact test that does not exist today:

```ts
const result = normalizeGeneratedUiContracts({ code: original, repairEnabled: false });
expect(result.code).toBe(original);
```

Achieving that requires auditing on a cloned DOM and returning the original string, rather than reserializing `$.root().html()`.

**Sequencing gate.** Step 4 does not ship alone if the tokenizer measurement in §0b shows blind tokenization is materially binding real screens. In that case Phase 1 and Phase 2 ship as one release, so live global editing never regresses even temporarily.

**Prompt simplification ships here, not later.** Removing post-processing is insufficient on its own: the prompt itself currently instructs the builder to use tokens for *every visual decision*, declares radius roles strict, mandates the concentric law and matching inset radii, calls token gradients canonical, requires equal-height grid siblings, demands justification for asymmetry, and imposes viewport and copy-budget arithmetic. That instruction stack can produce conservative rule-compliant output before any sanitizer runs. Audit for contradiction and over-constraint, not merely for length — the measured runtime delta is only 2,057 chars, so size is not the problem.

### Phase 2 — Declared semantic ownership

1. Add role attributes to the builder contract with a short, closed vocabulary and the local escape hatch.
2. Prompt: system UI must carry a role and use `dg-*` utilities; everything else is free. Replace the `componentShapePolicy` enforcement with vocabulary guidance — the project supplies the radius words, the builder chooses which fits.
3. Build the token-coverage audit: for each roled element, does it reference the owning token? Report violations with element id, role, and the expected token. **No mutation.**
4. Deterministic repair only where role makes the answer certain (`primary-action` + non-token background → `dg-action-primary`). Ambiguous cases are reported, not fixed.

Files: `prompts.ts`, new `lib/generation/token-coverage.ts`, `drawgle-dom.ts`, `block-index.ts`.

### Phase 3 — Rendered acceptance loop

Wire `lib/generation/rendered-geometry.ts` (already written) into the build:

1. Generate once.
2. Render at 390×844 in the existing preview runtime.
3. Measure: content overflow, horizontal overflow, clipped text, undersized targets, empty painted regions.
4. If a **repair-triggering** failure exists, run **one** scoped builder repair: fix these measured failures, change nothing else.
5. Re-render, then **persist whichever candidate measures better** — original or repaired — on severe-failure count. Never persist a repair that made the screen worse.

Both candidates and both measurements are retained for the run record. A repair that fixes one overflow while introducing three collisions must lose.

**Repair triggers (high confidence only).** Content overflowing its container, horizontal viewport overflow, text physically clipped, elements colliding, an interactive control genuinely too small to operate.

**Diagnostics only, never a trigger.** `empty_visual_region` — negative space is frequently the design, and this rule already produced a false positive on legitimate ambient layers. `undersized_touch_target` on non-interactive or decorative iconography. Any density, balance, or symmetry judgement.

The measurement layer detects failures. It does not hold opinions.

Hard bound: one repair, one re-render. No loops. Failure to improve still persists the screen — a measured-but-imperfect screen beats a failed generation.

Files: `trigger/generate-ui-flow.ts`, `screen-quality.ts`, `rendered-geometry.ts`, `service.ts`.

### Phase 4 — Schema reclassification

Execute section 3. Highest-risk phase because it touches persisted data and the editor; do it last, when quality has stabilized.

## 5. Backward compatibility

- **Existing screens are never rewritten.** No migration touches stored HTML.
- **Schema is explicitly versioned** as `mobile_universal_core_v2` rather than silently changing what the current schema name means. Runtime branches on the version.
- **Existing token sets keep parsing.** Removed keys are read-tolerated and ignored, not deleted from stored JSON. `normalizeDesignTokens` already tolerates unknown keys.
- **Deprecated CSS variables remain runtime aliases.** A v1 screen referencing `--dg-sizing-min-touch-target` or a removed gradient must still render inside a v2 project. The variables keep being emitted; they simply stop appearing in builder prompts and in the editor UI.
- **Runtime invariants keep emitting CSS variables** so old screens referencing `--dg-sizing-min-touch-target` continue to render; they simply stop being user-editable.
- **Edits to old screens** use the new pipeline but must not trigger a wholesale re-audit of untouched markup — audit only the edited blocks.
- **The live token editor keeps working throughout.** Phase 4 reduces what it exposes; it never breaks it.

## 6. Rollout flags

Replace the current incoherent set with one flag per *behavior*, each defaulting to the safe direction:

| Flag | Default | Controls |
|---|---|---|
| `DRAWGLE_HTML_MUTATION_ENABLED` | `false` | **emergency master kill switch.** When `false`, no non-safety HTML mutation runs regardless of any flag below it. Documented as taking precedence so enabling a specific repair while this is off cannot silently do nothing. |
| `DRAWGLE_TOKEN_COVERAGE_REPAIR` | `false` | role-based deterministic repair (Phase 2) |
| `DRAWGLE_RENDERED_REPAIR_ENABLED` | `false` | the single bounded repair pass (Phase 3) |
| `DRAWGLE_TOKEN_RELATIONSHIPS_ENABLED` | `false` → diagnostics | token mutation |
| `DRAWGLE_DESIGN_BRAIN_PROMPTS_ENABLED` | pending A/B | charter, spatial rules, layout budget |

Every flag must have a test proving the disabled path is genuinely inert.

## 7. Evaluation

The existing `scoreDesignBenchmark` measures compliance with our own rules and must not be used to justify this work.

Use `scripts/design-ab.ts` (already built), extended to compare three arms across prompt-only, image-to-UI, style-reference, and curated-style fixtures:

- **baseline** — generation behavior before the design-brain changes
- **current** — today
- **proposed** — after each phase

Metrics are rendered and objective: content overflow, clipped text, horizontal overflow, empty regions, undersized controls, generation failure rate. Plus screenshots for human judgement. n ≥ 5 per arm; the builder is stochastic and single samples measure luck.

Acceptance for Phase 1 is the allowlisted-transformation invariant defined in §4. That definition is authoritative; no other phrasing of it appears in this document.

## 8. Recent work that must be preserved

Do not revert these while removing the mutation layers:

- persistence reliability, including the `PGRST204` compatibility path
- stream stability and the partial-tag trim in `ScreenNode`
- reference fidelity: recreate routing, the reference-analysis schema fix, reference identity on the charter
- navigation: `willRenderSharedNavigationShell` gating, ordered destination linking, evidence-led chrome
- duplicate-root recovery in `sanitizeStaticDrawgleHtml`
- dropped-brief accounting and roadmap failure marking
- `rendered-geometry.ts` measurement
- the token **generation** improvements, but **only after decomposition**. Revision 1 claimed these should be preserved wholesale on the strength of a two-project replay. That was over-confident, and the external review is right to reject it. Before any rule is kept it must be classified:

  **Hard invariants — may repair.** Invalid or unparseable values; scale ordering that is non-monotonic; layout gaps that are not members of the spacing scale; contrast floors for text on its own surface.

  **Aesthetic heuristics — advise only, or constrain initial generation when backed by explicit user or reference evidence.** Hue retinting of surfaces, the 0.05 lightness-separation rule, the 2x macro/micro gap ceiling, hero/title size ratios, shadow restyling, glass and gradient permission, heading font-class rejection, replacement spacing ladders.

  **In all cases an explicit user token edit wins.** A user who sets a serif heading or a glass dock in the editor must never have it clamped back on the next generation.

## 9. Open questions

1. Which decomposed token rules survive? Only hard invariants — invalid values, non-monotonic ordering, contrast floors — survive automatically. Every aesthetic heuristic must earn its place through the rendered A/B, and none is presumed beneficial. The earlier claim that these "demonstrably help" rested on a two-project replay and is withdrawn.
2. Does the block-index/selection system already carry semantic role information that Phase 2 can reuse rather than duplicate?
3. Is there a baseline commit that cleanly predates the design-brain work and still contains the persistence fixes, or must the baseline arm be assembled?

---

## 10. Phase 1 — implemented 2026-08-11

### What changed

| # | Change | File |
|---|---|---|
| 1 | `runDesignCritic` is now pure. The `repairEnabled` parameter is gone; the function cannot mutate. The `bg-* → dg-surface-card` / `text-* → dg-text-high` rewrite is deleted outright, not flagged off. | `lib/generation/design-critic.ts` |
| 2 | Added `htmlMutationEnabled()` — the master kill switch, **default OFF**, documented as taking precedence over every per-behaviour flag. | `lib/generation/ui-contract-normalizer.ts` |
| 3 | Byte preservation. The DOM is only reserialized when a repair genuinely ran; otherwise the original string is returned unchanged. | `lib/generation/ui-contract-normalizer.ts` |
| 4 | Radius-role rewriting, concentric radius repair and gap rewriting are off by default via the master switch. All reports retained. | `ui-contract-normalizer.ts`, `geometry-contract.ts` |
| 5 | `tokenizeStaticDrawgleHtml` no longer runs on the generation write path unless mutation is explicitly enabled. | `trigger/generate-ui-flow.ts` |
| 6 | Prompt de-conflicted: token ownership is now scoped to system UI with local art explicitly free; the concentric "law" is demoted to guidance; the radius map is a default rather than an authority; canonical gradients relaxed. | `lib/token-runtime.ts`, `lib/generation/prompts.ts` |

### Verification

`lib/generation/html-mutation-boundary.test.ts` is new and contains the assertion that never existed:

```ts
expect(result.code).toBe(INTENTIONAL_DESIGN);
```

Its fixture is deliberately adversarial — a black CTA with white text, a capsule radius, a nested surface violating the concentric formula, a raw palette color, and an asymmetric grid with unequal media heights. Every one of those was previously rewritten. All are now preserved.

Verified against **real captured builder output** (`temp/design-ab/design-brain-on-1.html`, 8,678 chars, never previously through the pipeline):

```
raw length       8678
output length    8678
identical        true
repairs applied  0
warnings         5
critic findings  1
```

Byte-identical, while still producing six diagnostics. Inspection is intact; redesign is gone.

Suite: 379 passed, 53 files. Typecheck clean. `lib/canvas-camera.test.ts` remains the pre-existing `node:test` file vitest cannot collect.

### Tests that were changed, and why

Three tests failed after the boundary moved. All three asserted the old mutation behaviour — precisely the "a rule proves it rewrites HTML into the form that same rule expects" pattern this review identified as inadequate.

- `ui-contract-normalizer.test.ts` × 2 — now pass `repairEnabled: true` explicitly, preserving coverage of the opt-in repair path.
- `design-brain-regression.test.ts` — `replaces raw palette surfaces with token roles` became `reports raw palette surfaces without replacing them`, and now asserts the classes are **unchanged**.

### Behaviour change to expect

Token binding in newly generated screens will come entirely from the builder. Measurement in §0b says that is 83–129 references per screen against the tokenizer's 2–7, so the drop should be small — but it is not zero and should be watched. If live editing visibly regresses on new projects, that is the signal to pull Phase 2 forward rather than to re-enable mutation.

`DRAWGLE_HTML_MUTATION_ENABLED=true` restores every Phase 1 behaviour at once if something unexpected surfaces.

### Not done in Phase 1

- Semantic role attributes and the token-coverage audit (Phase 2)
- Rendered acceptance loop (Phase 3) — `lib/generation/rendered-geometry.ts` exists and is wired into `scripts/design-ab.ts`, but not into the build
- Token schema reclassification and `mobile_universal_core_v2` (Phase 4)
- `validateTokenRelationships` decomposition into hard invariants vs aesthetic heuristics — **still mutates tokens by default**, gated only by `DRAWGLE_TOKEN_RELATIONSHIPS_ENABLED`

### Starting Phase 2

The tokenizer measurement in §0b already resolved the sequencing gate: blind tokenization was not load-bearing, so Phase 2 does not have to ship alongside anything. It can start clean.

First task is the role vocabulary. Check whether `lib/drawgle-dom.ts` and `lib/generation/block-index.ts` already carry semantic information Phase 2 can reuse rather than duplicate — that is open question 2 in §9 and it is unanswered.

Before writing Phase 2 code, run the A/B: `pnpm run design:ab -- --project <id> --n 5` on a Phase 1 build versus the pre-Phase-1 commit. Phase 1's whole premise is that removing mutation improves output. That premise is currently **unmeasured on rendered results** — it is verified only as "the pipeline no longer alters the HTML", which is a different claim.

---

## 11. Post-Phase-1 production observation — 2026-08-11

Project `61267619-6a11-4d7f-9639-d2eb850326b1`, prompt-only fitness app, style reference. First run on a Phase 1 build. 2 of 4 screens failed.

**Recorded for later comparison. Not fixed, deliberately — this is baseline evidence for evaluating the completed plan.**

### What the run actually produced

| Screen | Status | Requested budget | Completion tokens | Finish | Result |
|---|---|---|---|---|---|
| Progress Analytics | ready | 26,000 | 7,999 | `stop` | 11,358 chars, sentinel present |
| Nutrition Tracker | ready | 12,000 | 9,406 | `stop` | 12,034 chars, sentinel present |
| Workout Library | **failed** | 12,000 | **12,000** | `length` | truncated mid-tag at 14,508 chars |
| User Profile | **failed** | 12,000 | none recorded | none recorded | 130 chars, empty stream |

Prompt size was ~9,120 tokens for all four, so the inputs were effectively identical.

### Root cause: the output budget is a keyword lottery

`lib/generation/screen-budget.ts`:

```ts
const dense = screenPlan.description.length > 6000
  || /\b(dashboard|analytics|chart|map|calendar|timeline|table|...)\b/i.test(evidence);
if (dense) return 26000;
return screenPlan.description.length < 2800 ? 12000 : 18000;
```

The budget is derived from **the length of the brief and whether it contains one of a fixed list of words** — not from the complexity of the screen being built.

"Progress **Analytics**" matched the regex and received 26,000. "Workout Library" and "User Profile" matched nothing and received 12,000. Those are precisely the two that failed. A screen's survival depended on whether its name happened to contain a keyword.

Brief length is also a poor proxy for output length: a short brief can describe a dense list-and-grid screen. Workout Library's brief was under 2,800 chars and its screen needed more than 12,000 completion tokens.

**Observed range for this builder: 7,999–12,000+ completion tokens.** A 12,000 cap sits inside the normal working range, so it is not a safety limit — it is a coin flip. Nutrition Tracker survived on 9,406 with 2,594 to spare; Workout Library did not.

### Secondary finding: the env cap makes the top tier unreachable

`.env.local` sets `DRAWGLE_OPENROUTER_MAX_TOKENS="16000"`, and `lib/ai/provider.ts` applies `Math.min(maxOutputTokens, getOpenRouterMaxTokens())`.

So the `dense → 26000` branch can never deliver more than 16,000 in this environment. The diagnostics record the *requested* 26,000, not the 16,000 actually sent, which makes the logs misleading about what the model was given.

### Third finding: no retry on the most retryable failure there is

Both failures show `attempt: 1`, `retryReason: "initial"`. A `finish_reason: length` truncation is close to the ideal retry candidate — the same request with a larger budget would very likely succeed. Nothing retries.

This is the same gap recorded for `duplicated_screen_fragment` in the 2026-08-11 entry of `updates.md`: recoverable model-level failures terminate the screen instead of being recovered.

### Fourth finding: User Profile is a different failure

130 characters, `usage: null`, `finishReasons: []`. That is not truncation — the stream produced essentially nothing and reported no usage. It is grouped under the same user-facing "Generation failed" message, which hides the distinction. Whether it is a provider abort, an early disconnect, or something else is unknown and needs its own investigation.

### Did Phase 1 cause this?

**Not the mechanism.** The budget function is pre-existing and untouched by Phase 1. Input tokens do not consume the output budget, so the ~700-token prompt growth from the Phase 1 edits does not explain a completion-token ceiling.

**Possibly a contributing factor, untested.** Phase 1 deliberately freed the builder — "local art is yours, use any CSS you want" replaced "use tokens for every visual decision". A less constrained builder plausibly writes longer, more elaborate HTML. If output verbosity rose, a 12,000 cap that was previously marginal would begin failing.

Evidence against Phase 1 being the primary cause: Nutrition Tracker completed comfortably at 9,406 tokens under the same freed prompt. The variance is screen-to-screen, and the cap is what converts normal variance into a hard failure.

**This is a hypothesis, not a finding.** The A/B in §10 would settle it: compare mean completion tokens per screen on a pre-Phase-1 build against a Phase 1 build, same prompts. Until that runs, prompt-driven verbosity remains unmeasured, exactly like the quality claim it sits next to.

### Why this is being left alone

Fixing the budget now would confound the Phase 1 evaluation. The A/B needs a stable build on both sides. Two failure modes are now queued behind that measurement:

1. Output budget allocated by keyword match rather than screen complexity, with a cap inside the builder's normal working range.
2. No retry on recoverable model-level failures — truncation and duplicated roots both terminate a paid screen.

Both belong to the same family as the rendered-acceptance work in Phase 3: the pipeline detects a failure it could recover from, and discards the screen instead.

---

## 12. Phase 2 — implemented 2026-08-12

### Open question 2, answered

**There is no existing semantic layer to reuse.** `data-drawgle-id` in `lib/drawgle-dom.ts` is identity only. `ScreenBlockKind` in `lib/generation/block-index.ts` looks promising but is derived from `KEYWORD_HINTS` regexes over class names and text — inference from appearance, the same error class this phase exists to eliminate. It is fine for editor selection targeting; reusing it for token ownership would reintroduce guessing.

Phase 2 therefore introduces a genuinely builder-*declared* attribute.

### What was built

**`lib/generation/token-ownership.ts`** — the vocabulary and the per-property ownership table.

Nine roles: `system-card`, `system-sheet`, `system-modal`, `primary-action`, `secondary-action`, `field`, `navigation`, `inverse-surface`, `accent-surface`. Plus `data-dg-scope="local"`.

Three design constraints, each answering a specific way this could have gone wrong:

1. **No generic `card` role.** A premium screen carries a normal card, an inverse card, an accent card and a media card. One role forcing `surface.card` would re-flatten exactly what this work exists to stop.
2. **Required bindings name exactly one token.** `field` has no required fill, because a field may sit on the card surface *or* the page background — a genuine "A or B", so it is reported and never repaired.
3. **`inverse-surface` and `accent-surface` carry no required binding at all.** The schema has no inverse-surface token. Inventing one would fabricate a rule. They exist so the builder can declare intent and the audit stops treating them as unclassified. They gain bindings in Phase 4 only if the schema grows to support them.

**`lib/generation/token-coverage.ts`** — the audit. Inspection only.

For each roled element it asks whether the owned property references the owning token, accepting either the `dg-*` utility or a `var(--dg-*)` binding. An element that does not set the property at all is not a violation — inheriting from a parent is legitimate. Findings carry the element, role, property, expected token and a `deterministicallyRepairable` flag that is true only when exactly one token owns the property.

`repairOwnedProperties` exists but is gated behind `DRAWGLE_TOKEN_COVERAGE_REPAIR=true` **and** the Phase 1 master switch, both off by default.

### Verification

11 new tests. The ones that matter most are the negative cases, because Phase 2's whole risk is replacing blind color inference with blind role enforcement:

- A `rounded-full h-16 w-full shadow-2xl` primary CTA produces **zero** findings — only fill and foreground are owned.
- A repair binds the background and leaves `rounded-full`, `h-16`, `w-full`, `shadow-2xl` untouched.
- An unroled `bg-black text-white` button produces **zero** findings. That is the Phase 1 defect restated: with no role, it is local art.
- Everything inside `data-dg-scope="local"` produces zero findings, including a roled element contradicting its own scope.

Against the real stored `Training Dashboard` (generated before Phase 2 existed):

```
roles declared         0
local scopes           0
DOM unchanged          true
findings by code       {"unclassified_system_surface": 6}
repairable             0
```

The expected baseline: no roles yet, six surfaces whose ownership is unverifiable, nothing repairable, nothing touched.

Suite: 390 passed, 54 files. Typecheck and lint clean.

### What this does not do yet

- **No screen has roles.** The builder has only just been told to emit them. Until real generations carry `data-dg-role`, the audit reports `unclassified_system_surface` and little else. That is correct behaviour, not a bug.
- **Repair is off.** It should stay off until roled output exists and the findings can be eyeballed.
- **`componentShapePolicy` still exists** as a token-schema field. The prompt now frames radius as vocabulary rather than law, but the field itself moves to the navigation/component recipe in Phase 4.

### Known state carried forward

Two items remain open and are **not** addressed by Phase 2:

1. **Phase 1 is still unvalidated on rendered results.** The A/B in §10 has not run. Phase 1's premise — that removing mutation improves output — remains unmeasured.
2. **The output-budget bug in §11 is still live.** `screenBuildOutputTokenBudget` allocates 12,000 tokens by keyword match, inside the builder's 7,999–12,000+ working range. Production lost 2 of 4 screens to it on 2026-08-11. It was recommended as the next fix and deferred in favour of Phase 2.

Both were raised before starting Phase 2 and consciously deferred. They are recorded here so the sequencing decision stays visible rather than becoming an accident.

### Starting Phase 3

Phase 3 is the rendered acceptance loop. `lib/generation/rendered-geometry.ts` already exists and is wired into `scripts/design-ab.ts`; it needs wiring into the build with the repair-trigger allowlist from §4 and the better-of-two-candidates rule.

Before that, the §11 budget bug is worth clearing — a rendered loop that re-renders truncated screens will measure truncation artefacts rather than design quality.

---

## 13. Phase 1 validation — measured 2026-08-12

### The question splits in two

Phase 1 changed two different kinds of thing, and they need different experiments:

| Question | Method | Cost |
|---|---|---|
| **A.** Did removing the mutation layer improve output? | Same raw HTML through both pipelines, render both, measure | **Free** — no generation |
| **B.** Did the prompt de-conflicting improve output? | Generate N per arm, render, measure | ~10 generations |

A is a controlled comparison: the input HTML is byte-identical in both arms, so every difference is attributable to the mutation layer alone and there is no model stochasticity to average out. n=1 is already meaningful.

`scripts/mutation-impact.ts` (`pnpm run design:mutation-impact`) answers A.

### Result for A: the mutation layer was quality-neutral

Two raw builder samples, run through the pre-Phase-1 pipeline and the post-Phase-1 pipeline:

```
Metric (lower is better)        OLD      NEW
Content overflow / screen      2.50     2.50
Clipped text / screen          0.00     0.00
Horizontal overflow / screen   0.50     0.50
WEIGHTED FAULT SCORE          10.50    10.50
```

Identical. The old pipeline applied 1 and 5 repairs respectively; **none of them changed anything measurable in the rendered result.** The only difference in the findings list is cosmetic — `pt-[var(--dg-spacing-xs)]` against `pt-[8px]`, which compute to the same layout.

### What this means, stated plainly

**Phase 1 did not improve rendered quality.** It also did not harm it. On these samples the mutation layer was not the thing degrading screens.

This is consistent with §0b, where `raw_surface_color` fired on 0 of 5 cosmetics screens. The dangerous rule rarely fires; when it does not fire, removing it changes nothing.

So Phase 1's real value is **risk removal, not measured gain**: it eliminates a latent failure that inverts black CTAs into white cards, and it restores builder authorship of the output. Both are worth having. Neither is the fix for the quality complaint that started this work.

Revision 1 of this document, and the external diagnosis it was reviewing, both assumed the mutation layer was actively degrading output. On this evidence it was not. That assumption should not be carried into later phases.

### Caveats

- n=2, both prompt-only, both samples truncated by the §11 budget bug.
- Neither sample contained a black CTA or a capsule radius, so the catastrophic inversion case is **untested here**. Absence of harm on these samples is not proof of absence generally.
- The 5 repairs on one sample were radius and alias rewrites, which are cosmetically invisible by nature.

### The finding that actually matters

Raw builder output measures **2.5 content overflows and 0.5 horizontal overflows per screen** before anything touches it.

That is the real defect, it is present in the model's own output, and neither Phase 1 nor Phase 2 addresses it. It is precisely what Phase 3's rendered acceptance loop exists to catch. This measurement is the strongest evidence so far that Phase 3 is the phase that will move visual quality.

### Question B remains open

The prompt de-conflicting is still unmeasured. Run:

```
DRAWGLE_OPENROUTER_HARD_TIMEOUT_MS=600000 pnpm run design:ab -- --project <id> --n 5
```

Note this compares the design-brain prompt layer on/off, not pre/post-Phase-1 prompts exactly. A true Phase 1 prompt A/B needs the pre-Phase-1 `prompts.ts` and `token-runtime.ts` as the baseline arm. Worth building only if the answer would change a decision — the §11 budget bug and Phase 3 both rank higher.

### Correction to §13: the average concealed the prompt signal

§13 reported "10.50 vs 10.50" and concluded the mutation layer was quality-neutral. That conclusion stands — but the figure was averaged across **both prompt arms**, which hid the comparison that matters. Broken out per sample:

| Sample | Weighted fault | Findings |
|---|---|---|
| design-brain **OFF** | **8** | 3 undersized targets, 1 horizontal overflow, 1 content overflow |
| design-brain **ON** | **13** | 1 undersized target, **4 content overflows** |

Identical across old/new pipeline in both cases, confirming the mutation finding. But the design-brain prompt arm scores **62% worse**, and the entire gap is `content_overflows_container` — the most severe code, weight 3.

Three independent lines now point the same way:

1. **Visual.** The design-brain-ON frames show cards with clipped labels and content spilling past its container; the OFF frames render cleanly.
2. **Measured.** 4 content overflows against 1.
3. **Mechanism.** The design-brain spatial rules declare region min/max heights, equal-height siblings and copy budgets. Fixed-height containers whose content does not fit is the predicted failure of exactly that instruction set — the same 146px-in-136px arithmetic documented earlier.

**Confound, stated honestly:** both samples were truncated by the §11 budget bug, and design-brain-ON was the shorter of the two (8,678 vs 11,956 chars). Truncation removes the *tail* of a document; it does not make mid-document cards overflow fixed heights, so it is an unlikely explanation for this specific code. But n=1 per arm is not conclusive, and the A/B should be re-run on complete samples once the budget bug is cleared.

**Action taken on this evidence:** disable the design-brain prompt layer in production via `DRAWGLE_DESIGN_BRAIN_PROMPTS_ENABLED=false` while the confirming measurement is pending. The flag is instantly reversible and the deterministic token-generation work is unaffected by it.

---

## 14. Design brain prompt layer removed — 2026-08-12

Deleted rather than flagged off, on the §13 evidence: 62% worse rendered fault score with the entire gap in `content_overflows_container`, matching both the visual inspection and the predicted failure of its own spatial rules.

### Removed

| What | Where |
|---|---|
| `buildStyleCharterSection` | `prompts.ts` — charter text in the builder and edit prompts |
| `buildSpatialArithmeticContract` | `prompts.ts` — region heights, equal-height siblings, copy budgets |
| `formatLayoutBudgetContract` | `layout-budget.ts` — viewport budget text in the builder prompt |
| Charter text in both planner prompts | `service.ts` blueprint and screen-brief steps |
| `DRAWGLE_DESIGN_BRAIN_PROMPTS_ENABLED` | gone entirely; nothing reads it |

### Deliberately kept

The deletion is scoped to **screen-shaping prompt text**. The harm was measured in screen HTML, so anything that shapes the token system was left alone:

- **`style-charter.ts`** — the charter object still drives `validateTokenRelationships`, which produced the coherent spacing ladder, tinted card surface, 1px border and contrast ramp. `formatStyleCharterContract` is still used by creative direction and token generation, both of which measured better.
- **`design-tokens-relationships.ts`** — separately flagged, separately evidenced.
- **`rendered-geometry.ts`** — Phase 3's foundation.
- **`design-critic.ts`** — pure diagnostics since Phase 1.
- **`layout-budget.ts` resolvers** — `resolveViewportBudget` and `resolveRegionContracts` stay so stored v3 plans keep normalizing. Only the prompt formatter went.

### Verification

387 tests pass, typecheck and lint clean. `pipeline-regression.test.ts` now asserts the *absence* of the three exports and that no source file reads the flag, so the layer cannot quietly return.

Two tests changed from asserting behaviour to asserting removal — `layout-budget.test.ts`'s formatter block was deleted, and the design-brain describe in `pipeline-regression.test.ts` was replaced.

### Consequence for tooling

`scripts/design-ab.ts` toggled the deleted flag, so **both of its arms now produce an identical prompt**. It is documented in-file as a 2N sample generator rather than an A/B, and prints a notice at runtime. It stays useful for Phase 3 validation: it captures raw builder output and renders it at 390×844 with objective measurement.

### What this does and does not fix

It removes a measured regression. It does **not** fix content overflow — raw builder output still shows ~1 per screen with the layer gone. Prompts cannot reliably prevent overflow because the model never sees its own layout. That remains Phase 3's job, and §13 is the evidence for prioritising it.

Also still open and unchanged: the §11 output-budget bug, costing roughly half of all screens.
