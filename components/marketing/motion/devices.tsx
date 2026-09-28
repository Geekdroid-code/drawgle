import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The dark device slice used in the How it works cards.
 * `edge="bottom"` bleeds off the card's bottom edge; `edge="top"` hangs from the top.
 */
export function DeviceSlice({
  edge,
  children,
  className,
}: {
  edge: "top" | "bottom";
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative w-[285px] max-w-full border-[#25282d] bg-[#111315] p-3 shadow-xl",
        edge === "bottom" ? "rounded-t-[32px] border-x-[4px] border-t-[4px] pb-0" : "rounded-b-[32px] border-x-[4px] border-b-[4px] pt-6",
        className,
      )}
    >
      {edge === "bottom" ? (
        <div className="mx-auto mb-3 flex h-3 w-16 items-center justify-end rounded-full bg-black px-1.5">
          <div className="size-1 rounded-full bg-mk-accent/60" />
        </div>
      ) : null}
      <div className={cn("relative overflow-hidden bg-white", edge === "bottom" ? "rounded-t-[22px]" : "rounded-b-[22px]")}>{children}</div>
      {edge === "top" ? <div className="mx-auto mt-3 h-1 w-20 rounded-full bg-white/15" /> : null}
    </div>
  );
}

/** The light iPhone mockup from the Features section. */
export function FeaturePhone({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("relative w-full max-w-[320px] rounded-[48px] border-[6px] border-[#22252a] bg-white p-3 sm:max-w-[340px]", className)}>
      <div className="absolute left-1/2 top-5 z-[90] flex h-6 w-28 -translate-x-1/2 items-center justify-between rounded-full bg-black px-3">
        <div className="flex size-2.5 items-center justify-center rounded-full bg-[#1c1c1e]">
          <div className="size-1 rounded-full bg-blue-900/60" />
        </div>
        <div className="size-2 rounded-full bg-[#111]" />
      </div>
      <div className="relative overflow-hidden rounded-[38px] border border-neutral-200/80 bg-[#fbfcfd]">{children}</div>
    </div>
  );
}

/** Thin silver phone used for showcase screenshots. */
export function ShowcasePhone({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "relative rounded-[clamp(18px,3.2vw,34px)] bg-gradient-to-b from-[#f4f4f5] to-[#dcdde1] p-[clamp(3px,0.5vw,5px)] shadow-[0_30px_60px_-30px_rgba(15,23,42,0.45),inset_0_0_0_1px_rgba(255,255,255,0.8)] ring-1 ring-black/[0.08]",
        className,
      )}
    >
      <div className="relative overflow-hidden rounded-[clamp(15px,2.8vw,30px)] bg-white">{children}</div>
    </div>
  );
}
