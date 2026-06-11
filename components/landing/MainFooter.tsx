import Link from 'next/link';
import { AgentBall } from "@/components/AgentBall"
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
        <AgentBall className={compact ? "h-5 w-5" : "h-6 w-6"} />
      </span>
    </span>
  );
}

export default function Footer() {
  const footerLinks = {
    Community: [
      { href: '/pricing', label: 'Pricing' },
      { href: '/showcase', label: 'Showcase' },
      { href: '/affiliates', label: 'Affiliates' },
    ],
    Resources: [
      { href: '/blog', label: 'Blog' },
      { href: '/vs/google-stitch', label: 'vs Google Stitch' },
      { href: '/vs/Sleek', label: 'vs Sleek.design' },
      { href: '/vs/app-alchemy', label: 'vs App Alchemy' },
      { href: '/vs/screensdesign', label: 'vs ScreensDesign' },
      { href: '/vs/floow', label: 'vs Floow.design' },
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
          <div className="text-center md:text-left flex-shrink-0">
            
            <Link href="/" className="flex items-center gap-2 justify-center md:justify-start">
              <BrandLogo />
              <h3 className="text-2xl font-bold text-gray-900 hover:text-[#1b7fcc] transition-colors">
                Drawgle
              </h3>
            </Link>
            
            <p className="text-gray-600 text-sm mt-2 max-w-[200px] mx-auto md:mx-0">
              Ship beautiful UIs at the speed of thought.
            </p>
            
            {/* Social Links */}
            <div className="flex gap-4 mt-6 justify-center md:justify-start">
              <a
                href="https://x.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 hover:bg-gray-100 bg-[#1b7fcc] rounded-full flex items-center justify-center transition-colors group"
              >
                <svg className="w-5 h-5 group-hover:text-gray-600 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 hover:bg-gray-100 bg-[#1b7fcc] rounded-full flex items-center justify-center transition-colors group"
              >
                <svg className="w-5 h-5 group-hover:text-gray-600 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </a>
            </div>
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
