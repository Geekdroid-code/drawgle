import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  appendGenerationCredits,
  CreditReservationError,
} from "@/lib/generation/credit-reservations";

describe("incremental generation credit reservations", () => {
  it("sends immutable state outputs to the atomic append RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { reservedCredits: 10, outputCount: 1, availableBalance: 70, idempotent: false },
      error: null,
    });
    const result = await appendGenerationCredits({
      admin: { rpc } as never,
      ownerId: "owner-1",
      projectId: "project-1",
      generationRunId: "run-1",
      outputs: [{
        outputKey: "run:run-1:state:screen:home:expanded",
        outputKind: "state",
        amount: 10,
        roadmapItemId: "roadmap-1",
        metadata: { screenName: "Home", stateLabel: "Expanded" },
      }],
    });

    expect(rpc).toHaveBeenCalledWith("append_generation_credit_reservations", {
      input_owner_id: "owner-1",
      input_project_id: "project-1",
      input_generation_run_id: "run-1",
      input_outputs: [{
        outputKey: "run:run-1:state:screen:home:expanded",
        outputKind: "state",
        amount: 10,
        roadmapItemId: "roadmap-1",
        metadata: { screenName: "Home", stateLabel: "Expanded" },
      }],
    });
    expect(result).toEqual({
      reservedCredits: 10,
      outputCount: 1,
      availableBalance: 70,
      idempotent: false,
    });
  });

  it("classifies insufficient optional-state credits without weakening parent reservations", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "Insufficient credits. Available: 0, Required: 10" },
    });

    await expect(appendGenerationCredits({
      admin: { rpc } as never,
      ownerId: "owner-1",
      projectId: "project-1",
      generationRunId: "run-1",
      outputs: [{ outputKey: "state-1", outputKind: "state", amount: 10 }],
    })).rejects.toMatchObject({
      code: "insufficient_credits",
    } satisfies Partial<CreditReservationError>);
  });
});
