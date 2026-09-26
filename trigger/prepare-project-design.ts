import { createHash } from "node:crypto";
import { logger, task } from "@trigger.dev/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDesignStylePack } from "@/lib/generation/design-styles";
import { resolvePublishedStylePreset } from "@/lib/published-style-presets";
import { designRequirementsKey } from "@/lib/product-planning/design-requirements";
import { readProductPlanning } from "@/lib/product-planning/model";
import { productReferenceExecution } from "@/lib/product-planning/reference-execution";
import { loadPlanningReference } from "@/lib/product-planning/references";
import { earlyDesignMode, mayPrepareProjectDesign,
  projectDesignPreparationKey, readProjectDesignPreparation, saveProjectDesignPreparation } from "@/lib/product-planning/project-design-preparation";
import { generateProjectDesign } from "@/lib/product-planning/generate-project-design";
import type { ProjectCharter } from "@/lib/types";

/** Runs beside product conversation; its result is never accepted source until Build. */
export const prepareProjectDesignTask = task({
  id: "prepare-project-design", maxDuration: 900,
  run: async ({ projectId, ownerId, queuedAt }: { projectId: string; ownerId: string; queuedAt: string }) => {
    if (earlyDesignMode() === "off") return { skipped: true };
    const admin = createAdminClient();
    const { data: project, error } = await admin.from("projects")
      .select("product_planning,design_tokens,project_charter").eq("id", projectId).eq("owner_id", ownerId).maybeSingle();
    if (error) throw error;
    const state = readProductPlanning(project?.product_planning);
    if (!mayPrepareProjectDesign(state) || project?.design_tokens) return { skipped: true };
    const planning = state!;
    const reference = productReferenceExecution(planning);
    const image = reference.imagePath ? await loadPlanningReference(admin, reference.imagePath, ownerId) : null;
    if (reference.imagePath && (!image || createHash("sha256").update(image.data).digest("hex") !== planning.experience?.referenceHash)) {
      return { skipped: true, reason: "reference_unavailable" };
    }
    const preset = !image ? await resolvePublishedStylePreset(planning.input.stylePresetSlug) : null;
    const designStyle = preset?.stylePack ?? (!image
      ? getDesignStylePack((project?.project_charter as ProjectCharter | null)?.designStyle?.id) : null);
    const key = projectDesignPreparationKey(planning, preset?.version ?? null);
    if (await readProjectDesignPreparation(admin, projectId, ownerId, key)) return { prepared: true, reused: true };
    const result = await generateProjectDesign(planning, { image, referenceMode: reference.mode,
      referenceId: reference.referenceId, designStyle });
    const { data: latest, error: latestError } = await admin.from("projects")
      .select("product_planning,design_tokens").eq("id", projectId).eq("owner_id", ownerId).maybeSingle();
    if (latestError) throw latestError;
    const current = readProductPlanning(latest?.product_planning);
    const latestPreset = !image && current ? await resolvePublishedStylePreset(current.input.stylePresetSlug) : null;
    if (!mayPrepareProjectDesign(current) || latest?.design_tokens
      || projectDesignPreparationKey(current!, latestPreset?.version ?? null) !== key
      || designRequirementsKey(current!) !== result.requirementsKey) return { stale: true };
    await saveProjectDesignPreparation(admin, projectId, ownerId, key, result.designTokens,
      result.referenceAnalysis, result.requirementsKey, queuedAt);
    logger.info("Prepared project-wide design", { projectId });
    return { prepared: true };
  },
});
