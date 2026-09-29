"use client";

import { type FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { BrandMark } from "@/components/marketing/BrandMark";
import { marketingFontVariables } from "@/components/marketing/fonts";
import { DitherField } from "@/components/marketing/motion/DitherField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSafeAuthRedirect } from "@/lib/auth-redirect";
import { testimonials } from "@/lib/marketing/home-content";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type AuthMode = "sign-in" | "sign-up";
type PendingAction = AuthMode | "google" | null;
type FeedbackTone = "error" | "success";

type FeedbackMessage = {
  tone: FeedbackTone;
  message: string;
};

const errorMessages: Record<string, string> = {
  missing_oauth_code: "The Google sign-in callback returned without an OAuth code.",
  oauth_exchange_failed: "Google sign-in completed, but the Supabase session exchange failed.",
  missing_email_confirmation_token: "The email confirmation link is incomplete. Request a new confirmation email and try again.",
  email_confirmation_failed: "The email confirmation link is invalid or expired. Request a fresh sign-up email and try again.",
};

const noticeMessages: Record<string, string> = {
  email_confirmation_sent: "Account created. Check your inbox to confirm your email if email confirmation is enabled in Supabase.",
};

export default function LoginPage() {
  return (
    <div className={cn("mk-root", marketingFontVariables)}>
      <Suspense fallback={<LoginPageFallback />}>
        <LoginPageContent />
      </Suspense>
    </div>
  );
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryStateKey = searchParams.toString();
  const nextPath = useMemo(() => getSafeAuthRedirect(searchParams.get("next")), [searchParams]);
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [feedback, setFeedback] = useState<FeedbackMessage | null>(null);
  const [hideSearchMessage, setHideSearchMessage] = useState(false);

  const searchMessage = useMemo<FeedbackMessage | null>(() => {
    const errorCode = searchParams.get("error") ?? "";
    if (errorCode) {
      return {
        tone: "error",
        message: errorMessages[errorCode] ?? "Authentication failed. Try again.",
      };
    }

    const noticeCode = searchParams.get("notice") ?? "";
    if (noticeCode) {
      return {
        tone: "success",
        message: noticeMessages[noticeCode] ?? "Authentication state updated.",
      };
    }

    return null;
  }, [searchParams]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHideSearchMessage(false);
    setFeedback(null);
  }, [queryStateKey]);

  const isBusy = pendingAction !== null;
  const activeFeedback = feedback ?? (hideSearchMessage ? null : searchMessage);

  const dismissSearchMessage = () => {
    setHideSearchMessage(true);
  };

  const clearFormFeedback = () => {
    dismissSearchMessage();
    setFeedback(null);
  };

  const finishSignedInFlow = () => {
    router.replace(nextPath);
    router.refresh();
  };

  const handleGoogleSignIn = async () => {
    clearFormFeedback();
    setPendingAction("google");

    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: {
            prompt: "select_account",
          },
        },
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error("Supabase Google sign-in failed", error);
      setFeedback({
        tone: "error",
        message: "Google sign-in is unavailable until the Google provider is configured in your Supabase project.",
      });
      setPendingAction(null);
    }
  };

  const handlePasswordSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearFormFeedback();
    setPendingAction("sign-in");

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        throw error;
      }

      finishSignedInFlow();
    } catch (error) {
      console.error("Supabase email sign-in failed", error);
      setFeedback({
        tone: "error",
        message: getErrorMessage(error, "Email sign-in failed. Check your credentials and try again."),
      });
      setPendingAction(null);
    }
  };

  const handlePasswordSignUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearFormFeedback();

    if (password !== confirmPassword) {
      setFeedback({
        tone: "error",
        message: "Passwords do not match.",
      });
      return;
    }

    setPendingAction("sign-up");

    try {
      const supabase = createClient();
      const emailRedirectTo = `${window.location.origin}/auth/confirm?next=${encodeURIComponent(nextPath)}`;
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo,
        },
      });

      if (error) {
        throw error;
      }

      if (data.session) {
        finishSignedInFlow();
        return;
      }

      setMode("sign-in");
      setPassword("");
      setConfirmPassword("");
      setFeedback({
        tone: "success",
        message: noticeMessages.email_confirmation_sent,
      });
      setPendingAction(null);
    } catch (error) {
      console.error("Supabase email sign-up failed", error);
      setFeedback({
        tone: "error",
        message: getErrorMessage(error, "Account creation failed. Try a different email or password."),
      });
      setPendingAction(null);
    }
  };

  return (
    <main className="bg-white text-mk-ink">
      {/* svh, not dvh: the layout must not resize while a phone's address bar slides away. */}
      <div className="grid min-h-svh w-full lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)]">
        <section className="relative flex min-h-svh flex-col overflow-hidden px-5 py-6 sm:px-10 lg:px-14 lg:py-8">
          <DitherField quietZone={FORM_QUIET_ZONE} density={0.62} className="absolute inset-0 opacity-[0.42]" />
          <header className="relative flex items-center justify-between">
            <Link href="/" aria-label="Drawgle home">
              <BrandMark />
            </Link>
            <nav aria-label="Site" className="flex items-center gap-5 text-[13px] font-medium text-neutral-500 lg:hidden">
              <Link href="/showcase" className="transition-colors hover:text-mk-ink">Showcase</Link>
              <Link href="/pricing" className="transition-colors hover:text-mk-ink">Pricing</Link>
            </nav>
          </header>

          <div className="relative mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-12">
            <div className="mb-7">
              <h1 className="text-[34px] font-medium leading-[1.08] tracking-[-0.03em] text-mk-heading sm:text-[40px]">
                {mode === "sign-in" ? (
                  <>
                    Welcome back. <br />
                    <span className="font-semibold text-mk-accent">Your screens await.</span>
                  </>
                ) : (
                  <>
                    Design your app <br />
                    <span className="font-semibold text-mk-accent">in minutes, not weeks.</span>
                  </>
                )}
              </h1>
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-mk-body">
                {mode === "sign-in"
                  ? "Sign in to keep refining your screens and design system."
                  : "Describe an idea, get connected mobile screens, and hand them to your coding agent."}
              </p>
            </div>

            {activeFeedback ? (
              <div
                className={[
                  "mb-4 rounded-2xl border px-4 py-3 text-xs leading-5",
                  activeFeedback.tone === "error"
                    ? "border-red-200 bg-red-50 text-red-700"
                    : "border-mk-accent/20 bg-mk-accent/[0.05] text-[#1f44b8]",
                ].join(" ")}
              >
                {activeFeedback.message}
              </div>
            ) : null}

            <Button
              className="h-11 w-full rounded-full border border-black/[0.1] bg-white text-[13px] font-semibold text-mk-ink shadow-none hover:bg-black/[0.03]"
              disabled={isBusy}
              onClick={handleGoogleSignIn}
              type="button"
              variant="outline"
            >
              {pendingAction === "google" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <GoogleMark />
              )}
              Continue with Google
            </Button>

            <div className="my-4 flex items-center gap-3">
              <span className="h-px flex-1 bg-black/[0.06]" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
                or use email
              </span>
              <span className="h-px flex-1 bg-black/[0.06]" />
            </div>

            <div className="mb-5 grid grid-cols-2 rounded-full bg-black/[0.04] p-1">
              <button
                type="button"
                onClick={() => {
                  clearFormFeedback();
                  setMode("sign-in");
                }}
                className={`h-9 rounded-full text-xs font-semibold transition-all ${
                  mode === "sign-in"
                    ? "bg-white text-mk-ink"
                    : "text-neutral-500 hover:text-mk-ink"
                }`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => {
                  clearFormFeedback();
                  setMode("sign-up");
                }}
                className={`h-9 rounded-full text-xs font-semibold transition-all ${
                  mode === "sign-up"
                    ? "bg-white text-mk-ink"
                    : "text-neutral-500 hover:text-mk-ink"
                }`}
              >
                Create account
              </button>
            </div>

            {mode === "sign-in" ? (
              <form className="space-y-3" onSubmit={handlePasswordSignIn}>
                <AuthField
                  autoComplete="email"
                  disabled={isBusy}
                  label="Email address"
                  onChange={(value) => {
                    clearFormFeedback();
                    setEmail(value);
                  }}
                  placeholder="you@example.com"
                  type="email"
                  value={email}
                />
                <AuthField
                  autoComplete="current-password"
                  disabled={isBusy}
                  label="Password"
                  minLength={6}
                  onChange={(value) => {
                    clearFormFeedback();
                    setPassword(value);
                  }}
                  placeholder="Enter your password"
                  type="password"
                  value={password}
                />

                <AuthSubmitButton busy={pendingAction === "sign-in"} disabled={isBusy}>
                  Continue to Drawgle
                </AuthSubmitButton>
              </form>
            ) : (
              <form className="space-y-3" onSubmit={handlePasswordSignUp}>
                <AuthField
                  autoComplete="email"
                  disabled={isBusy}
                  label="Email address"
                  onChange={(value) => {
                    clearFormFeedback();
                    setEmail(value);
                  }}
                  placeholder="you@example.com"
                  type="email"
                  value={email}
                />
                <AuthField
                  autoComplete="new-password"
                  disabled={isBusy}
                  label="Password"
                  minLength={6}
                  onChange={(value) => {
                    clearFormFeedback();
                    setPassword(value);
                  }}
                  placeholder="Create a password"
                  type="password"
                  value={password}
                />
                <AuthField
                  autoComplete="new-password"
                  disabled={isBusy}
                  label="Confirm password"
                  minLength={6}
                  onChange={(value) => {
                    clearFormFeedback();
                    setConfirmPassword(value);
                  }}
                  placeholder="Repeat your password"
                  type="password"
                  value={confirmPassword}
                />

                <AuthSubmitButton busy={pendingAction === "sign-up"} disabled={isBusy}>
                  Create your workspace
                </AuthSubmitButton>
              </form>
            )}

            <p className="mt-6 text-center text-[11px] leading-4 text-neutral-400">
              By continuing, you agree to Drawgle&apos;s{" "}
              <Link href="/terms" className="font-medium text-neutral-600 hover:text-mk-ink">
                Terms
              </Link>{" "}
              and{" "}
              <Link href="/privacy-policy" className="font-medium text-neutral-600 hover:text-mk-ink">
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </section>

        <ShowcasePanel />
      </div>
    </main>
  );
}

function LoginPageFallback() {
  return (
    <main className="bg-white">
      <div className="grid min-h-svh w-full lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)]">
        <div className="flex items-center justify-center p-8">
          <div className="w-full max-w-[430px] space-y-4">
            <div className="h-10 w-56 rounded-full bg-black/[0.05]" />
            <div className="h-11 w-full rounded-full bg-black/[0.04]" />
            <div className="h-11 w-full rounded-2xl bg-black/[0.04]" />
            <div className="h-11 w-full rounded-full bg-mk-accent/10" />
          </div>
        </div>
        <div className="mk-surface m-3 hidden rounded-[36px] lg:block" />
      </div>
    </main>
  );
}

function AuthField({
  autoComplete,
  disabled,
  label,
  minLength,
  onChange,
  placeholder,
  type,
  value,
}: {
  autoComplete: string;
  disabled: boolean;
  label: string;
  minLength?: number;
  onChange: (value: string) => void;
  placeholder: string;
  type: string;
  value: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold text-neutral-600">{label}</span>
      <Input
        autoComplete={autoComplete}
        className="h-11 rounded-2xl border-black/[0.08] bg-neutral-50 px-4 text-[13px] shadow-none placeholder:text-neutral-400 focus-visible:border-mk-accent/50 focus-visible:ring-4 focus-visible:ring-mk-accent/10"
        disabled={disabled}
        minLength={minLength}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required
        type={type}
        value={value}
      />
    </label>
  );
}

function AuthSubmitButton({
  busy,
  children,
  disabled,
}: {
  busy: boolean;
  children: string;
  disabled: boolean;
}) {
  return (
    <Button
      className="group relative h-11 w-full overflow-hidden rounded-full border-0 bg-mk-accent pl-5 pr-12 text-[13px] font-semibold text-white shadow-none hover:bg-mk-accent-strong"
      disabled={disabled}
      type="submit"
    >
      {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
      {children}
      <span className="absolute right-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-white text-mk-accent">
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Button>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" className="mr-2 h-4 w-4" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.91h5.38a4.6 4.6 0 0 1-1.99 3.02v2.54h3.23c1.89-1.74 2.98-4.31 2.98-7.4Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.42l-3.23-2.54c-.9.6-2.04.96-3.39.96-2.6 0-4.8-1.76-5.59-4.12H3.08v2.62A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.41 13.88A6 6 0 0 1 6.1 12c0-.65.11-1.29.31-1.88V7.5H3.08A10 10 0 0 0 2 12c0 1.61.38 3.14 1.08 4.5l3.33-2.62Z" />
      <path fill="#EA4335" d="M12 6c1.47 0 2.79.51 3.83 1.5l2.87-2.87A9.61 9.61 0 0 0 12 2a10 10 0 0 0-8.92 5.5l3.33 2.62C7.2 7.76 9.4 6 12 6Z" />
    </svg>
  );
}

// Keeps the form itself clean; the dither lives around it.
const FORM_QUIET_ZONE = { y: 0.5, height: 0.4, width: 0.44, depth: 1 };
const review = testimonials.find((item) => item.name === "Vishnu Das") ?? testimonials[0];

function ShowcasePanel() {
  const screens = [
    { src: "/showcase-screenshots/minimal-habit-premium/habits.webp", alt: "Quiet Habit mobile dashboard designed with Drawgle", className: "mt-16 -rotate-[4deg]" },
    { src: "/showcase-screenshots/neo-mint/calendar.webp", alt: "Neo Mint finance calendar designed with Drawgle", className: "z-10" },
    { src: "/showcase-screenshots/food-delivery/home.webp", alt: "Food delivery discovery screen designed with Drawgle", className: "mt-16 rotate-[4deg]" },
  ];

  return (
    <aside className="mk-surface relative m-3 hidden min-h-[calc(100svh-24px)] flex-col overflow-hidden rounded-[36px] lg:flex">

      <nav aria-label="Site" className="relative z-10 flex justify-end gap-6 px-10 pt-7 text-[13px] font-medium text-neutral-500">
        <Link href="/" className="transition-colors hover:text-mk-ink">Home</Link>
        <Link href="/showcase" className="transition-colors hover:text-mk-ink">Showcase</Link>
        <Link href="/pricing" className="transition-colors hover:text-mk-ink">Pricing</Link>
      </nav>

      <div className="relative z-10 px-10 pt-12 text-center xl:px-16">
        <h2 className="mx-auto max-w-lg text-[34px] font-medium leading-[1.1] tracking-[-0.03em] text-mk-body xl:text-[40px]">
          Premium mobile UI, <br />
          <span className="font-semibold text-mk-accent">from a single prompt.</span>
        </h2>
      </div>

      <div className="relative z-10 flex flex-1 items-center justify-center px-10 py-10">
        <div className="grid w-full max-w-[560px] grid-cols-3 items-start gap-4">
          {screens.map((screen) => (
            <div key={screen.src} className={cn("rounded-[26px] bg-[#e9e9eb] p-[3px] ring-1 ring-black/[0.08]", screen.className)}>
              <div className="relative aspect-[390/844] overflow-hidden rounded-[23px] bg-white">
                <Image src={screen.src} alt={screen.alt} fill priority sizes="(max-width: 1023px) 0px, 15vw" className="object-cover object-top" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <figure className="relative z-10 mx-auto mb-10 max-w-md px-10 text-center">
        <blockquote className="text-[14px] leading-relaxed text-mk-body">&ldquo;{review.quote}&rdquo;</blockquote>
        <figcaption className="mt-4 flex items-center justify-center gap-2.5 text-[13px]">
          <Image src={review.avatar} alt="" width={28} height={28} className="size-7 rounded-full object-cover" />
          <span className="font-semibold text-mk-ink">{review.name}</span>
          <span className="text-neutral-400">{review.role}</span>
        </figcaption>
      </figure>
    </aside>
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }

  return fallback;
}
