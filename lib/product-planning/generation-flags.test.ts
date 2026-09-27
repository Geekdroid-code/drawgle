import { afterEach, describe, expect, it, vi } from "vitest";
import { progressiveGenerationEnabled } from "./generation-flags";

describe("progressive generation setting", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("uses progressive generation when the setting is absent", () => {
    vi.stubEnv("DRAWGLE_PROGRESSIVE_GENERATION_ENABLED", undefined);
    expect(progressiveGenerationEnabled()).toBe(true);
  });

  it.each(["false", "off", "0"])("accepts %s as an explicit rollback", value => {
    vi.stubEnv("DRAWGLE_PROGRESSIVE_GENERATION_ENABLED", value);
    expect(progressiveGenerationEnabled()).toBe(false);
  });
});
