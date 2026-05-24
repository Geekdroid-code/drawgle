"use client"

import Image from "next/image"
import { UploadCloud, Play } from "lucide-react"
import Carousal from "@/components/Carousal"

// Using your specific image requests
const womanInputImages = ["/images/demo1.jpg", "/images/demo2.jpg", "/images/demo3.jpg", "/images/demo4.jpg", "/images/demo9.jpg", "/images/demo10.jpg"];
const manInputImages = ["/images/demo7.jpg", "/images/demo5.jpg", "/images/demo11.jpg", "/images/demo12.jpg", "/images/demo13.jpg", "/images/demo14.jpg"];
const womanOutputImages = ["/images/aimodel1.jpg", "/images/aimodel2.jpg", "/images/aimodel3.jpg", "/images/aimodel4.jpg"];
const manOutputImages = ["/images/aimodel5.jpg", "/images/aimodel6.jpg", "/images/aimodel7.jpg", "/images/aimodel8.jpg"];

// Create arrays for carousel - combining both woman and man output images
const humans = [...womanOutputImages, ...manOutputImages];
const humans2 = [...manOutputImages, ...womanOutputImages]; // Different order for second carousel

export default function HowItWorksShowcase() {
  return (
    <section id="how-it-works" className="relative mx-auto py-16 sm:py-24 overflow-hidden bg-[#F7F5F3]">
      <div className="px-4 max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16 sm:mb-20">
          <h2 className="text-4xl sm:text-5xl md:text-6xl max-w-4xl mx-auto font-bold leading-none mb-4 font-[var(--font-inter-tight)] text-gray-900">
            Your Professional Photoshoot in <span className="text-[#ff6f00]">3 Simple Steps.</span>
          </h2>
          <p className="text-lg md:text-xl text-gray-600 max-w-3xl mx-auto">
            Our process is designed to be effortless, transparent, and deliver stunning results every time.
          </p>
        </div>

        {/* The Linear, Step-by-Step Flow */}
        <div className="flex flex-col justify-center items-center">

          {/* --- STEP 1: UPLOAD --- */}
          <div className="relative flex flex-col items-center">
            {/* Circle with gradient and number */}
            <div className="bg-gradient-to-l from-[#ff6f00] to-orange-400 text-white rounded-full h-12 w-12 flex items-center justify-center font-bold z-10">
              1
            </div>
            {/* Gradient stroke line with fade out at the end */}
            <div className="w-1 h-10 rounded-lg bg-gradient-to-b from-[#ff6f00] to-transparent mt-[-2px]"></div>
          </div>

          {/* Text element */}
          <h3 className="text-4xl sm:text-5xl md:text-6xl font-bold text-center mt-2 mb-4">
            Upload your selfies
          </h3>
          <p className="text-center text-lg md:text-xl text-gray-600 max-w-3xl mx-auto">
Start by providing 5+ clear photos. Our AI learns from a diverse set of your images to ensure an authentic result.
          </p>

          {/* Graphic element */}
          <div className="px-2 min-w-fit flex justify-center items-center mt-8">
            <div className="flex flex-row items-center">
              {/* Row with images on left, center, and right */}
              <div className="flex justify-between w-full max-w-7xl">
                {/* Left side - Woman images */}
                 <div className="flex flex-col items-center justify-center">
                   <div className="hidden lg:flex gap-6 mb-1">
                     {/* Three images up */}
                     <div className="w-[105px] h-[140px] rounded-2xl shadow-custom-shadow overflow-hidden">
                       <Image 
                         src={womanInputImages[0]} 
                         width={105} 
                         height={140} 
                         className="w-full h-full object-cover"
                         alt="woman image 1" 
                       />
                     </div>
                     <div className="w-[105px] h-[140px] rounded-2xl shadow-custom-shadow overflow-hidden">
                       <Image 
                         src={womanInputImages[1]} 
                         width={105} 
                         height={140} 
                         className="w-full h-full object-cover"
                         alt="woman image 2" 
                       />
                     </div>
                     <div className="w-[105px] h-[140px] rounded-2xl shadow-custom-shadow overflow-hidden">
                       <Image 
                         src={womanInputImages[2]} 
                         width={105} 
                         height={140} 
                         className="w-full h-full object-cover"
                         alt="woman image 3" 
                       />
                     </div>
                   </div>
                   <div className="hidden lg:flex gap-6 mt-6">
                     {/* Three images down */}
                     <div className="w-[105px] h-[140px] rounded-2xl shadow-custom-shadow overflow-hidden">
                       <Image 
                         src={womanInputImages[3]} 
                         width={105} 
                         height={140} 
                         className="w-full h-full object-cover"
                         alt="woman image 4" 
                       />
                     </div>
                     <div className="w-[105px] h-[140px] rounded-2xl shadow-custom-shadow overflow-hidden">
                       <Image 
                         src={womanInputImages[4]} 
                         width={105} 
                         height={140} 
                         className="w-full h-full object-cover"
                         alt="woman image 5" 
                       />
                     </div>
                     <div className="w-[105px] h-[140px] rounded-2xl shadow-custom-shadow overflow-hidden">
                       <Image 
                         src={womanInputImages[5]} 
                         width={105} 
                         height={140} 
                         className="w-full h-full object-cover"
                         alt="woman image 6" 
                       />
                     </div>
                   </div>
                 </div>

                 {/* Center image - Phone mockup */}
                <div className="relative mx-8 w-[250px] h-[480px]">
                  {/* Phone frame */}
                  <div className="w-full h-full bg-gray-900 rounded-[3rem] p-2 shadow-2xl">
                    <div className="w-full h-full bg-white rounded-[2.5rem] overflow-hidden relative">
                      {/* Upload interface mockup */}
                      <div className="absolute inset-0 flex flex-col p-4 bg-white">
                        {/* Header */}
                          <h3 className="text-lg font-semibold text-gray-900 mb-1 mt-4">Training Images</h3>

                        
                        {/* Upload area - smaller since we have file list */}
                        <div className="border border-dashed border-[#ff6f00]/50 rounded-lg p-3 mb-4 bg-gray-50/50">
                          <div className="flex flex-col items-center text-center">
                            <div className="w-8 h-8 bg-[#ff6f00]/30 rounded-full flex items-center justify-center mb-2">
                              <UploadCloud className="w-4 h-4 text-gray-500" />
                            </div>
                            <p className="text-xs font-medium text-gray-700 mb-1">Drop your images here</p>
                            <p className="text-xs text-gray-500">PNG, JPG or JPEG</p>
                          </div>
                        </div>
                        
                        {/* File list - realistic display like TrainModelZone */}
                        <div className="space-y-2 flex-1 overflow-y-auto">
                          {womanInputImages.slice(0, 4).map((src, i) => (
                            <div key={i} className="bg-white flex items-center justify-between gap-2 rounded-lg border border-gray-200 p-2">
                              <div className="flex items-center gap-2 overflow-hidden">
                                <div className="bg-gray-100 aspect-square shrink-0 rounded w-8 h-8">
                                  <Image 
                                    src={src} 
                                    alt={`Upload ${i + 1}`} 
                                    width={32} 
                                    height={32} 
                                    className="w-full h-full rounded object-cover" 
                                  />
                                </div>
                                <div className="flex min-w-0 flex-col">
                                  <p className="truncate text-xs font-medium text-gray-900">
                                    IMG_000{i + 1}.jpg
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    2.{i + 1}MB
                                  </p>
                                </div>
                              </div>
                              <div className="w-4 h-4 text-gray-400">
                                <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        {/* Footer info */}
                        <div className="mt-3 pt-2 border-t border-gray-100">
                          <p className="text-xs text-gray-500 text-center">
                            4 of 10 images selected
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Right side - Man images */}
                 <div className="flex flex-col items-center justify-center">
                   <div className="hidden lg:flex gap-6 mb-1">
                     {/* Three images up */}
                     <div className="w-[105px] h-[140px] rounded-2xl shadow-custom-shadow overflow-hidden">
                       <Image 
                         src={manInputImages[0]} 
                         width={105} 
                         height={140} 
                         className="w-full h-full object-cover"
                         alt="man image 1" 
                       />
                     </div>
                     <div className="w-[105px] h-[140px] rounded-2xl shadow-custom-shadow overflow-hidden">
                       <Image 
                         src={manInputImages[1]} 
                         width={105} 
                         height={140} 
                         className="w-full h-full object-cover"
                         alt="man image 2" 
                       />
                     </div>
                     <div className="w-[105px] h-[140px] rounded-2xl shadow-custom-shadow overflow-hidden">
                       <Image 
                         src={manInputImages[2]} 
                         width={105} 
                         height={140} 
                         className="w-full h-full object-cover"
                         alt="man image 3" 
                       />
                     </div>
                   </div>
                   <div className="hidden lg:flex gap-6 mt-6">
                     {/* Three images down */}
                     <div className="w-[105px] h-[140px] rounded-2xl shadow-custom-shadow overflow-hidden">
                       <Image 
                         src={manInputImages[3]} 
                         width={105} 
                         height={140} 
                         className="w-full h-full object-cover"
                         alt="man image 4" 
                       />
                     </div>
                     <div className="w-[105px] h-[140px] rounded-2xl shadow-custom-shadow overflow-hidden">
                       <Image 
                         src={manInputImages[4]} 
                         width={105} 
                         height={140} 
                         className="w-full h-full object-cover"
                         alt="man image 5" 
                       />
                     </div>
                     <div className="w-[105px] h-[140px] rounded-2xl shadow-custom-shadow overflow-hidden">
                       <Image 
                         src={manInputImages[5]} 
                         width={105} 
                         height={140} 
                         className="w-full h-full object-cover"
                         alt="man image 6" 
                       />
                     </div>
                   </div>
                 </div>
              </div>
            </div>
          </div>

          {/* --- STEP 2: AI MAGIC --- */}
          {/* Circle element */}
          <div className="relative flex flex-col items-center mt-8">
            {/* Circle with gradient and number */}
            <div className="bg-gradient-to-l from-slate-700 to-[#ff6f00] text-white rounded-full h-12 w-12 flex items-center justify-center font-bold z-10">
              2
            </div>
            {/* Gradient stroke line with fade out at the end */}
            <div className="mt-[-75px] w-1 h-28 rounded-lg bg-gradient-to-b from-transparent via-[#ff6f00] to-transparent bg-[length:100%_100%]"></div>
          </div>

          {/* Text element */}
          <h3 className="text-4xl sm:text-5xl md:text-6xl font-bold text-center mt-2 mb-4">
            Our AI gets to work
          </h3>
          <p className="text-center text-lg md:text-xl text-gray-600 max-w-3xl mx-auto">
This isn't a filter - it's a generative engine. Our system analyzes your features to create a hyper-realistic model trained exclusively on you.
          </p>

          {/* AI Visual element */}
          <div className="flex justify-center items-center mt-8">
            <div 
              className="relative w-[95%] xl:w-[1050px] border-[#ff6f00] border-4 h-[200px] sm:h-[350px] md:h-[400px] lg:h-[500px] xl:h-[600px] rounded-2xl overflow-hidden shadow-2xl group cursor-pointer"
              onClick={() => {
                const iframe = document.getElementById('video-iframe') as HTMLIFrameElement;
                const thumbnail = document.getElementById('video-thumbnail') as HTMLElement;
                if (iframe && thumbnail) {
                  iframe.classList.remove('opacity-0', 'pointer-events-none');
                  iframe.classList.add('opacity-100');
                  thumbnail.classList.add('opacity-0', 'pointer-events-none');
                }
              }}
            >
              {/* Custom Thumbnail Background */}
              <div id="video-thumbnail" className="absolute inset-0 transition-opacity duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-[#ff6f00]/20 via-orange-100/50 to-[#ff6f00]/30">
                  <div className="w-full h-full bg-[url('/images/howtothumbnail.webp')] bg-cover bg-center opacity-80"></div>
                </div>
                
                {/* Overlay gradient */}
                <div className="absolute inset-0 bg-black/20"></div>
                
               <div className="absolute inset-0 flex items-center justify-center group-hover:scale-100 scale-[0.9] transition-all duration-200 ease-out rounded-2xl">
          <div className="bg-[#ff6f00]/10 flex items-center justify-center rounded-full backdrop-blur-md size-28">
            <div
              className={`flex items-center justify-center bg-gradient-to-b from-primary/30 to-primary shadow-md rounded-full size-20 transition-all ease-out duration-200 relative group-hover:scale-[1.2] scale-100`}
            >
              <Play
                className="size-8 text-white fill-white group-hover:scale-105 scale-100 transition-transform duration-200 ease-out"
                style={{
                  filter:
                    "drop-shadow(0 4px 3px rgb(0 0 0 / 0.07)) drop-shadow(0 2px 2px rgb(0 0 0 / 0.06))",
                }}
              />
            </div>
          </div>
        </div>
              </div>
              
              {/* Hidden iframe that will be shown on click */}
              <iframe
                className="w-full h-full opacity-0 pointer-events-none transition-opacity duration-300"
                src="https://www.youtube.com/embed/UL357H91Gc0?rel=0"
                title="AI Processing Video"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                id="video-iframe"
              ></iframe>
            </div>
          </div>

          {/* --- STEP 3: GET RESULTS --- */}
          {/* Circle element */}
          <div className="relative flex flex-col items-center mt-16">
            {/* Circle with gradient and number */}
            <div className="bg-gradient-to-l from-black to-slate-100 text-white rounded-full h-12 w-12 flex items-center justify-center font-bold z-10">
              3
            </div>
            {/* Gradient stroke line with fade out at the end */}
            <div className="mt-[-90px] w-1 h-14 rounded-lg bg-gradient-to-b from-transparent to-black"></div>
          </div>

          {/* Text element */}
          <h3 className="text-4xl sm:text-5xl md:text-6xl font-bold text-center mt-10 mb-4">
            Get amazing photoshoots
          </h3>
          <p className="text-center text-lg md:text-xl text-gray-600 max-w-3xl mx-auto">
Get a diverse portfolio of studio-quality images in minutes, ready for any platform, from the boardroom to the bar.
          </p>
          <div className="animate-fadeIn container mx-auto pt-10">
            <Carousal images={humans} />
            <Carousal images={humans2} reverse={true} />
          </div>
          <div className="text-center justify-center flex text-sm font-md px-10 uppercase tracking-wider text-slate-400">
            Results from unrealshot ai photoshoot generator.
          </div>
        </div>
      </div>
    </section>
  )
}