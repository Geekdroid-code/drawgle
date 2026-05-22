import Image from "next/image";
import { useRef, useState } from "react";
import { Image as ImageIcon, Loader2, Palette, Pencil, Send, X } from "lucide-react";

import { AgentThinkingIndicator } from "@/components/AgentBall";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { ImageReferenceMode, ProjectData, PromptImagePayload, ScreenData } from "@/lib/types";

export type AgentComposerProps = {
  onSubmit?: (options: { prompt: string; image?: PromptImagePayload | null; imageReferenceMode?: ImageReferenceMode }) => Promise<boolean>;
  project?: ProjectData;
  disabled?: boolean;
  submitStatusText?: string;
  selectedScreen?: ScreenData | null;
  onClearSelectedScreen?: () => void;
  onDeleteSelectedScreen?: () => void | Promise<void>;
  mobileTopAccessory?: React.ReactNode;
  selectionMode?: boolean;
  onToggleSelectionMode?: () => void;
  selectedElementPreview?: string | null;
  selectedElementTargetLabel?: string | null;
  selectedElementCanEditText?: boolean;
  selectedElementCanEditDesign?: boolean;
  onEditSelectedText?: () => void;
  onEditSelectedDesign?: () => void;
  onClearSelectedElement?: () => void;
  variant?: "floating" | "panel";
};

export function AgentComposer({
  onSubmit,
  project,
  disabled = false,
  submitStatusText = "Thinking...",
  selectedScreen = null,
  onClearSelectedScreen,
  onDeleteSelectedScreen: _onDeleteSelectedScreen,
  mobileTopAccessory,
  selectionMode = false,
  onToggleSelectionMode: _onToggleSelectionMode,
  selectedElementPreview,
  selectedElementTargetLabel,
  selectedElementCanEditText = false,
  selectedElementCanEditDesign = false,
  onEditSelectedText,
  onEditSelectedDesign,
  onClearSelectedElement,
  variant = "floating",
}: AgentComposerProps) {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [agentStatus, setAgentStatus] = useState("");
  const [image, setImage] = useState<PromptImagePayload | null>(null);
  const [imageReferenceMode, setImageReferenceMode] = useState<ImageReferenceMode>("recreate");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeImage = selectedScreen ? null : image;
  const hasSelectedElement = Boolean(
    selectedElementPreview ||
    selectedElementTargetLabel ||
    selectedElementCanEditText ||
    selectedElementCanEditDesign,
  );
  const activeTargetLabel = selectedElementTargetLabel || selectedScreen?.name || null;
  const isActiveComposer = Boolean(prompt.trim() || activeImage || selectedScreen || hasSelectedElement || selectionMode);
  const elementTagLabel = (selectedElementPreview || "element").replace(/[<>]/g, "").trim().toUpperCase();

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(",")[1];
      setImage({ data: base64Data, mimeType: file.type });
      event.target.value = "";
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
      const didSubmit = await onSubmit({
        prompt: nextPrompt,
        image: imageToSubmit,
        imageReferenceMode: imageToSubmit ? imageReferenceMode : "recreate",
      });

      if (didSubmit) {
        setPrompt("");
        if (imageToSubmit) {
          setImage(null);
          setImageReferenceMode("recreate");
        }
      }
    } catch (error) {
      console.error("Pipeline error:", error);
    } finally {
      setIsGenerating(false);
      setAgentStatus("");
    }
  };

  void _onToggleSelectionMode;
  void _onDeleteSelectedScreen;

  const shellClass = variant === "panel"
    ? "relative flex flex-col overflow-hidden rounded-[22px] border border-slate-950/[0.08] bg-white px-2 pb-2 pt-2"
    : `relative flex flex-col overflow-hidden rounded-[24px] px-2 pb-2 pt-2 backdrop-blur-xl ${isActiveComposer ? "dg-prompt-composer-active" : "dg-prompt-composer"}`;

  return (
    <div className={shellClass}>
      {mobileTopAccessory ? (
        <div className="absolute left-3 top-0 z-10 -translate-y-[38%] md:hidden">
          {mobileTopAccessory}
        </div>
      ) : null}

      {selectedScreen || hasSelectedElement ? (
        <div className="mb-1 flex min-h-8 items-center gap-1.5 overflow-x-auto px-0.5 pt-0.5">
          {(selectedScreen?.name || activeTargetLabel) ? (
            <span className="inline-flex h-8 max-w-[62%] shrink-0 items-center gap-1.5 rounded-full border border-black/[0.08] bg-[#f4f5f6]/90 px-2.5 text-xs font-medium text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/80 text-slate-500">
                <Pencil className="h-2.5 w-2.5" />
              </span>
              <span className="truncate">{selectedScreen?.name ?? activeTargetLabel}</span>
              {onClearSelectedScreen ? (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        className="rounded-full p-0.5 text-slate-400 hover:bg-white hover:text-slate-900"
                        onClick={onClearSelectedScreen}
                        disabled={disabled || isGenerating}
                        aria-label="Clear selected screen"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    }
                  />
                  <TooltipContent>Clear selected screen</TooltipContent>
                </Tooltip>
              ) : null}
            </span>
          ) : null}

          {hasSelectedElement ? (
            <span className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-black/[0.08] bg-[#f4f5f6]/90 px-2.5 text-xs font-semibold text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      className="inline-flex min-w-0 items-center gap-1.5"
                      onClick={onEditSelectedDesign ?? onEditSelectedText}
                      disabled={disabled || isGenerating || (!selectedElementCanEditDesign && !selectedElementCanEditText)}
                      aria-label="Open visual editor"
                    >
                      <Palette className="h-3.5 w-3.5 text-slate-500" />
                      <span className="max-w-20 truncate tracking-[0.02em]">{elementTagLabel}</span>
                    </button>
                  }
                />
                <TooltipContent>Open visual editor</TooltipContent>
              </Tooltip>
              {onClearSelectedElement ? (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        className="rounded-full p-0.5 text-slate-400 hover:bg-white hover:text-slate-900"
                        onClick={onClearSelectedElement}
                        disabled={disabled || isGenerating}
                        aria-label="Clear selected element"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    }
                  />
                  <TooltipContent>Clear selected element</TooltipContent>
                </Tooltip>
              ) : null}
            </span>
          ) : null}
        </div>
      ) : null}

      {variant === "floating" && isGenerating && agentStatus ? (
        <div className="absolute -top-10 left-1/2 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full dg-button-primary px-3.5 py-1.5 text-xs font-medium text-white">
          <Loader2 className="w-3 h-3 animate-spin" />
          {agentStatus}
        </div>
      ) : null}

      {activeImage ? (
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
              onClick={() => {
                setImage(null);
                setImageReferenceMode("recreate");
              }}
              className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80"
              type="button"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <div className="mt-2 inline-flex rounded-full border border-slate-950/[0.08] bg-white p-0.5 text-[11px] font-semibold text-slate-500 shadow-sm">
            {([
              ["recreate", "Image to UI"],
              ["style", "Style Ref"],
            ] as const).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                className={`h-7 cursor-pointer rounded-full px-2.5 transition ${imageReferenceMode === mode ? "bg-slate-950 text-white" : "hover:bg-slate-100"}`}
                onClick={() => setImageReferenceMode(mode)}
                disabled={disabled || isGenerating}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <Textarea
        placeholder={
          hasSelectedElement
            ? "Ask AI to edit selected element..."
            : selectedScreen
              ? `Ask AI to modify ${selectedScreen.name}...`
              : project
                ? "What do you want to do?"
                : "What mobile app shall we design?"
        }
        className={`${variant === "panel" ? "h-[104px] text-[15px]" : "h-[116px] text-base"} [field-sizing:fixed] resize-none overflow-y-auto border-none bg-transparent px-3 pb-12 pt-3 leading-6 text-slate-950 shadow-none placeholder:text-slate-400 focus-visible:ring-0`}
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            void handleGenerate();
          }
        }}
        disabled={disabled || isGenerating}
      />

      <input
        type="file"
        accept="image/*"
        className="hidden"
        ref={fileInputRef}
        onChange={handleImageUpload}
      />

      {!selectedScreen ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="absolute bottom-3 left-3 h-9 w-9 rounded-full bg-white/72 text-slate-500 shadow-[0_6px_18px_rgba(15,23,42,0.08)] ring-1 ring-black/[0.06] backdrop-blur-md hover:bg-white hover:text-slate-950"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || isGenerating}
                aria-label="Attach image"
              >
                <ImageIcon className="w-4 h-4" />
              </Button>
            }
          />
          <TooltipContent>Attach image</TooltipContent>
        </Tooltip>
      ) : null}

      {variant === "panel" && isGenerating ? (
        <div className="pointer-events-none absolute bottom-4 left-4 max-w-[calc(100%-5rem)]">
          <AgentThinkingIndicator label={agentStatus || submitStatusText} className="text-slate-600" />
        </div>
      ) : null}

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              size="icon"
              className="absolute bottom-3 right-3 h-10 w-10 rounded-full bg-slate-950 text-white shadow-[0_12px_28px_rgba(15,23,42,0.28)] hover:bg-slate-800"
              onClick={() => void handleGenerate()}
              disabled={disabled || isGenerating || (!prompt.trim() && !activeImage)}
              aria-label="Send"
            >
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          }
        />
        <TooltipContent>Send</TooltipContent>
      </Tooltip>
    </div>
  );
}

export function PromptBar(props: AgentComposerProps) {
  return <AgentComposer {...props} variant={props.variant ?? "floating"} />;
}
