import { NextResponse } from "next/server";
import { z } from "zod";

import { hashUiCode } from "@/lib/generation/ui-contract-normalizer";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ScreenQualityDiagnosticsV1 } from "@/lib/types";

export const runtime = "nodejs";

const issueCode = z.enum([
  "horizontal_overflow",
  "critical_text_truncation",
  "collapsed_token_gap",
  "nested_radius_violation",
  "field_radius_mismatch",
  "button_radius_mismatch",
  "undersized_control",
  "style_runtime_degraded",
]);

export const screenQualityDiagnosticsPayloadSchema = z.object({
  version: z.literal(1),
  codeHash: z.string().min(8).max(80),
  viewport: z.object({
    width: z.number().int().min(240).max(2400),
    height: z.number().int().min(320).max(3000),
  }),
  issues: z.array(z.object({
    code: issueCode,
    drawgleId: z.string().min(1).max(160).nullable(),
    measured: z.record(z.string().max(80), z.number().finite().min(-100000).max(100000)).optional(),
  })).max(32),
}).strict();

export async function POST(request: Request, context: { params: Promise<{ screenId: string }> }) {
  const parsed = screenQualityDiagnosticsPayloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid quality diagnostic payload." }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { screenId } = await context.params;
  const admin = createAdminClient();
  const { data: screen, error } = await admin
    .from("screens")
    .select("id, code, quality_diagnostics")
    .eq("id", screenId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (error || !screen) return NextResponse.json({ error: "Screen not found" }, { status: 404 });

  if (hashUiCode(screen.code) !== parsed.data.codeHash) {
    return NextResponse.json({ ignored: true, reason: "stale_code_hash" }, { status: 202 });
  }

  const existing = screen.quality_diagnostics as unknown as ScreenQualityDiagnosticsV1 | null;
  if (
    existing?.version === 1
    && existing.codeHash === parsed.data.codeHash
    && existing.rendered?.viewport.width === parsed.data.viewport.width
    && existing.rendered.viewport.height === parsed.data.viewport.height
    && JSON.stringify(existing.rendered.issues) === JSON.stringify(parsed.data.issues)
  ) {
    return NextResponse.json({ saved: true, unchanged: true });
  }
  const staticReport = existing?.version === 1 && existing.codeHash === parsed.data.codeHash
    ? existing.static
    : { version: 1 as const, repairEnabled: false, repairs: [], warnings: [] };
  const next: ScreenQualityDiagnosticsV1 = {
    version: 1,
    codeHash: parsed.data.codeHash,
    disposition: staticReport.warnings.length || parsed.data.issues.length ? "warning" : "clean",
    static: staticReport,
    rendered: {
      checkedAt: new Date().toISOString(),
      viewport: parsed.data.viewport,
      issues: parsed.data.issues,
    },
  };
  const { error: updateError } = await admin
    .from("screens")
    // Telemetry must not make a screen look user-edited, reorder it, or trigger
    // downstream content synchronization.
    .update({ quality_diagnostics: next as never })
    .eq("id", screenId)
    .eq("owner_id", user.id);
  if (updateError) return NextResponse.json({ error: "Unable to store quality diagnostics." }, { status: 500 });
  return NextResponse.json({ saved: true });
}
