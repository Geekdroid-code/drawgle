import { AgentBall } from "@/components/AgentBall";

export function ProjectCanvasLoading() {
  return (
    <div className="relative flex h-full min-h-0 w-full items-center justify-center overflow-hidden bg-[var(--dg-bg)] text-[var(--dg-text)] dg-dashed-grid-bg">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,color-mix(in_oklab,var(--dg-accent)_12%,transparent),transparent_22%)]" />

      <div className="relative flex flex-col items-center px-6 text-center">
        <div className="dg-canvas-loader-mark">
          <AgentBall className="relative h-8 w-8" active />
        </div>

        <div className="mt-5 text-sm font-semibold tracking-tight text-[var(--dg-text)]">
          Opening canvas
        </div>
        <div className="dg-canvas-loader-line mt-3" />
      </div>
    </div>
  );
}
