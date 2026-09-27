/** The progressive path is the default; an explicit off value remains the rollback. */
export function progressiveGenerationEnabled() {
  return !["false", "off", "0"].includes(
    process.env.DRAWGLE_PROGRESSIVE_GENERATION_ENABLED?.trim().toLowerCase() ?? "",
  );
}
