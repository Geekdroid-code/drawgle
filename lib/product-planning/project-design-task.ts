import "server-only";
import { idempotencyKeys } from "@trigger.dev/sdk";
import { resolvePublishedStylePreset } from "@/lib/published-style-presets";
import type { ProductPlanning } from "./model";
import { projectDesignPreparationKey } from "./project-design-preparation";

/** The same global task identity is used by chat, scope preparation, and Build. */
export async function projectDesignTaskIdentity(state: ProductPlanning, projectId: string,
  knownPresetVersion?: number | null) {
  const version = knownPresetVersion === undefined
    ? (state.input.stylePresetSlug
      ? (await resolvePublishedStylePreset(state.input.stylePresetSlug))?.version ?? null : null)
    : knownPresetVersion;
  const key = projectDesignPreparationKey(state, version);
  return { key, idempotencyKey: await idempotencyKeys.create(`project-design:${projectId}:${key}`, {
    scope: "global",
  }) };
}
