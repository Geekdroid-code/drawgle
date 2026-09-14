import { describe, expect, it } from "vitest";
import { confirmedMessageEvidence, formatProductAnswers, productAnswersSchema, readProductQuestions, resolveProductAnswers, type ProductQuestions } from "./questions";

export const questionFixture: ProductQuestions = [{
  question: "What should onboarding accomplish?", consequence: "This changes the steps before shopping.",
  choices: [
    { label: "Introduce the brand", description: "A short, skippable introduction gets shoppers to products quickly." },
    { label: "Personalize shopping", description: "Ask preferences that actually affect recommendations." },
    { label: "Start shopping immediately", description: "Introduce the brand within the shop without a separate onboarding flow." },
  ],
}];
const messageId = "11111111-1111-4111-8111-111111111111";
const message = { id: messageId, role: "model", content: "Choose below", metadata: { productQuestions: questionFixture } };
describe("product question answers", () => {
  it("reads legacy messages without cards and rejects malformed choices", () => {
    expect(readProductQuestions({})).toBeNull();
    expect(readProductQuestions({ productQuestions: [{ ...questionFixture[0], choices: questionFixture[0].choices.slice(0, 2) }] })).toBeNull();
    expect(readProductQuestions(message.metadata)).toEqual(questionFixture);
    expect(productAnswersSchema.safeParse({ messageId, answers: [{ kind: "choice", index: 3 }] }).success).toBe(false);
  });
  it("resolves selected answers from the original message and excludes skipped questions from confirmed evidence", () => {
    const selected = resolveProductAnswers([message], { messageId, answers: [{ kind: "choice", index: 0 }] }, "turn");
    expect(selected.confirmed[0]).toContain("Introduce the brand");
    const skipped = formatProductAnswers(questionFixture, [{ kind: "skip" }]);
    expect(skipped.content).toContain("keep it as an assumption");
    expect(skipped.confirmed).toEqual([]);
    expect(confirmedMessageEvidence({ content: skipped.content, metadata: { productAnswers: {}, productAnswerEvidence: [] } })).toEqual([]);
  });
  it("recovers old mode-card submissions without accepting their false premise", () => {
    const old = { ...message, metadata: { productQuestions: [{ ...questionFixture[0], question: "Should I recreate the supplied screens, or adapt their design to your product?" }] } };
    const result = resolveProductAnswers([old], { messageId, answers: [{ kind: "choice", index: 0 }] }, "turn");
    expect(result.confirmed).toEqual([]);
    expect(result.content).toContain("Continue planning my product");
    expect(result.content).not.toContain("supplied screens");
  });
  it("requires an explicit custom answer or skip for every question", () => {
    expect(() => formatProductAnswers([...questionFixture, ...questionFixture], [{ kind: "skip" }])).toThrow(/each/);
    expect(productAnswersSchema.safeParse({ messageId, answers: [{ kind: "custom", text: "   " }] }).success).toBe(false);
    expect(formatProductAnswers(questionFixture, [{ kind: "custom", text: "We only sell at events" }]).confirmed).toEqual(["We only sell at events"]);
  });
  it("rejects stale or cross-project message IDs but permits the same interrupted turn to retry", () => {
    const input = { messageId, answers: [{ kind: "skip" as const }] };
    expect(() => resolveProductAnswers([], input, "turn")).toThrow(/changed/);
    const newer = { id: "user", role: "user", content: "Changed my mind", metadata: { clientTurnId: "newer" } };
    expect(() => resolveProductAnswers([message, newer], input, "turn")).toThrow(/changed/);
    expect(() => resolveProductAnswers([message, newer], input, "newer")).not.toThrow();
  });
});
