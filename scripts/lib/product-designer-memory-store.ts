import { randomUUID } from "node:crypto";

// Synthetic conversation storage only. Database semantics are tested separately
// against the real migration; this adapter never writes to Supabase.
export function productDesignerMemoryStore(tables: Record<string, Array<Record<string, unknown>>>) {
  const assets = new Map<string, Blob>();
  return {
    storage: { from: () => ({
      upload: async (path: string, data: Uint8Array, options: { contentType: string }) => {
        assets.set(path, new Blob([new Uint8Array(data)], { type: options.contentType }));
        return { error: null };
      },
      download: async (path: string) => ({ data: assets.get(path), error: assets.has(path) ? null : new Error("Reference missing") }),
    }) },
    async rpc(name: string, args: Record<string, unknown>) {
      if (name !== "update_product_functional_plan") throw new Error(`Unexpected synthetic RPC: ${name}`);
      const project = tables.projects.find(row => row.id === args.input_project_id && row.owner_id === args.input_owner_id);
      if (!project || (project.product_planning as { revision: number }).revision !== args.input_revision) return { error: { code: "40001" } };
      const rows = tables.project_screen_roadmap ??= [];
      for (const key of args.input_remove_keys as string[]) {
        const row = rows.find(row => row.project_id === args.input_project_id && row.stable_key === key);
        if (row) row.status = "dismissed";
      }
      for (const item of args.input_items as Array<Record<string, unknown>>) {
        const row = rows.find(row => row.project_id === args.input_project_id && row.stable_key === item.stableKey);
        const value = { project_id: args.input_project_id, owner_id: args.input_owner_id, stable_key: item.stableKey, metadata: { functional: structuredClone(item) }, status: "planned", generated_screen_id: null };
        if (row) Object.assign(row, value); else rows.push({ id: randomUUID(), ...value });
      }
      project.product_planning = structuredClone(args.input_state);
      return { error: null };
    },
    from(table: string) {
      const filters: Array<(row: Record<string, unknown>) => boolean> = [];
      let update: Record<string, unknown> | null = null;
      let insert: Record<string, unknown> | null = null;
      let sort: { key: string; ascending: boolean } | null = null;
      let limit = Infinity;
      const execute = (single = false) => {
        const rows = tables[table] ??= [];
        if (insert) rows.push({ ...insert, id: randomUUID(), created_at: new Date().toISOString() });
        let matched = rows.filter(row => filters.every(filter => filter(row)));
        if (sort) { const ordering = sort; matched = matched.toSorted((a, b) => String(a[ordering.key]).localeCompare(String(b[ordering.key])) * (ordering.ascending ? 1 : -1)); }
        matched = matched.slice(0, limit);
        if (update) matched.forEach(row => Object.assign(row, update));
        return { data: structuredClone(single ? insert ? rows.at(-1) : matched[0] ?? null : matched), error: null };
      };
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => { filters.push(row => key === "product_planning->>revision" ? String((row.product_planning as { revision: number }).revision) === value : row[key] === value); return query; },
        neq: (key: string, value: unknown) => { filters.push(row => row[key] !== value); return query; },
        not: (key: string, _op: string, value: unknown) => { filters.push(row => row[key] !== value); return query; },
        in: (key: string, values: unknown[]) => { filters.push(row => values.includes(row[key])); return query; },
        order: (key: string, options: { ascending: boolean }) => { sort = { key, ascending: options.ascending }; return query; },
        limit: (value: number) => { limit = value; return query; },
        update: (value: Record<string, unknown>) => { update = value; return query; },
        insert: (value: Record<string, unknown>) => { insert = value; return query; },
        single: async () => execute(true), maybeSingle: async () => execute(true),
        then: (resolve: (value: ReturnType<typeof execute>) => void) => Promise.resolve(execute()).then(resolve),
      };
      return query;
    },
  };
}
