import Link from 'next/link';
import Image from 'next/image';



export default function Footer() {
  // Public pages
  const companyLinks = [
    { href: '/about', label: 'About' },
    { href: '/blog', label: 'Blog' },
    { href: '/pricing', label: 'Pricing' },
    { href: '/privacy-policy', label: 'Privacy Policy' },
    { href: '/terms', label: 'Terms' },
    { href: '/refund-policy', label: 'Refund Policy' },
    { href: '/profile-photo-maker', label: 'PFP Maker' },
  ];

  return (
    <footer className="w-full py-8 px-6 mt-auto bg-white border-t border-gray-100">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="text-center md:text-left">
            
            <Link href="/" className="flex items-center gap-2">
             <Image
        src="/site-logo.png"
        alt="Unrealshot AI Logo"
        width={24}
        height={24}
        className="w-6 h-6 rounded"
      />
            <h3 className="text-2xl font-bold text-gray-900 hover:text-[#ff6f00] transition-colors">
              Unrealshot AI
            </h3>
            </Link>
            
            <p className="text-gray-600 text-sm mt-1">
              Professional AI photoshoots
            </p>
          </div>

        
          {/* Social Links */}
          <div className="flex gap-4">
            <a
              href="https://x.com"
              target="_blank"
              rel="noopener noreferrer"
              className="w-10 h-10 hover:bg-gray-100 bg-[#ff6f00] rounded-full flex items-center justify-center transition-colors group"
            >
              <svg className="w-5 h-5 group-hover:text-gray-600 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </a>
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              className="w-10 h-10 hover:bg-gray-100 bg-[#ff6f00] rounded-full flex items-center justify-center transition-colors group"
            >
              <svg className="w-5 h-5 group-hover:text-gray-600 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
            </a>
          </div>
        </div>

        {/* Link groups */}
        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Company */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Company</h3>
            <ul className="mt-3 space-y-2">
              {companyLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-gray-600 hover:text-gray-900 transition-colors text-sm">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Photoshoot styles */}
          <div className="md:col-span-2">
            <h3 className="text-sm font-semibold text-gray-900">Photoshoot styles</h3>
            {/* Category grid - minimal & responsive */}
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {Object.entries(photoshootCategories).map(([category, links]) => (
                <div key={category}>
                  <h4 className="text-xs font-semibold text-gray-700">{category}</h4>
                  <ul className="mt-2 space-y-2">
                    {links.map((link) => (
                      <li key={link.href}>
                        <Link href={link.href} className="text-gray-600 hover:text-gray-900 transition-colors text-sm">
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom copyright */}
        <div className="border-t border-gray-200 mt-8 pt-6 text-center">
          <p className="text-gray-500 text-xs">
            © {new Date().getFullYear()} Unrealshot AI. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}


  // Photoshoot landing pages grouped into subcategories (keep wording as-is)
  const photoshootCategories = {
    'Headshots': [
      { href: '/founder-headshots', label: 'Founder Headshots' },
      { href: '/corporate-headshots', label: 'Corporate Headshots' },
      { href: '/professional-headshots', label: 'Professional Headshots' },
      { href: '/linkedin-headshots', label: 'LinkedIn Headshots' },
      { href: '/resume-headshots', label: 'Resume Headshots' },
      { href: '/ai-doctor-headshots', label: 'Doctor Headshots' },
      { href: '/ai-lawyer-headshots', label: 'Lawyer Headshots' },
      { href: '/ai-real-estate-headshots', label: 'Real Estate Headshots' },
      { href: '/ai-chef-headshots', label: 'Chef Headshots' },
    ],
    'Lifestyle': [
      { href: '/personal-branding-photoshoot', label: 'Personal Branding' },
      { href: '/street-style-photoshoot', label: 'Street Style' },
      { href: '/office-outfit-photoshoot', label: 'Office Outfit' },
      { href: '/denim-wear-photoshoot', label: 'Denim Wear' },
      { href: '/natural-looks-photoshoot', label: 'Natural Looks' },
      { href: '/vintage-photoshoot', label: 'Vintage' },
      { href: '/ai-maternity-photoshoot', label: 'Maternity' },
      { href: '/ai-glamour-photoshoot', label: 'Glamour' },
    ],
    'AI Events': [
      { href: '/ai-christmas-photoshoot', label: 'Christmas' },
      { href: '/ai-halloween-photoshoot', label: 'Halloween' },
      { href: '/ai-diwali-photoshoot', label: 'Diwali' },
      { href: '/ai-botanic-illustrations', label: 'Botanic Illustrations' },
      { href: '/ai-yearbook', label: 'AI Yearbook' },
    ],
    'Social & Influencer': [
      { href: '/ai-influencer-generator', label: 'Influencer Generator' },
      { href: '/ai-instagram-photoshoot', label: 'Instagram Photoshoot' },
      { href: '/ai-dating-photoshoot', label: 'Dating' },
    ],
    'Artistic & Themes': [
      { href: '/stylish-ai-portraits', label: 'Stylish AI Portraits' },
      { href: '/black-swan-photoshoot', label: 'Black Swan' },
      { href: '/ai-fantasy-photoshoot', label: 'Fantasy' },
      { href: '/neutral-muse-photoshoot', label: 'Neutral Muse' },
    ],
  } as const;