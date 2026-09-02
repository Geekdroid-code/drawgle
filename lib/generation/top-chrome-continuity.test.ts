import { describe, expect, it } from "vitest";

import { indexScreenCode } from "@/lib/generation/block-index";
import {
  buildTopChromeContinuityEvidenceSection,
  extractTopChromeContinuityEvidence,
  rememberFirstRunChromeEvidence,
  type RunChromeEvidence,
} from "@/lib/generation/top-chrome-continuity";

describe("same-run top chrome continuity", () => {
  it("extracts the indexed top-level header without including the screen body or bottom navigation", () => {
    const code = `
      <div class="screen-shell">
        <header data-section="top-bar" class="flex items-center justify-between px-5 py-4">
          <button aria-label="Back">←</button>
          <h1>Property details</h1>
          <button aria-label="Save">♡</button>
        </header>
        <main><section><h2>Inside the home</h2><p>Body content must not be copied.</p></section></main>
        <nav data-section="bottom-tab-bar"><button>Home</button><button>Saved</button></nav>
      </div>
    `;

    const evidence = extractTopChromeContinuityEvidence({
      screenName: "Property details",
      chromeKind: "top-bar-back",
      code,
      blockIndex: indexScreenCode(code),
    });

    expect(evidence).toMatchObject({
      screenName: "Property details",
      chromeKind: "top-bar-back",
    });
    expect(evidence?.html).toContain("<header");
    expect(evidence?.html).toContain("Property details");
    expect(evidence?.html).not.toContain("Body content must not be copied");
    expect(evidence?.html).not.toContain("bottom-tab-bar");
  });

  it("does not treat bottom-tabs as top-chrome evidence", () => {
    const code = `<div><header data-section="top-bar"><h1>Home</h1></header><main>Body</main></div>`;
    expect(extractTopChromeContinuityEvidence({
      screenName: "Home",
      chromeKind: "bottom-tabs",
      code,
      blockIndex: indexScreenCode(code),
    })).toBeNull();
  });

  it("hard-caps compact evidence and keeps the continuity section separate", () => {
    const code = `<div><header data-section="app-bar"><h1>${"Long title ".repeat(260)}</h1></header><main>Body</main></div>`;
    const evidence = extractTopChromeContinuityEvidence({
      screenName: "Long header",
      chromeKind: "top-bar",
      code,
      blockIndex: indexScreenCode(code),
    });

    expect(evidence).not.toBeNull();
    expect(evidence!.html.length).toBeLessThanOrEqual(1800);
    expect(evidence!.html).toContain("<!-- clipped -->");
    const section = buildTopChromeContinuityEvidenceSection(evidence!);
    expect(section.startsWith("TOP CHROME CONTINUITY EVIDENCE\n")).toBe(true);
    expect(section).toContain("Do not copy unrelated screen body topology.");
  });

  it("keeps the first successful sample for each chrome kind", () => {
    const runEvidence: RunChromeEvidence = {};
    const first = { chromeKind: "top-bar-back" as const, screenName: "Details", html: "<header>First</header>" };
    const later = { chromeKind: "top-bar-back" as const, screenName: "Checkout", html: "<header>Later</header>" };

    expect(rememberFirstRunChromeEvidence(runEvidence, first)).toBe(true);
    expect(rememberFirstRunChromeEvidence(runEvidence, later)).toBe(false);
    expect(runEvidence["top-bar-back"]).toEqual(first);
  });
});
