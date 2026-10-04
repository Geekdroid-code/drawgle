"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ArrowRight, Check, Gift, Loader2 } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { creditManager } from "@/lib/credit-manager";
import {
  describeCreditCodeResult,
  normalizeCreditCode,
  readCreditCodeResult,
  screensForCredits,
  type CreditCodePreview,
  type CreditCodeResult,
} from "@/lib/credit-codes";
import { cn } from "@/lib/utils";

type ClaimCreditsCardProps = {
  userId: string;
  /** The code from a claim link, checked on the server; null when the person types one. */
  preview: CreditCodePreview | null;
};

const closedLink: Record<Exclude<CreditCodePreview["status"], "open">, { title: string; body: string }> = {
  already_redeemed: {
    title: "You've already claimed this offer",
    body: "Each account can claim it once.",
  },
  exhausted: {
    title: "This code has already been claimed",
    body: "If someone sent it to you, ask them for a new one.",
  },
  expired: {
    title: "This code has expired",
    body: "It can no longer add credits.",
  },
  not_found: {
    title: "We couldn't find that code",
    body: "Check the link you were sent, or enter the code by hand.",
  },
};

export function ClaimCreditsCard({ userId, preview }: ClaimCreditsCardProps) {
  const [typedCode, setTypedCode] = useState("");
  const [pending, setPending] = useState(false);
  const [claimed, setClaimed] = useState<CreditCodeResult | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const claim = async (code: string) => {
    setPending(true);
    setProblem(null);
    try {
      const response = await fetch("/api/credits/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const body = await response.json().catch(() => null);
      const result = readCreditCodeResult(body);
      if (result?.status === "redeemed") {
        setClaimed(result);
        if (typeof result.balance === "number") creditManager.updateCreditsLocally(userId, result.balance, "add");
        return;
      }
      setProblem(
        result
          ? describeCreditCodeResult(result)
          : typeof body?.error === "string"
            ? body.error
            : "We couldn't claim this code right now. Try again in a minute.",
      );
    } catch {
      setProblem("We couldn't reach Drawgle. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  };

  const submitTyped = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = normalizeCreditCode(typedCode);
    if (!code) {
      setProblem(describeCreditCodeResult({ status: "not_found" }));
      return;
    }
    void claim(code);
  };

  const closed = preview && preview.status !== "open" ? closedLink[preview.status] : null;
  const offerCredits = preview?.status === "open" ? preview.credits : 0;
  const offerScreens = screensForCredits(offerCredits);
  const claimedScreens = screensForCredits(claimed?.credits ?? 0);

  let title = "Redeem a code";
  let body = "Enter the code you were sent to add its credits to your account.";
  if (closed) {
    ({ title, body } = closed);
  } else if (offerCredits > 0) {
    title = `${offerCredits.toLocaleString()} free credits`;
    body = `Enough to design ${offerScreens} screen${offerScreens === 1 ? "" : "s"}. Planning your app is always free.`;
  }

  return (
    <main className="flex min-h-full justify-center px-4 pb-16 pt-10 sm:pt-20">
      <section
        aria-live="polite"
        className="w-full max-w-[420px] rounded-2xl border border-[var(--dg-border)] bg-[var(--dg-surface-muted)] p-6 sm:p-8"
      >
        {claimed ? (
          <>
            <span className="flex size-10 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <Check className="size-5" />
            </span>
            <h1 className="mt-5 text-2xl font-semibold tracking-[-0.02em]">
              {(claimed.credits ?? 0).toLocaleString()} credits added
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {[
                claimedScreens > 0 ? `That's enough for ${claimedScreens} screen${claimedScreens === 1 ? "" : "s"}.` : "",
                typeof claimed.balance === "number" ? `Your balance is now ${claimed.balance.toLocaleString()} credits.` : "",
              ]
                .filter(Boolean)
                .join(" ")}
            </p>
            <Link href="/project/new" className={cn(buttonVariants({ size: "lg" }), "mt-6 h-10 w-full gap-2")}>
              Start designing
              <ArrowRight className="size-4" />
            </Link>
          </>
        ) : (
          <>
            <span className="flex size-10 items-center justify-center rounded-full bg-muted text-foreground">
              <Gift className="size-5" />
            </span>
            <h1 className="mt-5 text-2xl font-semibold tracking-[-0.02em]">{title}</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>

            {preview?.status === "open" ? (
              <Button className="mt-6 h-10 w-full" disabled={pending} onClick={() => void claim(preview.code)}>
                {pending ? <Loader2 className="size-4 animate-spin" /> : null}
                {pending ? "Adding credits..." : `Add ${offerCredits.toLocaleString()} credits to my account`}
              </Button>
            ) : null}

            {!preview ? (
              <form className="mt-6 flex flex-col gap-3" onSubmit={submitTyped}>
                <label className="sr-only" htmlFor="credit-code">
                  Code
                </label>
                <Input
                  id="credit-code"
                  autoCapitalize="characters"
                  autoComplete="off"
                  autoFocus
                  className="h-10 font-mono uppercase tracking-[0.08em] placeholder:font-sans placeholder:normal-case placeholder:tracking-normal"
                  maxLength={40}
                  onChange={(event) => setTypedCode(event.target.value)}
                  placeholder="e.g. DG-7K2M4P"
                  spellCheck={false}
                  value={typedCode}
                />
                <Button className="h-10 w-full" disabled={pending || !typedCode.trim()} type="submit">
                  {pending ? <Loader2 className="size-4 animate-spin" /> : null}
                  {pending ? "Checking code..." : "Redeem"}
                </Button>
              </form>
            ) : null}

            {problem ? (
              <p className="mt-4 rounded-lg bg-muted px-3 py-2.5 text-sm text-foreground" role="alert">
                {problem}
              </p>
            ) : null}

            {closed ? (
              <div className="mt-6 flex flex-col gap-2">
                <Link href="/project/new" className={cn(buttonVariants({ size: "lg" }), "h-10 w-full gap-2")}>
                  Start designing
                  <ArrowRight className="size-4" />
                </Link>
                <Link href="/claim" className={cn(buttonVariants({ variant: "ghost", size: "lg" }), "h-10 w-full")}>
                  Enter a different code
                </Link>
              </div>
            ) : null}
          </>
        )}
      </section>
    </main>
  );
}
