import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ClaimPreviewFixture } from "@/components/dev/ClaimPreviewFixture";
import { noindexRobots } from "@/lib/seo/metadata";

export const metadata: Metadata = {
  title: "Claim Preview Fixture",
  robots: noindexRobots,
};

export default function ClaimPreviewPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  return <ClaimPreviewFixture />;
}
