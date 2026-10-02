import type { GenerationJournalMetadata } from "@/lib/types";

const metadataRecord = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

const JOURNAL_PHASE_STATUSES = new Set(["pending", "active", "completed", "failed"]);
const JOURNAL_STATUSES = new Set(["queued", "planning", "building", "completed", "failed"]);
const JOURNAL_SCREEN_STATUSES = new Set(["briefing", "planned", "preparing_assets", "queued", "building", "ready", "failed"]);

/** The generation journal a batch run keeps on its chat message, or null when the message has none. */
export const readGenerationJournal = (metadata: Record<string, unknown>): GenerationJournalMetadata | null => {
  const journal = metadataRecord(metadata.generationJournal);
  if (journal.version !== 1) return null;
  if (typeof journal.generationRunId !== "string" || !journal.generationRunId) return null;
  if (typeof journal.title !== "string" || !journal.title.trim()) return null;
  if (typeof journal.status !== "string" || !JOURNAL_STATUSES.has(journal.status)) return null;
  if (!Array.isArray(journal.phases)) return null;

  const phases = journal.phases.flatMap((phaseValue) => {
    const phase = metadataRecord(phaseValue);
    const id = typeof phase.id === "string" ? phase.id : null;
    const label = typeof phase.label === "string" ? phase.label : null;
    const status = typeof phase.status === "string" && JOURNAL_PHASE_STATUSES.has(phase.status) ? phase.status : null;
    if (!id || !label || !status) return [];
    return [{
      id,
      label,
      status: status as GenerationJournalMetadata["phases"][number]["status"],
      detail: typeof phase.detail === "string" ? phase.detail : null,
      startedAt: typeof phase.startedAt === "string" ? phase.startedAt : null,
      completedAt: typeof phase.completedAt === "string" ? phase.completedAt : null,
    }];
  });
  if (!phases.length) return null;

  const screens: GenerationJournalMetadata["screens"] = Array.isArray(journal.screens)
    ? journal.screens.flatMap((screenValue) => {
      const screen = metadataRecord(screenValue);
      const name = typeof screen.name === "string" ? screen.name : null;
      if (!name) return [];
      const type: NonNullable<GenerationJournalMetadata["screens"]>[number]["type"] =
        screen.type === "root" || screen.type === "detail" ? screen.type : null;
      const chrome: NonNullable<GenerationJournalMetadata["screens"]>[number]["chrome"] =
        typeof screen.chrome === "string" ? screen.chrome as NonNullable<GenerationJournalMetadata["screens"]>[number]["chrome"] : null;
      const status = typeof screen.status === "string" && JOURNAL_SCREEN_STATUSES.has(screen.status)
        ? screen.status as NonNullable<GenerationJournalMetadata["screens"]>[number]["status"]
        : "planned";
      return [{
        name,
        type,
        description: typeof screen.description === "string" ? screen.description : null,
        chrome,
        navigationItemId: typeof screen.navigationItemId === "string" ? screen.navigationItemId : null,
        assetNeedCount: typeof screen.assetNeedCount === "number" && Number.isFinite(screen.assetNeedCount) ? screen.assetNeedCount : 0,
        status,
      }];
    })
    : [];

  const assetSummaryRecord = metadataRecord(journal.assetSummary);
  const assetSummary = typeof assetSummaryRecord.requested === "number"
    ? {
      requested: assetSummaryRecord.requested,
      resolved: typeof assetSummaryRecord.resolved === "number" ? assetSummaryRecord.resolved : 0,
      placeholders: typeof assetSummaryRecord.placeholders === "number" ? assetSummaryRecord.placeholders : 0,
      failures: typeof assetSummaryRecord.failures === "number" ? assetSummaryRecord.failures : 0,
    }
    : null;

  return {
    version: 1,
    generationRunId: journal.generationRunId,
    status: journal.status as GenerationJournalMetadata["status"],
    title: journal.title,
    detail: typeof journal.detail === "string" ? journal.detail : null,
    activePhase: typeof journal.activePhase === "string" ? journal.activePhase : null,
    phases,
    screens,
    assetSummary,
  };
};
