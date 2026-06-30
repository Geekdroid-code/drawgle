"use client";

import { type CSSProperties, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Sparkles, Check, ChevronDown, ImageIcon, Loader2, Palette, RotateCcw, Upload, X, HelpCircle, Megaphone, Play, Share2, LogOut, FolderSync, CircleDollarSign, User, CreditCard, Download, Mail, MessageCircle, Trash } from "lucide-react";

import { AnimatedThemeToggle } from "@/components/AnimatedThemeToggle";
import { CanvasStage } from "@/components/CanvasArea";
import { ExportMenu } from "@/components/ExportMenu";
import { ProjectCanvasLoading } from "@/components/ProjectCanvasLoading";
import { ChatPanel } from "@/components/ChatPanel";
import { ColorPickerButton } from "@/components/DesignSystemEditor";
import type { ElementSelectionLostReason, SelectedElementInfo, SelectedElementPreviewPayload } from "@/components/ScreenNode";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useCredits } from "@/hooks/useCredits";
import { PricingDialog } from "@/components/PricingDialog";
import { PremiumDropdown } from "@/components/ui/premium-dropdown";
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
  type DrawgleStyleValueMap,
  type DrawgleTokenReferenceLike,
} from "@/lib/element-style-inspection";
import { useGenerationRuns } from "@/hooks/use-generation-runs";
import { useProject } from "@/hooks/use-project";
import { useProjectNavigation } from "@/hooks/use-project-navigation";
import { useScreens } from "@/hooks/use-screens";
import { hasApprovedDesignTokens, normalizeDesignTokens } from "@/lib/design-tokens";
import { createClient } from "@/lib/supabase/client";
import { deleteScreen, insertProjectMessage, updateProjectFields } from "@/lib/supabase/queries";
import { getDrawgleTokenReferences, buildDrawgleTokenCss, buildGoogleFontAssetLinks } from "@/lib/token-runtime";
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
import type { CanvasTool } from "@/lib/canvas-interactions";

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
  Position: {
    title: "Position",
    description: "Placement, stacking, and overflow.",
  },
  Layout: {
    title: "Layout",
    description: "Display mode and child alignment.",
  },
  Size: {
    title: "Size",
    description: "Fill, hug, fixed dimensions, and media fitting.",
  },
  Spacing: {
    title: "Spacing",
    description: "Padding and margin around the element.",
  },
  Type: {
    title: "Type",
    description: "Text styling for this selected element.",
  },
  Surface: {
    title: "Surface",
    description: "Fill, border, and corner styling.",
  },
  Effects: {
    title: "Effects",
    description: "Shadow, opacity, transforms, and filters.",
  },
};
type StyleDraft =
  | { mode: "inherit"; value: "" }
  | { mode: "token"; value: string }
  | { mode: "custom"; value: string };

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
    <div className="flex min-w-0 w-full items-center overflow-hidden rounded-[10px] border border-slate-950/[0.08] bg-white shadow-none focus-within:ring-2 focus-within:ring-ring/40">
      <button
        type="button"
        className="flex h-9 w-8 shrink-0 items-center justify-center rounded-l-[10px] text-slate-500 hover:bg-slate-50 hover:text-slate-950"
        onClick={() => commit(String(Math.max(0, Number((amount - step).toFixed(2)))), parsed.unit)}
      >
        -
      </button>
      <input
        type="number"
        step={step}
        value={parsed.amount}
        onChange={(event) => commit(event.target.value)}
        className="h-9 min-w-0 flex-1 border-x border-slate-950/[0.06] bg-transparent px-2 text-sm outline-none"
      />
      <select
        value={parsed.unit}
        onChange={(event) => commit(parsed.amount, event.target.value)}
        className="h-9 w-14 shrink-0 bg-transparent px-1.5 text-xs font-medium text-slate-500 outline-none"
      >
        {units.map((unit) => (
          <option key={unit || "unitless"} value={unit}>
            {unit || "unit"}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="flex h-9 w-8 shrink-0 items-center justify-center rounded-r-[10px] text-slate-500 hover:bg-slate-50 hover:text-slate-950"
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
        className="h-9 min-w-0 w-full rounded-[10px] border border-slate-950/[0.08] bg-white px-3 text-sm shadow-none outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
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
      <div className="grid gap-2 rounded-[10px] border border-slate-950/[0.08] bg-white px-3 py-2">
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
      className="h-9 min-w-0 w-full rounded-[10px] border-slate-950/[0.08] bg-white px-3 text-sm shadow-none focus-visible:bg-white"
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
  const isColorTokenProperty = property === "color" || property === "background-color" || property === "border-color";

  if (pickerTokens.length === 0) {
    return null;
  }

  return (
    <Popover>
      <PopoverTrigger
        render={(
          <button
            type="button"
            className="flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-[10px] border border-[var(--dg-border)] bg-[var(--dg-surface-muted)] px-2.5 text-left text-xs font-medium text-[var(--dg-text)] transition hover:border-[var(--dg-border-strong)] hover:bg-[var(--dg-surface)] dark:border-white/[0.08] dark:bg-[#1b1b1b] dark:text-[#e8eaf0] dark:hover:bg-[#2a2a2a]"
          />
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          {isColorTokenProperty ? (
            <span
              className="h-4 w-4 shrink-0 rounded-[5px] border border-[var(--dg-border-strong)] dark:border-white/[0.16]"
              style={{ backgroundColor: activeToken?.value ?? "#ffffff" }}
            />
          ) : (
            <span className="flex h-4 w-5 shrink-0 items-center justify-center rounded-[5px] border border-[var(--dg-border-strong)] bg-white text-[8px] font-bold uppercase text-[var(--dg-text-muted)] dark:border-white/[0.16] dark:bg-white/[0.06]">
              T
            </span>
          )}
          <span className="truncate">
            {activeToken ? activeToken.label : getTokenPickerLabel(property)}
          </span>
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[var(--dg-text-muted)]" />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={8}
        className="dg-token-popover w-[min(280px,calc(100vw-2rem))] rounded-[14px] border border-[var(--dg-border)] bg-[var(--dg-surface)] p-2 text-[var(--dg-text)] shadow-[0_20px_70px_rgba(15,23,42,0.2)] dark:border-white/[0.08] dark:bg-[#1b1b1b] dark:shadow-[0_20px_70px_rgba(0,0,0,0.58)]"
      >
        <div className="px-2 pb-1 pt-1">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#667894]">Project Tokens</div>
          <div className="mt-0.5 text-xs leading-5 text-[var(--dg-text-muted)]">{getTokenPickerDescription(property)}</div>
        </div>
        <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
          {pickerTokens.map((token) => (
            <button
              key={token.name}
              type="button"
              className="flex w-full items-center gap-3 rounded-[14px] px-2 py-2 text-left text-[var(--dg-text)] transition hover:bg-[var(--dg-surface-muted)] dark:hover:bg-white/[0.06]"
              onClick={() => onSelect(token.name)}
            >
              {isColorTokenProperty ? (
                <span
                  className="h-7 w-7 shrink-0 rounded-[7px] border border-[var(--dg-border-strong)] dark:border-white/[0.12]"
                  style={{ backgroundColor: token.value }}
                />
              ) : (
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] border border-[var(--dg-border-strong)] bg-[var(--dg-surface-muted)] font-mono text-[9px] font-bold text-[var(--dg-text-muted)] dark:border-white/[0.12] dark:bg-white/[0.06]">
                  var
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-[var(--dg-text)]">{token.label}</span>
                <span className="block truncate text-[11px] text-[var(--dg-text-muted)]">{token.value}</span>
              </span>
              {activeTokenName === token.name ? (
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] bg-slate-950 text-white">
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
  disabled,
  onClose,
  onApplyOperations,
  onPreviewChange,
  onAskAiRefine,
  onReplaceImage,
  onDelete,
}: {
  project: ProjectData;
  selectedScreen: ScreenData | null;
  selectedElementInfo: SelectedElementInfo | null;
  disabled: boolean;
  onClose: () => void;
  onApplyOperations: (operations: DeterministicEditOperation[]) => Promise<boolean>;
  onPreviewChange?: (preview: SelectedElementPreviewPayload | null) => void;
  onAskAiRefine?: (intent: string) => void | Promise<void>;
  onReplaceImage: (target: DrawgleImageTargetMeta, file: File) => Promise<boolean>;
  onDelete?: () => void | Promise<void>;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [uploadingImageTargetId, setUploadingImageTargetId] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const pendingImageTargetRef = useRef<DrawgleImageTargetMeta | null>(null);

  const textNodes = selectedElementInfo?.editableMetadata?.textNodes ?? EMPTY_TEXT_NODES;
  const imageTargets = selectedElementInfo?.editableMetadata?.imageTargets ?? [];
  const layoutContext = selectedElementInfo?.editableMetadata?.layoutContext ?? null;
  const riskFlags = selectedElementInfo?.editableMetadata?.riskFlags ?? null;
  const tokenRefs = useMemo(
    () => getDrawgleTokenReferences(project.designTokens),
    [project.designTokens],
  );
  const styleInspection = useMemo(
    () => resolveStyleInspection(selectedElementInfo?.editableMetadata?.styleInspection ?? null, tokenRefs),
    [selectedElementInfo?.editableMetadata?.styleInspection, tokenRefs],
  );
  const inspectedProperties = styleInspection?.properties ?? EMPTY_INSPECTED_PROPERTIES;
  const classListKey = styleInspection?.classList.join(" ") ?? "";
  const originalTextById = useMemo(
    () => Object.fromEntries(textNodes.map((node) => [node.drawgleId, node.text])),
    [textNodes],
  );

  const [textDrafts, setTextDrafts] = useState<Record<string, string>>(() => originalTextById);
  const [styleDrafts, setStyleDrafts] = useState<Partial<Record<DrawgleStyleProperty, StyleDraft>>>(() =>
    buildInitialStyleDrafts(inspectedProperties),
  );
  const [classDraft, setClassDraft] = useState(classListKey);
  const [advancedDetailsOpen, setAdvancedDetailsOpen] = useState(false);

  const normalizeClassNames = useCallback((className: string) => className.trim().replace(/\s+/g, " "), []);


  useEffect(() => {
    if (!onPreviewChange) return;
    if (!selectedElementInfo?.drawgleId) {
      onPreviewChange(null);
      return;
    }

    const styles: DrawgleStyleValueMap = {};
    let hasStylePreview = false;

    inspectedProperties.forEach((property) => {
      const draft = styleDrafts[property.property] ?? initialDraftForProperty(property);
      const initialDraft = initialDraftForProperty(property);
      const draftValue = normalizeCssValue(draft.value);
      const initialValue = normalizeCssValue(initialDraft.value);
      if (draft.mode === initialDraft.mode && draftValue === initialValue) {
        return;
      }

      if (draft.mode === "inherit") {
        if (normalizeCssValue(property.inlineValue)) {
          styles[property.property] = "";
          hasStylePreview = true;
        }
        return;
      }

      const nextValue = draft.mode === "token" ? `var(${draft.value})` : normalizeCssValue(draft.value);
      if (!nextValue) return;
      styles[property.property] = nextValue;
      hasStylePreview = true;
    });

    const normalizedClassDraft = normalizeClassNames(classDraft);
    const normalizedOriginalClass = normalizeClassNames(classListKey);
    const classChanged = normalizedClassDraft !== normalizedOriginalClass;

    if (!hasStylePreview && !classChanged) {
      onPreviewChange(null);
      return;
    }

    onPreviewChange({
      drawgleId: selectedElementInfo.drawgleId,
      styles,
      className: classChanged ? normalizedClassDraft : null,
    });
  }, [classDraft, classListKey, inspectedProperties, normalizeClassNames, onPreviewChange, selectedElementInfo?.drawgleId, styleDrafts]);

  useEffect(() => () => onPreviewChange?.(null), [onPreviewChange]);

  const applyOperations = async (operations: DeterministicEditOperation[]) => {
    if (operations.length === 0) {
      return false;
    }

    setIsSaving(true);
    try {
      const saved = await onApplyOperations(operations);
      if (saved) {
        onPreviewChange?.(null);
      }
      return saved;
    } finally {
      setIsSaving(false);
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

  const buildStyleOperations = () => {
    const operations: DeterministicEditOperation[] = [];
    const normalizedClassDraft = normalizeClassNames(classDraft);
    const normalizedOriginalClass = normalizeClassNames(classListKey);

    if (normalizedClassDraft !== normalizedOriginalClass) {
      operations.push({ type: "replaceClassList", className: normalizedClassDraft });
    }

    inspectedProperties.forEach((property) => {
      const draft = styleDrafts[property.property] ?? initialDraftForProperty(property);
      const initialDraft = initialDraftForProperty(property);
      const draftValue = normalizeCssValue(draft.value);
      const initialValue = normalizeCssValue(initialDraft.value);
      const currentInlineValue = normalizeCssValue(property.inlineValue);

      if (draft.mode === initialDraft.mode && draftValue === initialValue) {
        return;
      }

      if (draft.mode === "inherit") {
        if (currentInlineValue) {
          operations.push({ type: "clearStyle", property: property.property });
        }
        return;
      }

      const nextValue = draft.mode === "token"
        ? `var(${draft.value})`
        : normalizeCssValue(draft.value);
      if (!nextValue || currentInlineValue === nextValue) {
        return;
      }

      operations.push({ type: "setStyle", property: property.property, value: nextValue });
    });

    return operations;
  };

  const saveDesign = async () => {
    await applyOperations([...buildTextOperations(), ...buildStyleOperations()]);
  };

  const resetAllLocalOverrides = async () => {
    setStyleDrafts(buildInitialStyleDrafts(inspectedProperties));
    setClassDraft(classListKey);

    const operations = inspectedProperties
      .filter((property) => normalizeCssValue(property.inlineValue))
      .map((property): DeterministicEditOperation => ({
        type: "clearStyle",
        property: property.property,
      }));

    await applyOperations(operations);
  };

  const hasDraftChanges = useMemo(() => {
    const classChanged = normalizeClassNames(classDraft) !== normalizeClassNames(classListKey);
    const textChanged = textNodes.some((node) => textDrafts[node.drawgleId] !== undefined && textDrafts[node.drawgleId] !== node.text);
    const styleChanged = inspectedProperties.some((property) => {
      const draft = styleDrafts[property.property] ?? initialDraftForProperty(property);
      const initialDraft = initialDraftForProperty(property);
      return draft.mode !== initialDraft.mode || normalizeCssValue(draft.value) !== normalizeCssValue(initialDraft.value);
    });
    return classChanged || textChanged || styleChanged;
  }, [classDraft, classListKey, inspectedProperties, normalizeClassNames, styleDrafts, textDrafts, textNodes]);

  const targetLabel = selectedElementInfo?.targetType === "navigation" ? "Navigation" : selectedScreen?.name ?? "Screen";
  const riskMessages = [
    riskFlags?.isNavigationRoot ? "Navigation root" : null,
    riskFlags?.isRootLike ? "Root layout" : null,
    riskFlags?.affectsManyChildren ? "Many children" : null,
    riskFlags?.absolutePositioned ? "Positioned element" : null,
  ].filter(Boolean);

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
      await onReplaceImage(target, file);
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

  const updateStyleDraft = (property: DrawgleResolvedStyleProperty, draft: StyleDraft) => {
    setStyleDrafts((current) => ({ ...current, [property.property]: draft }));
  };

  const resetPropertyDraft = (property: DrawgleResolvedStyleProperty) => {
    setStyleDrafts((current) => ({ ...current, [property.property]: { mode: "inherit", value: "" } }));
  };

  const propertyByName = (propertyName: DrawgleStyleProperty) =>
    inspectedProperties.find((property) => property.property === propertyName) ?? null;

  const getPropertyDraftValue = (property: DrawgleResolvedStyleProperty) => {
    const draft = styleDrafts[property.property] ?? initialDraftForProperty(property);
    if (draft.mode === "token") return property.computedValue || `var(${draft.value})`;
    if (draft.mode === "custom") return draft.value;
    return property.inlineValue || property.computedValue || "";
  };

  const renderSourceBadges = (property: DrawgleResolvedStyleProperty) => {
    const draft = styleDrafts[property.property] ?? initialDraftForProperty(property);
    const isTokenLinked = draft.mode === "token" || property.status === "linked";
    const isLocal = draft.mode === "custom" || property.source === "inline-custom";

    return (
      <div className="flex shrink-0 items-center gap-1">
        {isTokenLinked ? <span className="rounded-full bg-teal-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-teal-700">Token</span> : null}
        {isLocal ? <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-amber-700">Local</span> : null}
      </div>
    );
  };

  const renderResetButton = (property: DrawgleResolvedStyleProperty) => (
    <button
      type="button"
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] text-slate-400 hover:bg-slate-100 hover:text-slate-900"
      onClick={() => resetPropertyDraft(property)}
      title={`Reset ${property.label}`}
    >
      <RotateCcw className="h-3.5 w-3.5" />
    </button>
  );

  const renderSegmentControl = (
    propertyName: DrawgleStyleProperty,
    values: string[],
    labels?: Record<string, string>,
    columns = Math.min(values.length, 4),
  ) => {
    const property = propertyByName(propertyName);
    if (!property) return null;
    const draft = styleDrafts[property.property] ?? initialDraftForProperty(property);
    const currentValue = normalizeCssValue(draft.mode === "custom" ? draft.value : property.computedValue);

    return (
      <div className="grid min-w-0 gap-1.5 rounded-[10px] border border-slate-950/[0.07] bg-white p-2 shadow-[0_1px_0_rgba(15,23,42,0.03)]">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <span className="min-w-0 truncate text-[11px] font-semibold text-slate-600">{property.label}</span>
          <div className="flex items-center gap-1">
            {renderSourceBadges(property)}
            {renderResetButton(property)}
          </div>
        </div>
        <div className="grid min-w-0 rounded-[9px] bg-slate-100 p-1" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {values.map((value) => {
            const active = currentValue === value;
            return (
              <button
                key={value}
                type="button"
                className={`min-h-8 truncate rounded-[7px] px-2 text-[11px] font-semibold transition ${active ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:bg-white/70 hover:text-slate-900"}`}
                onClick={() => updateStyleDraft(property, { mode: "custom", value })}
              >
                {labels?.[value] ?? value}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderValueRow = (
    propertyName: DrawgleStyleProperty,
    options: { label?: string; token?: boolean; color?: boolean } = {},
  ) => {
    const property = propertyByName(propertyName);
    if (!property) return null;
    const draft = styleDrafts[property.property] ?? initialDraftForProperty(property);
    const value = getPropertyDraftValue(property);
    const tokenOptions = getTokenReferencesForStyleProperty(property.property, tokenRefs);
    const allowTokenPicker = options.token !== false && tokenOptions.length > 0;
    const activeTokenName = draft.mode === "token" ? draft.value : property.tokenName;
    const colorPickerValue = tokenOptions.find((token) => token.name === activeTokenName)?.value ?? cssColorToHex(value);

    return (
      <div key={property.property} className="min-w-0 overflow-hidden rounded-[10px] border border-slate-950/[0.07] bg-white p-2 shadow-[0_1px_0_rgba(15,23,42,0.03)]">
        <div className="mb-2 flex min-w-0 items-center justify-between gap-2">
          <span className="min-w-0 truncate text-[11px] font-semibold text-slate-700">{options.label ?? property.label}</span>
          <div className="flex shrink-0 items-center gap-1">
            {renderSourceBadges(property)}
            {renderResetButton(property)}
          </div>
        </div>
        <div className="grid min-w-0 gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {property.valueKind === "color" ? (
              <ColorPickerButton
                label={property.label}
                value={colorPickerValue}
                className="h-9 w-10 shrink-0 cursor-pointer rounded-[9px] border border-slate-950/[0.08] bg-white p-1"
                onChange={(nextColor) => updateStyleDraft(property, { mode: "custom", value: nextColor })}
              />
            ) : null}
            <CustomStyleControl
              property={property}
              value={value}
              onChange={(nextValue) => updateStyleDraft(property, { mode: "custom", value: nextValue })}
            />
          </div>
          {allowTokenPicker ? (
            <div className="min-w-0">
              <TokenValuePicker
                tokens={tokenRefs}
                property={property.property}
                value={activeTokenName ?? null}
                onSelect={(tokenName) => updateStyleDraft(property, { mode: "token", value: tokenName })}
              />
            </div>
          ) : null}
        </div>
        <div className="mt-1.5 flex min-w-0 items-center justify-between gap-2 text-[10px] text-slate-400">
          <span className="min-w-0 truncate">{draftDisplayValue(draft, property)}</span>
          {property.classBinding ? <span className="min-w-0 truncate font-mono">{property.classBinding}</span> : null}
        </div>
      </div>
    );
  };

  const renderCompactBoxInput = (propertyName: DrawgleStyleProperty, label: string) => {
    const property = propertyByName(propertyName);
    if (!property) return <div />;
    const draft = styleDrafts[property.property] ?? initialDraftForProperty(property);
    const value = getPropertyDraftValue(property);
    const tokenOptions = getTokenReferencesForStyleProperty(property.property, tokenRefs);
    const activeTokenName = draft.mode === "token" ? draft.value : property.tokenName;

    return (
      <div key={property.property} className="grid min-w-0 gap-1 rounded-[8px] border border-slate-950/[0.07] bg-white px-2 py-1.5">
        <span className="truncate text-[9px] font-semibold uppercase text-slate-400">{label}</span>
        <Input
          value={value}
          onChange={(event) => updateStyleDraft(property, { mode: "custom", value: event.target.value })}
          className="h-8 min-w-0 rounded-[7px] border-0 bg-slate-50 px-1.5 text-center text-[11px] font-semibold shadow-none focus-visible:ring-1"
        />
        {tokenOptions.length > 0 ? (
          <TokenValuePicker
            tokens={tokenRefs}
            property={property.property}
            value={activeTokenName ?? null}
            onSelect={(tokenName) => updateStyleDraft(property, { mode: "token", value: tokenName })}
          />
        ) : null}
      </div>
    );
  };

  const renderBoxGroup = (
    title: string,
    top: DrawgleStyleProperty,
    right: DrawgleStyleProperty,
    bottom: DrawgleStyleProperty,
    left: DrawgleStyleProperty,
  ) => (
    <div className="min-w-0 overflow-hidden rounded-[10px] border border-slate-950/[0.07] bg-slate-50 p-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-[11px] font-bold text-slate-700">{title}</div>
        <div className="text-[10px] font-medium text-slate-400">Top / Right / Bottom / Left</div>
      </div>
      <div className="grid min-w-0 grid-cols-2 gap-2">
        {renderCompactBoxInput(top, "Top")}
        {renderCompactBoxInput(right, "Right")}
        {renderCompactBoxInput(bottom, "Bottom")}
        {renderCompactBoxInput(left, "Left")}
      </div>
    </div>
  );
  const renderSizeControl = (propertyName: DrawgleStyleProperty, label: string) => {
    const property = propertyByName(propertyName);
    if (!property) return null;
    const draft = styleDrafts[property.property] ?? initialDraftForProperty(property);
    const value = getPropertyDraftValue(property);
    const normalizedValue = normalizeCssValue(value);
    const sizeMode = normalizedValue === "100%" ? "fill" : normalizedValue === "auto" ? "hug" : "fixed";
    const tokenOptions = getTokenReferencesForStyleProperty(property.property, tokenRefs);
    const activeTokenName = draft.mode === "token" ? draft.value : property.tokenName;

    return (
      <div className="rounded-[12px] border border-slate-950/[0.07] bg-white p-2">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-slate-700">{label}</span>
          <div className="flex items-center gap-1">
            {renderSourceBadges(property)}
            {renderResetButton(property)}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1 rounded-[9px] bg-slate-100 p-1">
          {[
            ["fill", "Fill", "100%"],
            ["hug", "Hug", "auto"],
            ["fixed", "Fixed", normalizedValue && normalizedValue !== "auto" && normalizedValue !== "100%" ? normalizedValue : property.computedValue || "0px"],
          ].map(([mode, modeLabel, nextValue]) => (
            <button
              key={mode}
              type="button"
              className={`h-7 rounded-[7px] text-[10px] font-semibold ${sizeMode === mode ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:bg-white/70"}`}
              onClick={() => updateStyleDraft(property, { mode: "custom", value: nextValue })}
            >
              {modeLabel}
            </button>
          ))}
        </div>
        <Input
          value={value}
          onChange={(event) => updateStyleDraft(property, { mode: "custom", value: event.target.value })}
          className="mt-2 h-8 rounded-[8px] border-slate-950/[0.08] bg-slate-50 px-2 text-center text-xs font-semibold"
        />
        {tokenOptions.length > 0 ? (
          <div className="mt-2 min-w-0">
            <TokenValuePicker
              tokens={tokenRefs}
              property={property.property}
              value={activeTokenName ?? null}
              onSelect={(tokenName) => updateStyleDraft(property, { mode: "token", value: tokenName })}
            />
          </div>
        ) : null}
      </div>
    );
  };

  const renderSectionShell = (group: DrawgleStyleGroup, children: ReactNode, trailing?: ReactNode) => {
    if (!children) return null;
    return (
      <section key={group} className="border-b border-slate-950/[0.06] bg-white px-3 py-3">
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <div className="text-[13px] font-bold text-slate-950">{styleGroupMeta[group].title}</div>
          {trailing}
        </div>
        {children}
      </section>
    );
  };

  const renderPositionSection = () => renderSectionShell(
    "Position",
    <div className="grid gap-2">
      {renderSegmentControl("position", ["static", "relative", "absolute", "fixed"], { static: "Static", relative: "Rel", absolute: "Abs", fixed: "Fixed" }, 4)}
      <div className="grid grid-cols-1 gap-2">
        {renderValueRow("top")}
        {renderValueRow("right")}
        {renderValueRow("bottom")}
        {renderValueRow("left")}
      </div>
      <div className="grid grid-cols-1 gap-2">
        {renderValueRow("z-index", { label: "Layer" })}
        {renderSegmentControl("overflow", ["visible", "hidden", "auto", "scroll"], { visible: "Show", hidden: "Hide", auto: "Auto", scroll: "Scroll" }, 4)}
      </div>
    </div>,
    riskMessages.length ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Guarded</span> : null,
  );

  const renderLayoutSection = () => renderSectionShell(
    "Layout",
    <div className="grid gap-2">
      {renderSegmentControl("display", ["block", "flex", "grid", "inline-flex", "none"], { block: "Block", flex: "Flex", grid: "Grid", "inline-flex": "Inline", none: "None" }, 5)}
      <div className="grid grid-cols-1 gap-2">
        {renderSegmentControl("flex-direction", ["row", "column", "row-reverse", "column-reverse"], { row: "Row", column: "Col", "row-reverse": "Row R", "column-reverse": "Col R" }, 2)}
        {renderSegmentControl("flex-wrap", ["nowrap", "wrap", "wrap-reverse"], { nowrap: "No", wrap: "Wrap", "wrap-reverse": "Rev" }, 3)}
      </div>
      <div className="grid grid-cols-1 gap-2">
        {renderSegmentControl("justify-content", ["flex-start", "center", "flex-end", "space-between"], { "flex-start": "Start", center: "Center", "flex-end": "End", "space-between": "Between" }, 4)}
        {renderSegmentControl("align-items", ["stretch", "flex-start", "center", "flex-end"], { stretch: "Stretch", "flex-start": "Start", center: "Center", "flex-end": "End" }, 4)}
      </div>
      {renderSegmentControl("align-self", ["auto", "stretch", "flex-start", "center", "flex-end"], { auto: "Auto", stretch: "Stretch", "flex-start": "Start", center: "Center", "flex-end": "End" }, 5)}
      <div className="grid grid-cols-1 gap-2">
        {renderValueRow("gap")}
        {renderValueRow("grid-template-columns", { label: "Columns" })}
      </div>
      {renderValueRow("flex")}
    </div>,
  );

  const renderSizeSection = () => renderSectionShell(
    "Size",
    <div className="grid gap-2">
      <div className="grid grid-cols-1 gap-2">
        {renderSizeControl("width", "Width")}
        {renderSizeControl("height", "Height")}
      </div>
      <div className="grid grid-cols-1 gap-2">
        {renderValueRow("min-height", { label: "Min H" })}
        {renderValueRow("max-width", { label: "Max W" })}
      </div>
      <div className="grid grid-cols-1 gap-2">
        {renderValueRow("aspect-ratio", { label: "Aspect" })}
        {renderSegmentControl("object-fit", ["cover", "contain", "fill", "none"], { cover: "Cover", contain: "Contain", fill: "Fill", none: "None" }, 4)}
      </div>
    </div>,
  );

  const renderSpacingSection = () => renderSectionShell(
    "Spacing",
    <div className="grid gap-2">
      {renderBoxGroup("Padding", "padding-top", "padding-right", "padding-bottom", "padding-left")}
      {renderBoxGroup("Margin", "margin-top", "margin-right", "margin-bottom", "margin-left")}
    </div>,
  );

  const renderTypeSection = () => renderSectionShell(
    "Type",
    <div className="grid gap-2">
      <div className="grid grid-cols-1 gap-2">
        {renderValueRow("font-size")}
        {renderValueRow("font-weight")}
      </div>
      <div className="grid grid-cols-1 gap-2">
        {renderValueRow("line-height")}
        {renderValueRow("letter-spacing", { label: "Tracking" })}
      </div>
      {renderValueRow("font-family")}
      <div className="grid grid-cols-1 gap-2">
        {renderSegmentControl("text-align", ["left", "center", "right", "justify"], { left: "Left", center: "Center", right: "Right", justify: "Justify" }, 4)}
        {renderValueRow("color", { color: true, label: "Text" })}
      </div>
    </div>,
  );

  const renderSurfaceSection = () => renderSectionShell(
    "Surface",
    <div className="grid gap-2">
      <div className="grid grid-cols-1 gap-2">
        {renderValueRow("background-color", { color: true, label: "Fill" })}
        {renderValueRow("border-color", { color: true, label: "Border" })}
      </div>
      <div className="grid grid-cols-1 gap-2">
        {renderSegmentControl("border-style", ["none", "solid", "dashed", "dotted"], { none: "None", solid: "Solid", dashed: "Dash", dotted: "Dot" }, 4)}
        {renderValueRow("border-width", { label: "Border W" })}
      </div>
      {renderBoxGroup("Border", "border-top-width", "border-right-width", "border-bottom-width", "border-left-width")}
      {renderValueRow("border-radius", { label: "Radius" })}
      {renderBoxGroup("Radius", "border-top-left-radius", "border-top-right-radius", "border-bottom-right-radius", "border-bottom-left-radius")}
    </div>,
  );

  const renderEffectsSection = () => renderSectionShell(
    "Effects",
    <div className="grid gap-2">
      <div className="grid grid-cols-1 gap-2">
        {renderValueRow("opacity")}
        {renderValueRow("box-shadow", { label: "Shadow" })}
      </div>
      {renderValueRow("transform")}
      <div className="grid grid-cols-1 gap-2">
        {renderValueRow("filter")}
        {renderValueRow("backdrop-filter", { label: "Backdrop" })}
      </div>
    </div>,
  );

  const buildAiRefinePrompt = () => {
    const normalizedClassDraft = normalizeClassNames(classDraft);
    const changedStyles = inspectedProperties
      .map((property) => {
        const draft = styleDrafts[property.property] ?? initialDraftForProperty(property);
        const initialDraft = initialDraftForProperty(property);
        const changed = draft.mode !== initialDraft.mode || normalizeCssValue(draft.value) !== normalizeCssValue(initialDraft.value);
        if (!changed) return null;
        return `${property.property}: ${draft.mode === "inherit" ? "reset" : draftDisplayValue(draft, property)}`;
      })
      .filter(Boolean)
      .join("; ");

    return [
      `Refine the selected ${selectedElementInfo?.editableMetadata?.tagName ?? "element"} using the current visual editor draft.`,
      `Target: ${targetLabel} / ${selectedElementInfo?.breadcrumb || selectedElementInfo?.editableMetadata?.tagName || "element"}.`,
      `Parent layout: ${layoutContext?.parentDisplay ?? "unknown"}; children: ${layoutContext?.childrenCount ?? 0}; risk flags: ${riskMessages.join(", ") || "none"}.`,
      `Current classes: ${classListKey || "none"}.`,
      normalizedClassDraft !== normalizeClassNames(classListKey) ? `Draft classes: ${normalizedClassDraft || "none"}.` : null,
      changedStyles ? `Draft styles: ${changedStyles}.` : null,
      "Preserve project tokens, prefer Tailwind-compatible utilities, avoid unnecessary inline styles, and keep exported HTML production-safe.",
    ].filter(Boolean).join("\n");
  };

  if (!selectedElementInfo) {
    return (
      <aside
        data-canvas-obstacle="right"
        className="dg-visual-editor fixed bottom-[calc(var(--dg-mobile-prompt-bottom)+8.75rem)] left-3 right-3 top-auto z-[80] flex max-h-[min(72vh,660px)] flex-col overflow-hidden rounded-[18px] border border-slate-950/[0.08] bg-white/96 md:bottom-4 md:left-auto md:right-4 md:top-[calc(env(safe-area-inset-top,0px)+4.25rem)] md:max-h-none md:w-[min(420px,calc(100%-1rem))]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-950/[0.06] px-4 pb-3 pt-4">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#667894]">Visual Editor</div>
            <div className="mt-0.5 truncate text-sm font-medium text-slate-900">No Element Selected</div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-950" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center bg-slate-50/40 p-8 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-slate-100 bg-white text-slate-400 shadow-sm">
            <Palette className="h-5 w-5 text-slate-400" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900">Select an Element</h3>
          <p className="mt-1 max-w-[240px] text-xs leading-relaxed text-slate-500">
            Click a canvas element to inspect tokens, classes, layout, spacing, and code.
          </p>
        </div>
      </aside>
    );
  }

  return (
    <aside
      data-canvas-obstacle="right"
      className="dg-visual-editor fixed bottom-[calc(var(--dg-mobile-prompt-bottom)+8.75rem)] left-3 right-3 top-auto z-[80] flex max-h-[min(72vh,660px)] flex-col overflow-hidden rounded-[18px] border border-slate-950/[0.08] bg-white/96 shadow-[0_24px_90px_rgba(15,23,42,0.18)] backdrop-blur-xl md:bottom-4 md:left-auto md:right-4 md:top-[calc(env(safe-area-inset-top,0px)+4.25rem)] md:max-h-none md:w-[min(440px,calc(100%-1rem))]"
    >
      <div className="border-b border-slate-950/[0.06] bg-white px-3 pb-3 pt-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#667894]">Visual Editor</div>
            <div className="mt-0.5 truncate text-sm font-bold text-slate-950">
              {selectedElementInfo.textPreview || selectedElementInfo.editableMetadata?.tagName || "Element"}
            </div>
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] font-medium text-slate-500">
              <span>{targetLabel}</span>
              <span>/</span>
              <span className="truncate">{selectedElementInfo.breadcrumb || selectedElementInfo.editableMetadata?.tagName}</span>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-950" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="mt-3 flex min-w-0 flex-wrap items-center gap-1.5 text-[10px] font-semibold text-slate-500">
          <span className="rounded-[7px] border border-slate-950/[0.06] bg-slate-50 px-2 py-1">{styleInspection?.tagName ?? selectedElementInfo.editableMetadata?.tagName ?? "node"}</span>
          <span className="rounded-[7px] border border-slate-950/[0.06] bg-slate-50 px-2 py-1">{layoutContext ? `${layoutContext.childrenCount} children` : "context"}</span>
          <span className={riskMessages.length ? "rounded-[7px] border border-amber-200 bg-amber-50 px-2 py-1 text-amber-700" : "rounded-[7px] border border-teal-200 bg-teal-50 px-2 py-1 text-teal-700"}>{riskMessages.length ? "guarded" : "safe"}</span>
        </div>

        {riskMessages.length > 0 ? (
          <div className="mt-2 rounded-[12px] border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-medium leading-4 text-amber-800">
            Guardrails: {riskMessages.join(" / ")}. Apply is allowed, but layout changes may affect nearby UI.
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/50">
        {imageTargets.length > 0 ? (
          <section className="border-b border-slate-950/[0.06] px-3 py-4">
            <input
              ref={imageInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(event) => void handleImageFileChange(event.target.files?.[0] ?? null)}
            />
            <div className="mb-3 flex items-center gap-2 text-[13px] font-bold text-slate-950">
              <ImageIcon className="h-3.5 w-3.5 text-slate-500" />
              Media
            </div>
            <div className="grid gap-2">
              {imageTargets.map((target) => (
                <div key={`${target.kind}-${target.drawgleId}-${target.targetIndex ?? 0}`} className="flex items-center gap-3 rounded-[12px] border border-slate-950/[0.07] bg-white p-2">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-slate-950/[0.08] bg-slate-50">
                    {target.src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={target.src} alt={target.alt || target.label} className="h-full w-full object-cover" />
                    ) : (
                      <ImageIcon className="h-4 w-4 text-slate-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-semibold text-slate-900">{target.label}</div>
                    <div className="mt-0.5 truncate text-[11px] text-slate-500">{labelForImageTargetKind(target.kind)}</div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 shrink-0 rounded-[10px] px-2 text-[11px]"
                    disabled={disabled || Boolean(uploadingImageTargetId)}
                    onClick={() => chooseImageFile(target)}
                  >
                    {uploadingImageTargetId === target.drawgleId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              ))}
            </div>
            {imageUploadError ? (
              <div className="mt-2 rounded-[12px] border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">{imageUploadError}</div>
            ) : null}
          </section>
        ) : null}

        {textNodes.length > 0 ? (
          <section className="border-b border-slate-950/[0.06] px-3 py-4">
            <div className="mb-3 text-[13px] font-bold text-slate-950">Content</div>
            <div className="grid gap-2">
              {textNodes.map((node) => (
                <label key={node.drawgleId} className="grid gap-1.5 rounded-[12px] border border-slate-950/[0.07] bg-white p-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{node.tagName}</span>
                  <Textarea
                    value={textDrafts[node.drawgleId] ?? ""}
                    onChange={(event) => setTextDrafts((current) => ({ ...current, [node.drawgleId]: event.target.value }))}
                    className="min-h-12 resize-y rounded-[10px] border-slate-950/[0.08] bg-slate-50/80 px-3 py-2 text-xs focus-visible:bg-white"
                  />
                </label>
              ))}
            </div>
          </section>
        ) : null}

        <section className="border-b border-slate-950/[0.06] px-3 py-3">
          <div className="flex items-center justify-between gap-3 rounded-[12px] border border-slate-950/[0.07] bg-white p-2">
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold text-slate-900">
                {classListKey || "No classes"}
              </div>
              <div className="mt-0.5 text-[11px] text-slate-500">
                {inspectedProperties.filter((property) => property.status === "linked").length} token links / {inspectedProperties.filter((property) => property.inlineValue).length} local overrides
              </div>
            </div>
            <div className="flex shrink-0 gap-1">
              {onAskAiRefine ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-8 rounded-[10px] px-2 text-[11px] text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                  disabled={disabled || isSaving}
                  onClick={() => void onAskAiRefine(buildAiRefinePrompt())}
                >
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  Ask AI
                </Button>
              ) : null}
              <Button
                variant="ghost"
                className="h-8 rounded-[10px] px-2 text-[11px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-950"
                disabled={disabled || isSaving || inspectedProperties.every((property) => !normalizeCssValue(property.inlineValue))}
                onClick={() => void resetAllLocalOverrides()}
              >
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                Reset
              </Button>
            </div>
          </div>
        </section>

        {renderPositionSection()}
        {renderLayoutSection()}
        {renderSizeSection()}
        {renderSpacingSection()}
        {renderTypeSection()}
        {renderSurfaceSection()}
        {renderEffectsSection()}

        <section className="border-b border-slate-950/[0.06] px-3 py-4">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 rounded-[12px] border border-slate-950/[0.07] bg-white px-3 py-2.5 text-left transition hover:bg-slate-50"
            onClick={() => setAdvancedDetailsOpen((open) => !open)}
            aria-expanded={advancedDetailsOpen}
          >
            <div className="min-w-0">
              <div className="text-[13px] font-bold text-slate-950">Advanced details</div>
              <div className="mt-0.5 text-[11px] text-slate-500">Raw classes, HTML, and element context</div>
            </div>
            <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${advancedDetailsOpen ? "rotate-180" : ""}`} />
          </button>

          {advancedDetailsOpen ? (
            <div className="mt-3 grid gap-2">
              <label className="grid gap-1.5 rounded-[12px] border border-slate-950/[0.07] bg-white p-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Classes</span>
                <Textarea
                  value={classDraft}
                  disabled={disabled || isSaving}
                  onChange={(event) => setClassDraft(event.target.value)}
                  className="min-h-20 resize-y rounded-[10px] border-slate-950/[0.08] bg-slate-50/80 px-3 py-2 font-mono text-[11px] leading-5 text-slate-700 focus-visible:bg-slate-50"
                />
              </label>
              {layoutContext ? (
                <div className="grid grid-cols-3 gap-2 text-[11px]">
                  <div className="rounded-[10px] border border-slate-950/[0.07] bg-white p-2">
                    <div className="text-slate-400">Parent</div>
                    <div className="mt-0.5 truncate font-semibold text-slate-900">{layoutContext.parentDisplay ?? "none"}</div>
                  </div>
                  <div className="rounded-[10px] border border-slate-950/[0.07] bg-white p-2">
                    <div className="text-slate-400">Index</div>
                    <div className="mt-0.5 truncate font-semibold text-slate-900">{layoutContext.childIndex + 1}/{layoutContext.siblingCount}</div>
                  </div>
                  <div className="rounded-[10px] border border-slate-950/[0.07] bg-white p-2">
                    <div className="text-slate-400">Children</div>
                    <div className="mt-0.5 truncate font-semibold text-slate-900">{layoutContext.childrenCount}</div>
                  </div>
                </div>
              ) : null}
              <div className="grid gap-1.5 rounded-[12px] border border-slate-950/[0.07] bg-white p-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Code</span>
                <pre className="max-h-48 overflow-auto rounded-[10px] bg-slate-950 p-3 text-[11px] leading-5 text-slate-100">
                  <code>{selectedElementInfo.outerHTML}</code>
                </pre>
              </div>
            </div>
          ) : null}
        </section>
        {inspectedProperties.length === 0 ? (
          <div className="mx-3 mb-4 rounded-[14px] border border-slate-950/[0.08] bg-white px-4 py-6 text-center text-sm text-slate-500">
            Reselect the element to inspect its live CSS sources.
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-slate-950/[0.06] bg-white/95 px-3 py-3">
        {onDelete && selectedElementInfo.targetType !== "navigation" ? (
          <Button
            variant="outline"
            className="h-10 rounded-[12px] border-red-200 px-3 text-red-600 hover:bg-red-50 hover:text-red-700"
            disabled={disabled || isSaving}
            onClick={() => void onDelete()}
          >
            <Trash className="h-3.5 w-3.5" />
          </Button>
        ) : <div />}
        <Button
          className="h-10 rounded-[12px] dg-button-primary hover:dg-button-primary px-4 text-white gap-2"
          disabled={disabled || isSaving || !hasDraftChanges}
          onClick={() => void saveDesign()}
        >
          {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Apply Changes
        </Button>
      </div>
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
  const [canvasTool, setCanvasTool] = useState<CanvasTool>("pointer");
  const [selectedScreen, setSelectedScreen] = useState<ScreenData | null>(null);
  const [isChatCollapsed, setIsChatCollapsed] = useState(false);

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  const [isQueueingGeneration, setIsQueueingGeneration] = useState(false);
  const [pendingQueuedRunId, setPendingQueuedRunId] = useState<string | null>(null);
  const [pendingAddScreenRunId, setPendingAddScreenRunId] = useState<string | null>(null);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [selectionNotice, setSelectionNotice] = useState<string | null>(null);
  const [selectionVersion, setSelectionVersion] = useState(0);

  // Credits & Pricing Dialog state
  const { balance, loading: loadingCredits } = useCredits();
  const [isPricingOpen, setIsPricingOpen] = useState(false);
  const [pricingReason, setPricingReason] = useState<"upgrade" | "insufficient_credits">("upgrade");
  const [editSession, setEditSession] = useState<ElementEditSession | null>(null);
  const [selectedElementPreview, setSelectedElementPreview] = useState<SelectedElementPreviewPayload | null>(null);
  const [pendingElementSelection, setPendingElementSelection] = useState<PendingElementSelection | null>(null);
  const [tokenDraft, setTokenDraft] = useState<DesignTokens | null>(() =>
    hasApprovedDesignTokens(initialProject.designTokens)
      ? normalizeDesignTokens(initialProject.designTokens)
      : null,
  );
  const [tokenDirty, setTokenDirty] = useState(false);
  const [tokenSaving, setTokenSaving] = useState(false);
  const tokenDirtyRef = useRef(tokenDirty);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exportInitialScreenId, setExportInitialScreenId] = useState<string | null>(null);

  const [deleteConfirmState, setDeleteConfirmState] = useState<{
    isOpen: boolean;
    screenId: string;
    drawgleId: string;
  } | null>(null);

  const [alertModalState, setAlertModalState] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
  } | null>(null);

  const handleSignOut = async () => {
    try {
      await fetch("/auth/signout", {
        method: "POST",
      });
      router.replace("/login");
      router.refresh();
    } catch (signOutError) {
      console.error("Failed to sign out", signOutError);
    }
  };

  const effectiveDesignTokens = tokenDraft && hasApprovedDesignTokens(tokenDraft)
    ? tokenDraft
    : project?.designTokens ?? null;

  const exportTokenCss = useMemo(() => buildDrawgleTokenCss(effectiveDesignTokens), [effectiveDesignTokens]);
  const exportGoogleFontLinks = useMemo(() => buildGoogleFontAssetLinks(effectiveDesignTokens), [effectiveDesignTokens]);
  const addScreenRefreshAttemptedRunIdRef = useRef<string | null>(null);
  const selectionMode = canvasTool === "element-select";
  const isGenerationBusy = Boolean(generationRun) || isQueueingGeneration || Boolean(pendingQueuedRunId);
  const isCanvasInteractionLocked = isGenerationBusy;
  const isGenerationActive = Boolean(
    generationRun &&
    (generationRun.status === "queued" || generationRun.status === "planning" || generationRun.status === "building"),
  );
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
        setSelectedElementPreview(null);
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
      setSelectedElementPreview(null);
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
      setSelectedElementPreview(null);
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

  const handleDeterministicElementEdit = async (
    operations: DeterministicEditOperation[],
    overrideScreenId?: string,
    overrideDrawgleId?: string,
  ) => {
    if (!project || operations.length === 0) {
      return false;
    }

    const screenId = overrideScreenId ?? editSession?.screenId;
    const drawgleId = overrideDrawgleId ?? editSession?.element.drawgleId;
    const targetType = editSession?.element.targetType ?? "screen";

    if (!screenId || !drawgleId) {
      return false;
    }

    try {
      const editRes = await fetch("/api/element-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          screenId,
          targetType,
          drawgleId,
          operations,
        }),
      });

      if (!editRes.ok) {
        const payload = await editRes.json().catch(() => null);
        throw new Error(payload?.error ?? "Failed to edit selected element.");
      }

      setSelectedElementPreview(null);
      await refreshScreens();
      return true;
    } catch (error: any) {
      console.error("Deterministic element edit error:", error);
      setAlertModalState({
        isOpen: true,
        title: "Action Restricted",
        description: error.message || "Failed to edit selected element.",
      });
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

  const handleDeleteSelectedElement = async (overrideScreenId?: string, overrideDrawgleId?: string) => {
    const screenId = overrideScreenId ?? editSession?.screenId;
    const drawgleId = overrideDrawgleId ?? editSession?.element.drawgleId;

    if (!project || !screenId || !drawgleId) {
      return;
    }

    setDeleteConfirmState({
      isOpen: true,
      screenId,
      drawgleId,
    });
  };

  const executeDeleteSelectedElement = async () => {
    if (!deleteConfirmState) return;
    const { screenId, drawgleId } = deleteConfirmState;

    try {
      const deleted = await handleDeterministicElementEdit(
        [{ type: "deleteElement", drawgleId }],
        screenId,
        drawgleId,
      );

      if (deleted) {
        clearEditSession();
      }
    } finally {
      setDeleteConfirmState(null);
    }
  };

  const handleDuplicateSelectedElement = async (screenId: string, drawgleId: string) => {
    if (!project || !screenId || !drawgleId) {
      return;
    }

    const duplicated = await handleDeterministicElementEdit(
      [{ type: "duplicateElement", drawgleId }],
      screenId,
      drawgleId,
    );

    if (duplicated) {
      clearEditSession();
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
    setSelectedElementPreview(null);
    setEditSession(null);
    setPendingElementSelection(null);
    setSelectionNotice(null);
  };

  const handleToggleSelectionMode = () => {
    setSelectionNotice(null);
    setPendingElementSelection(null);
    setCanvasTool((currentTool) => {
      const nextTool = currentTool === "element-select" ? "pointer" : "element-select";
      if (nextTool === "pointer") {
        clearEditSession();
      }
      return nextTool;
    });
  };

  const commitElementSelection = (info: SelectedElementInfo) => {
    const ownerScreen = screens.find((screen) => screen.id === info.screenId) ?? null;
    const nextSelectionVersion = selectionVersion + 1;

    setSelectedElementPreview(null);
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
      setSelectedElementPreview(null);
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
      setSelectedElementPreview(null);
      setEditSession(null);
    }
  };

  const handleOpenVisualEditor = () => {
    setCanvasTool("element-select");
  };

  if (isProjectLoading || !project) {
    return <ProjectCanvasLoading />;
  }

  return (
    <div className="h-full min-h-0 overflow-hidden bg-[var(--dg-bg)] text-[var(--dg-text)]" style={shellLayoutVars}>
      <main className="relative z-0 flex h-full w-full overflow-hidden">
        <div
          data-canvas-obstacle="top"
          className="absolute left-4 top-[calc(env(safe-area-inset-top,0px)+1rem)] z-50 flex items-center gap-2"
        >
          <div className="flex h-8 items-center rounded-full dg-panel px-2 backdrop-blur-xl lg:px-3">
            <Button variant="ghost" size="sm" onClick={() => router.push("/project/new")} className="h-8 rounded-full text-[var(--dg-text)] hover:bg-[var(--dg-surface-muted)] focus-visible:bg-[var(--dg-surface-muted)] data-[state=open]:bg-[var(--dg-surface-muted)] px-2 sm:px-3 flex items-center justify-center">
              <ArrowLeft className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Workspace</span>
            </Button>
            <div className="hidden h-5 w-px bg-[var(--dg-border-strong)] sm:block" />
            <div className="hidden max-w-[240px] truncate pl-2 text-[11px] font-semibold uppercase text-[var(--dg-text-muted)] sm:block">
              {project.name}
            </div>
          </div>
        </div>

        <div
          data-canvas-obstacle="top"
          className="absolute right-4 top-[calc(env(safe-area-inset-top,0px)+1rem)] z-50 flex items-center gap-1.5 sm:gap-3"
        >
          {/* Group 1 (Utilities): Sun/Moon theme toggle + Help contact dropdown */}
          <div className="flex h-8 shrink-0 items-center rounded-full dg-panel px-1.5 backdrop-blur-xl gap-0.5">
            <Tooltip>
              <TooltipTrigger
                render={
                  <span className="inline-flex">
                    <AnimatedThemeToggle
                      size="icon"
                      variant="circle"
                      className="h-6 w-6 rounded-full text-neutral-600 hover:bg-[#f7f7f8] focus-visible:bg-[#f7f7f8] dark:text-neutral-300 dark:hover:bg-white/10 dark:focus-visible:bg-white/10 [&_svg]:size-3.5"
                    />
                  </span>
                }
              />
              <TooltipContent>Toggle theme</TooltipContent>
            </Tooltip>

            <PremiumDropdown
              align="start"
              width={200}
              trigger={
                <button
                  type="button"
                  className="flex h-6 w-6 items-center justify-center rounded-full text-neutral-600 dark:text-neutral-300 hover:bg-[#f7f7f8] dark:hover:bg-white/10 focus:outline-none transition-colors cursor-pointer"
                  aria-label="Help"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                </button>
              }
              header={
                <div className="text-left font-sans">
                  <div className="text-[12px] font-bold text-slate-700 dark:text-slate-300">Get in touch</div>
                </div>
              }
              items={[
                {
                  id: "x",
                  label: "Send message on X",
                  icon: MessageCircle,
                  onClick: () => window.open("https://x.com/9to5_Dad", "_blank"),
                },
                {
                  id: "email",
                  label: "Send us an email",
                  icon: Mail,
                  onClick: () => {
                    window.location.href = "mailto:support@drawgle.com";
                  },
                },
              ]}
            />
          </div>

          {/* Group 2 (Actions): Preview, Share, Export */}
          <div className="flex h-8 shrink-0 items-center rounded-full dg-panel px-1.5 backdrop-blur-xl gap-0.5 shadow-sm">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Share project"
                    className="h-6 gap-1 rounded-full px-2 text-[10px] font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 hover:bg-[#f7f7f8] dark:hover:bg-white/10 flex items-center justify-center"
                  >
                    <Share2 className="h-3 w-3 text-neutral-700 dark:text-neutral-300" />
                    <span className="hidden sm:inline">Share</span>
                  </Button>
                }
              />
              <TooltipContent className="max-w-[250px] text-center leading-4">
                Sharing launches soon. You&apos;ll be able to share a read-only project link with others.
              </TooltipContent>
            </Tooltip>
            <ExportMenu
              open={exportMenuOpen}
              onOpenChange={setExportMenuOpen}
              project={project}
              screens={screens}
              initialScreenId={exportInitialScreenId}
              projectNavigation={projectNavigation}
              designTokens={effectiveDesignTokens}
              tokenCss={exportTokenCss}
              googleFontAssetLinks={exportGoogleFontLinks}
              tokenDirty={tokenDirty}
              generationActive={isGenerationActive}
              trigger={
                <Button
                  size="sm"
                  className="h-6 rounded-full dg-button-primary hover:dg-button-primary px-2 sm:px-3 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm transition-all flex items-center justify-center gap-1"
                  onClick={() => setExportInitialScreenId(selectedScreen?.id || screens[0]?.id || null)}
                >
                  <Download className="h-3 w-3 shrink-0" />
                  <span className="hidden sm:inline">Export</span>
                </Button>
              }
            />
          </div>

          {/* Credits & Upgrade pill */}
          <div className="flex h-8 shrink-0 items-center rounded-full dg-panel px-1.5 backdrop-blur-xl gap-0.5 border border-[#1b7fcccc]/50 pl-2 shadow-[0_1px_2px_rgba(99,102,241,0.03)]">
            <span className="flex items-center gap-1.5 text-[12px] font-extrabold text-[#1b7fcccc] tracking-tight select-none mr-1">
              {loadingCredits ? "..." : (
                <>
                  <CircleDollarSign className="h-4 w-4 stroke-[2.5]" />
                  {balance}
                </>
              )}
            </span>
            <Button
              onClick={() => {
                setPricingReason("upgrade");
                setIsPricingOpen(true);
              }}
              size="sm"
              className="h-6 rounded-full dg-button-primary hover:dg-button-primary px-2 sm:px-3 text-[10px] font-bold uppercase tracking-wider text-white shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1"
            >
              <CreditCard className="h-3 w-3 sm:hidden" />
              <span className="hidden sm:inline">Upgrade</span>
            </Button>
          </div>

          {/* Group 3 (User Profile): Gradient Avatar Circle with Radix Dropdown */}
          <PremiumDropdown
            align="end"
            width={220}
            trigger={
              <button
                type="button"
                className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-tr from-sky-400 via-[#1b7fcc] to-blue-600 shadow-md ring-2 ring-white dark:ring-slate-800 hover:ring-blue-200 dark:hover:ring-[#1b7fcc]/60 transition-all focus:outline-none"
              >
                <span className="text-[10px] font-bold text-white uppercase select-none">
                  {user.email ? user.email.slice(0, 2) : "US"}
                </span>
              </button>
            }
            header={
              <div className="text-left">
                <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500 mb-0.5">Account</div>
                <div className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">{user.email || "user@drawgle.com"}</div>

              </div>
            }
            items={[
              {
                id: "switch",
                label: "Switch Projects",
                icon: FolderSync,
                onClick: () => router.push("/project/new"),
              },
              {
                id: "account",
                label: "Account Settings",
                icon: User,
                onClick: () => router.push("/account"),
              },
              {
                id: "billing",
                label: "Billing & Subscription",
                icon: CreditCard,
                onClick: () => router.push("/billing"),
              },
              {
                id: "logout",
                label: "Log Out",
                icon: LogOut,
                variant: "destructive" as const,
                onClick: handleSignOut,
              },
            ]}
          />
        </div>

        <div className="relative h-full min-w-0 flex-1">
          <CanvasStage
            screens={screens}
            projectNavigation={projectNavigation}
            designTokens={effectiveDesignTokens}
            selectedScreen={selectedScreen}
            mobileBottomReserve={mobilePromptReserve}
            tool={canvasTool}
            disabled={isCanvasInteractionLocked}
            onToolChange={setCanvasTool}
            onSelectScreen={handleCanvasSelectScreen}
            onCanvasClick={() => {
              setSelectedScreen(null);
              clearEditSession();
            }}
            selectedElementScreenId={editSession?.screenId ?? null}
            selectedElementDrawgleId={editSession?.element.drawgleId ?? null}
            selectedElementPreview={selectedElementPreview}
            hasSelectedElement={Boolean(selectedElementInfo)}
            selectedElementCanEditText={selectedElementCanEditText}
            selectedElementCanEditDesign={selectedElementCanEditDesign}
            onElementSelected={handleElementSelected}
            onElementSelectionLost={handleElementSelectionLost}
            onEditSelectedText={handleOpenVisualEditor}
            onEditSelectedDesign={handleOpenVisualEditor}
            onClearSelectedElement={clearEditSession}
            onDeleteSelectedElement={handleDeleteSelectedElement}
            onDuplicateSelectedElement={handleDuplicateSelectedElement}
            onExportCode={(...exportArgs) => {
              const screenName = exportArgs[2];
              const matchedScreen = screens.find((s) => s.name === screenName);
              if (matchedScreen) {
                setSelectedScreen(matchedScreen);
                setExportInitialScreenId(matchedScreen.id);
              }
              setExportMenuOpen(true);
            }}
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

          <ConfirmationDialog
            isOpen={Boolean(deleteConfirmState?.isOpen)}
            onClose={() => setDeleteConfirmState(null)}
            onConfirm={executeDeleteSelectedElement}
            title="Delete Element"
            description="Are you sure you want to delete this element? This action cannot be undone."
            confirmText="Delete"
            cancelText="Cancel"
            variant="destructive"
          />

          <Dialog
            open={Boolean(alertModalState?.isOpen)}
            onOpenChange={(open) => !open && setAlertModalState(null)}
          >
            <DialogContent className="w-[min(420px,calc(100vw-2rem))] gap-0 overflow-hidden rounded-[24px] border border-slate-950/[0.08] bg-white p-0 shadow-[0_24px_90px_rgba(15,23,42,0.22)]">
              <DialogHeader className="gap-2 px-5 pb-3 pt-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700">
                  <HelpCircle className="h-4 w-4" />
                </div>
                <DialogTitle className="text-lg font-semibold tracking-[-0.01em] text-slate-950">
                  {alertModalState?.title || "Action Not Supported"}
                </DialogTitle>
                <DialogDescription className="text-sm leading-6 text-slate-600">
                  {alertModalState?.description || ""}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="mx-0 mb-0 flex-row justify-end gap-2 rounded-none border-t border-slate-950/[0.08] bg-slate-50/80 px-5 py-4">
                <Button
                  className="h-10 rounded-full bg-slate-950 px-5 text-white hover:bg-slate-800"
                  onClick={() => setAlertModalState(null)}
                >
                  Okay
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
              setSelectedElementPreview(null);
              setEditSession(null);
              setSelectionNotice(null);
            }}
            onDeleteSelectedScreen={handleDeleteSelectedScreen}
            selectedElementPreview={selectedElementInfo?.editableMetadata?.tagName ?? null}
            selectedElementTargetLabel={selectedElementTargetLabel}
            selectedElementCanEditText={selectedElementCanEditText}
            selectedElementCanEditDesign={selectedElementCanEditDesign}
            onEditSelectedText={handleOpenVisualEditor}
            onEditSelectedDesign={handleOpenVisualEditor}
            onClearSelectedElement={clearEditSession}
            onDeleteSelectedElement={handleDeleteSelectedElement}
          />

          {canvasTool === "element-select" && (!isMobile || Boolean(editSession)) ? (
            <SelectedElementInspectorSidebar
              key={editSession ? `${editSession.element.targetType}:${editSession.element.drawgleId ?? editSession.element.breadcrumb}:${editSession.selectedAt}` : "empty-inspector"}
              project={project}
              selectedScreen={selectedElementScreen ?? selectedScreen}
              selectedElementInfo={editSession?.element ?? null}
              disabled={isCanvasInteractionLocked}
              onClose={() => {
                clearEditSession();
                if (!isMobile) {
                  setCanvasTool("pointer");
                }
              }}
              onApplyOperations={handleDeterministicElementEdit}
              onPreviewChange={setSelectedElementPreview}
              onAskAiRefine={(intent) => void handlePromptAction({ prompt: intent })}
              onReplaceImage={handleReplaceSelectedImage}
              onDelete={handleDeleteSelectedElement}
            />
          ) : null}

        </div>
      </main>
      <PricingDialog
        open={isPricingOpen}
        onOpenChange={setIsPricingOpen}
        triggerReason={pricingReason}
      />
    </div>
  );
}
