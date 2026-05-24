import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function StylePacks() {
  const cardData = [
    {
      title: "MD Doctor Headshots",
      description:
        "Present yourself with the trust and authority of a medical professional, perfect for medical profiles or practice websites.",
      image: "/content/doctor1.webp",
      url: "/ai-doctor-headshots",
    },
    {
      title: "Social Media AI Photos",
      description:
        "Make your profile pop with creative, eye-catching images that show off your personality and style.",
      image: "/content/socialimage.jpg",
      url: "/ai-instagram-photoshoot",
    },
    {
      title: "AI Glamour Photos",
      description:
        "Unleash your inner star with stunning glamour photos that highlight your confidence and elegance.",
      image: "/content/glamour3.webp",
      url: "/ai-glamour-photoshoot",
    },
    {
      title: "Corporate Headshots",
      description:
        "Make a strong impression with corporate headshots that reflect your professionalism, ideal for company websites or business cards.",
      image: "/content/corporate1.jpg",
      url: "/corporate-headshots",
    },
    {
      title: "Professional Headshots",
      description:
        "Create a polished, professional image for LinkedIn or your resume, making a strong first impression in any industry.",
      image: "/content/professional1.jpg",
      url: "/professional-headshots",
    },
    {
      title: "Christmas Photoshoot",
      description:
        "Embrace the holiday spirit with festive photos that capture the joy and warmth of the season, perfect for family cards or social media.",
      image: "/content/christmas1.jpg",
      url: "/ai-christmas-photoshoot",
    },
    {
      title: "Founder Headshots",
      description:
        "Capture the essence of your startup with stunning founder headshots that highlight your vision and drive.",
      image: "/content/founder1.jpg",
      url: "/founder-headshots",
    },
    {
      title: "Lawyer Headshots",
      description:
        "Project confidence and professionalism with sharp, approachable lawyer headshots that leave a lasting impression on clients and colleagues.",
      image: "/content/lawyer5.webp",
      url: "/ai-lawyer-headshots",
    },
  ];

  return (
    <section id="style-packs" className="min-h-screen bg-[#111111]">
        <div className="py-20 min-h-screen">
          <div className="max-w-7xl mx-auto px-4">
            {/* Title Section */}
            <div className="mb-16 max-w-4xl">
                <p className="text-gray-100 font-normal text-xl mb-4 block">
                  Choose From 10+ AI Photoshoot Styles
                </p>
              <h2 className="text-4xl md:text-6xl text-white font-bold mb-6">
                
                Explore the Curated Shoots Library of <span className="text-[#ff6f00]">Our AI Photo Maker</span>
              </h2>
            </div>

            {/* Cards Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
              {cardData.map((card, index) => (
                <Card
                  key={index}
                  className="bg-black p-0 rounded-[15px] overflow-hidden border border-gray-700 shadow-md transition-all duration-300 hover:border-[#ff6f00] hover:border-2"
                >
                  <CardContent className="p-0">
                    <div className="relative">
                      <div className="absolute top-0 right-0 w-16 h-16 bg-black rounded-bl-[32px] z-10" />
                      <Link href={card.url}>
                        <Image
                          src={card.image}
                          alt={`${card.title} example`}
                          width={400}
                          height={300}
                          className="w-full object-cover rounded-t-[18px]"
                        />
                      </Link>
                      <Link href={card.url}>
                        <Button
                          size="icon"
                          className="absolute top-3 right-3 rounded-full bg-[#ff6f00]/80 hover:bg-[#ff6f00] transition-colors duration-300 z-20"
                        >
                          <ArrowUpRight className="h-5 w-5 text-white" />
                        </Button>
                      </Link>
                    </div>
                    <div className="p-3 sm:p-6">
                      <h3 className="text-xl font-bold text-white mb-2">
                        {card.title}
                      </h3>
                      <p className="text-gray-300 text-sm leading-tight">
                        {card.description}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Bottom Section */}
            <div className="flex flex-col md:flex-row justify-between items-center">
              <div className="max-w-2xl mb-4 md:mb-0">
                <p className="text-lg text-gray-300 max-w-3xl mx-auto">
                UnrealShot AI turns your selfies into professional AI photoshoots.{" "}
                  <span className="text-[#ff6f00] font-semibold">
                  Upload your photos, choose a style pack, enter a prompt,{" "}  
                  </span> 
                   and get photos that feel real, not AI-generated.
                </p>
              </div>
              <p className="text-gray-300 italic text-sm md:transform md:rotate-6 md:w-48 sm:text-center sm:w-auto">
                If you're not happy, we will refund your full money
              </p>
            </div>
          </div>
        </div>
      </section>
  );
}