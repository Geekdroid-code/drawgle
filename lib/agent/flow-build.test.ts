import { describe, expect, it } from "vitest";

import type { GenerationJournalMetadata, GenerationRunData, ProjectMessage } from "@/lib/types";
import { buildFlowBuildView, readApprovalFromMessage, referenceLine, type FlowFulfillment } from "./flow-build";
import { groupFlowBuilds } from "./flow-messages";

// Shaped after the live Roam project (db58e85c): five screens built as a first single-screen batch and then four.
const ROOT = "root-approval";
const B1 = "batch-1";
const B2 = "batch-2";
const NAMES = ["For You Feed", "Active Trip Planner", "Spot Profile", "Expense Breakdown", "Digital Passport"];
const output = (name: string, index: number) => ({
  stableKey: `screen:${index}`, kind: "screen", name, sequence: index + 1, parentStableKey: null,
  description: `${name} description`,
});
const scope = { goal: "Make travel feel social, visual, and effortless.", status: "approved", manifest: NAMES.map(output), existingOutputs: [] };

let clock = 0;
const message = (partial: Partial<ProjectMessage> & Pick<ProjectMessage, "content">): ProjectMessage => ({
  id: `m${++clock}`, projectId: "p", ownerId: "o", screenId: null, role: "model", messageType: "chat", metadata: {},
  timestamp: new Date(Date.UTC(2026, 9, 2, 3, 50, clock)).toISOString(), ...partial,
});
const run = (id: string, status: GenerationRunData["status"], metadata: Record<string, unknown> = {}, error: string | null = null): GenerationRunData => ({
  id, projectId: "p", ownerId: "o", prompt: "", status, error, metadata: metadata as GenerationRunData["metadata"],
  createdAt: new Date(Date.UTC(2026, 9, 2, 3, id === ROOT ? 53 : id === B1 ? 54 : 55)).toISOString(), updatedAt: "2026-10-02T04:00:00.000Z",
});
const phases = (status: "completed" | "active", reference = "Using curated visual evidence for style direction: travel-tracker-airy-light.") => [
  { id: "brief", label: "Brief received", status: "completed" as const },
  { id: "reference", label: "Reference direction", status: "completed" as const, detail: reference },
  { id: "design", label: "Design system", status: "completed" as const, detail: "Using the approved project design tokens." },
  { id: "build", label: "Screen build", status },
];
const journal = (runId: string, screens: Array<[string, NonNullable<GenerationJournalMetadata["screens"]>[number]["status"]]>, status: GenerationJournalMetadata["status"] = "completed"): GenerationJournalMetadata => ({
  version: 1, generationRunId: runId, status, title: "Created", phases: phases(status === "completed" ? "completed" : "active"),
  activePhase: status === "completed" ? null : "build",
  screens: screens.map(([name, screenStatus]) => ({ name, status: screenStatus, description: "SCREEN PURPOSE: internal brief" })),
});
const journalMessage = (journalValue: GenerationJournalMetadata) => message({
  role: "system", messageType: "generation_completed", content: journalValue.title,
  metadata: { generationRunId: journalValue.generationRunId, activityKey: `run:${journalValue.generationRunId}:journal`, generationJournal: journalValue, ui: { variant: "generation_journal" } },
});

function roamMessages() {
  const approval = message({ role: "user", content: "Approved: Make travel feel social…", metadata: { action: "product_scope_approved", revision: 6, productScope: scope, generationRunId: ROOT } });
  return [
    message({ role: "user", content: "Design Roam, a Gen-Z travel app", metadata: { action: "product_initial_prompt" } }),
    message({ content: "From your brief, I'm shaping this screen flow:", metadata: { action: "product_flow_preview" } }),
    message({ content: "The screen flow is ready to review. Use the approval card to start generation." }),
    approval,
    message({ content: "Starting the approved flow: 5 screens and 0 states.", metadata: { action: "product_generation_progress", generationRunId: ROOT } }),
    journalMessage(journal(B1, [["For You Feed", "ready"]])),
    message({ role: "system", content: "Created 1 screen", metadata: { activityKey: `run:${B1}:summary`, agentStep: { kind: "generation", status: "completed", title: "Created 1 screen" } } }),
    message({ content: "This batch delivered 1 of 1 approved outputs. Overall flow progress is shown in chat; remaining approved work continues automatically unless paused.", metadata: { action: "generation_completion", generationRunId: B1 } }),
    journalMessage(journal(B2, NAMES.slice(1).map((name) => [name, "ready"]))),
    message({ content: "This batch delivered 4 of 4 approved outputs. Overall flow progress is shown in chat; remaining approved work continues automatically unless paused.", metadata: { action: "generation_completion", generationRunId: B2 } }),
    message({ content: "Completed the approved flow: all 5 screens and states are on this canvas.", metadata: { action: "product_generation_progress", generationRunId: ROOT } }),
  ];
}

const roamRuns = (rootStatus: GenerationRunData["status"] = "completed", error: string | null = null) => [
  run(ROOT, rootStatus, { productPlanning: { scope } }, error),
  run(B1, "completed", { productApprovalId: ROOT }),
  run(B2, rootStatus === "completed" ? "completed" : "building", { productApprovalId: ROOT }),
];

const claim = (index: number, status: FlowFulfillment["status"], runId = B2): FlowFulfillment =>
  ({ outputKey: `screen:${index}`, status, screenId: status === "ready" ? `s${index}` : null, generationRunId: runId });

describe("approved-flow builds in chat", () => {
  it("reads the approval message the person's approval left: its root run and every approved screen", () => {
    const approval = readApprovalFromMessage(roamMessages()[3]);
    expect(approval?.id).toBe(ROOT);
    expect(approval?.outputs.map((entry) => entry.name)).toEqual(NAMES);
    expect(approval?.goal).toBe(scope.goal);
  });

  it("folds a two-batch build into one block: no batch lines, no ready notice, one journal per batch", () => {
    const messages = roamMessages();
    const groups = groupFlowBuilds(messages, roamRuns());
    expect([...groups.anchors.values()]).toEqual([ROOT]);
    const build = groups.builds.get(ROOT)!;
    expect(build.journals.map((entry) => entry.generationRunId)).toEqual([B1, B2]);
    expect(build.progress.map((entry) => entry.content)).toHaveLength(2);
    const hidden = messages.filter((entry) => groups.consumed.has(entry.id)).map((entry) => entry.content);
    expect(hidden).toEqual(expect.arrayContaining([
      "The screen flow is ready to review. Use the approval card to start generation.",
      expect.stringMatching(/^This batch delivered 1 of 1/),
      expect.stringMatching(/^This batch delivered 4 of 4/),
      "Created 1 screen",
      expect.stringMatching(/^Starting the approved flow/),
    ]));
    // the planning conversation stays as it was
    expect(groups.consumed.has(messages[0].id)).toBe(false);
    expect(groups.consumed.has(messages[1].id)).toBe(false);
  });

  it("ends a finished build with one sentence and every screen done", () => {
    const build = groupFlowBuilds(roamMessages(), roamRuns()).builds.get(ROOT)!;
    const view = buildFlowBuildView({ approval: build.approval, run: roamRuns()[0], progress: build.progress, journals: build.journals, fulfillments: null });
    expect(view.state).toBe("complete");
    expect(view.title).toBe("Generation complete");
    expect(view.summary).toBe("All 5 screens are on the canvas.");
    expect(view.rows.every((row) => row.status === "done")).toBe(true);
    // a catalogue reference is never named: the person sees the design decisions, not their source
    expect(view.reference).toBe("Formulated design decisions for the UI direction");
    const shown = [view.title, view.summary, view.reference, view.goal, ...view.rows.flatMap((row) => [row.name, row.detail])].join(" ");
    expect(shown).not.toMatch(/travel-tracker|curated|reference/i);
    expect(view.styleDefined).toBe(true);
    expect(view.canResume).toBe(false);
  });

  it("shows each screen of a live batch as it is: done, designing (with its real phase) or waiting", () => {
    const live = journal(B2, [["Active Trip Planner", "building"], ["Spot Profile", "preparing_assets"], ["Expense Breakdown", "planned"], ["Digital Passport", "planned"]], "building");
    const view = buildFlowBuildView({
      approval: readApprovalFromMessage(roamMessages()[3])!, run: run(ROOT, "building"), progress: [{ content: "Starting the approved flow: 5 screens and 0 states." }],
      journals: [journal(B1, [["For You Feed", "ready"]]), live],
      fulfillments: [claim(0, "ready", B1), claim(1, "claimed"), claim(2, "claimed")],
    });
    expect(view.state).toBe("building");
    expect(view.title).toBe("Designing 2 screens");
    expect(view.rows.map((row) => [row.name, row.status, row.detail])).toEqual([
      ["For You Feed", "done", null],
      ["Active Trip Planner", "active", "Building the screen"],
      ["Spot Profile", "active", "Finding images"],
      ["Expense Breakdown", "queued", null],
      ["Digital Passport", "queued", null],
    ]);
    expect([view.done, view.total]).toEqual([1, 5]);
    expect(view.summary).toBeNull();
  });

  it("names the one screen being designed", () => {
    const view = buildFlowBuildView({
      approval: readApprovalFromMessage(roamMessages()[3])!, run: run(ROOT, "building"), progress: [], journals: [journal(B1, [["For You Feed", "briefing"]], "planning")],
      fulfillments: [claim(0, "claimed", B1)],
    });
    expect(view.title).toBe("Designing For You Feed");
    expect(view.rows[0].detail).toBe("Writing the brief");
  });

  it("says a missed screen will be tried again while the flow is still building, then names the retry", () => {
    const approval = readApprovalFromMessage(roamMessages()[3])!;
    const afterBatches = buildFlowBuildView({
      approval, run: run(ROOT, "building"), progress: [{ content: "A batch encountered an error. Checking which approved outputs completed before continuing." }],
      journals: [], fulfillments: [claim(0, "failed", B1), claim(1, "ready"), claim(2, "ready"), claim(3, "ready"), claim(4, "ready")],
    });
    expect(afterBatches.rows[0]).toMatchObject({ status: "failed", detail: "Will try again" });
    expect(afterBatches.title).toBe("Preparing the next screens");
    const retrying = buildFlowBuildView({
      approval, run: run(ROOT, "building"), progress: [{ content: "Retrying the approved outputs that could not be built." }],
      journals: [], fulfillments: [claim(1, "ready"), claim(2, "ready"), claim(3, "ready"), claim(4, "ready")],
    });
    expect(retrying.retrying).toBe(true);
    expect(retrying.title).toBe("Trying the missed screens again");
    expect(retrying.rows[0].status).toBe("queued");
  });

  it("pauses with a plain count and resume when a screen fails twice", () => {
    const view = buildFlowBuildView({
      approval: readApprovalFromMessage(roamMessages()[3])!,
      run: run(ROOT, "failed", {}, "Some approved screens could not be built. Completed screens are kept; resume to retry the failed ones and finish the flow."),
      progress: [], journals: [], fulfillments: [claim(0, "failed", B1), claim(1, "ready"), claim(2, "ready"), claim(3, "ready"), claim(4, "ready")],
    });
    expect(view.state).toBe("paused");
    expect(view.title).toBe("Paused");
    expect(view.summary).toBe("4 of 5 on the canvas. 1 screen couldn't be built; resume to try it again.");
    expect(view.rows[0]).toMatchObject({ status: "failed", detail: null });
    expect(view.error).toBeNull();
    expect(view.canResume).toBe(true);
  });

  it("pauses for credits in the person's words", () => {
    const view = buildFlowBuildView({
      approval: readApprovalFromMessage(roamMessages()[3])!,
      run: run(ROOT, "failed", {}, "Generation paused because the next approved batch needs more credits. Completed work and the remaining scope are saved."),
      progress: [], journals: [], fulfillments: [claim(0, "ready", B1)],
    });
    expect(view.title).toBe("Paused for credits");
    expect(view.summary).toBe("1 of 5 on the canvas. The next screens need more credits.");
    expect(view.rows.slice(1).every((row) => row.status === "skipped")).toBe(true);
  });

  it("shows an unexpected failure's own cleaned message", () => {
    const view = buildFlowBuildView({
      approval: readApprovalFromMessage(roamMessages()[3])!, run: run(ROOT, "failed", {}, "Product execution did not converge"),
      progress: [], journals: [], fulfillments: [], cleanError: (value) => `clean: ${value}`,
    });
    expect(view.pauseReason).toBe("error");
    expect(view.error).toBe("clean: Product execution did not converge");
  });

  it("finishes the screens in progress after Stop, then offers to resume", () => {
    const approval = readApprovalFromMessage(roamMessages()[3])!;
    const stopping = buildFlowBuildView({ approval, run: run(ROOT, "canceled"), progress: [], journals: [], fulfillments: [claim(0, "ready", B1), claim(1, "claimed")] });
    expect(stopping.state).toBe("stopping");
    expect(stopping.title).toBe("Stopping after the screens in progress");
    expect(stopping.canResume).toBe(false);
    const stopped = buildFlowBuildView({ approval, run: run(ROOT, "canceled"), progress: [], journals: [], fulfillments: [claim(0, "ready", B1), claim(1, "ready")] });
    expect(stopped.title).toBe("Stopped");
    expect(stopped.summary).toBe("2 of 5 on the canvas. Resume to build the rest.");
    expect(stopped.canResume).toBe(true);
  });

  it("counts screens an earlier approval built, and words states", () => {
    const withState = {
      ...scope,
      manifest: [...NAMES.slice(0, 2).map(output), { stableKey: "state:1", kind: "state", name: "Trip shared", sequence: 3, parentStableKey: "screen:1" }],
      existingOutputs: [{ item: output(NAMES[0], 0), screenId: "00000000-0000-4000-8000-000000000000" }],
    };
    const approval = readApprovalFromMessage({ metadata: { action: "product_scope_approved", generationRunId: ROOT, productScope: withState } })!;
    const view = buildFlowBuildView({ approval, run: run(ROOT, "completed"), progress: [], journals: [], fulfillments: null });
    expect(view.summary).toBe("All 2 screens and 1 state are on the canvas.");
    const building = buildFlowBuildView({ approval, run: run(ROOT, "building"), progress: [], journals: [], fulfillments: [] });
    expect(building.rows[0].status).toBe("done");
    expect(building.rows[2]).toMatchObject({ kind: "state", parentKey: "screen:1" });
  });

  it("keeps the latest build's block when its approval message is older than the loaded chat", () => {
    const messages = roamMessages().slice(4);
    const groups = groupFlowBuilds(messages, roamRuns("building"));
    expect(groups.unanchored).toEqual([ROOT]);
    expect(groups.builds.get(ROOT)!.approval.outputs).toHaveLength(5);
    expect(groups.builds.get(ROOT)!.journals.map((entry) => entry.generationRunId)).toEqual([B1, B2]);
  });

  it("files an old batch journal under the approval only when it follows it and names only its screens", () => {
    const messages = roamMessages();
    const runs = [run(ROOT, "completed", { productPlanning: { scope } })];
    expect(groupFlowBuilds(messages, runs).builds.get(ROOT)!.journals).toHaveLength(2);

    const afterReply = [...messages.slice(0, 5), message({ role: "user", content: "Make it darker", metadata: { action: "agent_turn_user" } }), ...messages.slice(5)];
    expect(groupFlowBuilds(afterReply, runs).builds.get(ROOT)!.journals).toHaveLength(0);

    const stranger = journalMessage(journal("other-run", [["Settings", "ready"]]));
    const groups = groupFlowBuilds([...messages.slice(0, 5), stranger], runs);
    expect(groups.consumed.has(stranger.id)).toBe(false);
  });

  it("leaves a regular build's completion line in the chat", () => {
    const done = message({ content: "Done - I created 1 screen and added it to the canvas.", metadata: { action: "generation_completion", generationRunId: "single" } });
    expect(groupFlowBuilds([done], []).consumed.size).toBe(0);
  });

  it("reads what the agent looked at, in its own words", () => {
    const readingOf = (detail: string) => [{ ...journal(B1, []), phases: phases("completed", detail) }];
    expect(referenceLine(readingOf("Using the uploaded image as style direction."))).toBe("Read your image for its style");
    expect(referenceLine(readingOf("Using the uploaded image as structural UI evidence."))).toBe("Read your image to copy its screens");
    expect(referenceLine(readingOf("Using the existing project's screens, charter, and design tokens as visual direction."))).toBe("Matched your existing screens");
    expect(referenceLine(readingOf("Using the project's persisted user reference as visual style direction."))).toBe("Read your saved image");
    expect(referenceLine(readingOf("Using curated visual evidence for style direction: crypto-dark-exchange-payment."))).toBe("Formulated design decisions for the UI direction");
    // a detail it doesn't know is never shown as written
    expect(referenceLine(readingOf("Using reference catalogue entry 12 for direction."))).toBeNull();
    expect(referenceLine([])).toBeNull();
  });
});
