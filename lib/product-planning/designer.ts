import "server-only";
import { tasks } from "@trigger.dev/sdk";
import { createHash } from "node:crypto";
import { SCREEN_REFERENCE_INSTRUCTION } from "@/lib/generation/reference-authority";
import { createPartFromFunctionResponse, type Content, type Part } from "@google/genai";
import { createGeminiClient } from "@/lib/ai/gemini";
import { geminiPolicyForTask } from "@/lib/ai/model-policy";
import { createProjectReadToolExecutor, projectReadToolDeclarations } from "@/lib/agent/project-tools";
import { fetchProjectMessages, insertProjectMessage, updateProjectMessage } from "@/lib/supabase/queries";
import type { PromptImagePayload } from "@/lib/types";
import { referenceRecoveryQuestions, validateReferencePreference } from "./reference-preference";
import { reviewFactEvidence } from "./review-fact-evidence";
import { prepareDesignerPatch } from "./designer-patch";
import { createDesignerFactIds } from "./designer-fact-ids";
import { ProductToolError, type PlanningFailure } from "./tool-failure";
import { describeToolFailure } from "./tool-failure-diagnostics";
import { activeFacts, applyProductPatch, blockingScreenQuestions, proposeProductScope, readinessIssues, type ProductPlanning } from "./model";
import { designerInstructions, designerToolDeclarations } from "./designer-tools";
import { loadProductPlanning, saveProductPlanning, PlanningConflict, type PlanningStore } from "./store";
import { loadPlanningReference, storePlanningReference } from "./references";
import { reviewProductReadiness } from "./readiness";
import { persistProjectMessageMemoryPair } from "@/lib/generation/message-memory";
import { assessProductEvidence } from "./assess-evidence";
import { confirmedMessageEvidence, resolvedDecisionKeys, productMessageContext, readProductQuestions, resolveProductAnswers, type ProductAnswers } from "./questions";
import { normalizePlanningInput, planningReferenceContext } from "./reference-context";
import { reconcileAnsweredQuestions } from "./answered-questions";
import { evidenceAllowsProposal } from "./evidence";
import { inspectProductReference } from "./inspect-reference";
import { readFunctionalRoadmap, updateFunctionalRoadmap, snapshotFunctionalScope, saveProductPatchWithRoadmap } from "./functional-store";
import { reconstructionInstructions, reconstructionProductContext } from "./reconstruction";
import { updateWorkTrace, type WorkTrace } from "@/lib/agent/work-trace";
import { earlyDesignMode, mayPrepareProjectDesign } from "./project-design-preparation";
import { orderDesignerCalls } from "./designer-call-order";
import { runProposalPlanner } from "./proposal-runner";
import type { FunctionalItem } from "./functional-plan";
import { projectDesignTaskIdentity } from "./project-design-task";
import { enqueueScopePreparation } from "./scope-preparation-task";

export async function runProductDesigner({ admin, projectId, ownerId, prompt, originalPrompt, image, imageReferenceMode = "style", clientTurnId, productAnswers, initialize = false, resumeReview = false, existingUserMessageId, onTrace, enqueueMemory = true }: {
  admin: PlanningStore; projectId: string; ownerId: string; prompt: string; originalPrompt?: string;
  image?: PromptImagePayload | null; imageReferenceMode?: "style" | "recreate";
  clientTurnId: string; productAnswers?: ProductAnswers; initialize?: boolean; resumeReview?: boolean; existingUserMessageId?: string;
  onTrace?: (event: Record<string, unknown>) => void;
  enqueueMemory?: boolean;
}) {
  let state = await loadProductPlanning(admin, projectId, ownerId);
  if (!state) throw new Error("Product planning is not enabled for this project.");
  if (initialize && state.initialTurnComplete) return { intent: "product_planning", alreadyComplete: true };
  const history = await fetchProjectMessages(admin, projectId, 40);
  const completedTurn = history.find((message) => message.role === "model" && message.metadata.productTurnComplete === clientTurnId);
  if (completedTurn) return { intent: "product_planning", message: completedTurn.content };
  if (state.lastProposalOperationId === clientTurnId) {
    throw new PlanningConflict("This request already saved design changes. Refresh the current flow before retrying.");
  }
  let resolvedAnswers: ReturnType<typeof resolveProductAnswers> | undefined;
  if (productAnswers) {
    try { resolvedAnswers = resolveProductAnswers(history, productAnswers, clientTurnId); }
    catch (error) { throw new PlanningConflict(error instanceof Error ? error.message : "These questions have changed."); }
    prompt = resolvedAnswers.content;
  }
  const resumeSavedReview = process.env.DRAWGLE_PLANNING_REPAIR_ENABLED === "true" && resumeReview && !image && !productAnswers
    && Boolean(state.scope?.reviewIssues?.length && state.evidenceAssessment
      && state.scope.reviewedContentRevision === (state.contentRevision ?? 0));
  if (state.lease && Date.parse(state.lease.expiresAt) > Date.now()) throw new PlanningConflict("Drawgle is finishing the current product turn. Please try again shortly.");
  state = await saveProductPlanning(admin, projectId, ownerId, state, {
    ...state, input: normalizePlanningInput(state), lease: { id: clientTurnId, expiresAt: new Date(Date.now() + 240_000).toISOString() },
    evidenceAssessment: resumeSavedReview ? state.evidenceAssessment : null,
    scope: state.scope?.status === "proposed" ? { ...state.scope, status: "draft" } : state.scope,
  });
  const persist = async (next: ProductPlanning, updateRoadmap = false): Promise<ProductPlanning> => {
    const renewed = next?.lease?.id === clientTurnId
      ? { ...next, lease: { ...next.lease, expiresAt: new Date(Date.now() + 240_000).toISOString() } }
      : next!;
    state = updateRoadmap
      ? await saveProductPatchWithRoadmap(admin, projectId, ownerId, state!, renewed)
      : await saveProductPlanning(admin, projectId, ownerId, state!, renewed);
    return state;
  };
  const commitCandidate = async (next: ProductPlanning, items: FunctionalItem[], removeKeys: string[]): Promise<ProductPlanning> => {
    const current = state!;
    const saved = { ...next, revision: current.revision + 1, lastProposalOperationId: clientTurnId,
      lease: { id: clientTurnId, expiresAt: new Date(Date.now() + 240_000).toISOString() } };
    const { error } = await admin.rpc("update_product_functional_plan", {
      input_project_id: projectId, input_owner_id: ownerId, input_revision: current.revision,
      input_state: saved, input_items: items, input_remove_keys: removeKeys,
    });
    if (error) {
      if (error.code === "40001") throw new PlanningConflict("The product plan changed in another turn. Review the current flow.");
      throw error;
    }
    state = saved;
    return saved;
  };
  const enqueueProjectDesign = async () => {
    if (earlyDesignMode() === "off" || !state || !mayPrepareProjectDesign(state)) return;
    try {
      const { idempotencyKey } = await projectDesignTaskIdentity(state, projectId);
      await tasks.trigger("prepare-project-design", { projectId, ownerId, queuedAt: new Date().toISOString() }, {
        idempotencyKey, idempotencyKeyTTL: "1d",
      });
    } catch {
      // Speculative preparation never blocks the approval card or planning turn.
    }
  };
  let progressMessageId: string | null = null;
  let workTrace: WorkTrace | null = null;
  let currentProgressUserMessageId = existingUserMessageId;
  const reportProgress = async (
    title: string,
    detail: string,
    status: "thinking" | "completed" | "failed" = "thinking",
  ) => {
    try {
      workTrace = updateWorkTrace(workTrace, {
        turnId: clientTurnId, id: title.toLowerCase(), title, detail,
        stepStatus: status === "thinking" ? "active" : status,
        ...(status !== "thinking" ? { turnStatus: status } : {}),
      });
      const metadata = {
        action: "agent_turn_progress",
        ui: { variant: "action_card" },
        userMessageId: currentProgressUserMessageId,
        clientTurnId,
        workTrace,
        agentStep: {
          kind: "system",
          status,
          title,
          detail,
        },
      };
      if (progressMessageId) {
        await updateProjectMessage(admin, {
          messageId: progressMessageId,
          content: title,
          metadata,
        }).catch(() => undefined);
      } else {
        const inserted = await insertProjectMessage(admin, {
          projectId,
          ownerId,
          role: "system",
          content: title,
          metadata,
        }).catch(() => undefined);
        if (inserted?.id) {
          progressMessageId = inserted.id;
        }
      }
    } catch {
      // Observational progress updates should never interrupt or break the planning turn
    }
  };
  try {
    const initialMessage = history.find((message) => message.metadata.action === "product_initial_prompt");
    const previousUser = history.find((message) => message.role === "user" && message.metadata.clientTurnId === clientTurnId);
    const userMessageId = existingUserMessageId ?? (initialize ? initialMessage?.id : previousUser?.id) ?? (await insertProjectMessage(admin, {
      projectId, ownerId, role: "user", content: prompt || "[image]", metadata: { action: "agent_turn_user", clientTurnId, image: image ?? null, ...(productAnswers ? { productAnswers, productAnswerEvidence: resolvedAnswers!.confirmed } : {}) },
    })).id;
    currentProgressUserMessageId = userMessageId;
    const answeredState = reconcileAnsweredQuestions(state, [
      ...history,
      ...(productAnswers ? [{ id: userMessageId, role: "user", metadata: { productAnswers } }] : []),
    ]);
    if (answeredState !== state) await persist(answeredState);
    await reportProgress("Reviewing product requirements", "Reviewing your product vision and user goals...");
    const conversation = [
      ...(originalPrompt ? [{ role: "user", content: originalPrompt }] : []),
      ...history.filter(message => message.metadata.action !== "product_flow_preview")
        .map(message => ({ role: message.role, content: productMessageContext(message) })),
    ];
    const effectivePrompt = initialize ? initialMessage?.content ?? prompt : prompt;
    const originalRequest = state.input.originalRequest ?? initialMessage?.content ?? originalPrompt ?? effectivePrompt;
    if (!state.input.originalRequest) {
      await persist({ ...state, input: { ...state.input, originalRequest: originalRequest.slice(0, 30000) } });
    }
    if (!initialize && !productAnswers && !image && state.input.imageReferenceMode === "recreate" && effectivePrompt.trim()) {
      const existingChanges = state.input.recreationChanges ?? [];
      if (!existingChanges.some(change => change.messageId === userMessageId)) {
        const nextChanges = [...existingChanges, { messageId: userMessageId, request: effectivePrompt }].slice(-100);
        await persist({ ...state, input: { ...state.input, recreationChanges: nextChanges } });
      }
    }
    // Resolve the server-owned recovery choice only after history/revision validation.
    const recoveryMessage = productAnswers && history.find(message => message.id === productAnswers.messageId);
    if (recoveryMessage?.metadata.referenceRecovery === true && productAnswers?.answers[0]?.kind === "choice" && productAnswers.answers[0].index === 2) {
      await persist(applyProductPatch(state, { operations: [{ op: "set_reference_preference", mode: "none", evidence: resolvedAnswers!.confirmed[0] }] }, userMessageId));
    }
    if (image && state.phase === "canvas") {
      const imagePath = await storePlanningReference(admin, ownerId, image, "style");
      const stored = await loadPlanningReference(admin, imagePath, ownerId);
      if (!stored) throw new Error("The attached image could not be saved. Please retry.");
      await persist({ ...state, screenReference: { imagePath, hash: createHash("sha256").update(stored.data).digest("hex") },
        contentRevision: (state.contentRevision ?? 0) + 1,
        scope: state.scope ? { ...state.scope, status: "draft" } : null });
    } else if (image) {
      const imagePath = await storePlanningReference(admin, ownerId, image, imageReferenceMode);
      await persist({
        ...state,
        contentRevision: (state.contentRevision ?? 0) + 1,
        experience: null,
        input: {
          ...state.input,
          imagePath,
          referenceSource: "user",
          imageReferenceMode,
          stylePresetSlug: null,
          referencePreference: undefined,
          ...(imageReferenceMode === "recreate" ? { recreationRequest: prompt || effectivePrompt, recreationChanges: [] } : {}),
        },
        scope: state.scope ? { ...state.scope, status: "draft" } : null,
      });
    }
    const reference = (state.phase === "canvas" ? null : image) ?? await loadPlanningReference(admin, state.input.imagePath, ownerId);
    if (state.input.imagePath && !reference) throw new Error("The saved reference could not be loaded. Retry or replace it using the image controls.");
    const answeredKeys = [...new Set([...(state.resolvedDecisionKeys ?? []), ...resolvedDecisionKeys([
      ...history, ...(productAnswers ? [{ id: userMessageId, role: "user", metadata: { productAnswers } }] : []),
    ])])].slice(-500);
    const assessmentTrace: Array<{ stage: string; elapsedMs: number; inputTokens?: number; outputTokens?: number }> = [];
    await reportProgress("Evaluating product scope", "Checking core capabilities, actors, and constraints...");
    const assessment = resumeSavedReview ? state.evidenceAssessment! : productAnswers
      ? {
          turnId: clientTurnId,
          mode: (state.input.imageReferenceMode === "recreate" ? "recreate" : "product") as "product" | "recreate",
          productReady: true,
          experienceReady: true,
          gaps: [],
          recommendations: [],
          delegation: "",
          rationale: "User provided answers to previous screen-design questions.",
        }
      : await assessProductEvidence({
          state,
          prompt: effectivePrompt,
          turnId: clientTurnId,
          history: conversation,
          reference,
          resolvedDecisionKeys: answeredKeys,
          onTrace: event => { assessmentTrace.push(event); onTrace?.(event); },
        });
    await persist({ ...state, designerVersion: 2, resolvedDecisionKeys: answeredKeys, evidenceAssessment: assessment });
    if (!assessment.productReady && assessment.gaps.length > 0) {
      const questions = readProductQuestions({ productQuestions: assessment.gaps });
      if (questions) {
        const reply = "Let's shape the screens and flow. Choose an answer below, write your own, or skip and I'll recommend a direction.";
        const modelMessage = await insertProjectMessage(admin, { projectId, ownerId, role: "model", content: reply, metadata: {
          clientTurnId, userMessageId, productTurnComplete: clientTurnId, productQuestions: questions, productScopeProposal: null,
        } });
        await persist({ ...state, initialTurnComplete: true, lease: null });
        await reportProgress("Product design ready", reply, "completed");
        if (enqueueMemory) await persistProjectMessageMemoryPair({ admin, userMessageId, userContent: effectivePrompt,
          modelMessageId: modelMessage.id, modelContent: productMessageContext({ content: reply, metadata: { productQuestions: questions } }) })
          .catch((error) => console.error("Could not enqueue product conversation memory", error));
        return { intent: "product_planning", message: reply };
      }
    }
    const earlyFlow = "screenFlowPreview" in assessment && Array.isArray(assessment.screenFlowPreview)
      ? assessment.screenFlowPreview.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).slice(0, 4)
      : [];
    if (!resumeSavedReview && state.phase === "discovery" && assessment.productReady && earlyFlow.length > 0 && !history.some(message =>
      message.metadata.action === "product_flow_preview" && message.metadata.clientTurnId === clientTurnId)) {
      await insertProjectMessage(admin, {
        projectId, ownerId, role: "model",
        content: `From your brief, I’m shaping this screen flow:\n\n${earlyFlow.map(item => `- ${item}`).join("\n")}\n\nThis is a draft while I check the detailed flow. No screens have been generated.`,
        metadata: { action: "product_flow_preview", clientTurnId, userMessageId },
      });
    }
    const isReconstruction = state.phase !== "canvas" && state.input.imageReferenceMode === "recreate" && Boolean(state.input.imagePath);
    if (state.planningProtocol === "proposal_v1" && process.env.DRAWGLE_DESIGN_FLOW_PLANNER === "proposal"
      && !isReconstruction && state.phase === "discovery") {
      const result = await runProposalPlanner({
        admin, projectId, ownerId, clientTurnId, userMessageId, prompt: effectivePrompt,
        originalRequest, assessment, history, conversation, resumeSavedReview,
        getState: () => state!, persist, commit: commitCandidate,
        enqueueProjectDesign, progress: (title, detail) => reportProgress(title, detail), onTrace,
      });
      const modelMessage = await insertProjectMessage(admin, { projectId, ownerId, role: "model",
        content: result.reply, metadata: { clientTurnId, userMessageId, productTurnComplete: clientTurnId,
          ...(result.failure ? { productPlanningFailure: result.failure } : {}),
          planningPerformanceV1: [...assessmentTrace, ...result.performance],
          productScopeProposal: state.scope?.status === "proposed"
            ? { scope: state.scope, revision: state.revision, surfaces: activeFacts(state, "surfaces") } : null,
        } });
      await persist({ ...state, initialTurnComplete: true, lease: null });
      await enqueueProjectDesign();
      await enqueueScopePreparation(admin, projectId, ownerId, state).catch(() => undefined);
      await reportProgress(result.failure ? "Planning stopped" : "Product design ready", result.reply,
        result.failure ? "failed" : "completed");
      if (enqueueMemory) await persistProjectMessageMemoryPair({ admin, userMessageId,
        userContent: effectivePrompt, modelMessageId: modelMessage.id,
        modelContent: productMessageContext({ content: result.reply, metadata: {} }) })
        .catch((error) => console.error("Could not enqueue product conversation memory", error));
      return { intent: "product_planning", message: result.reply };
    }
    const planningSnapshot = () => {
      const current = state!;
      return JSON.stringify({
        originalUserRequest: isReconstruction ? (current.input.recreationRequest || originalPrompt) : originalPrompt,
        referenceContext: planningReferenceContext(current),
        currentProduct: isReconstruction ? reconstructionProductContext(current) : { ...current, blueprint: { facts: activeFacts(current) } },
        history: history.filter(message => message.metadata.action !== "product_flow_preview")
          .map(message => ({ id: message.id, role: message.role, content: productMessageContext(message).slice(0, 6000) })),
        userMessage: effectivePrompt,
      });
    };
    const screenReference = state.phase === "canvas" && state.screenReference
      ? await loadPlanningReference(admin, state.screenReference.imagePath, ownerId) : null;
    const contents: Content[] = [{ role: "user", parts: [
      { text: planningSnapshot() },
      { text: `Independent evidence assessment: ${JSON.stringify(assessment)}. ${resumeSavedReview ? `This turn resumes the saved flow review. Repair only these issues against the existing roadmap and facts: ${JSON.stringify(state.scope?.reviewIssues)}. Preserve valid output keys and reference evidence; do not restart discovery or add duplicate product facts.` : ""} These user-dependent gaps cannot be resolved by inventing facts this turn. The chat automatically renders the questions and choices as optional interactive cards. Do not repeat them or add prose questions. Update known product truth first. Save useful designer-owned recommendations as tentative preference facts, superseding any earlier conflicting recommendation; never treat them as user-confirmed or ask for cosmetic decisions. Do not present a final screen list or claim readiness while gaps remain.` },
      ...(screenReference ? [{ text: SCREEN_REFERENCE_INSTRUCTION }, { inlineData: { data: screenReference.data, mimeType: screenReference.mimeType } }, { text: "The following image, if present, is the established PROJECT reference, not the current attachment." }] : []),
      ...(reference ? [{ inlineData: { data: reference.data, mimeType: reference.mimeType } }] : []),
    ] }];
    const executeRead = createProjectReadToolExecutor({ admin, projectId, ownerId });
    const ai = createGeminiClient();
    const policy = geminiPolicyForTask("project_planning", {
      systemInstruction: isReconstruction ? reconstructionInstructions : designerInstructions,
      tools: [{ functionDeclarations: [...designerToolDeclarations.filter(tool =>
        (tool.name !== "propose_scope" || evidenceAllowsProposal(assessment))
        && (assessment.productReady || !["set_design_scope", "update_functional_plan"].includes(tool.name ?? ""))), ...(state.phase === "canvas" ? projectReadToolDeclarations : [])] }],
    });
    let reply = "";
    let attemptedProposal = false;
    const failures = new Map<string, PlanningFailure>();
    let repairRequests = 0;
    let referenceRecovery = false;
    const factIds = createDesignerFactIds();
    factIds.rememberActiveSuccessors(state);
    const toolProgressLabels: Record<string, { title: string; detail: string }> = {
      inspect_reference: { title: "Analyzing design reference", detail: "Observing layout hierarchy and visual language..." },
      update_product: { title: "Formulating product blueprint", detail: "Recording product capabilities and user jobs..." },
      update_functional_plan: { title: "Structuring screens & flows", detail: "Mapping screens, navigation, and user journeys..." },
      set_design_scope: { title: "Configuring design scope", detail: "Selecting active product surfaces to design..." },
      propose_scope: { title: "Reviewing screen flow", detail: "Verifying journey completion and transitions..." },
      set_reference_preference: { title: "Setting reference preference", detail: "Applying your design reference choice..." },
      read_functional_plan: { title: "Reading project plan", detail: "Checking existing roadmap items..." },
      read_product: { title: "Reading product specification", detail: "Checking blueprint architecture and facts..." },
    };
    for (let round = 0; round < 8; round += 1) {
      const roundContents = round === 0 ? contents : [
        { ...contents[0], parts: [{ text: planningSnapshot() }, ...contents[0].parts!.slice(1)] },
        ...contents.slice(1),
      ];
      const response = await ai.models.generateContent({ model: policy.model, config: policy.config, contents: roundContents });
      const requestedCalls = response.functionCalls ?? [];
      const calls = orderDesignerCalls(requestedCalls);
      onTrace?.({ round, finishReason: response.candidates?.[0]?.finishReason, tools: calls.map((call) => call.name), hasReply: !calls.length && Boolean(response.text?.trim()) });
      if (!calls.length) {
        if (failures.size && !referenceRecovery && assessment.productReady && repairRequests < 2 && round < 7) {
          repairRequests += 1;
          if (response.candidates?.[0]?.content) contents.push(response.candidates[0].content);
          contents.push({ role: "user", parts: [{ text: "The previous tools failed. Repair the saved plan using the returned errors and current roadmap before replying. Read persisted keys; do not invent missing state identities or repeat a rejected delta unchanged. Preserve the user's requested extent. Do not ask cosmetic questions or claim approval succeeded." }] });
          continue;
        }
        await reportProgress("Composing recommendations", "Preparing design direction and questions...");
        reply = response.text?.trim() ?? ""; break;
      }
      const primaryCall = calls.find(call => toolProgressLabels[call.name ?? ""]) ?? calls[0];
      const progressInfo = toolProgressLabels[primaryCall?.name ?? ""] ?? {
        title: "Refining product plan",
        detail: "Updating product specifications...",
      };
      await reportProgress(progressInfo.title, progressInfo.detail);
      const content = response.candidates?.[0]?.content;
      if (content) contents.push(content);
      const responses: Part[] = [];
      // Writes deliberately run sequentially, so later tools observe earlier validated changes.
      for (const call of calls) {
        if (call.name === "propose_scope") attemptedProposal = true;
        let result: Record<string, unknown>;
        try {
          if (!assessment.productReady && ["set_design_scope", "update_functional_plan"].includes(call.name ?? "")) throw new Error("Resolve the material screen-design questions before choosing concrete screens.");
          if (call.name === "update_product" || call.name === "set_design_scope") {
            const userEvidence = [...(originalPrompt ? [originalPrompt] : []), ...history.filter(message => message.role === "user").flatMap(confirmedMessageEvidence), ...(resolvedAnswers ? resolvedAnswers.confirmed : [effectivePrompt])];
            if (call.name === "update_product") factIds.rememberProductArgs(call.args);
            const prepared = prepareDesignerPatch(call.name, call.name === "set_design_scope" ? factIds.scopeArgs(call.args) : call.args, userEvidence, history, assessment);
            const { patch, assumptions } = prepared.patch.operations.length
              ? await reviewFactEvidence(prepared, history) : prepared;
            if (!patch.operations.length) {
              result = { ok: true, revision: state.revision, unchanged: true };
              responses.push(createPartFromFunctionResponse(call.id ?? crypto.randomUUID(), call.name ?? "unknown", result));
              failures.delete(call.name ?? "unknown");
              onTrace?.({ tool: call.name, ok: true, unchanged: true });
              continue;
            }
            if (screenReference && patch.operations.some(operation => {
              const fact = operation.op === "put_fact" ? operation.fact : operation.op === "supersede_fact" ? operation.replacement : null;
              return fact && (fact.provenance?.basis === "reference_observation" || (fact.section === "preferences" && fact.source !== "user"));
            })) throw new Error("The attachment is request-local guidance. Do not save image-derived product facts or inferred project-wide visual preferences. Only record product changes supported by the user's words.");
            let next = applyProductPatch(state, patch, userMessageId);
            if (next === state) {
              result = { ok: true, revision: state.revision, unchanged: true };
              responses.push(createPartFromFunctionResponse(call.id ?? crypto.randomUUID(), call.name ?? "unknown", result));
              failures.delete(call.name ?? "unknown");
              continue;
            }
            if (call.name === "set_design_scope") next = await snapshotFunctionalScope(admin, projectId, ownerId, next);
            await persist(next, call.name === "update_product");
            factIds.rememberActiveSuccessors(state);
            result = { ok: true, revision: state.revision, facts: activeFacts(state), scope: state.scope,
              ...(assumptions.length ? { warning: "These facts were saved as assumptions because their cited evidence did not support the entire claim. Split supported requirements from speculative additions. Do not describe them as confirmed.", assumptionIds: assumptions } : {}),
            };
          } else if (call.name === "set_reference_preference") {
            const operation = await validateReferencePreference(call.args, resolvedAnswers ? resolvedAnswers.confirmed : [effectivePrompt]);
            await persist(applyProductPatch(state, { operations: [operation] }, userMessageId));
            referenceRecovery = false;
            failures.delete("inspect_reference");
            result = { ok: true, preference: state.input.referencePreference, message: "Establish the updated experience direction with inspect_reference before proposing." };
          } else if (call.name === "read_functional_plan") {
            result = { ok: true, items: await readFunctionalRoadmap(admin, projectId, ownerId) };
          } else if (call.name === "update_functional_plan") {
            state = await updateFunctionalRoadmap(admin, projectId, ownerId, state, factIds.functionalArgs(call.args));
            result = { ok: true, revision: state.revision };
          } else if (call.name === "inspect_reference") {
            if (referenceRecovery) throw new ProductToolError("Wait for the user to choose a recovery direction. Do not repeat reference search this turn.", "NO_COMPATIBLE_REFERENCE");
            const inspected = state.phase === "canvas" && state.screenReference && state.experience
              ? { experience: state.experience }
              : await inspectProductReference(admin, ownerId, state, String(call.args?.request ?? effectivePrompt));
            await persist({ ...state, contentRevision: (state.contentRevision ?? 0) + 1, experience: inspected.experience,
              input: { ...state.input, imagePath: inspected.experience.referencePath,
                referenceSource: !inspected.experience.referencePath ? "none" : inspected.experience.referenceId || state.input.referenceSource === "curated" ? "curated" : "user",
                imageReferenceMode: state.input.imagePath ? state.input.imageReferenceMode : "style" },
              scope: state.scope ? { ...state.scope, status: "draft" } : null });
            await enqueueProjectDesign();
            result = { ok: true, experience: inspected.experience };
          } else if (call.name === "propose_scope") {
            if (!evidenceAllowsProposal(state.evidenceAssessment)) throw new Error("Discuss the evidence assessment's unresolved questions with the user first.");
            if (!state.experience) throw new Error("Inspect a reference and establish an experience direction before proposing designs.");
            const openQuestions = blockingScreenQuestions(state);
            if (openQuestions.length) throw new ProductToolError("Resolve the saved screen-design questions before proposing a scope.",
              "UNRESOLVED_PRODUCT_DECISIONS", { questions: openQuestions.map(fact => fact.label) });
            const proposed = proposeProductScope(await snapshotFunctionalScope(admin, projectId, ownerId, state));
            const review = await reviewProductReadiness(proposed, effectivePrompt, {
              history: conversation,
              roadmap: await readFunctionalRoadmap(admin, projectId, ownerId),
            });
            if (!review.ready) {
              if (process.env.DRAWGLE_PLANNING_REPAIR_ENABLED === "true") {
                await persist({ ...proposed, scope: { ...proposed.scope!, status: "draft", reviewIssues: review.issues } });
              }
              throw new ProductToolError("Repair the product flow before proposing.", "FLOW_REVIEW_FAILED", { issues: review.issues });
            }
            await persist({ ...proposed, scope: { ...proposed.scope!, ...(review.coverage ? {
              journeyCoverage: review.coverage.journeys, requestedScope: review.coverage.requestedScope, scopeEvidence: review.coverage.scopeEvidence,
            } : {}), reviewIssues: undefined } });
            failures.clear();
            result = { ok: true, scope: state.scope, message: "Approval card will be displayed. Ask the user to approve it." };
          } else if (call.name === "read_product") {
            result = { ok: true, facts: activeFacts(state), scope: state.scope, readinessIssues: readinessIssues(state) };
          } else result = { ...await executeRead(call) };
        } catch (error) {
          if (error instanceof PlanningConflict) throw error;
          if (error instanceof ProductToolError && error.code === "NO_COMPATIBLE_REFERENCE") referenceRecovery = true;
          const failure = describeToolFailure(call.name ?? "unknown", error);
          failures.set(call.name ?? "unknown", failure.diagnostic);
          console.warn("Product planning tool rejected", { projectId, clientTurnId,
            stage: failure.diagnostic.stage, code: failure.diagnostic.code,
            validationFingerprint: failure.diagnostic.validationFingerprint,
            issuePaths: failure.diagnostic.issuePaths, issueCount: failure.diagnostic.issues?.length ?? 0 });
          result = { ok: false, ...failure.feedback,
            ...(call.name === "set_design_scope" || call.name === "update_functional_plan" ? {
              activeSurfaceIds: activeFacts(state, "surfaces").map(fact => fact.id),
              activeJourneyIds: activeFacts(state, "journeys").map(fact => fact.id),
              hint: "The rejected delta made no changes. Use blueprint IDs for surfaceIds/journeyIds and roadmap keys for outputKeys. Include all newly linked outputs in one functional delta; state items need parentStableKey, stateKey, triggerLabel and editInstruction.",
            } : {}),
          };
        }
        if (result.ok) failures.delete(call.name ?? "unknown");
        const toolTitle = toolProgressLabels[call.name ?? ""]?.title ?? "Refining product plan";
        workTrace = updateWorkTrace(workTrace, {
          turnId: clientTurnId, id: toolTitle.toLowerCase(), title: toolTitle,
          detail: result.ok ? "Completed." : failures.get(call.name ?? "unknown")?.summary ?? "Needs review.",
          kind: "tool", stepStatus: result.ok ? "completed" : "failed",
        });
        responses.push(createPartFromFunctionResponse(call.id ?? crypto.randomUUID(), call.name ?? "unknown", result));
        onTrace?.({ tool: call.name, ok: result.ok, error: result.error });
      }
      // Execute in dependency order, but answer function-call IDs in the
      // model's original order to preserve its tool-response protocol.
      const responseByCall = new Map(calls.map((call, index) => [call, responses[index]]));
      contents.push({ role: "user", parts: requestedCalls.map(call => responseByCall.get(call)!) });
      if (attemptedProposal && state.scope?.status === "proposed" && failures.size === 0) {
        // The approval card is the authoritative response. A further model
        // round only paraphrases that saved scope and delays the first reply.
        reply = "The screen flow is ready to review. Use the approval card to start generation.";
        break;
      }
    }
    if (attemptedProposal && state.scope?.status !== "proposed" && !failures.size) failures.set("propose_scope", {
      stage: "propose_scope", code: "REVIEW_INCOMPLETE", summary: "The updated flow still needs a final review.", retryable: true,
    });
    const failure = [...failures.values()].at(-1);
    if (failure) reply = `${failure.summary} Your saved product decisions are intact. Continue below to finish planning; generation has not started.`;
    const questions = referenceRecovery ? referenceRecoveryQuestions : readProductQuestions({ productQuestions: assessment.gaps });
    if (referenceRecovery) reply = "The references I inspected don't support your saved direction well enough. Your requirements are preserved. Choose how to continue below.";
    if (questions && !attemptedProposal && !failure) reply = "Let's shape the screens and flow. Choose an answer below, write your own, or skip and I'll recommend a direction.";
    if (!reply && state.scope?.status === "proposed") reply = "The current scope is ready to review. Use the approval card when you'd like me to start.";
    if (!reply) throw new Error("I couldn't complete this product turn. Your saved decisions are intact; please try again.");
    const modelMessage = await insertProjectMessage(admin, { projectId, ownerId, role: "model", content: reply, metadata: {
      clientTurnId, userMessageId, productTurnComplete: clientTurnId,
      ...(questions && (!failure || referenceRecovery) ? { productQuestions: questions, ...(referenceRecovery ? { referenceRecovery: true } : {}) } : {}),
      ...(failure ? { productPlanningFailure: failure } : {}),
      productScopeProposal: state.scope?.status === "proposed" ? { scope: state.scope, revision: state.revision, surfaces: activeFacts(state, "surfaces") } : null,
    } });
    await persist({ ...state, initialTurnComplete: true, lease: null });
    await enqueueProjectDesign();
    if (state.scope?.status === "proposed" && state.phase === "discovery"
      && process.env.DRAWGLE_PROGRESSIVE_GENERATION_ENABLED === "true") {
      await tasks.trigger("prepare-product-scope", { projectId, ownerId, contentRevision: state.contentRevision ?? 0,
        queuedAt: new Date().toISOString() }, {
        idempotencyKey: `scope-preparation:${projectId}:${state.contentRevision ?? 0}`,
        idempotencyKeyTTL: "1d",
      }).catch(() => undefined);
    }
    await reportProgress(failure ? "Planning stopped" : "Product design ready",
      failure ? failure.summary : reply, failure ? "failed" : "completed");
    if (enqueueMemory) await persistProjectMessageMemoryPair({ admin, userMessageId, userContent: effectivePrompt, modelMessageId: modelMessage.id, modelContent: productMessageContext({ content: reply, metadata: { productQuestions: questions } }) })
      .catch((error) => console.error("Could not enqueue product conversation memory", error));
    return { intent: "product_planning", message: reply };
  } catch (error) {
    await reportProgress("Planning stopped", "Your saved decisions remain intact.", "failed");
    throw error;
  } finally {
    if (state.lease?.id === clientTurnId) await persist({ ...state, lease: null }).catch(() => undefined);
  }
}
