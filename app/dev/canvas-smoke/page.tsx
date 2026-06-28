import type { Metadata } from "next";
import { noindexRobots } from "@/lib/seo/metadata";
import { notFound } from "next/navigation";

import { CanvasSmokeFixture } from "@/components/CanvasSmokeFixture";


export const metadata: Metadata = {
  title: "Canvas Smoke Fixture",
  robots: noindexRobots,
};
export default function CanvasSmokePage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <CanvasSmokeFixture />;
}
