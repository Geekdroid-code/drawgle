import type {Metadata} from 'next';
import './globals.css';
import { Geist } from "next/font/google";
import { GeistPixelSquare } from "geist/font/pixel";
import { cn } from "@/lib/utils";
import { JsonLd } from "@/components/seo/JsonLd";
import { siteConfig } from "@/lib/seo/config";
import { buildMetadata } from "@/lib/seo/metadata";
import { organizationSchema, webApplicationSchema, websiteSchema } from "@/lib/seo/schema";

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
        <JsonLd data={[organizationSchema(), websiteSchema(), webApplicationSchema()]} />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}