import { NextResponse } from "next/server";
import { tasks } from "@trigger.dev/sdk";

import { applyDeterministicEdits, ensureDrawgleIds, type DeterministicEditOperation, type DrawgleElementTargetType } from "@/lib/drawgle-dom";
import { persistDesignChange, readDesignTarget } from "@/lib/design-history/persistence";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { tokenizeStaticDrawgleHtml } from "@/lib/token-runtime";
import type { DesignTokens } from "@/lib/types";
import type { enrichScreenMemoryTask } from "@/trigger/enrich-screen-memory";

export const runtime = "nodejs";

const isOperation = (value: unknown): value is DeterministicEditOperation => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const operation = value as Partial<DeterministicEditOperation>;
  if (operation.type === "replaceText") {
    return typeof operation.text === "string";
  }

  if (operation.type === "setStyle") {
    return typeof operation.property === "string" && typeof operation.value === "string";
  }

  if (operation.type === "clearStyle") {
    return typeof operation.property === "string";
  }
  if (operation.type === "setClassUtility") {
    return typeof operation.family === "string" && typeof operation.className === "string";
  }

  if (operation.type === "removeClassUtility") {
    return typeof operation.family === "string";
  }

  if (operation.type === "replaceClassList") {
    return typeof operation.className === "string";
  }

  if (operation.type === "setAttribute") {
    return typeof operation.name === "string" && (typeof operation.value === "string" || operation.value === null);
  }
  if (operation.type === "replaceImage") {
    return typeof operation.mode === "string" && typeof operation.src === "string";
  }

  if (operation.type === "deleteElement") {
    return true;
  }

  if (operation.type === "duplicateElement") {
    return true;
  }

  return false;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const projectId = typeof body.projectId === "string" ? body.projectId : "";
    const screenId = typeof body.screenId === "string" ? body.screenId : null;
    const targetType: DrawgleElementTargetType = body.targetType === "navigation" ? "navigation" : "screen";
    const drawgleId = typeof body.drawgleId === "string" ? body.drawgleId : "";
    const operations = Array.isArray(body.operations) ? body.operations.filter(isOperation) : [];
    const expectedRevision = Number.isSafeInteger(body.expectedRevision) ? body.expectedRevision as number : null;
    const requestId = typeof body.requestId === "string" ? body.requestId : "";

    if (!projectId || !drawgleId || operations.length === 0 || expectedRevision === null || !requestId) {
      return NextResponse.json(
        { error: "Project, target, operations, revision and request ID are required." },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data: project, error: projectError } = await admin
      .from("projects")
      .select("id, owner_id, design_tokens")
      .eq("id", projectId)
      .maybeSingle();

    if (projectError || !project || project.owner_id !== user.id) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }
    const designTokens = (project.design_tokens as DesignTokens | null) ?? null;

    if (targetType === "navigation") {
      const target = { projectId, ownerId: user.id, target: { context: "navigation" as const } };
      const saved = await readDesignTarget(admin, target);
      if (!saved.ready) {
        return NextResponse.json({ error: "Shared navigation not found." }, { status: 404 });
      }
      if (saved.revision !== expectedRevision) return NextResponse.json({ error: "Navigation changed. Refresh before saving your edit." }, { status: 409 });

      const currentCode = ensureDrawgleIds((saved.payload as { shellCode: string }).shellCode, "dg-nav").code;
      const editedCode = applyDeterministicEdits({
        code: currentCode,
        drawgleId,
        operations,
        prefix: "dg-nav",
      });
      const nextCode = tokenizeStaticDrawgleHtml(editedCode, designTokens).code;

      const result = await persistDesignChange(admin, target, { expectedRevision, requestId,
        payload: { ...saved.payload as object, shellCode: nextCode },
        label: operations[0]?.type === "deleteElement" ? "Deleted navigation element" : "Edited shared navigation",
        origin: "element-edit" });
      if (result.status !== "success") return NextResponse.json({ error: "Navigation changed. Refresh before retrying.", status: result.status }, { status: 409 });

      return NextResponse.json({ ok: true, targetType, changed: nextCode !== currentCode });
    }

    if (!screenId) {
      return NextResponse.json({ error: "screenId is required for screen edits." }, { status: 400 });
    }

    const target = { projectId, ownerId: user.id, target: { context: "screen" as const, screenId } };
    const saved = await readDesignTarget(admin, target);
    if (!saved.ready) {
      return NextResponse.json({ error: "Screen not found." }, { status: 404 });
    }
    if (saved.revision !== expectedRevision) return NextResponse.json({ error: "Screen changed. Refresh before saving your edit." }, { status: 409 });

    const currentCode = ensureDrawgleIds((saved.payload as { code: string }).code).code;
    const editedCode = applyDeterministicEdits({
      code: currentCode,
      drawgleId,
      operations,
    });
    const nextCode = tokenizeStaticDrawgleHtml(editedCode, designTokens).code;

    const result = await persistDesignChange(admin, target, { expectedRevision, requestId,
      payload: { code: nextCode }, label: operations[0]?.type === "deleteElement" ? "Deleted element" :
        operations[0]?.type === "duplicateElement" ? "Duplicated element" : "Edited element", origin: "element-edit" });
    if (result.status !== "success") return NextResponse.json({ error: "Screen changed. Refresh before retrying.", status: result.status }, { status: 409 });

    if (nextCode !== currentCode) {
      void tasks.trigger<typeof enrichScreenMemoryTask>(
        "enrich-screen-memory",
        { screenId },
        { concurrencyKey: `screen-memory-${screenId}` },
      ).catch(error => console.error("Could not queue screen memory enrichment", error));
    }

    return NextResponse.json({ ok: true, targetType, changed: nextCode !== currentCode });
  } catch (error: unknown) {
    console.error("Element edit API error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
