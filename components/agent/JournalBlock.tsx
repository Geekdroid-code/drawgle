"use client";

import type { GenerationJournalMetadata, GenerationJournalScreen } from "@/lib/types";
import { AgentBlock, TimelineStep } from "./AgentBlock";
import type { AgentMarkState, StepMarkStatus } from "./marks";

type Phase = GenerationJournalMetadata["phases"][number];

const PHASE_LIVE: Record<string, string> = {
  brief: "Reading the brief",
  reference: "Reading the reference",
  design: "Setting up the design system",
  blueprint: "Planning navigation",
  screens: "Planning screens",
  assets: "Finding images",
  build: "Designing screens",
};

const phaseStatus = (phase: Phase): StepMarkStatus =>
  phase.status === "completed" ? "done" : phase.status === "active" ? "active" : phase.status === "failed" ? "failed" : "queued";

function screenStatus(screen: GenerationJournalScreen, live: boolean): StepMarkStatus {
  if (screen.status === "ready") return "done";
  if (screen.status === "failed") return "failed";
  if (!live) return "skipped";
  return screen.status === "planned" || screen.status === "queued" ? "queued" : "active";
}

/**
 * A regular (not approved-flow) build's journal, in the agent's timeline: its phases and its screens. The builder's
 * internal briefs stay out of chat.
 */
export function JournalBlock({ journal }: { journal: GenerationJournalMetadata }) {
  const live = ["queued", "planning", "building"].includes(journal.status);
  const state: AgentMarkState = live ? "working" : journal.status === "failed" ? "failed" : "idle";
  const activePhase = journal.phases.find((phase) => phase.status === "active");
  const title = live ? PHASE_LIVE[activePhase?.id ?? ""] ?? journal.title : journal.title;
  const screens = journal.screens ?? [];
  const ready = screens.filter((screen) => screen.status === "ready").length;

  return (
    <AgentBlock
      label="Screen generation progress"
      state={state}
      title={title}
      meta={live && screens.length ? `${ready} of ${screens.length}` : null}
      summary={!live && journal.detail ? journal.detail : null}
    >
      {journal.phases.filter((phase) => phase.id !== "build").map((phase) => (
        <TimelineStep
          key={phase.id}
          status={phaseStatus(phase)}
          title={phase.label}
          detail={phase.status === "active" || phase.status === "failed" ? phase.detail : null}
        />
      ))}
      {screens.map((screen, index) => {
        const status = screenStatus(screen, live);
        const title = status === "done" ? `Designed ${screen.name}` : status === "active" ? `Designing ${screen.name}` : status === "failed" ? `Couldn't build ${screen.name}` : screen.name;
        return <TimelineStep key={`${screen.name}-${index}`} status={status} title={title} />;
      })}
    </AgentBlock>
  );
}
