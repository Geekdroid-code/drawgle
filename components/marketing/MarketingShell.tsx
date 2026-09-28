import type { ReactNode } from "react";

import { Footer } from "@/components/marketing/Footer";
import { Navbar } from "@/components/marketing/Navbar";
import { marketingFontVariables } from "@/components/marketing/fonts";
import { cn } from "@/lib/utils";

/** Page frame for every public page: fonts, floating nav, footer. */
export function MarketingShell({
  children,
  className,
  footer = true,
}: {
  children: ReactNode;
  className?: string;
  footer?: boolean;
}) {
  return (
    <div className={cn("mk-root relative", marketingFontVariables, className)}>
      <Navbar />
      {children}
      {footer ? <Footer /> : null}
    </div>
  );
}
