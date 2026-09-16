import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { findLatestProjectReference } from "./prompt-reference-storage";

describe("findLatestProjectReference", () => {
  it("returns no_reference when the latest run explicitly opted out", async () => {
    const admin = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      image_path: null,
                      metadata: { referencePolicy: "no_reference" },
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }),
      }),
    };

    const result = await findLatestProjectReference({
      admin: admin as never,
      projectId: "project-1",
      ownerId: "owner-1",
    });

    expect(result).toEqual({ imagePath: null, policy: "no_reference" });
  });

  it("preserves curated_evidence policy when the latest run was curated", async () => {
    const admin = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      image_path: "owner-1/prompt-images/curated.webp",
                      metadata: { referencePolicy: "curated_evidence" },
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }),
      }),
    };

    const result = await findLatestProjectReference({
      admin: admin as never,
      projectId: "project-1",
      ownerId: "owner-1",
    });

    expect(result).toEqual({
      imagePath: "owner-1/prompt-images/curated.webp",
      policy: "curated_evidence",
    });
  });

  it("returns project_reference for standard project uploads", async () => {
    const admin = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      image_path: "owner-1/prompt-images/upload.webp",
                      metadata: { referencePolicy: "user_upload" },
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }),
      }),
    };

    const result = await findLatestProjectReference({
      admin: admin as never,
      projectId: "project-1",
      ownerId: "owner-1",
    });

    expect(result).toEqual({
      imagePath: "owner-1/prompt-images/upload.webp",
      policy: "project_reference",
    });
  });

  it("returns null when no previous runs exist", async () => {
    const admin = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: null,
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }),
      }),
    };

    const result = await findLatestProjectReference({
      admin: admin as never,
      projectId: "project-1",
      ownerId: "owner-1",
    });

    expect(result).toBeNull();
  });
});
