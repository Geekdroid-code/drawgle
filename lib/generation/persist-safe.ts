/**
 * Make LLM-generated HTML/text safe to embed in PostgREST JSON bodies.
 * Prevents PGRST102 ("Empty or invalid json") caused by null bytes / lone surrogates.
 */

export type JsonSanitizeResult = {
  value: string;
  changed: boolean;
  removedNullBytes: number;
  fixedLoneSurrogates: number;
  removedControlChars: number;
};

const isJsonSafeControlChar = (codeUnit: number) =>
  codeUnit === 0x09 || codeUnit === 0x0a || codeUnit === 0x0d;

/**
 * Strip/replace characters that break JSON string encoding or PostgREST body parsing.
 * Keeps tab/newline/carriage-return.
 */
export function sanitizeTextForJson(input: string): JsonSanitizeResult {
  if (!input) {
    return {
      value: "",
      changed: false,
      removedNullBytes: 0,
      fixedLoneSurrogates: 0,
      removedControlChars: 0,
    };
  }

  let removedNullBytes = 0;
  let fixedLoneSurrogates = 0;
  let removedControlChars = 0;
  let output = "";

  for (let index = 0; index < input.length; index += 1) {
    const codeUnit = input.charCodeAt(index);

    // Null bytes are never valid in JSON strings for many parsers / PG text paths.
    if (codeUnit === 0) {
      removedNullBytes += 1;
      continue;
    }

    // High surrogate
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = input.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        output += input[index] + input[index + 1];
        index += 1;
        continue;
      }
      fixedLoneSurrogates += 1;
      output += "\uFFFD";
      continue;
    }

    // Lone low surrogate
    if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      fixedLoneSurrogates += 1;
      output += "\uFFFD";
      continue;
    }

    // Other C0 controls except tab/LF/CR
    if (codeUnit < 0x20 && !isJsonSafeControlChar(codeUnit)) {
      removedControlChars += 1;
      continue;
    }

    // DEL
    if (codeUnit === 0x7f) {
      removedControlChars += 1;
      continue;
    }

    output += input[index];
  }

  const changed =
    removedNullBytes > 0 || fixedLoneSurrogates > 0 || removedControlChars > 0 || output !== input;

  return {
    value: output,
    changed,
    removedNullBytes,
    fixedLoneSurrogates,
    removedControlChars,
  };
}

export function sanitizeScreenCodeForPersist(code: string): JsonSanitizeResult {
  return sanitizeTextForJson(code);
}

/** Returns true when a value can round-trip through JSON.stringify/parse. */
export function isJsonSerializable(value: unknown): boolean {
  try {
    const serialized = JSON.stringify(value);
    if (typeof serialized !== "string") return false;
    JSON.parse(serialized);
    return true;
  } catch {
    return false;
  }
}

export function assertJsonSerializable(value: unknown, label = "payload"): void {
  if (!isJsonSerializable(value)) {
    throw new Error(`Failed to persist ${label}: payload is not valid JSON.`);
  }
}

type PersistErrorShape = {
  code?: unknown;
  message?: unknown;
  details?: unknown;
  hint?: unknown;
};

/**
 * Detect the deployment-order case where application code knows about the
 * optional QA telemetry column but PostgREST has not observed the migration.
 * Keep this exact: unrelated schema or persistence failures must still surface.
 */
export function isMissingQualityDiagnosticsColumnError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as PersistErrorShape;
  const code = typeof candidate.code === "string" ? candidate.code : "";
  const description = [candidate.message, candidate.details, candidate.hint]
    .filter((value): value is string => typeof value === "string")
    .join(" ");

  return (code === "PGRST204" || code === "42703")
    && /quality_diagnostics/i.test(description);
}

export type OptionalQualityDiagnosticsPersistResult<TError> = {
  error: TError | null;
  qualityDiagnosticsPersisted: boolean;
};

/**
 * Persist a screen patch while treating quality_diagnostics as the optional
 * telemetry it is. A missing-column response retries the same write once with
 * only that field removed; it never retries a builder call or hides other DB
 * errors.
 */
export async function persistWithOptionalQualityDiagnostics<TError>(
  patch: Record<string, unknown>,
  persist: (nextPatch: Record<string, unknown>) => Promise<{ error: TError | null }>,
): Promise<OptionalQualityDiagnosticsPersistResult<TError>> {
  const first = await persist(patch);
  if (
    !first.error
    || !Object.prototype.hasOwnProperty.call(patch, "quality_diagnostics")
    || !isMissingQualityDiagnosticsColumnError(first.error)
  ) {
    return {
      error: first.error,
      qualityDiagnosticsPersisted: !first.error
        && Object.prototype.hasOwnProperty.call(patch, "quality_diagnostics"),
    };
  }

  const fallbackPatch = { ...patch };
  delete fallbackPatch.quality_diagnostics;
  const fallback = await persist(fallbackPatch);
  return {
    error: fallback.error,
    qualityDiagnosticsPersisted: false,
  };
}

/**
 * Build a screens update patch with only defined keys and JSON-safe strings.
 */
export function buildScreenPersistPatch(input: {
  code: string;
  status: string;
  error?: string | null;
  summary?: string | null;
  blockIndex?: unknown;
  chromePolicy?: unknown;
  navigationItemId?: string | null;
  qualityDiagnostics?: unknown;
  updatedAt?: string;
}): Record<string, unknown> {
  const codeSanitized = sanitizeScreenCodeForPersist(input.code);
  const errorSanitized =
    input.error == null ? null : sanitizeTextForJson(input.error).value;
  const summarySanitized =
    input.summary == null ? undefined : sanitizeTextForJson(input.summary).value;

  const patch: Record<string, unknown> = {
    code: codeSanitized.value,
    status: input.status,
    error: errorSanitized,
    updated_at: input.updatedAt ?? new Date().toISOString(),
  };

  if (summarySanitized !== undefined) {
    patch.summary = summarySanitized;
  }
  if (input.blockIndex !== undefined) {
    patch.block_index = input.blockIndex ?? null;
  }
  if (input.chromePolicy !== undefined) {
    patch.chrome_policy = input.chromePolicy ?? null;
  }
  if (input.navigationItemId !== undefined) {
    patch.navigation_item_id = input.navigationItemId ?? null;
  }
  if (input.qualityDiagnostics !== undefined) {
    patch.quality_diagnostics = input.qualityDiagnostics ?? null;
  }

  // Deep-clone via JSON to drop non-serializable values (undefined nested, bigint, etc.)
  return JSON.parse(JSON.stringify(patch)) as Record<string, unknown>;
}
