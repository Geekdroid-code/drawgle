import type { GenerationJournalMetadata } from "@/lib/types";

export function transitionGenerationJournalPhase(
  journal: GenerationJournalMetadata,
  phaseId: string,
  status: GenerationJournalMetadata["phases"][number]["status"],
  detail?: string | null,
  changedAt = new Date().toISOString(),
) {
  const targetIndex = journal.phases.findIndex((phase) => phase.id === phaseId);
  journal.phases = journal.phases.map((phase, index) => {
    if (phase.id === phaseId) {
      return {
        ...phase,
        status,
        detail: detail ?? phase.detail ?? null,
        startedAt: phase.startedAt ?? changedAt,
        completedAt: status === "completed" || status === "failed" ? changedAt : null,
      };
    }
    if (phase.status === "active") {
      return index < targetIndex
        ? { ...phase, status: "completed" as const, completedAt: phase.completedAt ?? changedAt }
        : { ...phase, status: "pending" as const };
    }
    return phase;
  });
  if (detail !== undefined) journal.detail = detail;

  if (status === "active") {
    journal.activePhase = phaseId;
    return;
  }
  if (status === "failed") {
    journal.activePhase = null;
    return;
  }

  const nextPhase = journal.phases.find((phase, index) => index > targetIndex && phase.status === "pending");
  if (!nextPhase) {
    journal.activePhase = null;
    return;
  }
  journal.phases = journal.phases.map((phase) =>
    phase.id === nextPhase.id
      ? { ...phase, status: "active", startedAt: phase.startedAt ?? changedAt }
      : phase,
  );
  journal.activePhase = nextPhase.id;
}
