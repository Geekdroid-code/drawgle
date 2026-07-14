import { logger, task } from "@trigger.dev/sdk";

import {
  persistProjectMessageMemoryNow,
  persistProjectMessageMemoryPairNow,
} from "@/lib/generation/message-memory";
import { createAdminClient } from "@/lib/supabase/admin";

type AgentMemoryPayload =
  | { kind: "single"; messageId: string; role: "user" | "model"; content: string }
  | { kind: "turn"; userMessageId: string; userContent: string; modelMessageId: string; modelContent: string };

export const enrichAgentTurnMemoryTask = task({
  id: "enrich-agent-turn-memory",
  retry: {
    maxAttempts: 2,
    factor: 2,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 15000,
  },
  maxDuration: 120,
  run: async (payload: AgentMemoryPayload) => {
    const admin = createAdminClient();
    const persisted = payload.kind === "single"
      ? await persistProjectMessageMemoryNow({
          admin,
          messageId: payload.messageId,
          role: payload.role,
          content: payload.content,
        })
      : await persistProjectMessageMemoryPairNow({
          admin,
          userMessageId: payload.userMessageId,
          userContent: payload.userContent,
          modelMessageId: payload.modelMessageId,
          modelContent: payload.modelContent,
        });
    logger.info("Refreshed agent turn memory", { kind: payload.kind, persisted });
    return { persisted };
  },
});
