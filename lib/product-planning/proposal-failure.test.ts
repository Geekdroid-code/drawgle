import { expect, it } from "vitest";
import { z } from "zod";
import { describeProposalFailure } from "./proposal-failure";
import { planningFailureSchema } from "./tool-failure";

it("keeps only schema paths and a fingerprint from invalid provider output", () => {
  const parsed = z.object({ direction: z.string().max(10) }).safeParse({ direction: "private provider output" });
  if (parsed.success) throw new Error("Expected invalid fixture");
  const failure = describeProposalFailure("reference_inspection", parsed.error);
  expect(failure).toMatchObject({ code: "REFERENCE_INSPECTION_RESPONSE_SCHEMA", issuePaths: ["direction"] });
  expect(planningFailureSchema.safeParse(failure).success).toBe(true);
  expect(JSON.stringify(failure)).not.toContain("private provider output");
  expect(failure.validationFingerprint).toMatch(/^[a-f0-9]{12}$/);
});

it("does not expose arbitrary provider error codes, paths, or response bodies", () => {
  const failure = describeProposalFailure("flow_review", { code: "private-provider-code", message: "/private/path?token=example", body: "private body" });
  expect(failure.code).toBe("FLOW_REVIEW_UNAVAILABLE");
  expect(JSON.stringify(failure)).not.toMatch(/private|token=example/);
});
