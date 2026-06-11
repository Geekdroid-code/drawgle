"use client";

import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import type { ProjectMessageRow } from "@/lib/supabase/database.types";
import { mapProjectMessageRow } from "@/lib/supabase/mappers";
import { fetchProjectMessages } from "@/lib/supabase/queries";
import type { ProjectMessage } from "@/lib/types";

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
  nextMessages[existingIndex] = message;
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

    const loadMessages = async () => {
      try {
        setIsLoading(true);
        const nextMessages = await fetchProjectMessages(supabase, projectId);
        if (!cancelled) {
          setMessages(nextMessages);
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
          if (payload.eventType === "DELETE") {
            setMessages((currentMessages) =>
              currentMessages.filter((message) => message.id !== payload.old.id),
            );
            return;
          }

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
      void supabase.removeChannel(channel);
    };
  }, [projectId]);

  return {
    messages,
    isLoading,
  };
}
