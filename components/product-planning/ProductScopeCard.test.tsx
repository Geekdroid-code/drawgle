import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProductScopeCard } from "./ProductScopeCard";
import { productFixture } from "@/lib/product-planning/test-fixtures";
import { proposeProductScope } from "@/lib/product-planning/model";
afterEach(cleanup);
describe("product scope approval card", () => {
  it("shows design-now and later separately and only approves on an explicit click", () => {
    const onApprove = vi.fn(async () => undefined);
    const state = { ...proposeProductScope(productFixture()), revision: 7 };
    render(<ProductScopeCard state={state} onApprove={onApprove} />);
    expect(screen.getByText("Onboarding")).toBeTruthy();
    expect(screen.getByText("Later: Shop, Cart, Orders")).toBeTruthy();
    expect(onApprove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Approve & generate" }));
    expect(onApprove).toHaveBeenCalledWith(7);
  });
  it("disables approval during an active turn and removes stale proposals", () => {
    const state = proposeProductScope(productFixture());
    state.lease = { id: "active", expiresAt: new Date(Date.now() + 60_000).toISOString() };
    const onApprove = vi.fn();
    const { rerender } = render(<ProductScopeCard state={state} onApprove={onApprove} />);
    fireEvent.click(screen.getByRole("button", { name: "Approve & generate" }));
    expect(onApprove).not.toHaveBeenCalled();
    rerender(<ProductScopeCard state={productFixture()} onApprove={onApprove} />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
