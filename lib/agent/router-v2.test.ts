import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({ generateContent: vi.fn() }));
vi.mock("@/lib/ai/gemini", () => ({
  createGeminiClient: () => ({ models: { generateContent: mocks.generateContent } }),
}));

import { routeAgentPrompt, type AgentRouterInput } from "@/lib/agent/router";

const input = (): AgentRouterInput => ({
  prompt: "Adapt the recent work cards from Home into this Library screen.",
  hasImage: false,
  activeScreenId: "22222222-2222-4222-8222-222222222222",
  screens: [
    { id: "11111111-1111-4111-8111-111111111111", name: "Home", summary: "Recent work cards", status: "ready" },
    { id: "22222222-2222-4222-8222-222222222222", name: "Library", summary: "Photo grid", status: "ready" },
  ],
  executeReadTool: vi.fn(async () => ({
    ok: true,
    data: { screen: { id: "11111111-1111-4111-8111-111111111111", name: "Home" }, regions: [{ blockId: "list-1", name: "Recent Work" }] },
    trace: { tool: "inspect_screen" as const, durationMs: 4, resultCount: 2, retrievalStage: "lexical" as const, queryEmbeddingCount: 0, resultIds: ["11111111-1111-4111-8111-111111111111", "list-1"] },
  })),
});

describe("bounded project agent loop", () => {
  beforeEach(() => mocks.generateContent.mockReset());

  it("inspects a source region before returning one target edit action", async () => {
    mocks.generateContent
      .mockResolvedValueOnce({
        functionCalls: [{ id: "read-1", name: "inspect_screen", args: { screenRef: "Home", view: "region", query: "recent work cards" } }],
        candidates: [{ content: { role: "model", parts: [{ functionCall: { id: "read-1", name: "inspect_screen", args: { screenRef: "Home" } } }] } }],
      })
      .mockResolvedValueOnce({
        functionCalls: [{
          id: "edit-1",
          name: "modify_existing_ui",
          args: {
            instruction: "Adapt Home's recent-work card pattern into Library.",
            targetType: "screen",
            targetScreenId: "22222222-2222-4222-8222-222222222222",
            scope: "screen_region",
            editOperation: "add_element",
            sourceReferences: [{ screenId: "11111111-1111-4111-8111-111111111111", blockId: "list-1", purpose: "Recent work card composition" }],
          },
        }],
      });

    const decision = await routeAgentPrompt(input());
    expect(decision.action).toBe("modify_existing_ui");
    expect(decision.targetScreenId).toBe("22222222-2222-4222-8222-222222222222");
    expect(decision.sourceReferences).toEqual([{ screenId: "11111111-1111-4111-8111-111111111111", blockId: "list-1", purpose: "Recent work card composition" }]);
    expect(decision.modelCallCount).toBe(2);
    expect(decision.toolTrace).toHaveLength(1);
    expect(mocks.generateContent).toHaveBeenCalledTimes(2);
  });

  it("never performs more than two read rounds", async () => {
    mocks.generateContent.mockResolvedValue({
      functionCalls: [{ id: "read", name: "search_project", args: { query: "old decision" } }],
      candidates: [{ content: { role: "model", parts: [{ functionCall: { id: "read", name: "search_project", args: { query: "old decision" } } }] } }],
      text: "",
    });
    const agentInput = input();
    const decision = await routeAgentPrompt(agentInput);
    expect(decision.modelCallCount).toBe(3);
    expect(agentInput.executeReadTool).toHaveBeenCalledTimes(2);
    expect(decision.action).toBe("answer_or_discuss");
  });

  it("routes an existing-screen interaction state away from full-screen planning", async () => {
    mocks.generateContent.mockResolvedValueOnce({
      functionCalls: [{
        id: "state-1",
        name: "propose_screen_state",
        args: {
          instruction: "Clone the dashboard and open the wallet selector without changing the shell.",
          targetScreenId: "22222222-2222-4222-8222-222222222222",
          parentScreenName: "Library",
          existingRoadmapItemId: "state-roadmap-id",
          stateLabel: "Wallet Selection",
          stateRole: "overlay",
          triggerLabel: "All Wallets",
          description: "Shows the wallets available for selection.",
          reason: "This is an interaction state of an existing screen.",
        },
      }],
    });

    const decision = await routeAgentPrompt({
      ...input(),
      prompt: "Build the Wallet Selection state for Library.",
    });

    expect(decision.action).toBe("propose_screen_state");
    expect(decision.executionIntent).toBe("plan");
    expect(decision.targetScreenId).toBe("22222222-2222-4222-8222-222222222222");
    expect(decision.stateProposal).toMatchObject({
      existingRoadmapItemId: "state-roadmap-id",
      stateLabel: "Wallet Selection",
      stateRole: "overlay",
    });
  });
});
