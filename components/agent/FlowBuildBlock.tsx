"use client";

import Link from "next/link";

import { buildFlowBuildView, type FlowFulfillment, type FlowRow } from "@/lib/agent/flow-build";
import type { FlowBuildGroup } from "@/lib/agent/flow-messages";
import { cleanErrorMessage } from "@/lib/errors/user-facing";
import type { DesignTokens, GenerationRunData } from "@/lib/types";
import { useProductFulfillments } from "@/hooks/use-product-fulfillments";
import { useProductGenerationControl } from "@/hooks/use-product-generation-control";
import { AgentBlock, TimelineStep } from "./AgentBlock";
import { StyleDefinedCard } from "./StyleDefinedCard";
import type { AgentMarkState } from "./marks";

const plural = (count: number, one: string) => `${count} ${count === 1 ? one : `${one}s`}`;

function rowTitle(row: FlowRow) {
  if (row.status === "done") return `Designed ${row.name}`;
  if (row.status === "active") return `Designing ${row.name}`;
  if (row.status === "failed") return `Couldn't build ${row.name}`;
  return row.name;
}

/**
 * One approved flow's build in chat: one live line, then what the agent read and decided, then one row per approved
 * screen and state, ticking over as each lands on the canvas. Replaces the per-batch progress cards and lines.
 */
export function FlowBuildBlock({
  projectId,
  group,
  runs,
  designTokens,
  isLatest,
  fulfillments: sharedFulfillments,
}: {
  projectId: string;
  group: FlowBuildGroup;
  runs: GenerationRunData[];
  designTokens?: DesignTokens | null;
  isLatest: boolean;
  /** The claims the project page already reads for the canvas; when given, the block doesn't read its own. */
  fulfillments?: FlowFulfillment[] | null;
}) {
  const { approval } = group;
  const run = runs.find((candidate) => candidate.id === approval.id) ?? null;
  const live = Boolean(run && ["queued", "planning", "building", "canceled"].includes(run.status));
  // The claims move when the root run or one of its batches moves, or a batch's journal changes.
  const refreshKey = [
    run?.status, run?.updatedAt,
    runs.filter((candidate) => candidate.metadata?.productApprovalId === approval.id).map((batch) => `${batch.id}:${batch.status}`).join(","),
    group.journals.map((journal) => `${journal.generationRunId}:${journal.status}:${journal.screens?.map((screen) => screen.status).join("")}`).join(","),
  ].join("|");
  const ownFulfillments = useProductFulfillments(isLatest && sharedFulfillments === undefined ? approval.id : null, refreshKey, live);
  const fulfillments = sharedFulfillments === undefined ? ownFulfillments : sharedFulfillments;
  const control = useProductGenerationControl(projectId);
  const view = buildFlowBuildView({
    approval,
    run,
    progress: group.progress,
    journals: group.journals,
    fulfillments,
    cleanError: cleanErrorMessage,
  });

  const markState: AgentMarkState = view.state === "starting" || view.state === "building" || view.state === "stopping"
    ? "working"
    : view.state === "complete" ? "idle" : view.pauseReason === "error" ? "failed" : "paused";
  const childrenOf = (key: string) => view.rows.filter((row) => row.kind === "state" && row.parentKey === key);
  const topRows = view.rows.filter((row) => row.kind === "screen" || !view.rows.some((parent) => parent.key === row.parentKey));

  const footer = view.canResume || control.error ? (
    <div className="flex flex-wrap items-center gap-2">
      {view.canResume ? (
        <button
          type="button"
          disabled={control.busy !== null}
          onClick={() => void control.act("resume", approval.id)}
          className="inline-flex h-7 items-center rounded-full bg-[var(--dg-text)] px-3 text-[11.5px] font-medium text-[var(--dg-surface)] transition-opacity hover:opacity-85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dg-accent)] disabled:opacity-50"
        >
          {control.busy === "resume" ? "Resuming…" : view.state === "stopped" ? "Resume" : view.failed ? "Resume and retry" : "Resume"}
        </button>
      ) : null}
      {view.pauseReason === "credits" ? (
        <Link
          href="/billing"
          prefetch={false}
          className="inline-flex h-7 items-center rounded-full border border-[var(--dg-border-strong)] px-3 text-[11.5px] font-medium text-[var(--dg-text)] hover:bg-[var(--dg-surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dg-accent)]"
        >
          Get credits
        </Link>
      ) : null}
      {control.error ? <p role="alert" className="w-full text-[11.5px] leading-5 text-[var(--dg-danger)]">{control.error}</p> : null}
    </div>
  ) : null;

  const planned = view.states ? `${plural(view.screens, "screen")} and ${plural(view.states, "state")}` : plural(view.screens, "screen");

  return (
    <AgentBlock
      label="Approved flow build"
      state={markState}
      title={view.title}
      meta={view.state === "complete" ? null : `${view.done} of ${view.total}`}
      summary={view.summary || view.error ? <>{view.summary}{view.error ? <span className="block text-[var(--dg-danger)]">{view.error}</span> : null}</> : null}
      footer={footer}
    >
      {view.reference ? <TimelineStep status="done" title={view.reference} /> : null}
      {view.styleDefined ? (
        <TimelineStep status="done" title="Style defined">
          <StyleDefinedCard tokens={designTokens} />
        </TimelineStep>
      ) : null}
      <TimelineStep status="done" title={`Planned ${planned}`} detail={view.goal} />
      {topRows.map((row) => (
        <ScreenRow key={row.key} row={row} states={childrenOf(row.key)} />
      ))}
    </AgentBlock>
  );
}

function ScreenRow({ row, states }: { row: FlowRow; states: FlowRow[] }) {
  return (
    <>
      <TimelineStep status={row.status} title={rowTitle(row)} detail={row.detail} />
      {states.map((state) => (
        <TimelineStep key={state.key} status={state.status} title={rowTitle(state)} detail={state.detail} indent />
      ))}
    </>
  );
}
