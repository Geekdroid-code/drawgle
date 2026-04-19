"use client";

import { ScreenData } from "@/lib/types";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { MoreHorizontal, Download, Trash2, Edit2, Smartphone, MousePointerClick } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import { deleteScreen, updateScreenPosition } from "@/lib/supabase/queries";
import { useRealtimeRunWithStreams } from "@trigger.dev/react-hooks";

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

// ---------------------------------------------------------------------------
// External Label Bar
// ---------------------------------------------------------------------------

function ScreenLabelBar({
  screen,
  isSelected,
  interactMode,
  onInteractToggle,
  onDelete,
}: {
  screen: ScreenData;
  isSelected: boolean;
  interactMode: boolean;
  onInteractToggle: () => void;
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
      {/* Left: device icon + name + interact badge */}
      <div className="flex items-center gap-1.5 min-w-0">
        <div
          className="flex items-center justify-center w-6 h-6 rounded-md shrink-0 transition-colors duration-200"
          style={{
            background: interactMode
              ? "rgba(16,185,129,0.15)"
              : isSelected
                ? "rgba(99,102,241,0.12)"
                : "rgba(0,0,0,0.06)",
          }}
        >
          <Smartphone
            className="w-3.5 h-3.5 transition-colors duration-200"
            style={{ color: interactMode ? "#10b981" : isSelected ? "#6366f1" : "#6b7280" }}
          />
        </div>
        <span
          className="text-[13px] font-semibold truncate max-w-[150px] leading-none transition-colors duration-200"
          style={{ color: interactMode ? "#064e3b" : isSelected ? "#1e1b4b" : "#374151" }}
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
  isSelected,
  onClick,
  scale = 1,
}: {
  screen: ScreenData;
  isSelected?: boolean;
  onClick?: () => void;
  scale?: number;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const safeCode = typeof screen.code === "string" ? screen.code : "";

  // ── Visual position state (drives the CSS `left`/`top`).
  // Initialised from DB; updated live during drag; NOT reset on drag-end
  // until the DB value actually changes (see the sync effect below).
  const [position, setPosition] = useState({ x: screen.x, y: screen.y });
  const [isDraggingState, setIsDraggingState] = useState(false);

  // ── "Interact mode" lets the user scroll/tap the iframe content.
  // Automatically exits when the screen is deselected.
  const [interactMode, setInteractMode] = useState(false);

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

  const displayCode = streamedCode ?? safeCode;

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPosition(newPos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen.x, screen.y]); // ← isDragging deliberately omitted — see above

  // ── Push code updates into the iframe without a full remount
  useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: "updateCode", code: displayCode },
      "*",
    );
  }, [displayCode]);

  // ── Exit interact mode when the screen is deselected
  useEffect(() => {
    if (!isSelected) {
      setInteractMode(false);
      lastTapTimeRef.current = 0;
    }
  }, [isSelected]);

  // ── Escape key exits interact mode
  useEffect(() => {
    if (!interactMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setInteractMode(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [interactMode]);

  // ── Delete
  const handleDelete = useCallback(async () => {
    try {
      const supabase = createClient();
      await deleteScreen(supabase, screen.id);
    } catch (err) {
      console.error("Failed to delete screen", err);
    }
  }, [screen.id]);

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
        if (!isSelected) {
          // Unselected screen tapped → select it
          onClick?.();
          // Reset tap timer so first tap after selection doesn't immediately
          // double-click into interact mode.
          lastTapTimeRef.current = 0;
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
    [isSelected, onClick, screen.id],
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

  const srcDoc = useMemo(
    () => `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script src="https://cdn.tailwindcss.com"></script>
        <script src="https://unpkg.com/lucide@latest"></script>
        <style>
          body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; overflow-x: hidden; }
          ::-webkit-scrollbar { display: none; width: 0; height: 0; }
          * { -ms-overflow-style: none; scrollbar-width: none; }
        </style>
      </head>
      <body>
        <div id="root">${initialCode}</div>
        <script>
          lucide.createIcons();
          window.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'updateCode') {
              document.getElementById('root').innerHTML = event.data.code;
              lucide.createIcons();
            }
          });
        </script>
      </body>
    </html>
  `,
    [initialCode],
  );

  // =========================================================================
  // Render
  // =========================================================================

  const overlayActive = !interactMode;        // overlay present = drag mode
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
      onClick={!isSelected ? onClick : undefined}
    >
      {/* ── External label bar ─────────────────────────────────────────── */}
      <ScreenLabelBar
        screen={screen}
        isSelected={!!isSelected}
        interactMode={interactMode}
        onInteractToggle={() => setInteractMode((m) => !m)}
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
            if (interactMode)
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
