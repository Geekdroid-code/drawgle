"use client"

import { Button } from "@/components/ui/button"
import { Play, Sparkles, ImagePlus, Palette, AudioLines } from "lucide-react"
import Link from "next/link"
import { useState, useEffect } from "react"
import Image from "next/image"
import { Caveat } from 'next/font/google';
import { motion, AnimatePresence } from "framer-motion";

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

export function HeroSection() {
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
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
            <div className="inline-flex rounded-lg border border-white/15 bg-[#080808] p-[2px] shadow-[inset_0_1px_2px_rgba(0,0,0,0.9),inset_0_-1px_0_rgba(255,255,255,0.05)]">
              <div className="flex items-center gap-1.5 rounded-md border border-[#1b7fcc]/20 bg-[#1b7fcc]/10 px-2.5 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),inset_0_-1px_1px_rgba(0,0,0,0.45)]">
                <span className="flex h-3.5 w-3.5 items-center justify-center rounded-md bg-[#1b7fcc]/15">
                  <Sparkles size={8} className="text-[#75b9ed]" />
                </span>
                <span className="text-[10px] font-semibold tracking-[0.04em] text-gray-200">
                  Native mobile UI, ready to ship
                </span>
              </div>
            </div>
            
<h1 className="text-[32px] sm:text-6xl max-w-4xl mx-auto font-semibold leading-none mb-4 font-pixel-square">  <span className="text-white">
    Ship beautiful App UIs
  </span><br />
  
  {/* The Tearing Text Container */}
  <span className="relative inline-block mt-2 group">
    
    <style jsx>{`
      /* The High-Speed Projectile */
      @keyframes sliceShoot {
        0%, 10% { transform: translate(-100%, -50%); opacity: 0; }
        11% { opacity: 1; }
        14% { transform: translate(100%, -50%); opacity: 1; }
        15%, 100% { transform: translate(100%, -50%); opacity: 0; }
      }

      /* Top Half lifts up from the left */
      @keyframes tearTop {
        0%, 12% { transform: translateY(0) rotate(0); }
        15% { transform: translateY(-8px) rotate(-2deg); filter: drop-shadow(0 5px 5px rgba(27,127,204,0.4)); }
        22% { transform: translateY(0) rotate(0); }
        100% { transform: translateY(0) rotate(0); }
      }

      /* Bottom Half drops down from the left */
      @keyframes tearBottom {
        0%, 12% { transform: translateY(0) rotate(0); }
        15% { transform: translateY(8px) rotate(2deg); filter: drop-shadow(0 -5px 5px rgba(27,127,204,0.4)); }
        22% { transform: translateY(0) rotate(0); }
        100% { transform: translateY(0) rotate(0); }
      }

      /* The bright plasma glow revealed inside the tear */
      @keyframes innerTearGlow {
        0%, 12% { opacity: 0; transform: scaleX(0); }
        14% { opacity: 1; transform: scaleX(1); }
        20%, 100% { opacity: 0; transform: scaleX(1); }
      }
    `}</style>

    {/* Invisible baseline text (Keeps the layout from collapsing and allows copy/pasting) */}
    <span className="text-transparent selection:text-white/30">
      at the speed of thought
    </span>

    {/* The internal glowing light that leaks out when torn */}
    <div 
      className="absolute top-1/2 left-0 right-0 h-[2px] bg-white shadow-[0_0_15px_#fff,0_0_30px_#1b7fcc,0_0_50px_#1b7fcc] -translate-y-1/2 origin-left z-0"
      style={{ animation: 'innerTearGlow 4s cubic-bezier(0.16, 1, 0.3, 1) infinite' }}
    />

    {/* TOP HALF OF THE TEXT */}
    <span 
      aria-hidden="true"
      className="absolute top-0 left-0 w-full text-[#1b7fcc] z-10 origin-right"
      style={{ 
        clipPath: 'inset(0 0 50% 0)', // Cuts off the bottom half
        animation: 'tearTop 4s cubic-bezier(0.16, 1, 0.3, 1) infinite' 
      }}
    >
      at the speed of thought
    </span>

    {/* BOTTOM HALF OF THE TEXT */}
    <span 
      aria-hidden="true"
      className="absolute top-0 left-0 w-full text-[#1b7fcc] z-10 origin-right"
      style={{ 
        clipPath: 'inset(50% 0 0 0)', // Cuts off the top half
        animation: 'tearBottom 4s cubic-bezier(0.16, 1, 0.3, 1) infinite' 
      }}
    >
      at the speed of thought
    </span>

    {/* The Laser Blade / Projectile */}
    <div 
      className="absolute top-1/2 left-0 w-[80%] h-[3px] bg-white rounded-full shadow-[0_0_10px_#fff,0_0_20px_#1b7fcc] z-20 pointer-events-none"
      style={{ animation: 'sliceShoot 4s ease-in-out infinite' }}
    />
  </span>
</h1>

            <p className="text-md sm:text-lg text-gray-300 max-w-3xl mx-auto mb-8">
Drawgle turns prompts into premium mobile UI, then hands agent-ready HTML, design tokens, and implementation context to the coding tools already inside your repository.            </p>
          </div>

          {/* Premium Prompt Box */}
          <div className="max-w-3xl mx-auto w-full mt-8 mb-10">
            <div className="bg-[#151515] border border-[#5b5b5b] rounded-[20px] p-4 sm:p-5 text-left flex flex-col justify-between shadow-2xl min-h-[140px] sm:min-h-[160px]">
              <div className="text-white text-md font-medium mb-8 min-h-[56px] relative">
                <AnimatedPlaceholderText 
                  phrases={placeholderPhrases}
                  isVisible={true}
                />
              </div>
              
              <div className="flex items-center justify-between mt-auto">
                <div className="flex items-center gap-4">
                  <button className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors text-sm font-medium" title="Attach reference image">
                    <ImagePlus className="w-5 h-5" />
                    Attach
                  </button>
                  <button className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors text-sm font-medium" title="Select design style">
                    <Palette className="w-5 h-5" />
                    Style
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <Link href="/project/new" className="bg-white/10 p-2 rounded-full text-white hover:bg-[#1b7fcc] transition-colors group">
                    <AudioLines className="w-5 h-5 transition-transform group-hover:-translate-y-0.5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <div className="flex  sm:flex-row gap-2 justify-center items-center w-full relative">

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
                  setIsVideoModalOpen(true);
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
            <p className={`hidden md:block text-gray-300 text-lg font-semibold leading-none md:absolute md:transform md:rotate-6 md:right-40 md:top-full md:mt-8 md:w-48 sm:static sm:mt-2 sm:transform-none sm:rotate-0 sm:text-center sm:w-auto pointer-events-none ${caveat.className}`}>
              Watch it Live before you give your money to us
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
                  <span className="text-white text-xs font-bold">1.2k</span>
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
            <p className="text-gray-400 text-md">Starting at $9.99 ONLY</p>
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
