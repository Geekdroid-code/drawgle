import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { updateWorkTrace } from "@/lib/agent/work-trace";
import { WorkTraceCard } from "./WorkTraceCard";
import { GenerationJournalCard } from "./GenerationJournalCard";
import type { GenerationJournalMetadata } from "@/lib/types";

afterEach(cleanup);

it("shows only saved work, remains expandable after completion, and does not invent tool output", () => {
  const started = updateWorkTrace(null, { turnId: "turn", id: "flow", title: "Checking screen flow", detail: "Mapping visible routes." });
  const view = render(<WorkTraceCard trace={started} />);
  expect(screen.getByRole("button", { name: /Checking screen flow/ }).getAttribute("aria-expanded")).toBe("true");
  expect(screen.getByText("Mapping visible routes.")).toBeTruthy();

  const done = updateWorkTrace(started, { turnId: "turn", id: "flow", title: "Checked screen flow", kind: "tool", stepStatus: "completed", turnStatus: "completed" });
  view.rerender(<WorkTraceCard trace={done} />);
  expect(screen.getByRole("button", { name: /Checked screen flow/ }).getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(screen.getByRole("button", { name: /Checked screen flow/ }));
  expect(screen.getAllByText("Checked screen flow").length).toBe(2);
  expect(screen.queryByText(/thought process/i)).toBeNull();
});

it("keeps generation progress compact and reveals actual screen details on request", () => {
  const journal: GenerationJournalMetadata = {
    version: 1, generationRunId: "run", status: "building", title: "Building screens",
    phases: [{ id: "brief", label: "Screen brief", status: "completed" }, { id: "render", label: "Render check", status: "active", detail: "Checking layout" }],
    screens: [{ name: "Today", type: "root", chrome: null, status: "building", description: "Family schedule and actions", assetNeedCount: 0 }],
  };
  render(<GenerationJournalCard journal={journal} />);
  expect(screen.getAllByText("Checking layout").length).toBeGreaterThan(0);
  expect(screen.getByText("Today")).toBeTruthy();
  expect(screen.getByText("Today").closest("details")?.open).toBe(false);
  fireEvent.click(screen.getByText("Today"));
  expect(screen.getByText("Today").closest("details")?.open).toBe(true);
  expect(screen.getByText("Family schedule and actions")).toBeTruthy();
});
