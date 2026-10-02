import type { SelectedElementInfo } from "@/components/ScreenNode";
export const selectionFixture = (tag = "div", computed: Record<string, string> = {}): SelectedElementInfo => ({
  screenId: "screen", drawgleId: "card", outerHTML: `<${tag} data-drawgle-id="card">Search Radius</${tag}>`, targetType: "screen",
  boundingRect: null, screenRect: null, textPreview: "Search Radius", breadcrumb: "main > div",
  editableMetadata: { tagName: tag, textNodes: [{ drawgleId: "label", tagName: "span", text: "Search Radius" }], imageTargets: [], style: {},
    styleInspection: { tagName: tag, classList: [], inlineStyle: {}, computedStyle: computed },
  },
});
