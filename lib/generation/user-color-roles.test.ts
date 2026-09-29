import { describe, expect, it } from "vitest";

import { userNamedColorRoles } from "@/lib/generation/user-color-roles";

const requirements = (...facts: Array<{ label: string; detail: string }>) => [
  "EXPLICIT USER DESIGN REQUIREMENTS",
  "Preserve these evidenced choices.",
  JSON.stringify(facts.map((fact, index) => ({ id: `f${index}`, evidence: "user said so", ...fact }))),
  'Reference transfer: {"compatible":true,"conflicts":["dark chrome"],"transfer":"warm red accent and dark chrome"}',
].join("\n");

describe("user-named colour roles", () => {
  it("returns nothing when no colour is named", () => {
    expect(userNamedColorRoles(null)).toEqual(new Set());
    expect(userNamedColorRoles("")).toEqual(new Set());
    expect(userNamedColorRoles(requirements({ label: "Audience", detail: "Families with several pets and a busy morning routine" }))).toEqual(new Set());
  });

  it("infers the roles of colours named without one: the pet project's Soft Sage and Warm Cream", () => {
    const roles = userNamedColorRoles(requirements({ label: "Colour palette", detail: "Soft Sage and Warm Cream" }));
    expect(roles).toEqual(new Set(["action", "background"]));
  });

  it("uses the role words next to a colour when there are any", () => {
    expect(userNamedColorRoles(requirements({ label: "Accent", detail: "A deep teal accent for buttons" }))).toEqual(new Set(["action"]));
    expect(userNamedColorRoles(requirements({ label: "Background", detail: "Off-white background with white cards" }))).toEqual(new Set(["background", "surface"]));
    expect(userNamedColorRoles(requirements({ label: "Type", detail: "Charcoal text on everything" }))).toEqual(new Set(["text"]));
  });

  it("reads hex codes by their colour when no role is stated", () => {
    expect(userNamedColorRoles(requirements({ label: "Brand", detail: "Use #FF6B35" }))).toEqual(new Set(["action"]));
    expect(userNamedColorRoles(requirements({ label: "Base", detail: "#FAF3E3" }))).toEqual(new Set(["background"]));
    expect(userNamedColorRoles(requirements({ label: "Base", detail: "#0E0F13" }))).toEqual(new Set(["background", "text"]));
  });

  it("does not read colour words from the reference transfer note", () => {
    const text = requirements({ label: "Tone", detail: "Calm and trustworthy" });
    expect(text).toContain("warm red accent");
    expect(userNamedColorRoles(text)).toEqual(new Set());
  });

  it("falls back to reading plain text as one requirement", () => {
    expect(userNamedColorRoles("The app should use a sage green primary colour")).toEqual(new Set(["action"]));
  });
});
