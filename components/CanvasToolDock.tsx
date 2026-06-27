"use client";

import { useRef } from "react";
import {
  Expand,
  Focus,
  Hand,
  LassoSelect,
  MousePointer2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { CanvasTool } from "@/lib/canvas-interactions";

type DockButtonProps = {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
};

function DockButton({ label, active, disabled, onClick, children }: DockButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={label}
            disabled={disabled}
            onClick={onClick}
            className={`h-9 w-9 rounded-full transition md:h-10 md:w-10 ${
              active
                ? "dg-button-primary text-white hover:dg-button-primary"
                : "text-[var(--dg-text-muted)] hover:bg-[var(--dg-surface-muted)] hover:text-[var(--dg-text)]"
            }`}
          >
            {children}
          </Button>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function CameraAction({
  label,
  disabled,
  onClick,
  children,
  text,
}: DockButtonProps & { text?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            disabled={disabled}
            onClick={onClick}
            aria-label={label}
            className="h-9 rounded-xl px-2 text-[var(--dg-text-muted)] hover:bg-[var(--dg-surface-muted)] hover:text-[var(--dg-text)] md:h-10 md:px-2.5"
          >
            {children}
            {text ? <span className="hidden text-xs font-semibold xl:inline"></span> : null}
          </Button>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function CanvasToolDock({
  tool,
  zoomPercent,
  canFocus,
  disabled,
  workspaceCenterX,
  onToolChange,
  onZoomOut,
  onResetZoom,
  onFitCanvas,
  onFocusSelection,
  onZoomIn,
}: {
  tool: CanvasTool;
  zoomPercent: number;
  canFocus: boolean;
  disabled?: boolean;
  workspaceCenterX: number | null;
  onToolChange?: (tool: CanvasTool) => void;
  onZoomOut?: () => void;
  onResetZoom?: () => void;
  onFitCanvas?: () => void;
  onFocusSelection?: () => void;
  onZoomIn?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  return (
    <TooltipProvider>
      <div
        ref={containerRef}
        data-canvas-obstacle="bottom"
        className="canvas-pan-exclude absolute bottom-[calc(env(safe-area-inset-bottom,0px)+1rem)] z-40 flex max-w-[calc(100%-1rem)] flex-col items-center"
        style={{
          left: workspaceCenterX ?? "50%",
          transform: "translateX(-50%)",
        }}
      >
        <div className="flex max-w-full items-center gap-0.5 overflow-x-auto rounded-2xl border border-[var(--dg-border)] bg-[color-mix(in_oklab,var(--dg-surface)_92%,transparent)] p-1 shadow-[0_18px_55px_-34px_rgba(15,23,42,0.8)] backdrop-blur-xl">
          <DockButton
            label="Pointer (V)"
            active={tool === "pointer"}
            disabled={disabled}
            onClick={() => onToolChange?.("pointer")}
          >
            <MousePointer2 className="h-4 w-4 md:h-5 md:w-5" />
          </DockButton>
          <DockButton
            label="Select element"
            active={tool === "element-select"}
            disabled={disabled}
            onClick={() => onToolChange?.("element-select")}
          >
            <LassoSelect className="h-4 w-4 md:h-5 md:w-5" />
          </DockButton>
          <DockButton
            label="Pan canvas (H)"
            active={tool === "pan"}
            disabled={disabled}
            onClick={() => onToolChange?.("pan")}
          >
            <Hand className="h-4 w-4 md:h-5 md:w-5" />
          </DockButton>

          <div className="mx-1 h-6 w-px shrink-0 bg-[var(--dg-border-strong)]/30" />

          <DockButton label="Zoom out" onClick={onZoomOut}>
            <ZoomOut className="h-4 w-4" />
          </DockButton>
          <Button
            type="button"
            variant="ghost"
            onClick={onResetZoom}
            aria-label={`Reset zoom to 100%. Current zoom ${zoomPercent}%`}
            className="h-9 min-w-14 rounded-xl px-2 text-xs font-semibold tabular-nums text-[var(--dg-text-muted)] hover:bg-[var(--dg-surface-muted)] hover:text-[var(--dg-text)] md:h-10"
          >
            {zoomPercent}%
          </Button>
          <DockButton label="Zoom in" onClick={onZoomIn}>
            <ZoomIn className="h-4 w-4" />
          </DockButton>
          <CameraAction
            label="Fit all screens (Shift+1)"
            onClick={onFitCanvas}
            text="Fit"
          >
            <Expand className="h-4 w-4" />
          </CameraAction>
          {canFocus ? (
            <CameraAction
              label="Focus selected screen (Shift+2)"
              disabled={false}
              onClick={onFocusSelection}
              text="Focus"
            >
              <Focus className="h-4 w-4" />
            </CameraAction>
          ) : null}
        </div>
      </div>
    </TooltipProvider>
  );
}
