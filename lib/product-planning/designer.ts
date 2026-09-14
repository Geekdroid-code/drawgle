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

export async function runProductDesigner({ admin, projectId, ownerId, prompt, image, imageReferenceMode = "style", clientTurnId, initialize = false, existingUserMessageId, onTrace, enqueueMemory = true }: {
  admin: PlanningStore; projectId: string; ownerId: string; prompt: string;
  image?: PromptImagePayload | null; imageReferenceMode?: "style" | "recreate";
  clientTurnId: string; initialize?: boolean; existingUserMessageId?: string;
  onTrace?: (event: Record<string, unknown>) => void;
  enqueueMemory?: boolean;
}) {
  let state = await loadProductPlanning(admin, projectId, ownerId);
  if (!state) throw new Error("Product planning is not enabled for this project.");
  if (initialize && state.initialTurnComplete) return { intent: "product_planning", alreadyComplete: true };
  const history = await fetchProjectMessages(admin, projectId, 40);
  const completedTurn = history.find((message) => message.role === "model" && message.metadata.productTurnComplete === clientTurnId);
  if (completedTurn) return { intent: "product_planning", message: completedTurn.content };
  if (state.lease && Date.parse(state.lease.expiresAt) > Date.now()) throw new PlanningConflict("Drawgle is finishing the current product turn. Please try again shortly.");
  state = await saveProductPlanning(admin, projectId, ownerId, state, {
    ...state, lease: { id: clientTurnId, expiresAt: new Date(Date.now() + 240_000).toISOString() },
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
      projectId, ownerId, role: "user", content: prompt || "[image]", metadata: { action: "agent_turn_user", clientTurnId, image: image ?? null },
    })).id;
    const effectivePrompt = initialize ? initialMessage?.content ?? prompt : prompt;
    if (image) {
      const imagePath = await storePlanningReference(admin, ownerId, image);
      await persist({ ...state, input: { ...state.input, imagePath, imageReferenceMode, stylePresetSlug: null }, scope: state.scope ? { ...state.scope, status: "draft" } : null });
    }
    const reference = image ?? await loadPlanningReference(admin, state.input.imagePath, ownerId);
    const contents: Content[] = [{ role: "user", parts: [
      { text: JSON.stringify({ currentProduct: { ...state, blueprint: { facts: activeFacts(state) } }, history: history.map((message) => ({ role: message.role, content: message.content.slice(0, 6000) })), userMessage: effectivePrompt }) },
      ...(reference ? [{ inlineData: { data: reference.data, mimeType: reference.mimeType } }] : []),
    ] }];
    const executeRead = createProjectReadToolExecutor({ admin, projectId, ownerId });
    const ai = createGeminiClient();
    const policy = geminiPolicyForTask("project_planning", {
      systemInstruction: designerInstructions,
      tools: [{ functionDeclarations: [...designerToolDeclarations, ...projectReadToolDeclarations] }],
    });
    let reply = "";
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
        let result: Record<string, unknown>;
        try {
          if (call.name === "update_product" || call.name === "set_design_scope") {
            const args = call.args ?? {};
            const operations = call.name === "set_design_scope" ? [{ ...args, op: "set_scope" }] : [
              ...(Array.isArray(args.facts) ? args.facts.map((fact) => ({ op: "put_fact", fact })) : []),
              ...(Array.isArray(args.supersessions) ? args.supersessions.map((entry) => ({ ...entry, op: "supersede_fact" })) : []),
            ];
            const patch = productPatchSchema.parse({ operations });
            const userEvidence = [...history.filter((message) => message.role === "user").map((message) => message.content), effectivePrompt];
            const normalizeQuote = (text: string) => text.toLowerCase().replace(/[“”‘’"']/g, "").replace(/\s+/g, " ").trim();
            const assumptions: string[] = [];
            for (const operation of patch.operations) {
              const fact = operation.op === "put_fact" ? operation.fact : operation.op === "supersede_fact" ? operation.replacement : null;
              if (fact?.source === "user" && (!fact.evidence || !userEvidence.some((quote) => normalizeQuote(quote).includes(normalizeQuote(fact.evidence))))) {
                fact.source = "assumption";
                assumptions.push(fact.id);
              }
            }
            await persist(applyProductPatch(state, patch, userMessageId));
            result = { ok: true, revision: state.revision, facts: activeFacts(state), scope: state.scope,
              ...(assumptions.length ? { warning: "These facts were saved as assumptions because their evidence did not quote a user message. Do not describe them as confirmed.", assumptionIds: assumptions } : {}),
            };
          } else if (call.name === "propose_scope") {
            const proposed = proposeProductScope(state);
            const review = await reviewProductReadiness(state, effectivePrompt);
            if (!review.ready) throw new Error(`Product understanding needs work before proposing: ${review.issues.join(" ")}`);
            await persist(proposed);
            result = { ok: true, scope: state.scope, message: "Approval card will be displayed. Ask the user to approve it." };
          } else if (call.name === "read_product") {
            result = { ok: true, facts: activeFacts(state), scope: state.scope, readinessIssues: readinessIssues(state) };
          } else result = { ...await executeRead(call) };
        } catch (error) {
          if (error instanceof PlanningConflict) throw error;
          result = { ok: false, error: error instanceof Error ? error.message : "Invalid product update." };
        }
        responses.push(createPartFromFunctionResponse(call.id ?? crypto.randomUUID(), call.name ?? "unknown", result));
        onTrace?.({ tool: call.name, ok: result.ok, error: result.error });
      }
      contents.push({ role: "user", parts: responses });
    }
    if (!reply && state.scope?.status === "proposed") reply = "The current scope is ready to review. Use the approval card when you'd like me to start.";
    if (!reply) throw new Error("I couldn't complete this product turn. Your saved decisions are intact; please try again.");
    const modelMessage = await insertProjectMessage(admin, { projectId, ownerId, role: "model", content: reply, metadata: {
      clientTurnId, userMessageId, productTurnComplete: clientTurnId,
      productScopeProposal: state.scope?.status === "proposed" ? { scope: state.scope, revision: state.revision, surfaces: activeFacts(state, "surfaces") } : null,
    } });
    await persist({ ...state, initialTurnComplete: true, lease: null });
    if (enqueueMemory) await persistProjectMessageMemoryPair({ admin, userMessageId, userContent: effectivePrompt, modelMessageId: modelMessage.id, modelContent: reply })
      .catch((error) => console.error("Could not enqueue product conversation memory", error));
    return { intent: "product_planning", message: reply };
  } finally {
    if (state.lease?.id === clientTurnId) await persist({ ...state, lease: null }).catch(() => undefined);
  }
}
