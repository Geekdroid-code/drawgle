"use client";

import { useEffect } from "react";

import { MkButton } from "@/components/marketing/MkButton";
import { StatusScreen } from "@/components/marketing/StatusScreen";
import { siteConfig } from "@/lib/seo/config";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled render error", error);
  }, [error]);

  return (
    <StatusScreen
      code="Error"
      title="Something went wrong"
      emphasis="on our side."
      description={
        <>
          This page hit an unexpected error. Try again, and if it keeps happening, email{" "}
          <a className="font-medium text-mk-accent" href={`mailto:${siteConfig.supportEmail}`}>
            {siteConfig.supportEmail}
          </a>
          .
        </>
      }
      reference={error.digest}
    >
      <MkButton onClick={reset}>Try again</MkButton>
      <MkButton href="/" variant="secondary">
        Back to Drawgle
      </MkButton>
    </StatusScreen>
  );
}
