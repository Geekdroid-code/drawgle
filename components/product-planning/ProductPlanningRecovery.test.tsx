import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ProductPlanningRecovery } from "./ProductPlanningRecovery";
import { readPlanningFailure } from "@/lib/product-planning/tool-failure";
afterEach(cleanup);

it("resumes explicitly without generation approval or automatic requests", async () => {
  const onSubmit = vi.fn(async (_input: unknown) => false);
  const view = render(<ProductPlanningRecovery active onSubmit={onSubmit} />);
  expect(onSubmit).not.toHaveBeenCalled();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Continue planning" })));
  expect(onSubmit.mock.calls[0][0]).toMatchObject({ continueProductPlanning: true });
  expect(onSubmit.mock.calls[0][0]).not.toHaveProperty("approve");
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Continue planning" })));
  expect(onSubmit.mock.calls[0][0]).toEqual(onSubmit.mock.calls[1][0]);
  view.rerender(<ProductPlanningRecovery active={false} onSubmit={onSubmit} />);
  expect(screen.queryByRole("button")).toBeNull();
});

it("supports the already-saved incident message and ignores ordinary messages", () => {
  expect(readPlanningFailure({ productTurnComplete: "turn" }, "I’ve saved the product decisions, but couldn’t finish validating the screen flow.")).toMatchObject({ retryable: true });
  expect(readPlanningFailure({}, "I can help plan this app")).toBeNull();
});
