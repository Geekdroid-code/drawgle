import type { GenerationJournalMetadata, GenerationRunData, ProjectMessage } from "@/lib/types";

/**
 * One approved flow's build, as the chat shows it: one block with one live line and one row per approved screen or
 * state. Everything here is read from what the coordinator and its batches already store; nothing is invented, and
 * the person never sees batches, runs or "outputs".
 */

export type FlowOutput = {
  stableKey: string;
  name: string;
  kind: "screen" | "state";
  parentStableKey: string | null;
  sequence: number;
};

export type FlowApproval = {
  /** The approval's root generation run. */
  id: string;
  outputs: FlowOutput[];
  goal: string | null;
  /** Outputs an earlier approval already built; they count as done. */
  existingKeys: string[];
};

export type FlowFulfillment = {
  outputKey: string;
  status: "claimed" | "ready" | "failed" | "blocked";
  screenId: string | null;
  generationRunId: string;
};

export type FlowRowStatus = "queued" | "active" | "done" | "failed" | "skipped";

export type FlowRow = {
  key: string;
  name: string;
  kind: "screen" | "state";
  parentKey: string | null;
  status: FlowRowStatus;
  /** A short, true sub-line: the phase an active screen is in, or why a row didn't build. */
  detail: string | null;
};

export type FlowBuildState = "starting" | "building" | "stopping" | "complete" | "paused" | "stopped";
export type FlowPauseReason = "failed" | "credits" | "dispatch" | "error";

export type FlowBuildView = {
  approvalId: string;
  state: FlowBuildState;
  pauseReason: FlowPauseReason | null;
  /** The header's line: what is happening now, or how the build ended. */
  title: string;
  /** One sentence under the header once the build has ended. */
  summary: string | null;
  /** A cleaned error the person should see, for failures the copy above doesn't explain. */
  error: string | null;
  goal: string | null;
  done: number;
  total: number;
  failed: number;
  screens: number;
  states: number;
  reference: string | null;
  styleDefined: boolean;
  retrying: boolean;
  rows: FlowRow[];
  canResume: boolean;
};

const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
const text = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : null;

function readOutputs(manifest: unknown): FlowOutput[] {
  if (!Array.isArray(manifest)) return [];
  return manifest.flatMap((entry, index) => {
    const item = record(entry);
    const stableKey = text(item?.stableKey);
    const name = text(item?.name);
    if (!item || !stableKey || !name) return [];
    return [{
      stableKey,
      name,
      kind: item.kind === "state" ? "state" as const : "screen" as const,
      parentStableKey: text(item.parentStableKey),
      sequence: typeof item.sequence === "number" ? item.sequence : index,
    }];
  });
}

function approvalOf(id: string, scope: Record<string, unknown> | null): FlowApproval | null {
  const outputs = readOutputs(scope?.manifest);
  if (!outputs.length) return null;
  const existing = Array.isArray(scope?.existingOutputs) ? scope.existingOutputs : [];
  return {
    id,
    outputs,
    goal: text(scope?.goal),
    existingKeys: existing.flatMap((entry) => {
      const key = text(record(record(entry)?.item)?.stableKey);
      return key ? [key] : [];
    }),
  };
}

/** The approval a "product_scope_approved" message records: its root run and the approved scope. */
export function readApprovalFromMessage(message: Pick<ProjectMessage, "metadata">): FlowApproval | null {
  const metadata = message.metadata;
  if (metadata.action !== "product_scope_approved") return null;
  const id = text(metadata.generationRunId);
  return id ? approvalOf(id, record(metadata.productScope)) : null;
}

/** The approval a root run carries, for when its approval message is older than the loaded chat. */
export function readApprovalFromRun(run: Pick<GenerationRunData, "id" | "metadata">): FlowApproval | null {
  if (!isProductApprovalRun(run)) return null;
  return approvalOf(run.id, record(record(run.metadata?.productPlanning)?.scope));
}

export const isProductApprovalRun = (run: Pick<GenerationRunData, "metadata">) =>
  Array.isArray(record(record(run.metadata?.productPlanning)?.scope)?.manifest) && !run.metadata?.productApprovalId;

export const productApprovalIdOf = (run: Pick<GenerationRunData, "metadata"> | null | undefined) =>
  text(run?.metadata?.productApprovalId);

// The coordinator's and batches' own words for the moments the build block replaces.
const PRODUCT_BATCH_COMPLETION = /^This batch delivered \d+ of \d+ approved outputs\./;
const FLOW_READY_NOTICE = "The screen flow is ready to review. Use the approval card to start generation.";

/** "This batch delivered 1 of 1 approved outputs…": a batch's completion line, which the build block replaces. */
export const isProductBatchCompletion = (message: Pick<ProjectMessage, "metadata" | "content">) =>
  message.metadata.action === "generation_completion" && PRODUCT_BATCH_COMPLETION.test(message.content.trim());

/** The line that only points at the approval card, which sits right under it. */
export const isFlowReadyNotice = (message: Pick<ProjectMessage, "role" | "content">) =>
  message.role === "model" && message.content.trim() === FLOW_READY_NOTICE;

type ProgressKind = "starting" | "retry_notice" | "retrying" | "complete" | "failed" | "blocked" | "credits" | "dispatch" | "other";

export function progressKind(content: string): ProgressKind {
  const value = content.trim();
  if (value.startsWith("Starting the approved flow")) return "starting";
  if (value.startsWith("A batch encountered an error")) return "retry_notice";
  if (value.startsWith("Retrying the approved outputs")) return "retrying";
  if (value.startsWith("Completed the approved flow")) return "complete";
  if (value.startsWith("Some approved screens could not be built")) return "failed";
  if (value.startsWith("The remaining approved work is blocked")) return "blocked";
  if (value.startsWith("Generation paused because the next approved batch needs more credits")) return "credits";
  if (value.startsWith("Continuation could not confirm dispatch")) return "dispatch";
  return "other";
}

const pauseReasonOf = (error: string | null): FlowPauseReason => {
  if (!error) return "failed";
  const kind = progressKind(error);
  if (kind === "credits") return "credits";
  if (kind === "dispatch") return "dispatch";
  if (kind === "failed" || kind === "blocked") return "failed";
  return "error";
};

// Journal phases and screen states, in the person's words.
const JOURNAL_SCREEN_DETAIL: Record<string, string> = {
  briefing: "Writing the brief",
  planned: "Waiting to be built",
  queued: "Waiting to be built",
  preparing_assets: "Finding images",
  building: "Building the screen",
  ready: "Finishing",
};
const JOURNAL_PHASE_DETAIL: Record<string, string> = {
  brief: "Reading the brief",
  reference: "Reading the reference",
  design: "Setting up the design system",
  blueprint: "Planning navigation",
  screens: "Writing the brief",
  assets: "Finding images",
  build: "Building the screen",
};

const sameName = (left: string, right: string) => left.trim().toLowerCase() === right.trim().toLowerCase();

function activeDetail(name: string, journal: GenerationJournalMetadata | undefined) {
  if (!journal) return "Starting";
  const screen = journal.screens?.find((entry) => sameName(entry.name, name));
  if (screen?.status && JOURNAL_SCREEN_DETAIL[screen.status]) return JOURNAL_SCREEN_DETAIL[screen.status];
  const phase = journal.activePhase ?? journal.phases.find((entry) => entry.status === "active")?.id;
  return (phase && JOURNAL_PHASE_DETAIL[phase]) || "Building the screen";
}

/** "Using curated visual evidence for style direction: travel-tracker-airy-light." → what the agent read, in its words. */
export function referenceLine(journals: GenerationJournalMetadata[]): string | null {
  for (const journal of journals) {
    const detail = journal.phases.find((phase) => phase.id === "reference")?.detail?.trim();
    if (!detail) continue;
    const curated = detail.match(/style direction:\s*([a-z0-9-]+)\.?$/i);
    if (curated) return `Read reference "${curated[1]}"`;
    if (/uploaded image as structural/i.test(detail)) return "Read your image to copy its screens";
    if (/uploaded image as style/i.test(detail)) return "Read your image for its style";
    if (/persisted user reference/i.test(detail)) return "Read your saved reference";
    if (/existing project's screens/i.test(detail)) return "Matched your existing screens";
  }
  return null;
}

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

function countLine(screens: number, states: number) {
  return states ? `${plural(screens, "screen")} and ${plural(states, "state")}` : plural(screens, "screen");
}

/**
 * The build block's view of one approved flow. `run` is the approval's root run when it is loaded; `fulfillments`
 * are its per-output claims when they are loaded (the latest approval). Without them the rows fall back to the
 * batches' journals, matched by name.
 */
export function buildFlowBuildView({
  approval,
  run,
  progress,
  journals,
  fulfillments,
  cleanError = (value) => value,
}: {
  approval: FlowApproval;
  run: Pick<GenerationRunData, "status" | "error"> | null;
  progress: Array<Pick<ProjectMessage, "content">>;
  journals: GenerationJournalMetadata[];
  fulfillments: FlowFulfillment[] | null;
  cleanError?: (value: string) => string;
}): FlowBuildView {
  const lastProgress = progress.length ? progressKind(progress[progress.length - 1].content) : null;
  const claims = new Map((fulfillments ?? []).map((claim) => [claim.outputKey, claim]));
  const existing = new Set(approval.existingKeys);
  const journalByRun = new Map(journals.map((journal) => [journal.generationRunId, journal]));
  const anyActiveClaim = (fulfillments ?? []).some((claim) => claim.status === "claimed");

  // How the build stands: the root run decides when it is loaded, otherwise its last progress line.
  let state: FlowBuildState;
  let pauseReason: FlowPauseReason | null = null;
  const runError = text(run?.error);
  if (run) {
    if (run.status === "completed") state = "complete";
    else if (run.status === "canceled") state = anyActiveClaim ? "stopping" : "stopped";
    else if (run.status === "failed") {
      state = "paused";
      pauseReason = pauseReasonOf(runError);
    } else {
      state = fulfillments?.length || journals.length ? "building" : "starting";
    }
  } else if (lastProgress === "complete") state = "complete";
  else if (lastProgress === "credits") { state = "paused"; pauseReason = "credits"; }
  else if (lastProgress === "failed" || lastProgress === "blocked") { state = "paused"; pauseReason = "failed"; }
  else if (lastProgress === "dispatch") { state = "paused"; pauseReason = "dispatch"; }
  else state = journals.length ? "building" : "starting";

  const live = state === "starting" || state === "building" || state === "stopping";
  const retrying = live && lastProgress === "retrying";

  const rows: FlowRow[] = [...approval.outputs]
    .sort((left, right) => left.sequence - right.sequence)
    .map((output) => {
      const base = { key: output.stableKey, name: output.name, kind: output.kind, parentKey: output.parentStableKey };
      if (existing.has(output.stableKey)) return { ...base, status: "done" as const, detail: null };
      if (state === "complete") return { ...base, status: "done" as const, detail: null };
      if (fulfillments) {
        const claim = claims.get(output.stableKey);
        if (claim?.status === "ready") return { ...base, status: "done" as const, detail: null };
        if (claim?.status === "claimed") {
          return { ...base, status: "active" as const, detail: activeDetail(output.name, journalByRun.get(claim.generationRunId)) };
        }
        if (claim?.status === "failed" || claim?.status === "blocked") {
          return { ...base, status: "failed" as const, detail: live ? "Will try again" : claim.status === "blocked" ? "Depends on a screen that didn't build" : null };
        }
        return { ...base, status: live ? "queued" as const : "skipped" as const, detail: null };
      }
      // Without the claims, the latest journal that names the screen tells its state.
      const named = [...journals].reverse().map((journal) => ({ journal, screen: journal.screens?.find((entry) => sameName(entry.name, output.name)) }))
        .find((entry) => entry.screen);
      if (named?.screen?.status === "ready") return { ...base, status: "done" as const, detail: null };
      if (named?.screen?.status === "failed") return { ...base, status: "failed" as const, detail: live ? "Will try again" : null };
      if (named && live && ["queued", "planning", "building"].includes(named.journal.status)) {
        return { ...base, status: "active" as const, detail: activeDetail(output.name, named.journal) };
      }
      return { ...base, status: live ? "queued" as const : "skipped" as const, detail: null };
    });

  const done = rows.filter((row) => row.status === "done").length;
  const failed = rows.filter((row) => row.status === "failed").length;
  const total = rows.length;
  const screens = approval.outputs.filter((output) => output.kind === "screen").length;
  const states = total - screens;
  const active = rows.filter((row) => row.status === "active");

  let title: string;
  if (state === "starting") title = "Starting your flow";
  else if (state === "building") {
    title = active.length === 1 ? `Designing ${active[0].name}`
      : active.length > 1 ? `Designing ${plural(active.length, "screen")}`
        : retrying ? "Trying the missed screens again" : "Preparing the next screens";
  } else if (state === "stopping") title = "Stopping after the screens in progress";
  else if (state === "complete") title = "Generation complete";
  else if (state === "stopped") title = "Stopped";
  else title = pauseReason === "credits" ? "Paused for credits" : "Paused";

  const onCanvas = `${done} of ${total} on the canvas`;
  let summary: string | null = null;
  if (state === "complete") summary = `All ${countLine(screens, states)} ${total === 1 ? "is" : "are"} on the canvas.`;
  else if (state === "stopped") summary = `${onCanvas}. Resume to build the rest.`;
  else if (state === "paused") {
    summary = pauseReason === "credits" ? `${onCanvas}. The next screens need more credits.`
      : pauseReason === "dispatch" ? `${onCanvas}. The build couldn't continue; resume to try again.`
        : failed ? `${onCanvas}. ${plural(failed, "screen")} couldn't be built; resume to try ${failed === 1 ? "it" : "them"} again.`
          : `${onCanvas}. Resume to build the rest.`;
  }

  return {
    approvalId: approval.id,
    state,
    pauseReason,
    title,
    summary,
    error: state === "paused" && pauseReason === "error" && runError ? cleanError(runError) : null,
    goal: approval.goal,
    done,
    total,
    failed,
    screens,
    states,
    reference: referenceLine(journals),
    styleDefined: journals.some((journal) => journal.phases.some((phase) => phase.id === "design" && phase.status === "completed")),
    retrying,
    rows,
    canResume: Boolean(run) && (state === "paused" || state === "stopped"),
  };
}
