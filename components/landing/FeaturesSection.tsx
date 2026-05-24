"use client"; 

import { Shield, Palette, Zap, Sparkles, SlidersHorizontal, FileText } from 'lucide-react'; 
import { motion } from 'framer-motion'; 
import { FeatureCard } from '@/components/ui/grid-feature-cards'; 

const features = [ 
	 { 
	 	 title: "Hyper-Realistic Authenticity", 
	 	 icon: Shield, 
	 	 description: "Our AI is trained to preserve your unique features, not replace them. The result is a stunningly realistic photo that actually looks like you.", 
	 }, 
	 { 
	 	 title: "A Style for Every Profile", 
	 	 icon: Palette, 
	 	 description: "Go beyond a single headshot. Get a diverse portfolio with styles for every platform, from corporate to creative, and everything in between.", 
	 }, 
	 { 
	 	 title: "Ready in Minutes, Not Weeks", 
	 	 icon: Zap, 
	 	 description: "Skip the scheduling, travel, and awkward poses. Your entire professional photoshoot is generated and delivered in less time than a coffee break.", 
	 }, 
	 { 
	 	 title: "Perfect Studio Quality", 
	 	 icon: Sparkles, 
	 	 description: "Every image is generated with perfect lighting, composition, and detail, giving you the quality of a professional studio shoot without the hassle.", 
	 }, 
	 { 
	 	 title: "You Are The Art Director", 
	 	 icon: SlidersHorizontal, 
	 	 description: "Take full control of your look. Generate countless options with different outfits, backgrounds, and styles until you find the perfect shots.", 
	 }, 
	 { 
	 	 title: "Full Commercial License", 
	 	 icon: FileText, 
	 	 description: "Your photos are yours. Every image comes with a full commercial license for your business, your brand, or any project with complete peace of mind.", 
	 }, 
]; 

export function FeaturesSection() { 
	 return ( 
	 	 <section id="features" className="py-16 md:py-20 bg-[#111111]"> 
	 	 	 <div className="mx-auto w-full max-w-6xl space-y-8 px-4"> 
	 	 	 	 <div className="mx-auto max-w-3xl text-center mb-12"> 
	 	 	 	 	 <h2 className="text-white text-4xl md:text-5xl lg:text-6xl font-bold mb-6"> 
	 	 	 	 	 	 The Full Studio Experience.  <br /> 
	 	 	 	 	 	 <span className="text-[#ff6f00]">Zero Studio Hassle.</span> 
	 	 	 	 	 </h2> 
	 	 	 	 	 <p className="text-lg sm:text-xl text-gray-300 max-w-3xl mx-auto leading-tight"> 
	 	 	 	 	 	Unrealshot is a suite of powerful photoshoot ai tools designed to give you complete creative control and stunning, authentic results.
	 	 	 	 	 </p> 
	 	 	 	 </div> 

	 	 	 	 <div 
				
				className="grid grid-cols-1 divide-x divide-y divide-dashed border border-dashed border-gray-600/30 sm:grid-cols-2 md:grid-cols-3"
	 	 	 	 > 
	 	 	 	 	 {features.map((feature, i) => ( 
	 	 	 	 	 	 <FeatureCard key={i} feature={feature} /> 
	 	 	 	 	 ))} 
	 	 	 	 </div> 
	 	 	 </div> 
	 	 </section> 
	 ); 
} 

type ViewAnimationProps = { 
	 delay?: number; 
	 className?: React.ComponentProps<typeof motion.div>['className']; 
	 children: React.ReactNode; 
}; 

