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
    expect(navigationEditIntent("change the shared nav color")).toBe("edit");
  });
  it.each(["Make the card premium", "Change the chart tabs", "Keep the nav and redesign the screen", "Change the background without changing navigation", "Redesign the entire screen including the nav", "Make the button the same color as the nav", "Change the header above the nav", "Add a card above the bottom nav"])("leaves unrelated screen edits alone: %s", prompt => {
    expect(navigationEditIntent(prompt)).toBeNull();
  });
});
