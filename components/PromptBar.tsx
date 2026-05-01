import Image from "next/image";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Crosshair, Image as ImageIcon, Loader2, Palette, Pencil, Send, Trash2, Type, X } from "lucide-react";
import type { ProjectData, PromptImagePayload, ScreenData } from "@/lib/types";

export function PromptBar({
  onSubmit,
  project,
  disabled = false,
  submitStatusText = "Queueing generation...",
  selectedScreen = null,
  onClearSelectedScreen,
  onDeleteSelectedScreen,
  mobileTopAccessory,
  selectionMode = false,
  onToggleSelectionMode,
  selectedElementPreview,
  selectedElementTargetLabel,
  selectedElementCanEditText = false,
  selectedElementCanEditDesign = false,
  onEditSelectedText,
  onEditSelectedDesign,
  onClearSelectedElement,
}: {
  onSubmit?: (options: { prompt: string; image?: PromptImagePayload | null }) => Promise<boolean>;
  project?: ProjectData;
  disabled?: boolean;
  submitStatusText?: string;
  selectedScreen?: ScreenData | null;
  onClearSelectedScreen?: () => void;
  onDeleteSelectedScreen?: () => void | Promise<void>;
  mobileTopAccessory?: React.ReactNode;
  /** Whether element selection mode is active on the screen */
  selectionMode?: boolean;
  /** Toggle element selection mode on the selected screen */
  onToggleSelectionMode?: () => void;
  /** Text preview of the currently selected element (null = no element selected) */
  selectedElementPreview?: string | null;
  /** Human readable selected target label, usually the screen name or Navigation. */
  selectedElementTargetLabel?: string | null;
  /** Whether selected target has text rows available for deterministic editing. */
  selectedElementCanEditText?: boolean;
  /** Whether selected target can receive deterministic design edits. */
  selectedElementCanEditDesign?: boolean;
  onEditSelectedText?: () => void;
  onEditSelectedDesign?: () => void;
  /** Clear the currently selected element */
  onClearSelectedElement?: () => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [agentStatus, setAgentStatus] = useState("");
  const [image, setImage] = useState<PromptImagePayload | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeImage = selectedScreen ? null : image;
  const hasSelectedElement = Boolean(selectedElementPreview);
  const activeTargetLabel = selectedElementTargetLabel || selectedScreen?.name || null;
  const isActiveComposer = Boolean(prompt.trim() || activeImage || selectedScreen || hasSelectedElement || selectionMode);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(",")[1];
      setImage({ data: base64Data, mimeType: file.type });
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = async () => {
    const nextPrompt = prompt.trim();
    const imageToSubmit = activeImage;

    if ((!nextPrompt && !imageToSubmit) || disabled || isGenerating || !onSubmit) {
      return;
    }

    setIsGenerating(true);
    setAgentStatus(submitStatusText);

    try {
      const didSubmit = await onSubmit({ prompt: nextPrompt, image: imageToSubmit });

      if (didSubmit) {
        setPrompt("");
        if (imageToSubmit) {
          setImage(null);
        }
      }
    } catch (error: any) {
      console.error("Pipeline error:", error);
    } finally {
      setIsGenerating(false);
      setAgentStatus("");
    }
  };

  return (
    <div className={`relative flex flex-col rounded-[20px] p-1.5 backdrop-blur-xl ${isActiveComposer ? "dg-prompt-composer-active" : "dg-prompt-composer"}`}>
      {mobileTopAccessory ? (
        <div className="absolute left-3 top-0 z-10 -translate-y-[38%] md:hidden">
          {mobileTopAccessory}
        </div>
      ) : null}

      {selectedScreen || hasSelectedElement ? (
        <div className="mb-1 flex min-h-9 items-center justify-between gap-2 rounded-[16px] border border-slate-950/[0.08] bg-[#f7f7f8] px-2.5 py-1.5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-slate-950/[0.08] bg-white text-slate-600">
              {hasSelectedElement ? <Crosshair className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
            </span>
            <div className="min-w-0">
              <div className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-[#667894]">
                {hasSelectedElement ? `Selected in ${activeTargetLabel ?? "screen"}` : `Editing ${selectedScreen?.name ?? "screen"}`}
              </div>
              {hasSelectedElement ? (
                <div className="truncate text-xs leading-4 text-slate-700" title={selectedElementPreview ?? undefined}>
                  {selectedElementPreview}
                </div>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {hasSelectedElement && selectedElementCanEditText && onEditSelectedText ? (
              <Button
                variant="ghost"
                className="h-7 rounded-full px-2 text-[11px] font-semibold text-slate-600 hover:bg-white hover:text-slate-950"
                onClick={onEditSelectedText}
                disabled={disabled || isGenerating}
                title="Edit selected text"
              >
                <Type className="mr-1 h-3.5 w-3.5" />
                Text
              </Button>
            ) : null}
            {hasSelectedElement && selectedElementCanEditDesign && onEditSelectedDesign ? (
              <Button
                variant="ghost"
                className="h-7 rounded-full px-2 text-[11px] font-semibold text-slate-600 hover:bg-white hover:text-slate-950"
                onClick={onEditSelectedDesign}
                disabled={disabled || isGenerating}
                title="Change selected design"
              >
                <Palette className="mr-1 h-3.5 w-3.5" />
                Design
              </Button>
            ) : null}
            {hasSelectedElement && onClearSelectedElement ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full text-slate-500 hover:bg-white hover:text-slate-900"
                onClick={onClearSelectedElement}
                disabled={disabled || isGenerating}
                title="Clear selected element"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            ) : null}
            {!hasSelectedElement && onDeleteSelectedScreen ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={() => void onDeleteSelectedScreen()}
                disabled={disabled || isGenerating}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            ) : null}
            {!hasSelectedElement && onClearSelectedScreen ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full text-slate-500 hover:bg-white hover:text-slate-900"
                onClick={onClearSelectedScreen}
                disabled={disabled || isGenerating}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Selected element pill — shown when the user has visually selected an element */}
      {isGenerating && agentStatus && (
        <div className="absolute -top-10 left-1/2 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full dg-button-primary px-3.5 py-1.5 text-xs font-medium text-white">
          <Loader2 className="w-3 h-3 animate-spin" />
          {agentStatus}
        </div>
      )}
      {activeImage && (
        <div className="relative inline-block px-3 pt-2">
          <div className="relative h-16 w-16 overflow-hidden rounded-[16px] border border-slate-950/[0.08] bg-white">
            <Image
              src={`data:${activeImage.mimeType};base64,${activeImage.data}`}
              alt="Upload"
              width={64}
              height={64}
              unoptimized
              className="w-full h-full object-cover"
            />
            <button
              onClick={() => setImage(null)}
              className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
      {selectionMode ? (
        <div className="mx-2 mt-1 flex items-center justify-between gap-2 rounded-[14px] border border-teal-500/25 bg-teal-50/90 px-3 py-2 text-xs font-medium text-teal-800">
          <span className="flex min-w-0 items-center gap-2">
            <Crosshair className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Select mode on. Click any element on any phone to retarget.</span>
          </span>
          {onToggleSelectionMode ? (
            <button
              type="button"
              className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-teal-700 hover:text-teal-950"
              onClick={onToggleSelectionMode}
              disabled={disabled || isGenerating}
            >
              Off
            </button>
          ) : null}
        </div>
      ) : null}
      <Textarea
        placeholder={
          hasSelectedElement
            ? "Ask AI to edit selected element..."
            : selectedScreen
              ? `Ask AI to modify ${selectedScreen.name}...`
              : project
                ? "What would you like to edit or create?"
                : "What mobile app shall we design?"
        }
        className="min-h-[54px] resize-none border-none bg-transparent px-3 py-2.5 text-base leading-6 text-slate-950 shadow-none placeholder:text-slate-400 focus-visible:ring-0"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void handleGenerate();
          }
        }}
        disabled={disabled || isGenerating}
      />
      <div className="flex items-center justify-between px-2 pb-1 pt-1">
        <div className="flex items-center gap-2">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={fileInputRef}
            onChange={handleImageUpload}
          />
          {onToggleSelectionMode ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full dg-control transition-colors duration-150"
              style={selectionMode ? {
                background: "#ecfeff",
                border: "1px solid rgba(13,148,136,0.28)",
                color: "#0f766e",
              } : undefined}
              onClick={onToggleSelectionMode}
              disabled={disabled || isGenerating}
              title={selectionMode ? "Exit select mode" : "Select an element to edit"}
            >
              <Crosshair className="w-5 h-5" />
            </Button>
          ) : null}
          {!selectedScreen ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full dg-control text-slate-500 hover:text-slate-950"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isGenerating}
            >
              <ImageIcon className="w-5 h-5" />
            </Button>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            className="h-10 w-10 rounded-full dg-button-primary text-white"
            onClick={() => void handleGenerate()}
            disabled={disabled || isGenerating || (!prompt.trim() && !activeImage)}
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
