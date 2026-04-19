import Image from "next/image";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Image as ImageIcon, Send, Loader2, X } from "lucide-react";
import { ProjectData, PromptImagePayload } from "@/lib/types";

export function PromptBar({
  onSubmit,
  project,
  disabled = false,
  submitStatusText = "Queueing generation...",
}: {
  onSubmit?: (options: { prompt: string, image?: PromptImagePayload | null }) => Promise<boolean>,
  project?: ProjectData,
  disabled?: boolean,
  submitStatusText?: string,
}) {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [agentStatus, setAgentStatus] = useState("");
  const [image, setImage] = useState<PromptImagePayload | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if ((!prompt.trim() && !image) || disabled) return;

    setIsGenerating(true);
    setAgentStatus(submitStatusText);

    try {
      if (onSubmit) {
        const didSubmit = await onSubmit({ prompt, image });

        if (didSubmit) {
          setPrompt("");
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
      {isGenerating && agentStatus && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs font-medium px-4 py-2 rounded-full shadow-lg flex items-center gap-2 whitespace-nowrap">
          <Loader2 className="w-3 h-3 animate-spin" />
          {agentStatus}
        </div>
      )}
      {image && (
        <div className="px-3 pt-2 relative inline-block">
          <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200">
            <Image
              src={`data:${image.mimeType};base64,${image.data}`}
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
        placeholder={project ? "What would you like to edit or create in this app?" : "What native mobile app shall we design?"}
        className="min-h-[50px] resize-none border-none focus-visible:ring-0 text-base bg-transparent px-3 py-2"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleGenerate();
          }
        }}
        disabled={disabled}
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
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full text-gray-500 hover:text-gray-900"
            onClick={() => fileInputRef.current?.click()}
          >
            <ImageIcon className="w-5 h-5" />
          </Button>

        </div>
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            className="rounded-full bg-gray-900 hover:bg-gray-800 text-white"
            onClick={handleGenerate}
            disabled={disabled || isGenerating || (!prompt.trim() && !image)}
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
