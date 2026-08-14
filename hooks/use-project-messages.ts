"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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

export const mergeProjectMessageSnapshots = (
  current: ProjectMessage[],
  incoming: ProjectMessage[],
) => incoming.reduce(upsertMessage, current);

const messagesForProject = (messages: ProjectMessage[], projectId: string) =>
  messages.filter((message) => message.projectId === projectId);

export function useProjectMessages(projectId: string) {
  const [messages, setMessages] = useState<ProjectMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const activeProjectIdRef = useRef(projectId);

  const refreshMessages = useCallback(async () => {
    if (!projectId) return [];
    const nextMessages = await fetchProjectMessages(createClient(), projectId);
    if (activeProjectIdRef.current === projectId) {
      // Merge instead of replacing. A realtime insert can land while this
      // request is in flight; replacing with the older snapshot made that
      // message disappear until a full page refresh.
      setMessages((currentMessages) =>
        mergeProjectMessageSnapshots(
          messagesForProject(currentMessages, projectId),
          nextMessages,
        ),
      );
    }
    return nextMessages;
  }, [projectId]);

  useEffect(() => {
    activeProjectIdRef.current = projectId;
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
          setMessages((currentMessages) =>
            mergeProjectMessageSnapshots(
              messagesForProject(currentMessages, projectId),
              nextMessages,
            ),
          );
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
          if (activeProjectIdRef.current !== projectId) return;
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
      .subscribe((status) => {
        // Reconcile once the channel is actually live. This closes the gap
        // between the initial database read and realtime subscription.
        if (status === "SUBSCRIBED") {
          void refreshMessages().catch((error) => {
            console.error("Failed to reconcile project messages", error);
          });
        }
      });

    return () => {
      cancelled = true;
      if (activeProjectIdRef.current === projectId) {
        activeProjectIdRef.current = "";
      }
      void supabase.removeChannel(channel);
    };
  }, [projectId, refreshMessages]);

  return {
    messages,
    isLoading,
    refreshMessages,
  };
}
