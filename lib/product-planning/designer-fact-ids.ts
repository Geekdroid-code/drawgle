import { normalizeDesignerFactId } from "./designer-patch";
import type { ProductPlanning } from "./model";

/** Keep same-response roadmap calls aligned with IDs normalized at ingestion. */
export function createDesignerFactIds() {
  const aliases = new Map<string, string>();
  const remember = (value: unknown) => {
    if (typeof value !== "string") return;
    const normalized = normalizeDesignerFactId(value);
    if (normalized && normalized !== value) aliases.set(value, normalized);
  };
  const remap = (value: unknown) => {
    if (typeof value !== "string") return value;
    let current = value;
    const seen = new Set<string>();
    while (aliases.has(current) && !seen.has(current)) {
      seen.add(current);
      current = aliases.get(current)!;
    }
    return current;
  };
  const remapIds = (value: unknown) => Array.isArray(value) ? value.map(remap) : value;

  return {
    rememberProductArgs(args: Record<string, unknown> | undefined) {
      for (const fact of Array.isArray(args?.facts) ? args.facts : []) remember(fact?.id);
      for (const entry of Array.isArray(args?.supersessions) ? args.supersessions : []) {
        remember(entry?.id);
        remember(entry?.replacement?.id);
      }
    },
    rememberActiveSuccessors(state: ProductPlanning) {
      const byId = new Map(state.blueprint.facts.map(fact => [fact.id, fact]));
      for (const fact of state.blueprint.facts) {
        if (fact.status !== "superseded" || !fact.supersededBy) continue;
        let successor = byId.get(fact.supersededBy);
        const seen = new Set([fact.id]);
        while (successor?.status === "superseded" && successor.supersededBy && !seen.has(successor.id)) {
          seen.add(successor.id);
          successor = byId.get(successor.supersededBy);
        }
        if (successor?.status === "active" && successor.section === fact.section) aliases.set(fact.id, successor.id);
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
