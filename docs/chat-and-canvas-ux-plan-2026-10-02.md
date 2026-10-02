# Chat and canvas: one calm build (plan, 2026-10-02)

The founder recorded UXMagic's Agent Mode building a doctor-booking app from the same brief and the same reference image as a Drawgle catalogue style (`travel-tracker-airy-light`), and shared screenshots of sleek.design's canvas and of Drawgle's own chat. This plan changes only how Drawgle shows what the backend already stores: the chat panel and the canvas. Screen generation, the workers, the API routes, the database and the messages the workers write stay as they are.

## 1. What the recording shows

The recording is 2:33 long. These are its beats, with timestamps:

- **0:03.** The project opens with the agent chat on the right. The composer's hint rotates between "Reference a frame with @", "Paste an image for style ideas" and "Describe what you want to create".
- **0:05.** The brief appears as a grey bubble with the reference thumbnail, and "Analysing query" shows under it.
- **0:16–0:44. One agent block.**
  - An orb sits beside one live line ("Thinking…", "Reading image…", "Planning screens…").
  - Below it is a thin timeline of steps with check circles: Analyze request, Generate project name, Thought process (one paragraph: the plan in the agent's own words), Listed documents, Read image, Read "travel-tracker-airy-light.jpg", Planning screens.
  - The active step is blue with a spinner. A one-line sub-status under it changes ("Mapping flows", "Designing interactions").
- **0:47–1:10. A "Reviewed screens" card.** It has ten rows, each with a drag handle and a checkbox, plus "Reject" and "Approve & generate". The founder unticks three screens.
- **1:11. Approval.**
  - The card folds into a "Planned screens" step with one line of summary.
  - At the same moment, the canvas shows every approved screen as a pale placeholder phone, 390 wide, with its name above and its size below.
  - The camera zooms out to 34% so that all of them are in view.
- **1:15.** "Defining style" becomes "Style defined", with a small card: four colour swatches and the two typefaces ("Aa Inter · heading", "Aa Inter · body").
- **1:23–2:29. One row per screen.**
  - Each row reads "Designing Care Home…" and then "Designed Care Home".
  - A sub-status under the active row changes ("Crafting UI", "Shaping experience", "Defining hierarchy", "Building screen").
  - Each placeholder fills in when its screen is done. Batches never appear anywhere.
- **2:30.** The block collapses to "Generation complete" with one short sentence. The one error (credits ran out) is a single red row with one button.

On UXMagic's canvas the frames are 390 wide and 844 to 951 tall, the names are truncated above the frames, and the frames sit in a tight row. On sleek.design's canvas every screen is a 402×874 phone with device corners. The content scrolls inside the phone and the bottom bar stays pinned, so a whole flow reads as phones side by side.

## 2. What Drawgle shows today

The Roam project (`db58e85c`, 5 screens, built in two batches) as recorded in `project_messages`:

| Time | Message | How it renders |
| --- | --- | --- |
| 03:52:25 | the brief (`product_initial_prompt`) | grey bubble |
| 03:52:32 | planning trace: Reviewing product requirements, Evaluating product scope, Designing screens and flow, Analyzing design direction, Finalizing screen flow, Product design ready | collapsible step list (`WorkTraceCard`) |
| 03:52:36 | "From your brief, I'm shaping this screen flow: - Discovery Feed: …" (`product_flow_preview`) | long assistant text |
| 03:52:56 | "The screen flow is ready to review. Use the approval card to start generation." | assistant text, beside the card it describes |
| — | approval card (`ProductScopeCard`) | white card at the very bottom of the chat, with eleven blocks of text |
| 03:53:30 | "Approved: Design a complete travel ecosystem …" (`product_scope_approved`) | grey bubble, as if the founder typed it |
| 03:53:34 | "Starting the approved flow: 5 screens and 0 states." | assistant text |
| 03:53:47 | batch 1 journal "Created 1 screen" | white card with shadow: seven progress bars, "Show steps", seven phases, and a screen list showing the builder's prompt |
| 03:55:23 | "This batch delivered 1 of 1 approved outputs. Overall flow progress is shown in chat; remaining approved work continues automatically unless paused." | assistant text |
| 03:55:53 | batch 2 journal | merged into the same card |
| 03:57:07 | "This batch delivered 4 of 4 approved outputs. …" | assistant text |
| 03:57:15 | "Completed the approved flow: all 5 screens and states are on this canvas." | assistant text |
| — | "Approved flow" progress (`ProductExecutionCard`) | grey card under everything, outside the conversation |

What is wrong:

1. **One build looks like four different things.** There's a step list, a progress card with seven bars, one text block per batch, and a separate grey card at the bottom.
2. **Batches leak through.** "This batch delivered 1 of 1 approved outputs…" tells the person that a build of five came out as two.
3. **Internal text shows.** The progress card's screen list prints the builder's brief: "SCREEN PURPOSE", "INFORMATION HIERARCHY", and "Contextual profile/settings repair: … Avoid generic interchangeable settings filler".
4. **Lines repeat.** "The screen flow is ready to review…" sits beside the card it describes, and the approval, written as "Approved: <goal>", appears as if the person typed it.
5. **The cards are white with shadows and rings,** which goes against the flat style the founder asked for.
6. **The canvas can't show a flow at phone size.**
   - Frames grow to the full page height, up to 2000px (`ScreenNode.tsx:815`).
   - Only the screen the person double-clicks becomes a scrolling 844px phone ("interact mode").
   - A later batch's screens appear only when that batch starts.

## 3. Principles

- One request gets one agent block with one live line.
- Every row is something Drawgle already stores. Nothing is invented: a sub-status comes from a real phase.
- The timeline never mentions batches, runs or outputs. Progress is a count of screens ("3 of 5").
- Builder prompts never appear in chat. A screen's line comes from the approved flow's own description.
- The design is flat: no white cards with shadows. A state is shown with colour and text weight.
- On the canvas, phone view shows every screen as a phone. Full length stays available for reading and editing whole pages.

## 4. The plan

There are three parts, and each ships as its own pull request, smallest first.

### Part A: phone view on the canvas

- **The toggle.** A "Full length / Phone" switch in the canvas dock (`CanvasToolDock`). The choice is remembered per browser, under a `localStorage` key wrapped in try/catch.
- **What phone view does.**
  - Every frame is 390×844 with device-like corners (about 36px, settled by eye).
  - The page scrolls inside the frame and the shared bottom bar stays pinned, as on a phone. The iframe already supports this as "viewport mode": `html[data-viewport-mode]` in `ScreenNode.tsx`.
- **Interaction stays the same.** Scrolling over the canvas pans and zooms it, and double-clicking a phone lets the person scroll and tap inside it. Full length is exactly what we have today.
- **Positions don't move.** Every screen sits in one row at the same height, 450 apart (`reserve_screen_slots`), so changing frame height never moves a screen. Nothing is written to the database.
- **Code changes.**
  - `CanvasArea.tsx`: node height is 844 in phone view, and the measured height otherwise.
  - `ScreenNode.tsx`: the frame height comes from the mode.
  - `ScreenNode.tsx` again: viewport mode is separated from interact mode. Today `syncIframeInteractionMode` sends both together (`ScreenNode.tsx:639-655`, `:825-829`), so leaving interact mode would also switch phone height off. In phone view, viewport mode stays on for every frame.
- **Risk: picking an element while a phone is scrolled.** The floating delete/duplicate bar is placed from bounds that the iframe reports. We'll check whether it follows the element when the page scrolls. If it doesn't, the iframe script reports bounds on scroll; this lives in the `srcDoc` that `ScreenNode` builds, so it is still frontend code.
- **Tests.**
  - Every frame receives viewport mode in phone view.
  - Leaving interact mode in phone view keeps viewport mode on.
  - Node heights are 844 in phone view, and switching back restores the measured heights.

### Part B: one timeline per request in chat

The new chat is built in two layers.

- **A pure view model,** `lib/agent/flow-timeline.ts`. `buildFlowTimeline({ messages, runs, screens, project })` returns the turns of an approved flow.
  - It only takes over the planning turn of an approved flow and its build.
  - Edits, screen and state proposals, suggestions, questions and recovery cards keep their current builder and components. Later, only their styles change.
- **Components that draw it:** `AgentTurn`, `TimelineStep`, `StyleDefinedCard` and `FlowApprovalCard`.

**The planning turn:**

- The brief appears as one bubble, clamped to four lines with "Show more".
- The agent block's live line is the trace's current step.
- The trace steps become rows. The active row shows its detail as a sub-line ("Mapping user tasks to screens, actions and outcomes").
- A "Thought process" row holds the `product_flow_preview` text, clamped to three lines.
- The block ends with the approval card, inside the block instead of at the bottom of the chat.

**The approval card** keeps the same behaviour and redraws its text:

- "Review your flow", with numbered rows; a row opens to show its one-line description.
- States appear as indented sub-rows.
- One line shows the screen and credit count, followed by "Approve and generate".
- Journeys, outcomes, navigation, assumptions and design direction move into one "Details" section.
- It makes the same `onApprove(revision)` call.

**The build turn:**

- **The approval** appears as a small "You approved 5 screens" chip instead of a bubble with the goal text.
- **The live line** names the screen being designed ("Designing Expense Breakdown…") and shows the count ("3 of 5").
- **The rows:**
  - "Used reference: travel-tracker-airy-light"
  - "Style defined", with a card of colour swatches and the heading and body typefaces from the project's tokens
  - "Planned 5 screens", collapsed
  - then one row per approved screen:
    - queued: muted
    - designing: accent colour and spinner. Its sub-line is the batch's real phase: "Writing the brief", "Preparing images", "Building the screen" or "Finalizing".
    - designed: check
    - couldn't build: cross
    - States are indented under their screen.
- **When it ends:**
  - **Done:** the block collapses to "Generation complete" and "All 5 screens are on the canvas."
  - **Paused:** a footer row ("Paused · 3 of 4 done, 1 couldn't be built" with "Resume") replaces the grey `ProductExecutionCard`, using the same `/product-generation` call.
  - **Stop:** while the flow builds, the composer's send button becomes "Stop", using the same cancel call.
- **What's hidden (still stored):**
  - the per-batch "This batch delivered…" lines (`generation_completion` for product batches)
  - the batch summary cards
  - the coordinator's progress lines, which now set the live line instead
  - "The screen flow is ready to review…"
  - the separate progress card

### Part C: the whole approved flow on the canvas at once

- **Placeholders.**
  - As soon as a flow is approved, every approved screen that isn't on the canvas yet gets a placeholder phone. Placeholders follow the approved order and take the next free slots (`projects.next_screen_x`, plus 450 per screen, at `screen_origin_y`), so each one lands where its screen will appear.
  - A placeholder shows the screen's name above it and a flat tinted fill with a slow shimmer; with reduced motion the fill is still.
  - It vanishes when the real frame appears. Today's real frames already stream the screen in as it is written (`useRealtimeRunWithStreams`).
- **Where the data comes from.**
  - The approval run's manifest (`metadata.productPlanning.scope.manifest`).
  - The approval's `product_output_fulfillments` rows. Their owner can already read them: the "Owners read product fulfillment" policy.
  - The current batch's own preview (`generationPreview`) keeps priority for its screens.
- **When a screen fails** (after the automatic retry from #11), its placeholder shows "Couldn't build" with "Resume".
- **The camera** fits everything once when the flow starts, unless the person moved the camera in the last few seconds.
- **No writes.** Placeholders can't be dragged or selected, and nothing is written.

### Not in this plan: editing the approval list

UXMagic lets the person untick, rename and reorder screens before approving. Drawgle's approval takes the whole scope by revision (`productApproval: { revision }`), so editing the list needs a new backend step to revise the scope. That is backend work, and it's a separate decision.

## 5. Where every row comes from

| Row | Source (already stored) |
| --- | --- |
| Brief bubble | `project_messages`, `role = user`, `action = product_initial_prompt` |
| Planning steps | `metadata.workTrace.steps` (title, detail, status) |
| Thought process | `action = product_flow_preview` content |
| Approval card | `projects.product_planning.scope` (status `proposed`) |
| "You approved N screens" | `action = product_scope_approved`, with N from the approved manifest |
| Used reference | the journal's `reference` phase detail |
| Style defined | `projects.design_tokens`: colour roles and heading and body font families |
| Planned N screens | the approved manifest |
| Each screen's state | the `screens` row (status), the approval's fulfillments (claimed, ready, failed), and the journal's `screens[].status` while its batch plans |
| Designing sub-line | the active journal phase of that screen's batch |
| Live count | `metadata.productProgress` on the approval run, or ready screens |
| Done, paused, credits | the approval run's status and error |

## 6. What does not change

- **Untouched:** `trigger/*`, `lib/generation/*`, `lib/product-planning/*`, `app/api/*`, `supabase/migrations/*`, and every message, run and journal format the workers write. Each part's pull request lists its files, and none of them are in these folders.
- **Two new reads, and no writes:**
  - the approval's `product_output_fulfillments` rows (already readable by their owner)
  - `projects.next_screen_x` and `screen_origin_y`, added to the client project mapper
- **The same calls as today:** approve, resume, stop, retry a screen, and build a suggestion.

## 7. How it is kept from breaking

- **An escape hatch.** The old chat renderers stay for one release behind `?ui=legacy`, so a problem in production is one URL away from the old view, without a revert.
- **Tests on real recordings.** `buildFlowTimeline` is tested on recorded message sequences taken from the database with read-only queries:
  - `db58e85c`: two batches, success
  - `186f32cb`: first batch failed, then retried
  - `8de39a3b`: Image to UI continuing in style
  - `c68403ea`: paused at 1 of 4
  - one edit turn

  It is checked at every message, not just at the end, because rows update in place.
- **A replay page.** `/dev/chat-replay` plays those recordings message by message beside the canvas, so every moment can be checked in the browser without a model call or credits. Like `/dev/canvas-smoke`, it returns "not found" in production.
- **Component tests** cover the approval card (the same `onApprove` call), the paused footer (the same resume call), and phone view (section 4, part A).
- **Before each pull request:**
  - `pnpm run check`, `pnpm exec vitest run`, `pnpm run test:canvas` and `pnpm run build`
  - a browser pass at 1440px and 375px, in light and dark
  - screenshots in the pull request
- **No paid generation is needed to verify.** After deploy, the founder tries one new project.

## 8. Order and decisions

- **Order:** A (phone view, small and isolated), then B (chat timeline), then C (placeholders for the whole flow).
- **Decision 1:** the default canvas view. Recommended: phone view for every project, with full length one click away and the choice remembered.
- **Decision 2:** whether to plan approval-list editing later. It needs backend work.

## 9. What was built (2026-10-02, branch `claude/chat-canvas-ux`)

The founder approved the plan without approval-list editing. Phone view is the default. All three parts shipped in one pull request: they share the step marks and the per-screen claims, so they don't split cleanly. Each part can still be undone without a revert:

- phone view, with the dock's "Full length" button
- the new chat, with `?ui=legacy`

**The marks** (`components/agent/marks.tsx`) follow the founder's request: no stock ticks or spinners, everything one rounded-square family.

- **Done:** a solid ink squircle whose check draws itself, only when the step finishes while the person watches.
- **Up next:** a dotted squircle.
- **Couldn't build:** a soft red squircle.
- **Paused:** a squircle with two bars.
- **In progress:** `Trace` from `loading-dev`, a rounded square drawing itself.
- **The agent working:** `Orbit` from `loading-dev`. It is used in the chat, the composer and the project loading screen. The marketing site keeps its own indicator.

**Differences from the plan, found while building:**

1. **Phone view steps aside while the "Select element" tool is on.** A phone's page can't be scrolled while picking (the wheel pans the canvas, `ScreenNode.tsx`), and picking is editing, which needs the whole page. It comes back with any other tool.
2. **Fit and Focus keep screens clear of the chat panel and the dock** (per-side padding from the measured insets). Before, they could centre a screen behind the chat.
3. **Planned nodes keep React Flow's measurement.**
   - The canvas rebuilt its planned (preview) nodes on every update, which left them hidden.
   - It also told the camera that the nodes weren't ready, so Fit and Focus did nothing while a batch was planning.
   - This was an existing fault, fixed for both the old previews and the new placeholders.
4. **Placeholders show only while the flow builds** (or finishes after Stop). A paused or abandoned flow doesn't leave empty phones on the canvas; its chat block offers Resume.
5. **Stop is the composer's send button while nothing is typed**, and Send again as soon as the person types.

**Checked without generating anything:**

- `scripts/design-eval/export-replay.ts` exports a project read-only to the git-ignored `scripts/design-eval/out/replay/`.
- `/dev/chat-replay`, which is dev only, shows that project's chat and canvas at each moment of a build: planning, review, building, paused, stopped, and as recorded.
- It was checked on Roam (`db58e85c`), at desktop and phone widths, in light and dark.

**Tests:**

- `lib/agent/flow-build.test.ts`: the build view and the grouping of messages.
- `lib/canvas/flow-placeholders.test.ts`
- `hooks/use-canvas-frame-mode.test.ts`
- `components/ScreenNode.frame-mode.test.tsx`
- `components/agent/*.test.tsx`
- `components/PromptBar.stop.test.tsx`
- `components/ChatPanel.flow.test.tsx`: a recorded two-batch build through the real chat, in both the new and the legacy views.
- `components/product-planning/FlowApprovalCard.test.tsx`
