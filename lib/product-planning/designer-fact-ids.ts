import { normalizeDesignerFactId } from "./designer-patch";

/** Keep same-response roadmap calls aligned with IDs normalized at ingestion. */
export function createDesignerFactIds() {
  const aliases = new Map<string, string>();
  const remember = (value: unknown) => {
    if (typeof value !== "string") return;
    const normalized = normalizeDesignerFactId(value);
    if (normalized && normalized !== value) aliases.set(value, normalized);
  };
  const remap = (value: unknown) => typeof value === "string" ? aliases.get(value) ?? value : value;
  const remapIds = (value: unknown) => Array.isArray(value) ? value.map(remap) : value;

  return {
    rememberProductArgs(args: Record<string, unknown> | undefined) {
      for (const fact of Array.isArray(args?.facts) ? args.facts : []) remember(fact?.id);
      for (const entry of Array.isArray(args?.supersessions) ? args.supersessions : []) {
        remember(entry?.id);
        remember(entry?.replacement?.id);
      }
    },
    scopeArgs(args: Record<string, unknown> | undefined) {
      return args ? { ...args, surfaceIds: remapIds(args.surfaceIds) } : args;
    },
    functionalArgs(args: Record<string, unknown> | undefined) {
      if (!args || !Array.isArray(args.items)) return args;
      return { ...args, items: args.items.map((item) => item && typeof item === "object" ? {
        ...item,
        surfaceIds: remapIds(item.surfaceIds),
        journeyIds: remapIds(item.journeyIds),
        decisionIds: remapIds(item.decisionIds),
      } : item) };
    },
  };
}
