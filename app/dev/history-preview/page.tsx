import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { HistoryPreviewFixture } from "@/components/dev/HistoryPreviewFixture";
import { noindexRobots } from "@/lib/seo/metadata";

export const metadata: Metadata = {
  title: "History Preview Fixture",
  robots: noindexRobots,
};

export default function HistoryPreviewPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  return <HistoryPreviewFixture />;
}
