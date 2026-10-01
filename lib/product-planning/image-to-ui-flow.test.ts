import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

import { imageToUiStep, nextProductBatch, type ProductFulfillment } from "./execution";
import { validateExecutionProduct } from "./execution-contract";
import { functionalStateVariant, type FunctionalItem } from "./functional-plan";
import { productScopeContract, scopedGenerationPrompt } from "./generation-context";
import { productReferenceExecution } from "./reference-execution";
import { scopeParents } from "./scope-outputs";
import { bindApprovedScreenPlans } from "./screen-plan-contract";
import { designerFixture, functionalFixture } from "./test-fixtures";
import type { ProductPlanning } from "./model";

/**
 * The whole path of an Image to UI flow whose image has fewer frames than its approved outputs, through every check
 * a batch's run makes, as the live "clone them" project took it: Library, Editor and Insights on frames 1 to 3 of a
 * three-frame image, and the editor's resolution overlay approved as a state on a fourth frame that does not exist.
 * The first fix stopped this flow after one screen: its style batch failed the run's own plan check.
 */
const image = { data: "three-frame-source", mimeType: "image/png" };

const approvedCopy = (manifest: FunctionalItem[]): ProductPlanning => {
  const state = designerFixture();
  state.input.imageReferenceMode = "recreate";
  state.scope!.status = "approved";
  state.scope!.outputPolicy = "manual_states_v1";
  state.scope!.manifest = manifest;
  state.experience!.referenceHash = createHash("sha256").update(image.data).digest("hex");
  return state;
};
const frame = (key: string, name: string, index: number): FunctionalItem =>
  ({ ...functionalFixture(key, name, index), referenceScreenIndex: index, rendering: "reference_frame" });
const cloneThem = () => approvedCopy([
  frame("screen:library", "Library", 1),
  frame("screen:editor", "New Project (Editor)", 2),
  frame("screen:insights", "Insights", 3),
  { ...frame("state:editor:resolution-settings", "Resolution Settings Overlay", 4), kind: "state", parentStableKey: "screen:editor",
    stateKey: "resolution-settings", triggerLabel: "Tap Resolution Badge",
    editInstruction: "The dark grey overlay with Resolution, Frame rate and Color selectors." },
]);

const ready = (keys: string[], run: string): ProductFulfillment[] =>
  keys.map((key) => ({ output_key: key, generation_run_id: run, status: "ready", screen_id: `screen-${key}` }));
const keysOf = (items: FunctionalItem[]) => items.map((item) => item.stableKey);

/**
 * What a batch's run checks before it builds (trigger/generate-ui-flow.ts), with the plan the coordinator gave it. The
 * run plans the batch's screens, which for a state is its parent screen (the coordinator sends it as the seed).
 */
const runChecks = (state: ProductPlanning, keys: string[], framesSeen: number) => {
  const recreate = productReferenceExecution(state).mode === "user_recreate";
  validateExecutionProduct(state, image);
  const planned = scopeParents(state, keys).map((item) => ({ name: item.name, type: "detail" as const, description: item.description }));
  const screens = bindApprovedScreenPlans(state, keys, planned, recreate ? framesSeen : 0);
  return { recreate, screens, prompt: scopedGenerationPrompt(state, keys), contract: productScopeContract(state, recreate ? "user_recreate" : "user_style", keys) };
};

describe("an Image to UI flow with fewer frames than approved outputs", () => {
  it("copies the frames the image has, then builds the missing one in its style, through every check", () => {
    const state = cloneThem();

    // before any batch has counted the frames, the flow is copied as approved: the first output alone
    const first = imageToUiStep(state, null, []);
    expect(first.recreate).toBe(true);
    expect(keysOf(nextProductBatch(first.manifest, [], 1, [], true))).toEqual(["screen:library"]);

    // the first batch counted three frames: the frames the image has are copied next
    const afterFirst = ready(["screen:library"], "batch-1");
    const second = imageToUiStep(state, 3, afterFirst);
    expect(second.recreate).toBe(true);
    const secondBatch = keysOf(nextProductBatch(second.manifest, afterFirst, 8, [], true));
    expect(secondBatch).toEqual(["screen:editor", "screen:insights"]);
    const secondRun = runChecks(second.state, secondBatch, 3);
    expect(secondRun.recreate).toBe(true);
    expect(secondRun.screens.map((screen) => screen.referenceScreenIndex)).toEqual([2, 3]);

    // then the output with no frame is built in the image's style, as a state of its screen
    const afterSecond = [...afterFirst, ...ready(secondBatch, "batch-2")];
    const third = imageToUiStep(state, 3, afterSecond);
    expect(third.recreate).toBe(false);
    const thirdBatch = nextProductBatch(third.manifest, afterSecond, 8, [], false);
    expect(keysOf(thirdBatch)).toEqual(["state:editor:resolution-settings"]);
    const thirdRun = runChecks(third.state, keysOf(thirdBatch), 3);
    expect(thirdRun.recreate).toBe(false);
    // the run binds it to its screen with the state to draw, and plans it as a style build
    expect(thirdRun.screens.map((screen) => screen.name)).toEqual(["New Project (Editor)"]);
    expect(thirdRun.screens[0].referenceScreenIndex).toBeNull();
    expect(thirdRun.screens[0].stateVariants.map((variant) => variant.stateKey)).toEqual(["resolution-settings"]);
    expect(functionalStateVariant(thirdBatch[0]).editInstruction).toContain("Resolution, Frame rate and Color");
    expect(thirdRun.prompt).not.toContain("Recreate only these supplied frames");
    expect(thirdRun.contract.referenceMode).toBe("user_style");

    // and once everything is built there is nothing left to pick
    const done = [...afterSecond, ...ready(keysOf(thirdBatch), "batch-3")];
    expect(nextProductBatch(imageToUiStep(state, 3, done).manifest, done, 8, [], false)).toEqual([]);
  });

  it("designs every step in the image's style when the image has only the first frame", () => {
    // the account-opening case: one carpooling screenshot and a four-step bank flow
    const state = approvedCopy(["Phone Number Entry", "OTP Verification", "ID Document Upload", "Success Confirmation"]
      .map((name, index) => frame(`screen:step-${index + 1}`, name, index + 1)));
    const afterFirst = ready(["screen:step-1"], "batch-1");
    const next = imageToUiStep(state, 1, afterFirst);
    expect(next.recreate).toBe(false);
    const batch = keysOf(nextProductBatch(next.manifest, afterFirst, 8, [], false));
    expect(batch).toEqual(["screen:step-2", "screen:step-3", "screen:step-4"]);
    const run = runChecks(next.state, batch, 1);
    expect(run.screens.map((screen) => [screen.name, screen.referenceScreenIndex])).toEqual([
      ["OTP Verification", null], ["ID Document Upload", null], ["Success Confirmation", null],
    ]);
  });

  it("copies a flow whose image has every frame exactly as approved", () => {
    const state = cloneThem();
    const afterFirst = ready(["screen:library"], "batch-1");
    const step = imageToUiStep(state, 4, afterFirst);
    expect(step).toEqual({ recreate: true, state, manifest: state.scope!.manifest });
    const batch = keysOf(nextProductBatch(step.manifest, afterFirst, 8, [], true));
    expect(runChecks(step.state, batch, 4).screens.map((screen) => screen.referenceScreenIndex)).toEqual([2, 3, 4]);
  });

  it("leaves the approved plan itself untouched", () => {
    const state = cloneThem();
    const before = JSON.stringify(state);
    imageToUiStep(state, 3, ready(["screen:library", "screen:editor", "screen:insights"], "b"));
    expect(JSON.stringify(state)).toBe(before);
  });
});
