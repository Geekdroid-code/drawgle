import "server-only";
import { createPartFromFunctionResponse, type Content, type Part } from "@google/genai";
import { createGeminiClient } from "@/lib/ai/gemini";
import { geminiPolicyForTask } from "@/lib/ai/model-policy";
import { createProjectReadToolExecutor, projectReadToolDeclarations } from "@/lib/agent/project-tools";
import { fetchProjectMessages, insertProjectMessage } from "@/lib/supabase/queries";
import type { PromptImagePayload } from "@/lib/types";
import { activeFacts, applyProductPatch, productPatchSchema, proposeProductScope, readinessIssues } from "./model";
import { designerInstructions, designerToolDeclarations } from "./designer-tools";
import { loadProductPlanning, saveProductPlanning, PlanningConflict, type PlanningStore } from "./store";
import { loadPlanningReference, storePlanningReference } from "./references";
import { reviewProductReadiness } from "./readiness";
import { persistProjectMessageMemoryPair } from "@/lib/generation/message-memory";
import { assessProductEvidence } from "./assess-evidence";
import { confirmedMessageEvidence, productMessageContext, readProductQuestions, resolveProductAnswers, type ProductAnswers } from "./questions";
import { evidenceAllowsProposal } from "./evidence";
import { inspectProductReference } from "./inspect-reference";
import { readFunctionalRoadmap, updateFunctionalRoadmap, snapshotFunctionalScope } from "./functional-store";

export async function runProductDesigner({ admin, projectId, ownerId, prompt, image, imageReferenceMode = "style", clientTurnId, productAnswers, initialize = false, existingUserMessageId, onTrace, enqueueMemory = true }: {
  admin: PlanningStore; projectId: string; ownerId: string; prompt: string;
  image?: PromptImagePayload | null; imageReferenceMode?: "style" | "recreate";
  clientTurnId: string; productAnswers?: ProductAnswers; initialize?: boolean; existingUserMessageId?: string;
  onTrace?: (event: Record<string, unknown>) => void;
  enqueueMemory?: boolean;
}) {
  let state = await loadProductPlanning(admin, projectId, ownerId);
  if (!state) throw new Error("Product planning is not enabled for this project.");
  if (initialize && state.initialTurnComplete) return { intent: "product_planning", alreadyComplete: true };
  const history = await fetchProjectMessages(admin, projectId, 40);
  const completedTurn = history.find((message) => message.role === "model" && message.metadata.productTurnComplete === clientTurnId);
  if (completedTurn) return { intent: "product_planning", message: completedTurn.content };
  let resolvedAnswers: ReturnType<typeof resolveProductAnswers> | undefined;
  if (productAnswers) {
    try { resolvedAnswers = resolveProductAnswers(history, productAnswers, clientTurnId); }
    catch (error) { throw new PlanningConflict(error instanceof Error ? error.message : "These questions have changed."); }
    prompt = resolvedAnswers.content;
  }
  if (state.lease && Date.parse(state.lease.expiresAt) > Date.now()) throw new PlanningConflict("Drawgle is finishing the current product turn. Please try again shortly.");
  state = await saveProductPlanning(admin, projectId, ownerId, state, {
    ...state, lease: { id: clientTurnId, expiresAt: new Date(Date.now() + 240_000).toISOString() },
    evidenceAssessment: null,
    scope: state.scope?.status === "proposed" ? { ...state.scope, status: "draft" } : state.scope,
  });
  const persist = async (next: typeof state) => {
    const renewed = next?.lease?.id === clientTurnId
      ? { ...next, lease: { ...next.lease, expiresAt: new Date(Date.now() + 240_000).toISOString() } }
      : next!;
    state = await saveProductPlanning(admin, projectId, ownerId, state!, renewed);
  };
  try {
    const initialMessage = history.find((message) => message.metadata.action === "product_initial_prompt");
    const previousUser = history.find((message) => message.role === "user" && message.metadata.clientTurnId === clientTurnId);
    const userMessageId = existingUserMessageId ?? (initialize ? initialMessage?.id : previousUser?.id) ?? (await insertProjectMessage(admin, {
      projectId, ownerId, role: "user", content: prompt || "[image]", metadata: { action: "agent_turn_user", clientTurnId, image: image ?? null, ...(productAnswers ? { productAnswers, productAnswerEvidence: resolvedAnswers!.confirmed } : {}) },
    })).id;
    const effectivePrompt = initialize ? initialMessage?.content ?? prompt : prompt;
    if (image) {
      const imagePath = await storePlanningReference(admin, ownerId, image);
      await persist({ ...state, contentRevision: (state.contentRevision ?? 0) + 1, experience: null, input: { ...state.input, imagePath, imageReferenceMode, stylePresetSlug: null }, scope: state.scope ? { ...state.scope, status: "draft" } : null });
    }
    const reference = image ?? await loadPlanningReference(admin, state.input.imagePath, ownerId);
    const assessment = await assessProductEvidence({ state, prompt: effectivePrompt, turnId: clientTurnId,
      history: history.map(message => ({ role: message.role, content: productMessageContext(message) })), reference });
    const requestedMode = assessment.mode === "recreate" ? "recreate" : "style";
    if (assessment.mode !== "clarify_mode" && assessment.modeChangeEvidence && requestedMode !== state.input.imageReferenceMode) {
      await persist({ ...state, contentRevision: (state.contentRevision ?? 0) + 1, experience: null,
        input: { ...state.input, imageReferenceMode: requestedMode }, scope: state.scope ? { ...state.scope, status: "draft" } : null });
    }
    await persist({ ...state, designerVersion: 2, evidenceAssessment: assessment });
    const contents: Content[] = [{ role: "user", parts: [
      { text: JSON.stringify({ currentProduct: { ...state, blueprint: { facts: activeFacts(state) } }, history: history.map((message) => ({ id: message.id, role: message.role, content: productMessageContext(message).slice(0, 6000) })), userMessage: effectivePrompt }) },
      { text: `Independent evidence assessment: ${JSON.stringify(assessment)}. These user-dependent gaps cannot be resolved by inventing facts this turn. The chat automatically renders the questions and choices as optional interactive cards. Do not repeat them or add prose questions. Update known product truth first. Do not present a final screen list or claim readiness while gaps remain.` },
      ...(reference ? [{ inlineData: { data: reference.data, mimeType: reference.mimeType } }] : []),
    ] }];
    const executeRead = createProjectReadToolExecutor({ admin, projectId, ownerId });
    const ai = createGeminiClient();
    const policy = geminiPolicyForTask("project_planning", {
      systemInstruction: designerInstructions,
      tools: [{ functionDeclarations: [...designerToolDeclarations.filter(tool =>
        (tool.name !== "propose_scope" || evidenceAllowsProposal(assessment))
        && (assessment.productReady || !["set_design_scope", "update_functional_plan"].includes(tool.name ?? ""))), ...projectReadToolDeclarations] }],
    });
    let reply = "";
    let attemptedProposal = false;
    for (let round = 0; round < 8; round += 1) {
      const response = await ai.models.generateContent({ model: policy.model, config: policy.config, contents });
      const calls = response.functionCalls ?? [];
      onTrace?.({ round, finishReason: response.candidates?.[0]?.finishReason, tools: calls.map((call) => call.name), hasReply: !calls.length && Boolean(response.text?.trim()) });
      if (!calls.length) { reply = response.text?.trim() ?? ""; break; }
      const content = response.candidates?.[0]?.content;
      if (content) contents.push(content);
      const responses: Part[] = [];
      // Writes deliberately run sequentially, so later tools observe earlier validated changes.
      for (const call of calls) {
        if (call.name === "propose_scope") attemptedProposal = true;
        let result: Record<string, unknown>;
        try {
          if (!assessment.productReady && ["set_design_scope", "update_functional_plan"].includes(call.name ?? "")) throw new Error("Resolve the material product questions with the user before choosing concrete screens.");
          if (call.name === "update_product" || call.name === "set_design_scope") {
            const args = call.args ?? {};
            const operations = call.name === "set_design_scope" ? [{ ...args, op: "set_scope" }] : [
              ...(Array.isArray(args.facts) ? args.facts.map((fact) => ({ op: "put_fact", fact })) : []),
              ...(Array.isArray(args.supersessions) ? args.supersessions.map((entry) => ({ ...entry, op: "supersede_fact" })) : []),
            ];
            const patch = productPatchSchema.parse({ operations });
            const userEvidence = [...history.filter((message) => message.role === "user").flatMap(confirmedMessageEvidence), ...(resolvedAnswers ? resolvedAnswers.confirmed : [effectivePrompt])];
            const normalizeQuote = (text: string) => text.toLowerCase().replace(/[“”‘’"']/g, "").replace(/\s+/g, " ").trim();
            const assumptions: string[] = [];
            for (const operation of patch.operations) {
              const fact = operation.op === "put_fact" ? operation.fact : operation.op === "supersede_fact" ? operation.replacement : null;
              if (fact?.source === "user" && (!fact.evidence || !userEvidence.some((quote) => normalizeQuote(quote).includes(normalizeQuote(fact.evidence))))) {
                fact.source = "assumption";
                assumptions.push(fact.id);
              }
              if (fact) {
                fact.provenance ??= { basis: fact.source === "user" ? "direct" : "inferred", recommendationMessageId: null };
                if (fact.provenance.basis === "accepted_recommendation" && (!history.some(message => message.role === "model" && message.id === fact.provenance!.recommendationMessageId) || fact.source !== "user")) throw new Error("An accepted recommendation needs its prior assistant message and a user acceptance quote.");
                if (fact.provenance.basis === "delegated") {
                  if (!assessment.delegation) throw new Error("The user has not delegated this decision in the evidence assessment.");
                  fact.source = "assumption";
                }
                if (fact.provenance.basis === "reference_observation") fact.source = "assumption";
                if (fact.source === "assumption" && fact.provenance.basis === "direct") fact.provenance.basis = "inferred";
              }
            }
            await persist(applyProductPatch(state, patch, userMessageId));
            result = { ok: true, revision: state.revision, facts: activeFacts(state), scope: state.scope,
              ...(assumptions.length ? { warning: "These facts were saved as assumptions because their evidence did not quote a user message. Do not describe them as confirmed.", assumptionIds: assumptions } : {}),
            };
          } else if (call.name === "read_functional_plan") {
            result = { ok: true, items: await readFunctionalRoadmap(admin, projectId, ownerId) };
          } else if (call.name === "update_functional_plan") {
            state = await updateFunctionalRoadmap(admin, projectId, ownerId, state, call.args);
            result = { ok: true, revision: state.revision };
          } else if (call.name === "inspect_reference") {
            const inspected = await inspectProductReference(admin, ownerId, state, String(call.args?.request ?? effectivePrompt));
            await persist({ ...state, contentRevision: (state.contentRevision ?? 0) + 1, experience: inspected.experience,
              input: { ...state.input, imagePath: inspected.experience.referencePath,
                imageReferenceMode: state.input.imagePath ? state.input.imageReferenceMode : "style" },
              scope: state.scope ? { ...state.scope, status: "draft" } : null });
            result = { ok: true, experience: inspected.experience };
            responses.push({ inlineData: { data: inspected.image.data, mimeType: inspected.image.mimeType } });
          } else if (call.name === "propose_scope") {
            if (!evidenceAllowsProposal(state.evidenceAssessment)) throw new Error("Discuss the evidence assessment's unresolved questions with the user first.");
            if (!state.experience) throw new Error("Inspect a reference and establish an experience direction before proposing designs.");
            const proposed = proposeProductScope(await snapshotFunctionalScope(admin, projectId, ownerId, state));
            const review = await reviewProductReadiness(proposed, effectivePrompt);
            if (!review.ready) throw new Error(`Product understanding needs work before proposing: ${review.issues.join(" ")}`);
            await persist(proposed);
            result = { ok: true, scope: state.scope, message: "Approval card will be displayed. Ask the user to approve it." };
          } else if (call.name === "read_product") {
            result = { ok: true, facts: activeFacts(state), scope: state.scope, readinessIssues: readinessIssues(state) };
          } else result = { ...await executeRead(call) };
        } catch (error) {
          if (error instanceof PlanningConflict) throw error;
          result = { ok: false, error: error instanceof Error ? error.message : "Invalid product update.",
            ...(call.name === "set_design_scope" || call.name === "update_functional_plan" ? {
              activeSurfaceIds: activeFacts(state, "surfaces").map(fact => fact.id),
              activeJourneyIds: activeFacts(state, "journeys").map(fact => fact.id),
              hint: "The rejected delta made no changes. Use blueprint IDs for surfaceIds/journeyIds and roadmap keys for outputKeys. Include all newly linked outputs in one functional delta; state items need parentStableKey, stateKey, triggerLabel and editInstruction.",
            } : {}),
          };
        }
        responses.push(createPartFromFunctionResponse(call.id ?? crypto.randomUUID(), call.name ?? "unknown", result));
        onTrace?.({ tool: call.name, ok: result.ok, error: result.error });
      }
      contents.push({ role: "user", parts: responses });
    }
    if (attemptedProposal && state.scope?.status !== "proposed") {
      reply = "I’ve saved the product decisions, but couldn’t finish validating the screen flow. The scope isn’t ready for approval, and no generation has started. I can continue from the saved roadmap.";
    }
    const questions = readProductQuestions({ productQuestions: assessment.gaps });
    if (questions && !attemptedProposal) reply = "Let’s shape how this works. Choose an answer below, write your own, or skip and I’ll recommend a direction.";
    if (!reply && state.scope?.status === "proposed") reply = "The current scope is ready to review. Use the approval card when you'd like me to start.";
    if (!reply) throw new Error("I couldn't complete this product turn. Your saved decisions are intact; please try again.");
    const modelMessage = await insertProjectMessage(admin, { projectId, ownerId, role: "model", content: reply, metadata: {
      clientTurnId, userMessageId, productTurnComplete: clientTurnId,
      ...(questions ? { productQuestions: questions } : {}),
      productScopeProposal: state.scope?.status === "proposed" ? { scope: state.scope, revision: state.revision, surfaces: activeFacts(state, "surfaces") } : null,
    } });
    await persist({ ...state, initialTurnComplete: true, lease: null });
    if (enqueueMemory) await persistProjectMessageMemoryPair({ admin, userMessageId, userContent: effectivePrompt, modelMessageId: modelMessage.id, modelContent: productMessageContext({ content: reply, metadata: { productQuestions: questions } }) })
      .catch((error) => console.error("Could not enqueue product conversation memory", error));
    return { intent: "product_planning", message: reply };
  } finally {
    if (state.lease?.id === clientTurnId) await persist({ ...state, lease: null }).catch(() => undefined);
  }
}
