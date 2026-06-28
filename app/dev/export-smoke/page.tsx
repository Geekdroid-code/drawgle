import type { Metadata } from "next";
import { noindexRobots } from "@/lib/seo/metadata";
import { ExportSmokeFixture } from "@/components/ExportSmokeFixture";


export const metadata: Metadata = {
  title: "Export Smoke Fixture",
  robots: noindexRobots,
};
export default function ExportSmokePage() {
  return <ExportSmokeFixture />;
}
