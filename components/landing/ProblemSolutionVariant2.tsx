import Image from "next/image";

const ProblemSolutionVariant2 = () => {
  const timelineSteps = [
    {
      type: "problem",
      title: "Traditional Photography Problems",
      subtitle: "The old way is broken",
      items: [
        {
          image: "/content/sad.jpg",
          title: "Generic Stock Photos",
          description: "Photos that don't represent the real you",
          stat: "0% authenticity"
        },
        {
          image: "/content/jesica.jpg",
          title: "Expensive Photo Shoots", 
          description: "$500+ for a single professional session",
          stat: "$500+ cost"
        },
        {
          image: "/content/yours.jpg",
          title: "Time-Consuming Process",
          description: "Hours of scheduling, traveling, and waiting",
          stat: "8+ hours wasted"
        }
      ]
    },
    {
      type: "solution",
      title: "AI Revolution Solutions",
      subtitle: "The future is here",
      items: [
        {
          image: "/content/manoj.jpg",
          title: "100% Authentic You",
          description: "AI-generated photos that actually look like you",
          stat: "100% authentic"
        },
        {
          image: "/content/yours3.jpg",
          title: "Fraction of the Cost",
          description: "Professional headshots for less than $20",
          stat: "Under $20"
        },
        {
          image: "/content/paint.png",
          title: "Instant Results",
          description: "Get 200+ professional photos in minutes",
          stat: "5 minutes"
        }
      ]
    }
  ];

  return (
    <section className="py-20 bg-[#111111] relative">
      {/* Simple background pattern - matching hero section style */}
      <div 
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `url('/bg-pattern.svg')`,
          backgroundPosition: 'center',
          backgroundRepeat: 'repeat',
          backgroundSize: '100px'
        }}
      />

      <div className="container mx-auto px-6 relative z-10">
        {/* Main Heading - matching hero section style */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold leading-tight mb-6">
            <span className="text-white">
              From Frustrating Photo Shoots to
            </span>
            <span className="text-[#ff6f00] ml-2">
              Instant Professional Headshots
            </span>
          </h2>
          <p className="text-lg text-gray-400 max-w-3xl mx-auto">
            Stop wasting time and money on traditional photography. Get professional headshots that actually look like you.
          </p>
        </div>

        {/* Timeline Container */}
        <div className="max-w-6xl mx-auto">
          <div className="relative">
            
            {/* Simple Timeline Line */}
            <div className="absolute left-1/2 transform -translate-x-1/2 w-px h-full bg-gray-700"></div>
            
            {/* Timeline Steps */}
            <div className="space-y-20">
              {timelineSteps.map((step, stepIndex) => (
                <div key={stepIndex} className="relative">
                  
                  {/* Timeline Dot */}
                  <div className="absolute left-1/2 transform -translate-x-1/2 -translate-y-1/2 top-0">
                    <div className={`w-4 h-4 rounded-full ${
                      step.type === 'problem' 
                        ? 'bg-red-500' 
                        : 'bg-[#ff6f00]'
                    }`}></div>
                  </div>

                  {/* Step Content */}
                  <div className={`flex items-center ${stepIndex % 2 === 0 ? 'flex-row' : 'flex-row-reverse'}`}>
                    
                    {/* Content Side */}
                    <div className="w-1/2 px-8">
                      <div className={`${stepIndex % 2 === 0 ? 'text-right' : 'text-left'}`}>
                        <div className={`inline-block px-3 py-1 rounded text-xs font-medium mb-3 ${
                          step.type === 'problem' 
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                            : 'bg-[#ff6f00]/10 text-[#ff6f00] border border-[#ff6f00]/20'
                        }`}>
                          {step.type === 'problem' ? 'BEFORE' : 'AFTER'}
                        </div>
                        <h3 className="text-2xl font-semibold text-white mb-2">{step.title}</h3>
                        <p className="text-gray-400">{step.subtitle}</p>
                      </div>
                    </div>

                    {/* Spacer for timeline */}
                    <div className="w-16"></div>

                    {/* Items Side */}
                    <div className="w-1/2 px-8">
                      <div className="space-y-4">
                        {step.items.map((item, itemIndex) => (
                          <div 
                            key={itemIndex}
                            className="group relative"
                          >
                            <div className={`bg-gray-900/50 rounded-lg p-4 border transition-colors duration-200 ${
                              step.type === 'problem' 
                                ? 'border-gray-800 hover:border-red-500/30' 
                                : 'border-gray-800 hover:border-[#ff6f00]/30'
                            }`}>
                              
                              <div className="flex items-center space-x-3">
                                <div className="relative w-12 h-12 rounded-full overflow-hidden flex-shrink-0">
                                  <Image
                                    src={item.image}
                                    alt={item.title}
                                    fill
                                    className="object-cover"
                                  />
                                </div>
                                
                                <div className="flex-1">
                                  <h4 className="text-base font-medium text-white mb-1">{item.title}</h4>
                                  <p className="text-gray-400 text-sm mb-2">{item.description}</p>
                                  <div className={`inline-block px-2 py-1 rounded text-xs ${
                                    step.type === 'problem' 
                                      ? 'bg-red-500/10 text-red-400' 
                                      : 'bg-[#ff6f00]/10 text-[#ff6f00]'
                                  }`}>
                                    {item.stat}
                                  </div>
                                </div>

                                <div className={`text-lg ${
                                  step.type === 'problem' ? 'text-red-500' : 'text-[#ff6f00]'
                                }`}>
                                  {step.type === 'problem' ? '✗' : '✓'}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Stats - Clean and Simple */}
        <div className="mt-16 grid md:grid-cols-3 gap-6 text-center">
          <div className="bg-gray-900/30 rounded-lg p-6 border border-gray-800">
            <div className="text-2xl font-bold text-[#ff6f00] mb-2">95%</div>
            <div className="text-white text-sm font-medium">Cost Reduction</div>
            <div className="text-gray-500 text-xs mt-1">vs Traditional Photography</div>
          </div>
          <div className="bg-gray-900/30 rounded-lg p-6 border border-gray-800">
            <div className="text-2xl font-bold text-[#ff6f00] mb-2">10x</div>
            <div className="text-white text-sm font-medium">Faster Results</div>
            <div className="text-gray-500 text-xs mt-1">Minutes vs Hours</div>
          </div>
          <div className="bg-gray-900/30 rounded-lg p-6 border border-gray-800">
            <div className="text-2xl font-bold text-[#ff6f00] mb-2">100%</div>
            <div className="text-white text-sm font-medium">Authenticity</div>
            <div className="text-gray-500 text-xs mt-1">Looks exactly like you</div>
          </div>
        </div>

        {/* Final CTA - Clean and Simple */}
        <div className="text-center mt-16">
          <div className="bg-[#ff6f00] rounded-lg p-8 max-w-2xl mx-auto">
            <h3 className="text-2xl font-bold text-white mb-4">Ready to Transform Your Professional Image?</h3>
            <p className="text-orange-100 mb-6">Join thousands who've already made the switch to AI headshots</p>
            <button className="bg-white text-[#ff6f00] font-medium py-3 px-8 rounded hover:bg-gray-100 transition-colors duration-200">
              Get Started Now
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProblemSolutionVariant2;