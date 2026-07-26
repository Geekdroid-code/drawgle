import { describe, expect, it } from "vitest";

import { buildFirstScreenPriorityBatches } from "@/lib/generation/build-scheduler";

describe("first-screen priority scheduler", () => {
  it("runs the first screen alone and bounds later parent batches to two", () => {
    expect(buildFirstScreenPriorityBatches(["one", "two", "three", "four", "five"])).toEqual([
      ["one"],
      ["two", "three"],
      ["four", "five"],
    ]);
  });

  it("handles empty and single-screen plans without extra batches", () => {
    expect(buildFirstScreenPriorityBatches([])).toEqual([]);
    expect(buildFirstScreenPriorityBatches(["one"])).toEqual([["one"]]);
  });
});
