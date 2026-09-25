import { describe, expect, it } from "vitest";
import { acceptedScreenFamily } from "./accepted-screen-family";

describe("accepted screen visual family", () => {
  it("captures reusable treatments without copying the anchor layout or content", () => {
    const family = acceptedScreenFamily(`<main class="bg-white px-5 py-6 gap-4 font-sans text-sm rounded-xl">
      <h1 class="font-semibold text-xl">Today</h1><button class="bg-violet-600 rounded-full px-5 py-3 font-semibold">Add chore</button>
      <svg class="size-5 stroke-2"></svg></main>`, "Today", null);
    expect(family?.surfaces).toContain("bg-violet-600");
    expect(family?.typography).toContain("font-semibold");
    expect(family?.spacing).toContain("px-5");
    expect(family?.consistencyRules.join(" ")).toContain("Controls");
    expect(JSON.stringify(family)).not.toContain("Add chore");
  });
});
