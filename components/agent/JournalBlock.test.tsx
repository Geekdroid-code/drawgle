import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { GenerationJournalMetadata } from "@/lib/types";
import { JournalBlock } from "./JournalBlock";

const journal = (referenceStatus: "active" | "completed"): GenerationJournalMetadata => ({
  version: 1, generationRunId: "run", status: referenceStatus === "active" ? "planning" : "completed",
  title: referenceStatus === "active" ? "Designing your app" : "Created 1 screen", detail: "Delivered 1 screen to the canvas.",
  activePhase: referenceStatus === "active" ? "reference" : null,
  phases: [
    { id: "brief", label: "Brief received", status: "completed", detail: "Received the project brief and queued planning." },
    { id: "reference", label: "Reference direction", status: referenceStatus, detail: "Using curated visual evidence for style direction: sneaker-ecom-futuristic-light." },
    { id: "design", label: "Design system", status: referenceStatus === "active" ? "pending" : "completed" },
  ],
  screens: [{ name: "Drops", status: referenceStatus === "active" ? "planned" : "ready" }],
});

describe("a regular build's journal in chat", () => {
  afterEach(() => cleanup());

  it("calls the look's source design decisions and never spells it out, while it runs or after", () => {
    const live = render(<JournalBlock journal={journal("active")} />);
    expect(screen.getAllByText("Formulating design decisions for the UI direction").length).toBeGreaterThan(0);
    expect(live.container.textContent).not.toMatch(/curated|sneaker|reference/i);
    live.unmount();

    const done = render(<JournalBlock journal={journal("completed")} />);
    expect(screen.getByText("Created 1 screen")).toBeTruthy();
    expect(done.container.textContent).not.toMatch(/curated|sneaker|reference/i);
  });
});
