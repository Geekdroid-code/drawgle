import { describe, expect, it } from "vitest";

import { resolveBuilderProviderIdentity } from "@/lib/generation/builder-diagnostics";

describe("builder provider diagnostics", () => {
  it("records the selected Luna/OpenRouter builder independently from Gemini planning", () => {
    expect(resolveBuilderProviderIdentity({
      provider: "openrouter",
      requestedModel: "openai/gpt-5.6-luna",
      observedModels: ["openai/gpt-5.6-luna"],
    })).toEqual({
      provider: "openrouter",
      requestedModel: "openai/gpt-5.6-luna",
      actualModel: "openai/gpt-5.6-luna",
      fallbackUsed: false,
    });
  });

  it("reports the model that actually completed after provider fallback", () => {
    expect(resolveBuilderProviderIdentity({
      provider: "openrouter",
      requestedModel: "openai/gpt-5.6-luna",
      observedModels: ["openai/gpt-5.6-luna", "google/gemini-3-flash-preview"],
    })).toMatchObject({
      actualModel: "google/gemini-3-flash-preview",
      fallbackUsed: true,
    });
  });
});
