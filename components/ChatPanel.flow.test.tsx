import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({ createClient: () => { throw new Error("The recorded chat must not reach the database."); } }));

import { ChatPanel } from "./ChatPanel";
import type { GenerationJournalMetadata, GenerationRunData, ProjectData, ProjectMessage } from "@/lib/types";

// A recorded approved flow, shaped after the live Roam project (db58e85c): five screens built as one, then four.
const ROOT = "root-approval";
const NAMES = ["For You Feed", "Active Trip Planner", "Spot Profile", "Expense Breakdown", "Digital Passport"];
const scope = {
  goal: "Make travel feel social.", status: "approved", existingOutputs: [],
  manifest: NAMES.map((name, index) => ({ stableKey: `screen:${index}`, kind: "screen", name, sequence: index + 1, parentStableKey: null })),
};
let clock = 0;
const message = (partial: Partial<ProjectMessage> & Pick<ProjectMessage, "content">): ProjectMessage => ({
  id: `m${++clock}`, projectId: "p", ownerId: "o", screenId: null, role: "model", messageType: "chat", metadata: {},
  timestamp: new Date(Date.UTC(2026, 9, 2, 3, 50, clock)).toISOString(), ...partial,
});
const journal = (runId: string, names: string[]): GenerationJournalMetadata => ({
  version: 1, generationRunId: runId, status: "completed", title: `Created ${names.length} screens`, detail: `Delivered ${names.length} screens to the canvas.`,
  phases: [{ id: "build", label: "Screen build", status: "completed" }], screens: names.map((name) => ({ name, status: "ready" })),
});
const journalMessage = (value: GenerationJournalMetadata) => message({
  role: "system", messageType: "generation_completed", content: value.title,
  metadata: { generationRunId: value.generationRunId, activityKey: `run:${value.generationRunId}:journal`, generationJournal: value, ui: { variant: "generation_journal" } },
});
const messages = [
  message({ role: "user", content: "Design Roam, a Gen-Z travel app", metadata: { action: "product_initial_prompt" } }),
  message({ content: "The screen flow is ready to review. Use the approval card to start generation." }),
  message({ role: "user", content: "Approved: Make travel feel social.", metadata: { action: "product_scope_approved", productScope: scope, generationRunId: ROOT } }),
  message({ content: "Starting the approved flow: 5 screens and 0 states.", metadata: { action: "product_generation_progress", generationRunId: ROOT } }),
  journalMessage(journal("b1", NAMES.slice(0, 1))),
  message({ content: "This batch delivered 1 of 1 approved outputs. Overall flow progress is shown in chat; remaining approved work continues automatically unless paused.", metadata: { action: "generation_completion", generationRunId: "b1" } }),
  journalMessage(journal("b2", NAMES.slice(1))),
  message({ content: "This batch delivered 4 of 4 approved outputs. Overall flow progress is shown in chat; remaining approved work continues automatically unless paused.", metadata: { action: "generation_completion", generationRunId: "b2" } }),
  message({ content: "Completed the approved flow: all 5 screens and states are on this canvas.", metadata: { action: "product_generation_progress", generationRunId: ROOT } }),
];
const run = (id: string, metadata: Record<string, unknown>): GenerationRunData => ({
  id, projectId: "p", ownerId: "o", prompt: "", status: "completed", metadata: metadata as GenerationRunData["metadata"],
  createdAt: "2026-10-02T03:53:00Z", updatedAt: "2026-10-02T03:57:00Z",
});
const runs = [run(ROOT, { productPlanning: { scope } }), run("b1", { productApprovalId: ROOT }), run("b2", { productApprovalId: ROOT })];
const project: ProjectData = { id: "p", userId: "o", name: "Roam", prompt: "", status: "completed", createdAt: "2026-10-02", updatedAt: "2026-10-02" };

const renderChat = () => render(
  <ChatPanel project={project} screens={[]} selectedScreen={null} generationRun={null} generationRuns={runs}
    recordedMessages={messages} flowFulfillments={{ approvalId: ROOT, fulfillments: null }}
    isQueueing={false} isCollapsed={false} onCollapseChange={() => undefined} />,
);

describe("an approved flow in the chat", () => {
  afterEach(() => { cleanup(); window.history.replaceState({}, "", "/"); });

  it("is one build block: no batch lines, no pointer at the card, no approval posing as a message", () => {
    renderChat();
    expect(screen.getByText("Design Roam, a Gen-Z travel app")).toBeTruthy();
    expect(screen.getByText("Generation complete")).toBeTruthy();
    expect(screen.getByText("All 5 screens are on the canvas.")).toBeTruthy();
    expect(screen.queryByText(/This batch delivered/)).toBeNull();
    expect(screen.queryByText(/The screen flow is ready to review/)).toBeNull();
    expect(screen.queryByText(/Starting the approved flow/)).toBeNull();
    expect(screen.queryByText(/Completed the approved flow/)).toBeNull();
    expect(screen.queryByText("Approved: Make travel feel social.")).toBeNull();
    expect(screen.queryByText("Created 4 screens")).toBeNull();
  });

  it("has no old view to fall back to, and no Design.md tab", () => {
    window.history.replaceState({}, "", "/?ui=legacy");
    renderChat();
    expect(screen.getByText("Generation complete")).toBeTruthy();
    expect(screen.queryByText(/This batch delivered/)).toBeNull();
    expect(screen.getByText("Chat")).toBeTruthy();
    expect(screen.getByText("Design")).toBeTruthy();
    expect(screen.queryByText("Design.md")).toBeNull();
  });
});
