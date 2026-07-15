import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";
import type { CreditReservationRow } from "@/lib/supabase/database.types";
import type { CreditReservationSummary, JsonValue } from "@/lib/types";

export const SCREEN_GENERATION_CREDIT_COST = 20;
export const STATE_GENERATION_CREDIT_COST = 10;
export const MAX_TOTAL_OUTPUTS_PER_RUN = 8;

type AdminClient = ReturnType<typeof createAdminClient>;

export type CreditReservationOutput = {
  outputKey: string;
  outputKind: "screen" | "state" | "edit";
  amount?: number;
  roadmapItemId?: string | null;
  metadata?: Record<string, JsonValue>;
};

type ReservationRpcResult = {
  reservedCredits?: number;
  outputCount?: number;
  availableBalance?: number;
  idempotent?: boolean;
};

export class CreditReservationError extends Error {
  code: "insufficient_credits" | "reservation_failed";

  constructor(message: string, code: CreditReservationError["code"]) {
    super(message);
    this.name = "CreditReservationError";
    this.code = code;
  }
}

export const generationOutputKey = (
  generationRunId: string,
  kind: "screen" | "state",
  stableKey: string,
) => `run:${generationRunId}:${kind}:${stableKey.trim().toLowerCase()}`;

export async function reserveGenerationCredits({
  admin,
  ownerId,
  projectId,
  generationRunId,
  outputs,
}: {
  admin: AdminClient;
  ownerId: string;
  projectId: string;
  generationRunId: string;
  outputs: CreditReservationOutput[];
}) {
  if (outputs.length === 0 || outputs.length > MAX_TOTAL_OUTPUTS_PER_RUN) {
    throw new CreditReservationError(
      `A generation run must reserve between 1 and ${MAX_TOTAL_OUTPUTS_PER_RUN} outputs.`,
      "reservation_failed",
    );
  }

  const manifest = outputs.map((output) => ({
    outputKey: output.outputKey,
    outputKind: output.outputKind,
    amount: output.amount ?? SCREEN_GENERATION_CREDIT_COST,
    roadmapItemId: output.roadmapItemId ?? null,
    metadata: output.metadata ?? {},
  }));
  const { data, error } = await admin.rpc("reserve_generation_credits", {
    input_owner_id: ownerId,
    input_project_id: projectId,
    input_generation_run_id: generationRunId,
    input_outputs: manifest as never,
  });

  if (error) {
    const insufficient = /insufficient credits/i.test(error.message);
    throw new CreditReservationError(
      error.message,
      insufficient ? "insufficient_credits" : "reservation_failed",
    );
  }

  const result = (data ?? {}) as ReservationRpcResult;
  return {
    reservedCredits: Number(result.reservedCredits ?? 0),
    outputCount: Number(result.outputCount ?? outputs.length),
    availableBalance: result.availableBalance == null ? null : Number(result.availableBalance),
    idempotent: Boolean(result.idempotent),
  };
}

export async function bindReservationToScreen({
  admin,
  ownerId,
  generationRunId,
  outputKey,
  screenId,
}: {
  admin: AdminClient;
  ownerId: string;
  generationRunId: string;
  outputKey: string;
  screenId: string;
}) {
  const { error } = await admin
    .from("credit_reservations")
    .update({ screen_id: screenId, updated_at: new Date().toISOString() })
    .eq("owner_id", ownerId)
    .eq("generation_run_id", generationRunId)
    .eq("output_key", outputKey)
    .eq("status", "reserved");
  if (error) throw error;
}

export async function captureGenerationCredit({
  admin,
  ownerId,
  generationRunId,
  outputKey,
  screenId,
}: {
  admin: AdminClient;
  ownerId: string;
  generationRunId: string;
  outputKey: string;
  screenId?: string | null;
}) {
  const { error } = await admin.rpc("capture_generation_credit", {
    input_owner_id: ownerId,
    input_generation_run_id: generationRunId,
    input_output_key: outputKey,
    input_screen_id: screenId ?? null,
  });
  if (error) throw error;
}

export async function releaseGenerationCredit({
  admin,
  ownerId,
  generationRunId,
  outputKey,
  reason,
}: {
  admin: AdminClient;
  ownerId: string;
  generationRunId: string;
  outputKey: string;
  reason: string;
}) {
  const { data, error } = await admin.rpc("release_generation_credit", {
    input_owner_id: ownerId,
    input_generation_run_id: generationRunId,
    input_output_key: outputKey,
    input_reason: reason,
  });
  if (error) throw error;
  return Number(data ?? 0);
}

export async function releaseGenerationCreditRemainder({
  admin,
  ownerId,
  generationRunId,
  reason,
}: {
  admin: AdminClient;
  ownerId: string;
  generationRunId: string;
  reason: string;
}) {
  const { data, error } = await admin.rpc("release_generation_credit_remainder", {
    input_owner_id: ownerId,
    input_generation_run_id: generationRunId,
    input_reason: reason,
  });
  if (error) throw error;
  return Number(data ?? 0);
}

export async function getGenerationCreditSummary({
  admin,
  ownerId,
  generationRunId,
}: {
  admin: AdminClient;
  ownerId: string;
  generationRunId: string;
}): Promise<CreditReservationSummary> {
  const { data, error } = await admin
    .from("credit_reservations")
    .select("amount, status")
    .eq("owner_id", ownerId)
    .eq("generation_run_id", generationRunId);
  if (error) throw error;

  const reservations = (data ?? []) as Array<Pick<CreditReservationRow, "amount" | "status">>;
  return reservations.reduce((summary: CreditReservationSummary, reservation) => {
    const amount = Number(reservation.amount);
    summary.outputCount += 1;
    summary.reservedCredits += amount;
    if (reservation.status === "captured") summary.capturedCredits += amount;
    if (reservation.status === "released") summary.releasedCredits += amount;
    return summary;
  }, {
    reservedCredits: 0,
    capturedCredits: 0,
    releasedCredits: 0,
    outputCount: 0,
  });
}

export async function reconcileStaleGenerationCredits(admin: AdminClient, limit = 100) {
  const { data: reservations, error } = await admin
    .from("credit_reservations")
    .select("owner_id, generation_run_id, output_key, screen_id")
    .eq("status", "reserved")
    .lt("expires_at", new Date().toISOString())
    .not("generation_run_id", "is", null)
    .limit(limit);
  if (error) throw error;

  let captured = 0;
  let released = 0;
  for (const reservation of reservations ?? []) {
    const generationRunId = reservation.generation_run_id;
    if (!generationRunId) continue;

    const [{ data: screen }, { data: run }] = await Promise.all([
      reservation.screen_id
        ? admin.from("screens").select("status").eq("id", reservation.screen_id).maybeSingle()
        : Promise.resolve({ data: null }),
      admin.from("generation_runs").select("status").eq("id", generationRunId).maybeSingle(),
    ]);

    if (screen?.status === "ready") {
      await captureGenerationCredit({
        admin,
        ownerId: reservation.owner_id,
        generationRunId,
        outputKey: reservation.output_key,
        screenId: reservation.screen_id,
      });
      captured += 1;
    } else if (run && ["completed", "failed", "canceled"].includes(run.status)) {
      await releaseGenerationCredit({
        admin,
        ownerId: reservation.owner_id,
        generationRunId,
        outputKey: reservation.output_key,
        reason: "Stale terminal generation output was not saved.",
      });
      released += 1;
    }
  }

  return { inspected: reservations?.length ?? 0, captured, released };
}
