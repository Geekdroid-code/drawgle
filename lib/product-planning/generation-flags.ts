/** The progressive path is the default; an explicit off value remains the rollback. */
export function progressiveGenerationEnabled() {
  return !["false", "off", "0"].includes(
    process.env.DRAWGLE_PROGRESSIVE_GENERATION_ENABLED?.trim().toLowerCase() ?? "",
  );
}

/**
 * Speculative scope preparation plans the batch while the approval card is
 * open. In production it never saved a build (0 hits) and paid a full planning
 * pass for every card, including cards that were never approved. Opt-in only.
 */
export function scopePreparationEnabled() {
  return progressiveGenerationEnabled()
    && ["true", "on", "1"].includes(process.env.DRAWGLE_SCOPE_PREPARATION?.trim().toLowerCase() ?? "");
}
