"use client";

import { useEffect, useMemo, useState } from "react";

import { ChatPanel } from "@/components/ChatPanel";
import { CanvasStage } from "@/components/CanvasArea";
import { readApprovalFromMessage, type FlowFulfillment } from "@/lib/agent/flow-build";
import { readGenerationJournal } from "@/lib/agent/generation-journal";
import { flowPlaceholders } from "@/lib/canvas/flow-placeholders";
import type { CanvasTool } from "@/lib/canvas-interactions";
import type { GenerationRunRow, ProjectMessageRow, ProjectNavigationRow, ProjectRow, ScreenRow } from "@/lib/supabase/database.types";
import { mapGenerationRunRow, mapProjectMessageRow, mapProjectNavigationRow, mapProjectRow, mapScreenRow } from "@/lib/supabase/mappers";
import { isActiveGenerationStatus, type GenerationRunData, type ProjectData, type ProjectMessage, type ScreenData } from "@/lib/types";

/**
 * Dev only. A real project's chat and canvas at each moment of an approved flow (planning, review, building, paused,
 * stopped, and as recorded), built from its export (scripts/design-eval/export-replay.ts). The moments between are
 * made from the recorded data: the same names, screens, tokens and messages, with the build's state set as it would
 * be at that moment. No model calls and no writes: the canvas is read-only and actions only reach the dev server.
 */

type Export = {
  project: ProjectRow;
  screens: ScreenRow[];
  navigation: ProjectNavigationRow | null;
  messages: ProjectMessageRow[];
  runs: GenerationRunRow[];
  fulfillments: Array<{ output_key: string; status: FlowFulfillment["status"]; screen_id: string | null; generation_run_id: string }>;
};

const SCENARIOS = ["planning", "review", "building", "paused", "stopped", "recorded"] as const;
type Scenario = typeof SCENARIOS[number];

type Moment = {
  project: ProjectData;
  screens: ScreenData[];
  messages: ProjectMessage[];
  runs: GenerationRunData[];
  fulfillments: FlowFulfillment[] | null;
};

const sameName = (left: string, right: string) => left.trim().toLowerCase() === right.trim().toLowerCase();

function momentOf(data: Export, scenario: Scenario): Moment {
  const project = mapProjectRow(data.project);
  const screens = data.screens.map(mapScreenRow);
  const messages = data.messages.map(mapProjectMessageRow);
  const runs = data.runs.map(mapGenerationRunRow);
  const recorded: FlowFulfillment[] = data.fulfillments.map((row) => ({ outputKey: row.output_key, status: row.status, screenId: row.screen_id, generationRunId: row.generation_run_id }));
  const approvalIndex = messages.findIndex((message) => message.metadata.action === "product_scope_approved");
  const approvalMessage = approvalIndex >= 0 ? messages[approvalIndex] : null;
  const approval = approvalMessage ? readApprovalFromMessage(approvalMessage) : null;
  const planning = project.productPlanning ? { ...project.productPlanning, initialTurnComplete: true, lease: null } : null;
  if (scenario === "recorded" || !approval || !approvalMessage) {
    return { project: { ...project, productPlanning: planning }, screens, messages, runs, fulfillments: recorded };
  }

  const before = messages.slice(0, approvalIndex);
  const root = runs.find((run) => run.id === approval.id);
  const batches = runs.filter((run) => run.metadata?.productApprovalId === approval.id).sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  const outputs = [...approval.outputs].sort((left, right) => left.sequence - right.sequence);
  const screenOf = (name: string) => screens.find((screen) => sameName(screen.name, name));
  const scope = approvalMessage.metadata.productScope as Record<string, unknown>;

  if (scenario === "planning" || scenario === "review") {
    const trace = before.find((message) => (message.metadata.workTrace as { steps?: unknown[] } | undefined)?.steps);
    let shown = before;
    if (scenario === "planning" && trace) {
      // Mid-turn: the trace's third step in progress, and nothing written after it yet.
      const workTrace = trace.metadata.workTrace as { steps: Array<Record<string, unknown>>; status: string };
      const steps = workTrace.steps.slice(0, 3).map((step, index) => index === 2 ? { ...step, status: "active", completedAt: null } : step);
      shown = [...before.slice(0, before.indexOf(trace)), { ...trace, metadata: { ...trace.metadata, workTrace: { ...workTrace, status: "active", steps } } }];
    }
    const proposed = scenario === "review" && planning
      ? { ...planning, scope: { ...(planning.scope ?? {}), ...scope, status: "proposed" as const, approvedRevision: null, generationRunId: null } }
      : planning ? { ...planning, scope: planning.scope ? { ...planning.scope, status: "approved" as const } : null } : null;
    return { project: { ...project, productPlanning: proposed as ProjectData["productPlanning"] }, screens: [], messages: shown, runs: [], fulfillments: null };
  }

  const start = messages.find((message) => message.metadata.action === "product_generation_progress" && String(message.content).startsWith("Starting"));
  const journals = messages.filter((message) => readGenerationJournal(message.metadata));
  const firstBatch = batches[0];
  const firstJournal = journals.find((message) => readGenerationJournal(message.metadata)!.generationRunId === firstBatch?.id);
  const builtByFirst = new Set(screens.filter((screen) => screen.generationRunId === firstBatch?.id).map((screen) => screen.name.toLowerCase()));
  const doneCount = scenario === "paused" ? outputs.length - 1 : Math.max(1, builtByFirst.size || 1);
  const done = outputs.slice(0, scenario === "stopped" ? Math.min(2, outputs.length) : doneCount);
  const doneScreens = done.map((output) => screenOf(output.name)).filter((screen): screen is ScreenData => Boolean(screen));
  const ready = done.map((output) => ({ outputKey: output.stableKey, status: "ready" as const, screenId: screenOf(output.name)?.id ?? null, generationRunId: firstBatch?.id ?? "batch" }));
  const next = outputs.slice(done.length);
  const batchId = batches[1]?.id ?? "live-batch";

  const runAs = (status: GenerationRunData["status"], error: string | null = null): GenerationRunData[] => root ? [
    { ...root, status, error, completedAt: null },
    ...(firstBatch ? [{ ...firstBatch, status: "completed" as const }] : []),
    ...(status === "building" ? [{ ...(batches[1] ?? firstBatch ?? root), id: batchId, status: "building" as const, metadata: { productApprovalId: approval.id } }] : []),
  ] : [];

  if (scenario === "building") {
    const claimed = next.slice(0, 2);
    const liveJournal = firstJournal ? (() => {
      const base = readGenerationJournal(firstJournal.metadata)!;
      return {
        ...firstJournal, id: `${firstJournal.id}-live`, timestamp: new Date(new Date(firstJournal.timestamp).getTime() + 1000).toISOString(),
        metadata: { ...firstJournal.metadata, generationRunId: batchId, generationJournal: {
          ...base, generationRunId: batchId, status: "building", title: "Designing your app", activePhase: "build",
          phases: base.phases.map((phase) => phase.id === "build" ? { ...phase, status: "active" } : phase),
          screens: claimed.map((output, index) => ({ name: output.name, status: index === 0 ? "building" : "preparing_assets" })),
        } },
      };
    })() : null;
    return {
      project: { ...project, productPlanning: planning },
      screens: doneScreens,
      messages: [...before, approvalMessage, ...(start ? [start] : []), ...(firstJournal ? [firstJournal] : []), ...(liveJournal ? [liveJournal] : [])],
      runs: runAs("building"),
      fulfillments: [...ready, ...claimed.map((output) => ({ outputKey: output.stableKey, status: "claimed" as const, screenId: null, generationRunId: batchId }))],
    };
  }

  const failed = scenario === "paused" ? next.slice(0, 1) : [];
  return {
    project: { ...project, productPlanning: planning },
    screens: doneScreens,
    messages: [...before, approvalMessage, ...(start ? [start] : []), ...(firstJournal ? [firstJournal] : [])],
    runs: scenario === "paused"
      ? runAs("failed", "Some approved screens could not be built. Completed screens are kept; resume to retry the failed ones and finish the flow.")
      : runAs("canceled"),
    fulfillments: [...ready, ...failed.map((output) => ({ outputKey: output.stableKey, status: "failed" as const, screenId: null, generationRunId: batchId }))],
  };
}

export function ChatReplayFixture() {
  const [ids, setIds] = useState<string[]>([]);
  const [id, setId] = useState<string | null>(null);
  const [data, setData] = useState<Export | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scenario, setScenario] = useState<Scenario>("building");
  const [tool, setTool] = useState<CanvasTool>("pointer");
  const [selected, setSelected] = useState<ScreenData | null>(null);

  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("id");
    void fetch("/dev/chat-replay/data").then((response) => response.json()).then((result: { ids: string[] }) => {
      setIds(result.ids);
      setId(wanted && result.ids.includes(wanted) ? wanted : result.ids[0] ?? null);
      if (!result.ids.length) setError("No exported projects. Run scripts/design-eval/export-replay.ts first.");
    });
  }, []);

  useEffect(() => {
    if (!id) return;
    void fetch(`/dev/chat-replay/data?id=${id}`).then(async (response) => {
      const result = await response.json();
      if (!response.ok) setError(result.error);
      else setData(result as Export);
    });
  }, [id]);

  const moment = useMemo(() => (data ? momentOf(data, scenario) : null), [data, scenario]);
  const navigation = useMemo(() => (data?.navigation ? mapProjectNavigationRow(data.navigation) : null), [data]);
  const generationRun = moment?.runs.find((run) => isActiveGenerationStatus(run.status)) ?? null;
  const root = moment?.runs.find((run) => !run.metadata?.productApprovalId && run.metadata?.productPlanning) ?? null;
  const approvalMessage = moment?.messages.find((message) => message.metadata.action === "product_scope_approved");
  const approval = approvalMessage ? readApprovalFromMessage(approvalMessage) : null;
  const placeholders = useMemo(() => moment ? flowPlaceholders({
    approval, run: root, fulfillments: moment.fulfillments, screens: moment.screens,
    // The export's slot counter is the final one; at an earlier moment the next slot is just past the visible screens.
    nextSlot: { y: moment.project.screenOriginY },
  }) : [], [approval, moment, root]);

  if (error) return <main className="p-8 text-sm text-rose-600">{error}</main>;
  if (!moment) return <main className="p-8 text-sm text-slate-500">Loading the export…</main>;

  return (
    <main className="relative h-dvh w-dvw overflow-hidden bg-[var(--dg-bg)]">
      <CanvasStage
        screens={moment.screens}
        projectNavigation={navigation}
        designTokens={moment.project.designTokens}
        flowPlaceholders={placeholders}
        tool={tool}
        onToolChange={setTool}
        selectedScreen={selected}
        onSelectScreen={setSelected}
        onCanvasClick={() => setSelected(null)}
        readOnly
        hasSelectedElement={false}
        selectedElementCanEditText={false}
        selectedElementCanEditDesign={false}
      />
      <ChatPanel
        key={`${id}-${scenario}`}
        project={moment.project}
        screens={moment.screens}
        selectedScreen={null}
        generationRun={generationRun}
        generationRuns={moment.runs}
        flowFulfillments={root ? { approvalId: root.id, fulfillments: moment.fulfillments } : null}
        recordedMessages={moment.messages}
        projectNavigation={navigation}
        isQueueing={false}
        isCollapsed={false}
        onCollapseChange={() => undefined}
      />
      <div className="absolute right-4 top-4 z-[60] flex flex-wrap items-center gap-1 rounded-2xl border border-[var(--dg-border)] bg-[var(--dg-surface)] p-1 text-[12px]" data-replay-controls>
        <select className="rounded-xl bg-transparent px-2 py-1" value={id ?? ""} onChange={(event) => { setData(null); setId(event.target.value); }}>
          {ids.map((value) => <option key={value} value={value}>{value.slice(0, 8)}</option>)}
        </select>
        {SCENARIOS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setScenario(value)}
            className={`rounded-xl px-2.5 py-1 ${scenario === value ? "bg-[var(--dg-text)] text-[var(--dg-surface)]" : "text-[var(--dg-text-muted)] hover:bg-[var(--dg-surface-muted)]"}`}
          >
            {value}
          </button>
        ))}
      </div>
    </main>
  );
}
