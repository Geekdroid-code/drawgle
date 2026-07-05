import { describe, expect, it } from "vitest";

import {
  getClassUtilityForStyle,
  resolveStyleInspection,
  validateStyleValue,
  type DrawgleRawStyleInspection,
  type DrawgleTokenReferenceLike,
} from "@/lib/element-style-inspection";

const tokenRefs: DrawgleTokenReferenceLike[] = [
  {
    name: "--dg-color-action-primary",
    path: "color.action.primary",
    label: "Action / Primary",
    value: "#5EE1A2",
  },
  {
    name: "--dg-radii-app",
    path: "radii.app",
    label: "App radius",
    value: "22px",
  },
  {
    name: "--dg-gradients-action-primary",
    path: "gradients.action_primary",
    label: "Gradients / Action Primary",
    value: "linear-gradient(135deg, #5EE1A2 0%, #2563EB 100%)",
  },
];

describe("element style inspection", () => {
  it("resolves class, inline token, and computed style sources for V2 properties", () => {
    const rawInspection: DrawgleRawStyleInspection = {
      tagName: "button",
      classList: ["flex", "justify-center", "bg-[var(--dg-color-action-primary)]", "[background-image:var(--dg-gradients-action-primary)]"],
      inlineStyle: {
        "border-radius": "var(--dg-radii-app)",
      },
      computedStyle: {
        display: "flex",
        "justify-content": "center",
        "background-color": "#5EE1A2",
        "background-image": "linear-gradient(135deg, rgb(94, 225, 162) 0%, rgb(37, 99, 235) 100%)",
        "border-radius": "22px",
        overflow: "auto",
        position: "relative",
      },
    };

    const resolved = resolveStyleInspection(rawInspection, tokenRefs);
    const display = resolved?.properties.find((property) => property.property === "display");
    const justify = resolved?.properties.find((property) => property.property === "justify-content");
    const fill = resolved?.properties.find((property) => property.property === "background-color");
    const radius = resolved?.properties.find((property) => property.property === "border-radius");
    const gradient = resolved?.properties.find((property) => property.property === "background-image");

    expect(display?.source).toBe("class");
    expect(display?.classBinding).toBe("flex");
    expect(justify?.classBinding).toBe("justify-center");
    expect(fill?.tokenName).toBe("--dg-color-action-primary");
    expect(fill?.status).toBe("linked");
    expect(radius?.source).toBe("inline-token");
    expect(radius?.tokenName).toBe("--dg-radii-app");
    expect(gradient?.source).toBe("token");
    expect(gradient?.tokenName).toBe("--dg-gradients-action-primary");
  });

  it("validates curated CSS values and maps safe values to class utilities", () => {
    expect(validateStyleValue("position", "absolute")).toBe("absolute");
    expect(validateStyleValue("filter", "blur(12px)")).toBe("blur(12px)");
    expect(validateStyleValue("background-image", "var(--dg-gradients-action-primary)")).toBe("var(--dg-gradients-action-primary)");
    expect(() => validateStyleValue("position", "url(javascript:alert(1))")).toThrow("Unsupported position value");

    expect(getClassUtilityForStyle("justify-content", "space-between")).toEqual({
      family: "justify-content",
      className: "justify-between",
    });
    expect(getClassUtilityForStyle("transform", "translateX(10px)")).toEqual({
      family: "transform",
      className: "[transform:translateX(10px)]",
    });
  });
});
