import { activeFacts, applyProductPatch, type ProductFact, type ProductPlanning } from "./model";
import { isObsoleteModeQuestion, productAnswersSchema, readProductQuestions } from "./questions";

type Message = { id: string; role: string; metadata: Record<string, unknown> };
type Resolution = { op: "supersede_fact"; id: string; replacement: Omit<ProductFact, "status" | "supersededBy" | "messageId"> | null };

/** Reconcile server-validated card answers with older blocking blueprint questions. */
export function reconcileAnsweredQuestions(state: ProductPlanning, history: Message[]): ProductPlanning {
  const answersByKey = new Map<string, { answer: { kind: "choice"; index: number } | { kind: "custom"; text: string } | { kind: "skip" }; question: NonNullable<ReturnType<typeof readProductQuestions>>[number]; answerMessageId: string; index: number }>();
  for (const message of history) {
    if (message.role !== "user") continue;
    const parsed = productAnswersSchema.safeParse(message.metadata.productAnswers);
    if (!parsed.success) continue;
    const original = history.find(candidate => candidate.role === "model" && candidate.id === parsed.data.messageId);
    const questions = original && readProductQuestions(original.metadata);
    if (!questions || isObsoleteModeQuestion(questions) || questions.length !== parsed.data.answers.length) continue;
    questions.forEach((question, index) => {
      if (question.decisionKey) answersByKey.set(question.decisionKey, {
        answer: parsed.data.answers[index], question, answerMessageId: message.id, index,
      });
    });
  }

  const usedKeys = new Set<string>();
  const operationsByMessage = new Map<string, Resolution[]>();
  for (const fact of activeFacts(state, "questions").filter(fact => fact.blocking)) {
    const key = fact.decisionKey ?? (fact.id.startsWith("q_") ? fact.id.slice(2) : "");
    const resolved = answersByKey.get(key);
    if (!resolved) continue;
    const { answer, question, answerMessageId, index } = resolved;
    const questionTurn = fact.messageId ? history.findIndex(message => message.id === fact.messageId) : -1;
    const answerTurn = history.findIndex(message => message.id === answerMessageId);
    if (questionTurn >= 0 && answerTurn >= 0 && questionTurn >= answerTurn) continue;
    const operations = operationsByMessage.get(answerMessageId) ?? [];
    operationsByMessage.set(answerMessageId, operations);
    if (usedKeys.has(key)) {
      operations.push({ op: "supersede_fact", id: fact.id, replacement: null });
      continue;
    }
    usedKeys.add(key);
    const selected = answer.kind === "choice" ? question.choices[answer.index] : question.choices[0];
    const detail = answer.kind === "custom" ? answer.text : `${selected.label}: ${selected.description}`;
    const confirmed = answer.kind !== "skip";
    operations.push({ op: "supersede_fact", id: fact.id, replacement: {
      id: `answer_${answerMessageId.replace(/[^a-z0-9]/g, "").slice(0, 48)}_${index}`,
      section: "decisions" as const,
      decisionKey: key,
      label: fact.label,
      detail,
      source: confirmed ? "user" as const : "assumption" as const,
      provenance: { basis: confirmed ? "direct" as const : "delegated" as const, recommendationMessageId: null },
      evidence: confirmed ? detail.slice(0, 1000) : "",
      links: fact.links,
      blocking: false,
    } });
  }
  let next = state;
  for (const [answerMessageId, operations] of operationsByMessage) {
    next = applyProductPatch(next, { operations }, answerMessageId);
  }
  return next;
}
