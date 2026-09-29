import { z } from "zod";

import type { ProjectReferenceDna, StyleComponent } from "@/lib/types";

/**
 * The reference's premium feel is a component vocabulary on a surface ladder.
 * Prose about it did not carry over to the builder; markup it can copy does.
 * The components come from an approved curated preset or from a specimen built
 * out of an uploaded reference, and reach the builder as one bounded block.
 */

export const MAX_STYLE_COMPONENTS = 10;
export const MAX_STYLE_COMPONENT_HTML_CHARS = 700;
/** About 1.5k tokens: the block is paid for on every screen build. */
export const MAX_STYLE_COMPONENTS_BLOCK_CHARS = 6000;

export const styleComponentSchema = z.object({
  name: z.string().trim().min(1).max(80),
  use: z.string().trim().min(1).max(240),
  html: z.string().trim().min(1).max(MAX_STYLE_COMPONENT_HTML_CHARS),
});

export const styleComponentsSchema = z.array(styleComponentSchema).max(MAX_STYLE_COMPONENTS);

const STYLE_COMPONENTS_HEADER = [
  "STYLE COMPONENTS (this project's reference vocabulary. Each line is: name — when to use it — html).",
  "Build this screen's content from these components wherever they fit its job. Copy their structure, classes and surface roles.",
  "A component you need that is not listed must use the same surface ladder, radius roles, type roles and spacing.",
  "Never reproduce the reference's sections, their order or its content: replace every sample text with this screen's own content.",
].join("\n");

const oneLine = (value: string) => value.replace(/\s+/g, " ").trim();

/** The field separator is an em dash, so one inside a name or a use would read as a fourth field. */
const withoutSeparator = (value: string) => oneLine(value).replace(/\s+[—–]\s+/g, " - ");

/** Valid components only, in order and capped; anything malformed or oversized is left out, never trimmed mid-markup. */
export function usableStyleComponents(components: unknown): StyleComponent[] {
  if (!Array.isArray(components)) return [];
  const usable: StyleComponent[] = [];
  for (const candidate of components) {
    const parsed = styleComponentSchema.safeParse(candidate);
    if (!parsed.success) continue;
    usable.push({
      name: withoutSeparator(parsed.data.name),
      use: withoutSeparator(parsed.data.use),
      html: oneLine(parsed.data.html),
    });
    if (usable.length >= MAX_STYLE_COMPONENTS) break;
  }
  return usable;
}

/**
 * The STYLE COMPONENTS block, or null when there is nothing to show. Components are added
 * whole and in order until the size budget is spent.
 */
export function formatStyleComponents(components: unknown): string | null {
  const lines: string[] = [];
  let size = STYLE_COMPONENTS_HEADER.length;
  for (const component of usableStyleComponents(components)) {
    const line = `- ${component.name} — ${component.use} — ${component.html}`;
    if (size + line.length + 1 > MAX_STYLE_COMPONENTS_BLOCK_CHARS) break;
    lines.push(line);
    size += line.length + 1;
  }
  return lines.length > 0 ? [STYLE_COMPONENTS_HEADER, ...lines].join("\n") : null;
}

/** The components a project's reference DNA carries, when it carries any. */
export const styleComponentsOf = (dna: ProjectReferenceDna | null | undefined): StyleComponent[] =>
  usableStyleComponents(dna?.specimen?.components);
