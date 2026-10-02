import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ChatReplayFixture } from "@/components/dev/ChatReplayFixture";
import { noindexRobots } from "@/lib/seo/metadata";

export const metadata: Metadata = {
  title: "Chat Replay Fixture",
  robots: noindexRobots,
};

export default function ChatReplayPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  return <ChatReplayFixture />;
}
