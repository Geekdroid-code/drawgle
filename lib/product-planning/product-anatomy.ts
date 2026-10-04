import { z } from "zod";

/**
 * How this kind of product is built: the components its screens are made from, the form each takes, what people
 * expect of it, and what would make it read as another kind of app.
 *
 * A project's structure used to come from wherever it could: a file manager was planned from the analytics
 * dashboard its style reference showed, and its component kit was asked for "a summary tile for a key figure" and
 * a person's avatar whatever the product was. The screen-flow planner decides this from the product alone, before
 * any reference is read, and the kit, the briefs and the reference reading all start from it. Nothing here is a
 * table of app categories: the model writes it for each product.
 */
export const productAnatomySchema = z.object({
  kind: z.string().trim().min(1).max(200),
  components: z.array(z.object({
    name: z.string().trim().min(1).max(60),
    shows: z.string().trim().min(1).max(240),
    form: z.string().trim().min(1).max(400),
  })).min(1).max(8),
  conventions: z.array(z.string().trim().min(1).max(240)).max(6),
  avoid: z.array(z.string().trim().min(1).max(240)).max(5),
});
export type ProductAnatomy = z.infer<typeof productAnatomySchema>;

const record = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const list = (value: unknown) => Array.isArray(value) ? value : [];
const clip = (value: unknown, max: number) => typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max).trim() : "";
const kebab = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
const texts = (value: unknown, max: number) => [...new Set(list(value).map(item => clip(item, 240)).filter(Boolean))].slice(0, max);

/**
 * Read a model's anatomy leniently: lengths are clipped, unnamed or formless components and duplicate names are
 * dropped. Undefined when nothing usable is left, so that a plan without one keeps the behaviour from before it.
 */
export function normalizeProductAnatomy(value: unknown): ProductAnatomy | undefined {
  const raw = record(value);
  const kind = clip(raw.kind, 200);
  const names = new Set<string>();
  const components = list(raw.components).flatMap(entry => {
    const item = record(entry);
    const name = kebab(clip(item.name, 60));
    const shows = clip(item.shows, 240);
    const form = clip(item.form, 400);
    if (!name || !form || names.has(name)) return [];
    names.add(name);
    return [{ name, shows: shows || name.replace(/-/g, " "), form }];
  }).slice(0, 8);
  if (!kind || !components.length) return undefined;
  return productAnatomySchema.parse({ kind, components, conventions: texts(raw.conventions, 6), avoid: texts(raw.avoid, 5) });
}

/** The anatomy as a prompt reads it. */
export function formatProductAnatomy(anatomy: ProductAnatomy | null | undefined): string | null {
  if (!anatomy) return null;
  return [
    "PRODUCT ANATOMY (how this kind of product is built: it decides which components exist and the form each takes. A style reference only decides how they look.)",
    `Kind: ${anatomy.kind}`,
    "Components:",
    ...anatomy.components.map(component => `- ${component.name}: ${component.shows}. Form: ${component.form}`),
    anatomy.conventions.length ? `People expect: ${anatomy.conventions.join("; ")}` : null,
    anatomy.avoid.length ? `Avoid, because it would read as another kind of app: ${anatomy.avoid.join("; ")}` : null,
  ].filter(Boolean).join("\n");
}
