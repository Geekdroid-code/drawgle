"use client";

import Image from "next/image";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Paperclip, 
  ArrowUp, 
  X,
  PenTool,
  Camera,
  Zap,
  BrainCircuit,
  Brain,
  CircleHelp
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DrawingCanvas } from "./drawing-canvas";
import { type DraftImageIntent } from "./chat-types";

interface PromptInputProps {
  input: string;
  setInput: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  selectedImage: string | null;
  selectedImageIntent: DraftImageIntent | null;
  setSelectedImage: (image: string | null) => void;
  onClearImage: () => void;
  onImageUpload: () => void;
  onTakePhoto: () => void;
  mode: "solver" | "tutor";
  setMode: (mode: "solver" | "tutor") => void;
  diagnoseEnabled: boolean;
  setDiagnoseEnabled: (enabled: boolean) => void;
}

export function PromptInput({
  input,
  setInput,
  onSubmit,
  isLoading,
  selectedImage,
  selectedImageIntent,
  setSelectedImage,
  onClearImage,
  onImageUpload,
  onTakePhoto,
  mode,
  setMode,
  diagnoseEnabled,
  setDiagnoseEnabled,
}: PromptInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const diagnoseInfoRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [isCanvasOpen, setIsCanvasOpen] = useState(false);
  const [isDiagnoseInfoOpen, setIsDiagnoseInfoOpen] = useState(false);
  const imageIntentCopy = getImageIntentCopy(selectedImageIntent, mode);
  const placeholderPhrases = getAnimatedPlaceholderPhrases(mode, diagnoseEnabled);
  const showAnimatedPlaceholder = !isFocused && !input.trim();

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!diagnoseInfoRef.current) return;
      const target = event.target as Node;
      if (!diagnoseInfoRef.current.contains(target)) {
        setIsDiagnoseInfoOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <>
      <DrawingCanvas 
        isOpen={isCanvasOpen} 
        onClose={() => setIsCanvasOpen(false)} 
        onSave={(dataUrl) => setSelectedImage(dataUrl)} 
      />
      <div className="w-full max-w-4xl mx-auto px-4">
        <div className={cn(
          "relative border transition-colors duration-300 rounded-2xl p-[3px]",
          mode === "solver" 
            ? "border-[#DBDBDB]/60 bg-[#F8F8F8]" 
            : "border-emerald-100 bg-emerald-50/30"
        )}>
          {/* Header Area */}
          <div className="flex px-4 mb-1 items-center justify-between gap-3 text-zinc-500">
            <div className="flex min-w-0 items-center">
             <span className={cn(
               "leading-6 text-[13px] font-medium text-nowrap mr-1",
               mode === "tutor" && "text-emerald-600"
             )}>
               {mode === "solver" ? "Solver:" : "Tutor:"}
             </span> 
             <span className="leading-6 text-xs truncate min-w-0 opacity-80">
               {diagnoseEnabled
                 ? mode === "solver"
                   ? "Review your child’s work from a photo, upload, or annotation"
                   : "Review your child’s work and turn it into parent coaching"
                 : mode === "solver" 
                   ? "School-friendly steps for Grades 2-6 homework" 
                   : "Parent coaching for fractions, division, and word problems"}
             </span>
            </div>
            <div ref={diagnoseInfoRef} className="relative shrink-0">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    setDiagnoseEnabled(!diagnoseEnabled);
                    setIsDiagnoseInfoOpen(false);
                  }}
                  disabled={isLoading}
                  aria-pressed={diagnoseEnabled}
                  aria-label={diagnoseEnabled ? "Disable diagnose mode" : "Enable diagnose mode"}
                  className={cn(
                    "inline-flex h-7 w-7 items-center justify-center rounded-lg border transition-all duration-200 disabled:opacity-50",
                    diagnoseEnabled
                      ? "border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50"
                      : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50"
                  )}
                >
                  <Brain size={16} />
                </button>
                <button
                  type="button"
                  aria-label="What diagnose mode does"
                  onClick={() => setIsDiagnoseInfoOpen((prev) => !prev)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
                >
                  <CircleHelp size={15} />
                </button>
              </div>

              <AnimatePresence>
                {isDiagnoseInfoOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.98 }}
                    transition={{ duration: 0.18 }}
                    className="absolute bottom-full right-0 z-40 mb-3 w-80 max-w-[calc(100vw-2rem)] origin-bottom-right overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_24px_60px_-24px_rgba(0,0,0,0.45)]"
                  >
                    <div className="absolute -bottom-2 right-4 h-4 w-4 rotate-45 border-b border-r border-zinc-200 bg-white" />
                    <div className="border-b border-zinc-100 bg-zinc-50 px-4 py-3">
                      <p className="text-sm font-semibold text-zinc-900">Diagnose mode</p>
                      <p className="mt-1 text-xs text-zinc-500">
                        Built for reviewing your child’s written work without changing your current Solve or Teach mode.
                      </p>
                    </div>
                    <div className="space-y-2 px-4 py-3 text-xs leading-5 text-zinc-600">
                      <p>
                        Upload a notebook photo, worksheet snap, or annotated image and I’ll review the work in the current mode.
                      </p>
                      <ul className="space-y-1.5 text-zinc-500">
                        <li>• Solve It: spot the first math step to double-check</li>
                        <li>• Teach It: explain what the child likely misunderstood</li>
                        <li>• Works with upload, camera, drawing, or a short note</li>
                      </ul>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="relative flex flex-col bg-white rounded-xl border border-[#0000001F] shadow-[0px_4px_16px_0px_#0000000D] overflow-hidden transition-colors duration-300">
            <AnimatePresence>
              {diagnoseEnabled && !selectedImage && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-b border-zinc-100 bg-zinc-50/80"
                >
                  <div className="px-4 py-3">
                      <p className="text-sm font-medium text-zinc-900">Best with a quick photo of the written work</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Choose the fastest capture method first, then add a short note only if needed.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2.5">
                      <button
                        type="button"
                        onClick={onTakePhoto}
                        className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800"
                      >
                        <Camera size={13} />
                        Take photo
                      </button>
                      <button
                        type="button"
                        onClick={onImageUpload}
                        className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
                      >
                        <Paperclip size={13} />
                        Upload work
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsCanvasOpen(true)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
                      >
                        <PenTool size={13} />
                        Draw / mark up
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            
            <AnimatePresence>
              {selectedImage && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="px-4 pt-3"
                >
                  <div className="flex items-start gap-3 rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3">
                    <div className="relative h-20 w-20 overflow-hidden rounded-xl border border-zinc-200 bg-white">
                      <Image
                        src={selectedImage}
                        alt="Upload preview"
                        fill
                        unoptimized
                        className="object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="inline-flex rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-600">
                        {imageIntentCopy.label}
                      </div>
                      <p className="mt-2 text-sm font-medium text-zinc-900">{imageIntentCopy.title}</p>
                      <p className="mt-1 text-xs leading-5 text-zinc-500">{imageIntentCopy.description}</p>
                    </div>
                    <button 
                      type="button"
                      onClick={onClearImage}
                      className="rounded-full border border-zinc-200 bg-white p-1 text-zinc-500 transition-colors hover:bg-zinc-100"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="relative px-4 py-3.5">  
              {showAnimatedPlaceholder && (
                <div className="pointer-events-none absolute inset-x-4 top-1/2 -translate-y-1/2 overflow-hidden text-[15px] text-zinc-400 md:text-base">
                  <AnimatedPlaceholderText
                    key={`${mode}-${diagnoseEnabled}`}
                    phrases={placeholderPhrases}
                    isVisible={showAnimatedPlaceholder}
                  />
                </div>
              )}
              <textarea 
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder={
                  ""
                }
                className="w-full max-h-[216px] bg-transparent text-[15px] md:text-base resize-none outline-none placeholder:text-zinc-400"
                style={{ height: "40px" }}
                rows={1}
              />
            </div>

            <div className="flex items-center justify-between max-w-full px-4 pb-3 pt-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button 
                  type="button"
                  onClick={onTakePhoto}
                  className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors"
                  title="Take photo"
                >
                  <Camera size={18} />
                </button>
                <button 
                  type="button"
                  onClick={onImageUpload}
                  className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors"
                  title="Upload image"
                >
                  <Paperclip size={18} />
                </button>
                <button 
                  type="button"
                  onClick={() => setIsCanvasOpen(true)}
                  className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors"
                  title="Open canvas"
                >
                  <PenTool size={18} />
                </button>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <div className="bg-zinc-100 p-1 rounded-lg border border-zinc-200 flex relative">
                  <div 
                    className={cn(
                      "absolute inset-y-1 w-[calc(50%-4px)] bg-white shadow-sm rounded-md transition-all duration-300 ease-out",
                      mode === "solver" ? "left-1" : "left-[calc(50%)]"
                    )} 
                  />
                  <button 
                    onClick={() => setMode("solver")}
                    disabled={isLoading || diagnoseEnabled}
                    className={cn(
                      "relative z-10 px-2.5 py-1 text-xs font-medium transition-colors duration-200 flex items-center gap-1.5 disabled:opacity-50 sm:px-3",
                      mode === "solver"
                        ? "text-zinc-900"
                        : diagnoseEnabled
                          ? "text-zinc-400"
                          : "text-zinc-500 hover:text-zinc-900"
                    )}
                  >
                    <Zap size={12} />
                    Solve It
                    
                  </button>
                  <button 
                    onClick={() => setMode("tutor")}
                    disabled={isLoading || diagnoseEnabled}
                    className={cn(
                      "relative z-10 px-2.5 py-1 text-xs font-medium transition-colors duration-200 flex items-center gap-1.5 disabled:opacity-50 sm:px-3",
                      mode === "tutor"
                        ? "text-emerald-700"
                        : diagnoseEnabled
                          ? "text-zinc-400"
                          : "text-zinc-500 hover:text-zinc-900"
                    )}
                  >
                    <BrainCircuit size={12} />
                    Teach It
                  </button>
                </div>

                <button 
                  type="button"
                  onClick={onSubmit}
                  disabled={isLoading || (!input.trim() && !selectedImage)}
                  className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200",
                    (input.trim() || selectedImage) && !isLoading 
                      ? (mode === "solver" ? "bg-black text-white hover:bg-zinc-800" : "bg-emerald-600 text-white hover:bg-emerald-700") 
                      : "bg-zinc-200 text-zinc-400 cursor-not-allowed"
                  )}
                >
                  <ArrowUp size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <div className="text-center mt-3">
           <p className="text-xs text-zinc-400">
             Built for parent-guided Grades 2-6 math help.
           </p>
        </div>
      </div>
    </>
  );
}

function getAnimatedPlaceholderPhrases(mode: "solver" | "tutor", diagnoseEnabled: boolean) {
  if (diagnoseEnabled) {
    return mode === "solver"
      ? [
          "Upload your child’s work and I’ll spot the first step to double-check...",
          "Take a quick photo of the notebook page for a calm mistake check...",
          "Add a short note if there is one part of the work you want reviewed...",
        ]
      : [
          "Upload your child’s work and I’ll turn it into parent coaching...",
          "Take a quick photo so I can explain what the child may have misunderstood...",
          "Add a short note if you want help with one confusing step...",
        ];
  }

  return mode === "solver"
    ? [
        "Paste a fraction, long division, decimal, or word problem...",
        "Upload a worksheet photo and get school-friendly steps...",
        "Ask to verify a final answer or show another method...",
      ]
    : [
        "Ask how to explain the homework method to your child...",
        "Upload the worksheet and I’ll turn it into a parent script...",
        "Ask for a simpler analogy, shorter explanation, or one stuck step...",
      ];
}

function AnimatedPlaceholderText({
  phrases,
  isVisible,
}: {
  phrases: string[];
  isVisible: boolean;
}) {
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const activePlaceholder = phrases[placeholderIndex % phrases.length] || "";

  useEffect(() => {
    if (!isVisible || phrases.length <= 1) return;

    const timeoutId = window.setTimeout(() => {
      setPlaceholderIndex((current) => (current + 1) % phrases.length);
    }, 3200);

    return () => window.clearTimeout(timeoutId);
  }, [placeholderIndex, phrases, isVisible]);

  return (
    <AnimatePresence mode="wait" initial={false}>
      <WavePlaceholderPhrase key={activePlaceholder} phrase={activePlaceholder} />
    </AnimatePresence>
  );
}

function WavePlaceholderPhrase({ phrase }: { phrase: string }) {
  return (
    <motion.span
      className="inline-block whitespace-pre-wrap"
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: 0.02,
          },
        },
        exit: {
          transition: {
            staggerChildren: 0.016,
          },
        },
      }}
    >
      {phrase.split("").map((character, index) => (
        (() => {
          const glyph = character === " " ? "\u00A0" : character;

          return (
        <motion.span
          key={`${phrase}-${index}-${character}`}
          className="relative inline-block will-change-transform"
          style={{ transformOrigin: "50% 100%" }}
          variants={{
            hidden: {
              opacity: 0,
              y: 18,
              rotateX: -22,
              scale: 0.985,
            },
            visible: {
              opacity: 1,
              y: 0,
              rotateX: 0,
              transition: {
                y: {
                  type: "spring",
                  stiffness: 360,
                  damping: 26,
                  mass: 0.78,
                },
                opacity: {
                  duration: 0.34,
                  ease: [0.22, 1, 0.36, 1],
                },
                rotateX: {
                  duration: 0.42,
                  ease: [0.22, 1, 0.36, 1],
                },
                scale: {
                  duration: 0.42,
                  ease: [0.22, 1, 0.36, 1],
                },
              },
            },
            exit: {
              opacity: 0,
              y: -14,
              rotateX: 14,
              scale: 0.99,
              transition: {
                duration: 0.28,
                ease: [0.4, 0, 1, 1],
              },
            },
          }}
        >
          <motion.span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 text-zinc-300/70 blur-[4px]"
            variants={{
              hidden: {
                opacity: 0,
                y: 20,
                scale: 1.05,
              },
              visible: {
                opacity: 0.4,
                y: 4,
                scale: 1,
                transition: {
                  opacity: {
                    duration: 0.42,
                    ease: [0.22, 1, 0.36, 1],
                  },
                  y: {
                    type: "spring",
                    stiffness: 240,
                    damping: 28,
                    mass: 0.9,
                  },
                  scale: {
                    duration: 0.42,
                    ease: [0.22, 1, 0.36, 1],
                  },
                },
              },
              exit: {
                opacity: 0,
                y: -8,
                scale: 0.98,
                transition: {
                  duration: 0.24,
                  ease: [0.4, 0, 1, 1],
                },
              },
            }}
          >
            {glyph}
          </motion.span>
          <span className="relative block">{glyph}</span>
        </motion.span>
          );
        })()
      ))}
    </motion.span>
  );
}

function getImageIntentCopy(intent: DraftImageIntent | null, mode: "solver" | "tutor") {
  if (intent === "diagnose_from_image") {
    return {
      label: "Diagnose from worksheet",
      title: mode === "solver" ? "Checking where the math may have gone off" : "Checking what the child may have misunderstood",
      description: "I’ll review the written work in the current mode and help you guide your kid",
    };
  }

  if (intent === "teach_from_image") {
    return {
      label: "Teach from image",
      title: "Turning the worksheet into a parent coaching script",
      description: "I’ll explain the method shown in the image and help you say it in simpler language at the table.",
    };
  }

  return {
    label: "Solve from image",
    title: "Solving the homework shown in the image",
    description: "I’ll read the worksheet problem from the image and return school-friendly steps for the current homework.",
  };
}
