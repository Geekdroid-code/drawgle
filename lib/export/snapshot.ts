import type { ExportProjectContext } from "@/lib/export-pipeline";
import { compileProductSpecification, type SpecificationSource } from "@/lib/export/product-spec";
import { mapProjectNavigationRow, mapScreenRow } from "@/lib/supabase/mappers";
import type { ProjectRow, ScreenRow, ProjectNavigationRow } from "@/lib/supabase/database.types";
import type { DesignTokens } from "@/lib/types";

export type ExportDatabaseSnapshot = {
  project: ProjectRow; screens: ScreenRow[]; navigation: ProjectNavigationRow | null;
  specificationSources: SpecificationSource[];
};

export function prepareExportSnapshot(snapshot: ExportDatabaseSnapshot, screenIds: string[], includeBehavior: boolean): ExportProjectContext {
  if (snapshot.screens.length !== screenIds.length || snapshot.screens.some(s => !screenIds.includes(s.id) || s.status !== "ready" || !s.code?.trim())) {
    throw new Error("Some selected screens are unavailable or still building. Refresh and select ready screens again.");
  }
  const p = snapshot.project;
  // The original project brief is part of the existing handoff. Never serialize
  // the full database rows, which also contain private provider and stream data.
  const screens = snapshot.screens.map(row => {
    const s = mapScreenRow(row);
    return { id: s.id, projectId: s.projectId, userId: "", name: s.name, code: s.code,
      prompt: "", x: s.x, y: s.y, sortIndex: s.sortIndex, status: s.status, sourceLoaded: true,
      chromePolicy: s.chromePolicy, navigationItemId: s.navigationItemId, parentScreenId: s.parentScreenId,
      stateKey: s.stateKey, stateLabel: s.stateLabel, stateRole: s.stateRole, roadmapItemId: s.roadmapItemId,
      createdAt: s.createdAt, updatedAt: s.updatedAt };
  });
  const nav = snapshot.navigation ? mapProjectNavigationRow(snapshot.navigation) : null;
  if (screens.some(s => s.chromePolicy?.showPrimaryNavigation) && (!nav || nav.status !== "ready")) {
    throw new Error("Shared navigation is unavailable or still building. Refresh before exporting.");
  }
  return {
    project: { id: p.id, userId: "", name: p.name, prompt: p.prompt, status: p.status,
      designTokens: p.design_tokens as DesignTokens | null, createdAt: p.created_at, updatedAt: p.updated_at },
    screens, designTokens: p.design_tokens as DesignTokens | null,
    projectNavigation: nav ? { id: nav.id, projectId: nav.projectId, ownerId: "", plan: nav.plan,
      shellCode: nav.shellCode, status: nav.status, createdAt: nav.createdAt, updatedAt: nav.updatedAt } : null,
    ...(includeBehavior ? { productSpecification: compileProductSpecification(snapshot.specificationSources, p.product_planning) } : {}),
  };
}
