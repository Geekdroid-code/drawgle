import type { ProjectCraftBlueprint, ReferenceMode } from "@/lib/types";

export const shouldEnableSpatialCraft = ({
  referenceMode,
  isNewProject,
  craftBlueprint,
}: {
  referenceMode: ReferenceMode;
  isNewProject: boolean;
  craftBlueprint?: ProjectCraftBlueprint | null;
}) => referenceMode !== "user_recreate" && (isNewProject || Boolean(craftBlueprint));
