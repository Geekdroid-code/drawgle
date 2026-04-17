const getRequiredPublicEnv = (name: string, value: string | undefined) => {
  if (!value) {
    throw new Error(`${name} is missing. Configure it before using Supabase.`);
  }

  return value;
};

export const getSupabasePublicEnv = () => ({
  url: getRequiredPublicEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  publishableKey: getRequiredPublicEnv(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  ),
});

export const getPublicAppUrl = () =>
  process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "http://localhost:3000";