import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generateEmbedding: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/generation/embeddings", () => ({
  generateEmbedding: mocks.generateEmbedding,
}));

import { assembleProjectContext } from "@/lib/generation/context";

describe("project context retrieval", () => {
  beforeEach(() => {
    mocks.generateEmbedding.mockReset();
  });

  it("keeps project contracts but skips embeddings and screen matches for new projects", async () => {
    const rpc = vi.fn();
    const from = vi.fn((table: string) => {
      const response = table === "projects"
        ? {
            data: {
              prompt: "Build a finance app",
              project_charter: null,
              design_tokens: null,
            },
            error: null,
          }
        : { data: null, error: null };
      const query = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        maybeSingle: vi.fn(async () => response),
      };
      return query;
    });

    const context = await assembleProjectContext({
      admin: { from, rpc } as never,
      projectId: "project-1",
      userPrompt: "Build a finance app",
      retrieveScreenMemory: false,
    });

    expect(mocks.generateEmbedding).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
    expect(from).toHaveBeenCalledWith("projects");
    expect(from).toHaveBeenCalledWith("project_navigation");
    expect(context).toContain("TYPOGRAPHY ROLE CONTRACT");
  });
});
