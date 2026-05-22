"use client";

import {
  
  Hand,
  LassoSelect,
  Expand,
  MousePointer2,
  Palette,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
            className={`h-9 w-9 rounded-full transition md:h-10 md:w-10 ${active ? "bg-slate-950 text-white hover:bg-slate-900 hover:text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`}
          >
            {children}
          </Button>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

const dispatchCanvasEvent = (name: string) => {
  window.dispatchEvent(new Event(name));
};

export function CanvasToolDock({
  selectionMode,
  hasSelectedElement,
  selectedElementCanEditText,
  selectedElementCanEditDesign,
  disabled,
  isChatCollapsed,
  onToggleSelectionMode,
  onEditSelectedText,
  onEditSelectedDesign,
  onClearSelectedElement,
}: {
  selectionMode: boolean;
  hasSelectedElement: boolean;
  selectedElementCanEditText: boolean;
  selectedElementCanEditDesign: boolean;
  disabled?: boolean;
  isChatCollapsed: boolean;
  onToggleSelectionMode?: () => void;
  onEditSelectedText?: () => void;
  onEditSelectedDesign?: () => void;
  onClearSelectedElement?: () => void;
}) {
  return (
    <TooltipProvider>
      <div className={`canvas-pan-exclude absolute bottom-[calc(env(safe-area-inset-bottom,0px)+1rem)] left-1/2 z-[55] -translate-x-1/2 items-center gap-1 rounded-full border border-slate-950/[0.08] bg-white/92 p-1.5 shadow-[0_18px_55px_-34px_rgba(15,23,42,0.8)] backdrop-blur-xl ${isChatCollapsed ? "flex" : "hidden md:flex"}`}>
        <DockButton label="Pointer" active={!selectionMode} disabled={disabled} onClick={selectionMode ? onToggleSelectionMode : undefined}>
          <MousePointer2 className="h-4 w-4 md:h-5 md:w-5" />
        </DockButton>
        <DockButton label={selectionMode ? "Exit select mode" : "Select element"} active={selectionMode} disabled={disabled} onClick={onToggleSelectionMode}>
          <LassoSelect className="h-4 w-4 md:h-5 md:w-5" />
        </DockButton>
        <div className="mx-1 hidden h-6 w-px bg-slate-950/[0.1] md:block" />

        <DockButton label="Pan canvas" disabled={disabled}>
          <Hand className="h-4 w-4 md:h-5 md:w-5" />
        </DockButton>
        <DockButton label="Fit canvas" disabled={disabled} onClick={() => dispatchCanvasEvent("drawgle:canvas-fit")}>
          <Expand className="h-4 w-4 md:h-5 md:w-5" />
        </DockButton>
        <DockButton label="Zoom out" disabled={disabled} onClick={() => dispatchCanvasEvent("drawgle:canvas-zoom-out")}>
          <ZoomOut className="h-4 w-4 md:h-5 md:w-5" />
        </DockButton>
        <DockButton label="Zoom in" disabled={disabled} onClick={() => dispatchCanvasEvent("drawgle:canvas-zoom-in")}>
          <ZoomIn className="h-4 w-4 md:h-5 md:w-5" />
        </DockButton>

        <div className={`items-center gap-1 ${hasSelectedElement ? "flex" : "hidden md:flex"}`}>
          <div className="mx-1 h-6 w-px bg-slate-950/[0.1]" />
          <DockButton
            label="Open visual editor"
            disabled={disabled || !hasSelectedElement || (!selectedElementCanEditDesign && !selectedElementCanEditText)}
            onClick={onEditSelectedDesign ?? onEditSelectedText}
          >
            <Palette className="h-4 w-4 md:h-5 md:w-5" />
          </DockButton>
          <DockButton label="Clear selection" disabled={disabled || !hasSelectedElement} onClick={onClearSelectedElement}>
            <X className="h-4 w-4 md:h-5 md:w-5" />
          </DockButton>
        </div>
      </div>
    </TooltipProvider>
  );
}

