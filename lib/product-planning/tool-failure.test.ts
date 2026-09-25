import { expect, it } from "vitest";
import { z } from "zod";
import { describeToolFailure } from "./tool-failure-diagnostics";

it("records safe validation paths without storing model-provided values", () => {
  const parsed = z.object({ fact: z.object({ section: z.enum(["surfaces"]) }) }).safeParse({ fact: { section: "private prompt text" } });
  if (parsed.success) throw new Error("Fixture should fail validation");
  const failure = describeToolFailure("update_product", parsed.error);
  expect(failure.diagnostic).toMatchObject({ code: "INVALID_TOOL_ARGUMENTS", issuePaths: ["fact.section"] });
  expect(JSON.stringify(failure.diagnostic)).not.toContain("private prompt text");
});
