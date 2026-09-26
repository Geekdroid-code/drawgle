import { expect, it } from "vitest";
import { preferNewerWorkTrace, readWorkTrace, updateWorkTrace } from "./work-trace";

it("keeps real steps and settles the active step when a turn completes", () => {
  const first = updateWorkTrace(null, { turnId: "turn", id: "review", title: "Reviewing the brief" }, "2026-01-01T00:00:00Z");
  const second = updateWorkTrace(first, { turnId: "turn", id: "flow", title: "Checking the flow", kind: "tool" }, "2026-01-01T00:00:01Z");
  const done = updateWorkTrace(second, { turnId: "turn", id: "flow", title: "Checked the flow", kind: "tool", stepStatus: "completed", turnStatus: "completed" }, "2026-01-01T00:00:02Z");
  expect(done.steps.map(step => step.status)).toEqual(["completed", "completed"]);
  expect(done.status).toBe("completed");
  expect(done.sequence).toBe(3);
});

it("rejects malformed traces and preserves newer realtime progress over stale fetches", () => {
  expect(readWorkTrace({ workTrace: { version: 1, turnId: "turn", sequence: -1, steps: [] } })).toBeNull();
  const old = { metadata: { workTrace: updateWorkTrace(null, { turnId: "turn", id: "one", title: "One" }) } };
  const newer = { metadata: { workTrace: updateWorkTrace(old.metadata.workTrace, { turnId: "turn", id: "two", title: "Two" }) } };
  expect(preferNewerWorkTrace(newer, old)).toBe(newer);
});
