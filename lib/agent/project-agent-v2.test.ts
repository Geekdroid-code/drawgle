import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { normalizeScreenReference, resolveScreenReference } from "@/lib/agent/project-tools";
import { isProjectAgentV2Enabled } from "@/lib/env/server";
import { buildScreenSummaryLocally } from "@/lib/generation/embeddings";
import { shouldPersistMessageMemory } from "@/lib/generation/message-memory";

const screens = [
  { id: "11111111-1111-4111-8111-111111111111", name: "Home Screen", prompt: "Main restoration dashboard", summary: "Recent work cards and restoration tools", status: "ready" },
  { id: "22222222-2222-4222-8222-222222222222", name: "Photo Library", prompt: "Browse restored memories", summary: "Searchable photo grid", status: "ready" },
];

describe("project-aware agent V2 contracts", () => {
  const originalPercent = process.env.DRAWGLE_AGENT_V2_ROLLOUT_PERCENT;
  const originalAllowlist = process.env.DRAWGLE_AGENT_V2_PROJECT_ALLOWLIST;

  afterEach(() => {
    process.env.DRAWGLE_AGENT_V2_ROLLOUT_PERCENT = originalPercent;
    process.env.DRAWGLE_AGENT_V2_PROJECT_ALLOWLIST = originalAllowlist;
  });

  it("resolves natural screen names and aliases to stable ids", () => {
    expect(normalizeScreenReference("The HOME screen")).toBe("the home");
    expect(resolveScreenReference("Home", screens).screen?.id).toBe(screens[0].id);
    expect(resolveScreenReference(screens[1].id, screens).screen?.name).toBe("Photo Library");
  });

  it("returns candidates instead of inventing a screen", () => {
    const result = resolveScreenReference("checkout", screens);
    expect(result.status).toBe("missing");
    expect(result.screen).toBeNull();
  });

  it("builds a searchable local retrieval document without raw markup", () => {
    const summary = buildScreenSummaryLocally("Home", `
      <main class="min-h-screen bg-white">
        <header><h1>Bring your memories back</h1></header>
        <section data-section="recent-work"><h2>Recent work</h2><button aria-label="Restore photo">Restore</button></section>
      </main>
    `, "Photo restoration home dashboard");
    expect(summary).toContain("Bring your memories back");
    expect(summary).toContain("Recent Work");
    expect(summary).toContain("Restore photo");
    expect(summary).not.toContain("<main");
  });

  it("skips trivial and transient message embeddings", () => {
    expect(shouldPersistMessageMemory("hello", "user")).toBe(false);
    expect(shouldPersistMessageMemory("Queued edit for Home", "system")).toBe(false);
    expect(shouldPersistMessageMemory("Reuse the recent cards from Home in Library", "user")).toBe(true);
  });

  it("uses deterministic percentage rollout with an explicit allowlist override", () => {
    process.env.DRAWGLE_AGENT_V2_ROLLOUT_PERCENT = "0";
    process.env.DRAWGLE_AGENT_V2_PROJECT_ALLOWLIST = screens[0].id;
    expect(isProjectAgentV2Enabled(screens[0].id)).toBe(true);
    expect(isProjectAgentV2Enabled(screens[1].id)).toBe(false);
    process.env.DRAWGLE_AGENT_V2_ROLLOUT_PERCENT = "100";
    expect(isProjectAgentV2Enabled(screens[1].id)).toBe(true);
  });
});
