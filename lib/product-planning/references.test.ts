import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { loadPlanningReference } from "./references";
describe("product reference ownership", () => {
  it("does not use privileged storage access for another owner's path", async () => {
    const download = vi.fn();
    const admin = { storage: { from: () => ({ download }) } };
    await expect(loadPlanningReference(admin, "other/prompt-images/file.webp", "owner")).rejects.toThrow(/owner/);
    await expect(loadPlanningReference(admin, "owner/prompt-images/../other.webp", "owner")).rejects.toThrow(/owner/);
    expect(download).not.toHaveBeenCalled();
  });
});
