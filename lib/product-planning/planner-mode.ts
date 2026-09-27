/** The single-candidate planner is the standard discovery path. Legacy is an explicit rollback. */
export function proposalPlannerEnabled() {
  const mode = process.env.DRAWGLE_DESIGN_FLOW_PLANNER?.trim().toLowerCase();
  return mode !== "legacy" && mode !== "off";
}
