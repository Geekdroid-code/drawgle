import { notFound } from "next/navigation";

import { CanvasSmokeFixture } from "@/components/CanvasSmokeFixture";

export default function CanvasSmokePage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <CanvasSmokeFixture />;
}
