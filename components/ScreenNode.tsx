"use client";

import type { DesignTokens, ProjectNavigationData, ScreenData } from "@/lib/types";
import { useState, useRef, useEffect, useMemo, useCallback, memo } from "react";
import { MoreHorizontal, Download, Trash2, Edit2, Smartphone, MousePointerClick, Crosshair, Code, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PremiumDropdown } from "@/components/ui/premium-dropdown";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { buildStandaloneHtmlExport, resolveScreenNavigationCode } from "@/lib/export-pipeline";
import { createClient } from "@/lib/supabase/client";
import { ensureDrawgleIds, stripDrawgleIds, type DrawgleBoundingRect, type DrawgleEditableMetadata } from "@/lib/drawgle-dom";
import { DRAWGLE_STYLE_PROPERTY_CONFIGS, type DrawgleStyleValueMap } from "@/lib/element-style-inspection";
import { deleteScreen } from "@/lib/supabase/queries";
import { hasSharedNavigation } from "@/lib/project-navigation";
import { buildDrawgleTokenCss, buildGoogleFontAssetLinks, buildGoogleFontHref } from "@/lib/token-runtime";
import { useRealtimeRunWithStreams } from "@trigger.dev/react-hooks";
import {
  SCREEN_FRAME_HEIGHT,
  SCREEN_FRAME_WIDTH,
  type CanvasNavigationMessage,
  type CanvasTool,
} from "@/lib/canvas-interactions";

/** Data sent from the iframe when the user clicks an element in selection mode. */
export interface SelectedElementInfo {
  screenId: string;
  /** The outerHTML of the selected element — used as the LLM's edit target. */
  outerHTML: string;
  /** Stable source id used for deterministic/manual edits. */
  drawgleId: string | null;
  /** Whether the selected element belongs to screen content or the shared nav shell. */
  targetType: "screen" | "navigation";
  /** Element bounds inside the rendered iframe viewport. */
  boundingRect: DrawgleBoundingRect | null;
  /** Phone/screen viewport bounds in the parent page. */
  screenRect: DrawgleBoundingRect | null;
  /** Text/style data used by manual edit controls. */
  editableMetadata: DrawgleEditableMetadata | null;
  /** A short human-readable text preview of the element (max ~120 chars). */
  textPreview: string;
  /** CSS breadcrumb path from root to the selected element. */
  breadcrumb: string;
  /** Whether this came from a direct click or from rehydrating an existing selection after a render update. */
  selectionReason?: "click" | "rehydrated";
}

export type SelectedElementPreviewPayload = {
  drawgleId: string | null;
  styles: DrawgleStyleValueMap;
  className?: string | null;
};
export type ElementSelectionLostReason = "rehydrate_failed" | "click_miss" | "source_changed";

export { SCREEN_FRAME_HEIGHT, SCREEN_FRAME_WIDTH } from "@/lib/canvas-interactions";

/** Strip markdown fences so the iframe always receives usable HTML. */
const stripFences = (text: string): string => {
  const match = text.match(/```(?:html)?\n([\s\S]*?)\n```/i);
  if (match) return match[1].trim();
  return text.replace(/^```html\n/i, "").replace(/\n```$/, "").trim();
};

const hasMeaningfulRenderableCode = (code: string) => {
  const stripped = stripFences(code)
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim();

  return stripped.length > 24 && /<(div|main|section|article|nav|header|footer|button|img|svg|ul|ol|li|p|h[1-6])\b/i.test(stripped);
};

const serializeForInlineScript = (value: string | null | undefined) =>
  JSON.stringify(value ?? "").replace(/</g, "\\u003c");

const stripSharedNavigationMarkup = (code: string) =>
  code
    .replace(/<!--\s*(?:floating\s+dock|bottom\s+nav|navigation)[\s\S]*?placeholder[\s\S]*?-->\s*<div\b[^>]*(?:h-\[[^\]]*(?:8[0-9]|9[0-9]|1[0-9]{2})px\]|height\s*:\s*(?:8[0-9]|9[0-9]|1[0-9]{2})px)[^>]*>\s*<\/div>/gi, "")
    .replace(/<nav\b[\s\S]*?<\/nav>/gi, (match) =>
      /bottom|tab|navigation|nav|data-drawgle-primary-nav/i.test(match) ? "" : match,
    )
    .replace(/<footer\b[\s\S]*?<\/footer>/gi, (match) =>
      /bottom|tab|navigation|nav/i.test(match) ? "" : match,
    )
    .trim();

// ---------------------------------------------------------------------------
// External Label Bar
// ---------------------------------------------------------------------------

function ScreenLabelBar({
  screen,
  isSelected,
  interactMode,
  selectionMode,
  onInteractToggle,
  onExport,
  onDelete,
  onShowCode,
}: {
  screen: ScreenData;
  isSelected: boolean;
  interactMode: boolean;
  selectionMode: boolean;
  onInteractToggle: () => void;
  onExport: () => void;
  onDelete: () => void;
  onShowCode: () => void;
}) {
  return (
    <div
      className="absolute left-0 right-0 flex items-center justify-between px-2 pointer-events-none select-none"
      style={{
        bottom: "100%",
        marginBottom: 8,
        height: 36,
        opacity: isSelected ? 1 : 0.70,
        transform: isSelected ? "translateY(0)" : "translateY(3px)",
        transition: "opacity 0.18s ease, transform 0.18s ease",
      }}
    >
      {/* SELECTION MODE badge — floated above label bar */}
      {selectionMode && (
        <div
          className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2.5 py-1 rounded-full pointer-events-none"
          style={{
            bottom: '100%',
            marginBottom: 6,
            background: 'rgba(20,184,166,0.12)',
            border: '1px solid rgba(20,184,166,0.35)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <Crosshair className="w-3 h-3" style={{ color: '#0d9488' }} />
          <span className="text-[10px] font-bold tracking-wide" style={{ color: '#0d9488' }}>
            SELECT AN ELEMENT
          </span>
        </div>
      )}
      {/* Left: device icon + name + interact badge */}
      <div className="flex items-center gap-1.5 min-w-0">
        <div
          className="flex items-center justify-center w-6 h-6 rounded-md shrink-0 transition-colors duration-200"
          style={{
            background: selectionMode
              ? "rgba(20,184,166,0.15)"
              : interactMode
              ? "rgba(16,185,129,0.15)"
              : isSelected
                ? "rgba(99,102,241,0.12)"
                : "color-mix(in oklab, var(--dg-surface-muted) 80%, transparent)",
          }}
        >
          <Smartphone
            className="w-3.5 h-3.5 transition-colors duration-200"
            style={{ color: selectionMode ? "#0d9488" : interactMode ? "#10b981" : isSelected ? "#6366f1" : "var(--dg-text-muted)" }}
          />
        </div>
        <span
          className="text-[13px] font-semibold truncate max-w-[150px] leading-none transition-colors duration-200"
          style={{ color: selectionMode ? "#2dd4bf" : interactMode ? "#34d399" : isSelected ? "#c7d2fe" : "var(--dg-text)" }}
        >
          {screen.name}
        </span>
        {/* INTERACT MODE badge — appears beside the name */}
        {interactMode && (
          <span
            className="shrink-0 text-[10px] font-bold tracking-wide px-1.5 py-0.5 rounded-full"
            style={{
              background: "rgba(16,185,129,0.15)",
              color: "#059669",
              border: "1px solid rgba(16,185,129,0.3)",
            }}
          >
            INTERACT
          </span>
        )}
      </div>

      {/* Right: action buttons — re-enable pointer events only here */}
      <div
        className="flex items-center gap-0.5"
        style={{ pointerEvents: "auto" }}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Interact / drag mode toggle — only visible when selected.
            Double-clicking the phone body is the primary way to enter this
            mode; the button here is a power-user shortcut. */}
        {isSelected && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-lg text-[var(--dg-text)] opacity-90 transition-colors duration-150 hover:bg-[var(--dg-surface-muted)] hover:text-[var(--dg-text)] hover:opacity-100 dark:text-[#d8dde7] dark:hover:bg-white/10"
            style={interactMode ? {
              background: "rgba(16,185,129,0.15)",
              color: "#059669",
            } : {}}
            title={interactMode ? "Exit interact mode  (Esc)" : "Enter interact mode  (double-click)"}
            onClick={onInteractToggle}
          >
            <MousePointerClick className="w-3.5 h-3.5" />
          </Button>
        )}

        {/* Code Viewer button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-lg text-[var(--dg-text)] opacity-90 hover:bg-[var(--dg-surface-muted)] hover:text-[var(--dg-text)] hover:opacity-100 dark:text-[#d8dde7] dark:hover:bg-white/10"
          title="View clean code"
          onClick={onShowCode}
        >
          <Code className="w-3.5 h-3.5" />
        </Button>

        {/* Export */}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-lg text-[var(--dg-text)] opacity-90 hover:bg-[var(--dg-surface-muted)] hover:text-[var(--dg-text)] hover:opacity-100 dark:text-[#d8dde7] dark:hover:bg-white/10"
          title="Export code"
          onClick={onExport}
        >
          <Download className="w-3.5 h-3.5" />
        </Button>

        {/* More / Delete */}
        <PremiumDropdown
          align="end"
          trigger={
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-lg text-[var(--dg-text)] opacity-90 hover:bg-[var(--dg-surface-muted)] hover:text-[var(--dg-text)] hover:opacity-100 dark:text-[#d8dde7] dark:hover:bg-white/10"
              title="More actions"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </Button>
          }
          items={[
            {
              id: "delete",
              label: "Delete",
              icon: Trash2,
              variant: "destructive" as const,
              onClick: (e) => {
                e.stopPropagation();
                onDelete();
              },
            },
          ]}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dimension badge — shown while dragging below the phone frame
// ---------------------------------------------------------------------------

function DimensionBadge({ visible, height }: { visible: boolean; height: number }) {
  return (
    <div
      className="absolute left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[11px] font-semibold tabular-nums whitespace-nowrap"
      style={{
        top: "100%",
        marginTop: 10,
        background: "rgba(99,102,241,0.88)",
        color: "#fff",
        letterSpacing: "0.04em",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0) scale(1)" : "translateY(-4px) scale(0.92)",
        transition: "opacity 0.12s ease, transform 0.12s ease",
        pointerEvents: "none",
        zIndex: 60,
      }}
    >
      {SCREEN_FRAME_WIDTH} × {height}
    </div>
  );
}

function ScreenBuildPreloader({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <div
      className="absolute inset-0 bg-[#f7f9fc]"
      style={{ zIndex: 16, pointerEvents: "none" }}
      aria-hidden="true"
    >
      <style>{`
        @keyframes drawgle-preload-scan {
          0% { transform: translate3d(-42%, -18%, 0) rotate(12deg); opacity: 0; }
          24% { opacity: .42; }
          62% { opacity: .28; }
          100% { transform: translate3d(42%, 78%, 0) rotate(12deg); opacity: 0; }
        }
        @keyframes drawgle-preload-breathe {
          0%, 100% { opacity: .42; transform: scale(1); }
          50% { opacity: .72; transform: scale(1.015); }
        }
        .drawgle-preload-scan {
          animation: drawgle-preload-scan 2.4s cubic-bezier(.4,0,.2,1) infinite;
        }
        .drawgle-preload-band {
          animation: drawgle-preload-breathe 2.8s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .drawgle-preload-scan,
          .drawgle-preload-band {
            animation: none !important;
          }
        }
      `}</style>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_12%,rgba(20,184,166,0.12),transparent_32%),radial-gradient(circle_at_82%_20%,rgba(99,102,241,0.11),transparent_34%),linear-gradient(180deg,#fbfdff_0%,#eef4f7_100%)]" />
      <div className="drawgle-preload-scan absolute -left-24 top-0 h-[120%] w-40 bg-gradient-to-r from-transparent via-white/75 to-transparent blur-xl" />
      <div className="relative flex h-full flex-col justify-center gap-5 px-8">
        <div className="drawgle-preload-band h-24 rounded-[32px] border border-white/60 bg-white/46 shadow-[0_24px_70px_rgba(15,23,42,0.10)]" />
        <div className="drawgle-preload-band ml-8 h-40 rounded-[34px] border border-white/70 bg-white/38 shadow-[0_20px_60px_rgba(15,23,42,0.08)] [animation-delay:180ms]" />
        <div className="drawgle-preload-band mr-12 h-20 rounded-[30px] border border-white/60 bg-white/42 shadow-[0_18px_48px_rgba(15,23,42,0.07)] [animation-delay:360ms]" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main ScreenNode
// ---------------------------------------------------------------------------

function highlightHTML(code: string): string {
  let escaped = code
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const comments: string[] = [];
  escaped = escaped.replace(/&lt;!--[\s\S]*?--&gt;/g, (match) => {
    comments.push(match);
    return `___COMMENT_PLACEHOLDER_${comments.length - 1}___`;
  });

  escaped = escaped.replace(/(&lt;\/?[a-zA-Z0-9:-]+)([\s\S]*?)(&gt;)/g, (match, p1, p2, p3) => {
    let tagHtml = `<span class="text-sky-400 font-semibold">${p1}</span>`;
    let attrs = p2;
    if (attrs) {
      attrs = attrs.replace(/([a-zA-Z0-9:-]+)(=(?:"[^"]*"|'[^']*'|[^\s"'>]+))?/g, (attrMatch, attrName, attrVal) => {
        let highlightedAttr = `<span class="text-purple-300">${attrName}</span>`;
        if (attrVal) {
          const equalsIdx = attrVal.indexOf('=');
          const eq = attrVal.slice(0, equalsIdx + 1);
          const val = attrVal.slice(equalsIdx + 1);
          highlightedAttr += `<span class="text-slate-400">${eq}</span><span class="text-emerald-300">${val}</span>`;
        }
        return highlightedAttr;
      });
    }
    return tagHtml + attrs + `<span class="text-sky-400 font-semibold">${p3}</span>`;
  });

  escaped = escaped.replace(/___COMMENT_PLACEHOLDER_(\d+)___/g, (match, index) => {
    return `<span class="text-slate-500 italic font-normal">${comments[parseInt(index, 10)]}</span>`;
  });

  return escaped;
}

interface CodeViewerDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  screenName: string;
  htmlExport: string;
}

const CodeViewerDialog = memo(function CodeViewerDialog({
  isOpen,
  onOpenChange,
  screenName,
  htmlExport,
}: CodeViewerDialogProps) {
  const [isCopied, setIsCopied] = useState(false);

  const lineCount = useMemo(() => {
    if (!htmlExport) return 0;
    return htmlExport.split("\n").length;
  }, [htmlExport]);

  const highlightedCode = useMemo(() => {
    if (!isOpen || !htmlExport) return "";
    return highlightHTML(htmlExport);
  }, [htmlExport, isOpen]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(htmlExport);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  }, [htmlExport]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([htmlExport], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${screenName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "drawgle-screen"}.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }, [htmlExport, screenName]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[85vh] flex flex-col p-0 overflow-hidden bg-[var(--dg-surface,#18181b)] border border-[var(--dg-border,rgba(255,255,255,0.08))] text-slate-100 ring-1 ring-white/10 shadow-2xl">
        <DialogHeader className="flex flex-row items-center justify-between px-6 py-4 border-b border-[var(--dg-border,rgba(255,255,255,0.08))] bg-[var(--dg-surface-muted,#202024)] gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <DialogTitle className="text-[15px] font-bold text-slate-100 truncate leading-none">
              {screenName}
            </DialogTitle>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-extrabold tracking-wider text-slate-400 select-none">
              <Code className="w-3 h-3 text-sky-400" />
              HTML
            </div>
          </div>
          
          <div className="flex items-center gap-2 mr-8">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 px-3 rounded-lg border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white"
              onClick={handleCopy}
            >
              {isCopied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[11px] font-medium">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span className="text-[11px] font-medium">Copy</span>
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 px-3 rounded-lg border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white"
              onClick={handleDownload}
            >
              <Download className="w-3.5 h-3.5" />
              <span className="text-[11px] font-medium">Download</span>
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-auto bg-slate-950 p-6 font-mono text-[12px] leading-relaxed select-text">
          <pre className="overflow-x-auto whitespace-pre [tab-size:2]">
            <code dangerouslySetInnerHTML={{ __html: highlightedCode }} />
          </pre>
        </div>

        <div className="flex items-center justify-between px-6 py-3 border-t border-[var(--dg-border,rgba(255,255,255,0.08))] bg-[var(--dg-surface-muted,#202024)] text-[11px] font-semibold text-slate-500 select-none">
          <span>Raw HTML output · {lineCount} lines</span>
          <span>.html</span>
        </div>
      </DialogContent>
    </Dialog>
  );
});

export function ScreenNode({
  screen,
  projectNavigation,
  designTokens,
  isSelected,
  isDragging = false,
  canvasTool = "pointer",
  isTemporaryCanvasPan = false,
  selectionMode = false,
  selectedDrawgleId = null,
  selectedElementPreview = null,
  onElementSelected,
  onElementSelectionLost,
  onCanvasNavigation,
  onExportCode,
  onContentHeightChange,
  onDeleteSelectedElement,
  onDuplicateSelectedElement,
}: {
  screen: ScreenData;
  projectNavigation?: ProjectNavigationData | null;
  designTokens?: DesignTokens | null;
  isSelected?: boolean;
  isDragging?: boolean;
  canvasTool?: CanvasTool;
  isTemporaryCanvasPan?: boolean;
  /** When true, the iframe enters element-selection mode (hover outlines, click-to-select). */
  selectionMode?: boolean;
  /** Stable selected element id to keep highlighted even after selection mode exits. */
  selectedDrawgleId?: string | null;
  /** Draft style/class preview for the selected element before Apply Changes persists it. */
  selectedElementPreview?: SelectedElementPreviewPayload | null;
  /** Called when the user clicks an element inside the iframe during selection mode. */
  onElementSelected?: (info: SelectedElementInfo) => void;
  /** Called when a previously selected id no longer exists after the iframe re-renders. */
  onElementSelectionLost?: (info: { screenId: string; drawgleId: string; reason?: ElementSelectionLostReason }) => void;
  /** Routes navigation overrides that begin inside the interact-mode iframe. */
  onCanvasNavigation?: (message: CanvasNavigationMessage) => void;
  /** Callback for custom code export drawer. */
  onExportCode?: (cleanScreenCode: string, cleanNavigationCode: string, screenName: string, tokenCss: string, googleFontAssetLinks: string, activeNavigationItemId: string | null) => void;
  onContentHeightChange?: (screenId: string, height: number) => void;
  onDeleteSelectedElement?: (screenId: string, drawgleId: string) => void;
  onDuplicateSelectedElement?: (screenId: string, drawgleId: string) => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const safeCode = typeof screen.code === "string" ? screen.code : "";

  // ── "Interact mode" lets the user scroll/tap the iframe content.
  // It is only active while the screen is selected.
  const [interactMode, setInteractMode] = useState(false);
  const isInteractModeActive = Boolean(isSelected && interactMode);

  const [contentHeight, setContentHeight] = useState(SCREEN_FRAME_HEIGHT);
  const [selectedElementBounds, setSelectedElementBounds] = useState<{
    drawgleId: string;
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);

  const syncIframeInteractionMode = useCallback((enabled: boolean) => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;

    if (enabled) {
      iframe.focus();
    }

    iframe.contentWindow.postMessage(
      { type: enabled ? "enterInteractMode" : "exitInteractMode" },
      "*",
    );
    iframe.contentWindow.postMessage(
      { type: "setViewportMode", enabled },
      "*",
    );
  }, []);

  // ── Streaming support while a screen is being generated
  const [initialCode] = useState(safeCode);
  const isBuilding =
    screen.status === "building" &&
    !!screen.triggerRunId &&
    !!screen.streamPublicToken;

  const { streams: triggerStreams } = useRealtimeRunWithStreams(
    isBuilding ? screen.triggerRunId! : undefined,
    { accessToken: screen.streamPublicToken ?? undefined, enabled: isBuilding },
  );

  const streamedCode = useMemo(() => {
    const chunks = (triggerStreams as Record<string, string[]>)?.code;
    if (!chunks || chunks.length === 0) return null;
    return stripFences(chunks.join(""));
  }, [triggerStreams]);
  const hasStreamedBuildCode = Boolean(streamedCode?.trim());
  const showBuildPreloader = isBuilding && !hasStreamedBuildCode && !hasMeaningfulRenderableCode(safeCode);

  const rawDisplayCode = streamedCode ?? safeCode;
  const sharedNavigationActive = hasSharedNavigation({ screen, projectNavigation });
  const displayCode = useMemo(
    () => ensureDrawgleIds(sharedNavigationActive ? stripSharedNavigationMarkup(rawDisplayCode) : rawDisplayCode).code,
    [rawDisplayCode, sharedNavigationActive],
  );
  const navigationShellCode = sharedNavigationActive ? ensureDrawgleIds(projectNavigation?.shellCode ?? "", "dg-nav").code : "";
  const lastNonEmptyDisplayCodeRef = useRef(displayCode.trim() ? displayCode : "");
  const lastNonEmptyNavigationCodeRef = useRef(navigationShellCode.trim() ? navigationShellCode : "");
  const activeNavigationItemId = sharedNavigationActive ? screen.navigationItemId ?? "" : "";
  const tokenCss = useMemo(() => buildDrawgleTokenCss(designTokens), [designTokens]);
  const googleFontHref = useMemo(() => buildGoogleFontHref(designTokens), [designTokens]);
  const googleFontAssetLinks = useMemo(() => buildGoogleFontAssetLinks(designTokens), [designTokens]);
  const styleInspectionProperties = useMemo(
    () => JSON.stringify(DRAWGLE_STYLE_PROPERTY_CONFIGS.map((config) => config.property)),
    [],
  );
  const [bootstrapContent] = useState(() => ({
    screenCode: displayCode,
    navigationShellCode,
    activeNavigationItemId,
    tokenCss,
    googleFontHref,
    googleFontAssetLinks,
  }));
  const iframeReadyRef = useRef(false);

  const postCurrentRenderState = useCallback((force = false) => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    if (!force && !iframeReadyRef.current) return;
    const codeForRender = displayCode.trim() ? displayCode : lastNonEmptyDisplayCodeRef.current;
    const navigationCodeForRender = sharedNavigationActive
      ? navigationShellCode.trim()
        ? navigationShellCode
        : lastNonEmptyNavigationCodeRef.current
      : "";

    iframe.contentWindow.postMessage(
      {
        type: "updateCode",
        code: codeForRender,
        navigationCode: navigationCodeForRender,
        activeNavigationItemId,
        tokenCss,
        googleFontHref,
      },
      "*",
    );
  }, [activeNavigationItemId, displayCode, googleFontHref, navigationShellCode, sharedNavigationActive, tokenCss]);

  const handleExportCode = useCallback(() => {
    const cleanScreenCode = stripDrawgleIds(displayCode.trim() ? displayCode : lastNonEmptyDisplayCodeRef.current);
    const cleanNavigationCode = stripDrawgleIds(
      sharedNavigationActive
        ? navigationShellCode.trim()
          ? navigationShellCode
          : lastNonEmptyNavigationCodeRef.current
        : "",
    );

    if (onExportCode) {
      onExportCode(cleanScreenCode, cleanNavigationCode, screen.name, tokenCss, googleFontAssetLinks, activeNavigationItemId);
      return;
    }

    const exportCode = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <script src="https://cdn.tailwindcss.com"><\/script>
    <script src="https://unpkg.com/lucide@latest"><\/script>
    ${googleFontAssetLinks}
    <style>
${tokenCss}
      html, body { margin: 0; min-height: 100%; }
      body { font-family: var(--dg-typography-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif); background: var(--dg-color-background-primary, #ffffff); }
      #drawgle-export-root { position: relative; min-height: 100vh; overflow-x: hidden; }
      #drawgle-export-navigation { position: fixed; left: 0; right: 0; bottom: 0; z-index: 80; pointer-events: none; }
      #drawgle-export-navigation [data-drawgle-primary-nav] { pointer-events: auto; }
    </style>
  </head>
  <body>
    <div id="drawgle-export-root">
${cleanScreenCode}
      ${cleanNavigationCode ? `<div id="drawgle-export-navigation">${cleanNavigationCode}</div>` : ""}
    </div>
    <script>
      if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
      document.querySelectorAll('[data-nav-item-id]').forEach(function(item) {
        var active = item.getAttribute('data-nav-item-id') === ${serializeForInlineScript(activeNavigationItemId)};
        item.setAttribute('data-active', active ? 'true' : 'false');
        item.setAttribute('aria-current', active ? 'page' : 'false');
      });
    <\/script>
  </body>
</html>`;
    const blob = new Blob([exportCode], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${screen.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "drawgle-screen"}.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }, [activeNavigationItemId, displayCode, googleFontAssetLinks, navigationShellCode, screen.name, sharedNavigationActive, tokenCss, onExportCode]);

  const [isCodeOpen, setIsCodeOpen] = useState(false);

  const htmlExport = useMemo(() => {
    if (!isCodeOpen) return "";
    return buildStandaloneHtmlExport({
      screen: {
        ...screen,
        code: rawDisplayCode,
      },
      navigationCode: sharedNavigationActive ? navigationShellCode : "",
      activeNavigationItemId,
      designTokens,
      tokenCss,
      googleFontAssetLinks,
    });
  }, [isCodeOpen, screen, rawDisplayCode, sharedNavigationActive, navigationShellCode, activeNavigationItemId, designTokens, tokenCss, googleFontAssetLinks]);

  // ── Push code updates into the iframe without a full remount
  useEffect(() => {
    if (displayCode.trim()) {
      lastNonEmptyDisplayCodeRef.current = displayCode;
    }
  }, [displayCode]);

  useEffect(() => {
    if (navigationShellCode.trim()) {
      lastNonEmptyNavigationCodeRef.current = navigationShellCode;
    }
  }, [navigationShellCode]);

  useEffect(() => {
    postCurrentRenderState();
  }, [postCurrentRenderState]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;

      if (event.data?.type === "drawgleContentHeight") {
        const height = Number(event.data.height);
        if (!isNaN(height) && height > 0) {
          const clampedHeight = Math.min(2000, Math.max(SCREEN_FRAME_HEIGHT, height));
          setContentHeight(clampedHeight);
          onContentHeightChange?.(screen.id, clampedHeight);
        }
        return;
      }

      if (event.data?.type !== "drawgleIframeReady") return;
      iframeReadyRef.current = true;
      postCurrentRenderState(true);
      syncIframeInteractionMode(isInteractModeActive);
      iframeRef.current?.contentWindow?.postMessage(
        { type: "setViewportMode", enabled: isInteractModeActive },
        "*",
      );
      iframeRef.current?.contentWindow?.postMessage(
        { type: selectionMode ? "enableSelectionMode" : "disableSelectionMode" },
        "*",
      );
      iframeRef.current?.contentWindow?.postMessage(
        { type: "setSelectedDrawgleId", drawgleId: selectedDrawgleId ?? null },
        "*",
      );
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [isInteractModeActive, postCurrentRenderState, selectedDrawgleId, selectionMode, syncIframeInteractionMode, screen.id, onContentHeightChange]);

  // ── Escape key exits interact mode
  useEffect(() => {
    if (!isSelected || !interactMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setInteractMode(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isSelected, interactMode]);

  useEffect(() => {
    syncIframeInteractionMode(isInteractModeActive);
  }, [isInteractModeActive, syncIframeInteractionMode]);

  // ── Selection mode: tell the iframe to enable/disable element picking
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    iframe.contentWindow.postMessage(
      { type: selectionMode ? 'enableSelectionMode' : 'disableSelectionMode' },
      '*',
    );
  }, [selectionMode]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    iframe.contentWindow.postMessage(
      { type: 'setSelectedDrawgleId', drawgleId: selectedDrawgleId ?? null },
      '*',
    );

  }, [selectedDrawgleId]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;

    if (!selectedElementPreview?.drawgleId) {
      iframe.contentWindow.postMessage({ type: 'clearSelectedElementPreview' }, '*');
      return;
    }

    iframe.contentWindow.postMessage(
      {
        type: 'previewSelectedElement',
        drawgleId: selectedElementPreview.drawgleId,
        styles: selectedElementPreview.styles,
        className: selectedElementPreview.className ?? null,
      },
      '*',
    );
  }, [selectedElementPreview]);

  // ── Listen for elementSelected messages from the iframe
  useEffect(() => {
    if (!onElementSelected && !onElementSelectionLost) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (
        event.data?.type === "drawgleCanvasZoom" ||
        event.data?.type === "drawgleCanvasPanStart" ||
        event.data?.type === "drawgleCanvasPanMove" ||
        event.data?.type === "drawgleCanvasPanEnd" ||
        event.data?.type === "drawgleCanvasPanBy"
      ) {
        if (!onCanvasNavigation) return;
        if (event.data.type === "drawgleCanvasPanEnd") {
          onCanvasNavigation({ type: "drawgleCanvasPanEnd" });
          return;
        }
        if (event.data.type === "drawgleCanvasPanBy") {
          onCanvasNavigation({
            type: "drawgleCanvasPanBy",
            deltaX: Number(event.data.deltaX ?? 0),
            deltaY: Number(event.data.deltaY ?? 0),
          });
          return;
        }

        const iframeRect = iframeRef.current?.getBoundingClientRect();
        if (!iframeRect) return;
        const clientX = iframeRect.left + Number(event.data.clientX ?? 0);
        const clientY = iframeRect.top + Number(event.data.clientY ?? 0);
        if (event.data.type === "drawgleCanvasZoom") {
          onCanvasNavigation({
            type: "drawgleCanvasZoom",
            clientX,
            clientY,
            deltaY: Number(event.data.deltaY ?? 0),
          });
          return;
        }
        onCanvasNavigation({
          type: event.data.type,
          clientX,
          clientY,
        });
        return;
      }
      if (event.data?.type === "elementSelectionLost") {
        const lostDrawgleId = typeof event.data.drawgleId === "string" ? event.data.drawgleId : null;
        setSelectedElementBounds(null);
        const lostReason = event.data.reason === "rehydrate_failed" || event.data.reason === "click_miss" || event.data.reason === "source_changed"
          ? event.data.reason
          : undefined;
        if (lostDrawgleId) {
          onElementSelectionLost?.({ screenId: screen.id, drawgleId: lostDrawgleId, reason: lostReason });
        }
        return;
      }
      if (event.data?.type !== 'elementSelected' || !onElementSelected) return;

      const { outerHTML, drawgleId, textPreview, breadcrumb, boundingRect, editableMetadata, selectionReason } = event.data as {
        type: string;
        outerHTML: string;
        drawgleId?: string | null;
        targetType?: "screen" | "navigation";
        boundingRect?: DrawgleBoundingRect | null;
        editableMetadata?: DrawgleEditableMetadata | null;
        textPreview: string;
        breadcrumb: string;
        selectionReason?: "click" | "rehydrated";
      };

      if (outerHTML && drawgleId) {
        if (boundingRect) {
          setSelectedElementBounds({
            drawgleId,
            left: boundingRect.left,
            top: boundingRect.top,
            width: boundingRect.width,
            height: boundingRect.height,
          });
        }
        const screenRect = iframeRef.current?.getBoundingClientRect() ?? null;
        onElementSelected({
          screenId: screen.id,
          outerHTML,
          drawgleId,
          targetType: event.data.targetType === "navigation" ? "navigation" : "screen",
          boundingRect: boundingRect ?? null,
          screenRect: screenRect
            ? {
                x: screenRect.x,
                y: screenRect.y,
                width: screenRect.width,
                height: screenRect.height,
                top: screenRect.top,
                right: screenRect.right,
                bottom: screenRect.bottom,
                left: screenRect.left,
              }
            : null,
          editableMetadata: editableMetadata ?? null,
          textPreview,
          breadcrumb,
          selectionReason: selectionReason === "rehydrated" ? "rehydrated" : "click",
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onCanvasNavigation, onElementSelected, onElementSelectionLost, screen.id]);

  // ── Delete
  const handleDelete = useCallback(async () => {
    try {
      const supabase = createClient();
      await deleteScreen(supabase, screen.id);
    } catch (err) {
      console.error("Failed to delete screen", err);
    }
  }, [screen.id]);

  const handleInlineDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (selectedDrawgleId && onDeleteSelectedElement) {
      onDeleteSelectedElement(screen.id, selectedDrawgleId);
    }
  }, [screen.id, selectedDrawgleId, onDeleteSelectedElement]);

  const handleInlineDuplicate = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (selectedDrawgleId && onDuplicateSelectedElement) {
      onDuplicateSelectedElement(screen.id, selectedDrawgleId);
    }
  }, [screen.id, selectedDrawgleId, onDuplicateSelectedElement]);

  // =========================================================================
  // iframe srcDoc
  // =========================================================================

  const srcDoc = useMemo(() => {
    const initialScreenCode = bootstrapContent.screenCode;
    const initialNavigationCode = bootstrapContent.navigationShellCode;
    const initialActiveNavigationItemId = bootstrapContent.activeNavigationItemId;
    const initialTokenCss = bootstrapContent.tokenCss;
    const initialGoogleFontHref = bootstrapContent.googleFontHref;
    const initialGoogleFontAssetLinks = bootstrapContent.googleFontAssetLinks;

    return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script id="drawgle-tailwind-cdn" src="https://cdn.tailwindcss.com" onerror="window.__drawgleTailwindLoadFailed = true"><\/script>
        <script src="https://unpkg.com/lucide@latest"><\/script>
        ${initialGoogleFontAssetLinks}
        <style>
          html, body { width: 100%; margin: 0; padding: 0; overscroll-behavior: none; }
          ::-webkit-scrollbar { display: none; width: 0; height: 0; }
          * { -ms-overflow-style: none; scrollbar-width: none; }
          #root { position: relative; width: 100%; background: transparent; }

          /* Full height mode (default) */
          html:not([data-viewport-mode="true"]), 
          html:not([data-viewport-mode="true"]) body { 
            height: auto; 
            overflow: visible; 
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          }
          html:not([data-viewport-mode="true"]) #root { 
            height: auto; 
            overflow: visible; 
          }
          html:not([data-viewport-mode="true"]) #drawgle-screen-content { 
            width: 100%; 
            height: auto; 
            overflow: visible; 
          }

          /* Viewport mode (fixed height with scrolling) */
          html[data-viewport-mode="true"], 
          html[data-viewport-mode="true"] body { 
            height: 100%; 
            overflow: hidden; 
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          }
          html[data-viewport-mode="true"] #root { 
            height: 100vh; 
            overflow: hidden; 
          }
          html[data-viewport-mode="true"] #drawgle-screen-content { 
            width: 100%; 
            height: 100%; 
            overflow-y: auto; 
            overflow-x: hidden; 
            overscroll-behavior: contain; 
            -webkit-overflow-scrolling: touch; 
            touch-action: pan-y; 
          }

          #drawgle-screen-content:focus { outline: none; }
          #drawgle-navigation-host { position: fixed; left: 0; right: 0; bottom: 0; z-index: 80; pointer-events: none; width: 100%; }
          #drawgle-navigation-host:empty { display: none; }
          #drawgle-navigation-host [data-drawgle-primary-nav] { pointer-events: auto; }
          .__drawgle-hover-outline { outline: 2px solid rgba(20,184,166,0.8) !important; outline-offset: -1px; cursor: crosshair !important; }
          .__drawgle-selected-outline { outline: 2.5px solid #0d9488 !important; outline-offset: -1px; background-color: rgba(20,184,166,0.06) !important; }
        </style>
        <style id="drawgle-project-tokens">${initialTokenCss}</style>
      </head>
      <body>
        <div id="root" data-has-navigation="${initialNavigationCode ? "true" : "false"}">
          <div id="drawgle-screen-content"></div>
          <div id="drawgle-navigation-host"></div>
        </div>
        <script>
          var initialScreenCode = ${serializeForInlineScript(initialScreenCode)};
          var initialNavigationCode = ${serializeForInlineScript(initialNavigationCode)};
          var initialActiveNavigationItemId = ${serializeForInlineScript(initialActiveNavigationItemId)};
          var initialTokenCss = ${serializeForInlineScript(initialTokenCss)};
          var initialGoogleFontHref = ${serializeForInlineScript(initialGoogleFontHref)};
          var styleRuntimeReady = false;
          var tailwindRuntimeDegraded = false;
          var renderRevision = 0;
          var queuedRenderPayload = null;
          var pendingSelectedDrawgleId = null;

          function setStyleRuntimePending() {
            if (tailwindRuntimeDegraded) return;
            if (document.documentElement.hasAttribute('data-drawgle-style-ready')) return;
            document.documentElement.removeAttribute('data-drawgle-style-ready');
          }

          function markStyleRuntimeReady(mode) {
            styleRuntimeReady = true;
            window.requestAnimationFrame(function() {
              document.documentElement.setAttribute('data-drawgle-style-ready', mode || 'ready');
            });
          }

          function ensureTailwindProbe() {
            var probe = document.getElementById('drawgle-tailwind-style-probe');
            if (probe) return probe;
            probe = document.createElement('div');
            probe.id = 'drawgle-tailwind-style-probe';
            probe.setAttribute('aria-hidden', 'true');
            probe.className = 'pointer-events-none fixed -left-[9999px] top-0 flex h-[13px] w-[17px] rounded-[9px] bg-[#123456] p-[7px] opacity-0';
            document.body.appendChild(probe);
            return probe;
          }

          function isTailwindCssApplied() {
            var probe = ensureTailwindProbe();
            var style = window.getComputedStyle(probe);
            var background = (style.backgroundColor || '').replace(/\\s+/g, '');
            return style.display === 'flex'
              && Math.round(parseFloat(style.width || '0')) === 17
              && Math.round(parseFloat(style.paddingLeft || '0')) === 7
              && Math.round(parseFloat(style.borderRadius || '0')) === 9
              && background.indexOf('18,52,86') !== -1;
          }

          function waitForRenderedStylesReady(revision) {
            if (tailwindRuntimeDegraded) {
              markStyleRuntimeReady('degraded');
              return;
            }

            var attempts = 0;
            function check() {
              if (revision !== renderRevision) return;

              if (isTailwindCssApplied()) {
                window.requestAnimationFrame(function() {
                  window.requestAnimationFrame(function() {
                    if (revision === renderRevision) {
                      markStyleRuntimeReady('ready');
                    }
                  });
                });
                return;
              }

              attempts += 1;
              if (attempts < 80) {
                window.setTimeout(check, 50);
                return;
              }

              markStyleRuntimeReady('degraded');
            }
            check();
          }

          function loadScriptOnce(id, src, onLoad, onError) {
            var existing = document.getElementById(id);
            if (existing && existing.getAttribute('data-drawgle-retry') === 'true') {
              existing.addEventListener('load', onLoad, { once: true });
              existing.addEventListener('error', onError, { once: true });
              return;
            }

            var script = document.createElement('script');
            script.id = id;
            script.src = src;
            script.setAttribute('data-drawgle-retry', 'true');
            script.onload = onLoad;
            script.onerror = onError;
            document.head.appendChild(script);
          }

          function ensureTailwindReady(callback) {
            if (styleRuntimeReady) {
              callback();
              return;
            }

            var attempts = 0;
            var startedAt = Date.now();
            function check() {
              if (window.tailwind && !window.__drawgleTailwindLoadFailed) {
                window.setTimeout(function() {
                  styleRuntimeReady = true;
                  tailwindRuntimeDegraded = false;
                  callback();
                }, 0);
                return;
              }

              if (attempts < 2) {
                attempts += 1;
                window.__drawgleTailwindLoadFailed = false;
                loadScriptOnce(
                  'drawgle-tailwind-cdn-retry-' + attempts,
                  'https://cdn.tailwindcss.com',
                  function() {
                    window.setTimeout(function() {
                      styleRuntimeReady = true;
                      tailwindRuntimeDegraded = false;
                      callback();
                    }, 0);
                  },
                  function() {
                    window.setTimeout(check, 160);
                  }
                );
                return;
              }

              if (Date.now() - startedAt < 2500) {
                window.setTimeout(check, 120);
                return;
              }

              styleRuntimeReady = true;
              tailwindRuntimeDegraded = true;
              callback();
            }
            check();
          }

           function notifyParentReady() {
            window.parent.postMessage({ type: 'drawgleIframeReady' }, '*');
          }

          var resizeObserver = null;
          
          function measureAndPostHeight() {
            if (document.documentElement.getAttribute('data-viewport-mode') === 'true') {
              return;
            }
            var content = document.getElementById('drawgle-screen-content');
            if (!content) return;
            var height = content.scrollHeight;
            var minHeight = 844;
            var maxHeight = 2000;
            var clamped = Math.min(maxHeight, Math.max(minHeight, height));
            window.parent.postMessage({ type: 'drawgleContentHeight', height: clamped }, '*');
          }

          function setupResizeObserver() {
            if (window.ResizeObserver) {
              var content = document.getElementById('drawgle-screen-content');
              if (!content) return;
              if (resizeObserver) resizeObserver.disconnect();
              resizeObserver = new ResizeObserver(function() {
                measureAndPostHeight();
              });
              resizeObserver.observe(content);
            }
          }

          window.addEventListener('message', function(event) {
            if (event.data?.type === 'setViewportMode') {
              if (event.data.enabled) {
                document.documentElement.setAttribute('data-viewport-mode', 'true');
              } else {
                document.documentElement.removeAttribute('data-viewport-mode');
                window.requestAnimationFrame(function() {
                  measureAndPostHeight();
                });
              }
            }
          });

          function refreshLucideIconsWithRetry() {
            var attempts = 0;
            function run() {
              attempts += 1;
              if (window.lucide && typeof window.lucide.createIcons === 'function') {
                window.lucide.createIcons();
                return;
              }
              if (attempts < 20) {
                window.setTimeout(run, 50);
              }
            }
            run();
          }

          function applyActiveNavigationState(activeItemId) {
            document.querySelectorAll('[data-drawgle-primary-nav] [data-nav-item-id]').forEach(function(item) {
              var active = item.getAttribute('data-nav-item-id') === activeItemId;
              item.setAttribute('data-active', active ? 'true' : 'false');
              item.setAttribute('aria-current', active ? 'page' : 'false');
            });
          }

          function applyDesignTokenCss(cssText) {
            var styleEl = document.getElementById('drawgle-project-tokens');
            if (!styleEl) {
              styleEl = document.createElement('style');
              styleEl.id = 'drawgle-project-tokens';
              document.head.appendChild(styleEl);
            }
            if (styleEl.textContent !== (cssText || '')) {
              styleEl.textContent = cssText || '';
            }
          }

          function applyGoogleFontHref(href) {
            var existing = document.getElementById('drawgle-google-font');
            if (!href) {
              if (existing) existing.remove();
              return;
            }

            if (!document.querySelector('link[data-drawgle-font-preconnect="googleapis"]')) {
              var googleApis = document.createElement('link');
              googleApis.rel = 'preconnect';
              googleApis.href = 'https://fonts.googleapis.com';
              googleApis.setAttribute('data-drawgle-font-preconnect', 'googleapis');
              document.head.appendChild(googleApis);
            }

            if (!document.querySelector('link[data-drawgle-font-preconnect="gstatic"]')) {
              var gstatic = document.createElement('link');
              gstatic.rel = 'preconnect';
              gstatic.href = 'https://fonts.gstatic.com';
              gstatic.crossOrigin = '';
              gstatic.setAttribute('data-drawgle-font-preconnect', 'gstatic');
              document.head.appendChild(gstatic);
            }

            if (!existing) {
              existing = document.createElement('link');
              existing.id = 'drawgle-google-font';
              existing.rel = 'stylesheet';
              document.head.appendChild(existing);
            }

            if (existing.getAttribute('href') !== href) {
              existing.setAttribute('href', href);
            }
          }

          function renderScreenContent(code) {
            var contentHost = document.getElementById('drawgle-screen-content');
            if (!contentHost) return;
            contentHost.innerHTML = code || '';
            refreshLucideIconsWithRetry();
          }

          function renderNavigation(shellCode, activeItemId) {
            var root = document.getElementById('root');
            var host = document.getElementById('drawgle-navigation-host');
            if (!root || !host) return;
            var hasNavigation = Boolean(shellCode);
            root.setAttribute('data-has-navigation', hasNavigation ? 'true' : 'false');
            if (host.getAttribute('data-shell-code') !== shellCode) {
              host.innerHTML = shellCode || '';
              host.setAttribute('data-shell-code', shellCode || '');
            }
            applyActiveNavigationState(activeItemId || '');
            refreshLucideIconsWithRetry();
          }

          var interactionModeActive = false;
          var touchScrollState = null;
          var canvasPinchState = null;
          var canvasPanActive = false;
          var spacePressed = false;

          function postCanvasNavigation(payload) {
            window.parent.postMessage(payload, '*');
          }

          function getScreenContentHost() {
            return document.getElementById('drawgle-screen-content');
          }

          function focusScreenContentHost() {
            var contentHost = getScreenContentHost();
            if (!contentHost) return;
            if (!contentHost.hasAttribute('tabindex')) {
              contentHost.setAttribute('tabindex', '-1');
            }
            try {
              contentHost.focus({ preventScroll: true });
            } catch (error) {
              contentHost.focus();
            }
          }

          function canScrollVertically(el) {
            if (!el) return false;
            return el.scrollHeight > el.clientHeight + 1;
          }

          function findScrollableHost(startEl) {
            var contentHost = getScreenContentHost();
            var node = startEl && startEl.nodeType === 1 ? startEl : null;

            while (node && node !== document.body && node !== document.documentElement) {
              if (node !== contentHost && canScrollVertically(node)) {
                return node;
              }
              if (node === contentHost) break;
              node = node.parentElement;
            }

            return contentHost;
          }

          function scrollHostBy(host, deltaY) {
            if (!host || !deltaY) return false;
            var previous = host.scrollTop;
            host.scrollTop += deltaY;
            return host.scrollTop !== previous;
          }

          function handleInteractWheel(event) {
            if (event.ctrlKey || event.metaKey) {
              event.preventDefault();
              event.stopPropagation();
              postCanvasNavigation({
                type: 'drawgleCanvasZoom',
                clientX: event.clientX,
                clientY: event.clientY,
                deltaY: event.deltaY,
              });
              return;
            }
            if (!interactionModeActive) {
              event.preventDefault();
              event.stopPropagation();
              postCanvasNavigation({
                type: 'drawgleCanvasPanBy',
                deltaX: -event.deltaX,
                deltaY: -event.deltaY,
              });
              return;
            }
            var host = findScrollableHost(event.target);
            if (!host) return;
            event.preventDefault();
            event.stopPropagation();
            if (!scrollHostBy(host, event.deltaY) && host !== getScreenContentHost()) {
              scrollHostBy(getScreenContentHost(), event.deltaY);
            }
          }

          function handleInteractTouchStart(event) {
            if (!event.touches) return;
            if (event.touches.length === 2) {
              var firstTouch = event.touches[0];
              var secondTouch = event.touches[1];
              canvasPinchState = {
                distance: Math.hypot(secondTouch.clientX - firstTouch.clientX, secondTouch.clientY - firstTouch.clientY),
              };
              touchScrollState = null;
              event.preventDefault();
              event.stopPropagation();
              return;
            }
            if (!interactionModeActive) return;
            if (event.touches.length !== 1) return;
            touchScrollState = {
              y: event.touches[0].clientY,
              host: findScrollableHost(event.target),
            };
          }

          function handleInteractTouchMove(event) {
            if (!event.touches) return;
            if (event.touches.length === 2 && canvasPinchState) {
              var firstTouch = event.touches[0];
              var secondTouch = event.touches[1];
              var nextDistance = Math.hypot(secondTouch.clientX - firstTouch.clientX, secondTouch.clientY - firstTouch.clientY);
              var centerX = (firstTouch.clientX + secondTouch.clientX) / 2;
              var centerY = (firstTouch.clientY + secondTouch.clientY) / 2;
              event.preventDefault();
              event.stopPropagation();
              postCanvasNavigation({
                type: 'drawgleCanvasZoom',
                clientX: centerX,
                clientY: centerY,
                deltaY: (canvasPinchState.distance - nextDistance) * 3,
              });
              canvasPinchState.distance = nextDistance;
              return;
            }
            if (!interactionModeActive) return;
            if (!touchScrollState || event.touches.length !== 1) return;
            var nextY = event.touches[0].clientY;
            var deltaY = touchScrollState.y - nextY;
            touchScrollState.y = nextY;
            event.preventDefault();
            event.stopPropagation();
            if (!scrollHostBy(touchScrollState.host, deltaY) && touchScrollState.host !== getScreenContentHost()) {
              scrollHostBy(getScreenContentHost(), deltaY);
            }
          }

          function handleInteractTouchEnd(event) {
            if (!event.touches || event.touches.length < 2) {
              canvasPinchState = null;
            }
            if (!event.touches || event.touches.length === 0) {
              touchScrollState = null;
            }
          }

          function handleInteractMouseDown(event) {
            if (event.button !== 1 && !(event.button === 0 && spacePressed)) return;
            event.preventDefault();
            event.stopPropagation();
            canvasPanActive = true;
            postCanvasNavigation({
              type: 'drawgleCanvasPanStart',
              clientX: event.clientX,
              clientY: event.clientY,
            });
          }

          function handleInteractMouseMove(event) {
            if (!canvasPanActive) return;
            event.preventDefault();
            event.stopPropagation();
            postCanvasNavigation({
              type: 'drawgleCanvasPanMove',
              clientX: event.clientX,
              clientY: event.clientY,
            });
          }

          function handleInteractMouseUp(event) {
            if (!canvasPanActive) return;
            event.preventDefault();
            event.stopPropagation();
            canvasPanActive = false;
            postCanvasNavigation({ type: 'drawgleCanvasPanEnd' });
          }

          function handleInteractKeyDown(event) {
            if (event.code === 'Space') {
              spacePressed = true;
            }
          }

          function handleInteractKeyUp(event) {
            if (event.code === 'Space') {
              spacePressed = false;
              if (canvasPanActive) {
                canvasPanActive = false;
                postCanvasNavigation({ type: 'drawgleCanvasPanEnd' });
              }
            }
          }

          function enterInteractMode() {
            interactionModeActive = true;
            focusScreenContentHost();
          }

          function exitInteractMode() {
            interactionModeActive = false;
            touchScrollState = null;
            canvasPinchState = null;
            canvasPanActive = false;
            postCanvasNavigation({ type: 'drawgleCanvasPanEnd' });
          }

          document.addEventListener('wheel', handleInteractWheel, { capture: true, passive: false });
          document.addEventListener('touchstart', handleInteractTouchStart, { capture: true, passive: false });
          document.addEventListener('touchmove', handleInteractTouchMove, { capture: true, passive: false });
          document.addEventListener('touchend', handleInteractTouchEnd, { capture: true, passive: true });
          document.addEventListener('mousedown', handleInteractMouseDown, true);
          document.addEventListener('mousemove', handleInteractMouseMove, true);
          document.addEventListener('mouseup', handleInteractMouseUp, true);
          window.addEventListener('keydown', handleInteractKeyDown, true);
          window.addEventListener('keyup', handleInteractKeyUp, true);

          function applyRenderPayload(payload) {
            var revision = ++renderRevision;
            var wasStyleReady = document.documentElement.hasAttribute('data-drawgle-style-ready');
            setStyleRuntimePending();
            applyGoogleFontHref(payload.googleFontHref || '');
            applyDesignTokenCss(payload.tokenCss || '');
            renderScreenContent(payload.code || '');
            renderNavigation(payload.navigationCode || '', payload.activeNavigationItemId || '');
            if (wasStyleReady || tailwindRuntimeDegraded) {
              markStyleRuntimeReady(tailwindRuntimeDegraded ? 'degraded' : 'ready');
            } else {
              waitForRenderedStylesReady(revision);
            }
            if (interactionModeActive) focusScreenContentHost();
            setupResizeObserver();
            window.requestAnimationFrame(function() {
              measureAndPostHeight();
            });
          }

          applyGoogleFontHref(initialGoogleFontHref || '');
          applyDesignTokenCss(initialTokenCss);
          queuedRenderPayload = {
            code: initialScreenCode,
            navigationCode: initialNavigationCode,
            activeNavigationItemId: initialActiveNavigationItemId,
            tokenCss: initialTokenCss,
            googleFontHref: initialGoogleFontHref,
            selectedDrawgleId: null,
          };

          /* ── Element selection engine ──────────────────────────── */
          (function() {
            var selectionActive = false;
            var hoveredEl = null;
            var selectedEl = null;
            var currentSelectedDrawgleId = null;
            var activePreview = null;

            function restorePreview() {
              if (!activePreview || !activePreview.el) return;
              if (activePreview.originalStyle === null) activePreview.el.removeAttribute('style');
              else activePreview.el.setAttribute('style', activePreview.originalStyle);
              if (activePreview.originalClass === null) activePreview.el.removeAttribute('class');
              else activePreview.el.setAttribute('class', activePreview.originalClass);
              activePreview = null;
            }

            function applyElementPreview(payload) {
              restorePreview();
              var drawgleId = payload && payload.drawgleId;
              if (!drawgleId) return;
              var target = document.querySelector('[data-drawgle-id="' + String(drawgleId).replace(/"/g, '\\"') + '"]');
              if (!target) return;

              activePreview = {
                el: target,
                originalStyle: target.getAttribute('style'),
                originalClass: target.getAttribute('class'),
              };

              if (typeof payload.className === 'string') {
                if (payload.className.trim()) target.setAttribute('class', payload.className.trim());
                else target.removeAttribute('class');
              }

              var styles = payload.styles || {};
              Object.keys(styles).forEach(function(property) {
                var value = styles[property];
                if (value === null || value === undefined || value === '') target.style.removeProperty(property);
                else target.style.setProperty(property, String(value));
              });
            }

            /* Tags that are too granular to be useful edit targets */
            var LEAF_TAGS = new Set([
              'SPAN','B','I','EM','STRONG','SMALL','BR','HR','IMG',
              'SVG','PATH','CIRCLE','RECT','LINE','POLYLINE','POLYGON',
              'ELLIPSE','G','DEFS','CLIPPATH','USE','STOP',
              'LINEARGRADIENT','RADIALGRADIENT','TEXT','TSPAN',
            ]);

            function hasDrawgleId(el) {
              return Boolean(el && el.getAttribute && el.getAttribute('data-drawgle-id'));
            }

            function nearestDrawgleElement(el) {
              if (!el || !el.closest) return null;
              var nearest = el.closest('[data-drawgle-id]');
              var root = document.getElementById('root');
              if (!nearest || nearest === root) return null;
              return nearest;
            }

            /* Walk up from a clicked leaf to the nearest meaningful container */
            function resolveTarget(el) {
              var root = document.getElementById('root');
              if (!root || !el) return null;
              var navRoot = el.closest && el.closest('[data-drawgle-primary-nav]');
              
              var node = el;
              var maxWalk = 12;
              while (node && node !== root && node !== navRoot && maxWalk-- > 0) {
                /* Stop bubbling if this element has layout classes or multiple children */
                if (!LEAF_TAGS.has(node.tagName)) {
                  var childElements = node.querySelectorAll(':scope > *');
                  if (childElements.length >= 2 || (node.innerHTML && node.innerHTML.length > 80)) {
                    return hasDrawgleId(node) ? node : nearestDrawgleElement(el);
                  }
                }
                node = node.parentElement;
              }
              
              var nearest = nearestDrawgleElement(el);
              if (nearest) return nearest;
              
              if (navRoot) return hasDrawgleId(navRoot) ? navRoot : null;
              return null;
            }


            function stripHtml(html) {
              var tmp = document.createElement('div');
              tmp.innerHTML = html;
              return (tmp.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 120);
            }

            function buildBreadcrumb(el) {
              var parts = [];
              var node = el;
              var root = document.getElementById('root');
              while (node && node !== root && node !== document.body) {
                var tag = node.tagName.toLowerCase();
                var parent = node.parentElement;
                if (parent) {
                  var siblings = Array.from(parent.children).filter(function(c) { return c.tagName === node.tagName; });
                  if (siblings.length > 1) {
                    tag += ':nth-child(' + (Array.from(parent.children).indexOf(node) + 1) + ')';
                  }
                }
                parts.unshift(tag);
                node = parent;
              }
              return parts.join(' > ');
            }

            function toRectPayload(rect) {
              return {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
                top: rect.top,
                right: rect.right,
                bottom: rect.bottom,
                left: rect.left,
              };
            }

            function buildStylePayload(el) {
              var style = window.getComputedStyle(el);
              return {
                backgroundColor: style.backgroundColor,
                color: style.color,
                fontSize: style.fontSize,
                fontWeight: style.fontWeight,
                lineHeight: style.lineHeight,
                fontFamily: style.fontFamily,
                borderRadius: style.borderRadius,
                paddingTop: style.paddingTop,
                paddingRight: style.paddingRight,
                paddingBottom: style.paddingBottom,
                paddingLeft: style.paddingLeft,
                marginTop: style.marginTop,
                marginRight: style.marginRight,
                marginBottom: style.marginBottom,
                marginLeft: style.marginLeft,
                gap: style.gap,
                borderColor: style.borderColor,
                borderWidth: style.borderWidth,
                boxShadow: style.boxShadow,
                width: style.width,
                height: style.height,
                minHeight: style.minHeight,
                maxWidth: style.maxWidth,
                opacity: style.opacity,
              };
            }

            var INSPECTED_STYLE_PROPERTIES = ${styleInspectionProperties};

            function buildStyleInspectionPayload(el) {
              var style = window.getComputedStyle(el);
              var inlineStyle = {};
              var computedStyle = {};

              INSPECTED_STYLE_PROPERTIES.forEach(function(property) {
                inlineStyle[property] = el.style ? (el.style.getPropertyValue(property) || '').trim() : '';
                computedStyle[property] = (style.getPropertyValue(property) || '').trim();
              });

              return {
                tagName: el.tagName.toLowerCase(),
                classList: Array.from(el.classList || []).filter(function(className) {
                  return className !== '__drawgle-hover-outline' && className !== '__drawgle-selected-outline';
                }),
                inlineStyle: inlineStyle,
                computedStyle: computedStyle,
              };
            }

            function isEditableTextElement(el) {
              if (!el || !el.getAttribute || !el.getAttribute('data-drawgle-id')) return false;
              if (['SCRIPT','STYLE','SVG','PATH','IMG','INPUT','TEXTAREA','SELECT'].includes(el.tagName)) return false;
              if (el.children && el.children.length > 0) return false;
              var text = (el.textContent || '').replace(/\\s+/g, ' ').trim();
              return text.length > 0;
            }

            function collectTextNodes(target) {
              var candidates = [target].concat(Array.from(target.querySelectorAll('[data-drawgle-id]')));
              return candidates
                .filter(isEditableTextElement)
                .slice(0, 24)
                .map(function(el) {
                  return {
                    drawgleId: el.getAttribute('data-drawgle-id'),
                    tagName: el.tagName.toLowerCase(),
                    text: (el.textContent || '').replace(/\\s+/g, ' ').trim(),
                  };
                });
            }

            function imageUrlFromBackground(value) {
              var match = String(value || '').match(/url\\((['"]?)(.*?)\\1\\)/i);
              return match && match[2] && match[2] !== 'none' ? match[2] : '';
            }

            function collectImageTargets(target) {
              var candidates = [target].concat(Array.from(target.querySelectorAll('[data-drawgle-id]')));
              var seen = new Set();
              var imageTargets = [];

              function pushTarget(targetInfo) {
                var key = targetInfo.drawgleId + ':' + targetInfo.kind + ':' + (targetInfo.targetIndex || 0);
                if (seen.has(key)) return;
                seen.add(key);
                imageTargets.push(targetInfo);
              }

              candidates.forEach(function(el) {
                if (!el || !el.getAttribute) return;
                var drawgleId = el.getAttribute('data-drawgle-id');
                if (!drawgleId) return;

                if (el.tagName === 'IMG') {
                  pushTarget({
                    drawgleId: drawgleId,
                    kind: 'img',
                    tagName: 'img',
                    src: el.getAttribute('src') || '',
                    alt: el.getAttribute('alt') || '',
                    label: el.getAttribute('alt') || 'Image',
                  });
                  return;
                }

                var backgroundUrl = imageUrlFromBackground(window.getComputedStyle(el).getPropertyValue('background-image'));
                if (backgroundUrl) {
                  pushTarget({
                    drawgleId: drawgleId,
                    kind: 'background',
                    tagName: el.tagName.toLowerCase(),
                    src: backgroundUrl,
                    alt: '',
                    label: 'Background image',
                  });
                }
              });

              Array.from(target.querySelectorAll('svg')).forEach(function(svg) {
                if (!svg || !svg.closest) return;
                var owner = svg.closest('[data-drawgle-id]');
                if (!owner || !target.contains(owner)) return;
                var drawgleId = owner.getAttribute('data-drawgle-id');
                if (!drawgleId) return;
                var allSvgInOwner = Array.from(owner.querySelectorAll('svg'));
                var targetIndex = Math.max(0, allSvgInOwner.indexOf(svg));
                pushTarget({
                  drawgleId: drawgleId,
                  kind: 'inline_svg',
                  tagName: owner.tagName.toLowerCase(),
                  src: '',
                  alt: '',
                  label: 'SVG placeholder',
                  targetIndex: targetIndex,
                });
              });

              if (imageTargets.length === 0) {
                var targetStyle = window.getComputedStyle(target);
                var targetRect = target.getBoundingClientRect();
                var text = (target.textContent || '').replace(/\\s+/g, ' ').trim();
                var looksVisual =
                  targetRect.width >= 56 &&
                  targetRect.height >= 56 &&
                  text.length <= 80 &&
                  (
                    targetStyle.backgroundImage && targetStyle.backgroundImage !== 'none' ||
                    targetStyle.borderRadius && targetStyle.borderRadius !== '0px' ||
                    /absolute|relative|rounded|shadow|gradient|object|image|media|visual/i.test(target.className || '')
                  );
                if (looksVisual) {
                  pushTarget({
                    drawgleId: target.getAttribute('data-drawgle-id'),
                    kind: 'visual_placeholder',
                    tagName: target.tagName.toLowerCase(),
                    src: '',
                    alt: '',
                    label: 'Visual placeholder',
                    targetIndex: 0,
                  });
                }
              }

              return imageTargets.slice(0, 6);
            }

            function buildLayoutContext(target) {
              var parent = target.parentElement;
              var parentStyle = parent ? window.getComputedStyle(parent) : null;
              var siblings = parent ? Array.from(parent.children) : [];
              return {
                parentTagName: parent ? parent.tagName.toLowerCase() : null,
                parentDisplay: parentStyle ? parentStyle.display : null,
                parentFlexDirection: parentStyle ? parentStyle.flexDirection : null,
                childIndex: siblings.indexOf(target),
                siblingCount: siblings.length,
                childrenCount: target.children ? target.children.length : 0,
              };
            }

            function buildRiskFlags(target) {
              var screenContent = document.getElementById('drawgle-screen-content');
              var targetStyle = window.getComputedStyle(target);
              var childrenCount = target.children ? target.children.length : 0;
              var isNavigationRoot = Boolean(target.closest && target.matches && target.matches('[data-drawgle-primary-nav]'));
              var isRootLike = Boolean(screenContent && target.parentElement === screenContent) || isNavigationRoot;
              return {
                isRootLike: isRootLike,
                isNavigationRoot: isNavigationRoot,
                affectsManyChildren: childrenCount >= 6 || (target.textContent || '').length > 800,
                absolutePositioned: ['absolute', 'fixed', 'sticky'].indexOf(targetStyle.position) >= 0,
              };
            }
            function buildEditableMetadata(target) {
              return {
                tagName: target.tagName.toLowerCase(),
                textNodes: collectTextNodes(target),
                imageTargets: collectImageTargets(target),
                style: buildStylePayload(target),
                styleInspection: buildStyleInspectionPayload(target),
                layoutContext: buildLayoutContext(target),
                riskFlags: buildRiskFlags(target),
              };
            }

            function cleanOuterHTML(target) {
              var clone = target.cloneNode(true);
              clone.querySelectorAll('.__drawgle-hover-outline').forEach(function(el) {
                el.classList.remove('__drawgle-hover-outline');
              });
              clone.querySelectorAll('.__drawgle-selected-outline').forEach(function(el) {
                el.classList.remove('__drawgle-selected-outline');
              });
              clone.classList.remove('__drawgle-hover-outline', '__drawgle-selected-outline');
              return clone.outerHTML;
            }

            function postElementSelected(target, reason) {
              if (!hasDrawgleId(target)) return false;
              window.parent.postMessage({
                type: 'elementSelected',
                outerHTML: cleanOuterHTML(target),
                drawgleId: target.getAttribute('data-drawgle-id'),
                targetType: target.closest && target.closest('[data-drawgle-primary-nav]') ? 'navigation' : 'screen',
                boundingRect: toRectPayload(target.getBoundingClientRect()),
                editableMetadata: buildEditableMetadata(target),
                textPreview: stripHtml(target.innerHTML),
                breadcrumb: buildBreadcrumb(target),
                selectionReason: reason || 'click',
              }, '*');
              return true;
            }

            function postSelectionLost(drawgleId, reason) {
              if (!drawgleId) return;
              window.parent.postMessage({
                type: 'elementSelectionLost',
                drawgleId: drawgleId,
                reason: reason || 'source_changed',
              }, '*');
            }

            function clearHover() {
              if (hoveredEl) {
                hoveredEl.classList.remove('__drawgle-hover-outline');
                hoveredEl = null;
              }
            }

            function clearSelected() {
              if (selectedEl) {
                selectedEl.classList.remove('__drawgle-selected-outline');
                selectedEl = null;
              }
            }

            function onMouseOver(e) {
              if (!selectionActive) return;
              e.stopPropagation();
              var target = resolveTarget(e.target);
              if (!target) {
                clearHover();
                return;
              }
              if (target === hoveredEl) return;
              clearHover();
              hoveredEl = target;
              hoveredEl.classList.add('__drawgle-hover-outline');
            }

            function onMouseOut(e) {
              if (!selectionActive) return;
              clearHover();
            }

            function onClick(e) {
              if (!selectionActive) return;
              e.preventDefault();
              e.stopPropagation();
              clearHover();
              var previousSelectedDrawgleId = currentSelectedDrawgleId;
              clearSelected();
              var target = resolveTarget(e.target);
              if (!target || !hasDrawgleId(target)) {
                currentSelectedDrawgleId = null;
                if (previousSelectedDrawgleId) postSelectionLost(previousSelectedDrawgleId, 'click_miss');
                return;
              }
              selectedEl = target;
              selectedEl.classList.add('__drawgle-selected-outline');
              currentSelectedDrawgleId = target.getAttribute('data-drawgle-id');
              postElementSelected(target, 'click');
            }

            function enableSelection() {
              if (selectionActive) return;
              selectionActive = true;
              document.body.style.cursor = 'crosshair';
              document.addEventListener('mouseover', onMouseOver, true);
              document.addEventListener('mouseout', onMouseOut, true);
              document.addEventListener('click', onClick, true);
            }

            function disableSelection() {
              selectionActive = false;
              document.body.style.cursor = '';
              clearHover();
              document.removeEventListener('mouseover', onMouseOver, true);
              document.removeEventListener('mouseout', onMouseOut, true);
              document.removeEventListener('click', onClick, true);
            }

            function selectByDrawgleId(drawgleId, options) {
              options = options || {};
              clearSelected();
              currentSelectedDrawgleId = drawgleId || null;
              if (!drawgleId) return false;
              var nextSelected = document.querySelector('[data-drawgle-id="' + String(drawgleId).replace(/"/g, '\\"') + '"]');
              if (!nextSelected) {
                if (options.notifyLost) postSelectionLost(drawgleId, options.lostReason || 'source_changed');
                return false;
              }
              selectedEl = nextSelected;
              selectedEl.classList.add('__drawgle-selected-outline');
              if (options.notifySelected) postElementSelected(nextSelected, 'rehydrated');
              return true;
            }

            window.addEventListener('message', function(event) {
              if (!event.data) return;
              if (event.data.type === 'updateCode') {
                restorePreview();
                /* Preserve selection state across live code updates */
                var wasActive = selectionActive;
                var hasSelectedDrawgleId = Object.prototype.hasOwnProperty.call(event.data, 'selectedDrawgleId');
                var selectedBeforeRender = hasSelectedDrawgleId
                  ? (event.data.selectedDrawgleId || null)
                  : (currentSelectedDrawgleId || null);
                if (wasActive) disableSelection();
                queuedRenderPayload = {
                  code: event.data.code || '',
                  navigationCode: event.data.navigationCode || '',
                  activeNavigationItemId: event.data.activeNavigationItemId || '',
                  tokenCss: event.data.tokenCss || '',
                  googleFontHref: event.data.googleFontHref || '',
                  selectedDrawgleId: selectedBeforeRender,
                };
                pendingSelectedDrawgleId = selectedBeforeRender;
                if (styleRuntimeReady) {
                  applyRenderPayload(queuedRenderPayload);
                  if (pendingSelectedDrawgleId) {
                    selectByDrawgleId(pendingSelectedDrawgleId, { notifySelected: true, notifyLost: true, lostReason: 'rehydrate_failed' });
                    pendingSelectedDrawgleId = null;
                  }
                }
                if (wasActive) enableSelection();
              } else if (event.data.type === 'previewSelectedElement') {
                applyElementPreview(event.data);
              } else if (event.data.type === 'clearSelectedElementPreview') {
                restorePreview();
              } else if (event.data.type === 'updateDesignTokenCss') {
                applyGoogleFontHref(event.data.googleFontHref || '');
                applyDesignTokenCss(event.data.tokenCss || '');
              } else if (event.data.type === 'enableSelectionMode') {
                enableSelection();
              } else if (event.data.type === 'disableSelectionMode') {
                disableSelection();
              } else if (event.data.type === 'setSelectedDrawgleId') {
                selectByDrawgleId(event.data.drawgleId || null);
              } else if (event.data.type === 'enterInteractMode') {
                enterInteractMode();
              } else if (event.data.type === 'exitInteractMode') {
                exitInteractMode();
              }
            });

            ensureTailwindReady(function() {
              if (queuedRenderPayload) {
                applyRenderPayload(queuedRenderPayload);
                if (pendingSelectedDrawgleId) {
                  selectByDrawgleId(pendingSelectedDrawgleId, { notifySelected: true, notifyLost: true, lostReason: 'rehydrate_failed' });
                  pendingSelectedDrawgleId = null;
                }
              }
              notifyParentReady();
            });
          })();
        <\/script>
      </body>
    </html>
  `;
  }, [
    bootstrapContent.activeNavigationItemId,
    bootstrapContent.googleFontAssetLinks,
    bootstrapContent.googleFontHref,
    bootstrapContent.navigationShellCode,
    bootstrapContent.screenCode,
    bootstrapContent.tokenCss,
    styleInspectionProperties,
  ]);

  // =========================================================================
  // Render
  // =========================================================================

  const isSelectionModeActive = Boolean(selectionMode);
  const isCanvasNavigationActive = canvasTool === "pan" || isTemporaryCanvasPan;
  // Navigation mode needs the parent-page overlay so gestures do not disappear into the iframe.
  const overlayActive =
    isCanvasNavigationActive || (!isInteractModeActive && !isSelectionModeActive);
  const overlayPointerStyle: React.CSSProperties = {
    cursor: isDragging
      ? "grabbing"
      : isCanvasNavigationActive
        ? "grab"
        : isSelected
        ? "grab"
        : "pointer",
  };

  return (
    <div
      className="relative"
      style={{
        width: SCREEN_FRAME_WIDTH,
        paddingTop: 8,
        zIndex: isSelected || isDragging ? 50 : 10,
        cursor: overlayPointerStyle.cursor,
      }}
    >
      {/* ── External label bar ─────────────────────────────────────────── */}
      <ScreenLabelBar
        screen={screen}
        isSelected={!!isSelected}
        interactMode={isInteractModeActive}
        selectionMode={isSelectionModeActive}
        onInteractToggle={() => setInteractMode((m) => !m)}
        onExport={handleExportCode}
        onDelete={handleDelete}
        onShowCode={() => setIsCodeOpen(true)}
      />

      {/* ── Flat card container ─────────────────────────────────────────── */}
      <div
        style={{
          position: 'relative',
          width: SCREEN_FRAME_WIDTH,
          height: isInteractModeActive ? SCREEN_FRAME_HEIGHT : contentHeight,
          borderRadius: 16,
          background: 'var(--dg-color-background-primary, #ffffff)',
          border: '1px solid rgba(0, 0, 0, 0.08)',
          boxShadow: (() => {
            const baseShadow = '0 10px 30px -10px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.02)';
            if (isSelectionModeActive)
              return `0 0 0 2px #0d9488, 0 0 16px rgba(13,148,136,0.2), ${baseShadow}`;
            if (isInteractModeActive)
              return `0 0 0 2px #10b981, 0 0 16px rgba(16,185,129,0.2), ${baseShadow}`;
            if (isSelected)
              return `0 0 0 2px #6366f1, 0 0 16px rgba(99,102,241,0.2), ${baseShadow}`;
            return baseShadow;
          })(),
          transition: 'box-shadow 0.22s ease, height 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
          overflow: 'hidden',
        }}
      >
        {/*
         * Drag / click overlay
         * Always present in drag mode — sits above the iframe so the
         * iframe's document never receives our pointer events.
         * Removed only when the user enters Interact Mode.
         */}
        {overlayActive && (
          <div
            className="absolute inset-0 touch-none"
            style={{ zIndex: 10, ...overlayPointerStyle }}
            onDoubleClick={() => {
              if (canvasTool === "pointer" && isSelected && !isTemporaryCanvasPan) {
                setInteractMode(true);
                window.requestAnimationFrame(() => syncIframeInteractionMode(true));
              }
            }}
          />
        )}

        {/* Actual screen content */}
        <iframe
          ref={iframeRef}
          title={screen.name}
          className="absolute inset-0 w-full h-full border-none"
          sandbox="allow-scripts allow-same-origin"
          srcDoc={srcDoc}
          style={{
            pointerEvents: isDragging || overlayActive ? 'none' : 'auto',
            cursor: isSelectionModeActive ? 'crosshair' : undefined,
          }}
          onLoad={() => {
            iframeReadyRef.current = false;
            window.setTimeout(() => {
              iframeReadyRef.current = true;
              postCurrentRenderState(true);
            }, 120);
            // Ensure selection mode is enabled if the iframe finishes loading
            // after the selectionMode state has already been set.
            if (selectionMode && iframeRef.current?.contentWindow) {
              iframeRef.current.contentWindow.postMessage(
                { type: 'enableSelectionMode' },
                '*'
              );
            }
            if (isInteractModeActive) {
              syncIframeInteractionMode(true);
            }
          }}
        />

        <ScreenBuildPreloader visible={showBuildPreloader} />

        {selectedElementBounds && selectedElementBounds.drawgleId === selectedDrawgleId && (
          <div
            className="absolute z-[90] flex items-center gap-1 rounded-lg bg-slate-900 p-1 text-white shadow-lg select-none"
            style={{
              left: Math.max(45, Math.min(345, selectedElementBounds.left + selectedElementBounds.width / 2)),
              top: Math.max(10, selectedElementBounds.top - 46),
              transform: 'translateX(-50%)',
              height: 36,
            }}
          >
            <button
              type="button"
              className="flex h-7 w-7 items-center justify-center rounded hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
              onClick={handleInlineDelete}
              title="Delete element"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <div className="h-4 w-[1px] bg-slate-800" />
            <button
              type="button"
              className="flex h-7 w-7 items-center justify-center rounded hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
              onClick={handleInlineDuplicate}
              title="Duplicate element"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* ── Dimension badge — visible while dragging ────────────────────── */}
      <DimensionBadge visible={isDragging} height={isInteractModeActive ? SCREEN_FRAME_HEIGHT : contentHeight} />

      {/* Code Viewer Dialog */}
      <CodeViewerDialog
        isOpen={isCodeOpen}
        onOpenChange={setIsCodeOpen}
        screenName={screen.name}
        htmlExport={htmlExport}
      />
    </div>
  );
}
