import { describe, expect, it, vi } from "vitest";

import {
  isMissingQualityDiagnosticsColumnError,
  persistWithOptionalQualityDiagnostics,
} from "@/lib/generation/persist-safe";

describe("optional quality diagnostics persistence", () => {
  it("recognizes only the exact missing telemetry column errors", () => {
    expect(isMissingQualityDiagnosticsColumnError({
      code: "PGRST204",
      message: "Could not find the 'quality_diagnostics' column of 'screens' in the schema cache",
    })).toBe(true);
    expect(isMissingQualityDiagnosticsColumnError({
      code: "42703",
      message: 'column "quality_diagnostics" does not exist',
    })).toBe(true);
    expect(isMissingQualityDiagnosticsColumnError({
      code: "PGRST204",
      message: "Could not find the 'code' column of 'screens' in the schema cache",
    })).toBe(false);
    expect(isMissingQualityDiagnosticsColumnError({
      code: "23505",
      message: "quality_diagnostics constraint failed",
    })).toBe(false);
  });

  it("retries the same paid screen save without optional telemetry", async () => {
    const missingColumn = {
      code: "PGRST204",
      message: "Could not find the 'quality_diagnostics' column of 'screens' in the schema cache",
    };
    const persist = vi.fn()
      .mockResolvedValueOnce({ error: missingColumn })
      .mockResolvedValueOnce({ error: null });
    const patch = {
      code: "<main>paid output</main>",
      status: "ready",
      block_index: { version: 1 },
      quality_diagnostics: { version: 1 },
    };

    const result = await persistWithOptionalQualityDiagnostics(patch, persist);

    expect(result).toEqual({ error: null, qualityDiagnosticsPersisted: false });
    expect(persist).toHaveBeenCalledTimes(2);
    expect(persist.mock.calls[0]?.[0]).toEqual(patch);
    expect(persist.mock.calls[1]?.[0]).toEqual({
      code: "<main>paid output</main>",
      status: "ready",
      block_index: { version: 1 },
    });
    expect(patch).toHaveProperty("quality_diagnostics");
  });

  it("does not hide or retry unrelated persistence failures", async () => {
    const error = { code: "23503", message: "foreign key violation" };
    const persist = vi.fn().mockResolvedValue({ error });

    const result = await persistWithOptionalQualityDiagnostics({
      code: "<main />",
      quality_diagnostics: { version: 1 },
    }, persist);

    expect(result).toEqual({ error, qualityDiagnosticsPersisted: false });
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it("does not retry patches that do not contain telemetry", async () => {
    const error = {
      code: "PGRST204",
      message: "Could not find the 'quality_diagnostics' column of 'screens' in the schema cache",
    };
    const persist = vi.fn().mockResolvedValue({ error });

    const result = await persistWithOptionalQualityDiagnostics({ code: "<main />" }, persist);

    expect(result).toEqual({ error, qualityDiagnosticsPersisted: false });
    expect(persist).toHaveBeenCalledTimes(1);
  });
});
