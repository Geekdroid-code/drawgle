import { describe, expect, it } from "vitest";

import { transitionGenerationJournalPhase } from "@/lib/generation/journal";
import type { GenerationJournalMetadata } from "@/lib/types";

const journal = (): GenerationJournalMetadata => ({
  version: 1,
  generationRunId: "run-1",
  status: "planning",
  title: "Planning",
  detail: "Starting",
  activePhase: "brief",
  phases: [
    { id: "brief", label: "Brief", status: "active", startedAt: "t0" },
    { id: "design", label: "Design", status: "pending" },
    { id: "assets", label: "Assets", status: "pending" },
  ],
});

describe("generation journal transitions", () => {
  it("keeps exactly one phase active and advances detail and timestamps", () => {
    const value = journal();
    transitionGenerationJournalPhase(value, "brief", "completed", "Brief ready", "t1");

    expect(value.detail).toBe("Brief ready");
    expect(value.activePhase).toBe("design");
    expect(value.phases.filter((phase) => phase.status === "active")).toHaveLength(1);
    expect(value.phases[0]).toMatchObject({ completedAt: "t1", status: "completed" });
    expect(value.phases[1]).toMatchObject({ startedAt: "t1", status: "active" });
  });

  it("closes the active phase without activating another phase on failure", () => {
    const value = journal();
    transitionGenerationJournalPhase(value, "design", "failed", "Design failed", "t2");

    expect(value.activePhase).toBeNull();
    expect(value.phases.filter((phase) => phase.status === "active")).toHaveLength(0);
    expect(value.phases[1]).toMatchObject({ completedAt: "t2", status: "failed" });
  });
});
