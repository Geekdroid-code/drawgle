import { describe, expect, it, vi } from "vitest";

import { buildCompleteSpecimen, SpecimenIncompleteError } from "@/lib/generation/specimen-build";
import type { BuildScreenInput } from "@/lib/types";

const input = { screenPlan: { name: "Player", type: "root", description: "A player" }, specimenMarking: true } as unknown as BuildScreenInput;
const SENTINEL = "<!-- DRAWGLE_GENERATION_COMPLETE -->";
const whole = `<div class="dg-bg-primary"><p>Done</p></div>
${SENTINEL}`;
/** The tail of the second mindfulness build: it stopped in the middle of a closing tag. */
const stopsMidTag = '<div class="dg-bg-primary"><div data-dg-component="media-card"><div class="flex"><svg viewBox="0 0 24 24"><path d="M12 2"/></svg></';

describe("buildCompleteSpecimen", () => {
  it("returns a build that finished, after one attempt", async () => {
    const build = vi.fn(async () => ({ code: whole, rawText: "raw" }));
    const built = await buildCompleteSpecimen(build, input);
    expect(build).toHaveBeenCalledTimes(1);
    expect(built).toEqual({ code: whole, rawText: "raw" });
  });

  it("asks once more when the build stopped mid-tag, and returns the second", async () => {
    const codes = [stopsMidTag, whole];
    const build = vi.fn(async () => ({ code: codes.shift()! }));
    const seen: Array<[string, number]> = [];
    const built = await buildCompleteSpecimen(build, input, { onIncomplete: (issue, attempt) => seen.push([issue, attempt]) });
    expect(build).toHaveBeenCalledTimes(2);
    expect(built.code).toBe(whole);
    expect(seen).toHaveLength(1);
    expect(seen[0][1]).toBe(1);
  });

  it("treats a build with no completion sentinel as unfinished, even when its tags are closed", async () => {
    const build = vi.fn(async () => ({ code: '<div class="dg-bg-primary"><p>Looks done</p></div>' }));
    await expect(buildCompleteSpecimen(build, input)).rejects.toBeInstanceOf(SpecimenIncompleteError);
    expect(build).toHaveBeenCalledTimes(2);
  });

  it("gives up after two unfinished builds, with an error that says the build was cut short", async () => {
    const build = vi.fn(async () => ({ code: stopsMidTag }));
    await expect(buildCompleteSpecimen(build, input)).rejects.toThrow("the build was cut short");
    expect(build).toHaveBeenCalledTimes(2);
  });

  it("does not retry a build that fails outright: that error is the caller's", async () => {
    const build = vi.fn(async () => { throw new Error("provider down"); });
    await expect(buildCompleteSpecimen(build, input)).rejects.toThrow("provider down");
    expect(build).toHaveBeenCalledTimes(1);
  });
});
