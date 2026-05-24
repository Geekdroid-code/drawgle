import Image from 'next/image'

export default function ShowCase() {
  return (
    <section className="bg-black py-16 sm:py-24">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex flex-col items-center max-w-4xl mb-12 mx-auto text-center">
          {/* The strong, refined headline stays. */}
          <h2 className="text-4xl sm:text-6xl max-w-4xl mx-auto font-bold leading-[1.1] mb-4 font-[var(--font-inter-tight)] text-white">
            From Casual Selfies to
            <span className="text-[#ff6f00] ml-3">Professional Photoshoots.</span>
          </h2>
          <p className="text-lg text-gray-300 max-w-3xl mx-auto">
            Our AI doesn't just apply a filter. It learns your unique features from your selfies and then generates brand new, hyper-realistic photos in any style you can imagine. This is the magic of generative AI.
          </p>
          {/* CTA has been REMOVED from the top. */}
        </div>

        {/* The Visual Showcase - This is the "Proof" */}
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-8">
          
          <div className="w-full max-w-xl text-center md:text-left">
            <h3 className="text-2xl font-semibold text-gray-400 mb-4">1. Upload Your Photos</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="aspect-square rounded-lg overflow-hidden"><Image src="/content/training5.jpg" alt="Selfie 1" width={300} height={300} className="w-full h-full object-cover" /></div>
              <div className="aspect-square rounded-lg overflow-hidden"><Image src="/content/training6.jpg" alt="Selfie 2" width={300} height={300} className="w-full h-full object-cover" /></div>
              <div className="aspect-square rounded-lg overflow-hidden"><Image src="/content/training7.jpg" alt="Selfie 3" width={300} height={300} className="w-full h-full object-cover" /></div>
              <div className="aspect-square rounded-lg overflow-hidden"><Image src="/content/training8.jpg" alt="Selfie 4" width={300} height={300} className="w-full h-full object-cover" /></div>
            </div>
          </div>

          {/* --- YOUR ORIGINAL, SUPERIOR ARROW IS RESTORED --- */}
          <div className="flex justify-center py-4 md:py-0">
            <Image
              src="/content/arrow.png"
              alt="Arrow pointing to AI generated photo"
              width={300}
              height={100}
              className="transform md:transform-none rotate-90 md:rotate-0 w-[120px] h-[80px] md:w-[300px] md:h-[100px]"
            />
          </div>

          <div className="w-full max-w-xl text-center md:text-left">
             <h3 className="text-2xl font-semibold text-gray-400 mb-4">2. Get Professional Results</h3>
            <div className="relative w-full aspect-[3/4] rounded-lg overflow-hidden">
              <Image src="/content/real-user.jpg" alt="AI Generated professional photo" layout="fill" className="object-cover" />
              <div className="absolute left-4 bottom-4 bg-black/50 backdrop-blur-sm text-white text-xs font-medium px-3 py-1.5 rounded-full">
                Real AI Output – No Retouching
              </div>
              <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-sm text-white text-xs font-medium px-3 py-1.5 rounded-full">
                AI GENERATED
              </div>
            </div>
          </div>
        </div>
        
        {/* --- CTA IS NOW CORRECTLY PLACED AT THE BOTTOM --- */}
        <div className="mt-16 text-center">
            <a href="#" className="bg-[#ff6f00] text-black font-bold text-lg px-8 py-4 rounded-lg hover:bg-orange-400 transition-colors">
                Start Your Photoshoot →
            </a>
        </div>

      </div>
    </section>
  )
}