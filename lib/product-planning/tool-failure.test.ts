import { expect, it } from "vitest";
import { z } from "zod";
import { describeToolFailure } from "./tool-failure-diagnostics";
import { ProductToolError } from "./tool-failure";

it("records safe validation paths without storing model-provided values", () => {
  const parsed = z.object({ fact: z.object({ section: z.enum(["surfaces"]) }) }).safeParse({ fact: { section: "private prompt text" } });
  if (parsed.success) throw new Error("Fixture should fail validation");
  const failure = describeToolFailure("update_product", parsed.error);
  expect(failure.diagnostic).toMatchObject({ code: "INVALID_TOOL_ARGUMENTS", issuePaths: ["fact.section"] });
  expect(JSON.stringify(failure.diagnostic)).not.toContain("private prompt text");
});

it("describes a blocked product change differently from a rejected roadmap link", () => {
  const error = new ProductToolError("Saved screen screen:shop still depends on shop.", "ROADMAP_FACT_REFERENCES", { factId: "shop" });
  expect(describeToolFailure("update_product", error).diagnostic.summary).toMatch(/would retire or move, so it was not saved/);
  expect(describeToolFailure("update_functional_plan", error).diagnostic.summary).toMatch(/was retired or filed under another section/);
});
