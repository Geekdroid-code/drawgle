import { describe, expect, it } from "vitest";
import { reconcileAnsweredQuestions } from "./answered-questions";
import { activeFacts, applyProductPatch } from "./model";
import { productFixture } from "./test-fixtures";

const questionMessageId = "11111111-1111-4111-8111-111111111111";
const answerMessageId = "22222222-2222-4222-8222-222222222222";
const questions = [{ decisionKey: "portrait_assembly_logic", question: "How should portraits be assembled?", consequence: "Changes the workflow.", choices: [
  { label: "AI composite", description: "Combine separate headshots in one setting." },
  { label: "Collage", description: "Arrange photos in a fixed template." },
  { label: "Manual canvas", description: "Place each photo by hand." },
] }];
const history = (answer: { kind: "choice"; index: number } | { kind: "custom"; text: string } | { kind: "skip" }) => [
  { id: questionMessageId, role: "model", metadata: { productQuestions: questions } },
  { id: answerMessageId, role: "user", metadata: { productAnswers: { messageId: questionMessageId, answers: [answer] } } },
];
const stateWithQuestion = () => applyProductPatch(productFixture(), { operations: [{ op: "put_fact", fact: {
  id: "q_portrait_assembly_logic", section: "questions", label: "Portrait assembly", detail: "Choose the portrait method.",
  source: "assumption", evidence: "", blocking: true,
} }] }, questionMessageId);

describe("answered planning questions", () => {
  it("turns an answered legacy blocking question into a confirmed decision", () => {
    const state = reconcileAnsweredQuestions(stateWithQuestion(), history({ kind: "choice", index: 0 }));
    expect(activeFacts(state, "questions")).toEqual([]);
    expect(activeFacts(state, "decisions")).toEqual([expect.objectContaining({
      detail: "AI composite: Combine separate headshots in one setting.", source: "user", blocking: false, messageId: answerMessageId,
    })]);
    expect(state.blueprint.facts.find(fact => fact.id === "q_portrait_assembly_logic")?.status).toBe("superseded");
    expect(reconcileAnsweredQuestions(state, history({ kind: "choice", index: 0 }))).toBe(state);
  });

  it("keeps a skipped recommendation tentative and supports custom answers", () => {
    const skipped = reconcileAnsweredQuestions(stateWithQuestion(), history({ kind: "skip" }));
    expect(activeFacts(skipped, "decisions")[0]).toMatchObject({ source: "assumption", evidence: "", provenance: { basis: "delegated" } });
    const custom = reconcileAnsweredQuestions(stateWithQuestion(), history({ kind: "custom", text: "Use a guided editor." }));
    expect(activeFacts(custom, "decisions")[0]).toMatchObject({ source: "user", detail: "Use a guided editor." });
  });

  it("does not resolve an unrelated question without a stable key match", () => {
    const state = applyProductPatch(productFixture(), { operations: [{ op: "put_fact", fact: {
      id: "different_question", section: "questions", label: "Other", detail: "Other question", source: "assumption", evidence: "", blocking: true,
    } }] }, questionMessageId);
    expect(reconcileAnsweredQuestions(state, history({ kind: "choice", index: 0 }))).toBe(state);
  });
  it("does not apply an old answer to a question reopened after that answer", () => {
    const state = applyProductPatch(productFixture(), { operations: [{ op: "put_fact", fact: {
      id: "q_portrait_assembly_logic", section: "questions", label: "Portrait assembly", detail: "A new constraint changes the choice.",
      source: "assumption", evidence: "", blocking: true,
    } }] }, answerMessageId);
    expect(reconcileAnsweredQuestions(state, history({ kind: "choice", index: 0 }))).toBe(state);
  });
});
