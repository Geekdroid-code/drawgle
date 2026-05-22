import * as cheerio from "cheerio";
import { buildTranspileTree, transpileToSwiftUI, transpileToCompose, transpileToReactNative, transpileToFlutter } from "../lib/mobile-transpiler";
import type { DesignTokens } from "../lib/types";

// Custom DOM parser using cheerio to generate mock DOM elements compatible with browser native Element / HTMLElement
function cheerioToMockDom(htmlString: string): any {
  const $ = cheerio.load(htmlString);
  const rootElement = $("body").children().first()[0];

  function walk(node: any): any {
    if (!node) return null;

    if (node.type === "text") {
      return {
        nodeType: 3,
        textContent: node.data || "",
        childNodes: []
      };
    }

    if (node.type === "tag") {
      const tagName = node.tagName;
      const classList = $(node).attr("class")?.split(/\s+/).filter(Boolean) || [];
      const id = $(node).attr("id") || "";
      const styleText = $(node).attr("style") || "";

      const attributesList = Object.entries(node.attribs || {}).map(([name, value]) => ({
        name,
        value
      }));

      const childNodes: any[] = [];
      (node.children || []).forEach((c: any) => {
        const parsed = walk(c);
        if (parsed) childNodes.push(parsed);
      });

      const mockElement = {
        nodeType: 1,
        tagName: tagName.toUpperCase(),
        classList,
        id,
        getAttribute(name: string) {
          return $(node).attr(name) || null;
        },
        attributes: attributesList,
        childNodes
      };

      return mockElement;
    }

    return null;
  }

  return walk(rootElement);
}

const mockHtml = `
<div class="flex flex-col items-center justify-between p-6 bg-slate-100 rounded-lg w-full gap-4">
  <h1 class="text-2xl font-bold text-gray-900">Welcome Screen</h1>
  <p class="text-sm text-gray-500 text-center">Design and export high fidelity layouts</p>
  <button class="w-full py-3 px-6 bg-blue-500 text-white rounded-xl font-semibold flex items-center justify-center gap-2">
    <span data-lucide="arrow-left" class="text-white text-xs"></span>
    Get Started
  </button>
</div>
`;

const mockTokens: DesignTokens = {
  colors: {
    "background-primary": { value: "#FFFFFF", category: "colors", name: "background-primary" },
    "background-secondary": { value: "#F3F4F6", category: "colors", name: "background-secondary" },
    "surface-card": { value: "#FFFFFF", category: "colors", name: "surface-card" },
    "action-primary": { value: "#3B82F6", category: "colors", name: "action-primary" },
    "action-on-primary-text": { value: "#FFFFFF", category: "colors", name: "action-on-primary-text" },
    "text-high-emphasis": { value: "#111827", category: "colors", name: "text-high-emphasis" },
    "text-medium-emphasis": { value: "#4B5563", category: "colors", name: "text-medium-emphasis" },
    "text-low-emphasis": { value: "#9CA3AF", category: "colors", name: "text-low-emphasis" },
    "border-divider": { value: "#E5E7EB", category: "colors", name: "border-divider" },
  },
  typography: {
    "font-family": { value: "Inter", category: "typography", name: "font-family" }
  },
  spacing: {
    "md": { value: "16px", category: "spacing", name: "md" }
  },
  radii: {
    "app": { value: "18px", category: "radii", name: "app" },
    "pill": { value: "9999px", category: "radii", name: "pill" }
  },
  "mobile-layout": {
    "screen-margin": { value: "24px", category: "mobile-layout", name: "screen-margin" },
    "section-gap": { value: "24px", category: "mobile-layout", name: "section-gap" },
    "element-gap": { value: "16px", category: "mobile-layout", name: "element-gap" }
  }
};

function runTest() {
  console.log("Starting Mobile Native Transpiler AST compilation checks with Cheerio DOM mock...");
  const mockDom = cheerioToMockDom(mockHtml);

  const varMap = new Map<string, string>();
  varMap.set("--dg-color-background-primary", "#FFFFFF");
  varMap.set("--dg-color-background-secondary", "#F3F4F6");
  varMap.set("--dg-color-surface-card", "#FFFFFF");
  varMap.set("--dg-color-action-primary", "#3B82F6");
  varMap.set("--dg-color-action-on-primary-text", "#FFFFFF");
  varMap.set("--dg-color-text-high-emphasis", "#111827");
  varMap.set("--dg-color-text-medium-emphasis", "#4B5563");
  varMap.set("--dg-color-text-low-emphasis", "#9CA3AF");
  varMap.set("--dg-color-border-divider", "#E5E7EB");
  varMap.set("--dg-radii-app", "18px");
  varMap.set("--dg-radii-pill", "9999px");

  const ast = buildTranspileTree(mockDom, varMap);
  
  if (!ast) {
    console.error("FAIL: AST is null");
    process.exit(1);
  }
  console.log("PASS: AST parsed successfully");

  const swift = transpileToSwiftUI(ast);
  console.log("\n--- SwiftUI Output ---");
  console.log(swift);

  const compose = transpileToCompose(ast);
  console.log("\n--- Jetpack Compose Output ---");
  console.log(compose);

  const rn = transpileToReactNative(ast);
  console.log("\n--- React Native Output ---");
  console.log(rn);

  const flutter = transpileToFlutter(ast);
  console.log("\n--- Flutter Output ---");
  console.log(flutter);

  console.log("\nPASS: All target codebases transpiled cleanly without exceptions!");
}

runTest();
