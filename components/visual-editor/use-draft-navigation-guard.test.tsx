import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDraftNavigationGuard } from "./use-draft-navigation-guard";

function navigationFixture() {
  const navigation = Object.assign(new EventTarget(), { traverseTo: vi.fn(() => ({ finished: Promise.resolve() })) });
  Object.defineProperty(window, "navigation", { configurable: true, value: navigation });
  history.replaceState({ __NA: true, application: "preserve" }, "", "/project/fixture");
  return navigation;
}
function traversal(navigation: EventTarget, overrides = {}) {
  const event = Object.assign(new Event("navigate", { cancelable: true }), {
    navigationType: "traverse", destination: { key: "destination", url: "http://localhost/project/new", sameDocument: true }, ...overrides,
  });
  navigation.dispatchEvent(event); return event;
}
afterEach(() => { cleanup(); vi.restoreAllMocks(); delete (window as Window & { navigation?: unknown }).navigation; });
describe("unsaved browser traversal", () => {
  it("cancels before routing, preserves history, and remains guarded after repeated Cancel", () => {
    const navigation = navigationFixture(); const attempt = vi.fn();
    renderHook(() => useDraftNavigationGuard(true, attempt));
    for (let index = 0; index < 3; index++) expect(traversal(navigation).defaultPrevented).toBe(true);
    expect(attempt).toHaveBeenCalledTimes(3); expect(navigation.traverseTo).not.toHaveBeenCalled();
    expect(location.pathname).toBe("/project/fixture"); expect(history.state).toEqual({ __NA: true, application: "preserve" });
  });
  it("resumes only the chosen traversal after explicit resolution, with a one-use bypass", () => {
    const navigation = navigationFixture(); const attempt = vi.fn();
    renderHook(() => useDraftNavigationGuard(true, attempt));
    traversal(navigation); attempt.mock.calls[0][0]();
    expect(navigation.traverseTo).toHaveBeenCalledWith("destination");
    expect(traversal(navigation).defaultPrevented).toBe(false);
    expect(traversal(navigation).defaultPrevented).toBe(true);
  });
  it("does not intercept clean drafts, push navigation, or same-path changes", () => {
    const navigation = navigationFixture(); const attempt = vi.fn();
    const hook = renderHook(({ dirty }) => useDraftNavigationGuard(dirty, attempt), { initialProps: { dirty: false } });
    expect(traversal(navigation).defaultPrevented).toBe(false); hook.rerender({ dirty: true });
    expect(traversal(navigation, { navigationType: "push" }).defaultPrevented).toBe(false);
    expect(traversal(navigation, { destination: { key: "query", url: "http://localhost/project/fixture?tab=1", sameDocument: true } }).defaultPrevented).toBe(false);
    expect(attempt).not.toHaveBeenCalled();
  });
  it("respects the browser's noncancelable escape and leaves document navigation to beforeunload", () => {
    const navigation = navigationFixture(); const attempt = vi.fn(); renderHook(() => useDraftNavigationGuard(true, attempt));
    const escape = Object.assign(new Event("navigate"), { navigationType: "traverse", destination: { key: "escape", url: "http://localhost/project/new", sameDocument: true } });
    navigation.dispatchEvent(escape); expect(escape.defaultPrevented).toBe(false);
    expect(traversal(navigation, { destination: { key: "document", url: "http://localhost/project/new", sameDocument: false } }).defaultPrevented).toBe(false);
    expect(attempt).not.toHaveBeenCalled();
  });
});
