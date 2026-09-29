import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ProductPlanningRecovery } from "./ProductPlanningRecovery";
import { readPlanningFailure } from "@/lib/product-planning/tool-failure";
afterEach(cleanup);

it("offers the way forward without repeating the failure or calling an outage a flow review", () => {
  render(<ProductPlanningRecovery active onSubmit={vi.fn()} failure={{
    stage: "proposal", code: "PROPOSAL_UNAVAILABLE_HTTP_503", retryable: true,
    summary: "Drawgle's design service didn't respond, so the screen flow wasn't drafted.",
  }} />);
  expect(screen.getByText(/Continue from where planning stopped/)).toBeTruthy();
  expect(screen.queryByText(/design service didn't respond/)).toBeNull();
  expect(screen.queryByText(/Screen-flow review:/)).toBeNull();
});

it("resumes explicitly without generation approval or automatic requests", async () => {
  const onSubmit = vi.fn(async (_input: unknown) => false);
  const view = render(<ProductPlanningRecovery active onSubmit={onSubmit} />);
  expect(onSubmit).not.toHaveBeenCalled();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Continue screen design" })));
  expect(onSubmit.mock.calls[0][0]).toMatchObject({ continueProductPlanning: true, prompt: "Continue screen design" });
  expect(onSubmit.mock.calls[0][0]).not.toHaveProperty("approve");
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Continue screen design" })));
  expect(onSubmit.mock.calls[0][0]).toEqual(onSubmit.mock.calls[1][0]);
  view.rerender(<ProductPlanningRecovery active={false} onSubmit={onSubmit} />);
  expect(screen.queryByRole("button")).toBeNull();
});

it("supports the already-saved incident message and ignores ordinary messages", () => {
  expect(readPlanningFailure({ productTurnComplete: "turn" }, "I’ve saved the product decisions, but couldn’t finish validating the screen flow.")).toMatchObject({ retryable: true });
  expect(readPlanningFailure({}, "I can help plan this app")).toBeNull();
});

it("offers a screen-design continuation for an old implementation question", async () => {
  const onSubmit = vi.fn(async (_input: unknown) => true);
  const view = render(<ProductPlanningRecovery active implementationQuestion onSubmit={onSubmit} />);
  expect(screen.getByText(/questions are not needed for screen design/)).toBeTruthy();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Continue screen design" })));
  expect(onSubmit.mock.calls[0][0]).toMatchObject({ continueProductPlanning: true });
  // The click is an interface action; it never carries a synthetic instruction into the conversation.
  expect((onSubmit.mock.calls[0][0] as { prompt: string }).prompt).toBe("Continue screen design");
  view.rerender(<ProductPlanningRecovery active={false} implementationQuestion onSubmit={onSubmit} />);
  expect(screen.queryByText(/questions are not needed for screen design/)).toBeNull();
});
