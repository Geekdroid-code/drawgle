import type { SelectedElementInfo } from "@/components/ScreenNode";
import type { DrawgleStyleProperty } from "@/lib/element-style-inspection";

export type SelectionKind = "text" | "button" | "image" | "container" | "group";
export function selectionKey(info: SelectedElementInfo | null) {
  return info ? `${info.screenId}:${info.targetType}:${info.drawgleId}` : "";
}
export function classifySelection(info: SelectedElementInfo) {
  const metadata = info.editableMetadata;
  const tag = metadata?.tagName ?? "div";
  const styles = { ...metadata?.styleInspection?.computedStyle, ...metadata?.styleInspection?.stableComputedStyle };
  const opening = info.outerHTML.slice(0, info.outerHTML.indexOf(">") + 1);
  const button = tag === "button" || /role=["']button["']/.test(opening) ||
    (tag === "a" && /\b(?:btn|button)\b/i.test(opening));
  const ownImage = metadata?.imageTargets?.find(target => target.drawgleId === info.drawgleId && target.kind !== "inline_svg");
  let kind: SelectionKind = "container";
  if (tag === "img" || ownImage) kind = "image";
  else if (button) kind = "button";
  else if (/^(h[1-6]|p|span|label|small|strong|em|a)$/.test(tag) && (metadata?.textNodes?.length ?? 0) > 0) kind = "text";
  else if (/flex|grid/.test(styles.display ?? "")) {
    const surface = styles["background-image"] && styles["background-image"] !== "none" ||
      styles["background-color"] && !/^(transparent|rgba\(0,\s*0,\s*0,\s*0\))$/.test(styles["background-color"]) ||
      parseFloat(styles["border-radius"] ?? "0") > 0 || styles["box-shadow"] && styles["box-shadow"] !== "none";
    if (!surface) kind = "group";
  }
  return { kind, label: { text: "Text", button: "Button", image: "Image", container: "Card", group: "Group" }[kind],
    image: ownImage, grid: /grid/.test(styles.display ?? ""), flex: /flex/.test(styles.display ?? "") };
}

export const visibleProperties: Record<SelectionKind, { main: DrawgleStyleProperty[]; more: DrawgleStyleProperty[] }> = {
  text: { main: ["font-size", "font-weight", "color", "text-align"], more: ["line-height", "letter-spacing"] },
  button: { main: ["background-color", "color", "padding-top", "padding-right", "padding-bottom", "padding-left", "min-height", "border-radius"], more: ["border-color", "border-width", "border-style", "box-shadow"] },
  image: { main: ["object-fit", "border-radius"], more: ["aspect-ratio", "border-color", "border-width", "border-style"] },
  container: { main: ["background-color", "padding-top", "padding-right", "padding-bottom", "padding-left", "border-radius", "box-shadow"], more: ["border-color", "border-width", "border-style", "width"] },
  group: { main: ["flex-direction", "gap", "justify-content", "align-items"], more: ["flex-wrap", "padding-top", "padding-right", "padding-bottom", "padding-left"] },
};
