# Prompt Instructions Flow

This document explains how `lib/generation/prompts.ts` is used across the generation pipeline.

Think of the file as a prompt library with three layers:

- **Planning prompts** decide what the product is, how many screens exist, and what each screen brief says.
- **Design/build prompts** turn the plan into design tokens and static HTML.
- **Edit/navigation prompts** modify existing screen HTML or shared navigation.

Not every constant in `prompts.ts` is sent to the LLM by itself. Many are fragments that get combined into a larger system instruction.

## High-Level Creation Flow

When a user creates a project with `/api/generations`, the flow is:

1. `app/api/generations/route.ts`
   - Uploads the prompt image if present.
   - Creates a `generation_runs` row.
   - Triggers `trigger/generate-ui-flow.ts`.

2. `trigger/generate-ui-flow.ts`
   - Loads the image and project context.
   - Calls `generateDesignTokens`.
   - Calls `planUiFlow`.
   - Builds or refines shared navigation with `buildNavigationShellCode`.
   - Resolves bitmap assets with `planVisualAssets`.
   - Builds each screen with `buildScreenStream`.

3. `lib/generation/service.ts`
   - Owns most LLM calls.
   - Imports prompt builders/constants from `prompts.ts`.
   - Combines system prompts with user parts like prompt text, image, reference analysis, token context, current project context, and approved blueprint.

## Main LLM Calls

| LLM call | Function | System instruction from `prompts.ts` | User/input parts |
|---|---|---|---|
| Reference image analysis | `analyzeReferenceImage` | `referenceAnalysisRecreateInstruction` or `referenceAnalysisStyleInstruction` | Uploaded image, style/recreate note, user/product intent |
| Creative direction | `generateCreativeDirection` | `creativeDirectionInstruction` | Optional image, prompt, reference analysis |
| Design tokens | `generateDesignTokens` | `designInstruction` | Optional image, prompt, reference analysis, creative direction |
| Project blueprint | `planUiFlow` | `plannerBlueprintStepInstruction(mode)` | Optional image, user prompt, screen count contract, intent contract, screen family contract, reference analysis, creative direction, token context, project context |
| Screen briefs | `planUiFlow` | `plannerScreenBriefStepInstruction(mode)` | Same planning parts plus approved project blueprint |
| Screen HTML build | `buildScreenStream` | `buildRecreateScreenInstruction(...)` or `buildStyleScreenInstruction(...)` | Optional reference image, build request, original prompt, compact project memory |
| Selected/region edit | `generateEdit` | `buildEditSystemInstruction(...)` | Chat history plus selected element HTML or scoped block context |
| Navigation shell refine | `refineNavigationShellCode` | Inline system instruction in `service.ts`, not `prompts.ts` | Prompt, charter, creative direction, navigation plan, token context, candidate nav HTML |
| Navigation shell edit | `editNavigationShellCode` | Inline system instruction in `service.ts`, not `prompts.ts` | User nav edit request, charter, navigation plan, token context, current nav HTML |

## Prompt Constants and Helpers

### `plannerInstruction`

Status: **legacy / currently unused**

This is the old single-pass planner prompt. It asks for everything in one response:

- navigation architecture
- navigation plan
- charter
- screen briefs

Current code does not import or call it outside `prompts.ts`. The modern flow uses the two-step planner:

- `plannerBlueprintStepInstruction`
- `plannerScreenBriefStepInstruction`

You can treat `plannerInstruction` as historical context unless the code is changed to use it again.

### `plannerSharedModeContract`

Status: **private fragment used by planner mode prompts**

This is not exported, and it is not sent alone. It is prepended inside:

- `plannerRecreateInstruction`
- `plannerStyleInstruction`

Purpose:

- establishes the planner identity as a mobile UX architect
- requires valid JSON
- requires product-wide consistency
- tells the planner to use a 390px mobile viewport
- requires builder-ready screen brief labels:
  - `Reference DNA`
  - `Visual Goal`
  - `Layout Anatomy`
  - `Key Components`
  - `Visual Styling`
  - `Interaction Notes`
  - `Must Preserve`

### `plannerBlueprintJsonContract`

Status: **private fragment used by `plannerBlueprintStepInstruction`**

This is not sent alone. It defines the exact JSON shape for the blueprint step:

- `requires_bottom_nav`
- `navigation_architecture`
- `navigation_plan`
- `charter`

Important: this step should not return screens. It defines product architecture and navigation policy.

### `plannerScreensJsonContract`

Status: **private fragment used by `plannerScreenBriefStepInstruction`**

This is not sent alone. It defines the exact JSON shape for screen briefs:

- `screens[]`
- `name`
- `type`
- `description`
- `chrome_policy`
- `asset_needs`

This is where the planner can request images/assets for a screen, such as product cutouts, avatars, photos, or map textures.

### `plannerRecreateInstruction`

Status: **exported mode prompt fragment**

Used by:

- `plannerBlueprintStepInstruction("recreate")`
- `plannerScreenBriefStepInstruction("recreate")`

It combines:

- `plannerSharedModeContract`
- recreate-mode rules

Purpose:

- tells the planner that the uploaded image is structural evidence
- says the image is a blueprint, not loose inspiration
- asks the planner to preserve visible structure, layout order, containment, spacing, depth, and nav treatment

It is not usually used directly as the full system prompt. It is wrapped by the blueprint/screen-brief prompt builders.

### `plannerStyleInstruction`

Status: **exported mode prompt fragment**

Used by:

- `plannerBlueprintStepInstruction("style")`
- `plannerScreenBriefStepInstruction("style")`

It combines:

- `plannerSharedModeContract`
- style-reference rules

Purpose:

- tells the planner that the reference is only visual DNA
- allows borrowing material quality, shadows, radii, typography, icon weight, color rhythm, and nav feel
- forbids copying exact layout, domain content, values, and screenshot structure

### `plannerBlueprintStepInstruction(mode)`

Status: **active exported system-prompt builder**

Used in:

- `planUiFlow`
- LLM log label: `plan-ui-flow-blueprint`
- model policy task: `project_planning`

It combines:

- `plannerRecreateInstruction` or `plannerStyleInstruction`
- `plannerBlueprintJsonContract`
- blueprint rules

This is the first planner pass. It asks the LLM for:

- project charter
- navigation architecture
- navigation plan

It should not create screen briefs. The screen slate is constrained by the user prompt, intent contract, and screen count contract passed as user parts.

### `plannerScreenBriefStepInstruction(mode)`

Status: **active exported system-prompt builder**

Used in:

- `planUiFlow`
- LLM log label: `plan-ui-flow-screen-briefs`
- model policy task: `project_planning`

It combines:

- `plannerRecreateInstruction` or `plannerStyleInstruction`
- `plannerScreensJsonContract`
- screen-brief rules

This is the second planner pass. It receives the earlier blueprint as a user part:

```text
Approved Project Blueprint:
{ ... }
```

Then it returns only `screens`.

The final `planUiFlow` result is produced by merging:

- parsed blueprint
- parsed screen briefs
- screen count enforcement
- navigation normalization
- screen family contract appended to briefs

### `creativeDirectionInstruction`

Status: **active exported system prompt**

Used in:

- `generateCreativeDirection`
- LLM log label: creative-direction generation inside planning/design token calls
- model policy task: `project_planning`

Purpose:

- creates an art-direction thesis for the project
- tries to prevent generic AI UI
- outputs:
  - `conceptName`
  - `styleEssence`
  - `colorStory`
  - `typographyMood`
  - `surfaceLanguage`
  - `iconographyStyle`
  - `compositionPrinciples`
  - `signatureMoments`
  - `motionTone`
  - `avoid`

This creative direction is then reused by:

- planner prompts
- design token generation
- screen-family contract
- screen builder through the screen description/project charter

### `referenceAnalysisInstruction`

Status: **base exported prompt, used through recreate instruction**

Used by:

- `referenceAnalysisRecreateInstruction`

Purpose:

- reverse-engineers an uploaded mobile UI screenshot
- asks for visible screen count
- describes screen anatomy, hierarchy, components, styling cues, interaction cues, copy patterns, and implementation notes

The current recreate analysis system prompt is:

```text
referenceAnalysisInstruction + MODE LOCK: USER_RECREATE
```

### `referenceAnalysisRecreateInstruction`

Status: **active exported system prompt**

Used in:

- `analyzeReferenceImage` when `referenceMode` is `user_recreate`
- model policy task: `project_planning`

Purpose:

- treats the uploaded image as structural evidence
- extracts visible layout anatomy, layer order, containment, spacing, depth, and component construction

This analysis is later passed into:

- creative direction generation
- design token generation
- project planning
- fallback screen planning
- screen family contract

### `referenceAnalysisStyleInstruction`

Status: **active exported system prompt**

Used in:

- `analyzeReferenceImage` when reference mode is style or curated style
- model policy task: `project_planning`

Purpose:

- extracts reusable visual DNA only
- prevents copying the exact screenshot layout
- outputs a similar JSON structure to recreate analysis, but the meaning is different: style, not structure

### `designInstruction`

Status: **active exported system prompt**

Used in:

- `generateDesignTokens`
- LLM log label: `design-tokens`
- model policy task: `design_tokens`

Purpose:

- turns prompt, image/reference analysis, and creative direction into the Drawgle design-token schema
- returns colors, typography, spacing, mobile layout, sizing, radii, borders, shadows, semantic roles, and metadata

The generated tokens become the project design system and are later passed into:

- planner token context
- screen builder token context
- edit prompts
- navigation shell prompts

### `editInstruction`

Status: **active base exported edit prompt**

Used by:

- `buildEditSystemInstruction`

It is not used alone in current code. It defines the XML edit-block format:

```xml
<edit>
<search>...</search>
<replace>...</replace>
</edit>
```

Purpose:

- tells the LLM to return only precise code patches
- prevents whole-file rewrites
- prevents phone frames/status bars
- tells selected edits to stay within provided context

### `buildEditSystemInstruction(...)`

Status: **active exported system-prompt builder**

Used in:

- `generateEdit`
- model policy task: `selected_region_edit`

It combines:

- `editInstruction`
- strict design contract
- token context
- navigation architecture contract
- typography role contract
- static HTML safety rules

The user message sent with it depends on edit mode:

- if the user selected an element, the message includes `SELECTED ELEMENT` HTML
- otherwise it includes scoped block context from the block index

### `buildRecreateScreenInstruction(...)`

Status: **active exported system-prompt builder**

Used in:

- `buildScreenStream` when `referenceMode` is `user_recreate`
- model policy task: `screen_build`

It calls the private `buildScreenInstruction(input, "recreate")`.

Purpose:

- builds one static HTML screen
- treats attached image as structural evidence
- enforces the screen brief, tokens, navigation architecture, asset manifest, static HTML rules, and final sentinel

### `buildStyleScreenInstruction(...)`

Status: **active exported system-prompt builder**

Used in:

- `buildScreenStream` when reference mode is style/curated style
- `buildFullScreenReconstructionCode`
- some repair/reconstruction flows

It calls the private `buildScreenInstruction(input, "style")`.

Purpose:

- builds one static HTML screen from screen brief, charter, tokens, and style DNA
- does not require copying the reference layout

### `buildSystemInstruction`

Status: **legacy alias**

Defined as:

```ts
export const buildSystemInstruction = buildRecreateScreenInstruction;
```

Current code does not import it. It exists as a compatibility alias for older code that expected a generic build-system prompt.

## Important Private Prompt Helpers

These are not exported, but they materially affect LLM behavior because exported prompt builders include them.

### `styleReferenceInstruction`

Used when an image is style-only.

Appears in:

- reference analysis
- creative direction
- design token generation
- screen build when a style image is attached

Purpose:

- use image for polish/material/design DNA only
- do not copy layout positions or content

### `userRecreateReferenceInstruction`

Used by:

- `buildScreenStream` when a recreate image is attached

Purpose:

- tells the screen builder that the image is structural evidence for the screen
- reinforces exact layout/layer/navigation treatment recreation

### `buildStrictDesignContract(designTokens)`

Used inside:

- `buildEditSystemInstruction`
- `buildScreenInstruction`

Purpose:

- converts approved design tokens into hard rules
- tells the LLM to use token utilities and CSS variables instead of random hex/pixel values

### `buildTypographyRoleContract()`

Used inside:

- `buildEditSystemInstruction`

Purpose:

- forces edits to preserve semantic typography roles
- prevents random font-size/weight drift during edits

It is not currently included directly in the screen builder prompt, but the builder gets typography guidance through the strict design contract and token context.

### `buildAssetManifestContract(assetManifest)`

Used inside:

- `buildScreenInstruction`

Purpose:

- tells the screen builder which bitmap URLs are allowed
- forbids invented image URLs
- requires critical non-placeholder assets
- tells placeholders to be rendered as CSS surfaces, not fake image tags
- enforces asset role compatibility, for example avatars must not use product/hero cutouts

### `buildNavigationArchitectureContract(...)`

Used inside:

- `buildEditSystemInstruction`
- `buildScreenInstruction`

Purpose:

- explains app navigation architecture
- tells the builder whether this screen should have bottom tabs, top bar, back button, modal treatment, or immersive chrome

### `buildScreenInstruction(input, mode)`

Private function behind:

- `buildRecreateScreenInstruction`
- `buildStyleScreenInstruction`

This is the big screen-builder system prompt. It combines:

- screen name/type/description
- recreate or style mode instruction
- strict screen fidelity rules
- design token contract
- navigation architecture contract
- approved asset manifest
- token context
- static HTML output rules
- sentinel requirement

This is the prompt that most directly controls generated HTML quality.

## What Gets Combined In Each Major Call

### Reference analysis call

System:

- recreate: `referenceAnalysisRecreateInstruction`
- style: `referenceAnalysisStyleInstruction`

User parts:

- uploaded image
- optional style-reference reminder
- `User/Product Intent: "..."`

Output:

- structured reference analysis JSON

### Creative direction call

System:

- `creativeDirectionInstruction`

User parts:

- optional image
- optional style-reference reminder
- `Product Brief: "..."`
- reference analysis, if available

Output:

- creative direction JSON

### Design token call

System:

- `designInstruction`

User parts:

- optional image
- optional style-reference reminder
- `User Prompt & Design Constraints`
- reference analysis
- creative direction

Output:

- design token JSON

### Planning blueprint call

System:

- `plannerBlueprintStepInstruction("recreate")` for recreate mode
- `plannerBlueprintStepInstruction("style")` for style/curated mode

User parts:

- optional image in recreate mode
- user prompt
- screen count contract
- generation intent contract
- screen family contract
- finite-flow warning, if detected
- reference analysis
- creative direction
- approved token context
- current project context
- single-screen planning note, if adding one screen

Output:

- blueprint JSON with charter and navigation architecture/plan

### Planning screen-brief call

System:

- `plannerScreenBriefStepInstruction("recreate")` or `"style"`

User parts:

- all blueprint call user parts
- approved project blueprint JSON

Output:

- screen brief JSON

Then code merges blueprint + screen briefs, applies screen-count enforcement, normalizes navigation, appends screen-family requirements to descriptions, and returns `PlannedUiFlow`.

### Screen build call

System:

- recreate: `buildRecreateScreenInstruction(...)`
- style: `buildStyleScreenInstruction(...)`

User parts:

- optional image
- recreate/style reference reminder
- build request for one screen
- original project prompt
- compact existing project memory, if present

Output:

- full static HTML screen
- must end with `DRAWGLE_GENERATION_COMPLETE_SENTINEL`

### Selected/region edit call

System:

- `buildEditSystemInstruction(...)`

Chat/history:

- previous messages converted into Gemini chat history

Latest edit message:

- selected element HTML, if available
- otherwise scoped block context
- user edit request
- current screen code/context

Output:

- XML `<edit>` blocks

## Practical Maintainer Notes

- `plannerInstruction` is old and unused. The live planner is two-step.
- `plannerSharedModeContract`, `plannerBlueprintJsonContract`, and `plannerScreensJsonContract` are private fragments, but they are important because the exported planner builders include them.
- The screen builder does not see the full planner prompt. It sees the final `screenPlan.description`, token context, navigation architecture, and asset manifest.
- Navigation shell generation is mostly outside `prompts.ts`; it uses inline prompts in `service.ts`.
- A prompt can affect later calls indirectly. Example: `creativeDirectionInstruction` output is not HTML, but it changes the planner, token generation, and screen-family contract.
- If a generated screen looks off-brand, check the chain in this order:
  1. reference analysis
  2. creative direction
  3. design tokens
  4. screen family contract
  5. screen brief
  6. screen build prompt
- If the wrong number of screens is planned, do not patch screen-builder prompts. The source is `planUiFlow`, intent contract, screen count contract, and planner prompts.
- If images are wrong, inspect `asset_needs`, `planVisualAssets`, `assetManifest`, and `buildAssetManifestContract`.
