"use client";

import { memo } from "react";
import { Smartphone } from "lucide-react";
import { Trace } from "loading-dev";

import { QueuedMark } from "@/components/agent/marks";
import { PHONE_FRAME_RADIUS, SCREEN_FRAME_HEIGHT, SCREEN_FRAME_WIDTH, SCREEN_VISUAL_INSETS } from "@/lib/canvas-interactions";

const NODE_TOP_PADDING = SCREEN_VISUAL_INSETS.top - 8;

/**
 * A screen that isn't on the canvas yet, drawn as the phone it will become, in the slot it will take: its name above
 * the phone like a real screen's, and inside, what is happening to it. It has exactly a real screen's geometry, so the
 * screen replaces it in place.
 */
export const PlaceholderPhone = memo(function PlaceholderPhone({ name, designing, detail }: {
  name: string;
  designing: boolean;
  detail?: string | null;
}) {
  return (
    <div
      className="pointer-events-none select-none"
      data-placeholder-phone={designing ? "designing" : "queued"}
      style={{
        width: SCREEN_FRAME_WIDTH + SCREEN_VISUAL_INSETS.left + SCREEN_VISUAL_INSETS.right,
        height: SCREEN_FRAME_HEIGHT + SCREEN_VISUAL_INSETS.top + SCREEN_VISUAL_INSETS.bottom,
        paddingTop: NODE_TOP_PADDING,
        paddingRight: SCREEN_VISUAL_INSETS.right,
        paddingBottom: SCREEN_VISUAL_INSETS.bottom,
        paddingLeft: SCREEN_VISUAL_INSETS.left,
      }}
    >
      <div className="relative" style={{ width: SCREEN_FRAME_WIDTH, paddingTop: 8 }}>
        <div className="absolute left-0 right-0 flex h-9 items-center gap-1.5 px-2" style={{ bottom: "100%", marginBottom: 8, opacity: 0.7 }}>
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[color-mix(in_oklab,var(--dg-surface-muted)_80%,transparent)]">
            <Smartphone className="h-3.5 w-3.5 text-[var(--dg-text-muted)]" />
          </span>
          <span className="max-w-[230px] truncate text-[13px] font-semibold leading-none text-[var(--dg-text)]">{name}</span>
        </div>
        <div
          className="relative overflow-hidden"
          style={{
            width: SCREEN_FRAME_WIDTH,
            height: SCREEN_FRAME_HEIGHT,
            borderRadius: PHONE_FRAME_RADIUS,
            border: `1px ${designing ? "solid" : "dashed"} var(--dg-border-strong)`,
            background: designing
              ? "color-mix(in oklab, var(--dg-accent) 5%, var(--dg-surface))"
              : "color-mix(in oklab, var(--dg-surface) 72%, transparent)",
          }}
        >
          {designing ? <div className="dg-placeholder-sweep absolute inset-0" /> : null}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-10 text-center">
            {designing ? <Trace size={34} color="var(--dg-accent)" /> : <QueuedMark size={30} />}
            <div className="text-[17px] font-semibold tracking-tight text-[var(--dg-text)]">{name}</div>
            <div className="text-[13px] text-[var(--dg-text-muted)]">{designing ? detail || "Designing" : "Up next"}</div>
          </div>
        </div>
      </div>
    </div>
  );
});
