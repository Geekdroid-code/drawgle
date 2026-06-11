"use client";

import Image from "next/image";
import { ArrowRight, Image as ImageIcon, Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { describeScreenNavigation } from "@/lib/navigation";
import type { NavigationArchitecture, PromptImagePayload, ScreenPlan } from "@/lib/types";

export function AddScreenSidebar({
  open,
  prompt,
  image,
  screenPlan,
  projectName,
  error,
  isPlanning,
  isBuilding,
  navigationArchitecture,
  onCancel,
  onBuild,
}: {
  open: boolean;
  prompt: string;
  image?: PromptImagePayload | null;
  screenPlan?: ScreenPlan | null;
  projectName: string;
  error?: string | null;
  isPlanning?: boolean;
  isBuilding?: boolean;
  navigationArchitecture?: NavigationArchitecture | null;
  onCancel: () => void;
  onBuild: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
      <SheetContent side="right" className="w-full border-l border-black/10 bg-[radial-gradient(circle_at_top,#ffffff_0%,#f8fafc_40%,#eef2ff_100%)] p-0 sm:max-w-[430px]">
        <div className="flex h-full min-h-0 flex-col">
          <SheetHeader className="border-b border-black/5 bg-white/75 px-6 py-5 backdrop-blur">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-black/10 bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 shadow-sm">
              <Sparkles className="h-3.5 w-3.5" />
              Add Screen
            </div>
            <SheetTitle className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
              {isPlanning ? "Planning your next screen" : error ? "Planning needs another pass" : "Review before building"}
            </SheetTitle>
            <SheetDescription className="mt-2 max-w-sm text-sm leading-6 text-slate-600">
              {isPlanning
                ? `Drawgle is using ${projectName} memory and screen retrieval to draft one coherent addition.`
                : error
                  ? "Close this panel to revise the prompt or try the same request again."
                  : "This brief is the exact single-screen plan that will be sent to generation."}
            </SheetDescription>
          </SheetHeader>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-6">
            <section className="rounded-[28px] border border-black/10 bg-white/85 p-4 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                <ArrowRight className="h-3.5 w-3.5" />
                Request
              </div>
              <p className="text-sm leading-7 text-slate-700">{prompt}</p>

              {image ? (
                <div className="mt-4 flex items-center gap-3 rounded-2xl border border-black/10 bg-slate-50 p-3">
                  <div className="relative h-14 w-14 overflow-hidden rounded-2xl border border-black/10 bg-white">
                    <Image
                      src={`data:${image.mimeType};base64,${image.data}`}
                      alt="Screen planning reference"
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1 text-sm text-slate-600">
                    Attached reference image will be used when this screen is built.
                  </div>
                </div>
              ) : (
                <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-black/10 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500">
                  <ImageIcon className="h-3.5 w-3.5" />
                  No reference image attached
                </div>
              )}
            </section>

            {isPlanning ? (
              <section className="rounded-[28px] border border-dashed border-slate-300 bg-white/65 px-5 py-10 text-center shadow-[0_16px_40px_rgba(15,23,42,0.05)] backdrop-blur">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-950 text-white shadow-lg">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
                <h2 className="mt-4 text-lg font-semibold text-slate-950">Planning one additional screen</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  The planner is pulling the project charter, approved design tokens, and the most relevant existing screen summaries before it drafts the brief.
                </p>
              </section>
            ) : null}

            {error ? (
              <section className="rounded-[28px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm leading-6 text-rose-700 shadow-sm">
                {error}
              </section>
            ) : null}

            {!isPlanning && !error && screenPlan ? (
              <section className="rounded-[30px] border border-black/10 bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="rounded-full border border-black/10 bg-slate-950 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white">
                    {screenPlan.type}
                  </div>
                  <div className="rounded-full border border-black/10 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {describeScreenNavigation(screenPlan, navigationArchitecture)}
                  </div>
                </div>

                <h2 className="mt-4 text-2xl font-semibold tracking-[-0.03em] text-slate-950">{screenPlan.name}</h2>
                <p className="mt-4 whitespace-pre-line text-sm leading-7 text-slate-600">{screenPlan.description}</p>
              </section>
            ) : null}
          </div>

          <SheetFooter className="border-t border-black/5 bg-white/75 px-6 py-5 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
            <Button type="button" variant="outline" className="rounded-full border-black/10 bg-white" onClick={onCancel} disabled={isBuilding}>
              Cancel
            </Button>
            <Button
              type="button"
              className="rounded-full px-5"
              onClick={onBuild}
              disabled={!screenPlan || Boolean(error) || isPlanning || isBuilding}
            >
              {isBuilding ? <Loader2 className="h-4 w-4 animate-spin" /> : "Build Screen"}
            </Button>
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  );
}