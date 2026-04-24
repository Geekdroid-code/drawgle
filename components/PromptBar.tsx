import Image from "next/image";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Image as ImageIcon, Send, Loader2, X, Trash2, Crosshair } from "lucide-react";
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
  /** Clear the currently selected element */
  onClearSelectedElement?: () => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [agentStatus, setAgentStatus] = useState("");
  const [image, setImage] = useState<PromptImagePayload | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeImage = selectedScreen ? null : image;

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
    <div className="p-2 rounded-xl surface-container backdrop-blur-glass flex flex-col relative">
      {mobileTopAccessory ? (
        <div className="absolute left-3 top-0 z-10 -translate-y-[38%] md:hidden">
          {mobileTopAccessory}
        </div>
      ) : null}

      {selectedScreen ? (
        <div className="flex items-center justify-between bg-blue-50 px-3 py-2 rounded-t-xl border-b border-blue-100 mb-1 -mx-2 -mt-2">
          <span className="text-xs font-medium text-blue-700 truncate max-w-[200px] md:max-w-md">
            Editing: {selectedScreen.name}
          </span>
          <div className="flex items-center gap-1">
            {onDeleteSelectedScreen ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-red-600 hover:text-red-700 hover:bg-red-100 rounded-full"
                onClick={() => void onDeleteSelectedScreen()}
                disabled={disabled || isGenerating}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            ) : null}
            {onClearSelectedScreen ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-blue-600 hover:text-blue-700 hover:bg-blue-100 rounded-full"
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
      {selectedScreen && selectedElementPreview ? (
        <div className="flex items-center gap-2 bg-teal-50 px-3 py-1.5 rounded-lg border border-teal-100 mx-1 mb-1">
          <Crosshair className="w-3 h-3 text-teal-600 shrink-0" />
          <span className="text-xs text-teal-700 truncate max-w-[260px] md:max-w-md" title={selectedElementPreview}>
            {selectedElementPreview}
          </span>
          {onClearSelectedElement ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 text-teal-500 hover:text-teal-700 hover:bg-teal-100 rounded-full shrink-0 ml-auto"
              onClick={onClearSelectedElement}
              disabled={disabled || isGenerating}
            >
              <X className="w-3 h-3" />
            </Button>
          ) : null}
        </div>
      ) : null}

      {isGenerating && agentStatus && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs font-medium px-4 py-2 rounded-full shadow-lg flex items-center gap-2 whitespace-nowrap">
          <Loader2 className="w-3 h-3 animate-spin" />
          {agentStatus}
        </div>
      )}
      {activeImage && (
        <div className="px-3 pt-2 relative inline-block">
          <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200">
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
              className="absolute top-1 right-1 bg-black/50 hover:bg-black/70 text-white rounded-full p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
      <Textarea
        placeholder={
          selectedScreen
            ? `How should we modify ${selectedScreen.name}?`
            : project
              ? "What would you like to edit or create in this app?"
              : "What native mobile app shall we design?"
        }
        className="min-h-[50px] resize-none border-none focus-visible:ring-0 text-base bg-transparent px-3 py-2"
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
      <div className="flex items-center justify-between px-2 pb-1">
        <div className="flex items-center gap-2">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={fileInputRef}
            onChange={handleImageUpload}
          />
          {!selectedScreen ? (
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full text-gray-500 hover:text-gray-900"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isGenerating}
            >
              <ImageIcon className="w-5 h-5" />
            </Button>
          ) : null}
          {selectedScreen && onToggleSelectionMode ? (
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full transition-colors duration-150"
              style={selectionMode ? {
                background: 'rgba(20,184,166,0.12)',
                color: '#0d9488',
              } : {
                color: '#6b7280',
              }}
              onClick={onToggleSelectionMode}
              disabled={disabled || isGenerating}
              title={selectionMode ? "Exit select mode" : "Select an element to edit"}
            >
              <Crosshair className="w-5 h-5" />
            </Button>
          ) : null}

        </div>
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            className="rounded-full bg-gray-900 hover:bg-gray-800 text-white"
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
