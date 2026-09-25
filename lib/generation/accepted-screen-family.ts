import { load } from "cheerio";
import type { ScreenFamilyContract } from "@/lib/types";

const groups = {
  surfaces: /^(?:bg|border|rounded|shadow)-(?!none$)[a-z0-9][a-z0-9_/#.%\[\]-]*$/,
  typography: /^(?:font|tracking|leading)-(?!none$)[a-z0-9][a-z0-9_/#.%\[\]-]*$|^text-(?:xs|sm|base|lg|xl|[2-9]xl)$/,
  spacing: /^(?:p|px|py|pt|pb|pl|pr|gap|gap-x|gap-y|space-y)-[a-z0-9][a-z0-9_/#.%\[\]-]*$/,
};

function commonClasses(values: string[], pattern: RegExp, limit: number) {
  const counts = new Map<string, number>();
  for (const value of values) for (const name of value.split(/\s+/)) {
    if (!pattern.test(name)) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit).map(([name]) => name);
}

/** Only reusable visual vocabulary is extracted; sibling layout is never copied. */
export function acceptedScreenFamily(code: string, screenName: string, planned: ScreenFamilyContract | null): ScreenFamilyContract | null {
  if (!code.trim()) return planned;
  const $ = load(code);
  const all = $("[class]").toArray().map(node => $(node).attr("class") ?? "");
  if (!all.length) return planned;
  const controls = $("button,[role=button],a[class]").toArray().map(node => $(node).attr("class") ?? "");
  const icons = $("svg[class]").toArray().map(node => $(node).attr("class") ?? "");
  const surfaces = commonClasses(all, groups.surfaces, 10);
  const typography = commonClasses(all, groups.typography, 8);
  const spacing = commonClasses(all, groups.spacing, 8);
  const controlStyle = commonClasses(controls, /^(?:bg|border|rounded|shadow|font|text|px|py)-[a-z0-9][a-z0-9_/#.%\[\]-]*$/, 8);
  const iconStyle = commonClasses(icons, /^(?:w|h|size|stroke|text)-[a-z0-9][a-z0-9_/#.%\[\]-]*$/, 6);
  if (!surfaces.length && !typography.length && !spacing.length) return planned;
  const rule = (label: string, names: string[]) => names.length
    ? label + ": " + names.join(", ") + ". Apply the treatment where it serves the new task; do not copy the screen layout." : null;
  return {
    summary: "Shared visual language anchored in the accepted " + screenName + " screen. Give each sibling its own task-specific anatomy.",
    surfaces: [planned?.surfaces, rule("Observed surface treatments", surfaces)].filter(Boolean).join(" "),
    typography: [planned?.typography, rule("Observed type treatments", typography)].filter(Boolean).join(" "),
    spacing: [planned?.spacing, rule("Observed spacing rhythm", spacing)].filter(Boolean).join(" "),
    navigation: planned?.navigation ?? "Use the approved shared navigation assignments and detail back actions.",
    imagery: planned?.imagery ?? "Use only relevant supplied or resolved assets and intentional placeholders.",
    consistencyRules: [...(planned?.consistencyRules ?? []),
      ...(controlStyle.length ? ["Controls use this accepted treatment: " + controlStyle.join(", ") + "."] : []),
      ...(iconStyle.length ? ["Icons use this accepted treatment: " + iconStyle.join(", ") + "."] : []),
      "Preserve the visual family without reproducing the anchor screen's layout tree."],
  };
}
