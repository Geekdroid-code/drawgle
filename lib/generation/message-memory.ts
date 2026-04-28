import "server-only";

import { generateEmbedding } from "@/lib/generation/embeddings";
import { updateProjectMessageMemoryEmbedding } from "@/lib/supabase/queries";
import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

const collapseWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

const trivialChatPattern = /^(hi|hello|hey|yo|ok|okay|thanks|thank you|whats? up|sup)[!.? ]*$/i;
const transientStatusPattern = /^(queued|editing|repairing|reconstructing|planning|building)\b/i;

export function shouldPersistMessageMemory(content: string, role: "user" | "model" | "system") {
  const text = collapseWhitespace(content);

  if (text.length < 12) {
    return false;
  }

  if (role === "system" || transientStatusPattern.test(text)) {
    return false;
  }

  if (trivialChatPattern.test(text)) {
    return false;
  }

  return true;
}

export async function persistProjectMessageMemory({
  admin,
  messageId,
  role,
  content,
}: {
  admin: AdminClient;
  messageId: string;
  role: "user" | "model";
  content: string;
}) {
  if (!shouldPersistMessageMemory(content, role)) {
    return false;
  }

  const embedding = await generateEmbedding(content, "RETRIEVAL_DOCUMENT");
  await updateProjectMessageMemoryEmbedding(admin, messageId, embedding);
  return true;
}

export async function persistProjectMessageMemoryPair({
  admin,
  userMessageId,
  userContent,
  modelMessageId,
  modelContent,
}: {
  admin: AdminClient;
  userMessageId: string;
  userContent: string;
  modelMessageId: string;
  modelContent: string;
}) {
  await Promise.all([
    persistProjectMessageMemory({
      admin,
      messageId: userMessageId,
      role: "user",
      content: userContent,
    }),
    persistProjectMessageMemory({
      admin,
      messageId: modelMessageId,
      role: "model",
      content: modelContent,
    }),
  ]);
}
