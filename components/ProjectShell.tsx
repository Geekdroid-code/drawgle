"use client";

import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, ChevronDown, ImageIcon, Loader2, Palette, RotateCcw, Upload, X } from "lucide-react";

import { CanvasArea } from "@/components/CanvasArea";
import { CanvasToolDock } from "@/components/CanvasToolDock";
import { ChatPanel } from "@/components/ChatPanel";
import { ColorPickerButton } from "@/components/DesignSystemEditor";
import type { ElementSelectionLostReason, SelectedElementInfo } from "@/components/ScreenNode";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { DeterministicEditOperation, DrawgleImageTargetMeta } from "@/lib/drawgle-dom";
import {
  getTokenReferencesForStyleProperty,
  normalizeCssValue,
  resolveStyleInspection,
  tokenVariableNameFromValue,
  type DrawgleResolvedStyleProperty,
  type DrawgleStyleGroup,
  type DrawgleStyleProperty,
  type DrawgleTokenReferenceLike,
} from "@/lib/element-style-inspection";
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
  ImageReferenceMode,
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

type ManualEditMode = "selected" | "design";

const EMPTY_TEXT_NODES: NonNullable<SelectedElementInfo["editableMetadata"]>["textNodes"] = [];
const EMPTY_INSPECTED_PROPERTIES: DrawgleResolvedStyleProperty[] = [];
const MAX_REPLACEMENT_UPLOAD_BYTES = 2.8 * 1024 * 1024;
const MAX_REPLACEMENT_IMAGE_EDGE = 2400;

const loadImageForUpload = (file: File) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not read this image file."));
    };
    image.src = objectUrl;
  });

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Could not prepare this image for upload."));
        return;
      }
      resolve(blob);
    }, type, quality);
  });

const prepareReplacementImageFile = async (file: File) => {
  if (file.size <= MAX_REPLACEMENT_UPLOAD_BYTES) {
    return file;
  }

  if (file.type === "image/gif") {
    throw new Error("GIF replacements must be under 4MB. Use PNG, JPEG, or WebP for larger images.");
  }

  if (!file.type.startsWith("image/")) {
    return file;
  }

  const image = await loadImageForUpload(file);
  const scale = Math.min(1, MAX_REPLACEMENT_IMAGE_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not prepare this image for upload.");
  }
  context.drawImage(image, 0, 0, width, height);

  const baseName = file.name.replace(/\.[^.]+$/, "") || "replacement-image";
  for (const quality of [0.86, 0.76, 0.66, 0.56]) {
    const blob = await canvasToBlob(canvas, "image/webp", quality);
    if (blob.size <= MAX_REPLACEMENT_UPLOAD_BYTES || quality === 0.56) {
      return new File([blob], `${baseName}.webp`, { type: "image/webp" });
    }
  }

  return file;
};

const labelForImageTargetKind = (kind: DrawgleImageTargetMeta["kind"]) => {
  if (kind === "img") return "Image element";
  if (kind === "background") return "Background image";
  if (kind === "inline_svg") return "SVG placeholder";
  return "Visual placeholder";
};

const replaceModeForImageTarget = (kind: DrawgleImageTargetMeta["kind"]): Extract<DeterministicEditOperation, { type: "replaceImage" }>["mode"] => {
  if (kind === "background") return "background";
  if (kind === "inline_svg") return "inline_svg";
  if (kind === "visual_placeholder") return "visual_placeholder";
  return "src";
};

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

const getTokenPickerLabel = (property: DrawgleStyleProperty) => {
  if (property === "color") {
    return "Link text token";
  }

  if (property === "background-color") {
    return "Link fill token";
  }

  if (property === "border-color") {
    return "Link border token";
  }

  if (property === "border-radius") {
    return "Link radius token";
  }

  if (property === "box-shadow") {
    return "Link shadow token";
  }

  return "Link token";
};

const getTokenPickerDescription = (property: DrawgleStyleProperty) => {
  if (property === "color") {
    return "Choose a text color token for this element.";
  }

  if (property === "background-color") {
    return "Choose a surface, background, or action fill token.";
  }

  if (property === "border-color") {
    return "Choose a border or accent token.";
  }

  if (property === "border-radius") {
    return "Choose a project radius token.";
  }

  if (property === "box-shadow") {
    return "Choose a project shadow token.";
  }

  return "Choose a live token for this property.";
};

const styleGroupMeta: Record<DrawgleStyleGroup, { title: string; description: string }> = {
  Type: {
    title: "Type",
    description: "Text styling for this selected element.",
  },
  Surface: {
    title: "Surface",
    description: "Fill, border, and corner styling.",
  },
  Layout: {
    title: "Layout",
    description: "Padding, margin, and spacing.",
  },
  Size: {
    title: "Size",
    description: "Element dimensions and constraints.",
  },
  Effects: {
    title: "Effects",
    description: "Shadow and opacity.",
  },
};

type StyleDraft =
  | { mode: "inherit"; value: "" }
  | { mode: "token"; value: string }
  | { mode: "custom"; value: string };

const styleSourceLabel = (property: DrawgleResolvedStyleProperty) => {
  if (property.status === "linked") {
    return "Linked to token";
  }
  if (property.source === "inline-custom") {
    return "Local override";
  }
  if (property.source === "inherited") {
    return "Inherited";
  }
  if (property.inlineValue) {
    return "Reset available";
  }
  if (property.source === "class") {
    return "Class style";
  }
  return "Rendered";
};

const styleSourceClassName = (property: DrawgleResolvedStyleProperty) => {
  if (property.status === "linked") {
    return "bg-teal-50 text-teal-700";
  }
  if (property.source === "inline-custom") {
    return "bg-amber-50 text-amber-700";
  }
  if (property.source === "inherited") {
    return "bg-slate-100 text-slate-500";
  }
  return "bg-slate-100 text-slate-600";
};

const initialDraftForProperty = (property: DrawgleResolvedStyleProperty): StyleDraft => {
  const inlineToken = tokenVariableNameFromValue(property.inlineValue);
  if (inlineToken) {
    return { mode: "token", value: inlineToken };
  }
  if (property.inlineValue) {
    return { mode: "custom", value: property.inlineValue };
  }
  return { mode: "inherit", value: "" };
};

const buildInitialStyleDrafts = (properties: DrawgleResolvedStyleProperty[]) =>
  Object.fromEntries(properties.map((property) => [property.property, initialDraftForProperty(property)])) as Partial<Record<DrawgleStyleProperty, StyleDraft>>;

const draftDisplayValue = (draft: StyleDraft | undefined, property: DrawgleResolvedStyleProperty) => {
  if (!draft || draft.mode === "inherit") {
    return property.computedValue || "not set";
  }
  if (draft.mode === "token") {
    return `var(${draft.value})`;
  }
  return draft.value;
};

const propertyPreviewStyle = (property: DrawgleResolvedStyleProperty): CSSProperties => {
  if (property.valueKind === "color") {
    return { backgroundColor: property.computedValue || "transparent" };
  }
  if (property.property === "border-radius") {
    return { borderRadius: property.computedValue || "0px" };
  }
  if (property.property === "box-shadow") {
    return { boxShadow: property.computedValue || "none" };
  }
  if (property.property === "opacity") {
    return { opacity: Number(property.computedValue) || 1 };
  }
  return {};
};

const CSS_LENGTH_UNITS = ["px", "rem", "em", "%", "vh", "vw"] as const;
const LINE_HEIGHT_UNITS = ["", "px", "rem", "em", "%"] as const;

const parseNumericCssValue = (value: string, fallbackUnit = "px") => {
  const normalized = normalizeCssValue(value);
  if (!normalized || normalized === "normal" || normalized === "auto") {
    return { amount: "", unit: fallbackUnit };
  }

  const match = normalized.match(/^(-?\d+(?:\.\d+)?)(px|rem|em|%|vh|vw)?$/i);
  if (!match) {
    return { amount: "", unit: fallbackUnit };
  }

  return {
    amount: match[1] ?? "",
    unit: match[2] ?? fallbackUnit,
  };
};

function NumericCssControl({
  property,
  value,
  onChange,
}: {
  property: DrawgleResolvedStyleProperty;
  value: string;
  onChange: (value: string) => void;
}) {
  const isLineHeight = property.property === "line-height";
  const units = isLineHeight ? LINE_HEIGHT_UNITS : CSS_LENGTH_UNITS;
  const fallbackUnit = isLineHeight ? "" : "px";
  const parsed = parseNumericCssValue(value, fallbackUnit);
  const step = isLineHeight && parsed.unit === "" ? 0.05 : 1;
  const amount = Number(parsed.amount || 0);

  const commit = (nextAmount: string, nextUnit = parsed.unit) => {
    const trimmed = nextAmount.trim();
    onChange(trimmed ? `${trimmed}${nextUnit}` : "");
  };

  return (
    <div className="flex min-w-0 flex-1 items-center rounded-[14px] border border-slate-950/[0.08] bg-white shadow-none focus-within:ring-3 focus-within:ring-ring/50">
      <button
        type="button"
        className="flex h-11 w-10 shrink-0 items-center justify-center rounded-l-[14px] text-slate-500 hover:bg-slate-50 hover:text-slate-950"
        onClick={() => commit(String(Math.max(0, Number((amount - step).toFixed(2)))), parsed.unit)}
      >
        -
      </button>
      <input
        type="number"
        step={step}
        value={parsed.amount}
        onChange={(event) => commit(event.target.value)}
        className="h-11 min-w-0 flex-1 border-x border-slate-950/[0.06] bg-transparent px-3 text-sm outline-none"
      />
      <select
        value={parsed.unit}
        onChange={(event) => commit(parsed.amount, event.target.value)}
        className="h-11 w-16 shrink-0 bg-transparent px-2 text-xs font-medium text-slate-500 outline-none"
      >
        {units.map((unit) => (
          <option key={unit || "unitless"} value={unit}>
            {unit || "unit"}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="flex h-11 w-10 shrink-0 items-center justify-center rounded-r-[14px] text-slate-500 hover:bg-slate-50 hover:text-slate-950"
        onClick={() => commit(String(Number((amount + step).toFixed(2))), parsed.unit)}
      >
        +
      </button>
    </div>
  );
}

function CustomStyleControl({
  property,
  value,
  onChange,
}: {
  property: DrawgleResolvedStyleProperty;
  value: string;
  onChange: (value: string) => void;
}) {
  if (property.valueKind === "length" || property.valueKind === "line-height") {
    return <NumericCssControl property={property} value={value} onChange={onChange} />;
  }

  if (property.valueKind === "font-weight") {
    return (
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 min-w-0 flex-1 rounded-[14px] border border-slate-950/[0.08] bg-white px-3 text-sm shadow-none outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {["300", "400", "500", "600", "700", "800", "900"].map((weight) => (
          <option key={weight} value={weight}>
            {weight}
          </option>
        ))}
      </select>
    );
  }

  if (property.property === "opacity") {
    const numericValue = Number(value || property.computedValue || 1);
    const clamped = Number.isFinite(numericValue) ? Math.max(0, Math.min(1, numericValue)) : 1;
    return (
      <div className="grid gap-2 rounded-[14px] border border-slate-950/[0.08] bg-white px-3 py-2">
        <div className="flex items-center justify-between gap-3">
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={clamped}
            onChange={(event) => onChange(Number(event.target.value).toFixed(2).replace(/\.?0+$/, ""))}
            className="min-w-0 flex-1 accent-slate-950"
          />
          <Input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="h-8 w-16 rounded-[10px] text-center text-xs"
          />
        </div>
      </div>
    );
  }

  return (
    <Input
      value={value}
      placeholder={property.property === "box-shadow" ? "none" : "Custom value"}
      onChange={(event) => onChange(event.target.value)}
      className="h-11 min-w-0 flex-1 rounded-[14px] border-slate-950/[0.08] bg-white px-3 text-sm shadow-none focus-visible:bg-white"
    />
  );
}

function TokenValuePicker({
  tokens,
  property,
  value,
  onSelect,
}: {
  tokens: DrawgleTokenReferenceLike[];
  property: DrawgleStyleProperty;
  value: string | null;
  onSelect: (tokenName: string) => void;
}) {
  const pickerTokens = getTokenReferencesForStyleProperty(property, tokens);
  const activeTokenName = value;
  const activeToken = pickerTokens.find((token) => token.name === activeTokenName) ?? null;

  if (pickerTokens.length === 0) {
    return null;
  }

  return (
    <Popover>
      <PopoverTrigger
        render={(
          <button
            type="button"
            className="flex h-10 w-full items-center justify-between gap-2 rounded-[14px] border border-slate-950/[0.08] bg-white/80 px-3 text-left text-xs font-medium text-slate-700 transition hover:border-slate-950/[0.16] hover:bg-white"
          />
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span
            className="h-4 w-4 shrink-0 rounded-full border border-slate-950/[0.12]"
            style={{ backgroundColor: activeToken?.value ?? "#ffffff" }}
          />
          <span className="truncate">
            {activeToken ? activeToken.label : getTokenPickerLabel(property)}
          </span>
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={8}
        className="w-[min(320px,calc(100vw-2rem))] rounded-[18px] border border-slate-950/[0.08] bg-white p-2 shadow-[0_20px_70px_rgba(15,23,42,0.2)]"
      >
        <div className="px-2 pb-1 pt-1">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#667894]">Project Tokens</div>
          <div className="mt-0.5 text-xs leading-5 text-slate-500">{getTokenPickerDescription(property)}</div>
        </div>
        <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
          {pickerTokens.map((token) => (
            <button
              key={token.name}
              type="button"
              className="flex w-full items-center gap-3 rounded-[14px] px-2 py-2 text-left transition hover:bg-slate-50"
              onClick={() => onSelect(token.name)}
            >
              <span
              className="h-8 w-8 shrink-0 rounded-full border border-slate-950/[0.1]"
                style={property === "color" || property === "background-color" || property === "border-color" ? { backgroundColor: token.value } : undefined}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-slate-900">{token.label}</span>
                <span className="block truncate text-[11px] text-slate-500">{token.value}</span>
              </span>
              {activeTokenName === token.name ? (
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-950 text-white">
                  <Check className="h-3.5 w-3.5" />
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

type ElementEditSession = {
  screenId: string | null;
  element: SelectedElementInfo;
  mode: ManualEditMode;
  selectedAt: string;
  selectionVersion: number;
  freshness: "fresh" | "stale";
};

type PendingElementSelection = {
  info: SelectedElementInfo;
};

function SelectedElementInspectorSidebar({
  project,
  selectedScreen,
  selectedElementInfo,
  mode,
  disabled,
  onModeChange,
  onClose,
  onApplyOperations,
  onReplaceImage,
}: {
  project: ProjectData;
  selectedScreen: ScreenData | null;
  selectedElementInfo: SelectedElementInfo;
  mode: ManualEditMode;
  disabled: boolean;
  onModeChange: (mode: ManualEditMode) => void;
  onClose: () => void;
  onApplyOperations: (operations: DeterministicEditOperation[]) => Promise<boolean>;
  onReplaceImage: (target: DrawgleImageTargetMeta, file: File) => Promise<boolean>;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [uploadingImageTargetId, setUploadingImageTargetId] = useState<string | null>(null);
  const [expandedProperty, setExpandedProperty] = useState<DrawgleStyleProperty | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const pendingImageTargetRef = useRef<DrawgleImageTargetMeta | null>(null);
  const textNodes = selectedElementInfo.editableMetadata?.textNodes ?? EMPTY_TEXT_NODES;
  const imageTargets = selectedElementInfo.editableMetadata?.imageTargets ?? [];
  const tokenRefs = useMemo(
    () => getDrawgleTokenReferences(project.designTokens),
    [project.designTokens],
  );
  const styleInspection = useMemo(
    () => resolveStyleInspection(selectedElementInfo.editableMetadata?.styleInspection ?? null, tokenRefs),
    [selectedElementInfo.editableMetadata?.styleInspection, tokenRefs],
  );
  const inspectedProperties = styleInspection?.properties ?? EMPTY_INSPECTED_PROPERTIES;
  const originalTextById = useMemo(
    () => Object.fromEntries(textNodes.map((node) => [node.drawgleId, node.text])),
    [textNodes],
  );
  const [textDrafts, setTextDrafts] = useState<Record<string, string>>(() => originalTextById);
  const [styleDrafts, setStyleDrafts] = useState<Partial<Record<DrawgleStyleProperty, StyleDraft>>>(() => buildInitialStyleDrafts(inspectedProperties));

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

  const buildTextOperations = () =>
    textNodes
      .filter((node) => textDrafts[node.drawgleId] !== undefined && textDrafts[node.drawgleId] !== node.text)
      .map((node): DeterministicEditOperation => ({
        type: "replaceText",
        drawgleId: node.drawgleId,
        text: textDrafts[node.drawgleId] ?? "",
      }));

  const saveDesign = async () => {
    const styleOperations = inspectedProperties
      .map((property): DeterministicEditOperation | null => {
        const draft = styleDrafts[property.property] ?? initialDraftForProperty(property);
        const currentInlineValue = normalizeCssValue(property.inlineValue);

        if (draft.mode === "inherit") {
          return currentInlineValue
            ? { type: "clearStyle", property: property.property }
            : null;
        }

        const nextValue = draft.mode === "token"
          ? `var(${draft.value})`
          : normalizeCssValue(draft.value);

        if (currentInlineValue === nextValue) {
          return null;
        }

        return { type: "setStyle", property: property.property, value: nextValue };
      })
      .filter((operation): operation is DeterministicEditOperation => operation !== null);

    await applyOperations([...buildTextOperations(), ...styleOperations]);
  };

  const resetAllLocalOverrides = async () => {
    const operations = inspectedProperties
      .filter((property) => normalizeCssValue(property.inlineValue))
      .map((property): DeterministicEditOperation => ({
        type: "clearStyle",
        property: property.property,
      }));

    await applyOperations(operations);
  };

  const targetLabel = selectedElementInfo.targetType === "navigation" ? "Navigation" : selectedScreen?.name ?? "Screen";
  const chooseImageFile = (target: DrawgleImageTargetMeta) => {
    pendingImageTargetRef.current = target;
    setImageUploadError(null);
    imageInputRef.current?.click();
  };

  const handleImageFileChange = async (file: File | null) => {
    const target = pendingImageTargetRef.current;
    if (!target || !file) {
      return;
    }

    setUploadingImageTargetId(target.drawgleId);
    setImageUploadError(null);
    try {
      const saved = await onReplaceImage(target, file);
      if (saved) {
        onClose();
      }
    } catch (error) {
      setImageUploadError(error instanceof Error ? error.message : "Image upload failed.");
    } finally {
      setUploadingImageTargetId(null);
      pendingImageTargetRef.current = null;
      if (imageInputRef.current) {
        imageInputRef.current.value = "";
      }
    }
  };

  if (mode === "selected") {
    return null;
  }

  return (
    <aside className="fixed bottom-[calc(var(--dg-mobile-prompt-bottom)+8.75rem)] left-3 right-3 top-auto z-[80] flex max-h-[min(72vh,660px)] flex-col overflow-hidden rounded-[26px] border border-slate-950/[0.08] bg-white/96 backdrop-blur-xl md:bottom-4 md:left-auto md:right-4 md:top-[calc(env(safe-area-inset-top,0px)+4.25rem)] md:max-h-none md:w-[min(420px,calc(100%-1rem))]">
      <div className="flex items-start justify-between gap-3 border-b border-slate-950/[0.06] px-4 pb-3 pt-4">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#667894]">
            Visual Editor
          </div>
          <div className="mt-0.5 truncate text-sm font-medium text-slate-900">
            {selectedElementInfo.textPreview || selectedElementInfo.editableMetadata?.tagName || "Element"}
          </div>
          <div className="mt-0.5 truncate text-[11px] font-medium text-slate-500">
            Selected in {targetLabel}
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-950" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {mode === "design" ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {imageTargets.length > 0 ? (
              <section className="mb-3 overflow-hidden rounded-[20px] border border-slate-950/[0.08] bg-white shadow-[0_1px_0_rgba(15,23,42,0.03)]">
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={(event) => void handleImageFileChange(event.target.files?.[0] ?? null)}
                />
                <div className="border-b border-slate-950/[0.06] px-3 py-2.5">
                  <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#667894]">
                    <ImageIcon className="h-3.5 w-3.5" />
                    Image
                  </div>
                  <div className="mt-0.5 text-[11px] leading-4 text-slate-500">
                    Replace the selected image source. New files are stored in the project.
                  </div>
                </div>
                <div className="divide-y divide-slate-950/[0.06]">
                  {imageTargets.map((target) => (
                    <div key={`${target.kind}-${target.drawgleId}-${target.targetIndex ?? 0}`} className="flex items-center gap-3 px-3 py-2.5">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[14px] border border-slate-950/[0.08] bg-slate-50">
                        {target.src ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={target.src} alt={target.alt || target.label} className="h-full w-full object-cover" />
                        ) : (
                          <ImageIcon className="h-4 w-4 text-slate-400" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-slate-900">{target.label}</div>
                        <div className="mt-0.5 truncate text-[11px] text-slate-500">
                          {labelForImageTargetKind(target.kind)}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 shrink-0 rounded-full px-3 text-xs"
                        disabled={disabled || Boolean(uploadingImageTargetId)}
                        onClick={() => chooseImageFile(target)}
                      >
                        {uploadingImageTargetId === target.drawgleId ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Upload className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        Replace
                      </Button>
                    </div>
                  ))}
                </div>
                {imageUploadError ? (
                  <div className="border-t border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    {imageUploadError}
                  </div>
                ) : null}
              </section>
            ) : null}

            {textNodes.length > 0 ? (
              <section className="mb-3 overflow-hidden rounded-[20px] border border-slate-950/[0.08] bg-white shadow-[0_1px_0_rgba(15,23,42,0.03)]">
                <div className="border-b border-slate-950/[0.06] px-3 py-2.5">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#667894]">Content</div>
                  <div className="mt-0.5 text-[11px] leading-4 text-slate-500">Edit text inside the selected element.</div>
                </div>
                <div className="grid gap-3 p-3">
                  {textNodes.map((node) => (
                    <label key={node.drawgleId} className="grid gap-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{node.tagName}</span>
                      <Textarea
                        value={textDrafts[node.drawgleId] ?? ""}
                        onChange={(event) => setTextDrafts((current) => ({ ...current, [node.drawgleId]: event.target.value }))}
                        className="min-h-24 resize-y rounded-[14px] border-slate-950/[0.08] bg-slate-50/80 px-3 py-2 text-sm focus-visible:bg-white"
                      />
                    </label>
                  ))}
                </div>
              </section>
            ) : null}
            <div className="mb-3 rounded-[18px] border border-slate-950/[0.06] bg-slate-50/80 px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium text-slate-700">
                    {styleInspection?.classList.length ? styleInspection.classList.slice(0, 4).join(" · ") : "No element classes"}
                  </div>
                  <div className="mt-0.5 text-[11px] leading-4 text-slate-500">
                    Token-linked values stay live. Local overrides affect only this selected element.
                  </div>
                </div>
                <Button
                  variant="ghost"
                  className="h-8 shrink-0 rounded-full px-2.5 text-[11px] font-medium text-slate-500 hover:bg-white hover:text-slate-950"
                  disabled={disabled || isSaving || inspectedProperties.every((property) => !normalizeCssValue(property.inlineValue))}
                  onClick={() => void resetAllLocalOverrides()}
                >
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                  Reset all
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {(["Type", "Surface", "Layout", "Size", "Effects"] as DrawgleStyleGroup[]).map((group) => {
                const properties = inspectedProperties.filter((property) => property.group === group);
                if (properties.length === 0) {
                  return null;
                }

                return (
                  <section key={group} className="overflow-hidden rounded-[20px] border border-slate-950/[0.08] bg-white shadow-[0_1px_0_rgba(15,23,42,0.03)]">
                    <div className="border-b border-slate-950/[0.06] px-3 py-2.5">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#667894]">{styleGroupMeta[group].title}</div>
                      <div className="mt-0.5 text-[11px] leading-4 text-slate-500">{styleGroupMeta[group].description}</div>
                    </div>
                    <div className="divide-y divide-slate-950/[0.06]">
                      {properties.map((property) => {
                        const draft = styleDrafts[property.property] ?? initialDraftForProperty(property);
                        const isExpanded = expandedProperty === property.property;
                        const tokenOptions = getTokenReferencesForStyleProperty(property.property, tokenRefs);
                        const activeTokenName = draft.mode === "token" ? draft.value : property.tokenName;
                        const activeToken = tokenOptions.find((token) => token.name === activeTokenName) ?? null;
                        const displayValue = draftDisplayValue(draft, property);
                        const customValue = draft.mode === "custom" ? draft.value : property.inlineValue || property.computedValue;
                        const colorPickerValue = activeToken?.value ?? cssColorToHex(customValue);

                        return (
                          <div key={property.property}>
                            <button
                              type="button"
                              className="flex min-h-[56px] w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-slate-50"
                              onClick={() => setExpandedProperty(isExpanded ? null : property.property)}
                            >
                              <span
                                className="h-8 w-8 shrink-0 rounded-[11px] border border-slate-950/[0.08] bg-slate-50"
                                style={propertyPreviewStyle(property)}
                              />
                              <span className="min-w-0 flex-1">
                                <span className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-slate-900">{property.label}</span>
                                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${styleSourceClassName(property)}`}>
                                    {styleSourceLabel(property)}
                                  </span>
                                </span>
                                <span className="mt-0.5 block truncate text-xs text-slate-500">
                                  {activeToken ? activeToken.label : displayValue}
                                </span>
                              </span>
                              <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${isExpanded ? "rotate-180" : ""}`} />
                            </button>

                            {isExpanded ? (
                              <div className="grid gap-3 bg-slate-50/70 px-3 pb-3 pt-1">
                                <div className="grid grid-cols-3 gap-2">
                                  <Button
                                    variant={draft.mode === "inherit" ? "default" : "outline"}
                                    className="h-9 rounded-full text-xs"
                                    onClick={() => setStyleDrafts((current) => ({ ...current, [property.property]: { mode: "inherit", value: "" } }))}
                                  >
                                    Reset
                                  </Button>
                                  <Button
                                    variant={draft.mode === "token" ? "default" : "outline"}
                                    className="h-9 rounded-full text-xs"
                                    disabled={tokenOptions.length === 0}
                                    onClick={() => {
                                      const nextToken = activeTokenName ?? tokenOptions[0]?.name;
                                      if (!nextToken) {
                                        return;
                                      }
                                      setStyleDrafts((current) => ({ ...current, [property.property]: { mode: "token", value: nextToken } }));
                                    }}
                                  >
                                    Use token
                                  </Button>
                                  <Button
                                    variant={draft.mode === "custom" ? "default" : "outline"}
                                    className="h-9 rounded-full text-xs"
                                    onClick={() => setStyleDrafts((current) => ({
                                      ...current,
                                      [property.property]: { mode: "custom", value: property.inlineValue || property.computedValue },
                                    }))}
                                  >
                                    Custom
                                  </Button>
                                </div>

                                {draft.mode === "token" ? (
                                  <TokenValuePicker
                                    tokens={tokenRefs}
                                    property={property.property}
                                    value={draft.value}
                                    onSelect={(tokenName) => setStyleDrafts((current) => ({ ...current, [property.property]: { mode: "token", value: tokenName } }))}
                                  />
                                ) : null}

                                {draft.mode === "custom" ? (
                                  <div className="grid gap-2">
                                    <div className="flex gap-2">
                                      {property.valueKind === "color" ? (
                                        <ColorPickerButton
                                          label={property.label}
                                          value={colorPickerValue}
                                          className="h-11 w-12 shrink-0 cursor-pointer rounded-[14px] border border-slate-950/[0.08] bg-white p-1"
                                          onChange={(nextColor) => setStyleDrafts((current) => ({
                                            ...current,
                                            [property.property]: { mode: "custom", value: nextColor },
                                          }))}
                                        />
                                      ) : null}
                                      <CustomStyleControl
                                        property={property}
                                        value={draft.value}
                                        onChange={(nextValue) => setStyleDrafts((current) => ({
                                          ...current,
                                          [property.property]: { mode: "custom", value: nextValue },
                                        }))}
                                      />
                                    </div>
                                    <div className="rounded-[12px] bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                                      This will save as a local override for this element only.
                                    </div>
                                  </div>
                                ) : null}

                                {draft.mode === "inherit" ? (
                                  <div className="rounded-[12px] bg-white px-3 py-2 text-xs leading-5 text-slate-500">
                                    Removes the inline override. The rendered value will come from classes, inherited styles, or project tokens.
                                  </div>
                                ) : null}

                                {property.classBinding ? (
                                  <div className="truncate text-[11px] text-slate-400">
                                    Class source: {property.classBinding}
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
              {inspectedProperties.length === 0 ? (
                <div className="rounded-[20px] border border-slate-950/[0.08] bg-white px-4 py-6 text-center text-sm text-slate-500">
                  Reselect the element to inspect its live CSS sources.
                </div>
              ) : null}
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-950/[0.06] bg-white/95 px-4 py-3">
            <Button variant="outline" className="h-10 rounded-full px-4" onClick={() => onModeChange("selected")}>Back</Button>
            <Button className="h-10 rounded-full bg-slate-950 px-4 text-white hover:bg-slate-800 gap-2" disabled={disabled || isSaving} onClick={() => void saveDesign()}>
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Apply Changes
            </Button>
          </div>
        </div>
      ) : null}
    </aside>
  );
}

async function enqueueGeneration(input: {
  projectId: string;
  prompt: string;
  image?: PromptImagePayload | null;
  imageReferenceMode?: ImageReferenceMode;
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
  const [selectionNotice, setSelectionNotice] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectionVersion, setSelectionVersion] = useState(0);
  const [editSession, setEditSession] = useState<ElementEditSession | null>(null);
  const [pendingElementSelection, setPendingElementSelection] = useState<PendingElementSelection | null>(null);
  const [tokenDraft, setTokenDraft] = useState<DesignTokens | null>(() =>
    hasApprovedDesignTokens(initialProject.designTokens)
      ? normalizeDesignTokens(initialProject.designTokens)
      : null,
  );
  const [tokenDirty, setTokenDirty] = useState(false);
  const [tokenSaving, setTokenSaving] = useState(false);
  const tokenDirtyRef = useRef(tokenDirty);
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
  const selectedElementScreen = editSession?.screenId
    ? screens.find((screen) => screen.id === editSession.screenId) ?? null
    : null;
  const selectedElementTargetLabel = selectedElementInfo
    ? selectedElementInfo.targetType === "navigation"
      ? "Navigation"
      : selectedElementScreen?.name ?? selectedScreen?.name ?? "Screen"
    : null;
  const selectedElementCanEditText = Boolean(
    selectedElementInfo?.drawgleId &&
    (selectedElementInfo.editableMetadata?.textNodes?.length ?? 0) > 0,
  );
  const selectedElementCanEditDesign = Boolean(selectedElementInfo?.drawgleId);
  const mobilePromptReserve = 96;
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
    tokenDirtyRef.current = tokenDirty;
  }, [tokenDirty]);

  useEffect(() => {
    if (tokenDirtyRef.current) {
      return;
    }

    setTokenDraft(hasApprovedDesignTokens(project?.designTokens)
      ? normalizeDesignTokens(project?.designTokens)
      : null);
  }, [project?.designTokens]);

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
    if (!selectionMode && !editSession) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectionMode(false);
        setEditSession(null);
        setPendingElementSelection(null);
        setSelectionNotice(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editSession, selectionMode]);

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
    imageReferenceMode?: ImageReferenceMode;
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
        imageReferenceMode: input.imageReferenceMode ?? "recreate",
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
    imageReferenceMode?: ImageReferenceMode;
    clientTurnId?: string;
  }) => {
    if (!project || isCanvasInteractionLocked) {
      return false;
    }

    const prompt = options.prompt.trim();
    if (!prompt && !options.image) {
      return false;
    }

    const activeEditScreenId = editSession?.element.targetType === "navigation"
      ? null
      : editSession?.screenId ?? selectedScreen?.id ?? null;
    const activeEditElement = editSession?.element ?? null;
    const activeSelectionTargetLabel = activeEditElement
      ? activeEditElement.targetType === "navigation"
        ? "Navigation"
        : selectedElementScreen?.name ?? selectedScreen?.name ?? "Screen"
      : null;
    setQueueError(null);
    if (!activeEditElement) {
      setSelectionNotice(null);
    }

    if (activeEditElement && !activeEditElement.drawgleId) {
      setSelectionNotice("I lost the selected element identity. Please reselect the exact element and try again.");
      setEditSession(null);
      return false;
    }

    try {
      const agentRes = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          prompt,
          image: options.image ?? null,
          imageReferenceMode: options.imageReferenceMode ?? "recreate",
          selectedScreenId: activeEditScreenId,
          focusedScreenId: selectedScreen?.id ?? null,
          selectedElementHtml: activeEditElement?.outerHTML ?? null,
          selectedElementDrawgleId: activeEditElement?.drawgleId ?? null,
          selectedElementTarget: activeEditElement?.targetType ?? null,
          selectedElementPreview: activeEditElement?.textPreview ?? null,
          selectedElementImageTargets: activeEditElement?.editableMetadata?.imageTargets ?? [],
          selectedElementSelectionVersion: editSession?.selectionVersion ?? null,
          activeSelection: activeEditElement
            ? {
                present: true,
                screenId: activeEditScreenId,
                drawgleId: activeEditElement.drawgleId,
                targetType: activeEditElement.targetType,
                targetLabel: activeSelectionTargetLabel,
                textPreview: activeEditElement.textPreview,
                outerHTML: activeEditElement.outerHTML,
                selectionVersion: editSession?.selectionVersion ?? null,
                freshness: editSession?.freshness ?? "fresh",
              }
            : {
                present: false,
                screenId: null,
                drawgleId: null,
                targetType: null,
                targetLabel: null,
                textPreview: null,
                outerHTML: null,
                selectionVersion: null,
                freshness: null,
              },
          clientTurnId: options.clientTurnId ?? null,
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
        if (payload.deterministic) {
          await refreshScreens();
        }
        setEditSession((currentSession) =>
          currentSession ? { ...currentSession, mode: "selected" } : currentSession,
        );
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

  const handleApproveScreenPlan = async (proposalMessageId: string) => {
    if (!project || isCanvasInteractionLocked) {
      return;
    }

    setQueueError(null);
    setIsQueueingGeneration(true);

    try {
      const response = await fetch("/api/agent/screen-plan/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          proposalMessageId,
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 409 && payload.activeGenerationRunId) {
          setPendingQueuedRunId(payload.activeGenerationRunId);
          setQueueError(payload.error ?? "A generation is already queued or building for this project.");
          await refreshGenerationRuns();
          return;
        }

        throw new Error(payload.error ?? "Drawgle could not approve that screen plan.");
      }

      if (payload.generationRunId) {
        setPendingQueuedRunId(payload.generationRunId);
        setPendingAddScreenRunId(payload.generationRunId);
        addScreenRefreshAttemptedRunIdRef.current = null;
      }

      await refreshGenerationRuns();
    } catch (error) {
      console.error("Screen plan approval error:", error);
      setQueueError(error instanceof Error ? error.message : "Failed to approve screen plan.");
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

  const handleReplaceSelectedImage = async (target: DrawgleImageTargetMeta, file: File) => {
    if (!project || !editSession?.element.drawgleId) {
      return false;
    }

    const formData = new FormData();
    formData.set("projectId", project.id);
    if (editSession.screenId) {
      formData.set("screenId", editSession.screenId);
    }
    formData.set("targetKind", target.kind);
    formData.set("targetDrawgleId", target.drawgleId);
    const uploadFile = await prepareReplacementImageFile(file);
    formData.set("file", uploadFile);

    const response = await fetch("/api/user-image-assets", {
      method: "POST",
      body: formData,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error ?? "Failed to upload replacement image.");
    }

    return await handleDeterministicElementEdit([{
      type: "replaceImage",
      drawgleId: target.drawgleId,
      mode: replaceModeForImageTarget(target.kind),
      src: payload.url,
      alt: target.alt || target.label || "Project image",
      targetIndex: target.targetIndex ?? null,
    }]);
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
    setPendingElementSelection(null);
    setSelectionNotice(null);
  };

  const handleToggleSelectionMode = () => {
    setSelectionNotice(null);
    setPendingElementSelection(null);

    if (selectionMode) {
      setSelectionMode(false);
      setEditSession(null);
      return;
    }

    setSelectionMode(true);
  };

  const commitElementSelection = (info: SelectedElementInfo) => {
    const ownerScreen = screens.find((screen) => screen.id === info.screenId) ?? null;
    const nextSelectionVersion = selectionVersion + 1;

    setSelectionNotice(null);
    setSelectionVersion(nextSelectionVersion);
    setSelectedScreen(ownerScreen);
    setEditSession({
      screenId: info.screenId,
      element: info,
      mode: "selected",
      selectedAt: new Date().toISOString(),
      selectionVersion: nextSelectionVersion,
      freshness: "fresh",
    });
  };

  const handleElementSelected = (info: SelectedElementInfo) => {
    if (info.selectionReason === "rehydrated") {
      setEditSession((currentSession) => {
        if (
          !currentSession ||
          currentSession.screenId !== info.screenId ||
          currentSession.element.drawgleId !== info.drawgleId
        ) {
          return currentSession;
        }

        return {
          ...currentSession,
          element: info,
          freshness: "fresh",
        };
      });
      setSelectionNotice(null);
      return;
    }

    if (
      editSession &&
      editSession.mode !== "selected" &&
      (editSession.screenId !== info.screenId || editSession.element.drawgleId !== info.drawgleId)
    ) {
      setPendingElementSelection({ info });
      return;
    }

    commitElementSelection(info);
  };

  const handleElementSelectionLost = (info: { screenId: string; drawgleId: string; reason?: ElementSelectionLostReason }) => {
    if (
      editSession &&
      editSession.screenId === info.screenId &&
      editSession.element.drawgleId === info.drawgleId
    ) {
      if (info.reason === "rehydrate_failed") {
        setSelectionNotice("The selected element is being verified from the saved screen before the next edit.");
        setEditSession((currentSession) =>
          currentSession &&
          currentSession.screenId === info.screenId &&
          currentSession.element.drawgleId === info.drawgleId
            ? { ...currentSession, freshness: "stale" }
            : currentSession,
        );
        return;
      }

      setSelectionNotice("The selected element changed after the canvas refreshed. Please reselect it before asking for another selected edit.");
      setEditSession(null);
    }
  };

  const handleCanvasSelectScreen = (screen: ScreenData | null) => {
    if (!screen && editSession) {
      return;
    }

    setSelectedScreen(screen);

    if (!screen) {
      return;
    }

    if (editSession?.screenId && editSession.screenId !== screen.id) {
      setEditSession(null);
    }
  };

  const setEditSessionMode = (mode: ManualEditMode) => {
    setEditSession((currentSession) => currentSession ? { ...currentSession, mode } : currentSession);
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
        <div className="absolute left-4 top-[calc(env(safe-area-inset-top,0px)+1rem)] z-50 flex items-center gap-2">
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
            onElementSelected={handleElementSelected}
            onElementSelectionLost={handleElementSelectionLost}
          />

          <Dialog
            open={Boolean(pendingElementSelection)}
            onOpenChange={(open) => {
              if (!open) {
                setPendingElementSelection(null);
              }
            }}
          >
            <DialogContent
              showCloseButton={false}
              className="w-[min(420px,calc(100vw-2rem))] gap-0 overflow-hidden rounded-[24px] border border-slate-950/[0.08] bg-white p-0 shadow-[0_24px_90px_rgba(15,23,42,0.22)]"
            >
              <DialogHeader className="gap-2 px-5 pb-3 pt-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-amber-700">
                  <Palette className="h-4 w-4" />
                </div>
                <DialogTitle className="text-lg font-semibold tracking-[-0.01em] text-slate-950">
                  Discard Element Overrides?
                </DialogTitle>
                <DialogDescription className="text-sm leading-6 text-slate-600">
                  You have an open manual editing panel. Discard those unsaved changes and retarget the new selected element?
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="mx-0 mb-0 flex-row justify-end gap-2 rounded-none border-t border-slate-950/[0.08] bg-slate-50/80 px-5 py-4">
                <Button
                  variant="outline"
                  className="h-10 rounded-full px-4"
                  onClick={() => setPendingElementSelection(null)}
                >
                  Keep Editing
                </Button>
                <Button
                  className="h-10 rounded-full bg-slate-950 px-4 text-white hover:bg-slate-800"
                  onClick={() => {
                    const nextSelection = pendingElementSelection?.info;
                    setPendingElementSelection(null);
                    if (nextSelection) {
                      commitElementSelection(nextSelection);
                    }
                  }}
                >
                  Discard & Select
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <ChatPanel
            project={project}
            screens={screens}
            selectedScreen={selectedScreen}
            generationRun={generationRun}
            generationRuns={generationRuns}
            projectNavigation={projectNavigation}
            tokenDraft={tokenDraft}
            tokenDirty={tokenDirty}
            tokenSaving={tokenSaving}
            generationActive={isGenerationActive}
            onTokenDraftChange={handleTokenDraftChange}
            onSaveTokens={handleSaveTokenDraft}
            onDiscardTokens={handleDiscardTokenDraft}
            isQueueing={isQueueingGeneration || Boolean(pendingQueuedRunId)}
            queueError={queueError ?? selectionNotice}
            retryDisabled={isCanvasInteractionLocked}
            isBuilding={isQueueingGeneration}
            onRetryGeneration={handleRetryGeneration}
            onApproveScreenPlan={handleApproveScreenPlan}
            isCollapsed={isChatCollapsed}
            onCollapseChange={setIsChatCollapsed}
            onSubmit={handlePromptAction}
            disabled={isCanvasInteractionLocked}
            selectionMode={selectionMode}
            onToggleSelectionMode={handleToggleSelectionMode}
            onClearSelectedScreen={() => {
              setSelectedScreen(null);
              setEditSession(null);
              setSelectionNotice(null);
            }}
            onDeleteSelectedScreen={handleDeleteSelectedScreen}
            selectedElementPreview={selectedElementInfo?.editableMetadata?.tagName ?? null}
            selectedElementTargetLabel={selectedElementTargetLabel}
            selectedElementCanEditText={selectedElementCanEditText}
            selectedElementCanEditDesign={selectedElementCanEditDesign}
            onEditSelectedText={() => setEditSessionMode("design")}
            onEditSelectedDesign={() => setEditSessionMode("design")}
            onClearSelectedElement={clearEditSession}
          />

          {editSession && editSession.mode !== "selected" ? (
            <SelectedElementInspectorSidebar
              key={`${editSession.element.targetType}:${editSession.element.drawgleId ?? editSession.element.breadcrumb}:${editSession.mode}:${editSession.selectedAt}`}
              project={project}
              selectedScreen={selectedElementScreen ?? selectedScreen}
              selectedElementInfo={editSession.element}
              mode={editSession.mode}
              disabled={isCanvasInteractionLocked}
              onModeChange={setEditSessionMode}
              onClose={clearEditSession}
              onApplyOperations={handleDeterministicElementEdit}
              onReplaceImage={handleReplaceSelectedImage}
            />
          ) : null}

          <CanvasToolDock
            selectionMode={selectionMode}
            hasSelectedElement={Boolean(selectedElementInfo)}
            selectedElementCanEditText={selectedElementCanEditText}
            selectedElementCanEditDesign={selectedElementCanEditDesign}
            disabled={isCanvasInteractionLocked}
            isChatCollapsed={isChatCollapsed}
            onToggleSelectionMode={handleToggleSelectionMode}
            onEditSelectedText={() => setEditSessionMode("design")}
            onEditSelectedDesign={() => setEditSessionMode("design")}
            onClearSelectedElement={clearEditSession}
          />
        </div>
      </main>
    </div>
  );
}
