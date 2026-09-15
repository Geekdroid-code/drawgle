import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const generate = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ai/gemini", () => ({ createGeminiClient: () => ({ models: { generateContent: generate } }) }));
import { applyDesignEdits, reconcileTokensWithDesignRequirements, reconcileScreenBriefsWithDesignRequirements } from "./reconcile-design";
import { applyProductPatch } from "./model";
import { productFixture } from "./test-fixtures";
import { compileProductContent } from "./content-contract";

const stateWith = (detail: string) => applyProductPatch(productFixture(), { operations: [{ op: "put_fact", fact: {
  id: "req", section: "preferences", label: "Direction", detail, evidence: detail, source: "user",
} }] }, "11111111-1111-4111-8111-111111111111");
const tokens = { tokens: { color: { background: { screen: "#FFFFFF" }, action: { primary: "#000000" } }, radii: { app: "16px" } } };
beforeEach(() => generate.mockReset().mockResolvedValue({ text: '{"edits":[]}' }));
it.each(["No dark mode; keep the white background", "Show ice cream photographs on white cards", "Pill buttons only; keep cards square"])("does not apply keyword substitutions: %s", async text => {
  expect(await reconcileTokensWithDesignRequirements(tokens, stateWith(text))).toEqual(tokens);
  expect(JSON.stringify(generate.mock.calls[0][0].contents)).toContain(text);
});
it("applies only the cited semantic correction, preserving other values and the input", async () => {
  generate.mockResolvedValue({ text: JSON.stringify({ edits: [{ factId: "req", path: ["tokens", "color", "action", "primary"], before: "#000000", after: "#10B981", reason: "Explicit primary" }] }) });
  const result = await reconcileTokensWithDesignRequirements(tokens, stateWith("Background #FFFFFF and primary #10B981"));
  expect(result.tokens?.color?.action?.primary).toBe("#10B981");
  expect(result.tokens?.color?.background?.screen).toBe("#FFFFFF");
  expect(result.tokens?.radii).toEqual(tokens.tokens.radii);
  expect(tokens.tokens.color.action.primary).toBe("#000000");
});
it("corrects a unique passage without replacing a rich brief", async () => {
  generate.mockResolvedValue({ text: JSON.stringify({ edits: [{ factId: "req", path: ["0", "description"], before: "gradient fill", after: "solid fill", reason: "User excludes gradients" }] }) });
  const screens = [{ name: "Overview", type: "root" as const, description: "Large editorial header; gradient fill on action; quiet list rows with restrained imagery." }];
  const result = await reconcileScreenBriefsWithDesignRequirements(screens, stateWith("No gradients"));
  expect(result[0].description).toBe(screens[0].description.replace("gradient fill", "solid fill"));
  expect(result[0].name).toBe("Overview");
});
it("skips every semantic rewrite for recreation and carries source copy rules", async () => {
  const state = stateWith("Cream background, no gradients"); state.input.imagePath = "owner/source.webp"; state.input.imageReferenceMode = "recreate";
  const screens = [{ name: "Source", type: "root" as const, description: "Visible gradient background" }];
  expect(await reconcileTokensWithDesignRequirements(tokens, state)).toBe(tokens);
  expect(await reconcileScreenBriefsWithDesignRequirements(screens, state)).toBe(screens);
  expect(generate).not.toHaveBeenCalled();
  expect(compileProductContent(state)).not.toContain("Cream");
});
it("keeps design requirements in the independent builder/state/retry contract", () => {
  expect(compileProductContent(stateWith("Use serif headings and compact rows"))).toContain("Use serif headings and compact rows");
});
it.each([
  { factId: "invented", path: ["tokens", "radii", "app"], before: "16px", after: "0px" },
  { factId: "req", path: ["tokens", "__proto__", "x"], before: "16px", after: "0px" },
  { factId: "req", path: ["tokens", "radii", "app"], before: "12px", after: "0px" },
])("rejects unsafe or stale patches atomically", edit => {
  expect(() => applyDesignEdits(tokens, { edits: [{ ...edit, reason: "test" }] }, ["req"], "tokens")).toThrow();
  expect(tokens.tokens.radii.app).toBe("16px");
});
it("bounds invalid reviewer responses without accepting a partial redesign", async () => {
  generate.mockResolvedValue({ text: '{"tokens":{}}' });
  await expect(reconcileTokensWithDesignRequirements(tokens, stateWith("No gradients"))).rejects.toThrow(/invalid corrections/);
  expect(generate).toHaveBeenCalledTimes(2);
});
