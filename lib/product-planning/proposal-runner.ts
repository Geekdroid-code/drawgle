import "server-only";
import { Type } from "@google/genai";
import { z } from "zod";
import { createGeminiClient } from "@/lib/ai/gemini";
import { geminiPolicyForTask } from "@/lib/ai/model-policy";
import { confirmedMessageEvidence } from "./questions";
import { candidateFactPatch, candidateRoadmap, designFlowCandidateSchema } from "./proposal-candidate";
import { prepareDesignerPatch } from "./designer-patch";
import { reviewFactEvidence } from "./review-fact-evidence";
import { activeFacts, applyProductPatch, assertExperienceReady, blockingScreenQuestions, proposeProductScope, type ProductPlanning } from "./model";
import { functionalItemSchema, type FunctionalItem } from "./functional-plan";
import { flowPreflight } from "./flow-preflight";
import { inspectProductReference } from "./inspect-reference";
import { reviewProductReadiness } from "./readiness";
import { PlanningConflict, type PlanningStore } from "./store";
import type { EvidenceAssessment } from "./evidence";
import { ProductToolError, type PlanningFailure } from "./tool-failure";

type RoadmapRow = { item: FunctionalItem; status: string; screenId: string | null };
type Trace = { stage: string; elapsedMs: number; inputTokens?: number; outputTokens?: number; errorCode?: string };

const instructions = `You are Drawgle, a senior SCREEN and FLOW designer. Produce one JSON candidate for a user-facing app design.
Map every named user task to visible screens, actions, destinations and outcomes. A full-app request needs the whole requested flow; a focused request stays focused. Describe useful information, entry conditions, result states and inline feedback. Use one screen for a coherent task; do not invent separate screens for every tiny state. One product surface may need several distinct task screens. Never target a fixed screen count. Do not ask about backend architecture, storage, codecs, APIs, cloud sync, model choice, or implementation policy.
The server assigns identities. Each new fact and output needs a unique short lowercase ref. To change an active fact, set supersedesId to its current ID; never make a renamed copy. To edit an unbuilt screen, set existingKey. Ready or building outputs are historical context, not new scope selections; use a new ref for a redesign. Preserve all unaffected existing decisions and output keys. Existing fact IDs and output keys may be used directly in references. Only remove planned outputs when the user actually changed scope.
Facts marked source=user must quote supporting user words in evidence. Designer choices are assumptions, not confirmed requirements. Preserve consistent audience language, entity names and plausible example content; visual references supply craft, not an unrelated domain or invented product promises. Refer to every selected output in scope.outputRefs. For an external action, use destinationRef=null and explain the handoff in outcome. Generation dependencyRefs are build prerequisites, not navigation order. Every output needs a real surface and journey fact. Give each main screen a task-specific information hierarchy; avoid generic repeated card stacks. Return JSON only with facts, removeFactIds, outputs, removeOutputKeys and scope.`;

const string = { type: Type.STRING } as const;
const strings = { type: Type.ARRAY, items: string } as const;
const responseSchema = { type: Type.OBJECT, properties: {
  facts: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: {
    ref: string, supersedesId: { type: Type.STRING, nullable: true },
    section: { type: Type.STRING, enum: ["identity", "actors", "jobs", "capabilities", "entities", "journeys",
      "surfaces", "constraints", "decisions", "questions", "preferences", "roadmap", "content"] },
    label: string, detail: string, source: { type: Type.STRING, enum: ["user", "assumption"] },
    evidence: string, links: strings, blocking: { type: Type.BOOLEAN },
  }, required: ["ref", "section", "label", "detail", "source", "evidence", "links", "blocking"] } },
  removeFactIds: strings,
  outputs: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: {
    ref: string, existingKey: { type: Type.STRING, nullable: true }, name: string, description: string,
    surfaceRefs: strings, journeyRefs: strings, decisionRefs: strings, dependencyRefs: strings,
    actions: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: {
      label: string, destinationRef: { type: Type.STRING, nullable: true }, outcome: string,
    }, required: ["label", "destinationRef", "outcome"] } },
    information: string, entryCondition: string, outcome: string, inlineStates: strings,
    sequence: { type: Type.INTEGER },
  }, required: ["ref", "name", "description", "surfaceRefs", "journeyRefs", "actions",
    "information", "entryCondition", "outcome", "inlineStates"] } },
  removeOutputKeys: strings,
  scope: { type: Type.OBJECT, properties: { goal: string, rationale: string,
    outputRefs: strings, surfaceRefs: strings }, required: ["goal", "rationale", "outputRefs", "surfaceRefs"] },
}, required: ["facts", "removeFactIds", "outputs", "removeOutputKeys", "scope"] };

async function roadmapRows(admin: PlanningStore, projectId: string, ownerId: string): Promise<RoadmapRow[]> {
  const { data, error } = await admin.from("project_screen_roadmap")
    .select("metadata,status,generated_screen_id").eq("project_id", projectId).eq("owner_id", ownerId).neq("status", "dismissed");
  if (error) throw error;
  return (data ?? []).flatMap(row => row.metadata?.functional ? [{
    item: functionalItemSchema.parse(row.metadata.functional), status: row.status,
    screenId: row.generated_screen_id,
  }] : []);
}

function failure(stage: string, code: string, message: string, issues: string[] = []): PlanningFailure {
  return { stage, code, summary: message.slice(0, 1000), retryable: true,
    ...(issues.length ? { issues: issues.slice(0, 3).map(issue => issue.slice(0, 300)) } : {}) };
}

function validationIssue(error: unknown) {
  if (error instanceof z.ZodError) return `Invalid screen-flow fields: ${error.issues.slice(0, 4)
    .map(issue => issue.path.join(".") || "root").join(", ")}.`;
  if (error instanceof SyntaxError) return "The screen-flow proposal was not valid JSON.";
  return error instanceof Error ? error.message.slice(0, 500) : "The screen flow has inconsistent references.";
}

/** One candidate, server-owned identity/diff, and the existing independent readiness review. */
export async function runProposalPlanner(input: {
  admin: PlanningStore; projectId: string; ownerId: string; clientTurnId: string; userMessageId: string;
  prompt: string; originalRequest: string; assessment: EvidenceAssessment;
  history: Array<{ id: string; role: string; content: string; metadata: Record<string, unknown> }>;
  conversation: Array<{ role: string; content: string }>;
  resumeSavedReview: boolean;
  getState: () => ProductPlanning;
  persist: (next: ProductPlanning) => Promise<ProductPlanning>;
  commit: (next: ProductPlanning, items: FunctionalItem[], removeKeys: string[]) => Promise<ProductPlanning>;
  enqueueProjectDesign: () => Promise<void>;
  progress: (title: string, detail: string) => Promise<void>;
  onTrace?: (event: Record<string, unknown>) => void;
}): Promise<{ reply: string; failure?: PlanningFailure; performance: Trace[] }> {
  const { admin, projectId, ownerId, clientTurnId, userMessageId } = input;
  const performance: Trace[] = [];
  const ai = createGeminiClient();
  const policy = geminiPolicyForTask("project_planning", {
    responseMimeType: "application/json", responseSchema,
    maxOutputTokens: 12000, systemInstruction: instructions,
  });
  let repair: { kind: "structure" | "coverage"; issues: string[] } | null = input.resumeSavedReview
    ? { kind: "coverage", issues: input.getState().scope?.reviewIssues ?? [] } : null;
  let structureRepairs = 0;
  let coverageRepairs = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    const before = input.getState();
    const current = await roadmapRows(admin, projectId, ownerId);
    await input.progress(repair ? "Repairing screen flow" : "Designing screens and flow",
      repair ? "Fixing the specific saved screen or navigation gaps..." : "Mapping user tasks to screens, actions and outcomes...");
    const started = Date.now();
    let response: Awaited<ReturnType<typeof ai.models.generateContent>>;
    try {
      response = await ai.models.generateContent({ model: policy.model, config: policy.config,
        contents: [{ role: "user", parts: [{ text: JSON.stringify({
          originalRequest: input.originalRequest, currentRequest: input.prompt,
          userMessages: input.conversation.filter(message => message.role === "user"),
          evidenceAssessment: input.assessment,
          activeFacts: activeFacts(before), currentRoadmap: current.map(row => ({ ...row.item, status: row.status })),
          currentScope: before.scope, experience: before.experience,
          repair: repair ? { kind: repair.kind, issues: repair.issues,
            instruction: "Patch only the cited issue. Keep unaffected identities and requested extent." } : null,
        }) }] }],
      });
      performance.push({ stage: repair ? `proposal_${repair.kind}_repair` : "proposal", elapsedMs: Date.now() - started,
        inputTokens: response.usageMetadata?.promptTokenCount, outputTokens: response.usageMetadata?.candidatesTokenCount });
      input.onTrace?.({ stage: "proposal", attempt, elapsedMs: Date.now() - started,
        inputTokens: response.usageMetadata?.promptTokenCount, outputTokens: response.usageMetadata?.candidatesTokenCount });
    } catch (error) {
      performance.push({ stage: "proposal", elapsedMs: Date.now() - started, errorCode: "PROPOSAL_UNAVAILABLE" });
      const issue = "The screen-flow proposal service is unavailable. Your saved decisions are intact.";
      input.onTrace?.({ stage: "proposal", attempt, elapsedMs: Date.now() - started, errorCode: "PROPOSAL_UNAVAILABLE" });
      return { reply: issue, failure: failure("proposal", "PROPOSAL_UNAVAILABLE", issue), performance };
    }
    let candidate: ReturnType<typeof designFlowCandidateSchema.parse>;
    try {
      candidate = designFlowCandidateSchema.parse(JSON.parse(response.text || "{}"));
    } catch (error) {
      const issue = validationIssue(error);
      if (structureRepairs++ < 1) { repair = { kind: "structure", issues: [issue] }; continue; }
      return { reply: `I saved your decisions, but the screen-flow proposal needs correction: ${issue.slice(0, 300)}`,
        failure: failure("proposal", "PROPOSAL_INVALID", issue, [issue]), performance };
    }
    let draft: ProductPlanning;
    let mapped: ReturnType<typeof candidateRoadmap>;
    try {
      const ids = candidateFactPatch(candidate, before, projectId, clientTurnId);
      const userEvidence = [input.originalRequest, ...input.history.filter(message => message.role === "user")
        .flatMap(confirmedMessageEvidence), input.prompt];
      const prepared = prepareDesignerPatch("update_product", ids.args, userEvidence, input.history, input.assessment);
      const checked = prepared.patch.operations.length ? await reviewFactEvidence(prepared, input.history,
        event => { performance.push(event); input.onTrace?.(event); }) : prepared;
      const factState = checked.patch.operations.length
        ? applyProductPatch(before, checked.patch, userMessageId) : before;
      mapped = candidateRoadmap(candidate, factState, current, ids.aliases, ids.superseded, projectId, clientTurnId);
      const oldScope = before.scope;
      const scopeChanged = !oldScope || JSON.stringify({ goal: oldScope.goal, rationale: oldScope.rationale,
        surfaceIds: oldScope.surfaceIds, outputKeys: oldScope.outputKeys, manifest: oldScope.manifest })
        !== JSON.stringify({ goal: mapped.scope.goal, rationale: mapped.scope.rationale,
          surfaceIds: mapped.scope.surfaceIds, outputKeys: mapped.scope.outputKeys, manifest: mapped.scope.manifest });
      const contentChanged = factState !== before || mapped.itemsToSave.length > 0
        || mapped.removeKeys.length > 0 || scopeChanged;
      draft = { ...factState, contentRevision: (before.contentRevision ?? 0) + (contentChanged ? 1 : 0),
        scope: mapped.scope };
      const graph = flowPreflight(draft, mapped.roadmap);
      if (graph.issues.length) throw new Error(graph.issues.join(" "));
    } catch (error) {
      if (error instanceof PlanningConflict) throw error;
      const issue = validationIssue(error);
      if (structureRepairs++ < 1) { repair = { kind: "structure", issues: [issue] }; continue; }
      return { reply: `The screen flow still has a specific gap: ${issue.slice(0, 300)}`,
        failure: failure("screen_flow", "FLOW_STRUCTURE", issue, [issue]), performance };
    }
    try {
      await input.commit(draft, mapped.itemsToSave, mapped.removeKeys);
    } catch (error) {
      if (error instanceof PlanningConflict) throw error;
      const issue = "The screen flow could not be saved. Your previous decisions remain intact.";
      return { reply: issue, failure: failure("screen_flow", "SAVE_FAILED", issue), performance };
    }
    let state = input.getState();
    try {
      let inspectNeeded = false;
      try { assertExperienceReady(state); } catch { inspectNeeded = true; }
      if (inspectNeeded) {
        await input.progress("Analyzing design direction", "Checking the saved visual requirements and reference...");
        const startedReference = Date.now();
        const inspected = await inspectProductReference(admin, ownerId, state,
          [input.originalRequest, input.prompt].filter(Boolean).join("\n\n"),
          event => { performance.push(event); input.onTrace?.(event); });
        performance.push({ stage: "reference", elapsedMs: Date.now() - startedReference });
        await input.persist({ ...state, contentRevision: (state.contentRevision ?? 0) + 1,
          experience: inspected.experience,
          input: { ...state.input, imagePath: inspected.experience.referencePath,
            referenceSource: !inspected.experience.referencePath ? "none"
              : inspected.experience.referenceId ? "curated" : "user" } });
        await input.enqueueProjectDesign();
        state = input.getState();
      }
      if (blockingScreenQuestions(state).length) throw new Error("A saved screen-flow decision still needs the user's answer.");
      const proposed = proposeProductScope(state);
      await input.progress("Reviewing screen flow", "Checking the requested tasks, screen paths and outcomes...");
      const review = await reviewProductReadiness(proposed, input.prompt, {
        history: input.conversation, roadmap: await roadmapRows(admin, projectId, ownerId).then(rows => rows.map(row => row.item)),
        onTrace: event => { performance.push(event); input.onTrace?.(event); },
      });
      if (!review.ready) {
        await input.persist({ ...state, scope: { ...state.scope!, status: "draft",
          reviewIssues: review.issues.slice(0, 12), reviewedContentRevision: state.contentRevision ?? 0 } });
        if (coverageRepairs++ < 1) { repair = { kind: "coverage", issues: review.issues }; continue; }
        const summary = review.issues.slice(0, 2).join(" ");
        return { reply: `The saved screen flow needs this correction: ${summary}`,
          failure: failure("flow_review", "FLOW_REVIEW_FAILED", summary, review.issues), performance };
      }
      await input.persist({ ...proposed, scope: { ...proposed.scope!,
        ...(review.coverage ? { journeyCoverage: review.coverage.journeys,
          requestedScope: review.coverage.requestedScope, scopeEvidence: review.coverage.scopeEvidence } : {}),
        reviewIssues: undefined } });
      return { reply: "The screen flow is ready to review. Use the approval card to start generation.", performance };
    } catch (error) {
      if (error instanceof PlanningConflict) throw error;
      const issue = error instanceof ProductToolError ? error.message.slice(0, 500)
        : "The saved screen flow could not be reviewed right now. Retry from the saved draft.";
      await input.persist({ ...input.getState(), scope: { ...input.getState().scope!, status: "draft",
        reviewIssues: [issue.slice(0, 1500)], reviewedContentRevision: input.getState().contentRevision ?? 0 } });
      return { reply: `Your saved design decisions are intact. ${issue.slice(0, 300)}`,
        failure: failure("flow_review", "REVIEW_UNAVAILABLE", issue, [issue]), performance };
    }
  }
  return { reply: "The saved screen flow needs a targeted correction before approval.",
    failure: failure("screen_flow", "REPAIR_LIMIT", "The targeted screen-flow repair did not finish."), performance };
}
