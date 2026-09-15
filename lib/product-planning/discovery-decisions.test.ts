import { describe, expect, it } from "vitest";
import { resolveDiscoveryDecisions } from "./discovery-decisions";
import { evidenceAssessmentSchema, evidenceAllowsProposal } from "./evidence";
import { resolvedDecisionKeys } from "./questions";

const choices = [{ label: "Members only", description: "Only workspace members can collaborate." },
  { label: "Invited guests", description: "Invite external collaborators." }, { label: "Public link", description: "Anyone with a link may join." }];
const gap = { decisionKey: "collaborator-access", decisionType: "actor_access", requiresUserInput: true,
  whyUserMustDecide: "Who may edit changes permissions and invitation behavior.", area: "product", question: "Who may collaborate?", consequence: "Determines sharing and access rules.", choices };
const assessment = (gaps: unknown[]) => evidenceAssessmentSchema.parse({ turnId: "turn", mode: "product", productReady: false, experienceReady: false, gaps, rationale: "Understand the product", delegation: "" });

describe("useful product decisions", () => {
  it.each(["visual_design", "interaction_detail"])("turns %s questions into tentative recommendations without blocking discovery", decisionType => {
    const result = resolveDiscoveryDecisions(assessment([{ ...gap, decisionKey: "archive-color", decisionType, question: "Where should gray be used?" }]), []);
    expect(result.gaps).toEqual([]);
    expect(result.recommendations).toHaveLength(1);
    expect(evidenceAllowsProposal(result)).toBe(true);
  });
  it("keeps material user-dependent access decisions even with a recommended option", () => {
    const result = resolveDiscoveryDecisions(assessment([gap]), []);
    expect(result.gaps).toHaveLength(1);
    expect(evidenceAllowsProposal(result)).toBe(false);
  });
  it("does not re-ask answered or skipped choices and never interprets them as approval", () => {
    const messageId = "11111111-1111-4111-8111-111111111111";
    const history = [{ id: messageId, role: "model", metadata: { productQuestions: [gap] } },
      { id: "answer", role: "user", metadata: { productAnswers: { messageId, answers: [{ kind: "skip" }] } } }];
    const keys = resolvedDecisionKeys(history);
    expect(keys).toEqual(["collaborator-access"]);
    const result = resolveDiscoveryDecisions(assessment([gap]), keys);
    expect(result.gaps).toEqual([]);
    expect(result).not.toHaveProperty("approved");
  });
  it("requires a concrete reason to make the user decide and validates new classifications", () => {
    expect(() => resolveDiscoveryDecisions(assessment([{ ...gap, whyUserMustDecide: "" }]), [])).toThrow(/concrete reason/);
    expect(() => resolveDiscoveryDecisions(assessment([{ ...gap, decisionKey: undefined }]), [])).toThrow();
  });
});
