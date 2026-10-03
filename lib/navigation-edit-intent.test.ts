import { describe, expect, it } from "vitest";
import { navigationEditIntent } from "./navigation-edit-intent";

describe("navigation edit routing", () => {
  it.each([
    "add the bottom nav into this screen",
    "create bottom navigation",
    "why the hell you create the new Nav.. why didn't you used the premium nav used in Health Board screen. its wrong to use different Navs in an app",
    "Use the same navigation on Training Tracker",
  ])("reuses accepted navigation: %s", prompt => expect(navigationEditIntent(prompt)).toBe("reuse"));
  it.each(["create a new premium nav with modern style", "redesign the existing bottom nav", "make the existing nav premium", "improve the shared nav", "make this better"])("recognizes an actual redesign: %s", prompt => {
    expect(navigationEditIntent(prompt, true)).toBe("redesign");
  });
  it("does not mistake an edit to shared navigation for a reuse request", () => {
    expect(navigationEditIntent("change the shared nav color")).toBe("restyle");
  });
  it("reads something creative as a redesign", () => {
    expect(navigationEditIntent("create a new premium nav wiht modern style. something creative")).toBe("redesign");
  });
  it.each(["add a profile tab to the nav", "remove the history tab", 'rename "Today" to "Habits"'])("recognizes a tab change: %s", prompt => {
    expect(navigationEditIntent(prompt, true)).toBe("destinations");
  });
  it("reads a wish for a premium nav with more tabs as a redesign, without a nav selection", () => {
    expect(navigationEditIntent("i want a premium Nav. and more tabs as per screens")).toBe("redesign");
  });
  it.each(["add more tabs to the nav", "the nav needs fewer tabs"])("reads more or fewer tabs as a tab change: %s", prompt => {
    expect(navigationEditIntent(prompt)).toBe("destinations");
  });
  it("reads wanting the nav on a named screen as reuse", () => {
    expect(navigationEditIntent("I need the nav on the profile screen")).toBe("reuse");
    expect(navigationEditIntent("redesign the nav for the habit screen")).toBe("redesign");
  });
  it("still reads adding a tab bar to a screen as reuse", () => {
    expect(navigationEditIntent("add the tab bar to this screen")).toBe("reuse");
  });
  it.each(["Make the card premium", "Change the chart tabs", "Keep the nav and redesign the screen", "Change the background without changing navigation", "Redesign the entire screen including the nav", "Make the button the same color as the nav", "Change the header above the nav", "Add a card above the bottom nav"])("leaves unrelated screen edits alone: %s", prompt => {
    expect(navigationEditIntent(prompt)).toBeNull();
  });
});
