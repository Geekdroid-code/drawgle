// @vitest-environment node
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { ProjectCharter } from "@/lib/types";

import {
  flowHasNavigation,
  projectIdRange,
  readBundle,
  referenceElevationOf,
  saveBundle,
  type ProjectBundle,
} from "./bundle";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("project id resolution", () => {
  it("passes a full id through and expands a prefix to a uuid range", () => {
    expect(projectIdRange("0CE99A06-1111-4222-8333-444444444444")).toEqual({ exact: "0ce99a06-1111-4222-8333-444444444444" });
    expect(projectIdRange("0ce99a06")).toEqual({
      from: "0ce99a06-0000-0000-0000-000000000000",
      to: "0ce99a06-ffff-ffff-ffff-ffffffffffff",
    });
    expect(projectIdRange("0ce99a06…")).toMatchObject({ from: "0ce99a06-0000-0000-0000-000000000000" });
    expect(projectIdRange("0ce99a06-12")).toEqual({
      from: "0ce99a06-1200-0000-0000-000000000000",
      to: "0ce99a06-12ff-ffff-ffff-ffffffffffff",
    });
  });

  it("refuses values that cannot be an id prefix", () => {
    expect(() => projectIdRange("0ce9")).toThrow(/not a project id/);
    expect(() => projectIdRange("not-an-id")).toThrow(/not a project id/);
    expect(() => projectIdRange("")).toThrow(/not a project id/);
  });
});

describe("reference elevation", () => {
  const charter = (surfaceElevation: unknown) => ({
    referenceDna: { analysis: { surfaceElevation } },
  }) as unknown as ProjectCharter;

  it("reads the elevation class from the reference DNA and defaults to unknown", () => {
    expect(referenceElevationOf(charter("flat-tone"))).toBe("flat-tone");
    expect(referenceElevationOf(charter("strong-shadow"))).toBe("strong-shadow");
    expect(referenceElevationOf(charter("glass"))).toBe("unknown");
    expect(referenceElevationOf(null)).toBe("unknown");
    expect(referenceElevationOf({} as ProjectCharter)).toBe("unknown");
  });
});

describe("approved flow navigation", () => {
  const planning = (experienceNavigation: unknown, scope?: unknown) => ({
    experience: { navigation: experienceNavigation },
    ...(scope ? { scope } : {}),
  });

  it("reads the discovery designer's description of the navigation", () => {
    expect(flowHasNavigation(planning("persistent bottom bar with five distinct icons"))).toBe(true);
    expect(flowHasNavigation(planning("A tab bar with Today, Pets and Routines"))).toBe(true);
    expect(flowHasNavigation(planning("No persistent navigation; a single guided flow"))).toBe(false);
    expect(flowHasNavigation(planning("Keep shopping destinations distinct"))).toBeNull();
    expect(flowHasNavigation(null)).toBeNull();
    expect(flowHasNavigation({})).toBeNull();
  });

  it("prefers a structured decision on the approved scope", () => {
    expect(flowHasNavigation(planning("persistent bottom bar", { navigation: { persistent: false } }))).toBe(false);
    expect(flowHasNavigation(planning("nothing useful", { navigation: { persistent: true } }))).toBe(true);
  });
});

describe("bundle files", () => {
  it("round-trips a bundle and its reference image", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "design-eval-bundle-"));
    directories.push(directory);
    const bundle: ProjectBundle = {
      version: 1,
      fetchedAt: "2026-09-29T00:00:00.000Z",
      project: { id: "0ce99a06-1111-4222-8333-444444444444", name: "Pets", prompt: "pets", designTokens: null, charter: null, productPlanning: null },
      screens: [],
      navigation: null,
      reference: { source: "curated", id: "mindfulness-meditation-beige-light", imageUrl: "https://example.test/a.jpg", imagePath: null, file: null },
    };
    const saved = await saveBundle(directory, bundle, { bytes: Buffer.from([1, 2, 3]), extension: "jpg" });
    expect(saved.reference.file).toBe("reference.jpg");
    expect(JSON.parse(await readFile(path.join(directory, "bundle.json"), "utf8")).project.name).toBe("Pets");

    const read = await readBundle(directory);
    expect(read.bundle.reference.id).toBe("mindfulness-meditation-beige-light");
    expect(read.image?.bytes).toEqual(Buffer.from([1, 2, 3]));
    expect(read.image?.extension).toBe("jpg");
  });

  it("round-trips a bundle without a reference", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "design-eval-bundle-"));
    directories.push(directory);
    const bundle: ProjectBundle = {
      version: 1, fetchedAt: "now",
      project: { id: "id", name: "No reference", prompt: "", designTokens: null, charter: null, productPlanning: null },
      screens: [], navigation: null,
      reference: { source: "none", id: null, imageUrl: null, imagePath: null, file: null },
    };
    await saveBundle(directory, bundle, null);
    expect((await readBundle(directory)).image).toBeNull();
  });
});
