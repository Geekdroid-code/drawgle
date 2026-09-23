import { describe, expect, it } from "vitest";
import { resolveDiscoveryDecisions } from "./discovery-decisions";
import { evidenceAssessmentSchema, evidenceAllowsProposal } from "./evidence";
import { resolvedDecisionKeys } from "./questions";

const choices = [{ label: "Result screen", description: "Show the finished result and actions on one view." },
  { label: "Memories screen", description: "Give saved results a separate browsable screen." },
  { label: "Both", description: "Show a result view and a separate Memories screen." }];
const gap = { decisionKey: "result-screens", decisionType: "screen_scope", requiresUserInput: true,
  whyUserMustDecide: "The choice changes which result screens are designed.", area: "product", question: "Which screens should show finished results?", consequence: "Changes the screen set.", choices };
const assessment = (gaps: unknown[]) => evidenceAssessmentSchema.parse({ turnId: "turn", mode: "product", productReady: false, experienceReady: false, gaps, rationale: "Understand the product", delegation: "" });

describe("useful product decisions", () => {
  it.each(["visual_design", "interaction_detail"])("turns %s questions into tentative recommendations without blocking discovery", decisionType => {
    const result = resolveDiscoveryDecisions(assessment([{ ...gap, decisionKey: "archive-color", decisionType, question: "Where should gray be used?" }]), []);
    expect(result.gaps).toEqual([]);
    expect(result.recommendations).toHaveLength(1);
    expect(evidenceAllowsProposal(result)).toBe(true);
  });
  it("keeps material user-dependent screen decisions even with a recommendation", () => {
    const result = resolveDiscoveryDecisions(assessment([gap]), []);
    expect(result.gaps).toHaveLength(1);
    expect(evidenceAllowsProposal(result)).toBe(false);
  });
  it.each(["product_behavior", "business_rule", "actor_access"])("does not ask about %s implementation choices", decisionType => {
    const result = resolveDiscoveryDecisions(assessment([{ ...gap, decisionType,
      question: "How should the app handle the final restored or animated files?",
      choices: [{ label: "Local gallery", description: "Store files locally." }, { label: "Direct export", description: "Save files externally." }, { label: "Cloud sync", description: "Back up files across devices." }],
    }]), []);
    expect(result.gaps).toEqual([]);
    expect(result.recommendations).toEqual([]);
    expect(evidenceAllowsProposal(result)).toBe(true);
  });
  it("drops a file-format question even when mislabeled as screen flow", () => {
    const result = resolveDiscoveryDecisions(assessment([{ ...gap, decisionType: "screen_flow",
      question: "What should be the primary output for animated photos?",
      choices: [{ label: "MP4", description: "Produce video." }, { label: "GIF", description: "Produce an animated image." }, { label: "Adjustable length", description: "Choose duration." }],
    }]), []);
    expect(result.gaps).toEqual([]);
    expect(result.recommendations).toEqual([]);
  });
  it("drops a screen-framed card that sneaks in cloud storage choices", () => {
    const result = resolveDiscoveryDecisions(assessment([{ ...gap,
      question: "Which screen should handle finished results?",
      choices: [{ label: "Gallery", description: "Show results in a Memories screen." },
        { label: "Export", description: "Show download actions on the result screen." },
        { label: "Cloud-synced library", description: "Back up results across devices." }],
    }]), []);
    expect(result.gaps).toEqual([]);
    expect(result.recommendations).toEqual([]);
  });
  it("does not smuggle infrastructure choices through recommendations", () => {
    const result = resolveDiscoveryDecisions({ ...assessment([]),
      recommendations: [{ decisionKey: "cloud", recommendation: "Cloud sync every result", rationale: "Back up files" }],
    }, []);
    expect(result.recommendations).toEqual([]);
  });
  it("does not re-ask answered or skipped choices and never interprets them as approval", () => {
    const messageId = "11111111-1111-4111-8111-111111111111";
    const history = [{ id: messageId, role: "model", metadata: { productQuestions: [gap] } },
      { id: "answer", role: "user", metadata: { productAnswers: { messageId, answers: [{ kind: "skip" }] } } }];
    const keys = resolvedDecisionKeys(history);
    expect(keys).toEqual(["result-screens"]);
    const result = resolveDiscoveryDecisions(assessment([gap]), keys);
    expect(result.gaps).toEqual([]);
    expect(result).not.toHaveProperty("approved");
  });
  it("requires a concrete reason to make the user decide and validates new classifications", () => {
    expect(() => resolveDiscoveryDecisions(assessment([{ ...gap, whyUserMustDecide: "" }]), [])).toThrow(/concrete reason/);
    expect(() => resolveDiscoveryDecisions(assessment([{ ...gap, decisionKey: undefined }]), [])).toThrow();
  });
});
