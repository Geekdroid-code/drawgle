import { describe, expect, it } from "vitest";

import { resolveGenerationReferencePolicy } from "@/lib/generation/reference-policy";

describe("generation reference policy", () => {
  it("always gives a current user upload highest priority", () => {
    expect(resolveGenerationReferencePolicy({
      hasCurrentUserImage: true,
      hasProjectReferenceImage: true,
      hasExplicitStyle: true,
      isExistingProject: true,
      requestedPolicy: "curated_fallback",
    })).toBe("user_upload");
  });

  it("inherits the project's user upload for subsequent screens", () => {
    expect(resolveGenerationReferencePolicy({
      hasCurrentUserImage: false,
      hasProjectReferenceImage: true,
      hasExplicitStyle: false,
      isExistingProject: true,
    })).toBe("project_reference");
  });

  it("uses project memory instead of curated references for existing projects", () => {
    expect(resolveGenerationReferencePolicy({
      hasCurrentUserImage: false,
      hasProjectReferenceImage: false,
      hasExplicitStyle: false,
      isExistingProject: true,
    })).toBe("project_memory");
  });

  it("does not let inferred styles override persisted project provenance", () => {
    expect(resolveGenerationReferencePolicy({
      hasCurrentUserImage: false,
      hasProjectReferenceImage: false,
      hasExplicitStyle: true,
      isExistingProject: true,
      requestedPolicy: "project_reference",
    })).toBe("project_reference");
  });

  it("uses curated fallback only for a new project with no visual direction", () => {
    expect(resolveGenerationReferencePolicy({
      hasCurrentUserImage: false,
      hasProjectReferenceImage: false,
      hasExplicitStyle: false,
      isExistingProject: false,
    })).toBe("curated_fallback");
  });
});
