"use client";

import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import type { ScreenMessageRow } from "@/lib/supabase/database.types";
import { mapScreenMessageRow } from "@/lib/supabase/mappers";
import { fetchScreenMessages } from "@/lib/supabase/queries";
import type { Message } from "@/lib/types";

const sortMessages = (messages: Message[]) =>
  [...messages].sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime());

const upsertMessage = (messages: Message[], message: Message) => {
  const existingIndex = messages.findIndex((entry) => entry.id === message.id);
  if (existingIndex === -1) {
    return sortMessages([...messages, message]);
  }

  const nextMessages = [...messages];
  nextMessages[existingIndex] = message;
  return sortMessages(nextMessages);
};

export function useScreenMessages(screenId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!screenId) {
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
        const nextMessages = await fetchScreenMessages(supabase, screenId);
        if (!cancelled) {
          setMessages(nextMessages);
        }
      } catch (error) {
        console.error("Failed to load screen messages", error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadMessages();

    const channel = supabase
      .channel(`screen-messages:${screenId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "screen_messages",
          filter: `screen_id=eq.${screenId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setMessages((currentMessages) => currentMessages.filter((message) => message.id !== payload.old.id));
            return;
          }

          setMessages((currentMessages) => upsertMessage(currentMessages, mapScreenMessageRow(payload.new as ScreenMessageRow)));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [screenId]);

  return {
    messages,
    isLoading,
  };
}