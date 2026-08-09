# Prompt Flow Map

This is the short maintainer version for `lib/generation/prompts.ts`.

## The Mental Model

Project creation uses the LLM in this order:

```text
1. Analyze reference image
2. Create creative direction
3. Create design tokens
4. Plan app/screens
5. Build screen HTML
```

`prompts.ts` does not contain one big prompt. It contains small prompt pieces that are combined by `lib/generation/service.ts`.

The most important thing:

```text
Planner prompts decide WHAT to build.
Builder prompts decide HOW to code one screen.
Edit prompts modify existing code.
```

## Simple Flow

```text
User prompt + image
  |
  v
referenceAnalysisRecreateInstruction / referenceAnalysisStyleInstruction
  -> describes what is visible in the image
  |
  v
creativeDirectionInstruction
  -> creates product art direction
  |
  v
designInstruction
  -> creates design tokens
  |
  v
plannerBlueprintStepInstruction
  -> creates charter + navigation architecture/plan + ordered screen seeds
  |
  v
plannerScreenBriefStepInstruction
  -> creates the first builder-ready brief
  |
  v
buildRecreateScreenInstruction / buildStyleScreenInstruction
  -> starts the selected builder for screen 1
  |
  +--> one remaining-screen brief batch runs concurrently
  +--> that screen's asset resolution runs concurrently with HTML streaming
  |
  v
deterministic asset-slot hydration + validation
  -> persists the ready screen
```

## Prompt Map

| Prompt | Used for | Sent alone to LLM? | Controls |
|---|---|---:|---|
| `referenceAnalysisInstruction` | Base image analysis rules | No | Shared structure for reference analysis |
| `referenceAnalysisRecreateInstruction` | Image-to-UI recreate | Yes | Treat image as exact structure |
| `referenceAnalysisStyleInstruction` | Style reference mode | Yes | Treat image as visual DNA only |
| `creativeDirectionInstruction` | Art direction | Yes | Brand feel, surface language, composition rules |
| `designInstruction` | Design tokens | Yes | Colors, type, spacing, radius, shadows |
| `plannerSharedModeContract` | Shared planner rules | No | JSON discipline, consistency, builder-ready briefs |
| `plannerBlueprintJsonContract` | Blueprint JSON shape | No | Required blueprint output format |
| `plannerScreensJsonContract` | Screen JSON shape | No | Required screen brief output format |
| `plannerRecreateInstruction` | Planner in recreate mode | No | Preserve uploaded image structure |
| `plannerStyleInstruction` | Planner in style mode | No | Borrow style, not layout |
| `plannerBlueprintStepInstruction` | Planning pass 1 | Yes | Charter + navigation architecture/plan |
| `plannerScreenBriefStepInstruction` | Planning pass 2 | Yes | Screen list + detailed screen briefs |
| `buildRecreateScreenInstruction` | Build recreate screen HTML | Yes | Static HTML for one screen, image as structure |
| `buildStyleScreenInstruction` | Build style-based screen HTML | Yes | Static HTML for one screen, style only |
| `editInstruction` | Base edit format | No | XML `<edit>` patch format |
| `buildEditSystemInstruction` | Screen edit | Yes | Modify selected/scoped HTML safely |

## What Each Stage Receives

Style Reference builds may attach the source image to the final builder as guarded `style-calibration` evidence. This is not Image-to-UI structure: the version-2 transfer contract and named target regions remain authoritative, and source-local motifs are legal only in approved regions with the same function. Set `DRAWGLE_STYLE_REFERENCE_CALIBRATION_ENABLED=false` to use the analysis-only fallback.

Every initial build, retry, add-screen build, and supported edit also receives `BuilderProjectContractV1`: compact product identity, current screen purpose/regions/chrome, product-owned destinations, screen-family rules, and shape policy. It excludes raw planner output, roadmap JSON, `Planner Brief`, other screens' detailed layouts, reference-domain content, and duplicated prompt text.

Before persistence, generated and edited HTML passes through deterministic UI contract normalization. Exact aliases and confident standard-control roles may be repaired; unresolved cosmetic drift is saved with diagnostics and never causes a CSS-only builder retry. After Tailwind and fonts are ready, the iframe performs non-blocking rendered checks and posts only issue enums, stable Drawgle IDs, hashes, viewport size, and numeric measurements.

For new multi-screen projects, `planProjectBlueprint()` is the architecture boundary. Its ordered seeds lock screen identity/order, root/detail relationships, product purpose, navigation semantics, and screen-family rules without defining detailed topology. The first seed is briefed alone. After its real builder is triggered, `planScreenBriefsForBuild()` is called once for all remaining seeds; it cannot replace blueprint identities or navigation ownership. The compatibility `planUiFlow()` still performs blueprint plus all-screen briefs for flag-disabled and legacy callers.

The final builder may receive pending `assetRequirements` instead of a resolved URL manifest. It must output styled empty elements with exact `data-asset-slot`, `data-asset-requirement-id`, and `data-asset-role` attributes and may never invent a URL. Resolution overlaps streaming; only deterministic hydration, sanitization, and critical-asset validation happen before ready persistence. `DRAWGLE_PROGRESSIVE_FIRST_SCREEN_ENABLED=false` restores the previous all-screen planning/project-wide asset path.

### 1. Reference Analysis

Function:

```text
analyzeReferenceImage()
```

System prompt:

```text
referenceAnalysisRecreateInstruction
or
referenceAnalysisStyleInstruction
```

User parts:

```text
uploaded image
user prompt
```

Output:

```text
referenceAnalysis
```

This is where the system should learn:

- how many visible screens are in the image
- whether there is bottom nav
- layout structure
- card style
- shadows/radii
- typography feel

Both analysis modes use the same required JSON schema through Gemini `responseJsonSchema`. `primaryNavigation` (including explicit `present: false`), `primaryNavigation.appearance`, `geometryProfile.measurements`, `motifs` (including `[]`), and `designSystemSignals` cannot be omitted. One bounded retry repairs an invalid or missing-evidence response; it is not a second builder pass.

Reference diagnostics keep `scopeConfidence` separate from `visualEvidenceConfidence` and record geometry/navigation/motif completeness. Curated fallback may contribute coarse catalog anatomy/material hints, but never fabricated measurements.

## 2. Creative Direction

Function:

```text
generateCreativeDirection()
```

System prompt:

```text
creativeDirectionInstruction
```

User parts:

```text
prompt
optional image
referenceAnalysis
```

Output:

```text
creativeDirection
```

This gives the project a design personality. It should prevent generic output.

## 3. Design Tokens

Function:

```text
generateDesignTokens()
```

System prompt:

```text
designInstruction
```

User parts:

```text
prompt
optional image
referenceAnalysis
creativeDirection
```

Output:

```text
designTokens
```

These tokens later control:

- colors
- font scale
- spacing
- radius
- shadows
- mobile safe areas
- semantic success/warning/danger/info colors
- project-native navigation geometry and material
- one evidence-gated component radius-role policy

## 4. Planning

Function:

```text
planUiFlow()
```

This now has two LLM calls.

### 4A. Blueprint Call

System prompt:

```text
plannerBlueprintStepInstruction(mode)
```

This combines:

```text
plannerRecreateInstruction OR plannerStyleInstruction
plannerBlueprintJsonContract
extra blueprint rules
```

User parts:

```text
optional image
user prompt
intentContract
screenCountContract
screenFamilyContract
referenceAnalysis
creativeDirection
design token context
existing project context
```

Output:

```text
charter
navigationArchitecture
navigationPlan
```

This call should decide app architecture, not final screen HTML.

Planner-authored transfer decisions may reject or refine a canonical semantic primitive, but target region IDs are recomputed deterministically. Navigation/chrome primitives never enter content-region transfer, and missing compatible regions mean rejection rather than broad fallback.

### 4B. Screen Brief Call

System prompt:

```text
plannerScreenBriefStepInstruction(mode)
```

This combines:

```text
plannerRecreateInstruction OR plannerStyleInstruction
plannerScreensJsonContract
extra screen rules
```

User parts:

```text
same context as blueprint call
approved blueprint from 4A
```

Output:

```text
screens[]
```

Each screen has:

```text
name
type
description
chrome_policy
asset_needs
```

## 5. Screen Build

Function:

```text
buildScreenStream()
```

System prompt:

```text
buildRecreateScreenInstruction(...)
or
buildStyleScreenInstruction(...)
```

Both call private helper:

```text
buildScreenInstruction(input, mode)
```

User parts:

```text
optional image
screen name
original prompt
compact project memory
```

System instruction includes:

```text
screenPlan.description
designTokens
navigationArchitecture
navigationPlan
assetManifest
static HTML rules
sentinel requirement
```

Output:

```text
one complete static HTML screen
```

## Edit Flow

Function:

```text
generateEdit()
```

System prompt:

```text
buildEditSystemInstruction(...)
```

This combines:

```text
editInstruction
strict design contract
token context
navigation architecture contract
buildTypographyRoleContract()
```

User/edit message includes either:

```text
selected element HTML
```

or:

```text
scoped block context
```

Output:

```xml
<edit>
<search>...</search>
<replace>...</replace>
</edit>
```

## Which Prompt To Change For Which Bug

| Bug | Usually inspect/change |
|---|---|
| Wrong number of screens | `planUiFlow`, `intentContract`, `screenCountContract`, planner prompts |
| Bottom nav creating screens | `plannerBlueprintStepInstruction`, `plannerScreenBriefStepInstruction`, `normalizeNavigationPlan` |
| Screens look like different apps | `creativeDirectionInstruction`, `screenFamilyContract`, screen brief rules |
| Generic profile/settings screen | screen brief rules, `screenFamilyContract`, planner context |
| Wrong colors/radius/shadows | `designInstruction`, token generation, strict design contract |
| Bad final HTML layout | `buildScreenInstruction`, screen brief quality |
| Wrong image usage | `asset_needs`, `planVisualAssets`, `buildAssetManifestContract` |
| Edit ignores selected element | `buildEditSystemInstruction`, `generateEdit`, selected element payload |

## Important Notes

- `plannerInstruction` is old single-pass planning. Current live flow uses the two-step planner instead.
- `plannerSharedModeContract`, `plannerBlueprintJsonContract`, and `plannerScreensJsonContract` are not exported, but they matter because exported planner prompts include them.
- Screen builder does not see the whole planner prompt. It sees the final screen brief plus tokens/nav/assets.
- Navigation shell prompts are mostly inline inside `lib/generation/service.ts`, not in `prompts.ts`.
- If something goes wrong, debug the earliest stage that could have caused it. Do not patch the builder for a planner bug.
