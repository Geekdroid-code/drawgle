import type { Metadata } from "next";

import { MkButton } from "@/components/marketing/MkButton";
import { StatusScreen } from "@/components/marketing/StatusScreen";
import { noindexRobots } from "@/lib/seo/metadata";

export const metadata: Metadata = {
  title: "Page not found",
  robots: noindexRobots,
};

export default function NotFound() {
  return (
    <StatusScreen
      code="404"
      title="That page isn't"
      emphasis="on the canvas."
      description="The link may be out of date, or the address may have a typo. Head back and pick up where you left off."
    >
      <MkButton href="/">Back to Drawgle</MkButton>
      <MkButton href="/project/new" variant="secondary">
        Start a project
      </MkButton>
    </StatusScreen>
  );
}
