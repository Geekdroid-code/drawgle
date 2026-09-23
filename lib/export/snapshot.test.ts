import { describe, expect, it } from "vitest";
import { prepareExportSnapshot, type ExportDatabaseSnapshot } from "./snapshot";

const snapshot = (): ExportDatabaseSnapshot => ({
  project: { id: "project", owner_id: "owner", name: "Test", prompt: "Original product brief", status: "completed",
    product_planning: null, design_tokens: {}, created_at: "2026-01-01", updated_at: "2026-01-01" },
  screens: [{ id: "screen", project_id: "project", owner_id: "owner", name: "One", code: "<main>Saved source</main>",
    status: "ready", stream_public_token: "PRIVATE_STREAM", trigger_run_id: "PRIVATE_PROVIDER", prompt: "PRIVATE_PROMPT",
    created_at: "2026-01-01", updated_at: "2026-01-01" }],
  navigation: null, specificationSources: [{ screenId: "screen", name: "One" }],
} as unknown as ExportDatabaseSnapshot);

describe("saved export snapshot", () => {
  it("whitelists output fields and includes legacy gaps only with the behavior flag", () => {
    const result = prepareExportSnapshot(snapshot(), ["screen"], true);
    expect(result.screens[0].code).toContain("Saved source");
    expect(JSON.stringify(result)).not.toContain("PRIVATE_");
    expect(result.project.prompt).toBe("Original product brief");
    expect(result.productSpecification?.screens[0].gaps[0]).toContain("Behavior specification unavailable");
    expect(prepareExportSnapshot(snapshot(), ["screen"], false).productSpecification).toBeUndefined();
  });
  it.each(["building", "queued", "failed"] as const)("rejects %s screens instead of empty exports", status => {
    const input = snapshot(); input.screens[0].status = status;
    expect(() => prepareExportSnapshot(input, ["screen"], true)).toThrow("unavailable");
  });
  it("rejects missing, wrong and empty selected source", () => {
    expect(() => prepareExportSnapshot(snapshot(), ["missing"], true)).toThrow();
    expect(() => prepareExportSnapshot(snapshot(), ["screen", "deleted"], true)).toThrow();
    const input = snapshot(); input.screens[0].code = "";
    expect(() => prepareExportSnapshot(input, ["screen"], true)).toThrow();
  });
});
