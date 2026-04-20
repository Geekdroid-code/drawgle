"use client";

import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import {
  Send,
  Loader2,
  MessageSquare,
  ChevronDown,
  X,
  Trash2,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Pencil,
  Plus,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useProjectMessages } from "@/hooks/use-project-messages";
import { applyEdits } from "@/lib/diff-engine";
import { indexScreenCode } from "@/lib/generation/block-index";
import { createClient } from "@/lib/supabase/client";
import {
  deleteScreen,
  insertProjectMessage,
  updateScreenCode,
} from "@/lib/supabase/queries";
import type {
  PlannedUiFlow,
  ProjectData,
  ProjectMessage,
  PromptImagePayload,
  ScreenData,
  ScreenPlan,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Message type indicator icons
// ---------------------------------------------------------------------------

function MessageTypeIcon({ messageType }: { messageType: ProjectMessage["messageType"] }) {
  switch (messageType) {
    case "edit_applied":
      return <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />;
    case "generation_started":
      return <Sparkles className="w-3.5 h-3.5 text-blue-500 shrink-0 animate-pulse" />;
    case "generation_completed":
      return <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />;
    case "screen_created":
      return <Plus className="w-3.5 h-3.5 text-purple-500 shrink-0" />;
    case "error":
      return <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Message bubble
// ---------------------------------------------------------------------------

function MessageBubble({
  message,
  screens,
}: {
  message: ProjectMessage;
  screens: ScreenData[];
}) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const linkedScreen = message.screenId
    ? screens.find((s) => s.id === message.screenId)
    : null;

  if (isSystem) {
    return (
      <div className="flex items-center gap-2 justify-center py-1">
        <MessageTypeIcon messageType={message.messageType} />
        <span className="text-xs text-gray-500">{message.content}</span>
      </div>
    );
  }

  const isEditApplied = message.messageType === "edit_applied" || (message.role === "model" && message.content.includes("<edit>"));

  return (
    <div className={`flex flex-col max-w-[90%] ${isUser ? "self-end" : "self-start"}`}>
      {linkedScreen && !isUser && (
        <div className="flex items-center gap-1 mb-0.5 ml-1">
          <Pencil className="w-3 h-3 text-gray-400" />
          <span className="text-[10px] text-gray-400 font-medium">{linkedScreen.name}</span>
        </div>
      )}
      <div
        className={`px-3 py-2 rounded-2xl text-sm ${
          isUser
            ? "bg-blue-600 text-white rounded-tr-sm"
            : "bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm"
        }`}
      >
        {isEditApplied ? (
          <div className="flex items-center gap-2 text-green-600 font-medium">
            <CheckCircle2 className="w-4 h-4" />
            Applied changes{linkedScreen ? ` to ${linkedScreen.name}` : ""}
          </div>
        ) : (
          <div className="whitespace-pre-wrap break-words">{message.content}</div>
        )}
      </div>
      {linkedScreen && isUser && (
        <div className="flex items-center gap-1 mt-0.5 mr-1 self-end">
          <span className="text-[10px] text-blue-300 font-medium">{linkedScreen.name}</span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChatPanel
// ---------------------------------------------------------------------------

export function ChatPanel({
  project,
  screens,
  selectedScreen,
  ownerId,
  onSelectScreen,
  disabled,
  onPromptSubmit,
}: {
  project: ProjectData;
  screens: ScreenData[];
  selectedScreen: ScreenData | null;
  ownerId: string;
  onSelectScreen: (screen: ScreenData | null) => void;
  disabled?: boolean;
  onPromptSubmit?: (options: {
    prompt: string;
    image?: PromptImagePayload | null;
  }) => Promise<boolean>;
}) {
  const { messages } = useProjectMessages(project.id);
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [image, setImage] = useState<PromptImagePayload | null>(null);
  const [agentStatus, setAgentStatus] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
    return () => window.clearTimeout(timeout);
  }, [messages]);

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

  const handleDelete = async () => {
    if (!selectedScreen) return;
    try {
      const supabase = createClient();
      await deleteScreen(supabase, selectedScreen.id);
      onSelectScreen(null);
    } catch (error) {
      console.error("Error deleting screen:", error);
    }
  };

  const handleSend = async () => {
    if ((!prompt.trim() && !image) || isGenerating || disabled) return;

    const userPrompt = prompt.trim();
    setPrompt("");
    setIsGenerating(true);

    // Auto-expand to see the response
    if (!isExpanded) setIsExpanded(true);

    try {
      if (selectedScreen) {
        // ----- EDIT FLOW -----
        setAgentStatus(`Editing ${selectedScreen.name}...`);

        const sourceCode = selectedScreen.code;

        const editRes = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: project.id,
            prompt: userPrompt,
            selectedScreenId: selectedScreen.id,
          }),
        });

        if (!editRes.ok) throw new Error("Failed to edit screen");
        if (!editRes.body) throw new Error("No response body");

        const reader = editRes.body.getReader();
        const decoder = new TextDecoder();
        let fullResponse = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          fullResponse += decoder.decode(value, { stream: true });
        }

        // Apply edits to the screen code
        if (fullResponse.includes("<edit>")) {
          const newCode = applyEdits(sourceCode, fullResponse);
          if (newCode !== sourceCode) {
            const supabase = createClient();
            await updateScreenCode(
              supabase,
              selectedScreen.id,
              newCode,
              "ready",
              indexScreenCode(newCode),
            );
          }
        }
      } else {
        // ----- CREATE FLOW -----
        // Post user message to project_messages for visibility
        const admin = createClient();
        await insertProjectMessage(admin, {
          projectId: project.id,
          ownerId,
          role: "user",
          content: userPrompt,
          messageType: "chat",
        });

        // Delegate to existing plan+build pipeline via onPromptSubmit
        if (onPromptSubmit) {
          setAgentStatus("Planning screen...");
          await onPromptSubmit({ prompt: userPrompt, image });
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      // Post error message
      try {
        const supabase = createClient();
        await insertProjectMessage(supabase, {
          projectId: project.id,
          ownerId,
          screenId: selectedScreen?.id ?? null,
          role: "model",
          content: "Sorry, I encountered an error while processing your request.",
          messageType: "error",
        });
      } catch (msgErr) {
        console.error("Failed to persist error message", msgErr);
      }
    } finally {
      setIsGenerating(false);
      setAgentStatus("");
      setImage(null);
    }
  };

  // ---- Collapsed bar ----
  if (!isExpanded) {
    return (
      <div className="absolute bottom-4 md:bottom-8 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-2 flex flex-col gap-2">
          {/* Header */}
          {selectedScreen && (
            <div className="flex items-center justify-between bg-blue-50 px-3 py-2 rounded-t-xl border-b border-blue-100 mb-1 -mx-2 -mt-2">
              <span className="text-xs font-medium text-blue-700 truncate max-w-[200px] md:max-w-md">
                Editing: {selectedScreen.name}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-red-600 hover:text-red-700 hover:bg-red-100 rounded-full"
                  onClick={handleDelete}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-blue-600 hover:text-blue-700 hover:bg-blue-100 rounded-full"
                  onClick={() => onSelectScreen(null)}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}

          {isGenerating && agentStatus && (
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs font-medium px-4 py-2 rounded-full shadow-lg flex items-center gap-2 whitespace-nowrap">
              <Loader2 className="w-3 h-3 animate-spin" />
              {agentStatus}
            </div>
          )}

          {/* Image preview */}
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
                handleSend();
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
              {!selectedScreen && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full text-gray-500 hover:text-gray-900"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImageIcon className="w-5 h-5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-500 hover:text-gray-900 rounded-full"
                onClick={() => setIsExpanded(true)}
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                {messages.length} messages
              </Button>
            </div>
            <Button
              size="icon"
              className="rounded-full bg-gray-900 hover:bg-gray-800 text-white"
              onClick={handleSend}
              disabled={disabled || isGenerating || (!prompt.trim() && !image)}
            >
              {isGenerating ? (
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

  // ---- Expanded panel ----
  return (
    <>
      {/* Mobile backdrop */}
      <div
        className="md:hidden fixed inset-0 bg-black/20 z-40"
        onClick={() => setIsExpanded(false)}
      />

      <div
        className={`absolute z-50 flex flex-col overflow-hidden transition-all duration-300
        md:right-4 md:top-4 md:bottom-4 md:w-96 md:rounded-2xl md:border md:border-gray-200
        bottom-0 left-0 right-0 h-[85vh] rounded-t-3xl border-t border-gray-200
        surface-container backdrop-blur-glass
      `}
      >
        {/* Header */}
        <div className="h-14 flex items-center justify-between shrink-0 px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-gray-500" />
            {selectedScreen ? (
              <span className="font-medium text-sm text-gray-900 truncate max-w-[180px]">
                {selectedScreen.name}
              </span>
            ) : (
              <span className="font-medium text-sm text-gray-900">
                {project.name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {selectedScreen && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-full"
                  onClick={handleDelete}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full hover:bg-gray-100"
                  onClick={() => onSelectScreen(null)}
                >
                  <X className="w-4 h-4 text-gray-500" />
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsExpanded(false)}
              className="h-8 w-8 rounded-full hover:bg-gray-100 md:hidden"
            >
              <ChevronDown className="w-5 h-5 text-gray-500" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 bg-gray-50/50">
          {messages.length === 0 && (
            <div className="text-center text-sm text-gray-500 mt-10">
              {selectedScreen
                ? "Ask me to change colors, layout, or add new elements!"
                : "Describe a screen you'd like to create, or select a screen to edit."}
            </div>
          )}
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} screens={screens} />
          ))}
          {isGenerating && (
            <div className="self-start px-3 py-2 rounded-2xl bg-white border border-gray-200 shadow-sm rounded-tl-sm flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              <span className="text-sm text-gray-500">
                {agentStatus || "Working on it..."}
              </span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Selected screen indicator */}
        {selectedScreen && (
          <div className="px-4 py-2 bg-blue-50 border-t border-blue-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Pencil className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-xs font-medium text-blue-700 truncate max-w-[200px]">
                Editing: {selectedScreen.name}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-blue-600 hover:text-blue-700 hover:bg-blue-100 rounded-full"
              onClick={() => onSelectScreen(null)}
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}

        {/* Input */}
        <div className="p-3 bg-white border-t border-gray-100 shrink-0">
          {image && (
            <div className="px-1 pb-2 relative inline-block">
              <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-gray-200">
                <Image
                  src={`data:${image.mimeType};base64,${image.data}`}
                  alt="Upload"
                  width={48}
                  height={48}
                  unoptimized
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => setImage(null)}
                  className="absolute top-0.5 right-0.5 bg-black/50 hover:bg-black/70 text-white rounded-full p-0.5"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>
          )}
          <div className="relative flex items-end gap-2 bg-gray-50 border border-gray-200 rounded-xl p-1 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              ref={fileInputRef}
              onChange={handleImageUpload}
            />
            {!selectedScreen && (
              <Button
                variant="ghost"
                size="icon"
                className="rounded-lg text-gray-400 hover:text-gray-700 h-8 w-8 shrink-0 mb-1 ml-1"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImageIcon className="w-4 h-4" />
              </Button>
            )}
            <Textarea
              placeholder={
                selectedScreen
                  ? "Make the button blue..."
                  : "Describe a new screen..."
              }
              className="min-h-[40px] max-h-[120px] resize-none border-none focus-visible:ring-0 text-sm bg-transparent px-3 py-2"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              disabled={disabled}
            />
            <Button
              size="icon"
              className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white h-8 w-8 shrink-0 mb-1 mr-1"
              onClick={handleSend}
              disabled={disabled || isGenerating || (!prompt.trim() && !image)}
            >
              <Send className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
