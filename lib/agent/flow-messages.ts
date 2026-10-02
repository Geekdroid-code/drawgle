import type { GenerationJournalMetadata, GenerationRunData, ProjectMessage } from "@/lib/types";
import { readGenerationJournal } from "./generation-journal";
import {
  isFlowReadyNotice,
  isProductApprovalRun,
  isProductBatchCompletion,
  productApprovalIdOf,
  readApprovalFromMessage,
  readApprovalFromRun,
  type FlowApproval,
} from "./flow-build";

export type FlowBuildGroup = {
  approval: FlowApproval;
  /** The approval message the build block replaces; null when that message is older than the loaded chat. */
  anchorMessageId: string | null;
  /** The coordinator's progress lines, oldest first. */
  progress: ProjectMessage[];
  /** One journal per batch run, in the order the batches started. */
  journals: GenerationJournalMetadata[];
};

export type FlowBuildGroups = {
  /** Approval id → its build. */
  builds: Map<string, FlowBuildGroup>;
  /** Approval message id → approval id: where each build block goes. */
  anchors: Map<string, string>;
  /** Messages the build blocks stand in for; the chat doesn't show them on their own. */
  consumed: Set<string>;
  /** Folded message id → the build it belongs to, where that is known. */
  owners: Map<string, string>;
  /** Builds whose approval message isn't loaded, newest last: their block goes where their first message was. */
  unanchored: string[];
};

const text = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : null;
const sameName = (left: string, right: string) => left.trim().toLowerCase() === right.trim().toLowerCase();

/**
 * Sorts the chat's messages into approved-flow builds. A batch's journal belongs to an approval when its run says so
 * (the runs loaded with the chat), or, for older batches whose run isn't loaded, when it follows the approval with no
 * message from the person in between and names only the approval's own screens and states.
 */
export function groupFlowBuilds(messages: ProjectMessage[], runs: GenerationRunData[]): FlowBuildGroups {
  const runById = new Map(runs.map((run) => [run.id, run]));
  const builds = new Map<string, FlowBuildGroup>();
  const anchors = new Map<string, string>();
  const consumed = new Set<string>();
  const owners = new Map<string, string>();
  const unanchored: string[] = [];
  const journalsByBuild = new Map<string, Map<string, GenerationJournalMetadata>>();

  const buildFor = (approvalId: string, approval: FlowApproval | null, anchorMessageId: string | null) => {
    let build = builds.get(approvalId);
    if (!build) {
      const known = approval ?? (runById.get(approvalId) ? readApprovalFromRun(runById.get(approvalId)!) : null);
      if (!known) return null;
      build = { approval: known, anchorMessageId, progress: [], journals: [] };
      builds.set(approvalId, build);
      journalsByBuild.set(approvalId, new Map());
      if (!anchorMessageId) unanchored.push(approvalId);
    } else if (anchorMessageId && !build.anchorMessageId) {
      build.anchorMessageId = anchorMessageId;
      unanchored.splice(unanchored.indexOf(approvalId), 1);
    }
    return build;
  };

  let windowApprovalId: string | null = null;
  for (const message of messages) {
    const action = text(message.metadata.action);
    const approval = readApprovalFromMessage(message);
    if (approval) {
      if (buildFor(approval.id, approval, message.id)) {
        anchors.set(message.id, approval.id);
        windowApprovalId = approval.id;
      }
      continue;
    }
    if (message.role === "user") {
      windowApprovalId = null;
      continue;
    }
    if (action === "product_generation_progress") {
      const approvalId = text(message.metadata.generationRunId);
      const build = approvalId ? buildFor(approvalId, null, null) : null;
      if (build) {
        build.progress.push(message);
        consumed.add(message.id);
        owners.set(message.id, approvalId!);
      }
      continue;
    }
    const journal = readGenerationJournal(message.metadata);
    if (journal) {
      const linked = productApprovalIdOf(runById.get(journal.generationRunId));
      let approvalId = linked && buildFor(linked, null, null) ? linked : null;
      if (!approvalId && !runById.has(journal.generationRunId) && windowApprovalId) {
        const outputs = builds.get(windowApprovalId)?.approval.outputs ?? [];
        const names = journal.screens ?? [];
        if (names.length && names.every((screen) => outputs.some((output) => sameName(output.name, screen.name)))) {
          approvalId = windowApprovalId;
        }
      }
      if (approvalId) {
        journalsByBuild.get(approvalId)!.set(journal.generationRunId, journal);
        consumed.add(message.id);
        owners.set(message.id, approvalId);
      }
      continue;
    }
    if (isProductBatchCompletion(message) || isFlowReadyNotice(message)) {
      consumed.add(message.id);
      continue;
    }
    // A product batch's own summary card says what its journal already said.
    const activity = text(message.metadata.activityKey);
    const summaryRun = activity?.match(/^run:([^:]+):summary$/)?.[1];
    if (summaryRun && (productApprovalIdOf(runById.get(summaryRun)) || [...journalsByBuild.values()].some((journals) => journals.has(summaryRun)))) {
      consumed.add(message.id);
    }
  }

  // The latest approval always has a block, even when its approval message is older than the loaded chat: it holds
  // the build's progress and its resume and stop controls.
  const latestRoot = runs.filter((run) => isProductApprovalRun(run))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
  if (latestRoot) buildFor(latestRoot.id, null, null);

  for (const [approvalId, build] of builds) {
    build.journals = [...journalsByBuild.get(approvalId)!.values()];
  }
  return { builds, anchors, consumed, owners, unanchored };
}
