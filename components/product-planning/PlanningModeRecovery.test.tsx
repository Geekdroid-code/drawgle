import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PlanningModeRecovery } from "./PlanningModeRecovery";
afterEach(cleanup);
it("recovers without automatic turn/reload loops and keeps a retry identity", async () => {
  const onSubmit = vi.fn(async (_input: unknown) => false);
  render(<PlanningModeRecovery active onSubmit={onSubmit} />);
  expect(onSubmit).not.toHaveBeenCalled();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Continue planning" })));
  expect(screen.getByRole("alert")).toBeTruthy();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Continue planning" })));
  expect(onSubmit.mock.calls[0][0]).toEqual(onSubmit.mock.calls[1][0]);
  expect(onSubmit.mock.calls[0][0]).not.toHaveProperty("productAnswers");
});
it("does not reactivate obsolete history", () => {
  render(<PlanningModeRecovery active={false} onSubmit={vi.fn()} />);
  expect(screen.queryByRole("button")).toBeNull();
});
