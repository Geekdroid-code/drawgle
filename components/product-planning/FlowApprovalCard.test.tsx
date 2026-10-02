import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FlowApprovalCard } from "./FlowApprovalCard";
import { productFixture, designerFixture, functionalFixture } from "@/lib/product-planning/test-fixtures";
import { proposeProductScope } from "@/lib/product-planning/model";
afterEach(cleanup);

// The same promises as the previous card (ProductScopeCard.test.tsx), in the new layout.
describe("flow approval card", () => {
  it("lists what is designed now, names what comes later, and approves only on an explicit click", () => {
    const onApprove = vi.fn(async () => undefined);
    const state = { ...proposeProductScope(productFixture()), revision: 7 };
    render(<FlowApprovalCard state={state} onApprove={onApprove} />);
    expect(screen.getByText("Onboarding")).toBeTruthy();
    expect(screen.getByText("Later: Shop, Cart, Orders")).toBeTruthy();
    expect(onApprove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Approve & generate" }));
    expect(onApprove).toHaveBeenCalledWith(7);
  });

  it("shows the bottom navigation being approved, and which of its areas come later", () => {
    const state = proposeProductScope(productFixture());
    state.scope!.navigation = { persistent: true, rationale: "People move between these four areas.", destinations: [
      { label: "Today", screenKey: "screen:today" }, { label: "Pets", screenKey: "screen:pets" },
      { label: "Routines", screenKey: null }, { label: "Family", screenKey: null }] };
    render(<FlowApprovalCard state={state} onApprove={vi.fn()} />);
    expect(screen.getByText(/Bottom navigation: Today · Pets · Routines · Family/)).toBeTruthy();
    expect(screen.getByText(/Routines, Family come later/)).toBeTruthy();
  });

  it("says so when the flow has no bottom navigation, and says nothing for a flow that never decided", () => {
    const decided = proposeProductScope(productFixture());
    decided.scope!.navigation = { persistent: false, rationale: "One task in one screen.", destinations: [] };
    const { unmount } = render(<FlowApprovalCard state={decided} onApprove={vi.fn()} />);
    expect(screen.getByText("No bottom navigation")).toBeTruthy();
    unmount();
    render(<FlowApprovalCard state={proposeProductScope(productFixture())} onApprove={vi.fn()} />);
    expect(screen.queryByText(/bottom navigation/i)).toBeNull();
  });

  it("can't approve during an active turn, and disappears for a stale proposal", () => {
    const state = proposeProductScope(productFixture());
    state.lease = { id: "active", expiresAt: new Date(Date.now() + 60_000).toISOString() };
    const onApprove = vi.fn();
    const { rerender } = render(<FlowApprovalCard state={state} onApprove={onApprove} />);
    fireEvent.click(screen.getByRole("button", { name: "Approve & generate" }));
    expect(onApprove).not.toHaveBeenCalled();
    rerender(<FlowApprovalCard state={productFixture()} onApprove={onApprove} />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("numbers every screen, counts its states, quotes the cost, and keeps the direction's brief under Details", () => {
    const state = designerFixture();
    const parent = functionalFixture();
    state.scope!.manifest = [parent, ...Array.from({ length: 6 }, (_, index) => functionalFixture(`screen:${index}`, `Screen ${index}`, index + 1)),
      ...Array.from({ length: 4 }, (_, index) => ({ ...functionalFixture(`state:${index}`, `State ${index}`, index + 8), kind: "state" as const,
        parentStableKey: parent.stableKey, stateKey: `state-${index}`, triggerLabel: "Change options", editInstruction: "Show updated options" }))];
    const { container } = render(<FlowApprovalCard state={proposeProductScope(state)} onApprove={vi.fn()} />);
    expect(screen.getByText(/7 screens \+ 4 states · 180 credits/)).toBeTruthy();
    expect(screen.getByText("Screen 5")).toBeTruthy();
    expect(screen.getByText("07")).toBeTruthy();
    expect(screen.getByText("4 states")).toBeTruthy();
    expect(screen.getByText(/State 3: Change options/)).toBeTruthy();
    expect(screen.getByText("Details")).toBeTruthy();
    // the person's own image: its direction's brief, and nothing else of the planner's design notes
    expect(screen.getByText("Design direction")).toBeTruthy();
    expect(screen.getByText("Product-led restrained shopping")).toBeTruthy();
    expect(screen.queryByText("Product then price then action")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
  });

  it("never shows a reference image, the direction written for a catalogue reference, or the planner's assumptions", () => {
    const proposed = proposeProductScope(designerFixture());
    proposed.input = { ...proposed.input, imagePath: null, referenceSource: "curated" };
    const { container } = render(<FlowApprovalCard state={proposed} onApprove={vi.fn()} />);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.queryByText(/reference/i)).toBeNull();
    expect(screen.queryByText("Design direction")).toBeNull();
    expect(screen.queryByText("Product-led restrained shopping")).toBeNull();
    expect(screen.queryByText("Assumptions to review")).toBeNull();
  });

  it("shows the approval's own error and lets the person try again", async () => {
    const onApprove = vi.fn().mockRejectedValueOnce(new Error("Not enough credits")).mockResolvedValueOnce(undefined);
    render(<FlowApprovalCard state={proposeProductScope(productFixture())} onApprove={onApprove} />);
    fireEvent.click(screen.getByRole("button", { name: "Approve & generate" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Not enough credits");
    fireEvent.click(screen.getByRole("button", { name: "Approve & generate" }));
    expect(onApprove).toHaveBeenCalledTimes(2);
  });
});
