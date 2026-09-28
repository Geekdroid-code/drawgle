import Link from "next/link";

import { BrandMark } from "@/components/marketing/BrandMark";
import { siteConfig } from "@/lib/seo/config";

const footerColumns = [
  {
    title: "Product",
    links: [
      { href: "/#how-it-works", label: "How it works" },
      { href: "/#features", label: "Features" },
      { href: "/showcase", label: "Showcase" },
      { href: "/pricing", label: "Pricing" },
      { href: "/#faqs", label: "FAQs" },
    ],
  },
  {
    title: "Compare",
    links: [
      { href: "/alternatives", label: "All alternatives" },
      { href: "/alternatives/sleek-design", label: "Sleek.design alternative" },
      { href: "/alternatives/google-stitch", label: "Google Stitch alternative" },
      { href: "/alternatives/app-alchemy", label: "App Alchemy alternative" },
      { href: "/alternatives/uizard", label: "Uizard alternative" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/terms", label: "Terms of Service" },
      { href: "/privacy-policy", label: "Privacy Policy" },
      { href: "/refunds-policy", label: "Refund Policy" },
      { href: "/editorial-policy", label: "Editorial Policy" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-neutral-200/80 bg-white py-12 text-xs text-neutral-600 sm:py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-12 grid grid-cols-2 gap-8 md:grid-cols-5">
          <div className="col-span-2">
            <Link href="/" aria-label="Drawgle home" className="mb-3 inline-flex">
              <BrandMark />
            </Link>
            <p className="mb-4 max-w-xs text-xs leading-relaxed text-neutral-500">
              AI mobile app design from first prompt to developer handoff. Editable screens, shared design tokens,
              Tailwind HTML, and an Agent Pack for your coding tools.
            </p>
            <a
              href={`mailto:${siteConfig.supportEmail}`}
              className="text-[11px] font-medium text-neutral-500 transition-colors hover:text-mk-ink"
            >
              {siteConfig.supportEmail}
            </a>
          </div>

          {footerColumns.map((column) => (
            <div key={column.title}>
              <h2 className="mb-3 text-xs font-bold tracking-tight text-neutral-900">{column.title}</h2>
              <ul className="space-y-2">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="transition-colors hover:text-neutral-900">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center justify-between gap-4 border-t border-neutral-100 pt-8 text-[11px] text-neutral-400 sm:flex-row">
          <p>© {new Date().getFullYear()} Drawgle. All rights reserved.</p>
          <a
            href={siteConfig.sameAs[0]}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-neutral-600"
          >
            Built in public by {siteConfig.creatorHandle}
          </a>
        </div>
      </div>
    </footer>
  );
}
