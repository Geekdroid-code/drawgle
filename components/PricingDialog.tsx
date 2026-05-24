"use client";

import { useEffect, useState, useCallback } from "react";
import { Check, Loader2, Sparkles, Zap, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { checkout } from "@/lib/dodopayments";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

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
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });

    // Fetch active pricing plans from the database
    supabase
      .from("dodo_pricing_plans")
      .select("id, name, description, price, credits, currency, dodo_product_id, metadata")
      .eq("is_active", true)
      .order("price", { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) {
          setPlans(data as PlanRow[]);
        }
        setLoadingPlans(false);
      });
  }, [open]);

  const handleCheckout = useCallback(async (productId: string) => {
    try {
      if (!user) {
        // Redirect to login if user isn't authenticated yet
        window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
        return;
      }

      setCheckoutProductId(productId);
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      // Refresh current page once checkout is successfully completed
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        showCloseButton={false}
        className="w-full max-w-4xl gap-0 overflow-hidden rounded-[28px] border border-slate-950/[0.08] bg-[#f8f9fa] p-0 shadow-[0_32px_120px_rgba(15,23,42,0.28)]"
      >
        {/* Header Banner */}
        <div className="relative overflow-hidden bg-gradient-to-r from-neutral-900 to-neutral-950 px-6 py-8 text-center text-white sm:px-12">
          {/* Close button */}
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="absolute right-4 top-4 rounded-full p-1.5 text-neutral-400 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="h-4.5 w-4.5" />
          </button>

          <div className="mx-auto flex max-w-md flex-col items-center gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-300 border border-white/5">
              <Sparkles className="h-3.5 w-3.5 fill-amber-300/20" />
              {triggerReason === "insufficient_credits" ? "Out of credits" : "Upgrade Workspace"}
            </div>
            <h2 className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight">
              {triggerReason === "insufficient_credits" 
                ? "Unlock unlimited design runs" 
                : "Choose your design speed"}
            </h2>
            <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
              Unlock research planning, premium theme generations, full design token control, and Figma export tools.
            </p>
          </div>
        </div>

        {/* Pricing Cards Area */}
        <div className="p-6 sm:p-8">
          {loadingPlans ? (
            <div className="flex h-64 items-center justify-center flex-col gap-3 text-neutral-400">
              <Loader2 className="h-8 w-8 animate-spin text-neutral-900" />
              <span className="text-xs font-semibold">Loading pricing packages...</span>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-3">
              {plans.map((plan) => {
                const isStarter = plan.name.toLowerCase() === "starter";
                const isPro = plan.name.toLowerCase() === "pro";
                const features = plan.metadata?.features || [];

                return (
                  <div
                    key={plan.id}
                    className={cn(
                      "relative flex flex-col rounded-[24px] border bg-white p-5 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-md",
                      isStarter 
                        ? "border-[2px] border-indigo-600 ring-4 ring-indigo-50" 
                        : "border-slate-200/80"
                    )}
                  >
                    {isStarter && (
                      <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-3.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-white shadow-sm">
                        Most Popular
                      </span>
                    )}

                    <div className="mb-4">
                      <h3 className="text-lg font-bold text-neutral-900">{plan.name}</h3>
                      <p className="mt-1 text-[11px] font-medium leading-relaxed text-neutral-400">
                        {plan.description}
                      </p>
                    </div>

                    <div className="mb-5 flex items-baseline gap-1">
                      <span className="text-4xl font-extrabold tracking-tight text-neutral-900">
                        ${plan.price}
                      </span>
                      <span className="text-xs font-semibold text-neutral-400">/mo</span>
                    </div>

                    <div className="mb-6 rounded-2xl bg-neutral-50 px-3.5 py-2.5 border border-neutral-100">
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-neutral-400">Includes</div>
                      <div className="mt-0.5 text-sm font-bold text-neutral-800">
                        {plan.credits?.toLocaleString()} AI credits
                      </div>
                    </div>

                    <ul className="mb-6 flex-1 space-y-2.5 text-left">
                      {features.map((feature: string, i: number) => (
                        <li key={i} className="flex items-start gap-2.5">
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" strokeWidth={3} />
                          <span className="text-[11px] font-semibold text-neutral-600 leading-relaxed">
                            {feature}
                          </span>
                        </li>
                      ))}
                    </ul>

                    <Button
                      onClick={() => handleCheckout(plan.dodo_product_id)}
                      disabled={Boolean(checkoutProductId)}
                      className={cn(
                        "h-11 w-full rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer",
                        isStarter
                          ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                          : isPro
                            ? "bg-neutral-900 hover:bg-neutral-800 text-white"
                            : "bg-white border border-neutral-250 text-neutral-700 hover:bg-neutral-50 hover:border-neutral-300"
                      )}
                    >
                      {checkoutProductId === plan.dodo_product_id ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Redirecting...
                        </>
                      ) : (
                        <>
                          <Zap className="h-3.5 w-3.5 fill-current/10" />
                          Subscribe {plan.name}
                        </>
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
