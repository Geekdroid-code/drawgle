"use client"

import type React from "react"
import { Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Caveat } from 'next/font/google';

// Configure the Caveat font
const caveat = Caveat({
  subsets: ['latin'],
  weight: '500',
});

interface NicheTestimonialCardProps {
  quote: string
  name: string
  role: string
  avatar: string
  rating: number
}

const NicheTestimonialCard: React.FC<NicheTestimonialCardProps> = ({ quote, name, role, avatar, rating }) => {
  return (
    <div className="bg-[#1a1a1a] rounded-xl p-6 shadow-sm border border-[rgba(255,255,255,0.1)] hover:shadow-lg hover:border-[rgba(255,255,255,0.2)] transition-all duration-300">
      <div className="flex items-center mb-4">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className={`h-4 w-4 ${
              i < rating ? "text-yellow-400 fill-current" : "text-gray-600"
            }`}
          />
        ))}
      </div>
      <blockquote className="text-gray-300 mb-4 text-sm leading-relaxed">
        "{quote}"
      </blockquote>
      <div className="flex items-center">
        <img
          src={avatar || "/placeholder.svg"}
          alt={name}
          className="h-10 w-10 rounded-full object-cover mr-3"
        />
        <div>
          <h4 className="font-semibold text-white text-sm">{name}</h4>
          <p className="text-gray-400 text-xs">{role}</p>
        </div>
      </div>
    </div>
  )
}

interface NicheTestimonialSectionProps {
  testimonials: NicheTestimonialCardProps[]
  title: string
  subtitle: string
}

export default function NicheTestimonialSection({ testimonials, title, subtitle }: NicheTestimonialSectionProps) {
  return (
    <section className="relative py-20 bg-[#111111]">
      <div className="container mx-auto max-w-7xl px-4">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-white text-4xl md:text-5xl lg:text-6xl font-bold mb-6" dangerouslySetInnerHTML={{ __html: title }}></h2>
          <p className="mx-auto max-w-2xl text-xl text-gray-300">
            {subtitle}
          </p>
        </div>

        {/* Testimonials Grid with Blur Overlay */}
        <div className="relative">
          {/* Blur overlay gradients */}
          <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-[#111111] to-transparent z-10 pointer-events-none"></div>
          <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-[#111111] to-transparent z-10 pointer-events-none"></div>
          <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-[#111111] to-transparent z-10 pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#111111] to-transparent z-10 pointer-events-none"></div>
          
          {/* Testimonials Container */}
          <div className="overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-8">
              {/* First Row */}
              <div className="space-y-6">
                {testimonials[0] && <NicheTestimonialCard {...testimonials[0]} />}
                {testimonials[1] && <NicheTestimonialCard {...testimonials[1]} />}
              </div>
              <div className="space-y-6">
                {testimonials[2] && <NicheTestimonialCard {...testimonials[2]} />}
                {testimonials[3] && <NicheTestimonialCard {...testimonials[3]} />}
              </div>
              <div className="space-y-6">
                {testimonials[4] && <NicheTestimonialCard {...testimonials[4]} />}
                {testimonials[5] && <NicheTestimonialCard {...testimonials[5]} />}
              </div>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center mt-16">
          
          <div className="inline-block relative">
            <Link href="/ai-glamour-photoshoot" className="inline-block">
              <Button
                size="lg"
                className="group relative bg-[#ff6f00] hover:bg-[#ff6f00]/90 text-white rounded-md overflow-hidden cursor-pointer px-6 pr-16 py-6 font-semibold text-base shadow-[0_4px_20px_-5px_rgba(0,0,0,0.2)]"
              >
                Transform Your Photos Now
                <div className="bg-white rounded-sm p-3 absolute right-1 top-1/2 -translate-y-1/2">
                    <img
                      src="/arrow.svg"
                      alt="arrow-right"
                      className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1"
                    />
                  </div>
              </Button>
            </Link>
            
             {/* Whirl Arrow pointing to floating text */}
              <div className="hidden md:block absolute right-75 top-4 mt-4 -translate-y-1/2 w-16 h-20 pointer-events-none">
              <svg 
                viewBox="0 0 59 42" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg" 
                className="w-full h-full text-orange-500 opacity-70 transform rotate-20"
              >
                <path 
                  d="M7.66614 22.083C8.61245 23.967 9.50382 25.809 10.5502 27.8855C9.46822 27.9516 8.62906 27.273 8.11869 26.4189C6.58755 23.8566 5.08123 21.2357 3.75924 18.5229C2.99812 16.9739 3.65927 15.9282 5.04612 16.172C7.36079 16.5421 9.68076 17.0712 12.0256 17.5417C12.1602 17.5669 12.3348 17.5838 12.4048 17.6759C12.7097 17.9858 12.9498 18.3626 13.2298 18.7311C12.9958 18.9402 12.8221 19.3502 12.5678 19.35C11.6851 19.3744 10.8123 19.29 9.95444 19.2559C9.48565 19.2471 9.04169 19.1798 8.47894 19.5644C9.09834 20.0754 9.7328 20.6367 10.3522 21.1477C23.4279 31.1179 38.4176 30.6525 47.7967 20.0973C48.9958 18.7256 50.015 17.178 51.1441 15.7141C51.5421 15.2039 51.955 14.7439 52.353 14.2337C52.5027 14.3091 52.6277 14.4431 52.7774 14.5186C52.7934 14.9956 52.9342 15.6067 52.7454 15.9665C52.1844 17.2048 51.6234 18.443 50.8975 19.5556C43.7187 30.665 30.0661 33.8934 16.8279 27.4803C14.2971 26.248 11.87 24.5135 9.42336 22.9967C8.90409 22.6783 8.44951 22.2929 7.95505 21.9159C7.86023 21.8823 7.75566 21.9576 7.66614 22.083Z" 
                  fill="currentColor"
                  stroke="currentColor"
                  strokeWidth="0.5"
                />
              </svg>
            </div>
            
            <p className={`text-gray-400 ${caveat.className} text-lg font-semibold 
                          md:absolute md:transform md:-rotate-6 md:-left-52 md:-top-1/4 md:-translate-y-1/2 md:w-48
                          sm:static sm:mt-2 sm:transform-none sm:rotate-0 sm:text-center sm:w-auto leading-none`}>
              Trusted by 1,200+ professionals worldwide
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}