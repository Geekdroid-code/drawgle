import "server-only";
import { createGeminiClient } from "@/lib/ai/gemini";
import { geminiPolicyForTask } from "@/lib/ai/model-policy";
import { describeProviderError, providerErrorStatus, withProviderRetry } from "@/lib/ai/provider-retry";
import { candidateFactPatch, candidateRoadmap, ensureStructuralFacts, normalizeDesignFlowCandidate,
  reconcileCandidateFactEvidence, type DesignFlowCandidate } from "./proposal-candidate";
import { prepareDesignerPatch } from "./designer-patch";
import { activeFacts, applyProductPatch, assertExperienceReady, proposeProductScope, type ProductPlanning } from "./model";
import { functionalItemSchema, type FunctionalItem } from "./functional-plan";
import { inspectProductReference } from "./inspect-reference";
import { PlanningConflict, type PlanningStore } from "./store";
import type { EvidenceAssessment } from "./evidence";
import type { PlanningFailure } from "./tool-failure";
import { describeProposalFailure, type ProposalStage } from "./proposal-failure";
import { proposalResponseSchema } from "./proposal-response";

type RoadmapRow = { item: FunctionalItem; status: string; screenId: string | null };
type Trace = { stage: string; elapsedMs: number; inputTokens?: number; outputTokens?: number; errorCode?: string };
/** What the latest turn asked for. Answers refine the assignment; continue adds nothing new. */
export type PlanningRequest = { kind: "new_request" | "question_answers" | "continue"; text: string };

const instructions = `You are Drawgle, a senior mobile SCREEN and FLOW designer. Return one JSON screen-flow plan for the user's app.

What to design
- assignment is the user's original request; with later corrections it sets the extent. A full-app request gets the user-facing screens for all of its named features; an explicitly focused request stays focused.
- latestMessage.kind says what the latest message is. "question_answers" are answers to design questions: they refine details of the assignment and never narrow it to the answered topic. "continue" resumes planning from the saved state with no new instruction.
- designAssessment.screenFlowPreview is the draft already shown to the user. Start from it and keep its screens unless the conversation changed them.
- Map every named user task to visible screens, actions, destinations and outcomes. One coherent task is one screen; ordinary states (selection, validation, loading, empty, success) belong in inlineStates or actions, not extra screens. One product surface may need several task screens. Never target a fixed screen count.
- Give each screen a task-specific information hierarchy with concrete, plausible content for the actual audience; avoid generic repeated card stacks. Keep entity names and audience language consistent across screens. Visual references supply craft, never an unrelated domain, jargon or invented product promises.
- Connect screens with real actions so each journey runs from its entry screen to a visible outcome; a screen may instead have an independent entry such as a tab or the app start. An entryCondition sentence alone does not create navigation.
- Never ask questions. Do not plan backend, storage, APIs, sync or other implementation details.

How to write the plan
- facts are short statements of product truth: identity (what the product is), actors (who uses it), jobs (what they want to get done), journeys (their visible path to that result) and surfaces (product areas), plus decisions, preferences, constraints, entities, capabilities or content when useful. Reuse an active fact by its id instead of restating it; to change one, add a fact whose supersedesId is its id.
- source="user" only for what the user actually said, with their exact words in evidence. Everything you infer is source="assumption" with empty evidence.
- outputs has one entry per screen with a unique short lowercase ref. To change an unbuilt screen in currentRoadmap, set existingKey to its stableKey. Built screens (status ready or building) are context only; refer to them by stableKey.
- actions[].destinationRef is the ref of another output, a currentRoadmap stableKey, or null for an inline result or an external handoff (explain it in outcome).
- surfaceRefs, journeyRefs and decisionRefs name fact refs from this plan or active fact ids.
- dependencyRefs are rare build prerequisites, never navigation order.
- scope.outputRefs lists the screens to design now, in order. scope.goal says in one sentence what these screens let people do.
Return JSON only.`;

export const PROPOSAL_READY_REPLY = "The screen flow is ready to review. Use the approval card to start generation.";

async function roadmapRows(admin: PlanningStore, projectId: string, ownerId: string): Promise<RoadmapRow[]> {
  const { data, error } = await admin.from("project_screen_roadmap")
    .select("metadata,status,generated_screen_id").eq("project_id", projectId).eq("owner_id", ownerId).neq("status", "dismissed");
  if (error) throw error;
  return (data ?? []).flatMap(row => {
    // An unreadable legacy row is left untouched rather than failing a new plan.
    const item = functionalItemSchema.safeParse(row.metadata?.functional);
    return item.success ? [{ item: item.data, status: row.status, screenId: row.generated_screen_id }] : [];
  });
}

const failure = (stage: string, code: string, summary: string): PlanningFailure =>
  ({ stage, code: code.slice(0, 100), summary: summary.slice(0, 1000), retryable: true });

function experienceReady(state: ProductPlanning) {
  try { assertExperienceReady(state); return true; } catch { return false; }
}

/** One candidate, server-owned identity and structure, then the approval card. */
export async function runProposalPlanner(input: {
  admin: PlanningStore; projectId: string; ownerId: string; clientTurnId: string; userMessageId: string;
  request: PlanningRequest; originalRequest: string; assessment: EvidenceAssessment;
  history: Array<{ id: string; role: string; content: string; metadata: Record<string, unknown> }>;
  conversation: Array<{ role: string; content: string }>;
  /** Words the user actually said this project; only these can confirm a fact. */
  userEvidence: string[];
  getState: () => ProductPlanning;
  persist: (next: ProductPlanning) => Promise<ProductPlanning>;
  commit: (next: ProductPlanning, items: FunctionalItem[], removeKeys: string[]) => Promise<ProductPlanning>;
  enqueueProjectDesign: () => Promise<void>;
  progress: (title: string, detail: string) => Promise<void>;
  onTrace?: (event: Record<string, unknown>) => void;
}): Promise<{ reply: string; failure?: PlanningFailure; performance: Trace[] }> {
  const { admin, projectId, ownerId, clientTurnId, userMessageId } = input;
  const performance: Trace[] = [];
  const trace = (event: Trace) => { performance.push(event); input.onTrace?.(event); };
  const before = input.getState();
  let current: RoadmapRow[];
  try {
    current = await roadmapRows(admin, projectId, ownerId);
  } catch (error) {
    console.warn("Screen-flow roadmap read failed", { projectId, clientTurnId, ...describeProviderError(error) });
    const summary = "The saved screen flow could not be read. Your decisions are intact — continue to try again.";
    return { reply: summary, failure: failure("screen_flow", "ROADMAP_UNAVAILABLE", summary), performance };
  }

  await input.progress("Designing screens and flow", "Mapping user tasks to screens, actions and outcomes...");
  const ai = createGeminiClient();
  const policy = geminiPolicyForTask("project_planning", {
    responseMimeType: "application/json", responseSchema: proposalResponseSchema,
    maxOutputTokens: 12000, systemInstruction: instructions,
  });
  const requestText = (retry: boolean) => JSON.stringify({
    assignment: input.originalRequest,
    latestMessage: input.request,
    userMessages: input.conversation.filter(message => message.role === "user").map(message => message.content),
    designAssessment: { screenFlowPreview: input.assessment.screenFlowPreview ?? [],
      recommendations: input.assessment.recommendations ?? [], rationale: input.assessment.rationale },
    activeFacts: activeFacts(before).map(({ id, section, label, detail, source }) => ({ id, section, label, detail, source })),
    currentRoadmap: current.map(row => ({ ...row.item, status: row.status })),
    currentSelection: before.scope?.outputKeys ?? [],
    experience: before.experience ? { direction: before.experience.direction, informationHierarchy: before.experience.informationHierarchy,
      navigation: before.experience.navigation, adaptations: before.experience.adaptations } : null,
    ...(retry ? { note: "The previous response was incomplete or not valid JSON. Return the complete plan; keep every text field concise." } : {}),
  });

  // A transient provider fault is retried inside withProviderRetry. The one
  // extra attempt here is only for a response that is unreadable or empty.
  let candidate: DesignFlowCandidate | null = null;
  for (let attempt = 0; attempt < 2 && !candidate; attempt += 1) {
    const started = Date.now();
    let response: Awaited<ReturnType<typeof ai.models.generateContent>>;
    try {
      response = await withProviderRetry(() => ai.models.generateContent({ model: policy.model, config: policy.config,
        contents: [{ role: "user", parts: [{ text: requestText(attempt > 0) }] }] }));
    } catch (error) {
      const status = providerErrorStatus(error);
      trace({ stage: "proposal", elapsedMs: Date.now() - started, errorCode: status ? `HTTP_${status}` : "PROPOSAL_UNAVAILABLE" });
      console.warn("Screen-flow proposal provider failure", { projectId, clientTurnId, ...describeProviderError(error) });
      const summary = "Drawgle's design service didn't respond, so the screen flow wasn't drafted. Your saved decisions are intact — continue to try again.";
      return { reply: summary, failure: failure("proposal", status ? `PROPOSAL_UNAVAILABLE_HTTP_${status}` : "PROPOSAL_UNAVAILABLE", summary), performance };
    }
    trace({ stage: attempt ? "proposal_retry" : "proposal", elapsedMs: Date.now() - started,
      inputTokens: response.usageMetadata?.promptTokenCount, outputTokens: response.usageMetadata?.candidatesTokenCount });
    try { candidate = normalizeDesignFlowCandidate(JSON.parse(response.text || "")); } catch { candidate = null; }
    if (!candidate) trace({ stage: "proposal_unusable", elapsedMs: 0, errorCode: String(response.candidates?.[0]?.finishReason ?? "EMPTY").slice(0, 40) });
  }
  if (!candidate) {
    const summary = "The screen-flow draft came back incomplete. Your saved decisions are intact — continue to try again.";
    return { reply: summary, failure: failure("proposal", "PROPOSAL_UNUSABLE", summary), performance };
  }

  let draft: ProductPlanning;
  let mapped: ReturnType<typeof candidateRoadmap>;
  const assemblyStarted = Date.now();
  try {
    const structured = ensureStructuralFacts(candidate, before, input.originalRequest);
    const ids = candidateFactPatch(structured, before, projectId, clientTurnId, input.userEvidence);
    const prepared = prepareDesignerPatch("update_product", ids.args, input.userEvidence, input.history, input.assessment);
    const safe = reconcileCandidateFactEvidence(before, prepared.patch, ids);
    // The candidate replaces the scope, so an older scope never constrains fact changes.
    const factState = safe.patch.operations.length ? applyProductPatch({ ...before, scope: null }, safe.patch, userMessageId) : before;
    mapped = candidateRoadmap(structured, factState, current, safe.aliases, safe.superseded, projectId, clientTurnId);
    const oldScope = before.scope;
    const scopeChanged = !oldScope || JSON.stringify({ goal: oldScope.goal, rationale: oldScope.rationale,
      surfaceIds: oldScope.surfaceIds, outputKeys: oldScope.outputKeys, manifest: oldScope.manifest })
      !== JSON.stringify({ goal: mapped.scope.goal, rationale: mapped.scope.rationale,
        surfaceIds: mapped.scope.surfaceIds, outputKeys: mapped.scope.outputKeys, manifest: mapped.scope.manifest });
    const contentChanged = JSON.stringify(factState.blueprint) !== JSON.stringify(before.blueprint)
      || mapped.itemsToSave.length > 0 || mapped.removeKeys.length > 0 || scopeChanged;
    draft = { ...factState, contentRevision: (before.contentRevision ?? 0) + (contentChanged ? 1 : 0), scope: mapped.scope };
    trace({ stage: "candidate_assembly", elapsedMs: Date.now() - assemblyStarted });
  } catch (error) {
    if (error instanceof PlanningConflict) throw error;
    trace({ stage: "candidate_assembly", elapsedMs: Date.now() - assemblyStarted, errorCode: "FLOW_ASSEMBLY" });
    console.warn("Screen-flow assembly failed", { projectId, clientTurnId,
      message: error instanceof Error ? error.message.slice(0, 300) : "unknown" });
    const summary = "Drawgle couldn't assemble this screen flow. Your saved decisions are intact — continue to try again.";
    return { reply: summary, failure: failure("screen_flow", "FLOW_ASSEMBLY", summary), performance };
  }
  try {
    await input.commit(draft, mapped.itemsToSave, mapped.removeKeys);
  } catch (error) {
    if (error instanceof PlanningConflict) throw error;
    console.warn("Screen-flow save failed", { projectId, clientTurnId, ...describeProviderError(error) });
    const summary = "The screen flow could not be saved. Your previous decisions remain intact.";
    return { reply: summary, failure: failure("screen_flow", "SAVE_FAILED", summary), performance };
  }

  let state = input.getState();
  let designPreparation: Promise<void> | null = null;
  let stage: ProposalStage = "reference_inspection";
  try {
    // The visual direction is the premium-quality input. It is established once
    // and reused until the reference or the user's explicit design requirements change.
    if (!experienceReady(state)) {
      await input.progress("Analyzing design direction", "Checking the saved visual requirements and reference...");
      const started = Date.now();
      const inspected = await inspectProductReference(admin, ownerId, state,
        [input.originalRequest, input.request.kind === "continue" ? "" : input.request.text].filter(Boolean).join("\n\n"),
        event => trace(event));
      trace({ stage: "reference", elapsedMs: Date.now() - started });
      stage = "reference_save";
      await input.persist({ ...state, contentRevision: (state.contentRevision ?? 0) + 1,
        experience: inspected.experience,
        input: { ...state.input, imagePath: inspected.experience.referencePath,
          referenceSource: !inspected.experience.referencePath ? "none"
            : inspected.experience.referenceId ? "curated" : "user" } });
      // Token preparation is speculative and independent of the approval card.
      designPreparation = input.enqueueProjectDesign().catch(() => undefined);
      state = input.getState();
    }
    stage = "scope_validation";
    await input.progress("Finalizing screen flow", "Preparing the screens for your approval...");
    const proposed = proposeProductScope(state);
    stage = "scope_save";
    await input.persist(proposed);
    return { reply: PROPOSAL_READY_REPLY, performance };
  } catch (error) {
    if (error instanceof PlanningConflict) throw error;
    const diagnostic = describeProposalFailure(stage, error);
    trace({ stage: `${stage}_failure`, elapsedMs: 0, errorCode: diagnostic.code });
    console.warn("Screen-flow finalization failed", { projectId, clientTurnId, stage, code: diagnostic.code,
      ...describeProviderError(error) });
    return { reply: diagnostic.summary, failure: diagnostic, performance };
  } finally {
    await designPreparation;
  }
}
