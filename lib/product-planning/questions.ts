import { z } from "zod";
import { isScreenDesignCardQuestion } from "./discovery-decisions";

export const questionChoicesSchema = z.array(z.object({
  label: z.string().trim().min(1).max(100),
  description: z.string().trim().min(1).max(240),
})).length(3).refine(choices => new Set(choices.map(choice => choice.label.toLowerCase())).size === 3, "Offer three distinct answers.");

export const productQuestionsSchema = z.array(z.object({
  decisionKey: z.string().max(100).optional(),
  question: z.string().min(1).max(600),
  consequence: z.string().min(1).max(1000),
  // First answer is the recommendation. It is never selected automatically.
  choices: questionChoicesSchema,
})).min(1).max(2);
export type ProductQuestions = z.infer<typeof productQuestionsSchema>;

export const productAnswersSchema = z.object({
  messageId: z.string().uuid(),
  answers: z.array(z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("choice"), index: z.number().int().min(0).max(2) }),
    z.object({ kind: z.literal("custom"), text: z.string().trim().min(1).max(2000) }),
    z.object({ kind: z.literal("skip") }),
  ])).min(1).max(2),
});
export type ProductAnswers = z.infer<typeof productAnswersSchema>;
export type ProductAnswer = ProductAnswers["answers"][number];

export function readProductQuestions(metadata: Record<string, unknown>): ProductQuestions | null {
  const parsed = productQuestionsSchema.safeParse(metadata.productQuestions);
  return parsed.success ? parsed.data : null;
}

// Compatibility for the application-generated mode card shipped before mode was server-owned.
export function isObsoleteModeQuestion(questions: ProductQuestions) {
  return questions.some(item => item.question === "Should I recreate the supplied screens, or adapt their design to your product?");
}

/** Old implementation cards remain in chat history but should no longer request answers. */
export function isScreenDesignQuestionCard(questions: ProductQuestions) {
  return questions.every(item => item.decisionKey === "reference_evidence_recovery" || isScreenDesignCardQuestion(item));
}

export const resumeProductPlanningPrompt = "Continue designing the requested screens using the mode I selected. Ask only about missing visible screens or flow choices.";

export function productMessageContext(message: { content: string; metadata: Record<string, unknown> }) {
  const questions = readProductQuestions(message.metadata);
  if (!questions) return message.content;
  if (isObsoleteModeQuestion(questions)) return "An obsolete application mode question was shown here. It did not establish user intent or image availability. Use current project referenceContext.";
  return `${message.content}\n\n${questions.map(question => `${question.question}\n${question.consequence}\n${question.choices.map((choice, index) =>
    `${index === 0 ? "Recommended: " : ""}${choice.label} — ${choice.description}`).join("\n")}`).join("\n\n")}`;
}

export function formatProductAnswers(questions: ProductQuestions, answers: ProductAnswers["answers"]) {
  if (questions.length !== answers.length) throw new Error("Answer or skip each displayed question.");
  const confirmed: string[] = [];
  const content = questions.map((question, index) => {
    const answer = answers[index];
    if (answer.kind === "skip") return `${question.question}\nSkipped — recommend a reasonable direction for this question and keep it as an assumption. I can revise it later.`;
    const text = answer.kind === "custom" ? answer.text : `${question.choices[answer.index].label}: ${question.choices[answer.index].description}`;
    confirmed.push(text);
    return `${question.question}\n${text}`;
  }).join("\n\n");
  return { content, confirmed };
}

// Resolve against project-owned history, never trust answer labels supplied by a client.
export function resolveProductAnswers(history: Array<{ id: string; role: string; content: string; metadata: Record<string, unknown> }>, input: ProductAnswers, turnId: string) {
  const index = history.findIndex(message => message.id === input.messageId && message.role === "model");
  const questions = index < 0 ? null : readProductQuestions(history[index].metadata);
  if (!questions || history.slice(index + 1).some(message =>
    (message.role === "user" && message.metadata.clientTurnId !== turnId)
    || (message.role === "model" && message.metadata.productTurnComplete && message.metadata.productTurnComplete !== turnId))) {
    throw new Error("These questions have changed. Continue with the latest message in chat.");
  }
  // Old deployed clients can still submit this card. Resume safely without treating
  // its false premise or selected option as a user decision about reference mode.
  if (isObsoleteModeQuestion(questions)) return { content: resumeProductPlanningPrompt, confirmed: [] };
  return formatProductAnswers(questions, input.answers);
}

export function confirmedMessageEvidence(message: { content: string; metadata: Record<string, unknown> }): string[] {
  // Question text and skipped recommendations are not user-confirmed facts.
  if (message.metadata.productAnswers) return Array.isArray(message.metadata.productAnswerEvidence)
    ? message.metadata.productAnswerEvidence.filter((value): value is string => typeof value === "string") : [];
  return [message.content];
}

export function resolvedDecisionKeys(history: Array<{ id: string; role: string; metadata: Record<string, unknown> }>) {
  const resolved = new Set<string>();
  for (const message of history) {
    const answers = productAnswersSchema.safeParse(message.metadata.productAnswers);
    if (message.role !== "user" || !answers.success) continue;
    const original = history.find(entry => entry.id === answers.data.messageId && entry.role === "model");
    const questions = original && readProductQuestions(original.metadata);
    questions?.forEach((question, index) => { if (question.decisionKey && answers.data.answers[index]) resolved.add(question.decisionKey); });
  }
  return [...resolved];
}
