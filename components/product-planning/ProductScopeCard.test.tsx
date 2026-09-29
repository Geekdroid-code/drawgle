import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProductScopeCard } from "./ProductScopeCard";
import { productFixture, designerFixture, functionalFixture } from "@/lib/product-planning/test-fixtures";
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
  it("shows the bottom navigation the person is approving, and which of its areas come later", () => {
    const state = proposeProductScope(productFixture());
    state.scope!.navigation = { persistent: true, rationale: "People move between these four areas.", destinations: [
      { label: "Today", screenKey: "screen:today" }, { label: "Pets", screenKey: "screen:pets" },
      { label: "Routines", screenKey: null }, { label: "Family", screenKey: null }] };
    render(<ProductScopeCard state={state} onApprove={vi.fn()} />);
    expect(screen.getByText(/Bottom navigation: Today · Pets · Routines · Family/)).toBeTruthy();
    expect(screen.getByText(/Routines, Family come later/)).toBeTruthy();
  });
  it("says so when the flow has no bottom navigation, and says nothing for a flow that never decided", () => {
    const decided = proposeProductScope(productFixture());
    decided.scope!.navigation = { persistent: false, rationale: "One task in one screen.", destinations: [] };
    const { unmount } = render(<ProductScopeCard state={decided} onApprove={vi.fn()} />);
    expect(screen.getByText("No bottom navigation")).toBeTruthy();
    unmount();
    render(<ProductScopeCard state={proposeProductScope(productFixture())} onApprove={vi.fn()} />);
    expect(screen.queryByText(/bottom navigation/i)).toBeNull();
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
  it("shows the complete parent/state quote and reference-backed direction", () => {
    const state = designerFixture();
    const parent = functionalFixture();
    state.scope!.manifest = [parent, ...Array.from({ length: 6 }, (_, index) => functionalFixture(`screen:${index}`, `Screen ${index}`, index + 1)),
      ...Array.from({ length: 4 }, (_, index) => ({ ...functionalFixture(`state:${index}`, `State ${index}`, index + 8), kind: "state" as const,
        parentStableKey: parent.stableKey, stateKey: `state-${index}`, triggerLabel: "Change options", editInstruction: "Show updated options" }))];
    render(<ProductScopeCard state={proposeProductScope(state)} onApprove={vi.fn()} />);
    expect(screen.getByText(/7 screens \+ 4 states · 180 credits/)).toBeTruthy();
    expect(screen.getByText("Design direction & reference")).toBeTruthy();
    expect(screen.getByText("Screen 5")).toBeTruthy();
    expect(screen.getByText("07")).toBeTruthy();
    expect(screen.getByText(/State 3: Change options/)).toBeTruthy();
  });
});
