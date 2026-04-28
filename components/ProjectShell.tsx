"use client";

import { type ComponentType, type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, BookOpen, Check, Layers, Loader2, Navigation, Palette, RotateCcw, Save, Sparkles, Type, X } from "lucide-react";

import { CanvasArea } from "@/components/CanvasArea";
import { ChatPanel } from "@/components/ChatPanel";
import { DesignSystemEditor } from "@/components/DesignSystemEditor";
import { PromptBar } from "@/components/PromptBar";
import type { SelectedElementInfo } from "@/components/ScreenNode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DeterministicEditOperation, DrawgleStyleProperty } from "@/lib/drawgle-dom";
import { useGenerationRuns } from "@/hooks/use-generation-runs";
import { useProject } from "@/hooks/use-project";
import { useProjectNavigation } from "@/hooks/use-project-navigation";
import { useScreens } from "@/hooks/use-screens";
import { hasApprovedDesignTokens, normalizeDesignTokens } from "@/lib/design-tokens";
import { createClient } from "@/lib/supabase/client";
import { deleteScreen, insertProjectMessage, updateProjectFields } from "@/lib/supabase/queries";
import { getDrawgleTokenReferences } from "@/lib/token-runtime";
import type {
  AuthenticatedUser,
  DesignTokens,
  GenerationRunData,
  NavigationArchitecture,
  NavigationPlan,
  ProjectData,
  ProjectNavigationData,
  PromptImagePayload,
  ScreenPlan,
  ScreenData,
} from "@/lib/types";

const TERMINAL_GENERATION_STATUSES = new Set<GenerationRunData["status"]>([
  "completed",
  "failed",
  "canceled",
]);

class QueueGenerationError extends Error {
  status: number;
  activeGenerationRunId: string | null;

  constructor(message: string, status: number, activeGenerationRunId?: string | null) {
    super(message);
    this.name = "QueueGenerationError";
    this.status = status;
    this.activeGenerationRunId = activeGenerationRunId ?? null;
  }
}

type ManualEditMode = "actions" | "text" | "design" | "ai";

type ProjectPanelTab = "design" | "charter" | "screens" | "navigation";

const PROJECT_PANEL_TABS: Array<{ id: ProjectPanelTab; label: string; icon: ComponentType<{ className?: string }> }> = [
  { id: "design", label: "Design System", icon: Palette },
  { id: "charter", label: "Charter", icon: BookOpen },
  { id: "screens", label: "Screen Plan", icon: Layers },
  { id: "navigation", label: "Navigation", icon: Navigation },
];

const isScreenPlanLike = (value: unknown): value is ScreenPlan => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<ScreenPlan>;
  return typeof candidate.name === "string" && typeof candidate.description === "string";
};

const getLatestPlannedScreens = (generationRuns: GenerationRunData[]) => {
  for (const run of generationRuns) {
    const plannedScreens = run.metadata?.plannedScreens as unknown;
    if (Array.isArray(plannedScreens) && plannedScreens.every(isScreenPlanLike)) {
      return plannedScreens as ScreenPlan[];
    }
  }

  return [] as ScreenPlan[];
};

type StyleControl = {
  property: DrawgleStyleProperty;
  label: string;
  type: "color" | "text";
  group: "Surface" | "Type" | "Layout";
};

const TEXT_STYLE_CONTROLS: StyleControl[] = [
  { property: "color", label: "Text", type: "color", group: "Type" },
  { property: "font-size", label: "Size", type: "text", group: "Type" },
  { property: "font-weight", label: "Weight", type: "text", group: "Type" },
  { property: "line-height", label: "Line height", type: "text", group: "Type" },
];

const SURFACE_STYLE_CONTROLS: StyleControl[] = [
  { property: "background-color", label: "Fill", type: "color", group: "Surface" },
  { property: "border-color", label: "Border", type: "color", group: "Surface" },
  { property: "border-width", label: "Border width", type: "text", group: "Surface" },
  { property: "border-radius", label: "Radius", type: "text", group: "Surface" },
  { property: "box-shadow", label: "Shadow", type: "text", group: "Surface" },
];

const LAYOUT_STYLE_CONTROLS: StyleControl[] = [
  { property: "padding-top", label: "Pad top", type: "text", group: "Layout" },
  { property: "padding-right", label: "Pad right", type: "text", group: "Layout" },
  { property: "padding-bottom", label: "Pad bottom", type: "text", group: "Layout" },
  { property: "padding-left", label: "Pad left", type: "text", group: "Layout" },
  { property: "gap", label: "Gap", type: "text", group: "Layout" },
];

const STYLE_META_KEY_BY_PROPERTY: Record<DrawgleStyleProperty, keyof NonNullable<SelectedElementInfo["editableMetadata"]>["style"]> = {
  "background-color": "backgroundColor",
  color: "color",
  "font-size": "fontSize",
  "font-weight": "fontWeight",
  "line-height": "lineHeight",
  "border-radius": "borderRadius",
  "padding-top": "paddingTop",
  "padding-right": "paddingRight",
  "padding-bottom": "paddingBottom",
  "padding-left": "paddingLeft",
  gap: "gap",
  "border-color": "borderColor",
  "border-width": "borderWidth",
  "box-shadow": "boxShadow",
};

const TEXTISH_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6", "p", "span", "label", "button", "a"]);
const EMPTY_TEXT_NODES: NonNullable<SelectedElementInfo["editableMetadata"]>["textNodes"] = [];

const normalizeCssValue = (value: string | undefined | null) => (value ?? "").trim();

const cssColorToHex = (value: string | undefined | null) => {
  const color = normalizeCssValue(value);
  if (/^#[0-9a-f]{6}$/i.test(color)) {
    return color;
  }

  const match = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!match) {
    return "#000000";
  }

  return `#${[match[1], match[2], match[3]]
    .map((part) => Math.max(0, Math.min(255, Number(part))).toString(16).padStart(2, "0"))
    .join("")}`;
};

type ElementEditSession = {
  screenId: string | null;
  element: SelectedElementInfo;
  mode: ManualEditMode;
};

function SelectedElementActionMenu({
  session,
  selectedScreen,
  disabled,
  onChooseMode,
  onClear,
}: {
  session: ElementEditSession;
  selectedScreen: ScreenData | null;
  disabled: boolean;
  onChooseMode: (mode: ManualEditMode) => void;
  onClear: () => void;
}) {
  const element = session.element;
  const rect = element.screenRect;
  const textNodes = element.editableMetadata?.textNodes ?? EMPTY_TEXT_NODES;
  const canManualEdit = Boolean(element.drawgleId);
  const canEditText = canManualEdit && textNodes.length > 0;
  const targetLabel = element.targetType === "navigation" ? "Navigation" : selectedScreen?.name ?? "Screen";
  const menuStyle: CSSProperties = rect
    ? { left: rect.right + 12, top: Math.max(88, rect.top + 72) }
    : { right: 24, top: 120 };

  return (
    <div
      className="fixed z-[75] w-56 rounded-[16px] border border-slate-950/[0.08] bg-white/96 p-2 shadow-[0_18px_60px_rgba(15,23,42,0.18)] backdrop-blur-xl"
      style={menuStyle}
    >
      <div className="mb-2 flex items-start justify-between gap-2 px-1">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#667894]">
            {targetLabel}
          </div>
          <div className="truncate text-xs font-medium text-slate-800">
            {element.textPreview || element.editableMetadata?.tagName || "Selected element"}
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 rounded-full text-slate-500" onClick={onClear}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="grid gap-1.5">
        <Button variant="ghost" className="h-9 justify-start rounded-[10px] gap-2" disabled={!canEditText || disabled} onClick={() => onChooseMode("text")}>
          <Type className="h-4 w-4" />
          Edit Text
        </Button>
        <Button variant="ghost" className="h-9 justify-start rounded-[10px] gap-2" disabled={!canManualEdit || disabled} onClick={() => onChooseMode("design")}>
          <Palette className="h-4 w-4" />
          Change Design
        </Button>
        <Button className="h-9 justify-start rounded-[10px] gap-2" disabled={disabled} onClick={() => onChooseMode("ai")}>
          <Sparkles className="h-4 w-4" />
          Edit With AI
        </Button>
      </div>
    </div>
  );
}

function SelectedElementInspectorSidebar({
  project,
  selectedScreen,
  selectedElementInfo,
  mode,
  disabled,
  onModeChange,
  onClose,
  onApplyOperations,
}: {
  project: ProjectData;
  selectedScreen: ScreenData | null;
  selectedElementInfo: SelectedElementInfo;
  mode: ManualEditMode;
  disabled: boolean;
  onModeChange: (mode: ManualEditMode) => void;
  onClose: () => void;
  onApplyOperations: (operations: DeterministicEditOperation[]) => Promise<boolean>;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const textNodes = selectedElementInfo.editableMetadata?.textNodes ?? EMPTY_TEXT_NODES;
  const tokenColorRefs = useMemo(
    () => getDrawgleTokenReferences(project.designTokens)
      .filter((reference) => reference.path.startsWith("color.") && (/^#[0-9a-f]{3,8}$/i.test(reference.value) || /^rgba?\(/i.test(reference.value)))
      .slice(0, 16),
    [project.designTokens],
  );
  const originalTextById = useMemo(
    () => Object.fromEntries(textNodes.map((node) => [node.drawgleId, node.text])),
    [textNodes],
  );
  const [textDrafts, setTextDrafts] = useState<Record<string, string>>(() => originalTextById);

  const styleControls = useMemo(() => {
    const tagName = selectedElementInfo.editableMetadata?.tagName ?? "";
    const hasText = textNodes.length > 0 || TEXTISH_TAGS.has(tagName);
    return [
      ...(hasText ? TEXT_STYLE_CONTROLS : []),
      ...SURFACE_STYLE_CONTROLS,
      ...LAYOUT_STYLE_CONTROLS,
    ];
  }, [selectedElementInfo.editableMetadata?.tagName, textNodes.length]);

  const originalStyleValues = useMemo(() => {
    const style = selectedElementInfo.editableMetadata?.style ?? {};
    return Object.fromEntries(
      styleControls.map((control) => [control.property, normalizeCssValue(style[STYLE_META_KEY_BY_PROPERTY[control.property]])]),
    ) as Record<DrawgleStyleProperty, string>;
  }, [selectedElementInfo.editableMetadata?.style, styleControls]);

  const [styleDrafts, setStyleDrafts] = useState<Record<string, string>>(() => originalStyleValues);

  const applyOperations = async (operations: DeterministicEditOperation[]) => {
    if (operations.length === 0) {
      return;
    }

    setIsSaving(true);
    const saved = await onApplyOperations(operations);
    setIsSaving(false);

    if (saved) {
      onClose();
    }
  };

  const saveText = async () => {
    const operations = textNodes
      .filter((node) => textDrafts[node.drawgleId] !== undefined && textDrafts[node.drawgleId] !== node.text)
      .map((node): DeterministicEditOperation => ({
        type: "replaceText",
        drawgleId: node.drawgleId,
        text: textDrafts[node.drawgleId] ?? "",
      }));

    await applyOperations(operations);
  };

  const saveDesign = async () => {
    const operations = styleControls
      .map((control): DeterministicEditOperation | null => {
        const currentValue = normalizeCssValue(originalStyleValues[control.property]);
        const nextValue = normalizeCssValue(styleDrafts[control.property]);

        if (currentValue === nextValue) {
          return null;
        }

        return nextValue
          ? { type: "setStyle", property: control.property, value: nextValue }
          : { type: "clearStyle", property: control.property };
      })
      .filter((operation): operation is DeterministicEditOperation => operation !== null);

    await applyOperations(operations);
  };

  const targetLabel = selectedElementInfo.targetType === "navigation" ? "Navigation" : selectedScreen?.name ?? "Screen";

  if (mode === "actions") {
    return null;
  }

  return (
    <aside className="fixed bottom-[calc(var(--dg-mobile-prompt-bottom)+5.2rem)] right-4 top-[calc(env(safe-area-inset-top,0px)+4.25rem)] z-[80] flex w-[min(390px,calc(100%-1rem))] flex-col rounded-[20px] border border-slate-950/[0.08] bg-white/96 p-3 shadow-[0_24px_80px_rgba(15,23,42,0.22)] backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#667894]">
            Selected in {targetLabel}
          </div>
          <div className="mt-0.5 truncate text-sm font-medium text-slate-900">
            {selectedElementInfo.textPreview || selectedElementInfo.editableMetadata?.tagName || "Element"}
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 rounded-full text-slate-500" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {mode === "text" ? (
        <div className="mt-3 flex min-h-0 flex-1 flex-col space-y-3">
          <div className="grid min-h-0 flex-1 gap-2 overflow-y-auto pr-1">
            {textNodes.map((node) => (
              <label key={node.drawgleId} className="grid gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{node.tagName}</span>
                <Input
                  value={textDrafts[node.drawgleId] ?? ""}
                  onChange={(event) => setTextDrafts((current) => ({ ...current, [node.drawgleId]: event.target.value }))}
                  className="h-9 rounded-[10px]"
                />
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" className="h-9 rounded-[10px]" onClick={() => onModeChange("actions")}>Back</Button>
            <Button className="h-9 rounded-[10px] gap-2" disabled={disabled || isSaving} onClick={() => void saveText()}>
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Save Text
            </Button>
          </div>
        </div>
      ) : null}

      {mode === "design" ? (
        <div className="mt-3 flex min-h-0 flex-1 flex-col space-y-3">
          {tokenColorRefs.length > 0 ? (
            <div className="rounded-[12px] border border-slate-950/[0.08] bg-[#fbfbfc] p-2">
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Project token swatches</div>
              <div className="flex flex-wrap gap-1.5">
              {tokenColorRefs.map((token) => (
                <button
                  key={token.name}
                  type="button"
                  className="h-6 w-6 rounded-full border border-slate-950/[0.12] shadow-sm"
                  style={{ backgroundColor: token.value }}
                  title={`${token.label}: ${token.value}`}
                  onClick={() => setStyleDrafts((current) => ({ ...current, "background-color": `var(${token.name})` }))}
                />
              ))}
              </div>
              <div className="mt-1.5 text-[11px] leading-4 text-slate-500">Swatches write token variables, so saved edits follow future token changes.</div>
            </div>
          ) : null}
          <div className="grid min-h-0 flex-1 grid-cols-2 gap-2 overflow-y-auto pr-1">
            {styleControls.map((control) => {
              const value = styleDrafts[control.property] ?? "";
              return (
                <label key={control.property} className="grid gap-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{control.label}</span>
                  {control.type === "color" ? (
                    <>
                      <div className="flex gap-1.5">
                        <input
                          type="color"
                          value={cssColorToHex(value)}
                          className="h-9 w-10 rounded-[10px] border border-slate-950/[0.1] bg-white p-1"
                          onChange={(event) => setStyleDrafts((current) => ({ ...current, [control.property]: event.target.value }))}
                        />
                        <Input
                          value={value}
                          onChange={(event) => setStyleDrafts((current) => ({ ...current, [control.property]: event.target.value }))}
                          className="h-9 min-w-0 rounded-[10px]"
                        />
                      </div>
                      {tokenColorRefs.length > 0 ? (
                        <select
                          value=""
                          className="h-8 rounded-[9px] border border-slate-950/[0.1] bg-white px-2 text-xs text-slate-600"
                          onChange={(event) => {
                            const tokenName = event.target.value;
                            if (!tokenName) return;
                            setStyleDrafts((current) => ({ ...current, [control.property]: `var(${tokenName})` }));
                          }}
                        >
                          <option value="">Use project token...</option>
                          {tokenColorRefs.map((token) => (
                            <option key={token.name} value={token.name}>{token.label}</option>
                          ))}
                        </select>
                      ) : null}
                    </>
                  ) : (
                    <Input
                      value={value}
                      placeholder={control.property === "box-shadow" ? "none" : "e.g. 16px"}
                      onChange={(event) => setStyleDrafts((current) => ({ ...current, [control.property]: event.target.value }))}
                      className="h-9 rounded-[10px]"
                    />
                  )}
                </label>
              );
            })}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" className="h-9 rounded-[10px]" onClick={() => onModeChange("actions")}>Back</Button>
            <Button className="h-9 rounded-[10px] gap-2" disabled={disabled || isSaving} onClick={() => void saveDesign()}>
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Apply Design
            </Button>
          </div>
        </div>
      ) : null}

      {mode === "ai" ? (
        <div className="mt-3 flex min-h-0 flex-1 flex-col justify-between gap-3">
          <div className="rounded-[12px] bg-[#f7f7f8] px-3 py-3 text-sm leading-6 text-slate-600">
            Describe the change in the prompt box below. The selected element will be sent as the AI target.
          </div>
          <Button variant="outline" className="h-9 rounded-[10px]" onClick={() => onModeChange("actions")}>Back</Button>
        </div>
      ) : null}
    </aside>
  );
}

function MetadataField({ label, value }: { label: string; value?: string | null }) {
  if (!value) {
    return null;
  }

  return (
    <div className="rounded-[12px] border border-slate-950/[0.08] bg-white px-3 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className="mt-1 whitespace-pre-line text-sm leading-6 text-slate-700">{value}</div>
    </div>
  );
}

function ProjectIntelligencePanel({
  project,
  screens,
  generationRuns,
  projectNavigation,
  tokenDraft,
  tokenDirty,
  tokenSaving,
  generationActive,
  onTokenDraftChange,
  onSaveTokens,
  onDiscardTokens,
  onClose,
}: {
  project: ProjectData;
  screens: ScreenData[];
  generationRuns: GenerationRunData[];
  projectNavigation: ProjectNavigationData | null;
  tokenDraft: DesignTokens | null;
  tokenDirty: boolean;
  tokenSaving: boolean;
  generationActive: boolean;
  onTokenDraftChange: (tokens: DesignTokens) => void;
  onSaveTokens: () => Promise<void>;
  onDiscardTokens: () => void;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<ProjectPanelTab>("design");
  const latestPlannedScreens = useMemo(() => getLatestPlannedScreens(generationRuns), [generationRuns]);
  const screenPlanRows: Array<ScreenData | ScreenPlan> = screens.length > 0 ? screens : latestPlannedScreens;
  const charter = project.charter;
  const hasTokens = Boolean(tokenDraft && hasApprovedDesignTokens(tokenDraft));

  return (
    <aside className="fixed right-4 top-16 z-[72] flex max-h-[calc(100dvh-5rem)] w-[min(620px,calc(100vw-2rem))] flex-col overflow-hidden rounded-[18px] border border-slate-950/[0.1] bg-white/96 shadow-[0_24px_80px_rgba(15,23,42,0.18)] backdrop-blur-xl">
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-950/[0.08] px-4 py-3">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#667894]">Project Intelligence</div>
          <div className="truncate text-base font-semibold text-slate-950">{project.name}</div>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 rounded-full text-slate-500" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid shrink-0 grid-cols-4 gap-1 border-b border-slate-950/[0.08] bg-[#f7f7f8] p-2">
        {PROJECT_PANEL_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex h-10 items-center justify-center gap-1.5 rounded-[10px] text-[11px] font-semibold transition ${activeTab === tab.id ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:bg-white/70"}`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {activeTab === "design" ? (
          hasTokens && tokenDraft ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-[14px] border border-slate-950/[0.08] bg-[#fbfbfc] px-3 py-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-950">Live token preview</div>
                  <div className="text-xs leading-5 text-slate-500">
                    Token edits update the canvas preview immediately. Save persists the system.
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="h-9 rounded-[10px] gap-2" disabled={!tokenDirty || tokenSaving} onClick={onDiscardTokens}>
                    <RotateCcw className="h-3.5 w-3.5" />
                    Discard
                  </Button>
                  <Button className="h-9 rounded-[10px] gap-2" disabled={!tokenDirty || tokenSaving || generationActive} onClick={() => void onSaveTokens()}>
                    {tokenSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    Save
                  </Button>
                </div>
                {generationActive ? (
                  <div className="w-full rounded-[10px] bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                    A generation is running. Preview is live, but save is locked so in-flight screens keep a stable token snapshot.
                  </div>
                ) : null}
              </div>
              <DesignSystemEditor
                value={tokenDraft}
                onChange={onTokenDraftChange}
                onSubmit={onSaveTokens}
                title="Design System"
                description="Exact project tokens. Linked screens and navigation read these values through Drawgle CSS variables."
                submitLabel={tokenDirty ? "Save Tokens" : "Tokens Saved"}
                isSubmitting={tokenSaving}
                submitStatus="Saving live token system..."
              />
            </div>
          ) : (
            <div className="rounded-[14px] border border-dashed border-slate-300 bg-[#fbfbfc] px-4 py-8 text-center text-sm text-slate-500">
              Design tokens will appear here as soon as the generation job finishes design analysis.
            </div>
          )
        ) : null}

        {activeTab === "charter" ? (
          <div className="space-y-3">
            <MetadataField label="Original intent" value={charter?.originalPrompt ?? project.prompt} />
            <MetadataField label="Reference image analysis" value={charter?.imageReferenceSummary} />
            <MetadataField label="App type" value={charter?.appType} />
            <MetadataField label="Audience" value={charter?.targetAudience} />
            <MetadataField label="Navigation model" value={charter?.navigationModel} />
            <MetadataField label="Design rationale" value={charter?.designRationale} />
            <MetadataField label="Creative direction" value={charter?.creativeDirection ? `${charter.creativeDirection.conceptName}\n${charter.creativeDirection.styleEssence}` : null} />
            <MetadataField label="Surface language" value={charter?.creativeDirection?.surfaceLanguage} />
            <MetadataField label="Signature moments" value={charter?.creativeDirection?.signatureMoments?.join("\n")} />
            <MetadataField label="Avoid" value={charter?.creativeDirection?.avoid?.join("\n")} />
          </div>
        ) : null}

        {activeTab === "screens" ? (
          <div className="space-y-3">
            {screenPlanRows.map((screen, index) => {
              const screenData = "id" in screen ? screen as ScreenData : null;
              const plan = screen as unknown as ScreenPlan;
              return (
                <article key={`${screen.name}-${index}`} className="rounded-[14px] border border-slate-950/[0.08] bg-white px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        {screenData?.status ?? plan.type ?? "planned"}
                      </div>
                      <h3 className="mt-1 truncate text-lg font-semibold text-slate-950">{screen.name}</h3>
                    </div>
                    <span className="rounded-full bg-[#f7f7f8] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      {screenData?.chromePolicy?.chrome ?? plan.chromePolicy?.chrome ?? plan.type}
                    </span>
                  </div>
                  <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-600">{screenData?.prompt ?? plan.description}</p>
                </article>
              );
            })}
            {!screens.length && !latestPlannedScreens.length ? (
              <div className="rounded-[14px] border border-dashed border-slate-300 bg-[#fbfbfc] px-4 py-8 text-center text-sm text-slate-500">
                Screen planning will appear here when the builder finishes the planning step.
              </div>
            ) : null}
          </div>
        ) : null}

        {activeTab === "navigation" ? (
          <div className="space-y-3">
            <MetadataField label="Visual brief" value={projectNavigation?.plan?.visualBrief} />
            <MetadataField label="State" value={projectNavigation?.plan?.enabled ? `${projectNavigation.plan.kind} shared navigation` : "No persistent project navigation"} />
            {projectNavigation?.plan?.items?.map((item) => (
              <div key={item.id} className="rounded-[14px] border border-slate-950/[0.08] bg-white px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-950">{item.label}</div>
                    <div className="text-xs text-slate-500">{item.role}</div>
                  </div>
                  <span className="rounded-full bg-[#f7f7f8] px-2.5 py-1 text-[10px] font-semibold text-slate-500">{item.icon}</span>
                </div>
                <div className="mt-2 text-xs text-slate-500">Linked screen: {item.linkedScreenName}</div>
              </div>
            ))}
            {!projectNavigation ? (
              <div className="rounded-[14px] border border-dashed border-slate-300 bg-[#fbfbfc] px-4 py-8 text-center text-sm text-slate-500">
                Navigation planning will appear here once the project planner runs.
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </aside>
  );
}

async function enqueueGeneration(input: {
  projectId: string;
  prompt: string;
  image?: PromptImagePayload | null;
  designTokens?: DesignTokens | null;
  sourceGenerationRunId?: string;
  plannedScreens?: ScreenPlan[] | null;
  requiresBottomNav?: boolean;
  navigationArchitecture?: NavigationArchitecture | null;
  navigationPlan?: NavigationPlan | null;
}) {
  const response = await fetch("/api/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new QueueGenerationError(payload.error ?? "Failed to queue generation.", response.status, payload.activeGenerationRunId);
  }

  return payload as { projectId: string; generationRunId: string; triggerRunId: string };
}

export function ProjectShell({
  user,
  initialProject,
  initialScreens,
  initialGenerationRuns,
  initialProjectNavigation,
}: {
  user: AuthenticatedUser;
  initialProject: ProjectData;
  initialScreens: ScreenData[];
  initialGenerationRuns: GenerationRunData[];
  initialProjectNavigation: ProjectNavigationData | null;
}) {
  const router = useRouter();
  const { project, isLoading: isProjectLoading } = useProject(initialProject.id, initialProject);
  const { screens, refreshScreens } = useScreens(initialProject.id, initialScreens);
  const { projectNavigation } = useProjectNavigation(initialProject.id, initialProjectNavigation);
  const { generationRun, generationRuns, refreshGenerationRuns } = useGenerationRuns(initialProject.id, initialGenerationRuns);
  const [fitRequestVersion, setFitRequestVersion] = useState(0);
  const [selectedScreen, setSelectedScreen] = useState<ScreenData | null>(null);
  const [isChatCollapsed, setIsChatCollapsed] = useState(false);
  const [isQueueingGeneration, setIsQueueingGeneration] = useState(false);
  const [pendingQueuedRunId, setPendingQueuedRunId] = useState<string | null>(null);
  const [pendingAddScreenRunId, setPendingAddScreenRunId] = useState<string | null>(null);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [editSession, setEditSession] = useState<ElementEditSession | null>(null);
  const [isProjectPanelOpen, setIsProjectPanelOpen] = useState(false);
  const [tokenDraft, setTokenDraft] = useState<DesignTokens | null>(() =>
    hasApprovedDesignTokens(initialProject.designTokens)
      ? normalizeDesignTokens(initialProject.designTokens)
      : null,
  );
  const [tokenDirty, setTokenDirty] = useState(false);
  const [tokenSaving, setTokenSaving] = useState(false);
  const centeredRunIdRef = useRef<string | null>(null);
  const knownScreenIdsRef = useRef<Set<string>>(new Set());
  const hasHydratedScreenIdsRef = useRef(false);
  const addScreenRefreshAttemptedRunIdRef = useRef<string | null>(null);
  const hasQueuedInitialFitRef = useRef(false);
  const isGenerationBusy = Boolean(generationRun) || isQueueingGeneration || Boolean(pendingQueuedRunId);
  const isCanvasInteractionLocked = isGenerationBusy;
  const isGenerationActive = Boolean(
    generationRun &&
    (generationRun.status === "queued" || generationRun.status === "planning" || generationRun.status === "building"),
  );
  const effectiveDesignTokens = tokenDraft && hasApprovedDesignTokens(tokenDraft)
    ? tokenDraft
    : project?.designTokens ?? null;
  const selectedElementInfo = editSession?.element ?? null;
  const mobilePromptReserve = selectedScreen
    ? 166
    : 136;
  const shellLayoutVars = {
    "--dg-mobile-prompt-reserve": `${mobilePromptReserve}px`,
    "--dg-mobile-prompt-bottom": "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)",
    "--dg-mobile-top-reserve": "calc(env(safe-area-inset-top, 0px) + 5rem)",
  } as CSSProperties;
  useEffect(() => {
    if (!project && !isProjectLoading) {
      router.replace("/project/new");
    }
  }, [project, isProjectLoading, router]);

  useEffect(() => {
    if (tokenDirty) {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTokenDraft(hasApprovedDesignTokens(project?.designTokens)
      ? normalizeDesignTokens(project?.designTokens)
      : null);
  }, [project?.designTokens, tokenDirty]);

  useEffect(() => {
    if (!selectedScreen) {
      return;
    }

    const updatedScreen = screens.find((screen) => screen.id === selectedScreen.id);
    if (!updatedScreen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedScreen(null);
      if (editSession?.screenId === selectedScreen.id) {
        setEditSession(null);
      }
      return;
    }

    if (
      updatedScreen.updatedAt !== selectedScreen.updatedAt ||
      updatedScreen.code !== selectedScreen.code ||
      updatedScreen.x !== selectedScreen.x ||
      updatedScreen.y !== selectedScreen.y
    ) {
      setSelectedScreen(updatedScreen);
    }
  }, [editSession?.screenId, screens, selectedScreen]);

  useEffect(() => {
    if (screens.length === 0 || hasQueuedInitialFitRef.current) {
      return;
    }

    hasQueuedInitialFitRef.current = true;
    setFitRequestVersion((currentVersion) => currentVersion + 1);
  }, [screens.length]);

  useEffect(() => {
    if (screens.length === 0) {
      knownScreenIdsRef.current = new Set();
      return;
    }

    const currentScreenIds = new Set(screens.map((screen) => screen.id));

    if (!hasHydratedScreenIdsRef.current) {
      hasHydratedScreenIdsRef.current = true;
      knownScreenIdsRef.current = currentScreenIds;
      return;
    }

    const hasNewScreen = screens.some((screen) => !knownScreenIdsRef.current.has(screen.id));
    knownScreenIdsRef.current = currentScreenIds;

    if (!hasNewScreen) {
      return;
    }

    setFitRequestVersion((currentVersion) => currentVersion + 1);
  }, [screens]);

  useEffect(() => {
    if (!pendingQueuedRunId) {
      return;
    }

    if (screens.some((screen) => screen.generationRunId === pendingQueuedRunId)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPendingQueuedRunId(null);
    }
  }, [screens, pendingQueuedRunId]);

  useEffect(() => {
    if (!pendingQueuedRunId) {
      return;
    }

    if (generationRuns.some((run) => run.id === pendingQueuedRunId)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPendingQueuedRunId(null);
    }
  }, [generationRuns, pendingQueuedRunId]);

  useEffect(() => {
    if (!pendingAddScreenRunId) {
      addScreenRefreshAttemptedRunIdRef.current = null;
      return;
    }

    if (screens.some((screen) => screen.generationRunId === pendingAddScreenRunId)) {
      addScreenRefreshAttemptedRunIdRef.current = null;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPendingAddScreenRunId(null);
    }
  }, [screens, pendingAddScreenRunId]);

  useEffect(() => {
    if (generationRun?.id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQueueError(null);
    }
  }, [generationRun?.id]);

  useEffect(() => {
    if (!generationRun?.id) {
      centeredRunIdRef.current = null;
      return;
    }

    if (centeredRunIdRef.current === generationRun.id) {
      return;
    }

    const hasGeneratedScreens = screens.some((screen) => screen.generationRunId === generationRun.id);
    if (!hasGeneratedScreens) {
      return;
    }

    centeredRunIdRef.current = generationRun.id;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFitRequestVersion((currentVersion) => currentVersion + 1);
  }, [generationRun?.id, screens]);

  useEffect(() => {
    if (!pendingAddScreenRunId) {
      return;
    }

    const trackedRun = generationRuns.find((run) => run.id === pendingAddScreenRunId);
    if (!trackedRun || !TERMINAL_GENERATION_STATUSES.has(trackedRun.status)) {
      return;
    }

    if (screens.some((screen) => screen.generationRunId === pendingAddScreenRunId)) {
      addScreenRefreshAttemptedRunIdRef.current = null;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPendingAddScreenRunId(null);
      return;
    }

    if (addScreenRefreshAttemptedRunIdRef.current === pendingAddScreenRunId) {
      return;
    }

    addScreenRefreshAttemptedRunIdRef.current = pendingAddScreenRunId;

    let cancelled = false;

    void (async () => {
      await refreshScreens();

      if (!cancelled) {
        addScreenRefreshAttemptedRunIdRef.current = null;
        setPendingAddScreenRunId(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [generationRuns, pendingAddScreenRunId, refreshScreens, screens]);

  const queueGenerationRequest = async (input: {
    prompt: string;
    image?: PromptImagePayload | null;
    designTokens?: DesignTokens | null;
    sourceGenerationRunId?: string;
    plannedScreens?: ScreenPlan[] | null;
    requiresBottomNav?: boolean;
    navigationArchitecture?: NavigationArchitecture | null;
    navigationPlan?: NavigationPlan | null;
  }) => {
    if (!project || isGenerationBusy) {
      return false;
    }

    const isPlannedAddScreenRequest = (input.plannedScreens?.length ?? 0) === 1;

    setQueueError(null);
    setIsQueueingGeneration(true);

    try {
      const queuedRun = await enqueueGeneration({
        projectId: project.id,
        prompt: input.prompt,
        image: input.image ?? null,
        designTokens: input.designTokens ?? null,
        sourceGenerationRunId: input.sourceGenerationRunId,
        plannedScreens: input.plannedScreens ?? null,
        requiresBottomNav: input.requiresBottomNav,
        navigationArchitecture: input.navigationArchitecture ?? null,
        navigationPlan: input.navigationPlan ?? null,
      });

      setPendingQueuedRunId(queuedRun.generationRunId);
      setPendingAddScreenRunId(isPlannedAddScreenRequest ? queuedRun.generationRunId : null);
      addScreenRefreshAttemptedRunIdRef.current = null;
      await refreshGenerationRuns();
      return true;
    } catch (error) {
      if (isPlannedAddScreenRequest) {
        setPendingAddScreenRunId(null);
        addScreenRefreshAttemptedRunIdRef.current = null;
      }

      await refreshGenerationRuns();

      if (error instanceof QueueGenerationError && error.status === 409) {
        setQueueError("A generation is already queued or building for this project.");
        if (error.activeGenerationRunId) {
          setPendingQueuedRunId(error.activeGenerationRunId);
        }
      } else {
        setQueueError(error instanceof Error ? error.message : "Failed to queue generation.");
      }

      return false;
    } finally {
      setIsQueueingGeneration(false);
    }
  };

  const handleRetryGeneration = async (run: GenerationRunData) => {
    if (!project || isCanvasInteractionLocked) {
      return;
    }

    await queueGenerationRequest({
      prompt: run.prompt,
      designTokens: project.designTokens ?? null,
      sourceGenerationRunId: run.id,
      navigationArchitecture: project.charter?.navigationArchitecture ?? null,
      navigationPlan: projectNavigation?.plan ?? null,
    });
  };

  const handleDeleteSelectedScreen = async () => {
    if (!selectedScreen) {
      return;
    }

    try {
      const supabase = createClient();
      await deleteScreen(supabase, selectedScreen.id);
      setSelectedScreen(null);
      setEditSession(null);
    } catch (error) {
      console.error("Error deleting screen:", error);
    }
  };

  const handlePromptAction = async (options: {
    prompt: string;
    image?: PromptImagePayload | null;
  }) => {
    if (!project || isCanvasInteractionLocked) {
      return false;
    }

    const prompt = options.prompt.trim();
    if (!prompt && !options.image) {
      return false;
    }

    const activeEditScreenId = editSession?.screenId ?? selectedScreen?.id ?? null;
    const activeEditElement = editSession?.element ?? null;
    setQueueError(null);

    try {
      const agentRes = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          prompt,
          image: options.image ?? null,
          selectedScreenId: activeEditScreenId,
          focusedScreenId: selectedScreen?.id ?? null,
          selectedElementHtml: activeEditElement?.outerHTML ?? null,
          selectedElementDrawgleId: activeEditElement?.drawgleId ?? null,
          selectedElementTarget: activeEditElement?.targetType ?? null,
          selectedElementPreview: activeEditElement?.textPreview ?? null,
        }),
      });
      const payload = await agentRes.json().catch(() => ({}));

      if (!agentRes.ok && agentRes.status !== 409) {
        throw new Error(payload.error ?? "Drawgle agent could not process the request.");
      }

      if (payload.intent === "create_new_screen" && payload.generationRunId) {
        setPendingQueuedRunId(payload.generationRunId);
        setPendingAddScreenRunId(payload.generationRunId);
        addScreenRefreshAttemptedRunIdRef.current = null;
        await refreshGenerationRuns();
      } else if (payload.intent === "modify_screen") {
        setEditSession(null);
        setSelectionMode(false);
      }

      return true;
    } catch (error) {
      console.error("Agent flow error:", error);

      try {
        const supabase = createClient();
        await insertProjectMessage(supabase, {
          projectId: project.id,
          ownerId: user.id,
          screenId: activeEditScreenId,
          role: "model",
          content: error instanceof Error ? error.message : "Sorry, I encountered an error while processing your request.",
          messageType: "error",
        });
      } catch (messageError) {
        console.error("Failed to persist agent error message", messageError);
        return false;
      }

      return true;
    } finally {
      setIsQueueingGeneration(false);
    }
  };

  const handleDeterministicElementEdit = async (operations: DeterministicEditOperation[]) => {
    if (!project || !editSession?.element.drawgleId || operations.length === 0) {
      return false;
    }

    try {
      const editRes = await fetch("/api/element-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          screenId: editSession.screenId,
          targetType: editSession.element.targetType,
          drawgleId: editSession.element.drawgleId,
          operations,
        }),
      });

      if (!editRes.ok) {
        const payload = await editRes.json().catch(() => null);
        throw new Error(payload?.error ?? "Failed to edit selected element.");
      }

      await refreshScreens();
      return true;
    } catch (error) {
      console.error("Deterministic element edit error:", error);
      return false;
    }
  };

  const handleTokenDraftChange = (nextTokens: DesignTokens) => {
    setTokenDraft(normalizeDesignTokens(nextTokens));
    setTokenDirty(true);
  };

  const handleDiscardTokenDraft = () => {
    setTokenDraft(hasApprovedDesignTokens(project?.designTokens)
      ? normalizeDesignTokens(project?.designTokens)
      : null);
    setTokenDirty(false);
  };

  const handleSaveTokenDraft = async () => {
    if (!project || !tokenDraft || !hasApprovedDesignTokens(tokenDraft) || isGenerationActive) {
      return;
    }

    setTokenSaving(true);
    try {
      const normalized = normalizeDesignTokens(tokenDraft);
      await updateProjectFields(createClient(), project.id, { designTokens: normalized });
      setTokenDraft(normalized);
      setTokenDirty(false);
    } catch (error) {
      console.error("Failed to save design tokens", error);
    } finally {
      setTokenSaving(false);
    }
  };

  const clearEditSession = () => {
    setEditSession(null);
    setSelectionMode(false);
  };

  const handleCanvasSelectScreen = (screen: ScreenData | null) => {
    if (!screen && editSession) {
      return;
    }

    setSelectedScreen(screen);

    if (!screen) {
      setSelectionMode(false);
      return;
    }

    if (editSession?.screenId && editSession.screenId !== screen.id) {
      setEditSession(null);
    }
  };

  const setEditSessionMode = (mode: ManualEditMode) => {
    setEditSession((currentSession) => currentSession ? { ...currentSession, mode } : currentSession);
    if (mode === "ai") {
      setSelectionMode(false);
    }
  };

  if (isProjectLoading || !project) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-[#f7f7f8]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="h-[100dvh] overflow-hidden bg-[#f7f7f8] text-gray-900" style={shellLayoutVars}>
      <main className="relative z-0 flex h-full w-full overflow-hidden">
        <div className="absolute left-4 right-4 top-[calc(env(safe-area-inset-top,0px)+1rem)] z-50 flex items-center justify-between gap-3">
          <div className="flex h-8 items-center rounded-full dg-panel px-2 backdrop-blur-xl lg:px-3">
            <Button variant="ghost" size="sm" onClick={() => router.push("/project/new")} className="h-8 rounded-full text-neutral-700 hover:bg-[#f7f7f8] focus-visible:bg-[#f7f7f8] data-[state=open]:bg-[#f7f7f8]">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Workspace
            </Button>
            <div className="hidden h-5 w-px bg-slate-950/[0.1] sm:block" />
            <div className="hidden max-w-[240px] truncate pl-2 text-[11px] font-semibold uppercase text-neutral-500 sm:block">
              {project.name}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsProjectPanelOpen(true)}
            className="h-8 rounded-full dg-panel px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-600 backdrop-blur-xl hover:bg-white"
          >
            <Palette className="mr-2 h-3.5 w-3.5" />
            Project System
          </Button>
        </div>

        <div className="relative h-full min-w-0 flex-1">
          <CanvasArea
            screens={screens}
            projectNavigation={projectNavigation}
            designTokens={effectiveDesignTokens}
            fitRequestVersion={fitRequestVersion}
            selectedScreen={selectedScreen}
            mobileBottomReserve={mobilePromptReserve}
            onSelectScreen={handleCanvasSelectScreen}
            selectionMode={selectionMode}
            preserveSelectionOnCanvasClick={Boolean(editSession) || selectionMode}
            selectedElementScreenId={editSession?.screenId ?? null}
            selectedElementDrawgleId={editSession?.element.drawgleId ?? null}
            onElementSelected={(info) => {
              setEditSession({
                screenId: selectedScreen?.id ?? null,
                element: info,
                mode: "actions",
              });
              setSelectionMode(false);
            }}
          />

          {isProjectPanelOpen ? (
            <ProjectIntelligencePanel
              project={project}
              screens={screens}
              generationRuns={generationRuns}
              projectNavigation={projectNavigation}
              tokenDraft={tokenDraft}
              tokenDirty={tokenDirty}
              tokenSaving={tokenSaving}
              generationActive={isGenerationActive}
              onTokenDraftChange={handleTokenDraftChange}
              onSaveTokens={handleSaveTokenDraft}
              onDiscardTokens={handleDiscardTokenDraft}
              onClose={() => setIsProjectPanelOpen(false)}
            />
          ) : null}

          <ChatPanel
            project={project}
            screens={screens}
            selectedScreen={selectedScreen}
            generationRun={generationRun}
            generationRuns={generationRuns}
            isQueueing={isQueueingGeneration || Boolean(pendingQueuedRunId)}
            queueError={queueError}
            retryDisabled={isCanvasInteractionLocked}
            isBuilding={isQueueingGeneration}
            onRetryGeneration={handleRetryGeneration}
            isCollapsed={isChatCollapsed}
            onCollapseChange={setIsChatCollapsed}
          />

          {editSession?.mode === "actions" ? (
            <SelectedElementActionMenu
              session={editSession}
              selectedScreen={selectedScreen}
              disabled={isCanvasInteractionLocked}
              onChooseMode={setEditSessionMode}
              onClear={clearEditSession}
            />
          ) : null}

          {editSession && editSession.mode !== "actions" ? (
            <SelectedElementInspectorSidebar
              key={`${editSession.element.targetType}:${editSession.element.drawgleId ?? editSession.element.breadcrumb}:${editSession.mode}`}
              project={project}
              selectedScreen={selectedScreen}
              selectedElementInfo={editSession.element}
              mode={editSession.mode}
              disabled={isCanvasInteractionLocked}
              onModeChange={setEditSessionMode}
              onClose={clearEditSession}
              onApplyOperations={handleDeterministicElementEdit}
            />
          ) : null}

          <div className="absolute bottom-[var(--dg-mobile-prompt-bottom)] left-1/2 z-[60] w-full max-w-2xl -translate-x-1/2 px-4 transition-all duration-300 ease-in-out">
            <PromptBar
              project={project}
              selectedScreen={selectedScreen}
              onClearSelectedScreen={() => {
                setSelectedScreen(null);
                setEditSession(null);
              }}
              onDeleteSelectedScreen={handleDeleteSelectedScreen}
              onSubmit={handlePromptAction}
              disabled={isCanvasInteractionLocked}
              submitStatusText="Thinking..."
              selectionMode={selectionMode}
              onToggleSelectionMode={() => {
                setSelectionMode((m) => !m);
              }}
              selectedElementPreview={selectedElementInfo?.textPreview ?? null}
              onClearSelectedElement={clearEditSession}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
