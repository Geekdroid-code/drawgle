import "server-only";

const getRequiredServerEnv = (name: string, value: string | undefined) => {
  if (!value) {
    throw new Error(`${name} is missing. Add it to your environment before running this feature.`);
  }

  return value;
};

const getOptionalServerEnv = (value: string | undefined) => value?.trim() || undefined;

const getServerEnvInt = (name: string, fallback: number) => {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
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

export const getGenerationEngineVersion = (): "v1" | "v2" =>
  process.env.DRAWGLE_GENERATION_ENGINE_VERSION === "v1" ? "v1" : "v2";

export const isStyleReferenceCalibrationEnabled = () =>
  process.env.DRAWGLE_STYLE_REFERENCE_CALIBRATION_ENABLED !== "false";

export const isProgressiveFirstScreenEnabled = () =>
  process.env.DRAWGLE_PROGRESSIVE_FIRST_SCREEN_ENABLED !== "false";

export const isProjectAgentV2Enabled = (projectId: string) => {
  const allowlist = new Set(
    (process.env.DRAWGLE_AGENT_V2_PROJECT_ALLOWLIST ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
  if (allowlist.has(projectId)) return true;

  const parsedPercent = Number.parseInt(process.env.DRAWGLE_AGENT_V2_ROLLOUT_PERCENT ?? "100", 10);
  const percent = Number.isFinite(parsedPercent) ? Math.min(100, Math.max(0, parsedPercent)) : 100;
  let hash = 2166136261;
  for (const character of projectId) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 100 < percent;
};

export const getScreenBuilderModel = () =>
  process.env.DRAWGLE_SCREEN_BUILDER_MODEL ?? "gemini-3-flash-preview";

export const getOpenRouterScreenBuildModel = () =>
  getOptionalServerEnv(process.env.DRAWGLE_OPENROUTER_SCREEN_BUILD_MODEL)
  ?? getOptionalServerEnv(process.env.DRAWGLE_SCREEN_BUILDER_MODEL)
  ?? "moonshotai/kimi-k2.5";

export const getProjectPlannerModel = () =>
  process.env.DRAWGLE_GEMINI_PROJECT_PLANNER_MODEL ?? "gemini-3-flash-preview";

export const getScreenEditorModel = () =>
  process.env.DRAWGLE_SCREEN_EDITOR_MODEL ?? getScreenBuilderModel();

export const getOpenRouterSort = () =>
  process.env.DRAWGLE_OPENROUTER_SORT?.trim() || undefined;

export const getOpenRouterProviders = () =>
  process.env.DRAWGLE_OPENROUTER_PROVIDERS;

export const getOpenRouterAllowFallbacks = () =>
  process.env.DRAWGLE_OPENROUTER_ALLOW_FALLBACKS !== "false";

export const getOpenRouterFallbackModels = () =>
  (process.env.DRAWGLE_OPENROUTER_FALLBACK_MODELS ?? "")
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);

/**
 * Global output ceiling, applied on top of the per-request budget.
 *
 * The default was 16,000, which silently clamped every screen-build budget
 * above it — the per-screen intent could never take effect. It must stay at or
 * above `SCREEN_BUILD_OUTPUT_TOKEN_BUDGET`, or the clamp reintroduces the
 * truncation this exists to prevent. `provider.ts` logs when the clamp actually
 * bites, so a stale deployed value is visible instead of silent.
 */
export const getOpenRouterMaxTokens = () =>
  getServerEnvInt("DRAWGLE_OPENROUTER_MAX_TOKENS", 32000);

export const getOpenRouterStreamTimeouts = () => ({
  headerTimeoutMs: getServerEnvInt("DRAWGLE_OPENROUTER_HEADER_TIMEOUT_MS", 15000),
  firstContentTimeoutMs: getServerEnvInt("DRAWGLE_OPENROUTER_FIRST_TOKEN_TIMEOUT_MS", 45000),
  idleTimeoutMs: getServerEnvInt("DRAWGLE_OPENROUTER_IDLE_TIMEOUT_MS", 45000),
  hardTimeoutMs: getServerEnvInt("DRAWGLE_OPENROUTER_HARD_TIMEOUT_MS", 240000),
});

export const getOpenRouterTimeoutMs = () => {
  const value = Number.parseInt(process.env.DRAWGLE_OPENROUTER_TIMEOUT_MS ?? "60000", 10);
  return Number.isFinite(value) && value > 0 ? value : 60000;
};

type OpenRouterReasoningEffort = "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

const getOpenRouterScreenReasoning = ({
  enabledRaw,
  effort,
  maxTokensRaw,
  excludeRaw,
  defaultEffort,
}: {
  enabledRaw: string | undefined;
  effort: string | undefined;
  maxTokensRaw: string | undefined;
  excludeRaw: string | undefined;
  defaultEffort: OpenRouterReasoningEffort;
}) => {
  const normalizedEffort = effort?.trim();

  if (enabledRaw === "false" || normalizedEffort === "none") {
    return { enabled: false } as const;
  }

  const maxTokens = maxTokensRaw ? Number.parseInt(maxTokensRaw, 10) : undefined;
  return {
    effort:
      normalizedEffort && ["minimal", "low", "medium", "high", "xhigh", "max"].includes(normalizedEffort)
        ? (normalizedEffort as OpenRouterReasoningEffort)
        : defaultEffort,
    max_tokens: Number.isFinite(maxTokens) && maxTokens && maxTokens > 0 ? maxTokens : undefined,
    exclude: excludeRaw !== "false",
  };
};

export const getOpenRouterScreenBuildReasoning = () =>
  getOpenRouterScreenReasoning({
    enabledRaw: process.env.DRAWGLE_OPENROUTER_SCREEN_BUILD_REASONING_ENABLED,
    effort: process.env.DRAWGLE_OPENROUTER_SCREEN_BUILD_REASONING_EFFORT,
    maxTokensRaw: process.env.DRAWGLE_OPENROUTER_SCREEN_BUILD_REASONING_MAX_TOKENS,
    excludeRaw: process.env.DRAWGLE_OPENROUTER_SCREEN_BUILD_REASONING_EXCLUDE,
    defaultEffort: "medium",
  });

export const getOpenRouterScreenEditorReasoning = () =>
  getOpenRouterScreenReasoning({
    enabledRaw: process.env.DRAWGLE_OPENROUTER_SCREEN_EDITOR_REASONING_ENABLED,
    effort: process.env.DRAWGLE_OPENROUTER_SCREEN_EDITOR_REASONING_EFFORT,
    maxTokensRaw: process.env.DRAWGLE_OPENROUTER_SCREEN_EDITOR_REASONING_MAX_TOKENS,
    excludeRaw: process.env.DRAWGLE_OPENROUTER_SCREEN_EDITOR_REASONING_EXCLUDE,
    defaultEffort: "low",
  });
