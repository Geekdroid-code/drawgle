import type {Metadata} from 'next';
import './globals.css';
import Script from "next/script";
import { Geist } from "next/font/google";
import { GeistPixelSquare } from "geist/font/pixel";
import { cn } from "@/lib/utils";
import { JsonLd } from "@/components/seo/JsonLd";
import { siteConfig } from "@/lib/seo/config";
import { buildMetadata } from "@/lib/seo/metadata";
import { organizationSchema, websiteSchema } from "@/lib/seo/schema";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});
const geistPixelSquare = GeistPixelSquare;

export const metadata: Metadata = {
  ...buildMetadata(),
  title: {
    default: siteConfig.defaultTitle,
    template: `%s | ${siteConfig.name}`,
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable, geistPixelSquare.variable)}>
      <head>
        <meta name="google-site-verification" content="49PXdY-HAHFpO0MJS7UIQlLOJ9t4q0Et6a97Fj2BKvE" />
        <JsonLd data={[organizationSchema(), websiteSchema()]} />
      </head>
      <body>
        <Script async src="https://www.googletagmanager.com/gtag/js?id=G-L2Z678EBMX" />
        <Script id="google-analytics">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-L2Z678EBMX');
          `}
        </Script>
        {children}
      </body>
    </html>
  );
}
