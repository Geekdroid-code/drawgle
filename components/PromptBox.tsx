"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { Send, Loader2, X, Trash2, Image as ImageIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { PromptImagePayload, ScreenData } from "@/lib/types";

export function PromptBox({
  selectedScreen,
  disabled,
  isProcessing,
  agentStatus,
  onSend,
  onDeselectScreen,
  onDeleteSelectedScreen,
}: {
  selectedScreen: ScreenData | null;
  disabled?: boolean;
  isProcessing?: boolean;
  agentStatus?: string;
  onSend: (options: { prompt: string; image?: PromptImagePayload | null }) => Promise<void>;
  onDeselectScreen: () => void;
  onDeleteSelectedScreen: () => Promise<void>;
}) {
  const [prompt, setPrompt] = useState("");
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

  const handleSend = async () => {
    if ((!prompt.trim() && !image) || disabled || isProcessing) return;
    const userPrompt = prompt.trim();
    setPrompt("");
    await onSend({ prompt: userPrompt, image });
    setImage(null);
  };

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-2 flex flex-col gap-2">
        {selectedScreen ? (
          <div className="flex items-center justify-between bg-blue-50 px-3 py-2 rounded-t-xl border-b border-blue-100 mb-1 -mx-2 -mt-2">
            <span className="text-xs font-medium text-blue-700 truncate max-w-[200px] md:max-w-md">
              Editing: {selectedScreen.name}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-red-600 hover:text-red-700 hover:bg-red-100 rounded-full"
                onClick={() => void onDeleteSelectedScreen()}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-blue-600 hover:text-blue-700 hover:bg-blue-100 rounded-full"
                onClick={onDeselectScreen}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ) : null}

        {isProcessing && agentStatus ? (
          <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs font-medium px-4 py-2 rounded-full shadow-lg flex items-center gap-2 whitespace-nowrap">
            <Loader2 className="w-3 h-3 animate-spin" />
            {agentStatus}
          </div>
        ) : null}

        {image ? (
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
        ) : null}

        <Textarea
          placeholder={
            selectedScreen
              ? `How should we modify ${selectedScreen.name}?`
              : "What screen would you like to create?"
          }
          className="min-h-[50px] resize-none border-none focus-visible:ring-0 text-base bg-transparent px-3 py-2"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
          disabled={disabled || isProcessing}
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
              >
                <ImageIcon className="w-5 h-5" />
              </Button>
            ) : null}
          </div>

          <Button
            size="icon"
            className="rounded-full bg-gray-900 hover:bg-gray-800 text-white"
            onClick={() => void handleSend()}
            disabled={disabled || isProcessing || (!prompt.trim() && !image)}
          >
            {isProcessing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
