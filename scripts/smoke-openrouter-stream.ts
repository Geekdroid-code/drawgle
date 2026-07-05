import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  OpenRouterStreamError,
  streamOpenRouterChatCompletion,
  type OpenRouterProviderPreferences,
  type OpenRouterStreamEvent,
} from "../lib/ai/openrouter-stream";

const loadEnvFile = (filePath: string) => {
  const resolved = resolve(process.cwd(), filePath);
  if (!existsSync(resolved)) {
    return;
  }

  for (const line of readFileSync(resolved, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
};

const intEnv = (name: string, fallback: number) => {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const listEnv = (name: string) =>
  (process.env[name] ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

const distinct = (values: string[]) => {
  const seen = new Set<string>();
  return values.filter((value) => {
    if (seen.has(value)) {
      return false;
    }
    seen.add(value);
    return true;
  });
};

const help = process.argv.includes("--help") || process.argv.includes("-h");
if (help) {
  console.log([
    "Usage: pnpm.cmd exec tsx scripts/smoke-openrouter-stream.ts [prompt]",
    "",
    "Streams one OpenRouter chat completion with the same raw SSE adapter used by screen builds.",
    "It prints event timestamps to stderr and streamed model text to stdout.",
  ].join("\n"));
  process.exit(0);
}

const main = async () => {
loadEnvFile(".env.local");

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
  throw new Error("OPENROUTER_API_KEY is missing.");
}

const primaryModel = process.env.DRAWGLE_OPENROUTER_SCREEN_BUILD_MODEL?.trim()
  || process.env.DRAWGLE_SCREEN_BUILDER_MODEL?.trim()
  || "moonshotai/kimi-k2.5";
const fallbackModels = listEnv("DRAWGLE_OPENROUTER_FALLBACK_MODELS");
const models = distinct([primaryModel, ...fallbackModels]);
const prompt = process.argv.slice(2).join(" ").trim()
  || "Reply with a short HTML button component and no markdown.";
const startedAt = Date.now();
const providerPreferences: OpenRouterProviderPreferences = {
  allow_fallbacks: process.env.DRAWGLE_OPENROUTER_ALLOW_FALLBACKS !== "false",
  ...(process.env.DRAWGLE_OPENROUTER_SORT?.trim() ? { sort: process.env.DRAWGLE_OPENROUTER_SORT.trim() } : {}),
  ...(listEnv("DRAWGLE_OPENROUTER_PROVIDERS").length > 0 ? { only: listEnv("DRAWGLE_OPENROUTER_PROVIDERS") } : {}),
};
const timeouts = {
  headerTimeoutMs: intEnv("DRAWGLE_OPENROUTER_HEADER_TIMEOUT_MS", 15000),
  firstContentTimeoutMs: intEnv("DRAWGLE_OPENROUTER_FIRST_TOKEN_TIMEOUT_MS", 45000),
  idleTimeoutMs: intEnv("DRAWGLE_OPENROUTER_IDLE_TIMEOUT_MS", 45000),
  hardTimeoutMs: intEnv("DRAWGLE_OPENROUTER_HARD_TIMEOUT_MS", 240000),
};

const logEvent = (event: OpenRouterStreamEvent) => {
  const { event: eventName, level, task, model, attempt, elapsedMs, status, generationId, provider, timeoutMs, errorCode, errorType, retryable, emittedContent, chunkCount, textCharCount, message, metadata } = event;
  console.error(JSON.stringify({
    ts: new Date().toISOString(),
    event: eventName,
    level,
    task,
    model,
    attempt,
    elapsedMs,
    status,
    generationId,
    provider,
    timeoutMs,
    errorCode,
    errorType,
    retryable,
    emittedContent,
    chunkCount,
    textCharCount,
    message,
    metadata,
  }));
};

let lastError: unknown;
let emitted = false;

for (let index = 0; index < models.length; index += 1) {
  const model = models[index];
  try {
    for await (const text of streamOpenRouterChatCompletion({
      apiKey,
      model,
      task: "smoke-openrouter-stream",
      attempt: index + 1,
      messages: [
        { role: "system", content: "You are a concise streaming smoke test." },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      maxTokens: intEnv("DRAWGLE_OPENROUTER_MAX_TOKENS", 16000),
      provider: providerPreferences,
      timeouts,
      onEvent: logEvent,
    })) {
      emitted = true;
      process.stdout.write(text);
    }
    process.stderr.write(`\n${JSON.stringify({
      ts: new Date().toISOString(),
      event: "smoke:done",
      status: "ok",
      elapsedMs: Date.now() - startedAt,
      model,
    })}\n`);
    process.exit(0);
  } catch (error) {
    lastError = error;
    const canRetry = error instanceof OpenRouterStreamError
      && error.retryable
      && !error.emittedContent
      && !emitted
      && index < models.length - 1;

    if (!canRetry) {
      break;
    }

    process.stderr.write(`${JSON.stringify({
      ts: new Date().toISOString(),
      event: "smoke:retrying_model",
      elapsedMs: Date.now() - startedAt,
      model,
      nextModel: models[index + 1],
      message: error.message,
    })}\n`);
  }
}

const message = lastError instanceof Error ? lastError.message : String(lastError ?? "Unknown OpenRouter smoke failure");
process.stderr.write(`${JSON.stringify({
  ts: new Date().toISOString(),
  event: "smoke:failed",
  status: "failed",
  elapsedMs: Date.now() - startedAt,
  emitted,
  message,
})}\n`);
process.exitCode = 1;
};

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${JSON.stringify({
    ts: new Date().toISOString(),
    event: "smoke:failed",
    status: "failed",
    message,
  })}\n`);
  process.exitCode = 1;
});