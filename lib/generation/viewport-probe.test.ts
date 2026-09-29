import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const evaluated: unknown[] = [];
vi.mock("playwright", () => ({
  chromium: {
    launch: async () => ({
      newPage: async () => ({
        setContent: async () => undefined,
        evaluate: async (argument: unknown) => {
          evaluated.push(argument);
          return typeof argument === "string" && argument.startsWith("((") ? [] : true;
        },
        close: async () => undefined,
      }),
      close: async () => undefined,
    }),
  },
}));

import { inspectScreenViewport, VIEWPORT_PROBE_SOURCE } from "./viewport-health";

describe("viewport probe", () => {
  it("sends only source text into the page, so bundler helpers cannot leak into it", async () => {
    await inspectScreenViewport({ code: "<main>Today</main>", tokens: null, navigationPlan: null, navigationItemId: "today" });

    expect(evaluated).toHaveLength(4);
    expect(evaluated.every((argument) => typeof argument === "string")).toBe(true);
    expect(evaluated[1]).toContain('("today")');
  });

  it("is self-contained JavaScript that runs without Node or bundler helpers", () => {
    document.body.innerHTML = `<div id="drawgle-export-root"><main><button class="bg-black">Save</button></main></div>`;
    const run = new Function(`"use strict"; return (${VIEWPORT_PROBE_SOURCE})(null);`);

    expect(run()).toEqual(expect.any(Array));
  });
});
