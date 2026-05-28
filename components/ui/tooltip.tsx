"use client"

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"

import { cn } from "@/lib/utils"

function TooltipProvider({
  delay = 0,
  ...props
}: TooltipPrimitive.Provider.Props) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delay={delay}
      {...props}
    />
  )
}

function Tooltip({ ...props }: TooltipPrimitive.Root.Props) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />
}

function TooltipTrigger({ ...props }: TooltipPrimitive.Trigger.Props) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

function TooltipContent({
  className,
  side = "top",
  sideOffset = 10,
  align = "center",
  alignOffset = 0,
  children,
  ...props
}: TooltipPrimitive.Popup.Props &
  Pick<
    TooltipPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  >) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className="isolate z-[10000]"
      >
        <TooltipPrimitive.Popup
          data-slot="tooltip-content"
          className={cn(
            "z-[10000] inline-flex w-fit max-w-xs origin-(--transform-origin) items-center gap-1.5 rounded-lg border border-[var(--dg-border)] bg-[var(--dg-surface)] px-2.5 py-1.5 text-[11px] font-semibold leading-none text-[var(--dg-text)] shadow-[var(--dg-shadow-soft)] backdrop-blur-md has-data-[slot=kbd]:pr-1.5 data-[side=bottom]:slide-in-from-top-1 data-[side=inline-end]:slide-in-from-left-1 data-[side=inline-start]:slide-in-from-right-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 data-[side=top]:slide-in-from-bottom-1 **:data-[slot=kbd]:relative **:data-[slot=kbd]:isolate **:data-[slot=kbd]:z-[10001] **:data-[slot=kbd]:rounded-sm data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className
          )}
          {...props}
        >
          {children}
          <TooltipPrimitive.Arrow
            className={cn(
              "z-[10000] size-2 rotate-45 rounded-[1px] border-[var(--dg-border)] bg-[var(--dg-surface)] fill-[var(--dg-surface)]",
              "data-[side=top]:-bottom-1 data-[side=top]:border-b data-[side=top]:border-r",
              "data-[side=bottom]:-top-1 data-[side=bottom]:border-l data-[side=bottom]:border-t",
              "data-[side=left]:-right-1 data-[side=left]:border-r data-[side=left]:border-t",
              "data-[side=right]:-left-1 data-[side=right]:border-b data-[side=right]:border-l",
            )}
          />
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
