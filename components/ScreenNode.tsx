"use client";

import type { DesignTokens, ProjectNavigationData, ScreenData } from "@/lib/types";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { MoreHorizontal, Download, Trash2, Edit2, Smartphone, MousePointerClick, Crosshair } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import { ensureDrawgleIds, stripDrawgleIds, type DrawgleBoundingRect, type DrawgleEditableMetadata } from "@/lib/drawgle-dom";
import { deleteScreen, updateScreenPosition } from "@/lib/supabase/queries";
import { hasSharedNavigation } from "@/lib/project-navigation";
import { buildDrawgleTokenCss } from "@/lib/token-runtime";
import { useRealtimeRunWithStreams } from "@trigger.dev/react-hooks";

/** Data sent from the iframe when the user clicks an element in selection mode. */
export interface SelectedElementInfo {
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
}

export const SCREEN_FRAME_WIDTH = 390;
export const SCREEN_FRAME_HEIGHT = 844;

/**
 * Pixels the pointer must travel before a drag is committed.
 * Anything below this is treated as a click (not a drag).
 */
const DRAG_THRESHOLD_PX = 6;
/**
 * Max ms between two taps/clicks to count as a double-click that enters
 * Interact Mode.  350 ms feels natural on both trackpad and touch.
 */
const DOUBLE_CLICK_MS = 350;

/** Strip markdown fences so the iframe always receives usable HTML. */
const stripFences = (text: string): string => {
  const match = text.match(/```(?:html)?\n([\s\S]*?)\n```/i);
  if (match) return match[1].trim();
  return text.replace(/^```html\n/i, "").replace(/\n```$/, "").trim();
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
}: {
  screen: ScreenData;
  isSelected: boolean;
  interactMode: boolean;
  selectionMode: boolean;
  onInteractToggle: () => void;
  onExport: () => void;
  onDelete: () => void;
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
                : "rgba(0,0,0,0.06)",
          }}
        >
          <Smartphone
            className="w-3.5 h-3.5 transition-colors duration-200"
            style={{ color: selectionMode ? "#0d9488" : interactMode ? "#10b981" : isSelected ? "#6366f1" : "#6b7280" }}
          />
        </div>
        <span
          className="text-[13px] font-semibold truncate max-w-[150px] leading-none transition-colors duration-200"
          style={{ color: selectionMode ? "#115e59" : interactMode ? "#064e3b" : isSelected ? "#1e1b4b" : "#374151" }}
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
            className="h-7 w-7 rounded-lg transition-colors duration-150"
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

        {/* Export */}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-lg hover:bg-indigo-50 hover:text-indigo-600 text-gray-500"
          title="Export code"
          onClick={onExport}
        >
          <Download className="w-3.5 h-3.5" />
        </Button>

        {/* More / Delete */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-lg hover:bg-gray-100 text-gray-500"
                title="More actions"
              />
            }
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="text-red-600 focus:text-red-600 focus:bg-red-50"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dimension badge — shown while dragging below the phone frame
// ---------------------------------------------------------------------------

function DimensionBadge({ visible }: { visible: boolean }) {
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
      }}
    >
      {SCREEN_FRAME_WIDTH} × {SCREEN_FRAME_HEIGHT}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main ScreenNode
// ---------------------------------------------------------------------------

export function ScreenNode({
  screen,
  projectNavigation,
  designTokens,
  isSelected,
  onClick,
  scale = 1,
  selectionMode = false,
  selectedDrawgleId = null,
  onElementSelected,
}: {
  screen: ScreenData;
  projectNavigation?: ProjectNavigationData | null;
  designTokens?: DesignTokens | null;
  isSelected?: boolean;
  onClick?: () => void;
  scale?: number;
  /** When true, the iframe enters element-selection mode (hover outlines, click-to-select). */
  selectionMode?: boolean;
  /** Stable selected element id to keep highlighted even after selection mode exits. */
  selectedDrawgleId?: string | null;
  /** Called when the user clicks an element inside the iframe during selection mode. */
  onElementSelected?: (info: SelectedElementInfo) => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const safeCode = typeof screen.code === "string" ? screen.code : "";

  // ── Visual position state (drives the CSS `left`/`top`).
  // Initialised from DB; updated live during drag; NOT reset on drag-end
  // until the DB value actually changes (see the sync effect below).
  const [position, setPosition] = useState({ x: screen.x, y: screen.y });
  const [isDraggingState, setIsDraggingState] = useState(false);

  // ── "Interact mode" lets the user scroll/tap the iframe content.
  // It is only active while the screen is selected.
  const [interactMode, setInteractMode] = useState(false);
  const isInteractModeActive = Boolean(isSelected && interactMode);

  // ── Refs that survive re-renders without triggering them.
  //
  //  isDraggingRef   — shadow of isDraggingState used inside effects that
  //                    must NOT list isDragging as a dependency (otherwise
  //                    transitioning from true→false would cause a sync
  //                    that snaps the node back to the stale DB position).
  const isDraggingRef = useRef(false);
  //
  //  livePositionRef — always holds the current drag position.  Used in
  //                    pointerup to avoid stale-closure reads of `position`
  //                    state (which may lag by one render).
  const livePositionRef = useRef({ x: screen.x, y: screen.y });
  //
  //  dragGesture     — all mutable drag bookkeeping in one place.
  const dragGesture = useRef({
    pending: false,   // true: pointerDown received, waiting for threshold
    active: false,    // true: threshold crossed, full drag in progress
    startClientX: 0,
    startClientY: 0,
    originNodeX: 0,   // node position at the moment of pointerDown
    originNodeY: 0,
    pointerId: -1,
  });
  //
  //  lastTapTimeRef  — timestamp of the previous completed tap (pointerup
  //                    without drag).  Used to detect double-click → interact.
  const lastTapTimeRef = useRef(0);

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

  const rawDisplayCode = streamedCode ?? safeCode;
  const sharedNavigationActive = hasSharedNavigation({ screen, projectNavigation });
  const displayCode = useMemo(
    () => ensureDrawgleIds(sharedNavigationActive ? stripSharedNavigationMarkup(rawDisplayCode) : rawDisplayCode).code,
    [rawDisplayCode, sharedNavigationActive],
  );
  const navigationShellCode = sharedNavigationActive ? ensureDrawgleIds(projectNavigation?.shellCode ?? "").code : "";
  const lastNonEmptyDisplayCodeRef = useRef(displayCode.trim() ? displayCode : "");
  const lastNonEmptyNavigationCodeRef = useRef(navigationShellCode.trim() ? navigationShellCode : "");
  const activeNavigationItemId = sharedNavigationActive ? screen.navigationItemId ?? "" : "";
  const tokenCss = useMemo(() => buildDrawgleTokenCss(designTokens), [designTokens]);
  const [bootstrapContent] = useState(() => ({
    screenCode: displayCode,
    navigationShellCode,
    activeNavigationItemId,
    tokenCss,
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
      },
      "*",
    );
  }, [activeNavigationItemId, displayCode, navigationShellCode, sharedNavigationActive, tokenCss]);

  const handleExportCode = useCallback(() => {
    const cleanScreenCode = stripDrawgleIds(displayCode.trim() ? displayCode : lastNonEmptyDisplayCodeRef.current);
    const cleanNavigationCode = stripDrawgleIds(
      sharedNavigationActive
        ? navigationShellCode.trim()
          ? navigationShellCode
          : lastNonEmptyNavigationCodeRef.current
        : "",
    );
    const exportCode = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <script src="https://cdn.tailwindcss.com"><\/script>
    <script src="https://unpkg.com/lucide@latest"><\/script>
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
  }, [activeNavigationItemId, displayCode, navigationShellCode, screen.name, sharedNavigationActive, tokenCss]);

  // ── Position sync from DB
  //
  // IMPORTANT: `isDraggingState` is intentionally NOT in the dependency array.
  // We guard via `isDraggingRef` (a plain ref) so that when isDragging flips
  // false at drag-end this effect does NOT re-run — which would snap the node
  // back to the stale DB value before the Supabase write has propagated.
  // The effect only re-runs when screen.x / screen.y themselves change, which
  // happens only after a successful DB round-trip.
  useEffect(() => {
    if (isDraggingRef.current) return;
    const newPos = { x: screen.x, y: screen.y };
    livePositionRef.current = newPos;
    setPosition(newPos);
  }, [screen.x, screen.y]); // ← isDragging deliberately omitted — see above

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
      if (event.data?.type !== "drawgleIframeReady") return;
      iframeReadyRef.current = true;
      postCurrentRenderState(true);
      syncIframeInteractionMode(isInteractModeActive);
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
  }, [isInteractModeActive, postCurrentRenderState, selectedDrawgleId, selectionMode, syncIframeInteractionMode]);

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

  // ── Listen for elementSelected messages from the iframe
  useEffect(() => {
    if (!selectionMode || !onElementSelected) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (event.data?.type !== 'elementSelected') return;

      const { outerHTML, drawgleId, textPreview, breadcrumb, boundingRect, editableMetadata } = event.data as {
        type: string;
        outerHTML: string;
        drawgleId?: string | null;
        targetType?: "screen" | "navigation";
        boundingRect?: DrawgleBoundingRect | null;
        editableMetadata?: DrawgleEditableMetadata | null;
        textPreview: string;
        breadcrumb: string;
      };

      if (outerHTML) {
        const screenRect = iframeRef.current?.getBoundingClientRect() ?? null;
        onElementSelected({
          outerHTML,
          drawgleId: drawgleId ?? null,
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
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [selectionMode, onElementSelected]);

  // ── Delete
  const handleDelete = useCallback(async () => {
    try {
      const supabase = createClient();
      await deleteScreen(supabase, screen.id);
    } catch (err) {
      console.error("Failed to delete screen", err);
    }
  }, [screen.id]);

  const handleSelect = useCallback(() => {
    setInteractMode(false);
    lastTapTimeRef.current = 0;
    onClick?.();
  }, [onClick]);

  // =========================================================================
  // Drag — all handled on the TRANSPARENT OVERLAY inside the phone frame.
  //
  // Why an overlay and not the outer wrapper?
  //
  // An iframe is a separate browsing context.  Any pointer event that starts
  // inside it is consumed by the iframe's own document and never bubbles up
  // to the React tree.  setPointerCapture() on the outer div only works if
  // OUR div receives the pointerdown first — which it won't when the pointer
  // lands on the iframe.
  //
  // The solution: a transparent `<div>` sitting at z-index 10 above the
  // iframe.  It intercepts every pointer event on the phone body.  When the
  // user toggles "interact mode" this overlay becomes pointer-events:none so
  // the iframe is directly reachable.
  // =========================================================================

  const handleOverlayPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      // Primary button only (left-click or touch)
      if (e.button !== 0 && e.pointerType === "mouse") return;

      e.preventDefault();           // prevent text selection on drag
      e.stopPropagation();          // don't let react-zoom-pan-pinch start panning

      // Capture so that pointermove/up still arrive even when the pointer
      // leaves our element boundary.
      e.currentTarget.setPointerCapture(e.pointerId);

      const origin = livePositionRef.current;
      dragGesture.current = {
        pending: true,
        active: false,
        startClientX: e.clientX,
        startClientY: e.clientY,
        originNodeX: origin.x,
        originNodeY: origin.y,
        pointerId: e.pointerId,
      };
    },
    [],
  );

  const handleOverlayPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const g = dragGesture.current;
      if (!g.pending) return;

      const rawDx = e.clientX - g.startClientX;
      const rawDy = e.clientY - g.startClientY;

      // Don't commit to a drag until the pointer has moved far enough.
      // This lets small twitches on click pass through as selection events.
      if (!g.active) {
        const dist = Math.hypot(rawDx, rawDy);
        if (dist < DRAG_THRESHOLD_PX) return;
        g.active = true;
        isDraggingRef.current = true;
        setIsDraggingState(true);
      }

      e.stopPropagation();

      // Divide by `scale` to convert screen pixels → canvas-space pixels
      const newPos = {
        x: g.originNodeX + rawDx / scale,
        y: g.originNodeY + rawDy / scale,
      };

      // Keep the ref always in sync — used by pointerup to avoid stale state
      livePositionRef.current = newPos;
      setPosition(newPos);
    },
    [scale],
  );

  const handleOverlayPointerUp = useCallback(
    async (e: React.PointerEvent<HTMLDivElement>) => {
      const g = dragGesture.current;
      if (!g.pending) return;

      e.currentTarget.releasePointerCapture(g.pointerId);
      const wasDragging = g.active;

      // Reset gesture state
      g.pending = false;
      g.active = false;
      isDraggingRef.current = false;
      setIsDraggingState(false);

      if (!wasDragging) {
        const now = Date.now();
        const gap = now - lastTapTimeRef.current;

        if (gap > 0 && gap < DOUBLE_CLICK_MS) {
          if (!isSelected) {
            handleSelect();
          }
          setInteractMode(true);
          lastTapTimeRef.current = 0;
          window.requestAnimationFrame(() => syncIframeInteractionMode(true));
          return;
        }

        if (!isSelected) {
          lastTapTimeRef.current = now;
          // Unselected screen tapped → select it
          handleSelect();
        } else {
          // Already selected — check for double-tap to enter interact mode.
          const now = Date.now();
          const gap = now - lastTapTimeRef.current;
          if (gap > 0 && gap < DOUBLE_CLICK_MS) {
            // Double-tap detected → enter interact mode
            setInteractMode(true);
            lastTapTimeRef.current = 0; // reset so triple-tap doesn't re-trigger
          } else {
            lastTapTimeRef.current = now;
          }
        }
        return;
      }

      e.stopPropagation();

      // Read the LIVE position from the ref, not from state closure
      // (state may be one render behind the last pointermove).
      const finalPos = livePositionRef.current;

      // Fire-and-forget: we already show the optimistic position; the next
      // screen.x/screen.y prop update from the DB will confirm it.
      const supabase = createClient();
      updateScreenPosition(supabase, screen.id, finalPos.x, finalPos.y).catch(
        (err) => console.error("Failed to save screen position", err),
      );
    },
    [handleSelect, isSelected, screen.id, syncIframeInteractionMode],
  );

  const handleOverlayPointerCancel = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const g = dragGesture.current;
      if (!g.pending) return;
      e.currentTarget.releasePointerCapture(g.pointerId);
      g.pending = false;
      g.active = false;
      isDraggingRef.current = false;
      setIsDraggingState(false);

      // Pointer was cancelled by the OS (e.g. incoming call on mobile)
      // Snap back to the last known good position.
      const recovered = { x: screen.x, y: screen.y };
      livePositionRef.current = recovered;
      setPosition(recovered);
    },
    [screen.x, screen.y],
  );

  // =========================================================================
  // iframe srcDoc
  // =========================================================================

  const srcDoc = useMemo(() => {
    const initialScreenCode = bootstrapContent.screenCode;
    const initialNavigationCode = bootstrapContent.navigationShellCode;
    const initialActiveNavigationItemId = bootstrapContent.activeNavigationItemId;
    const initialTokenCss = bootstrapContent.tokenCss;

    return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script id="drawgle-tailwind-cdn" src="https://cdn.tailwindcss.com" onerror="window.__drawgleTailwindLoadFailed = true"><\/script>
        <script src="https://unpkg.com/lucide@latest"><\/script>
        <style>
          html, body { width: 100%; height: 100%; margin: 0; padding: 0; overscroll-behavior: none; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; overflow: hidden; }
          ::-webkit-scrollbar { display: none; width: 0; height: 0; }
          * { -ms-overflow-style: none; scrollbar-width: none; }
          #root { position: relative; width: 100%; height: 100vh; overflow: hidden; background: transparent; }
          html:not([data-drawgle-style-ready]) #root { visibility: hidden; }
          #drawgle-screen-content { width: 100%; height: 100%; overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; touch-action: pan-y; }
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
          var styleRuntimeReady = false;
          var queuedRenderPayload = null;

          function markStyleRuntimeReady(mode) {
            styleRuntimeReady = true;
            window.requestAnimationFrame(function() {
              document.documentElement.setAttribute('data-drawgle-style-ready', mode || 'ready');
            });
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
                  markStyleRuntimeReady('ready');
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
                      markStyleRuntimeReady('ready');
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

              markStyleRuntimeReady('degraded');
              callback();
            }
            check();
          }

          function notifyParentReady() {
            window.parent.postMessage({ type: 'drawgleIframeReady' }, '*');
          }

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
            if (!interactionModeActive) return;
            var host = findScrollableHost(event.target);
            if (!host) return;
            event.preventDefault();
            event.stopPropagation();
            if (!scrollHostBy(host, event.deltaY) && host !== getScreenContentHost()) {
              scrollHostBy(getScreenContentHost(), event.deltaY);
            }
          }

          function handleInteractTouchStart(event) {
            if (!interactionModeActive || !event.touches || event.touches.length !== 1) return;
            touchScrollState = {
              y: event.touches[0].clientY,
              host: findScrollableHost(event.target),
            };
          }

          function handleInteractTouchMove(event) {
            if (!interactionModeActive || !touchScrollState || !event.touches || event.touches.length !== 1) return;
            var nextY = event.touches[0].clientY;
            var deltaY = touchScrollState.y - nextY;
            touchScrollState.y = nextY;
            event.preventDefault();
            event.stopPropagation();
            if (!scrollHostBy(touchScrollState.host, deltaY) && touchScrollState.host !== getScreenContentHost()) {
              scrollHostBy(getScreenContentHost(), deltaY);
            }
          }

          function enterInteractMode() {
            interactionModeActive = true;
            focusScreenContentHost();
          }

          function exitInteractMode() {
            interactionModeActive = false;
            touchScrollState = null;
          }

          document.addEventListener('wheel', handleInteractWheel, { capture: true, passive: false });
          document.addEventListener('touchstart', handleInteractTouchStart, { capture: true, passive: true });
          document.addEventListener('touchmove', handleInteractTouchMove, { capture: true, passive: false });

          function applyRenderPayload(payload) {
            applyDesignTokenCss(payload.tokenCss || '');
            renderScreenContent(payload.code || '');
            renderNavigation(payload.navigationCode || '', payload.activeNavigationItemId || '');
            if (interactionModeActive) focusScreenContentHost();
          }

          applyDesignTokenCss(initialTokenCss);
          queuedRenderPayload = {
            code: initialScreenCode,
            navigationCode: initialNavigationCode,
            activeNavigationItemId: initialActiveNavigationItemId,
            tokenCss: initialTokenCss,
          };

          /* ── Element selection engine ──────────────────────────── */
          (function() {
            var selectionActive = false;
            var hoveredEl = null;
            var selectedEl = null;

            /* Tags that are too granular to be useful edit targets */
            var LEAF_TAGS = new Set([
              'SPAN','B','I','EM','STRONG','SMALL','BR','HR','IMG',
              'SVG','PATH','CIRCLE','RECT','LINE','POLYLINE','POLYGON',
              'ELLIPSE','G','DEFS','CLIPPATH','USE','STOP',
              'LINEARGRADIENT','RADIALGRADIENT','TEXT','TSPAN',
            ]);

            /* Walk up from a clicked leaf to the nearest meaningful container */
            function resolveTarget(el) {
              var root = document.getElementById('root');
              if (!root) return el;
              var navRoot = el.closest && el.closest('[data-drawgle-primary-nav]');
              if (navRoot) return navRoot;
              var node = el;
              var maxWalk = 12;
              while (node && node !== root && maxWalk-- > 0) {
                /* Stop bubbling if this element has layout classes or multiple children */
                if (!LEAF_TAGS.has(node.tagName)) {
                  var childElements = node.querySelectorAll(':scope > *');
                  if (childElements.length >= 2 || (node.innerHTML && node.innerHTML.length > 80)) {
                    return node;
                  }
                }
                node = node.parentElement;
              }
              /* Fallback: if we walked all the way to root, return the original */
              return el === root ? el : el;
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
                borderRadius: style.borderRadius,
                paddingTop: style.paddingTop,
                paddingRight: style.paddingRight,
                paddingBottom: style.paddingBottom,
                paddingLeft: style.paddingLeft,
                gap: style.gap,
                borderColor: style.borderColor,
                borderWidth: style.borderWidth,
                boxShadow: style.boxShadow,
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

            function buildEditableMetadata(target) {
              return {
                tagName: target.tagName.toLowerCase(),
                textNodes: collectTextNodes(target),
                style: buildStylePayload(target),
              };
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
              clearSelected();
              var target = resolveTarget(e.target);
              selectedEl = target;
              selectedEl.classList.add('__drawgle-selected-outline');

              /* Build a clean outerHTML without our injected classes */
              var clone = target.cloneNode(true);
              clone.querySelectorAll('.__drawgle-hover-outline').forEach(function(el) {
                el.classList.remove('__drawgle-hover-outline');
              });
              clone.querySelectorAll('.__drawgle-selected-outline').forEach(function(el) {
                el.classList.remove('__drawgle-selected-outline');
              });
              clone.classList.remove('__drawgle-hover-outline', '__drawgle-selected-outline');

              window.parent.postMessage({
                type: 'elementSelected',
                outerHTML: clone.outerHTML,
                drawgleId: target.getAttribute && target.getAttribute('data-drawgle-id'),
                targetType: target.closest && target.closest('[data-drawgle-primary-nav]') ? 'navigation' : 'screen',
                boundingRect: toRectPayload(target.getBoundingClientRect()),
                editableMetadata: buildEditableMetadata(target),
                textPreview: stripHtml(target.innerHTML),
                breadcrumb: buildBreadcrumb(target),
              }, '*');
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

            function selectByDrawgleId(drawgleId) {
              clearSelected();
              if (!drawgleId) return;
              var nextSelected = document.querySelector('[data-drawgle-id="' + String(drawgleId).replace(/"/g, '\\"') + '"]');
              if (!nextSelected) return;
              selectedEl = nextSelected;
              selectedEl.classList.add('__drawgle-selected-outline');
            }

            window.addEventListener('message', function(event) {
              if (!event.data) return;
              if (event.data.type === 'updateCode') {
                /* Preserve selection state across live code updates */
                var wasActive = selectionActive;
                if (wasActive) disableSelection();
                queuedRenderPayload = {
                  code: event.data.code || '',
                  navigationCode: event.data.navigationCode || '',
                  activeNavigationItemId: event.data.activeNavigationItemId || '',
                  tokenCss: event.data.tokenCss || '',
                };
                if (styleRuntimeReady) {
                  applyRenderPayload(queuedRenderPayload);
                }
                if (wasActive) enableSelection();
              } else if (event.data.type === 'updateDesignTokenCss') {
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
    bootstrapContent.navigationShellCode,
    bootstrapContent.screenCode,
    bootstrapContent.tokenCss,
  ]);

  // =========================================================================
  // Render
  // =========================================================================

  const isSelectionModeActive = Boolean(isSelected && selectionMode);
  // Overlay is removed for interact mode AND selection mode (iframe needs pointer events)
  const overlayActive = !isInteractModeActive && !isSelectionModeActive;
  const overlayPointerStyle: React.CSSProperties = {
    cursor: isDraggingState
      ? "grabbing"
      : isSelected
        ? "grab"
        : "pointer",
  };

  return (
    /*
     * Outer wrapper — no overflow-hidden so the label bar can bleed upward.
     *
     * `canvas-pan-exclude` tells react-zoom-pan-pinch to skip panning when
     * the pointer initially hits this element (or any descendant).
     *
     * We do NOT attach any drag handlers here — see the overlay comment above.
     */
    <div
      className="canvas-pan-exclude absolute"
      style={{
        left: position.x,
        // Shift the wrapper up by the label bar height so that `screen.y`
        // always refers to the TOP EDGE of the phone frame (not the label).
        top: position.y - 16,
        width: SCREEN_FRAME_WIDTH,
        // paddingTop carves out space for the absolute-positioned label bar
        paddingTop: 8,
        zIndex: isSelected || isDraggingState ? 50 : 10,
        // Pass cursor intent all the way to the canvas background
        cursor: overlayPointerStyle.cursor,
      }}
      // Click on unselected screens selects them.
      // For selected screens the overlay's pointerup handles click detection.
      onClick={!isSelected ? handleSelect : undefined}
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
      />

      {/* ──────────────── Side hardware buttons ──────────────────────── */}
      {/* These are purely decorative — pointer-events: none throughout.    */}
      {/* Positioned relative to the outer wrapper; top offsets include the  */}
      {/* 44 px label-bar paddingTop so they align with the phone body.      */}

      {/* Silent / ring switch */}
      <div style={{ position: 'absolute', left: -4, top: 44 + 76, width: 4, height: 26, background: 'linear-gradient(90deg,#141416,#38383a)', borderRadius: '3px 0 0 3px', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12),inset 0 -1px 0 rgba(0,0,0,0.4)', pointerEvents: 'none' }} />
      {/* Volume + */}
      <div style={{ position: 'absolute', left: -4, top: 44 + 118, width: 4, height: 34, background: 'linear-gradient(90deg,#141416,#38383a)', borderRadius: '3px 0 0 3px', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12),inset 0 -1px 0 rgba(0,0,0,0.4)', pointerEvents: 'none' }} />
      {/* Volume − */}
      <div style={{ position: 'absolute', left: -4, top: 44 + 162, width: 4, height: 34, background: 'linear-gradient(90deg,#141416,#38383a)', borderRadius: '3px 0 0 3px', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12),inset 0 -1px 0 rgba(0,0,0,0.4)', pointerEvents: 'none' }} />
      {/* Power / sleep */}
      <div style={{ position: 'absolute', right: -4, top: 44 + 140, width: 4, height: 68, background: 'linear-gradient(270deg,#141416,#38383a)', borderRadius: '0 3px 3px 0', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12),inset 0 -1px 0 rgba(0,0,0,0.4)', pointerEvents: 'none' }} />

      {/* ── Phone shell ─────────────────────────────────────────────────── */}
      {/*
       * The outer div is the titanium-style frame.  No Tailwind border or
       * ring classes here — selection state lives entirely in box-shadow so
       * it can be a precise glow rather than a brutal 4-px ring.
       */}
      <div
        style={{
          position: 'relative',
          width: SCREEN_FRAME_WIDTH,
          height: SCREEN_FRAME_HEIGHT,
          borderRadius: 54,
          // Titanium-inspired directional gradient
          background:
            'linear-gradient(158deg,#404042 0%,#252527 28%,#1a1a1c 52%,#2b2b2d 76%,#3d3d3f 100%)',
          // Frame micro-highlights (simulates metal specularity)
          boxShadow: (() => {
            const frame =
              'inset 0 0 0 1px rgba(255,255,255,0.07),' +
              'inset 0 1px 0 rgba(255,255,255,0.15),' +
              'inset 1px 0 0 rgba(255,255,255,0.04),' +
              'inset -1px 0 0 rgba(0,0,0,0.25)';
            const ambient =
              '0 48px 120px rgba(0,0,0,0.42),' +
              '0 16px 48px rgba(0,0,0,0.22)';
             if (isSelectionModeActive)
              return `0 0 0 2px #0d9488,0 0 22px rgba(13,148,136,0.35),${ambient},${frame}`;
            if (isInteractModeActive)
              return `0 0 0 2px #10b981,0 0 18px rgba(16,185,129,0.38),${ambient},${frame}`;
            if (isSelected)
              return `0 0 0 2px #6366f1,0 0 22px rgba(99,102,241,0.3),${ambient},${frame}`;
            return `${ambient},${frame}`;
          })(),
          transition: 'box-shadow 0.22s ease',
          // overflow visible so side buttons (negative-left/right) are shown
          overflow: 'visible',
        }}
      >
        {/*
         * Inner screen inset — this div carries the black bezel and clips
         * all content (iframe, overlays) to the rounded screen shape.
         * 10px inset on all sides = the physical bezel thickness.
         */}
        <div
          style={{
            position: 'absolute',
            top: 10, left: 10, right: 10, bottom: 10,
            borderRadius: 46,
            overflow: 'hidden',
            background: '#000',
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
              onPointerDown={handleOverlayPointerDown}
              onPointerMove={handleOverlayPointerMove}
              onPointerUp={handleOverlayPointerUp}
              onPointerCancel={handleOverlayPointerCancel}
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
              pointerEvents: isDraggingState || overlayActive ? 'none' : 'auto',
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

          {/* Home indicator pill */}
          <div
            style={{
              position: 'absolute',
              bottom: 9,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 134,
              height: 5,
              // Semi-transparent so it reads over any content colour
              background: 'rgba(255,255,255,0.22)',
              borderRadius: 3,
              zIndex: 25,
              pointerEvents: 'none',
            }}
          />
        </div>
      </div>

      {/* ── Dimension badge — visible while dragging ────────────────────── */}
      <DimensionBadge visible={isDraggingState} />
    </div>
  );
}
