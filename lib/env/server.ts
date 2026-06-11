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

export const getR2Config = () => ({
  accountId: getRequiredServerEnv("R2_ACCOUNT_ID", process.env.R2_ACCOUNT_ID),
  accessKeyId: getRequiredServerEnv("R2_ACCESS_KEY_ID", process.env.R2_ACCESS_KEY_ID),
  secretAccessKey: getRequiredServerEnv("R2_SECRET_ACCESS_KEY", process.env.R2_SECRET_ACCESS_KEY),
  bucket: getRequiredServerEnv("R2_BUCKET", process.env.R2_BUCKET),
  publicBaseUrl: getRequiredServerEnv("R2_PUBLIC_BASE_URL", process.env.R2_PUBLIC_BASE_URL).replace(/\/+$/, ""),
});

export const getOptionalPexelsApiKey = () => process.env.PEXELS_API_KEY?.trim() || null;

export const getOptionalPixabayApiKey = () => process.env.PIXABAY_API_KEY?.trim() || null;

export const getOpenRouterApiKey = () =>
  getRequiredServerEnv("OPENROUTER_API_KEY", process.env.OPENROUTER_API_KEY);

export const getScreenBuilderProvider = () =>
  process.env.DRAWGLE_SCREEN_BUILDER_PROVIDER ?? "gemini";

export const getScreenBuilderModel = () =>
  process.env.DRAWGLE_SCREEN_BUILDER_MODEL ?? "gemini-3-flash-preview";

export const getScreenEditorModel = () =>
  process.env.DRAWGLE_SCREEN_EDITOR_MODEL ?? getScreenBuilderModel();

export const getOpenRouterSort = () =>
  process.env.DRAWGLE_OPENROUTER_SORT ?? "price";

export const getOpenRouterProviders = () =>
  process.env.DRAWGLE_OPENROUTER_PROVIDERS;

export const getOpenRouterAllowFallbacks = () =>
  process.env.DRAWGLE_OPENROUTER_ALLOW_FALLBACKS === "true";

