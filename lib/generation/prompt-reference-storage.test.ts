import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { findLatestProjectReference } from "./prompt-reference-storage";

const lookup = (rows: Array<{ image_path: string | null; metadata: Record<string, unknown> }>) => {
  let offset = 0;
  const query = { select: () => query, eq: () => query, order: () => query, range: (start: number) => { offset = start; return query; },
    then: (resolve: (result: unknown) => unknown) => Promise.resolve({ data: rows.slice(offset, offset + 100), error: null }).then(resolve) };
  return findLatestProjectReference({ admin: { from: () => query } as never, projectId: "project", ownerId: "owner" });
};
describe("project reference inheritance", () => {
  it("respects opt-out after skipping newer screen attachments", async () => {
    expect(await lookup([
      { image_path: "chat.webp", metadata: { referenceScope: "screen" } },
      { image_path: null, metadata: { referencePolicy: "no_reference" } },
      { image_path: "old.webp", metadata: {} },
    ])).toEqual({ imagePath: null, policy: "no_reference" });
  });
  it("does not promote new or legacy canvas uploads into project references", async () => {
    expect(await lookup([
      { image_path: "new.webp", metadata: { referenceScope: "screen" } },
      { image_path: "legacy.webp", metadata: { requestedFrom: "agent-screen-plan-approval" } },
      { image_path: "curated.webp", metadata: { referencePolicy: "curated_evidence" } },
    ])).toEqual({ imagePath: "curated.webp", policy: "curated_evidence" });
  });
  it("finds the original reference beyond a page of local runs", async () => {
    expect(await lookup([
      ...Array.from({ length: 101 }, () => ({ image_path: "chat.webp", metadata: { referenceScope: "screen" } })),
      { image_path: "original.webp", metadata: { referencePolicy: "user_upload" } },
    ])).toEqual({ imagePath: "original.webp", policy: "project_reference" });
  });
  it("preserves genuine initial user uploads", async () => {
    expect(await lookup([{ image_path: "initial.webp", metadata: { referenceScope: "project" } }]))
      .toEqual({ imagePath: "initial.webp", policy: "project_reference" });
  });
  it("returns no reference for a project containing only local attachments", async () => {
    expect(await lookup([{ image_path: "chat.webp", metadata: { referenceScope: "screen" } }])).toBeNull();
    expect(await lookup([])).toBeNull();
  });
});
