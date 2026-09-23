import { describe, expect, it } from "vitest";
import type { ScreenData } from "@/lib/types";
import { acceptFetchedSource, mergeScreenCatalog } from "./screen-cache";
const screen = (revision: number, loaded = true): ScreenData => ({
  id: "one", projectId: "project", userId: "user", name: "One", prompt: "", code: loaded ? `source-${revision}` : "",
  sourceLoaded: loaded, designRevision: revision, x: 0, y: 0, createdAt: "2026-01-01", updatedAt: "2026-01-01",
});
describe("revision-aware source cache", () => {
  it("keeps cached source only for matching revisions", () => {
    expect(mergeScreenCatalog([screen(1,false)],[screen(1)])[0].code).toBe("source-1");
    expect(mergeScreenCatalog([screen(2,false)],[screen(1)])[0].sourceLoaded).toBe(false);
  });
  it("rejects out-of-order catalog and source results", () => {
    expect(mergeScreenCatalog([screen(1,false)],[screen(2)])[0].code).toBe("source-2");
    expect(acceptFetchedSource([screen(2)],screen(1))[0].code).toBe("source-2");
  });
  it("does not resurrect deleted screens from pending fetches", () => {
    expect(acceptFetchedSource([],screen(1))).toEqual([]);
  });
});
