import { describe, expect, it } from "vitest";

import {
  buildDesignInstruction,
  buildEditSystemInstruction,
  buildPromptScreenInstruction,
  buildRecreateScreenInstruction,
  buildStyleScreenInstruction,
  plannerBlueprintStepInstruction,
  plannerScreenBriefStepInstruction,
  referenceAnalysisStyleInstruction,
} from "@/lib/generation/prompts";
import { presetTokens } from "@/lib/generation/curated-style-preset-fixtures";
import { NAVIGATION_QUESTION, TYPEFACE_QUESTION } from "@/lib/generation/reference-focus";
import { SPECIMEN_MARKING_INSTRUCTION } from "@/lib/generation/style-components";
import { buildTypographyRoleContract } from "@/lib/generation/type-roles";
import { proposalResponseSchema } from "@/lib/product-planning/proposal-response";
import type { GenerationPromptMode } from "@/lib/generation/prompt-routing";
import type { ScreenPlan } from "@/lib/types";

/**
 * A prompt is read for every product a user can name, so it must not carry an example that belongs to one: the pet
 * project the pipeline was first tested on, or the meditation reference its presets were first built from. A model
 * that is shown "Today, Pets, Routines" as the example of a navigation suggests it for a bank. What a prompt
 * names here is checked by its words, so that a later edit that brings one back fails. ("Recipe" is not on the list:
 * design-system language uses it for a formula, as in a surface recipe.)
 */

const ONE_PRODUCT = /\b(pets?|dogs?|cats?|puppy|kitten|routines?|meditat\w*|mindful\w*|wellness|yoga|calendar strip|week strip|media card|featured card|donut|playlist|fintech|crypto|fitness|workout|podcast)\b/i;

const screenPlan: ScreenPlan = { name: "Screen", type: "detail", description: "A screen." };
const builderInput = {
  designTokens: presetTokens(), designStyle: null, screenPlan, prompt: "An app", requiresBottomNav: false,
  navigationArchitecture: null, navigationPlan: null, assetManifest: [],
};
const modes: GenerationPromptMode[] = ["recreate", "style", "prompt"];

const texts: Record<string, string> = {
  "the builder, rebuilding a screen": buildRecreateScreenInstruction(builderInput),
  "the builder, in style mode": buildStyleScreenInstruction(builderInput),
  "the builder, from a prompt": buildPromptScreenInstruction(builderInput),
  "the editor": buildEditSystemInstruction({ designTokens: presetTokens() }),
  "the text roles": buildTypographyRoleContract(),
  "the reference analysis": referenceAnalysisStyleInstruction,
  "the specimen marking": SPECIMEN_MARKING_INSTRUCTION,
  "the typeface close-up": TYPEFACE_QUESTION,
  "the bar close-up": NAVIGATION_QUESTION,
  "the navigation schema the planner fills": JSON.stringify(proposalResponseSchema),
  ...Object.fromEntries(modes.map((mode) => [`the token model, ${mode}`, buildDesignInstruction(mode)])),
  ...Object.fromEntries(modes.map((mode) => [`the planner's blueprint step, ${mode}`, plannerBlueprintStepInstruction(mode)])),
  ...Object.fromEntries(modes.map((mode) => [`the planner's brief step, ${mode}`, plannerScreenBriefStepInstruction(mode)])),
};

describe("what the prompts say to every product", () => {
  it.each(Object.entries(texts))("%s names no product and no reference of its own", (_name, text) => {
    expect(text.match(ONE_PRODUCT)?.[0] ?? null).toBeNull();
  });

  it("shows the reference analysis more than one way that surfaces separate, so its example is not one reference's look", () => {
    // it once read "cards a tone lighter than the page with no shadow, and tiles a step darker inside the cards"
    const example = referenceAnalysisStyleInstruction.match(/Describe character and relationships instead, for example ([^\n]*)/)?.[1] ?? "";
    for (const way of ["tone", "shadow", "border"]) expect(example, way).toContain(way);
  });
});
