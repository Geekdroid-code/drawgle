"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, ChevronDown, ImagePlus, Sparkles, X } from "lucide-react";

import { DrawgleLogo } from "@/components/DrawgleLogo";
import { EASE } from "@/components/marketing/motion/hooks";
import { saveClientEntryDraft, validateClientEntryImage } from "@/lib/client-entry-draft";
import { getStylePresetSlug, showcaseCollections, type ShowcaseCollection } from "@/lib/showcase";
import { cn } from "@/lib/utils";

const placeholderPhrases = [
  "Describe your app idea, or paste the spec you already have…",
  "A calm banking app with cards and spending insights…",
  "A specialty coffee ordering app with bean notes and a pickup timer…",
  "A habit tracker with streaks, reminders, and a weekly review…",
];

const byId = (id: string) => showcaseCollections.find((collection) => collection.id === id);

/** Styles offered in the picker: showcase collections that start a project with their design system. */
const styleOptions = ["neo-mint", "minimal-habit-premium", "food-delivery", "midnight-bakery", "running-tracker", "neobank"]
  .map(byId)
  .filter((collection): collection is ShowcaseCollection => Boolean(collection));

type Idea = { id: string; title: string; screen: number; collection: ShowcaseCollection };

/** Starter ideas: a real showcase prompt plus its style, one click away. */
const ideas: Idea[] = [
  { id: "food-delivery", title: "Food delivery", screen: 0 },
  { id: "neo-mint", title: "Finance tracker", screen: 0 },
  { id: "minimal-habit-premium", title: "Habit tracker", screen: 0 },
  { id: "running-tracker", title: "Running coach", screen: 1 },
].flatMap((idea) => {
  const collection = byId(idea.id);
  return collection ? [{ ...idea, collection }] : [];
});

function Palette({ colors, size = "size-3" }: { colors: string[]; size?: string }) {
  return (
    <span className="flex -space-x-1" aria-hidden="true">
      {colors.map((color) => (
        <span key={color} className={cn("rounded-full ring-2 ring-white", size)} style={{ backgroundColor: color }} />
      ))}
    </span>
  );
}

/** The hero composer: saves the brief (and optional image or style) locally, then continues through sign-in. */
export function HeroPrompt() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const [prompt, setPrompt] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [style, setStyle] = useState<ShowcaseCollection | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isForwarding, setIsForwarding] = useState(false);
  const hasBrief = Boolean(prompt.trim() || image);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  useEffect(() => {
    if (!pickerOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) setPickerOpen(false);
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setPickerOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [pickerOpen]);

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;

    const validationError = validateClientEntryImage(file);
    if (validationError) {
      setError(validationError);
      event.target.value = "";
      return;
    }

    setError(null);
    setImage(file);
    setImagePreviewUrl(URL.createObjectURL(file));
    // An attached image sets the visual direction, exactly as in the workspace.
    setStyle(null);
  };

  const removeImage = () => {
    setImage(null);
    setImagePreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const applyIdea = (collection: ShowcaseCollection) => {
    setPrompt(collection.prompt);
    setStyle(collection);
    removeImage();
    setError(null);
    textareaRef.current?.focus();
  };

  const continueToWorkspace = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (isForwarding) return;

    const styleQuery = style && !image ? `style=${encodeURIComponent(getStylePresetSlug(style))}` : "";
    if (!hasBrief) {
      router.push(`/project/new${styleQuery ? `?${styleQuery}` : ""}`);
      return;
    }

    setError(null);
    setIsForwarding(true);
    try {
      const draftId = await saveClientEntryDraft({ prompt: prompt.trim(), image });
      const nextPath = `/project/new?draft=${encodeURIComponent(draftId)}${styleQuery ? `&${styleQuery}` : ""}`;
      router.push(`/login?next=${encodeURIComponent(nextPath)}`);
    } catch (draftError) {
      console.error("Failed to save homepage draft", draftError);
      setError("This browser could not save your draft. Please try again or continue without an image.");
      setIsForwarding(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void continueToWorkspace();
    }
  };

  return (
    <div className="w-full text-left">
      {/* Stacks above the idea cards so the style list is never covered. */}
      <form onSubmit={continueToWorkspace} className="relative z-20">
        <div className="rounded-[30px] bg-white p-1.5 ring-1 ring-black/[0.1] transition-[box-shadow] focus-within:ring-mk-accent/45">
          <div className="rounded-[24px] bg-[#fafafa] shadow-[inset_0_1px_3px_rgba(15,23,42,0.06)] ring-1 ring-black/[0.05]">
            <AnimatePresence initial={false}>
              {image && imagePreviewUrl ? (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.28, ease: EASE }}
                  className="overflow-hidden"
                >
                  <div className="mx-3 mt-3 flex items-center gap-3 rounded-2xl bg-white p-2 ring-1 ring-black/[0.06]">
                    <div className="relative size-11 shrink-0 overflow-hidden rounded-xl bg-neutral-100">
                      <Image src={imagePreviewUrl} alt="Attached reference preview" fill unoptimized className="object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-semibold text-mk-ink">{image.name}</div>
                      <div className="mt-0.5 text-[11px] text-neutral-500">Rebuild it as UI or use it as a style reference after you sign in.</div>
                    </div>
                    <button
                      type="button"
                      onClick={removeImage}
                      className="flex size-8 shrink-0 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-black/[0.05] hover:text-mk-ink"
                      aria-label="Remove attached image"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>

            <div className="relative px-5 pt-4 sm:px-6 sm:pt-5">
              <textarea
                ref={textareaRef}
                aria-label="Describe the mobile app UI you want to design"
                value={prompt}
                onChange={(event) => {
                  setPrompt(event.target.value);
                  setError(null);
                }}
                onKeyDown={handleKeyDown}
                rows={3}
                className="relative z-10 w-full resize-none bg-transparent text-base font-medium leading-relaxed text-mk-ink outline-none sm:text-[17px]"
              />
              {!prompt ? (
                <div className="pointer-events-none absolute inset-x-5 top-4 text-base font-medium leading-relaxed text-neutral-400 sm:inset-x-6 sm:top-5 sm:text-[17px]">
                  <AnimatedPlaceholder phrases={placeholderPhrases} />
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-between gap-2 px-3 pb-3 pt-1 sm:px-4 sm:pb-4">
              <div className="flex min-w-0 items-center gap-1.5">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={handleImageChange}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold ring-1 transition-colors",
                    image
                      ? "bg-mk-accent/10 text-mk-accent ring-mk-accent/20"
                      : "bg-white text-neutral-700 ring-black/[0.08] hover:text-mk-ink hover:ring-black/[0.16]",
                  )}
                  title="Attach a screenshot to rebuild, or a reference for its style"
                >
                  <ImagePlus className="size-4" />
                  <span className="hidden sm:inline">{image ? "Image attached" : "Screenshot"}</span>
                </button>

                <div ref={pickerRef} className="relative min-w-0">
                  <button
                    type="button"
                    onClick={() => setPickerOpen((open) => !open)}
                    disabled={Boolean(image)}
                    aria-haspopup="listbox"
                    aria-expanded={pickerOpen}
                    title={image ? "Your image sets the visual direction" : "Start from a showcase design system"}
                    className={cn(
                      "flex h-9 min-w-0 items-center gap-2 rounded-full px-3 text-[13px] font-semibold ring-1 transition-colors disabled:cursor-not-allowed disabled:opacity-45",
                      style ? "bg-mk-ink text-white ring-mk-ink" : "bg-white text-neutral-700 ring-black/[0.08] hover:text-mk-ink hover:ring-black/[0.16]",
                    )}
                  >
                    {style ? <Palette colors={style.palette.slice(0, 3)} size="size-2.5" /> : <Sparkles className="size-4 text-mk-accent" />}
                    <span className="truncate">{style ? style.name : "Curated style"}</span>
                    <ChevronDown className={cn("size-3.5 shrink-0 opacity-60 transition-transform", pickerOpen && "rotate-180")} />
                  </button>

                  <AnimatePresence>
                    {pickerOpen ? (
                      <motion.div
                        role="listbox"
                        aria-label="Curated visual styles"
                        initial={{ opacity: 0, y: -6, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -4, scale: 0.98 }}
                        transition={{ duration: 0.2, ease: EASE }}
                        className="absolute left-0 top-11 z-30 w-[280px] origin-top-left rounded-[20px] bg-white p-1.5 shadow-[0_18px_40px_-24px_rgba(15,23,42,0.35)] ring-1 ring-black/[0.1]"
                      >
                        <button
                          type="button"
                          role="option"
                          aria-selected={!style}
                          onClick={() => {
                            setStyle(null);
                            setPickerOpen(false);
                          }}
                          className="flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-left transition-colors hover:bg-neutral-50"
                        >
                          <span className="flex size-7 items-center justify-center rounded-full bg-mk-accent/10 text-mk-accent">
                            <DrawgleLogo className="size-3.5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[13px] font-semibold text-mk-ink">Auto</span>
                            <span className="block text-[11px] text-neutral-500">Drawgle proposes a direction for you</span>
                          </span>
                          {!style ? <Check className="size-4 text-mk-accent" /> : null}
                        </button>
                        <div className="my-1 h-px bg-black/[0.05]" />
                        {styleOptions.map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            role="option"
                            aria-selected={style?.id === option.id}
                            onClick={() => {
                              setStyle(option);
                              setPickerOpen(false);
                              textareaRef.current?.focus();
                            }}
                            className="flex w-full items-center gap-3 rounded-[14px] px-3 py-2 text-left transition-colors hover:bg-neutral-50"
                          >
                            <span className="relative h-9 w-7 shrink-0 overflow-hidden rounded-[7px] ring-1 ring-black/10">
                              <Image src={option.screens[0].screenshot} alt="" fill sizes="28px" className="object-cover object-top" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-[13px] font-semibold text-mk-ink">{option.name}</span>
                              <span className="block truncate text-[11px] text-neutral-500">{option.description}</span>
                            </span>
                            {style?.id === option.id ? <Check className="size-4 shrink-0 text-mk-accent" /> : <Palette colors={option.palette.slice(0, 3)} size="size-2.5" />}
                          </button>
                        ))}
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>

                {style ? (
                  <button
                    type="button"
                    onClick={() => setStyle(null)}
                    className="flex size-7 shrink-0 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-black/[0.05] hover:text-mk-ink"
                    aria-label="Clear the selected style"
                  >
                    <X className="size-3.5" />
                  </button>
                ) : null}
              </div>

              <button
                type="submit"
                disabled={isForwarding}
                className="group inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-mk-accent pl-4 pr-1.5 text-sm font-semibold text-white transition-all hover:bg-mk-accent-strong active:scale-[0.98] disabled:opacity-70 sm:pl-5"
              >
                <span>
                  {isForwarding ? (
                    "Saving…"
                  ) : (
                    <>
                      <span className="sm:hidden">Design</span>
                      <span className="hidden sm:inline">Design Your UI</span>
                    </>
                  )}
                </span>
                <span className="relative flex size-7 items-center justify-center overflow-hidden rounded-full bg-white" aria-hidden="true">
                  {isForwarding ? (
                    <span className="size-3.5 animate-spin rounded-full border-2 border-mk-accent border-t-transparent" />
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" stroke="#305dde" className="absolute size-3.5 transition-all duration-200 ease-out group-hover:translate-x-3 group-hover:opacity-0">
                        <path d="M9 6s6 4.42 6 6-6 6-6 6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <svg viewBox="0 0 24 24" fill="none" stroke="#305dde" className="absolute size-3.5 -translate-x-3 opacity-0 transition-all duration-200 ease-out group-hover:translate-x-0 group-hover:opacity-100">
                        <path d="M18.5 12H5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M13 18s6-4.42 6-6-6-6-6-6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </>
                  )}
                </span>
              </button>
            </div>
          </div>
        </div>
        {error ? (
          <p className="mt-2 px-3 text-xs text-red-600" role="alert">
            {error}
          </p>
        ) : null}
      </form>

      <div className="mt-8 sm:mt-10">
        <div className="mb-3 flex items-center gap-2 px-1 text-[13px] font-semibold text-mk-ink">
          <Sparkles className="size-4 text-mk-accent" />
          Need inspiration? Start from a proven direction
        </div>
        <div className="mk-hide-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4">
          {ideas.map(({ id, title, screen, collection }) => {
            const selected = style?.id === id && prompt === collection.prompt;
            return (
              <button
                key={id}
                type="button"
                onClick={() => applyIdea(collection)}
                aria-pressed={selected}
                className={cn(
                  "group relative flex h-[128px] w-[72%] max-w-[260px] shrink-0 snap-start flex-col items-start justify-start overflow-hidden rounded-[22px] bg-white p-4 text-left ring-1 transition-[box-shadow,transform] duration-300 hover:-translate-y-0.5 sm:w-auto sm:max-w-none",
                  selected ? "ring-2 ring-mk-accent" : "ring-black/[0.08] hover:ring-black/[0.18]",
                )}
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-0 opacity-[0.16] transition-opacity duration-300 group-hover:opacity-25"
                  style={{ background: `radial-gradient(120% 90% at 100% 0%, ${collection.palette[2]}, transparent 60%)` }}
                />
                <span className="relative z-10 block max-w-[58%]">
                  <span className="block text-[14px] font-semibold tracking-tight text-mk-ink">{title}</span>
                  <span className="mt-1 line-clamp-2 text-[12px] leading-snug text-neutral-500">{collection.description}</span>
                </span>
                <span className="absolute bottom-3.5 left-4 z-10 flex items-center gap-1.5 font-mono text-[10px] font-medium uppercase tracking-wider text-neutral-500">
                  <span className="size-1.5 rounded-full" style={{ backgroundColor: collection.palette[2] }} />
                  {collection.name}
                </span>
                <span className="absolute -right-3 top-3 w-[84px] rotate-[8deg] overflow-hidden rounded-[14px] bg-[#f2f2f3] p-[3px] ring-1 ring-black/[0.1] transition-transform duration-500 ease-mk group-hover:-translate-y-1 group-hover:rotate-[5deg]">
                  <span className="relative block aspect-[390/844] overflow-hidden rounded-[11px]">
                    <Image src={collection.screens[screen].screenshot} alt="" fill sizes="84px" className="object-cover object-top" />
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AnimatedPlaceholder({ phrases }: { phrases: string[] }) {
  const [index, setIndex] = useState(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced || phrases.length <= 1) return;
    const timeout = window.setTimeout(() => setIndex((current) => (current + 1) % phrases.length), 3200);
    return () => window.clearTimeout(timeout);
  }, [index, phrases.length, reduced]);

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        key={phrases[index]}
        className="block"
        initial={reduced ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
        transition={{ duration: 0.28, ease: EASE }}
      >
        {phrases[index]}
      </motion.span>
    </AnimatePresence>
  );
}
