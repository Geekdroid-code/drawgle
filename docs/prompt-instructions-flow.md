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
  -> creates charter + navigation architecture/plan
  |
  v
plannerScreenBriefStepInstruction
  -> creates screen briefs
  |
  v
buildRecreateScreenInstruction / buildStyleScreenInstruction
  -> builds final static HTML for one screen
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
