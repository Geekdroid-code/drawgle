import { describe, expect, it } from "vitest";

import { mergeProjectMessageSnapshots } from "@/hooks/use-project-messages";
import type { ProjectMessage } from "@/lib/types";

const message = (
  id: string,
  role: ProjectMessage["role"],
  timestamp: string,
  content = id,
): ProjectMessage => ({
  id,
  projectId: "project-1",
  ownerId: "owner-1",
  screenId: null,
  role,
  content,
  messageType: "chat",
  metadata: {},
  timestamp,
});

describe("project message reconciliation", () => {
  it("does not erase a realtime message when an older fetch snapshot resolves", () => {
    const realtimeReply = message("reply", "model", "2026-08-14T06:42:42.000Z");
    const fetchedUser = message("user", "user", "2026-08-14T06:42:40.000Z");

    expect(mergeProjectMessageSnapshots([realtimeReply], [fetchedUser]).map((item) => item.id))
      .toEqual(["user", "reply"]);
  });

  it("upserts server metadata while retaining the complete ordered turn", () => {
    const optimisticUser = message("user", "user", "2026-08-14T06:42:40.000Z");
    const persistedUser = {
      ...optimisticUser,
      metadata: { clientTurnId: "turn-1" },
    };
    const reply = message("reply", "model", "2026-08-14T06:42:41.000Z");

    const reconciled = mergeProjectMessageSnapshots([optimisticUser], [persistedUser, reply]);

    expect(reconciled).toHaveLength(2);
    expect(reconciled[0].metadata).toEqual({ clientTurnId: "turn-1" });
    expect(reconciled[1].id).toBe("reply");
  });
});
