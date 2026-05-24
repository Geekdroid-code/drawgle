"use client";

import { useEffect, useState, useCallback } from "react";
import { Check, Loader2, Sparkles, Zap, X, Info } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { checkout } from "@/lib/dodopayments";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const FEATURE_TOOLTIPS: Record<string, string> = {
  "Unlimited Projects": "Create and manage an infinite number of design projects within your workspace.",
  "Unlimited Code Exports": "Generate and download production-ready code as many times as you need without limits.",
  "Export to 5 Frameworks": "Export your UI into Production ready React Native, SwiftUI, Compose, Flutter, or raw HTML/Tailwind.",
  "Export Design.md Specs": "Automatically generate a comprehensive Markdown design specification for your team.",
  "Live Design Tokens Sync": "Extract and sync precise color, typography, and spacing tokens dynamically.",
  "AI-powered Screen Editing": "Prompt the AI to modify, iterate, or fix specific parts of your screen instantly.",
  "Manual UI Adjustments": "Take full manual control over the generated code for pixel-perfect tweaks.",
  "Priority generation speed": "Skip the queue with prioritized AI rendering for instant results.",
  "Advanced multi-screen systems": "Plan and generate entire cohesive user flows with shared context.",
  "Direct team collaboration support": "Invite team members to view, edit, and collaborate on your design systems."
};

type PlanRow = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  credits: number | null;
  currency: string | null;
  dodo_product_id: string;
  metadata?: {
    features?: string[];
  } | any;
};

export function PricingDialog({
  open,
  onOpenChange,
  triggerReason = "upgrade",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerReason?: "upgrade" | "insufficient_credits";
}) {
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [checkoutProductId, setCheckoutProductId] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    if (!open) return;

    const supabase = createClient() as any;
    
    // Fetch authenticated user
    supabase.auth.getUser().then(({ data }: any) => {
      setUser(data.user);
    });

    // Fetch active pricing plans from the database
    supabase
      .from("dodo_pricing_plans")
      .select("id, name, description, price, credits, currency, dodo_product_id, metadata")
      .eq("is_active", true)
      .order("price", { ascending: true })
      .then(({ data, error }: any) => {
        if (!error && data) {
          setPlans(data as PlanRow[]);
        }
        setLoadingPlans(false);
      });
  }, [open]);

  const handleCheckout = useCallback(async (productId: string) => {
    try {
      if (!user) {
        window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
        return;
      }

      setCheckoutProductId(productId);
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const return_url = `${origin}${window.location.pathname}?subscribed=1`;

      const { checkout_url } = await checkout(
        [
          {
            product_id: productId,
            quantity: 1,
          },
        ],
        undefined as any,
        undefined as any,
        return_url,
        { source: "pricing_dialog" }
      );

      if (checkout_url) {
        window.location.href = checkout_url;
      } else {
        throw new Error("Checkout URL missing in response");
      }
    } catch (e: any) {
      console.error("Checkout error:", e);
      alert(e?.message ?? "Failed to initiate checkout");
      setCheckoutProductId(null);
    }
  }, [user]);

  return (
    <TooltipProvider>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        showCloseButton={false}
        className="flex max-h-[90vh] lg:max-h-[95vh] flex-col w-[95vw] sm:max-w-4xl lg:max-w-5xl xl:max-w-[1100px] gap-0 overflow-hidden rounded-[20px] lg:rounded-[28px] border border-slate-200/60 bg-[#fcfcfc] p-0 shadow-2xl"
      >
        <div className="relative shrink-0 px-6 pt-7 pb-4 lg:px-10 lg:pt-10 lg:pb-6 text-center">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="absolute right-4 top-4 lg:right-6 lg:top-6 rounded-full p-1.5 lg:p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-900 transition-colors"
          >
            <X className="h-4 w-4 lg:h-5 lg:w-5" />
          </button>
          <div className="mx-auto flex flex-col items-center gap-1 lg:gap-2">
            <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-slate-950">
              Upgrade Your Playbook
            </h2>
            <p className="text-xs lg:text-sm font-medium text-slate-500 max-w-sm lg:max-w-md">
              Maximum speed, high AI limits, and exclusive premium features.
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-8 lg:px-10 lg:pb-10 custom-scrollbar">
          {loadingPlans ? (
            <div className="flex h-[200px] lg:h-[300px] items-center justify-center flex-col gap-3 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
            </div>
          ) : (
            <div className="grid gap-4 lg:gap-8 md:grid-cols-3 pt-2 lg:pt-4">
              {plans.map((plan) => {
                const planName = plan.name.toLowerCase();
                const isPopular = planName === "starter";
                const features = plan.metadata?.features || [];

                return (
                  <div
                    key={plan.id}
                    className={cn(
                      "group relative flex flex-col rounded-[16px] lg:rounded-[24px] bg-white p-5 lg:p-7 transition-all duration-300",
                      isPopular 
                        ? "ring-1 lg:ring-2 ring-slate-900 shadow-[0_4px_16px_rgb(0,0,0,0.06)] lg:shadow-[0_8px_30px_rgb(0,0,0,0.08)] z-10" 
                        : "border border-slate-200 shadow-sm lg:hover:shadow-md"
                    )}
                  >
                    {isPopular && (
                      <div className="absolute top-0 right-4 lg:right-6 -translate-y-1/2 rounded-full bg-slate-900 px-2.5 py-0.5 lg:px-3 lg:py-1 text-[9px] lg:text-[11px] font-extrabold uppercase tracking-widest text-white shadow-sm">
                        Popular
                      </div>
                    )}

                    <div className="flex items-center justify-between mb-1 lg:mb-2">
                      <h3 className="text-lg lg:text-xl font-bold text-slate-900">{plan.name}</h3>
                    </div>
                    
                    <p className="text-[11px] lg:text-sm text-slate-500 leading-relaxed min-h-[34px] lg:min-h-[48px] mb-4 font-medium">
                      {plan.description}
                    </p>

                    <div className="mb-4 flex items-baseline gap-1">
                      <span className="text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-950">
                        ${plan.price}
                      </span>
                     <span className="text-[11px] lg:text-sm font-semibold text-slate-400">/mo</span>
                    </div>

                    <Button
                      onClick={() => handleCheckout(plan.dodo_product_id)}
                      disabled={Boolean(checkoutProductId)}
                      className={cn(
                        "mb-4 h-9 lg:h-12 w-full rounded-lg lg:rounded-xl text-xs lg:text-sm font-bold transition-all lg:hover:scale-[1.02]",
                        isPopular
                          ? "bg-slate-900 hover:bg-slate-800 text-white shadow-sm lg:shadow-md"
                          : "bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 shadow-none"
                      )}
                    >
                      {checkoutProductId === plan.dodo_product_id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        `Choose ${plan.name}`
                      )}
                    </Button>
                    
                    <div className="mb-4 flex items-center justify-between rounded-lg lg:rounded-xl bg-slate-50/80 px-3 py-2 lg:px-4 lg:py-3 text-xs lg:text-sm font-semibold text-slate-800 border border-slate-100">
                      <span className="flex items-center gap-1.5 lg:gap-2">
                        <span className="bg-amber-100/80 p-1 lg:p-1.5 rounded-md lg:rounded-lg flex items-center justify-center">
                          <Zap className="h-3 w-3 lg:h-4 lg:w-4 text-amber-500 fill-amber-500" />
                        </span>
                        AI Credits
                      </span>
                      <span className="font-bold">{plan.credits?.toLocaleString()}</span>
                    </div>

                    <div className="text-[9px] lg:text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5 lg:mb-4">
                      What's Included
                    </div>
                    
                    <ul className="flex-1 space-y-3 text-left">
                      {features.map((feature: string, i: number) => {
                        let tooltip = FEATURE_TOOLTIPS[feature];
                        
                        // Dynamically handle the screen generation count tooltip
                        const screenMatch = feature.match(/Generate ~([\d,]+) full screens\/mo/i);
                        if (screenMatch) {
                          tooltip = `Approximately ${screenMatch[1]} screens. Generating a screen uses ~30 credits, edits range from 5-30 credits depending on scope.`;
                        }
                        
                        return (
                          <li key={i} className="flex items-start gap-3">
 <div className="mt-[2px] flex h-3 w-3 lg:h-4 lg:w-4 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-slate-800 to-slate-950 text-white shadow-sm ring-1 ring-slate-950/5">
                              <Check className="h-2 w-2 lg:h-2.5 lg:w-2.5" strokeWidth={3} />
                            </div>
                                                        <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-sm font-medium text-slate-600 leading-snug">
                                {feature}
                              </span>
                              {tooltip && (
                                <Tooltip>
                                  <TooltipTrigger>
                                    <span className="shrink-0 cursor-help text-slate-400 hover:text-slate-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 rounded-full mt-0.5">
                                      <Info className="h-3 w-3" />
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-[220px] text-center p-2 text-[12px] font-medium leading-relaxed bg-slate-950 text-white border-none shadow-lg">
                                    {tooltip}
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
