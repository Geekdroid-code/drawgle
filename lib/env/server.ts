import "server-only";

const getRequiredServerEnv = (name: string, value: string | undefined) => {
  if (!value) {
    throw new Error(`${name} is missing. Add it to your environment before running this feature.`);
  }

  return value;
};

export const getGeminiApiKey = () =>
  getRequiredServerEnv("GEMINI_API_KEY", process.env.GEMINI_API_KEY ?? process.env.MY_GEMINI_API_KEY);

export const getSupabaseServiceRoleKey = () =>
  getRequiredServerEnv("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);

export const getTriggerSecretKey = () =>
  getRequiredServerEnv("TRIGGER_SECRET_KEY", process.env.TRIGGER_SECRET_KEY);

export const getTriggerProjectRef = () => process.env.TRIGGER_PROJECT_REF ?? "drawgle-local";