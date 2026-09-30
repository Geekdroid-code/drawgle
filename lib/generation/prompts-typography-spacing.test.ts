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
 * What the builder, the token model and the reference analysis are told about type and spacing. Each line here
 * fixes something that was wrong in an instruction and showed in more than one build: a title in a top bar built
 * as a 28px serif screen title, and 32px between every block of a reference that keeps its cards 16px apart. A
 * line that changed nothing, or that described one screen of one reference, is not in the prompts.
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
    expect(prompt).toContain("A title beside a back arrow is always this role.");
    expect(prompt).toContain("Never a top-bar title.");
    // the examples the builder is offered include the top-bar role (it used to leave it out)
    expect(prompt).toContain("dg-type-nav-title, dg-type-screen-title, dg-type-hero-title, dg-type-section-title, dg-type-metric-value, dg-type-body, dg-type-supporting, dg-type-caption, dg-type-button-label");
    expect(prompt).toContain("Use the matching dg-type-* class from TYPE ROLES");
  });

  it("uses one definition of the roles for the builder, the editor and the project memory", () => {
    const roles = buildTypographyRoleContract();
    for (const role of ["nav-title", "screen-title", "hero-title", "section-title", "metric-value", "body"]) {
      expect(roles.match(new RegExp(`- dg-type-${role} \\(`, "g")), role).toHaveLength(1);
    }
    for (const role of ["supporting", "caption", "button-label"]) expect(roles, role).toContain(`dg-type-${role}:`);
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
  it.each(modes)("in %s mode: the section gap is only above a new titled section", (mode) => {
    const prompt = builderInstruction(mode);
    expect(prompt).toContain("in three levels");
    expect(prompt).toContain("Only the first element of a new titled section gets mt-[var(--dg-mobile-layout-section-gap)]");
    expect(prompt).toContain("A column whose blocks are all separated by the section gap is wrong.");
    // the rules that opened every layout up are gone
    expect(prompt).not.toContain("major sections use gap-[var(--dg-mobile-layout-section-gap)]");
    expect(prompt).not.toContain("generous space between groups");
    expect(prompt).not.toMatch(/normally use px-\[var\(--dg-mobile-layout-screen-margin\)\] and gap-\[var\(--dg-mobile-layout-section-gap\)\]/);
    expect(prompt).toContain("Section gap (the space before a new titled section)");
    expect(prompt).toContain("Element gap (the space between neighbouring blocks that belong together)");
  });

  it("makes icon buttons squares, so that no circle is stretched into an oval", () => {
    const prompt = builderInstruction("style");
    expect(prompt).toContain("An icon-only button is a 48px square (w-[48px] h-[48px])");
    expect(prompt).toContain("never a smaller fixed size plus min-h");
  });

  it("has the image win over the token gaps when it rebuilds a screen, and only then", () => {
    expect(builderInstruction("recreate")).toContain("Proportions and spacing follow the image");
    expect(builderInstruction("style")).not.toContain("Proportions and spacing follow the image");
    expect(builderInstruction("prompt")).not.toContain("Proportions and spacing follow the image");
  });

  it("carries no anecdote from a single reference", () => {
    for (const mode of modes) {
      const prompt = builderInstruction(mode);
      // the screen brief in this test's input names a featured card, so only what a rule would say about one is checked
      expect(prompt).not.toMatch(/mindfulness|1\.4 times|aspect-\[9\/7\]|where the reference's was|portrait ratio such as 4\/5/i);
    }
  });
});

describe("the token model reads type and spacing from the evidence", () => {
  it.each(modes)("in %s mode: one typeface may serve both roles, and a bare keyword is not a font", (mode) => {
    const prompt = buildDesignInstruction(mode);
    expect(prompt).not.toContain("must use different primary font families");
    expect(prompt).not.toContain("universal stack");
    expect(prompt).toContain("Use the same family for both when the evidence shows one typeface");
    expect(prompt).toContain("never a bare keyword such as serif or sans-serif");
  });

  it.each(modes)("in %s mode: gaps come from the evidence, and a feeling is not evidence for wider ones", (mode) => {
    const prompt = buildDesignInstruction(mode);
    expect(prompt).not.toContain("airy systems should not use cramped section gaps");
    expect(prompt).toContain("Feelings such as airy or generous are not evidence for larger gaps");
    expect(prompt).toContain("element_gap is the space between neighbouring blocks that belong together");
    expect(prompt).toContain("section_gap the space before a new titled section");
    expect(prompt).toContain("nav_title is the small title of a top app bar");
    expect(prompt).toContain("do not default them to bold");
  });
});

describe("the reference analysis", () => {
  it("asks the style analysis for the bar's icon count, which a preset's sample bar is drawn from", () => {
    expect(referenceAnalysisStyleInstruction).toMatch(/"primaryNavigation": \{\s+"present": true,\s+"itemCount": 5,/);
    expect(referenceAnalysisStyleInstruction).toContain("itemCount is the number of icons in the bar, even when it has no labels.");
  });

  it("is not given rules about typeface, spacing or an attached bar: a close-up of each phone settles those", () => {
    // the analysis read a serif and a floating capsule with these rules in it, so a close-up decides (see reference-focus.ts)
    for (const prompt of [referenceAnalysisStyleInstruction, referenceAnalysisRecreateInstruction]) {
      expect(prompt).not.toContain("Typeface: name it from the letterforms");
      expect(prompt).not.toContain("Attached or floating is decided by the bar's edges");
    }
    expect(referenceAnalysisStyleInstruction).not.toContain("describe how the gaps relate to each other");
  });
});
