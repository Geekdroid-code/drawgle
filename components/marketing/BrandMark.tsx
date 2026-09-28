import { DrawgleLogo } from "@/components/DrawgleLogo";
import { cn } from "@/lib/utils";

/** Drawgle's asterisk inside the ink disc, with an optional wordmark. */
export function BrandMark({
  className,
  wordmark = true,
  size = "md",
}: {
  className?: string;
  wordmark?: boolean;
  size?: "sm" | "md";
}) {
  return (
    <span className={cn("inline-flex select-none items-center gap-2", className)}>
      <span
        aria-hidden="true"
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full bg-mk-ink text-white",
          size === "sm" ? "size-6" : "size-7",
        )}
      >
        <DrawgleLogo className={size === "sm" ? "size-3.5" : "size-4"} />
      </span>
      {wordmark ? <span className="text-base font-semibold tracking-tight text-mk-ink">Drawgle</span> : null}
    </span>
  );
}
