"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { AuthField, AuthSubmitButton } from "@/components/auth/AuthFields";
import { BrandMark } from "@/components/marketing/BrandMark";
import { marketingFontVariables } from "@/components/marketing/fonts";
import { track } from "@/lib/analytics";
import { DEFAULT_AUTH_REDIRECT } from "@/lib/auth-redirect";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export default function ResetPasswordClient() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        throw updateError;
      }

      track("password_reset_completed");
      router.replace(DEFAULT_AUTH_REDIRECT);
      router.refresh();
    } catch (updateError) {
      console.error("Supabase password update failed", updateError);
      setError(
        updateError && typeof updateError === "object" && "message" in updateError && typeof updateError.message === "string"
          ? updateError.message
          : "We couldn't update your password. Request a new reset link and try again.",
      );
      setBusy(false);
    }
  };

  return (
    <div className={cn("mk-root", marketingFontVariables)}>
      <main className="flex min-h-svh flex-col bg-white px-5 py-6 sm:px-10">
        <header>
          <Link href="/" aria-label="Drawgle home" className="inline-flex">
            <BrandMark />
          </Link>
        </header>

        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-12">
          <h1 className="text-[34px] font-medium leading-[1.08] tracking-[-0.03em] text-mk-heading sm:text-[40px]">
            Choose a <br />
            <span className="font-semibold text-mk-accent">new password.</span>
          </h1>
          <p className="mb-7 mt-3 max-w-sm text-sm leading-relaxed text-mk-body">
            You&apos;ll stay signed in once it&apos;s saved.
          </p>

          {error ? (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs leading-5 text-red-700">
              {error}
            </div>
          ) : null}

          <form className="space-y-3" onSubmit={handleSubmit}>
            <AuthField
              autoComplete="new-password"
              disabled={busy}
              label="New password"
              minLength={6}
              onChange={(value) => {
                setError(null);
                setPassword(value);
              }}
              placeholder="Create a password"
              type="password"
              value={password}
            />
            <AuthField
              autoComplete="new-password"
              disabled={busy}
              label="Confirm new password"
              minLength={6}
              onChange={(value) => {
                setError(null);
                setConfirmPassword(value);
              }}
              placeholder="Repeat your password"
              type="password"
              value={confirmPassword}
            />

            <AuthSubmitButton busy={busy} disabled={busy}>
              Save password
            </AuthSubmitButton>
          </form>
        </div>
      </main>
    </div>
  );
}
