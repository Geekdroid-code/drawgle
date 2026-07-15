import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { matchCuratedStyleReference } from "@/lib/generation/curated-style-references";

describe("curated style reference matching", () => {
  it("does not attach a universal finance image to a low-confidence prompt", () => {
    expect(matchCuratedStyleReference({ prompt: "Build an app for my community" })).toBeNull();
  });

  it("still returns a curated image for a confident domain match", () => {
    const match = matchCuratedStyleReference({
      prompt: "Create a premium mobile banking dashboard with balance, transactions and transfer actions",
    });

    expect(match).not.toBeNull();
    expect(match?.score).toBeGreaterThanOrEqual(12);
  });
});
