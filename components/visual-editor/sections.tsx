"use client";
import { AlignLeft, AlignCenter, AlignRight, ArrowRight, ArrowDown } from "lucide-react";
import type { SelectedElementInfo } from "@/components/ScreenNode";
import type { DrawgleStyleProperty, DrawgleTokenReferenceLike } from "@/lib/element-style-inspection";
import { validateStyleValue } from "@/lib/element-style-inspection";
import { classifySelection } from "@/lib/visual-editor/selection";
import { Section, TokenField, Segments, Choices, ColorControl, PaddingControl, inputClass } from "./controls";
import type { EditorController } from "./use-editor-draft";
import { AlignmentControl } from "./AlignmentControl";

const shadowValues = { None: "none", Soft: "0px 2px 8px rgba(0,0,0,0.08)", Raised: "0px 8px 24px rgba(0,0,0,0.14)" };
export function EditorSections({ info, editor, tokens, more }: { info: SelectedElementInfo; editor: EditorController; tokens: DrawgleTokenReferenceLike[]; more: boolean }) {
  const selection = classifySelection(info);
  const raw = info.editableMetadata?.styleInspection;
  const computed = { ...raw?.computedStyle, ...raw?.stableComputedStyle };
  const value = (property: DrawgleStyleProperty) => editor.draft.styles[property] ?? (raw?.inlineStyle?.[property] || computed[property] || "");
  const set = (property: DrawgleStyleProperty) => (next: string) => editor.styles({ [property]: next });
  const numeric = (property: DrawgleStyleProperty, label: string) => <TokenField property={property} tokens={tokens} label={label} value={value(property)} numeric unit={property === "line-height" ? "" : "px"} error={editor.errors[property]} onChange={set(property)} />;
  const color = (property: DrawgleStyleProperty, label: string) => <ColorControl label={label} property={property} value={value(property)} tokens={tokens} error={editor.errors[property]}
    gradient={property === "background-color" && !!value("background-image") && value("background-image") !== "none"}
    onChange={next => {
      let solid = false;
      try { solid = !!validateStyleValue(property, next); } catch { /* Keep the existing gradient while an incomplete color is being typed. */ }
      editor.styles(property === "background-color" && solid ? { "background-color": next, "background-image": "none" } : { [property]: next });
    }} />;
  const padding = <PaddingControl errors={editor.errors} values={["padding-top", "padding-right", "padding-bottom", "padding-left"].map(property => value(property as DrawgleStyleProperty))} onChange={values => editor.styles(values, "padding")} />;
  const shadow = <Choices label="Shadow" value={Object.entries(shadowValues).find(([, css]) => css === value("box-shadow"))?.[0] ?? value("box-shadow")} choices={Object.keys(shadowValues)}
    onChange={next => set("box-shadow")(shadowValues[next as keyof typeof shadowValues])} />;
  const border = <Section title="Border">{color("border-color", "Border color")}<div className="mt-2 grid grid-cols-2 gap-2">
    {numeric("border-width", "Thickness")}<Choices label="Border style" value={value("border-style")} choices={["none", "solid", "dashed", "dotted"]} onChange={set("border-style")} /></div></Section>;
  const textNodes = info.editableMetadata?.textNodes ?? [];
  const textContent = textNodes.length === 1 ? <textarea aria-label={selection.kind === "button" ? "Button label" : "Text content"} rows={2} className={`${inputClass} !h-auto resize-none py-2`}
    value={editor.draft.text[textNodes[0].drawgleId] ?? textNodes[0].text} onChange={event => editor.text(textNodes[0].drawgleId, event.target.value)} /> :
    <div className="space-y-2"><p className="text-xs text-[var(--dg-text-muted)]">Select a text child to edit its wording.</p>{textNodes.slice(0, 4).map(node => <button key={node.drawgleId} type="button" className={`${inputClass} truncate text-left`}
      onClick={() => window.dispatchEvent(new CustomEvent("drawgle-select-child", { detail: { screenId: info.screenId, drawgleId: node.drawgleId } }))}>{node.text}</button>)}</div>;
  if (more) {
    if (selection.kind === "text") return <Section title="Typography"><div className="grid grid-cols-2 gap-2">{numeric("line-height", "Line spacing")}{numeric("letter-spacing", "Letter spacing")}</div></Section>;
    if (selection.kind === "group") return <>{selection.flex && <Section title="Layout"><Choices label="Wrap" value={value("flex-wrap")} choices={["nowrap", "wrap"]} onChange={set("flex-wrap")} /></Section>}<Section title="Spacing">{padding}</Section></>;
    return <>{border}{selection.kind === "button" && <Section title="Shadow">{shadow}</Section>}
      {selection.kind === "image" && <Section title="Shape"><Choices label="Aspect ratio" value={value("aspect-ratio")} choices={["auto", "1 / 1", "4 / 3", "3 / 4", "16 / 9"]}
        onChange={next => editor.styles(next === "auto" ? { "aspect-ratio": next } : { "aspect-ratio": next, height: "auto", "min-height": "0px", "max-height": "none" })} /></Section>}
      {selection.kind === "container" && <Section title="Width"><Choices label="Width mode" value={value("width")} choices={["auto", "100%"]} labels={{ auto: "Auto", "100%": "Fill" }} onChange={set("width")} />
        <div className="mt-2">{numeric("width", "Custom width")}</div></Section>}</>;
  }
  if (selection.kind === "text") return <><Section title="Content">{textContent}</Section><Section title="Typography"><div className="grid grid-cols-2 gap-2">
    {numeric("font-size", "Size")}<Choices label="Weight" value={value("font-weight")} choices={["400", "500", "600", "700", "800"]} onChange={set("font-weight")} /></div></Section>
    <Section title="Color">{color("color", "Text color")}</Section><Section title="Alignment"><Segments label="Text alignment" value={value("text-align")}
      options={[{ value: "left", label: <AlignLeft size={16} />, title: "Align left" }, { value: "center", label: <AlignCenter size={16} />, title: "Align center" }, { value: "right", label: <AlignRight size={16} />, title: "Align right" }]} onChange={set("text-align")} /></Section></>;
  if (selection.kind === "image") return <><Section title="Image">{selection.image && <div className="flex items-center gap-3">
    {/* Uploaded blob URLs and arbitrary user image hosts must be previewed directly. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img alt={selection.image.alt ?? "Selected image"} src={editor.draft.image?.previewUrl ?? selection.image.src} className="h-16 w-16 rounded-xl object-cover" />
    <label className="ve-input flex flex-1 cursor-pointer items-center justify-center text-center">Replace image<input aria-label="Replace image" type="file" accept="image/*" className="sr-only" onChange={event => { const file = event.target.files?.[0]; if (file && selection.image) editor.image(selection.image, file); event.target.value = ""; }} /></label></div>}</Section>
    {selection.image?.kind !== "visual_placeholder" && <Section title="Fit"><Segments label="Image fit" value={selection.image?.kind === "background" ? value("background-size") : value("object-fit")} options={[{ value: "cover", label: "Cover" }, { value: "contain", label: "Contain" }]}
      onChange={set(selection.image?.kind === "background" ? "background-size" : "object-fit")} /></Section>}<Section title="Corners">{numeric("border-radius", "Radius")}</Section></>;
  if (selection.kind === "group") return <><Section title="Container">{selection.flex ? <Segments label="Direction" value={value("flex-direction")} options={[{ value: "row", label: <ArrowRight size={16} />, title: "Horizontal" }, { value: "column", label: <ArrowDown size={16} />, title: "Vertical" }]} onChange={set("flex-direction")} /> : <p className="text-xs text-[var(--dg-text-muted)]">{selection.grid ? "Grid layout" : "Block layout"}</p>}</Section>
    <Section title="Spacing">{numeric("gap", "Gap")}</Section><Section title="Alignment"><AlignmentControl direction={selection.flex ? value("flex-direction") : "row"} justify={value("justify-content")} align={value("align-items")} onChange={next => editor.styles(next, "alignment")} /></Section></>;
  return <>{selection.kind === "button" && <Section title="Label">{textContent}</Section>}<Section title="Fill">{color("background-color", "Fill")}</Section>
    {selection.kind === "button" ? <><Section title="Text color">{color("color", "Text color")}</Section><Section title="Size"><Choices label="Button size" value={[
      ["Small", "8px", "12px", "32px"], ["Medium", "12px", "16px", "40px"], ["Large", "16px", "24px", "48px"],
    ].find(([, vertical, horizontal, height]) => value("padding-top") === vertical && value("padding-bottom") === vertical && value("padding-right") === horizontal && value("padding-left") === horizontal && value("min-height") === height)?.[0] ?? "Custom"} choices={["Small", "Medium", "Large"]}
      onChange={next => { const [vertical, horizontal, height] = { Small: ["8px", "12px", "32px"], Medium: ["12px", "16px", "40px"], Large: ["16px", "24px", "48px"] }[next] ?? [];
        editor.styles({ "padding-top": vertical, "padding-bottom": vertical, "padding-left": horizontal, "padding-right": horizontal, "min-height": height }, "button-size"); }} /></Section></> : <Section title="Spacing">{padding}</Section>}
    <Section title="Corners">{numeric("border-radius", "Radius")}</Section>{selection.kind === "container" && <Section title="Shadow">{shadow}</Section>}</>;
}
