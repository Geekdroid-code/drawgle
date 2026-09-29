import { describe, expect, it } from "vitest";

import {
  buildDesignInstruction,
  buildEditSystemInstruction,
  buildPromptScreenInstruction,
  buildRecreateScreenInstruction,
  buildStyleScreenInstruction,
  referenceAnalysisRecreateInstruction,
  referenceAnalysisStyleInstruction,
} from "@/lib/generation/prompts";
import type { GenerationPromptMode } from "@/lib/generation/prompt-routing";
import { presetTokens } from "@/lib/generation/curated-style-preset-fixtures";
import { buildTypographyRoleContract } from "@/lib/generation/type-roles";
import { buildTokenPromptContext } from "@/lib/token-runtime";
import type { ScreenPlan } from "@/lib/types";

/**
 * What the builder, the token model and the reference analysis are told about type and spacing. These
 * lines are what a preset build for the mindfulness reference got wrong: a title in a top bar built as a
 * 28px serif screen title, and 32px between every block of a reference that keeps its cards 16px apart.
 */

const screenPlan: ScreenPlan = { name: "Player", type: "detail", description: "A meditation player with a top bar and a featured card." };
const input = {
  designTokens: null, designStyle: null, screenPlan, prompt: "A meditation app", requiresBottomNav: false,
  navigationArchitecture: null, navigationPlan: null, assetManifest: [],
};
const builderInstruction = (mode: GenerationPromptMode) => mode === "recreate"
  ? buildRecreateScreenInstruction(input)
  : mode === "style" ? buildStyleScreenInstruction(input) : buildPromptScreenInstruction(input);
const modes: GenerationPromptMode[] = ["recreate", "style", "prompt"];

describe("the builder is told what each text role is for", () => {
  it.each(modes)("in %s mode: a title beside a back arrow is the top-bar role, and every role is a named example", (mode) => {
    const prompt = builderInstruction(mode);
    expect(prompt).toContain("TYPE ROLES:");
    expect(prompt).toContain("A title that sits beside a back arrow is always this role.");
    expect(prompt).toContain("It is never the title of a top app bar.");
    // the examples the builder is offered include the top-bar role (it used to leave it out)
    expect(prompt).toContain("dg-type-nav-title, dg-type-screen-title, dg-type-hero-title, dg-type-section-title, dg-type-metric-value, dg-type-body, dg-type-supporting, dg-type-caption, dg-type-button-label");
    expect(prompt).toContain("Use the matching dg-type-* class from TYPE ROLES");
  });

  it("uses one definition of the roles for the builder, the editor and the project memory", () => {
    const roles = buildTypographyRoleContract();
    for (const role of ["nav-title", "screen-title", "hero-title", "section-title", "metric-value", "body", "supporting", "caption", "button-label"]) {
      expect(roles.match(new RegExp(`- dg-type-${role} \\(`, "g")), role).toHaveLength(1);
    }
    expect(buildEditSystemInstruction({ designTokens: null })).toContain(roles);
    expect(builderInstruction("style")).toContain(roles);
  });

  it("shows the builder the whole type scale, hero size included, so that it can compare roles by size", () => {
    const context = buildTokenPromptContext(presetTokens(), "compact_visual");
    for (const role of ["nav_title", "screen_title", "hero_title", "section_title", "body"]) {
      expect(context, role).toContain(`typography.${role}.size`);
    }
  });
});

describe("the builder keeps a three-level vertical rhythm", () => {
  it.each(modes)("in %s mode: the section gap is not put between every block", (mode) => {
    const prompt = builderInstruction(mode);
    expect(prompt).toContain("in three levels");
    expect(prompt).toContain("never put the section gap between every block");
    expect(prompt).toContain("A section title and the content it introduces are one group");
    // the rules that opened every layout up are gone
    expect(prompt).not.toContain("major sections use gap-[var(--dg-mobile-layout-section-gap)]");
    expect(prompt).not.toContain("generous space between groups");
    expect(prompt).not.toMatch(/normally use px-\[var\(--dg-mobile-layout-screen-margin\)\] and gap-\[var\(--dg-mobile-layout-section-gap\)\]/);
    expect(prompt).toContain("Section gap (the space before a new titled section)");
    expect(prompt).toContain("Element gap (the space between neighbouring blocks that belong together)");
  });

  it("makes icon buttons squares, so that no circle is stretched into an oval and no title row forced tall", () => {
    const prompt = builderInstruction("style");
    expect(prompt).toContain("An icon-only button is a square of exactly that size (w-[48px] h-[48px])");
    expect(prompt).toContain("never pair a smaller fixed size with min-h");
    expect(prompt).toContain("only its hit area grows");
  });

  it("has the image win over the token gaps when it rebuilds a screen, and only then", () => {
    expect(builderInstruction("recreate")).toContain("Proportions and spacing follow the image");
    expect(builderInstruction("style")).not.toContain("Proportions and spacing follow the image");
    expect(builderInstruction("prompt")).not.toContain("Proportions and spacing follow the image");
  });

  it("has a rebuild size its media areas from the image, and not default to a portrait ratio", () => {
    expect(builderInstruction("recreate")).toContain("Size every image, illustration and media area from the image too");
    expect(builderInstruction("recreate")).toContain("A portrait ratio such as 4/5 is a default");
    expect(builderInstruction("style")).not.toContain("Size every image, illustration and media area");
    expect(builderInstruction("prompt")).not.toContain("Size every image, illustration and media area");
  });
});

describe("the token model reads type and spacing from the evidence", () => {
  it.each(modes)("in %s mode: one typeface may serve both roles, and a generic keyword is not a font", (mode) => {
    const prompt = buildDesignInstruction(mode);
    expect(prompt).not.toContain("must use different primary font families");
    expect(prompt).not.toContain("universal stack");
    expect(prompt).toContain("give heading_font_family and body_font_family the same family");
    expect(prompt).toContain("It is never a generic keyword on its own (serif, sans-serif, system-ui)");
    expect(prompt).toContain("read them from the letterforms");
    expect(prompt).toContain("Words in different weights of one typeface");
  });

  it.each(modes)("in %s mode: gaps come from the evidence, and a feeling is not evidence for wider ones", (mode) => {
    const prompt = buildDesignInstruction(mode);
    expect(prompt).not.toContain("airy systems should not use cramped section gaps");
    expect(prompt).toContain("describe a feeling and are not evidence for larger gaps");
    expect(prompt).toContain("element_gap is the space between neighbouring blocks that belong together");
    expect(prompt).toContain("section_gap is the space before a new titled section");
    expect(prompt).toContain("nav_title is the small title in a top app bar");
    expect(prompt).toContain("do not default titles to bold");
  });
});

describe("the reference analysis names the typeface from its letters and describes gaps by relationship", () => {
  it("in both analysis prompts", () => {
    for (const prompt of [referenceAnalysisStyleInstruction, referenceAnalysisRecreateInstruction]) {
      expect(prompt).toContain("Typeface: name it from the letterforms of the largest headings");
      expect(prompt).toContain("A light word beside a bold word is one typeface in two weights");
    }
    expect(referenceAnalysisStyleInstruction).toContain("describe how the gaps relate to each other, not how they feel");
    expect(referenceAnalysisStyleInstruction).toContain("Do not call a layout airy, spacious, generous or relaxed");
  });
});

describe("the reference analysis tells an attached bar from a floating one by the bar's edges", () => {
  it("in both analysis prompts, with the phone frame's own corners ruled out as a gap", () => {
    for (const prompt of [referenceAnalysisStyleInstruction, referenceAnalysisRecreateInstruction]) {
      expect(prompt).toContain("Attached or floating is decided by the bar's edges.");
      expect(prompt).toContain("reach the edges of the screen with no page background visible below or beside it, even when its top corners are rounded");
      expect(prompt).toContain("The rounded outer corners of a phone frame in a mockup are not a gap");
      expect(prompt).toContain("Count every icon of the bar, even when it has no labels.");
      expect(prompt).toContain("activeTreatment is icon-fill when the active icon sits inside a filled circle or capsule");
    }
  });

  it("asks the style analysis for the bar's icon count, which a preset's sample bar is drawn from", () => {
    expect(referenceAnalysisStyleInstruction).toMatch(/"primaryNavigation": \{\s+"present": true,\s+"itemCount": 5,/);
  });
});
