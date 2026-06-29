import Link from 'next/link';
import { AgentBall } from "@/components/AgentBall"
import { DrawgleLogo } from "@/components/DrawgleLogo"
import { cn } from "@/lib/utils"

function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center">
      <span
        className={cn(
          "flex items-center justify-center rounded-md",
          compact ? "size-8 [&_svg]:!size-5" : "size-9 [&_svg]:!size-6",
        )}
      >
        <DrawgleLogo className={cn("text-[#1B7FCC] fill-current", compact ? "h-5 w-5" : "h-6 w-6")} />
      </span>
    </span>
  );
}

export default function Footer() {
  const footerLinks = {
    Community: [
      { href: '/pricing', label: 'Pricing' },
      { href: '/showcase', label: 'Showcase' },
    ],
    Resources: [
      { href: '/vs', label: 'Comparisons' },
      { href: '/vs/sleek-design', label: 'Drawgle vs Sleek.design' },
    ],

    Legal: [
      { href: '/terms', label: 'Terms of Service' },
      { href: '/privacy-policy', label: 'Privacy Policy' },
      { href: '/refunds-policy', label: 'Refunds Policy' },
    ],
  };

  return (
    <footer className="w-full py-12 px-6 mt-auto bg-white border-t border-gray-100">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start gap-8">
          <div className="md:text-left flex-shrink-0">
            
            <Link href="/" className="flex items-center gap-2 justify-start">
              <BrandLogo />
              <h3 className="text-2xl font-bold text-gray-900 hover:text-[#1b7fcc] transition-colors">
                Drawgle
              </h3>
            </Link>
            
            <p className="text-gray-600 text-sm mt-2 max-w-[200px] mx-auto md:mx-0">
              Ship beautiful UIs at the speed of thought.
            </p>
            
          
          </div>

          {/* Link groups */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-8 md:gap-12 w-full mt-8 md:mt-0">
            {Object.entries(footerLinks).map(([category, links]) => (
              <div key={category}>
                <h3 className="text-sm font-semibold text-gray-900 mb-4">{category}</h3>
                <ul className="space-y-3">
                  {links.map((link) => (
                    <li key={link.label}>
                      <Link href={link.href} className="text-gray-600 hover:text-gray-900 transition-colors text-sm font-medium">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom copyright */}
        <div className="border-t border-gray-200 mt-12 pt-8 text-center md:flex md:items-center md:justify-center">
          <p className="text-gray-500 text-sm">
            © {new Date().getFullYear()} Drawgle. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
