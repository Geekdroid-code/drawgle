"use client";
import { useState } from "react";
import { ArrowRight, Palette, Ruler, Shapes, Type } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { getFontRecommendations, normalizeDesignTokens } from "@/lib/design-tokens";
import type { DesignTokens } from "@/lib/types";
import { SegmentedControl } from "@/components/inspector/SegmentedControl";
import { ColorSection } from "@/components/design-system/ColorSection";
import { TypeSection } from "@/components/design-system/TypeSection";
import { SpacingSection } from "@/components/design-system/SpacingSection";
import { ShapeSection } from "@/components/design-system/ShapeSection";
import { PhonePreview } from "@/components/design-system/PhonePreview";
import { previewProps, updateToken } from "@/components/design-system/model";
import "@/components/inspector/inspector.css";
import "@/components/design-system/design-system.css";
export { ColorPicker as ColorPickerButton } from "@/components/inspector/ColorPicker";
type Tab = "colors" | "type" | "spacing" | "shape";
const TABS = [{ value: "colors" as const, label: <><Palette size={13} />Color</> }, { value: "type" as const, label: <><Type size={13} />Type</> },
  { value: "spacing" as const, label: <><Ruler size={13} />Space</> }, { value: "shape" as const, label: <><Shapes size={13} />Shape</> }];

export function DesignSystemEditor({ value, onChange, onSubmit, title = "Design system", description = "Tune the visual system before building.",
  submitLabel = "Continue", isSubmitting = false, submitStatus, layout = "full", showPreview = true, disabled = false }: {
  value: DesignTokens; onChange: (tokens: DesignTokens) => void; onSubmit: () => void | Promise<void>;
  title?: string; description?: string; submitLabel?: string; isSubmitting?: boolean; submitStatus?: string;
  layout?: "full" | "panel"; showPreview?: boolean; disabled?: boolean;
}) {
  const [tab, setTab] = useState<Tab>("colors"); const reduced = useReducedMotion();
  const normalized = normalizeDesignTokens(value), panel = layout === "panel", locked = disabled || isSubmitting;
  if (!normalized.tokens) return null;
  const tokens = normalized.tokens;
  const update = (path: string[], next: string) => { if (!locked) onChange(updateToken(value, path, next)); };
  const content = <>
    <div className="dt-toolbar"><div className="dt-intro"><h2>{panel ? "Project styles" : title}</h2><span><i className="dt-live-dot" />{locked ? "Editing paused" : "Live preview"}</span></div>
      <SegmentedControl label="Design token categories" value={tab} options={TABS.map(item => ({ ...item, title: item.value === "spacing" ? "Spacing" : item.value === "colors" ? "Colors" : item.value === "type" ? "Type" : "Shape" }))} onChange={setTab} />
    </div>
    <div className="dt-body"><fieldset disabled={locked}>
      <motion.div key={tab} initial={reduced ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduced ? 0 : .16 }}>
        {tab === "colors" && <ColorSection tokens={tokens} update={update} disabled={locked} />}
        {tab === "type" && <TypeSection tokens={tokens} recommendations={getFontRecommendations(normalized)} update={update} />}
        {tab === "spacing" && <SpacingSection tokens={tokens} update={update} />}
        {tab === "shape" && <ShapeSection tokens={tokens} update={update} />}
      </motion.div>
    </fieldset></div>
  </>;
  if (panel) return <div className="dt-editor">{content}</div>;
  return <div className="dt-editor dt-full-editor"><header className="dt-full-header"><div><h2 className="text-lg font-semibold">{title}</h2><p className="mt-1 text-xs text-[var(--dg-text-muted)]">{description}</p></div></header>
    <div className={showPreview ? "dt-full-layout" : "flex flex-1 min-h-0"}><div className="dt-editor">{content}</div>
      {showPreview && <div className="dt-full-preview"><PhonePreview {...previewProps(tokens)} /></div>}</div>
    <footer className="dt-save-footer flex justify-end"><button type="button" className="dt-save flex items-center gap-2" disabled={locked} onClick={() => void onSubmit()}>{isSubmitting && submitStatus ? submitStatus : submitLabel}<ArrowRight size={14} /></button></footer>
  </div>;
}
