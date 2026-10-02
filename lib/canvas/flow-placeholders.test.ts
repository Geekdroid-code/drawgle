import { describe, expect, it } from "vitest";

import type { FlowApproval, FlowFulfillment } from "@/lib/agent/flow-build";
import { flowPlaceholders } from "./flow-placeholders";

const approval: FlowApproval = {
  id: "root",
  goal: null,
  existingKeys: [],
  outputs: ["Feed", "Planner", "Spot", "Expenses", "Passport"].map((name, index) => ({
    stableKey: `screen:${index}`, name, kind: "screen" as const, parentStableKey: null, sequence: index + 1,
  })),
};
const claim = (index: number, status: FlowFulfillment["status"], run = "b2", screenId: string | null = null): FlowFulfillment =>
  ({ outputKey: `screen:${index}`, status, screenId, generationRunId: run });

describe("the whole approved flow on the canvas", () => {
  it("puts a phone for every approved screen in the first free slots the moment the flow is approved", () => {
    const phones = flowPlaceholders({ approval, run: { status: "building" }, fulfillments: [], screens: [] });
    expect(phones.map((phone) => [phone.name, phone.status, phone.x, phone.y])).toEqual([
      ["Feed", "queued", 4800, 4600], ["Planner", "queued", 5250, 4600], ["Spot", "queued", 5700, 4600],
      ["Expenses", "queued", 6150, 4600], ["Passport", "queued", 6600, 4600],
    ]);
  });

  it("gives each phone's place to its screen as the screen lands, keeping the rest where they were", () => {
    const screens = [{ name: "Feed", x: 4800, y: 4600, generationRunId: "b1", roadmapItemId: "r0" }];
    const phones = flowPlaceholders({
      approval, run: { status: "building" }, screens, nextSlot: { x: 5250, y: 4600 },
      fulfillments: [claim(0, "ready", "b1", "s0"), claim(1, "claimed"), claim(2, "claimed")],
      preview: { version: 1, stage: "screen_briefs", updatedAt: "", screens: [
        { stableKey: "screen:1", roadmapItemId: "r1", name: "Planner", type: "root", index: 0 },
        { stableKey: "screen:2", roadmapItemId: "r2", name: "Spot", type: "detail", index: 1 },
      ] },
    });
    expect(phones.map((phone) => [phone.name, phone.status, phone.detail, phone.x])).toEqual([
      ["Planner", "designing", "Writing the brief", 5250],
      ["Spot", "designing", "Writing the brief", 5700],
      ["Expenses", "queued", null, 6150],
      ["Passport", "queued", null, 6600],
    ]);
  });

  it("drops the phone of a screen whose own frame is already on the canvas, even before it is settled", () => {
    const screens = [
      { name: "Feed", x: 4800, y: 4600, generationRunId: "b1", roadmapItemId: "r0" },
      { name: "Planner", x: 5250, y: 4600, generationRunId: "b2", roadmapItemId: "r1" },
    ];
    const phones = flowPlaceholders({
      approval, run: { status: "building" }, screens,
      fulfillments: [claim(0, "ready", "b1", "s0"), claim(1, "claimed"), claim(2, "claimed")],
    });
    expect(phones.map((phone) => phone.name)).toEqual(["Spot", "Expenses", "Passport"]);
    expect(phones[0].x).toBe(5700);
  });

  it("keeps a screen that missed its batch on the canvas as up next, for its automatic retry", () => {
    const phones = flowPlaceholders({ approval, run: { status: "building" }, screens: [], fulfillments: [claim(0, "failed", "b1")] });
    expect(phones[0]).toMatchObject({ name: "Feed", status: "queued" });
  });

  it("leaves nothing behind once the flow is complete, paused or stopped", () => {
    expect(flowPlaceholders({ approval, run: { status: "completed" }, screens: [], fulfillments: [] })).toEqual([]);
    expect(flowPlaceholders({ approval, run: { status: "failed" }, screens: [], fulfillments: [claim(0, "failed")] })).toEqual([]);
    expect(flowPlaceholders({ approval, run: { status: "canceled" }, screens: [], fulfillments: [claim(0, "ready", "b1", "s0")] })).toEqual([]);
  });

  it("after Stop, shows only the screens still finishing", () => {
    const phones = flowPlaceholders({ approval, run: { status: "canceled" }, screens: [], fulfillments: [claim(0, "claimed")] });
    expect(phones.map((phone) => [phone.name, phone.status])).toEqual([["Feed", "designing"]]);
  });

  it("waits for the claims before drawing anything, and skips screens an earlier approval built", () => {
    expect(flowPlaceholders({ approval, run: { status: "building" }, screens: [], fulfillments: null })).toEqual([]);
    const reused = { ...approval, existingKeys: ["screen:0"] };
    expect(flowPlaceholders({ approval: reused, run: { status: "building" }, screens: [], fulfillments: [] })[0].name).toBe("Planner");
  });

  it("starts after the rightmost screen when the project's counter hasn't caught up", () => {
    const screens = [{ name: "Old", x: 6000, y: 4600, generationRunId: "older", roadmapItemId: null }];
    const phones = flowPlaceholders({ approval, run: { status: "building" }, screens, fulfillments: [], nextSlot: { x: 5250, y: 4600 } });
    expect(phones[0].x).toBe(6450);
  });
});
