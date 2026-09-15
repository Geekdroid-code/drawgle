import { describe, expect, it, vi } from "vitest";

import { buildFirstScreenPriorityBatches, runRollingBuilds } from "@/lib/generation/build-scheduler";

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

describe("rolling builds", () => {
  it("waits for the anchor then fills each freed slot without a wave barrier", async () => {
    const started: number[] = []; const release = new Map<number, () => void>();
    let active = 0, peak = 0;
    const run = runRollingBuilds([0, 1, 2, 3, 4], async item => {
      started.push(item); active++; peak = Math.max(peak, active);
      await new Promise<void>(resolve => release.set(item, resolve)); active--;
    }, { anchorFirst: true, concurrency: 2 });
    await vi.waitFor(() => expect(started).toEqual([0]));
    release.get(0)!(); await vi.waitFor(() => expect(started).toEqual([0, 1, 2]));
    release.get(2)!(); await vi.waitFor(() => expect(started).toEqual([0, 1, 2, 3]));
    release.get(3)!(); await vi.waitFor(() => expect(started).toEqual([0, 1, 2, 3, 4]));
    release.get(1)!(); release.get(4)!(); await run;
    expect(peak).toBe(2);
  });
  it("starts two reference frames immediately and stops new work on cancellation", async () => {
    const started: number[] = []; const releases: Array<() => void> = [];
    let canceled = false;
    const run = runRollingBuilds([0, 1, 2], async item => { started.push(item); await new Promise<void>(resolve => releases.push(resolve)); }, {
      anchorFirst: false, canStart: async () => !canceled,
    });
    await vi.waitFor(() => expect(started).toEqual([0, 1])); canceled = true;
    releases.forEach(release => release()); await run; expect(started).toEqual([0, 1]);
  });
});
