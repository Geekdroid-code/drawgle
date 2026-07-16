"use client"

import Image from "next/image"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowUp, Play, Sparkles, ImagePlus, X } from "lucide-react"
import Link from "next/link"
import { useState, useEffect, useRef, type ChangeEvent, type FormEvent, type KeyboardEvent } from "react"
import { Caveat } from 'next/font/google';
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { saveClientEntryDraft, validateClientEntryImage } from "@/lib/client-entry-draft";

// Configure the Caveat font
const caveat = Caveat({
  subsets: ['latin'],
  weight: '500',
});

const placeholderPhrases = [
  "Build a modern SaaS pricing page with dark mode...",
  "Design a minimal blog post layout with elegant typography...",
  "Create a futuristic crypto dashboard with charts...",
  "Generate a clean e-commerce product page...",
];

const initialDemoNote = "Watch it live before you give your money to us";
const demoNotReadyNote = "Demo is still trapped in my 9-to-5. Recording it tonight after office hours.";

export function HeroSection() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [demoNote, setDemoNote] = useState(initialDemoNote);
  const [prompt, setPrompt] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [isForwarding, setIsForwarding] = useState(false);
  const canContinue = Boolean(prompt.trim() || image);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;

    const validationError = validateClientEntryImage(file);
    if (validationError) {
      setDraftError(validationError);
      event.target.value = "";
      return;
    }

    setDraftError(null);
    setImage(file);
    setImagePreviewUrl(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setImage(null);
    setImagePreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const continueToLogin = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!canContinue || isForwarding) return;

    setDraftError(null);
    setIsForwarding(true);
    try {
      const draftId = await saveClientEntryDraft({ prompt: prompt.trim(), image });
      const nextPath = `/project/new?draft=${encodeURIComponent(draftId)}`;
      router.push(`/login?next=${encodeURIComponent(nextPath)}`);
    } catch (error) {
      console.error("Failed to save homepage draft", error);
      setDraftError("This browser could not save your draft. Please try again or continue without an image.");
      setIsForwarding(false);
    }
  };

  const handlePromptKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void continueToLogin();
    }
  };

  return (
    <section className="relative mx-auto pb-12 overflow-hidden min-h-screen bg-black">
      {/* Paper Texture */}
      <div
        className="absolute inset-0 z-2 -pt-8"
        style={{
          backgroundImage: `url('/bg-pattern.svg')`,
          backgroundPosition: 'top center',
          backgroundRepeat: 'no-repeat',
          backgroundSize: 'auto'
        }}
      />
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `url('/bg-image.webp')`,
        }}
      />

      <div className="px-4 pt-[150px] max-w-6xl mx-auto text-center flex flex-col justify-center">
        <div className="relative z-10 space-y-6">
          <div className="space-y-6">
            <div className="inline-flex rounded-lg border border-white/15 bg-[#080808] py-1 px-2 shadow-[inset_0_1px_2px_rgba(0,0,0,0.9),inset_0_-1px_0_rgba(255,255,255,0.05)]">
                <span className="flex h-3.5 w-3.5 items-center justify-center rounded-md bg-[#1b7fcc]/15">
                  <Sparkles size={8} className="text-[#75b9ed]" />
                </span>
                <span className="text-[10px] font-semibold tracking-[0.04em] text-gray-200">
                  Native mobile UI, ready to ship
                </span>
            </div>
            
<h1 className="text-[32px] sm:text-6xl max-w-4xl mx-auto font-semibold leading-none mb-4 font-pixel-square">
  <span className="text-white">Ship beautiful App UIs</span>
  <br />
  <span className="relative mt-2 inline-block text-[#1b7fcc]">
    at the speed of thought
    
  </span>
</h1>

            <p className="text-md sm:text-lg text-gray-300 max-w-3xl mx-auto mb-8">
Drawgle turns prompts into premium mobile UI, then hands agent-ready HTML, design tokens, and implementation context to the coding tools already inside your repository.            </p>
          </div>

          {/* Premium Prompt Box */}
          <form className="max-w-3xl mx-auto w-full mt-8 mb-10" onSubmit={continueToLogin}>
            <div className="relative bg-[#151515] border border-[#5b5b5b] rounded-[20px] p-4 sm:p-5 text-left flex flex-col justify-between shadow-2xl min-h-[140px] sm:min-h-[160px] focus-within:border-[#75b9ed]/70">
              {image && imagePreviewUrl ? (
                <div className="mb-3 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-2.5">
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-black/40">
                    <Image src={imagePreviewUrl} alt="Attached reference preview" fill unoptimized className="object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium text-white/80">{image.name}</div>
                    <div className="mt-0.5 text-[10px] text-white/40">Ready to continue after sign in</div>
                  </div>
                  <button type="button" onClick={removeImage} className="flex h-8 w-8 items-center justify-center rounded-full text-white/45 hover:bg-white/10 hover:text-white" aria-label="Remove attached image">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : null}
              <div className="relative mb-8 min-h-[56px] text-md font-medium text-white">
                <textarea
                  aria-label="Describe the mobile UI you want to design"
                  value={prompt}
                  onChange={(event) => {
                    setPrompt(event.target.value);
                    setDraftError(null);
                  }}
                  onKeyDown={handlePromptKeyDown}
                  className="relative z-10 h-16 w-full resize-none border-0 bg-transparent p-0 text-base leading-6 text-white outline-none placeholder:text-transparent"
                />
                {!prompt ? (
                  <div className="pointer-events-none absolute inset-0 text-white/75">
                    <AnimatedPlaceholderText phrases={placeholderPhrases} isVisible />
                  </div>
                ) : null}
              </div>
              
              <div className="flex items-center justify-between mt-auto">
                <div className="flex items-center gap-4">
                  <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={handleImageChange} />
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors text-sm font-medium" title="Attach reference image">
                    <ImagePlus className="w-5 h-5" />
                    Attach
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <button type="submit" disabled={!canContinue || isForwarding} className="bg-white/10 p-2 rounded-full text-white hover:bg-[#1b7fcc] transition-colors group disabled:cursor-not-allowed disabled:opacity-35" aria-label="Continue to sign in">
                    <ArrowUp className="w-5 h-5 transition-transform group-hover:-translate-y-0.5" />
                  </button>
                </div>
              </div>
            </div>
            {draftError ? <p className="mt-2 text-left text-xs text-red-300" role="alert">{draftError}</p> : null}
          </form>

          <div className="flex flex-wrap sm:flex-row gap-2 justify-center items-center w-full relative">

            <div className="relative">
            <Link href="/project/new">
              <Button
                className="text-sm sm:text-md font-semibold py-5 sm:py-6 group relative bg-[#1b7fcc] hover:bg-[#1975bd] text-white rounded-md overflow-hidden cursor-pointer pr-12 border border-[#5ba8e2]/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.18),inset_0_-2px_3px_rgba(0,0,0,0.28)]"
              >
                <span className="sm:px-2">Design Your UI</span>
                <div className="bg-white rounded-sm p-2 sm:p-3 absolute right-1 top-1/2 -translate-y-1/2 shadow-[inset_0_-1px_2px_rgba(0,0,0,0.12)]">
                  <img
                    src="/arrow.svg"
                    alt="arrow-right"
                    className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1"
                  />
                </div>
              </Button>
            </Link>
             
            </div>
            <div className="relative">
            <Link href="#">
              <Button
                className="text-sm sm:text-md py-5 sm:py-6 group relative bg-[#F5F5F5] hover:bg-white text-black rounded-md overflow-hidden cursor-pointer pr-12 border border-white/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),inset_0_-2px_3px_rgba(0,0,0,0.16)]"
                onClick={(e) => {
                  e.preventDefault();
                  setDemoNote(demoNotReadyNote);
                }}
              >
                <span className="sm:px-2">Watch Demo</span>
                <div className="bg-[#1b7fcc] text-white rounded-sm p-2 sm:p-3 absolute right-1 top-1/2 -translate-y-1/2 shadow-[inset_0_1px_0_rgba(255,255,255,0.18),inset_0_-1px_2px_rgba(0,0,0,0.28)]">
                  <Play className="w-6 h-6 transition-transform duration-200 group-hover:translate-x-1" />
                </div>
              </Button>
            </Link>
         
            </div>

            {/* Whirl Arrow pointing to floating text */}
            <div className="hidden md:block absolute right-82 top-16 mt-4 -translate-y-1/2 w-16 h-20 pointer-events-none">
              <svg
                viewBox="0 0 59 42"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-full h-full text-blue-500 opacity-70 transform rotate-50"
              >
                <path
                  d="M7.66614 22.083C8.61245 23.967 9.50382 25.809 10.5502 27.8855C9.46822 27.9516 8.62906 27.273 8.11869 26.4189C6.58755 23.8566 5.08123 21.2357 3.75924 18.5229C2.99812 16.9739 3.65927 15.9282 5.04612 16.172C7.36079 16.5421 9.68076 17.0712 12.0256 17.5417C12.1602 17.5669 12.3348 17.5838 12.4048 17.6759C12.7097 17.9858 12.9498 18.3626 13.2298 18.7311C12.9958 18.9402 12.8221 19.3502 12.5678 19.35C11.6851 19.3744 10.8123 19.29 9.95444 19.2559C9.48565 19.2471 9.04169 19.1798 8.47894 19.5644C9.09834 20.0754 9.7328 20.6367 10.3522 21.1477C23.4279 31.1179 38.4176 30.6525 47.7967 20.0973C48.9958 18.7256 50.015 17.178 51.1441 15.7141C51.5421 15.2039 51.955 14.7439 52.353 14.2337C52.5027 14.3091 52.6277 14.4431 52.7774 14.5186C52.7934 14.9956 52.9342 15.6067 52.7454 15.9665C52.1844 17.2048 51.6234 18.443 50.8975 19.5556C43.7187 30.665 30.0661 33.8934 16.8279 27.4803C14.2971 26.248 11.87 24.5135 9.42336 22.9967C8.90409 22.6783 8.44951 22.2929 7.95505 21.9159C7.86023 21.8823 7.75566 21.9576 7.66614 22.083Z"
                  fill="currentColor"
                  stroke="currentColor"
                  strokeWidth="0.5"
                />
              </svg>
            </div>

            {/* Floating text */}
            <p aria-live="polite" className={`basis-full pt-2 text-center text-base font-semibold leading-tight text-gray-300 pointer-events-none md:absolute md:right-40 md:top-full md:mt-8 md:w-48 md:basis-auto md:rotate-6 md:pt-0 md:text-left md:text-lg ${caveat.className}`}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={demoNote}
                  className="block"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18 }}
                >
                  {demoNote}
                </motion.span>
              </AnimatePresence>
            </p>
          </div>
          <div className="flex flex-col items-center space-y-2 pt-2">
            <div className="flex items-center space-x-2">
              <div className="flex -space-x-2">
                <img
                  src="/content/sachin.webp"
                  alt="User profile photo"
                  className="w-8 h-8 rounded-full border-2 border-white object-cover"
                />
                <img
                  src="/content/sumesh.webp"
                  alt="User profile photo"
                  className="w-8 h-8 rounded-full border-2 border-white object-cover"
                />
                <img
                  src="/content/manoj.jpg"
                  alt="User profile photo"
                  className="w-8 h-8 rounded-full border-2 border-white object-cover"
                />
                <img
                  src="/content/emma-thopmson.jpg"
                  alt="User profile photo"
                  className="w-8 h-8 rounded-full border-2 border-white object-cover"
                />
                <div className="w-8 h-8 rounded-full bg-gray-900 border-2 border-white flex items-center justify-center">
                  <span className="text-white text-xs font-bold">15+</span>
                </div>
              </div>
              <div className="flex text-yellow-400">
                {[...Array(5)].map((_, i) => (
                  <span key={i} className="text-lg">
                    ★
                  </span>
                ))}
              </div>
            </div>
            <p className="text-gray-400 text-md">Starting at $9 ONLY</p>
          </div>
        </div>
      </div>
    </section>
  )
}

function AnimatedPlaceholderText({
  phrases,
  isVisible,
}: {
  phrases: string[];
  isVisible: boolean;
}) {
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const shouldReduceMotion = useReducedMotion();
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
      <motion.span
        key={activePlaceholder}
        className="block text-white/90"
        initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      >
        {activePlaceholder}
      </motion.span>
    </AnimatePresence>
  );
}