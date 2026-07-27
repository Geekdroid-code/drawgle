import type { Metadata } from "next";

import { DraftLandingSections } from "@/components/landing/DraftLandingSections";

export const metadata: Metadata = {
  title: "Drawgle landing page study",
  description:
    "An isolated landing page design study for Drawgle's governed AI mobile app design workflow.",
};

export default function DraftLandingPage() {
  return <DraftLandingSections />;
}
