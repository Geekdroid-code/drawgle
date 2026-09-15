The fixes need to change execution rules and product data—not just prompts. After inspecting both projects and the code, this is the plan I recommend.

**What the projects confirmed**

- The habit tracker generated a separate “Incremental Log State” mainly to change progress values.
- Its blueprint incorrectly marked “premium, technical tool for high-performance habit tracking” as user-confirmed, using only “Build me a premium habit tracker app” as evidence.
- Its three generation batches ran sequentially, taking about **5 minutes 52 seconds** overall.
- The recreation approval correctly retained `recreate` mode and identified frame 2. But frame 2 was classified as a state and sent through **clone-and-edit without reference pixels**. The source’s floating payment pills became a conventional bottom sheet.

**1. Make additional state frames manual, while preserving complete product flows**

For new prompt/reference projects:

- Stop automatically adding separately generated states to the roadmap, approval quote and generation queue.
- Keep ordinary behavior—counter updates, validation, selection, loading and feedback—as requirements on the parent screen.
- Keep substantial product tasks in the main screen flow. Creating a habit must still have a usable interface; removing automatic states must not remove that capability.
- Never disguise an unnecessary state as another main screen to bypass this rule.
- Where a specifically requested overlay is necessary, record its behavior and clearly distinguish it from a separately rendered canvas frame.

Enforce this in `functional-tools.ts`, `functional-store.ts`, scope validation and the worker. Disabling default checkboxes alone is insufficient.

Drawgle currently generates static HTML. This change must not claim that recording an interaction requirement makes the prototype fully functional.

**2. Add “Create state” to each screen’s canvas menu**

Extend the existing **More actions** menu in `ScreenNode`, with a small dialog connected through `CanvasArea` and `ProjectShell`.

The dialog contains:

- The selected parent screen.
- One textbox: “Describe the state you want.”
- The credit cost.
- **Create state** and Cancel.

The submitted request should reuse the existing state proposal, approval and build services, extracting shared backend logic where necessary. It should not require another chat approval after the user clicks the priced creation button.

Backend guarantees:

- Validate ownership and the ready parent.
- Bind the request to the parent’s current revision.
- Preserve the parent’s layout and unrelated content.
- Use a stable request identity to prevent duplicate generation or charges.
- Preserve the dialog draft if another generation is running.
- Keep activity in `project_messages`, maintaining the same conversation.

Chat can direct users to this control; it should no longer autonomously propose extra state frames. Existing generated states remain editable.

**3. Separate a frame’s relationship from how it is rendered**

This fixes recreation at its actual failure point.

A screenshot can depict a state of another screen **and still require direct image recreation**. Currently, `kind: state` forces the editing pipeline.

Introduce a small, explicit rendering distinction:

- **Reference frame:** build directly from its supplied image evidence.
- **Derived state:** edit an existing parent from the user’s state request.
- **Product screen:** build from the approved product and visual context.

For recreation:

- Every requested source frame retains its source index and reference hash through approval, execution and retry.
- Supplied state frames use the image-aware builder, never the text-only state editor.
- Preserve parent/state grouping on the canvas independently of rendering strategy.
- Validate source coverage across **all frames**, not just items classified as main screens.
- Product assumptions, shared navigation and first-screen continuity must not override an explicitly supplied frame.
- Keep the immutable approved mode authoritative during retries; the project’s later mutable mode is not historical evidence.

For your payment example, frame 2 must retain the floating pills, visible wallet card and blurred background—not invent a bottom sheet.

**4. Ground product language in the actual audience**

There are two separate fixes here.

First, strengthen fact validation in `designer-patch.ts`. Finding a quotation inside a user message does not prove it supports the entire fact. Validate new “user-confirmed” claims against their cited evidence. Split or downgrade unsupported additions before they become authoritative product truth.

Second, maintain a compact product content direction through existing incremental blueprint updates:

- Audience and appropriate terminology.
- Tone and reading level.
- Consistent names for entities and actions.
- Representative, plausible content and measurements.

References govern visual craft. A security-app reference must not turn a habit tracker into a security console.

Pass a compiled content contract explicitly into screen planning, building, state creation and retries. It must survive context truncation and retry paths that currently discard `projectContext`.

Add a focused semantic review of planned copy and claims. For an ordinary habit app, “Add habit,” “Today” and “Weekly progress” fit; “COMMIT PROTOCOL” and fabricated sampling-rate claims do not. This is audience-based validation, not a universal ban on technical language.

**5. Use bounded parallel building and prepare briefs ahead**

Two existing bottlenecks matter:

- `nextProductBatch()` selects only one parent plus its states.
- The worker already supports two concurrent screen builds, but those single-parent batches prevent it from helping.

Change scheduling to:

- Select multiple eligible main screens within one child generation run.
- Keep one active child run, preserving existing database and credit safeguards.
- Establish shared tokens, navigation and content direction once.
- Preserve the first-screen anchor for a new visual system; prepare subsequent briefs while that screen builds.
- After the anchor is ready, keep up to two eligible screen builds running, starting the next when a slot becomes free.
- With a suitable existing anchor, start two eligible screens immediately.
- For exact recreation, each frame’s reference is authoritative; do not impose an unnecessary first-screen design dependency.

Also correct false dependencies: **a user navigating from onboarding to a dashboard does not mean dashboard generation depends on onboarding generation**.

Persist prepared briefs against approval, reference and shared-context revisions so retries can reuse them safely. Audit the worker’s remaining five-screen slicing before expanding batches; execution limits must never truncate approved work.

**6. Roll out with explicit regression gates**

Implementation order: output/rendering contracts → manual-state UX → recreation routing → evidence/content grounding → scheduling → live evaluation.

Required checks:

- No unsolicited paid state outputs in new product scopes.
- Manual state requests preserve parents and charge once.
- Required product tasks remain represented.
- Every supplied recreation frame receives its actual image evidence.
- Unsupported “technical audience” claims cannot become user-confirmed facts.
- Screen builds overlap where eligible, without duplicate outputs, shared-context races or credit errors.
- Cancellation, retries and existing projects continue working.

Already-approved runs must retain their original outputs and prices. Changed drafts require a refreshed scope—not silent deletion of states.

Founder's job: Finally, rerun these two examples and several different product domains. Review complete flows, visible copy, reference fidelity, time to first screen and total completion time. Those live results—not unit tests alone—should determine launch readiness.

This is the final fix plan; no runtime changes or deployment were made during this planning pass.