"use client";

import { type FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { Code, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
    router.replace("/");
    router.refresh();
  };

  const handleGoogleSignIn = async () => {
    clearFormFeedback();
    setPendingAction("google");

    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/")}`;
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
      const emailRedirectTo = `${window.location.origin}/auth/confirm?next=${encodeURIComponent("/")}`;
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
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-8">
      <div className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-8 shadow-xl">
        <div className="mb-8 space-y-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-black text-white">
            <Code className="h-7 w-7" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-gray-950">Drawgle</h1>
            <p className="text-sm text-gray-500">
              Sign in with email and password now, and keep Google sign-in available for when the provider is configured.
            </p>
          </div>
        </div>

        {activeFeedback ? (
          <div
            className={[
              "mb-5 rounded-2xl px-4 py-3 text-sm",
              activeFeedback.tone === "error"
                ? "border border-red-200 bg-red-50 text-red-700"
                : "border border-emerald-200 bg-emerald-50 text-emerald-700",
            ].join(" ")}
          >
            {activeFeedback.message}
          </div>
        ) : null}

        <Tabs
          className="space-y-6"
          value={mode}
          onValueChange={(value) => {
            clearFormFeedback();
            setMode(value as AuthMode);
          }}
        >
          <TabsList className="grid w-full grid-cols-2 rounded-full bg-gray-100 p-1" variant="default">
            <TabsTrigger className="rounded-full" value="sign-in">
              Sign in
            </TabsTrigger>
            <TabsTrigger className="rounded-full" value="sign-up">
              Create account
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sign-in">
            <form className="space-y-4" onSubmit={handlePasswordSignIn}>
              <AuthField
                autoComplete="email"
                disabled={isBusy}
                label="Email"
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

              <Button className="h-12 w-full rounded-full text-sm font-medium" disabled={isBusy} type="submit">
                {pendingAction === "sign-in" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Continue with email
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="sign-up">
            <form className="space-y-4" onSubmit={handlePasswordSignUp}>
              <AuthField
                autoComplete="email"
                disabled={isBusy}
                label="Email"
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

              <p className="text-xs leading-5 text-gray-500">
                If email confirmation is enabled in Supabase Auth, Drawgle will send a verification link before first sign-in.
              </p>

              <Button className="h-12 w-full rounded-full text-sm font-medium" disabled={isBusy} type="submit">
                {pendingAction === "sign-up" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Create account
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <div className="mt-6 space-y-4">
          <div className="flex items-center gap-3 text-[11px] font-medium tracking-[0.22em] text-gray-400 uppercase">
            <Separator className="flex-1" />
            <span>or</span>
            <Separator className="flex-1" />
          </div>

          <Button
            className="h-12 w-full rounded-full text-sm font-medium"
            disabled={isBusy}
            onClick={handleGoogleSignIn}
            type="button"
            variant="outline"
          >
            {pendingAction === "google" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Continue with Google
          </Button>

          <p className="text-center text-xs leading-5 text-gray-500">
            Email and password works immediately. Google sign-in remains here for once the Google provider is configured in your Supabase project.
          </p>
        </div>
      </div>
    </main>
  );
}

function LoginPageFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-8">
      <div className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-8 shadow-xl">
        <div className="mb-8 space-y-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-black text-white">
            <Code className="h-7 w-7" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-gray-950">Drawgle</h1>
            <p className="text-sm text-gray-500">Loading authentication options...</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="h-12 rounded-full bg-gray-100" />
          <div className="h-12 rounded-full bg-gray-100" />
          <div className="h-12 rounded-full bg-gray-100" />
        </div>
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
    <label className="block space-y-2">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <Input
        autoComplete={autoComplete}
        className="h-12 rounded-2xl border-gray-200 px-4"
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

function getErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }

  return fallback;
}