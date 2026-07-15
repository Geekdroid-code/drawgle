import { describe, expect, it } from "vitest";

import { ensureCraftTokenCoverage } from "@/lib/generation/craft-token-coverage";
import type { ProjectCraftBlueprint } from "@/lib/types";

const blueprint = (requiredTokenRoles: string[]): ProjectCraftBlueprint => ({
  version: 1,
  compositionIntent: "Connected stage",
  layerStrategy: "Base and foreground",
  geometryIntent: "Distinct roles",
  lightingIntent: "Localized",
  elevationIntent: "Selective",
  borderIntent: "Hairline",
  dataVisualizationIntent: "Visible",
  navigationIntent: "Quiet",
  signatureConstructions: ["A connected stage"],
  layoutPrinciples: ["One focal region"],
  preferredCraftIds: ["hero-connected-sheet"],
  preferredCraftTags: ["connected"],
  requiredTokenRoles,
  avoid: ["Generic cards"],
});

describe("craft token coverage", () => {
  it("fills only required missing roles from the core system", () => {
    const tokens = ensureCraftTokenCoverage({
      tokens: {
        color: { surface: { card: "#F7F4EF" } },
        radii: { app: "18px", pill: "9999px" },
        border_widths: { standard: "1px" },
        shadows: { surface: "none", overlay: "0 10px 30px rgba(0,0,0,.14)" },
      },
    }, blueprint(["radii.sheet", "shadows.floating", "effects.surface_blur"]));

    expect(tokens.tokens?.radii?.sheet).toBe("18px");
    expect(tokens.tokens?.shadows?.floating).toBe("0 10px 30px rgba(0,0,0,.14)");
    expect(tokens.tokens?.effects?.surface_blur).toBe("blur(18px)");
    expect(tokens.tokens?.radii?.featured).toBeUndefined();
    expect(tokens.tokens?.effects?.overlay_blur).toBeUndefined();
  });

  it("never materializes unknown model-authored roles", () => {
    const tokens = ensureCraftTokenCoverage({ tokens: {} }, blueprint(["radii.magic", "shadows.card"]));
    expect(tokens).toEqual({ tokens: {} });
  });
});
