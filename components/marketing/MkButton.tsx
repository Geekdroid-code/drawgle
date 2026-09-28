import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary";
type Size = "sm" | "default" | "lg";

type StyleProps = {
  variant?: Variant;
  /** Icon rendered before the label. */
  leading?: ReactNode;
  size?: Size;
  /** Primary buttons carry the white arrow disc; set false for a text-only pill. */
  icon?: boolean;
  /** Secondary style for dark backgrounds. */
  dark?: boolean;
  className?: string;
};

type ButtonProps = StyleProps & { children: ReactNode } & Omit<ComponentPropsWithoutRef<"button">, keyof StyleProps> & {
    href?: undefined;
  };

type LinkProps = StyleProps & { children: ReactNode } & Omit<ComponentPropsWithoutRef<typeof Link>, keyof StyleProps | "href"> & {
    href: string;
  };

export type MkButtonProps = ButtonProps | LinkProps;

const heights: Record<Size, string> = {
  sm: "h-8 text-xs",
  default: "h-10 text-sm",
  lg: "h-11 text-base",
};

const primaryPadding: Record<Size, { icon: string; plain: string }> = {
  sm: { icon: "pl-3.5 pr-1", plain: "px-3.5" },
  default: { icon: "pl-4.5 pr-1.5", plain: "px-5" },
  lg: { icon: "pl-5.5 pr-2", plain: "px-6" },
};

const secondaryPadding: Record<Size, string> = {
  sm: "px-3.5",
  default: "px-5",
  lg: "px-6",
};

const discSize: Record<Size, string> = {
  sm: "size-6",
  default: "size-7",
  lg: "size-7.5",
};

const arrowSize: Record<Size, string> = {
  sm: "size-3",
  default: "size-3.5",
  lg: "size-4",
};

/** The white disc with the chevron that turns into an arrow on hover. */
function ArrowDisc({ size }: { size: Size }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative ml-0.5 flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white",
        discSize[size],
      )}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="#305dde"
        className={cn(
          "absolute transition-all duration-200 ease-out group-hover:translate-x-3 group-hover:opacity-0",
          arrowSize[size],
        )}
      >
        <path d="M9 6s6 4.42 6 6-6 6-6 6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="#305dde"
        className={cn(
          "absolute -translate-x-3 opacity-0 transition-all duration-200 ease-out group-hover:translate-x-0 group-hover:opacity-100",
          arrowSize[size],
        )}
      >
        <path d="M18.5 12H5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M13 18s6-4.42 6-6-6-6-6-6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export function mkButtonClassName({
  variant = "primary",
  size = "default",
  icon = true,
  dark = false,
  className,
}: Omit<StyleProps, "leading">) {
  const base =
    "group inline-flex shrink-0 cursor-pointer select-none items-center justify-center whitespace-nowrap rounded-full font-semibold outline-none transition-all focus-visible:ring-2 focus-visible:ring-mk-accent/40 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

  if (variant === "primary") {
    return cn(
      base,
      "gap-2 bg-mk-accent text-white hover:bg-mk-accent-strong active:scale-[0.98]",
      heights[size],
      icon ? primaryPadding[size].icon : primaryPadding[size].plain,
      className,
    );
  }

  return cn(
    base,
    "gap-1.5 border border-transparent active:translate-y-px active:scale-[0.98]",
    dark ? "bg-white/10 text-white hover:bg-white/15" : "bg-black/[0.05] text-mk-ink hover:bg-black/[0.08]",
    heights[size],
    secondaryPadding[size],
    className,
  );
}

export function MkButton({
  variant = "primary",
  size = "default",
  icon = true,
  dark = false,
  leading,
  className,
  children,
  ...rest
}: MkButtonProps) {
  const classes = mkButtonClassName({ variant, size, icon, dark, className });
  const content =
    variant === "primary" ? (
      <>
        {leading}
        <span>{children}</span>
        {icon ? <ArrowDisc size={size} /> : null}
      </>
    ) : (
      <>
        {leading}
        {children}
      </>
    );

  if (typeof rest.href === "string") {
    const linkProps = rest as Omit<LinkProps, keyof StyleProps | "children">;
    return (
      <Link {...linkProps} className={classes}>
        {content}
      </Link>
    );
  }

  const { type, ...buttonProps } = rest as Omit<ButtonProps, keyof StyleProps | "children">;
  return (
    <button {...buttonProps} type={type ?? "button"} className={classes}>
      {content}
    </button>
  );
}
