import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ExportSmokeFixture } from "@/components/ExportSmokeFixture";
import { noindexRobots } from "@/lib/seo/metadata";

export const metadata: Metadata = {
  title: "Export Smoke Fixture",
  robots: noindexRobots,
};

export default function ExportSmokePage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <ExportSmokeFixture />;
}
