import { describe, expect, it } from "vitest";

import {
  hasDesignValues,
  stripDesignValues,
  stripDesignValuesDeep,
  stripDesignValuesFromList,
} from "@/lib/generation/design-value-scrub";

/** The values as the pet run's stages wrote them, each copied from the one before. */
const PET_RUN = [
  "Warm cream background (#FDFBF0)",
  "High corner radius (24pt+)",
  "Soft drop shadows with low spread",
  "Radius should be at least 24px. Shadows must be soft.",
  "Highly rounded (32px) cards with soft, low-spread shadows and glass-morphism navigation docks.",
  "Warm Cream (#F9F6F0) background with Off-White cards.",
  "high corner radii (32px)",
  "white cards with 32px radii",
  "Each card uses a 32px radius",
  "off-white cards sit on a #F9F6F0 cream base with a 4% opacity soft shadow",
  "MUST PRESERVE: The 32px corner radius on all cards.",
  "Cards use 0 4px 20px rgba(45,41,38,0.04) as their shadow.",
];

describe("stripDesignValues", () => {
  it("removes every px, pt, hex, colour-function and opacity value the pet run copied downstream", () => {
    for (const line of PET_RUN) {
      const stripped = stripDesignValues(line);
      expect(stripped, line).not.toMatch(/\d+\s?(?:px|pt)/i);
      expect(stripped, line).not.toMatch(/#[0-9a-f]{3,8}\b/i);
      expect(stripped, line).not.toMatch(/\d+\s?%\s*opacity/i);
      expect(stripped, line).not.toMatch(/rgba?\(/i);
      expect(hasDesignValues(stripped), line).toBe(false);
    }
  });

  it("leaves readable sentences behind", () => {
    expect(stripDesignValues("Warm cream background (#FDFBF0)")).toBe("Warm cream background");
    expect(stripDesignValues("High corner radius (24pt+)")).toBe("High corner radius");
    expect(stripDesignValues("Each card uses a 32px radius")).toBe("Each card uses a radius");
    expect(stripDesignValues("Radius should be at least 24px. Shadows must be soft.")).toBe("Radius should be. Shadows must be soft.");
    expect(stripDesignValues("Warm Cream (#F9F6F0) background with Off-White cards.")).toBe("Warm Cream background with Off-White cards.");
    expect(stripDesignValues("off-white cards sit on a #F9F6F0 cream base with a 4% opacity soft shadow"))
      .toBe("off-white cards sit on a cream base with a soft shadow");
    expect(stripDesignValues("Cards use 0 4px 20px rgba(45,41,38,0.04) as their shadow.")).toBe("Cards use as their shadow.");
  });

  it("removes ranges, comparatives and blur values", () => {
    expect(stripDesignValues("Cards are 16-20pt with about 12px blur")).toBe("Cards are with blur");
    expect(stripDesignValues("padding of 16px, gaps of ~8px")).toBe("padding, gaps");
    expect(stripDesignValues("shadow 0 12px 32px rgba(15,23,42,0.14) under sheets")).toBe("shadow under sheets");
    expect(stripDesignValues("a 60% alpha scrim and opacity 0.4 overlay")).toBe("a scrim and overlay");
  });

  it("keeps proportions, counts and layout language that are not design values", () => {
    for (const text of [
      "A two-column grid with a 60/40 split and a lower sheet occupying about 40% of the viewport.",
      "The week selector is the calendar strip; the selected day is a vertical capsule.",
      "Step 3 of 5, with 12 tasks and a 2:1 hero ratio.",
      "Use the stat-tile pair for Meals and Meds.",
    ]) {
      expect(hasDesignValues(text)).toBe(false);
      expect(stripDesignValues(text)).toBe(text);
    }
  });

  it("does not mistake issue numbers or words for hex colours", () => {
    expect(stripDesignValues("See issue #2 and step #10 for details")).toBe("See issue #2 and step #10 for details");
    expect(stripDesignValues("A #add8e6 tint")).toBe("A tint");
  });

  it("leaves a product's own content alone: points, order and ticket numbers, tags, releases, print settings", () => {
    // each of these was cut to fragments ("1,s", "Maya s", "Order", "i") when a unit could run into a word
    for (const text of [
      "Header shows 1,250 pts earned this week and a streak badge.",
      "Leaderboard rows: Maya 980 pts, Leo 875 pts.",
      "Latest order card: Order #1042, arriving Friday.",
      "Support ticket #203 with its status chip.",
      "A #cafe tag chip under the post.",
      "Printer settings list: 300 dpi, 600 dpi.",
      "Work 2 remote days a week.",
      "Join the alpha 2 waitlist.",
    ]) {
      expect(hasDesignValues(text), text).toBe(false);
      expect(stripDesignValues(text)).toBe(text);
    }
  });

  it("still removes the short colours a model writes: a repeated character, or letters with digits", () => {
    expect(stripDesignValues("Text in #fff on a #000 bar")).toBe("Text in on a bar");
    expect(stripDesignValues("A #F5A accent and a #3b82 ring")).toBe("A accent and a ring");
    expect(stripDesignValues("Cards at 16 pt, a 1rem gap and opacity: 40%")).toBe("Cards, a gap");
  });

  it("is idempotent and handles empty input", () => {
    for (const line of PET_RUN) {
      const once = stripDesignValues(line);
      expect(stripDesignValues(once)).toBe(once);
    }
    expect(stripDesignValues("")).toBe("");
    expect(hasDesignValues(null)).toBe(false);
    expect(hasDesignValues(undefined)).toBe(false);
  });
});

describe("list and deep helpers", () => {
  it("scrubs lists and drops entries that become empty", () => {
    expect(stripDesignValuesFromList(["Soft and warm", "#FDFBF0", "24px", "Rounded (32px) cards"]))
      .toEqual(["Soft and warm", "Rounded cards"]);
  });

  it("scrubs every string leaf and keeps the shape", () => {
    const value = {
      styleEssence: "Highly rounded (32px) cards",
      list: ["Warm cream (#FDFBF0)", { nested: "12px gap" }],
      count: 3,
      flag: true,
      nothing: null,
    };
    expect(stripDesignValuesDeep(value)).toEqual({
      styleEssence: "Highly rounded cards",
      list: ["Warm cream", { nested: "gap" }],
      count: 3,
      flag: true,
      nothing: null,
    });
    expect(value.styleEssence).toBe("Highly rounded (32px) cards");
  });
});
