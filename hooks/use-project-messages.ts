"use client";

import { useEffect, useState } from "react";
import { isProjectRefresh, PROJECT_REFRESH_EVENT } from "@/lib/project-refresh";

import { createClient } from "@/lib/supabase/client";
import type { ProjectMessageRow } from "@/lib/supabase/database.types";
import { mapProjectMessageRow } from "@/lib/supabase/mappers";
import { fetchProjectMessages } from "@/lib/supabase/queries";
import type { ProjectMessage } from "@/lib/types";
import { preferNewerWorkTrace } from "@/lib/agent/work-trace";

const sortMessages = (messages: ProjectMessage[]) =>
  [...messages].sort(
    (left, right) =>
      new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime(),
  );

const upsertMessage = (messages: ProjectMessage[], message: ProjectMessage) => {
  const existingIndex = messages.findIndex((entry) => entry.id === message.id);
  if (existingIndex === -1) {
    return sortMessages([...messages, message]);
  }

  const nextMessages = [...messages];
  nextMessages[existingIndex] = preferNewerWorkTrace(messages[existingIndex], message);
  return sortMessages(nextMessages);
};

export function useProjectMessages(projectId: string) {
  const [messages, setMessages] = useState<ProjectMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!projectId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMessages([]);
      setIsLoading(false);
      return;
    }

    const supabase = createClient();
    let cancelled = false;
    let loadSequence = 0;
    let realtimeSequence = 0;
    const realtimeUpdates = new Map<string, number>();
    const realtimeDeletes = new Map<string, number>();

    const loadMessages = async () => {
      const sequence = ++loadSequence;
      const startedAfterRealtime = realtimeSequence;
      try {
        // Preserve the visible conversation during background refreshes.
        const nextMessages = await fetchProjectMessages(supabase, projectId);
        if (!cancelled && sequence === loadSequence) {
          setMessages((currentMessages) => {
            const byId = new Map(nextMessages.map(message => [message.id, message]));
            for (const message of currentMessages) {
              const realtimeUpdate = realtimeUpdates.get(message.id) ?? 0;
              if (realtimeUpdate > startedAfterRealtime) {
                byId.set(message.id, message);
              } else if (byId.has(message.id)) {
                byId.set(message.id, preferNewerWorkTrace(message, byId.get(message.id)!));
              }
            }
            for (const [id, deletedAt] of realtimeDeletes) {
              if (deletedAt > startedAfterRealtime) byId.delete(id);
            }
            return sortMessages([...byId.values()]).slice(-50);
          });
        }
      } catch (error) {
        console.error("Failed to load project messages", error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadMessages();
    const onRefresh = (event: Event) => { if (isProjectRefresh(event, projectId)) void loadMessages(); };
    window.addEventListener(PROJECT_REFRESH_EVENT, onRefresh);

    const channel = supabase
      .channel(`project-messages:${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "project_messages",
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          realtimeSequence += 1;
          if (payload.eventType === "DELETE") {
            realtimeDeletes.set(payload.old.id, realtimeSequence);
            setMessages((currentMessages) =>
              currentMessages.filter((message) => message.id !== payload.old.id),
            );
            return;
          }

          realtimeUpdates.set(payload.new.id, realtimeSequence);
          setMessages((currentMessages) =>
            upsertMessage(
              currentMessages,
              mapProjectMessageRow(payload.new as ProjectMessageRow),
            ),
          );
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      window.removeEventListener(PROJECT_REFRESH_EVENT, onRefresh);
      void supabase.removeChannel(channel);
    };
  }, [projectId]);

  return {
    messages,
    isLoading,
  };
}
