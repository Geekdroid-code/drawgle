"use client";

import { type FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSafeAuthRedirect } from "@/lib/auth-redirect";
import { createClient } from "@/lib/supabase/client";

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
    <Suspense fallback={<LoginPageFallback />}>
      <LoginPageContent />
    </Suspense>
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
    <main className="min-h-dvh bg-white text-black lg:h-dvh lg:overflow-hidden">
      <div className="grid min-h-dvh w-full lg:h-dvh lg:grid-cols-2">
        <section className="flex min-h-dvh flex-col border-black/[0.09] px-5 py-5 sm:px-10 lg:h-dvh lg:min-h-0 lg:border-r lg:px-14">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5" aria-label="Drawgle home">
              <span className="flex h-7 w-7 items-center justify-center border border-[#1b7fcc]/25 bg-[#1b7fcc]/[0.07]">
                <span className="h-2 w-2 bg-[#1b7fcc]" />
              </span>
              <span className="text-sm font-semibold tracking-tight">Drawgle</span>
            </Link>
            <Link href="/" className="text-xs font-medium text-black/40 transition-colors hover:text-black">
              Back home
            </Link>
          </div>

          <div className="mx-auto flex w-full max-w-[410px] flex-1 flex-col justify-center py-5 sm:py-7 lg:min-h-0">
            <div className="mb-5">
              <div className="mb-2.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-[#1b7fcc]">
                Your design workspace
              </div>
              <h1 className="font-pixel-square text-[32px] font-semibold leading-[1.06] tracking-tight sm:text-[38px]">
                {mode === "sign-in" ? "Welcome back." : "Build something worth opening."}
              </h1>
              <p className="mt-2 max-w-sm text-[13px] leading-5 text-black/48">
                {mode === "sign-in"
                  ? "Sign in to continue refining your screens, systems, and ideas."
                  : "Create your workspace and turn the first rough thought into editable mobile UI."}
              </p>
            </div>

            {activeFeedback ? (
              <div
                className={[
                  "mb-4 border px-3.5 py-2.5 text-xs leading-5",
                  activeFeedback.tone === "error"
                    ? "border-red-200 bg-red-50 text-red-700"
                    : "border-[#1b7fcc]/20 bg-[#1b7fcc]/[0.05] text-[#145f99]",
                ].join(" ")}
              >
                {activeFeedback.message}
              </div>
            ) : null}

            <Button
              className="h-10 w-full rounded-md border border-black/[0.12] bg-white text-xs font-semibold text-black shadow-none hover:bg-black/[0.025]"
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
              <span className="h-px flex-1 bg-black/[0.09]" />
              <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-black/30">
                or use email
              </span>
              <span className="h-px flex-1 bg-black/[0.09]" />
            </div>

            <div className="mb-4 grid grid-cols-2 border-b border-black/[0.1]">
              <button
                type="button"
                onClick={() => {
                  clearFormFeedback();
                  setMode("sign-in");
                }}
                className={`h-9 border-b-2 text-xs font-semibold transition-colors ${
                  mode === "sign-in"
                    ? "border-[#1b7fcc] text-black"
                    : "border-transparent text-black/35 hover:text-black/60"
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
                className={`h-9 border-b-2 text-xs font-semibold transition-colors ${
                  mode === "sign-up"
                    ? "border-[#1b7fcc] text-black"
                    : "border-transparent text-black/35 hover:text-black/60"
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

            <p className="mt-4 text-center text-[10px] leading-4 text-black/35">
              By continuing, you agree to Drawgle&apos;s{" "}
              <Link href="/terms" className="font-medium text-black/55 hover:text-black">
                Terms
              </Link>{" "}
              and{" "}
              <Link href="/privacy-policy" className="font-medium text-black/55 hover:text-black">
                Privacy Policy
              </Link>
              .
            </p>
          </div>

          <div className="flex items-center justify-between border-t border-black/[0.08] pt-4 text-[9px] text-black/30">
            <span>AI mobile UI design workspace</span>
            <span className="font-mono uppercase tracking-[0.12em]">Secure sign in</span>
          </div>
        </section>

        <ShowcasePanel />
      </div>
    </main>
  );
}

function LoginPageFallback() {
  return (
    <main className="min-h-dvh bg-white lg:h-dvh lg:overflow-hidden">
      <div className="grid min-h-dvh w-full lg:h-dvh lg:grid-cols-2">
        <div className="flex items-center justify-center border-r border-black/[0.09] p-8">
          <div className="w-full max-w-[430px] space-y-4">
            <div className="h-10 w-56 bg-black/[0.05]" />
            <div className="h-12 w-full bg-black/[0.04]" />
            <div className="h-12 w-full bg-black/[0.04]" />
            <div className="h-12 w-full bg-[#1b7fcc]/10" />
          </div>
        </div>
        <div className="hidden bg-[#f0f0ec] lg:block" />
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
      <span className="text-[11px] font-semibold text-black/65">{label}</span>
      <Input
        autoComplete={autoComplete}
        className="h-10 rounded-md border-black/[0.12] bg-[#fafaf8] px-3.5 text-xs shadow-none placeholder:text-black/25 focus-visible:border-[#1b7fcc]/50 focus-visible:ring-2 focus-visible:ring-[#1b7fcc]/10"
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
      className="group relative h-10 w-full overflow-hidden rounded-md border border-[#1b7fcc]/50 bg-[#1b7fcc] pl-5 pr-12 text-xs font-semibold text-white shadow-none hover:bg-[#1975bd]"
      disabled={disabled}
      type="submit"
    >
      {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
      {children}
      <span className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-sm bg-white text-[#1b7fcc]">
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

function ShowcasePanel() {
  const screens = [
    {
      src: "/showcase-screenshots/minimal-habit-premium/habits.webp",
      alt: "Quiet Habit mobile dashboard designed with Drawgle",
      className: "translate-y-10",
    },
    {
      src: "/showcase-screenshots/neo-mint/calendar.webp",
      alt: "Neo Mint finance calendar designed with Drawgle",
      className: "-translate-y-4",
    },
    {
      src: "/showcase-screenshots/food-delivery/home.webp",
      alt: "Food delivery discovery screen designed with Drawgle",
      className: "translate-y-16",
    },
  ];

  return (
    <aside className="relative hidden min-h-screen overflow-hidden border-l border-black/[0.09] bg-[#f3f3ef] lg:flex lg:flex-col">
      <div className="relative z-10 px-10 pb-5 pt-10 xl:px-14 xl:pt-12">
        <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#1b7fcc]">
          Designed with Drawgle
        </div>
        <h2 className="mt-3 max-w-xl font-pixel-square text-[34px] font-semibold leading-[1.06] tracking-tight text-black xl:text-[42px]">
          One workspace. Distinct visual directions.
        </h2>
        <p className="mt-3 max-w-lg text-sm leading-6 text-black/45">
          Generate polished mobile UI, then keep refining every screen after the first result.
        </p>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-8 pb-8 xl:px-12">
        <div className="grid w-full max-w-[760px] grid-cols-3 items-center gap-4 xl:gap-6">
          {screens.map((screen) => (
            <div
              key={screen.src}
              className={`relative aspect-[390/844] overflow-hidden rounded-[22px] border border-black/[0.13] bg-white ${screen.className}`}
            >
              <Image
                src={screen.src}
                alt={screen.alt}
                fill
                priority
                sizes="(max-width: 1023px) 0px, 18vw"
                className="object-cover"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="relative z-10 flex items-center justify-between border-t border-black/[0.09] px-10 py-5 text-[10px] font-medium text-black/38 xl:px-14">
        <span>Original screens generated by Drawgle</span>
        <Link href="/showcase" className="flex items-center gap-2 text-black/55 transition-colors hover:text-black">
          Explore showcase
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </aside>
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }

  return fallback;
}
