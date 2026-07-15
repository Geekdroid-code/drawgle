import { describe, expect, it } from "vitest";

import { shouldEnableSpatialCraft } from "@/lib/generation/spatial-craft-routing";

describe("spatial craft routing", () => {
  it.each(["internal_style", "user_style", "curated_style"] as const)(
    "enables construction planning for new %s projects",
    (referenceMode) => {
      expect(shouldEnableSpatialCraft({ referenceMode, isNewProject: true })).toBe(true);
    },
  );

  it("keeps literal image recreation governed by reference pixels", () => {
    expect(shouldEnableSpatialCraft({ referenceMode: "user_recreate", isNewProject: true })).toBe(false);
  });

  it("does not retrofit a legacy project unless it already owns a craft blueprint", () => {
    expect(shouldEnableSpatialCraft({ referenceMode: "internal_style", isNewProject: false })).toBe(false);
  });
});
