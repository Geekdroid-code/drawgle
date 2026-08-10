/**
 * Deterministic design critic.
 *
 * Everything the QA layer measured until now was safety, completion, asset
 * policy, and token naming. None of it could see the failures a designer sees
 * first: two cards in a row that do not share a baseline, a 200px block with
 * nothing in it, a screen whose first fold is already spent.
 *
 * These checks are measurements, not opinions. Each one names a specific
 * geometric or content condition and reports it. Only `raw_surface_color` is
 * repairable; the rest are reported into `quality_diagnostics` so the failure
 * rate is visible per rule. Nothing here triggers a paid builder retry.
 */

import type { CheerioAPI } from "cheerio";

import { contrastRatio } from "@/lib/color-math";
import { buildTokenVariableMap } from "@/lib/generation/geometry-contract";
import type { DesignCriticFinding, DesignCriticReportV1, DesignTokens } from "@/lib/types";

const MOBILE_FRAME_HEIGHT_PX = 844;

/** A block taller than this with no text and no asset slot is decoration filling a hole. */
const DEAD_SPACE_HEIGHT_PX = 120;

/** More distinct off-system radius values than this on one screen is geometry drift. */
const MAX_RADIUS_VOCABULARY = 4;

/** Smaller floating shapes are accents; at this size they read as fabricated objects. */
const FABRICATED_ART_MIN_DIMENSION_PX = 64;

/** Declared sibling heights differing by more than this read as a ragged row. */
const SIBLING_HEIGHT_TOLERANCE_PX = 8;

const classList = (value: string | undefined) => String(value ?? "").split(/\s+/).filter(Boolean);

const declaredSizePx = (
  classes: string[],
  variables: Map<string, string>,
  axis: "h" | "w",
): number | null => {
  for (const className of classes) {
    const match = className.match(new RegExp(`^(?:${axis}|min-${axis})-\\[(.+)\\]$`));
    if (!match) continue;
    const raw = match[1].replace(/_/g, " ");
    const variableMatch = raw.match(/^var\(\s*(--[a-z0-9-]+)/i);
    const resolved = variableMatch ? variables.get(variableMatch[1]) : raw;
    const px = resolved?.match(/^(-?\d+(?:\.\d+)?)px$/i);
    if (px) return Number(px[1]);
    const rem = resolved?.match(/^(-?\d+(?:\.\d+)?)rem$/i);
    if (rem) return Number(rem[1]) * 16;
  }
  for (const className of classes) {
    const match = className.match(new RegExp(`^${axis}-(\\d+(?:\\.\\d+)?)$`));
    if (match) return Number(match[1]) * 4;
  }
  return null;
};

const declaredHeightPx = (classes: string[], variables: Map<string, string>) =>
  declaredSizePx(classes, variables, "h");

const declaredWidthPx = (classes: string[], variables: Map<string, string>) =>
  declaredSizePx(classes, variables, "w");

const topOffsetPx = (classes: string[], variables: Map<string, string>): number => {
  for (const className of classes) {
    const match = className.match(/^mt-\[(.+)\]$/);
    if (!match) continue;
    const raw = match[1].replace(/_/g, " ");
    const variableMatch = raw.match(/^var\(\s*(--[a-z0-9-]+)/i);
    const resolved = variableMatch ? variables.get(variableMatch[1]) : raw;
    const px = resolved?.match(/^(-?\d+(?:\.\d+)?)px$/i);
    if (px) return Number(px[1]);
  }
  for (const className of classes) {
    const match = className.match(/^mt-(\d+(?:\.\d+)?)$/);
    if (match) return Number(match[1]) * 4;
  }
  return 0;
};

const selectorFor = ($: CheerioAPI, element: never) => {
  const node = $(element as never);
  const id = node.attr("data-drawgle-id");
  if (id) return `[data-drawgle-id="${id}"]`;
  const tag = (element as unknown as { tagName?: string }).tagName ?? "element";
  const firstClass = classList(node.attr("class"))[0];
  return firstClass ? `${tag}.${firstClass}` : tag;
};

const visibleTextLength = (node: ReturnType<CheerioAPI>) => node.text().replace(/\s+/g, " ").trim().length;

const isGridRow = (classes: string[]) =>
  classes.includes("grid") || classes.some((name) => /^grid-cols-/.test(name));

/**
 * Two cards side by side are read as a pair. When the pair does not share a
 * baseline — different declared media heights, a manual top offset on one, or
 * a different number of children — the row rags and the composition reads as
 * unplanned. This is the exact defect that shipped in the cosmetics build:
 * `grid-cols-[1.12fr_.88fr] items-start` with 212px and 158px media wells and
 * a 24px `mt-` on the second card.
 */
const checkSiblingBalance = (
  $: CheerioAPI,
  variables: Map<string, string>,
  findings: DesignCriticFinding[],
) => {
  $("[class]").each((_, element) => {
    const node = $(element as never);
    const classes = classList(node.attr("class"));
    if (!isGridRow(classes)) return;

    const children = node.children().toArray();
    if (children.length < 2 || children.length > 4) return;

    const profiles = children.map((child) => {
      const childNode = $(child as never);
      const childClasses = classList(childNode.attr("class"));
      const mediaHeights = childNode
        .find("[class]")
        .toArray()
        .map((descendant) => declaredHeightPx(classList($(descendant as never).attr("class")), variables))
        .filter((value): value is number => value !== null);
      return {
        offset: topOffsetPx(childClasses, variables),
        media: mediaHeights.length > 0 ? Math.max(...mediaHeights) : null,
        childCount: childNode.children().length,
        stretches: childClasses.includes("h-full") || childClasses.includes("self-stretch"),
      };
    });

    const offsets = profiles.map((profile) => profile.offset);
    const offsetSpread = Math.max(...offsets) - Math.min(...offsets);
    const mediaValues = profiles.map((profile) => profile.media).filter((value): value is number => value !== null);
    const mediaSpread = mediaValues.length === profiles.length && mediaValues.length > 1
      ? Math.max(...mediaValues) - Math.min(...mediaValues)
      : 0;
    const childCounts = new Set(profiles.map((profile) => profile.childCount));

    const reasons: string[] = [];
    if (offsetSpread > 0) reasons.push(`a ${offsetSpread}px manual top offset on one sibling`);
    if (mediaSpread > SIBLING_HEIGHT_TOLERANCE_PX) reasons.push(`media heights differing by ${mediaSpread}px`);
    if (childCounts.size > 1) reasons.push("different internal anatomy");

    const stretchesEqually = classes.includes("items-stretch")
      || (!classes.includes("items-start") && profiles.every((profile) => profile.stretches));
    if (reasons.length === 0 || (stretchesEqually && mediaSpread <= SIBLING_HEIGHT_TOLERANCE_PX)) return;

    findings.push({
      code: "sibling_imbalance",
      selector: selectorFor($, element as never),
      detail: `Siblings in one row do not share a baseline: ${reasons.join(", ")}. Cards in a row need identical anatomy and equal height.`,
      severity: "high",
    });
  });
};

const isOutOfFlow = (classes: string[]) => classes.includes("absolute") || classes.includes("fixed");

/** Ambient lighting is blurred or nearly transparent; content is neither. */
const isAmbientLayer = (classes: string[]) =>
  classes.some((name) => /^blur(?:-|$)/.test(name) || /^backdrop-blur(?:-|$)/.test(name))
  || classes.some((name) => /\/(?:[0-2]?\d)$/.test(name));

const hasContent = ($: CheerioAPI, node: ReturnType<CheerioAPI>) =>
  visibleTextLength(node) > 0 || node.find("[data-asset-slot], img, svg, i[data-lucide]").length > 0;

/**
 * A tall in-flow block containing no content is a region the builder was given
 * space for but no content budget. It is where the empty panels come from.
 *
 * Out-of-flow elements are excluded: an absolutely positioned layer consumes no
 * vertical budget, so it cannot leave a hole in the layout.
 */
const checkDecorativeDeadSpace = (
  $: CheerioAPI,
  variables: Map<string, string>,
  findings: DesignCriticFinding[],
) => {
  $("[class]").each((_, element) => {
    const node = $(element as never);
    const classes = classList(node.attr("class"));
    if (isOutOfFlow(classes)) return;
    const height = declaredHeightPx(classes, variables);
    if (height === null || height < DEAD_SPACE_HEIGHT_PX) return;
    if (hasContent($, node)) return;

    findings.push({
      code: "decorative_dead_space",
      selector: selectorFor($, element as never),
      detail: `A ${height}px block holds no text, asset slot, icon, or chart geometry. Every region that tall must earn its height with content.`,
      severity: "high",
    });
  });
};

/**
 * An opaque, solidly filled, object-sized rectangle floating inside a media
 * area is the builder hand-drawing a product out of CSS because it had a hole
 * to fill and no approved asset. It is already forbidden in the builder
 * contract; this is where it gets caught.
 *
 * Blurred or near-transparent layers are excluded — those are ambient lighting,
 * a legitimate technique, and are governed by the style charter instead.
 */
const checkFabricatedObjectArt = (
  $: CheerioAPI,
  variables: Map<string, string>,
  findings: DesignCriticFinding[],
) => {
  $("[class]").each((_, element) => {
    const node = $(element as never);
    const classes = classList(node.attr("class"));
    if (!isOutOfFlow(classes) || isAmbientLayer(classes)) return;
    if (!classes.some((name) => /^(?:bg-|dg-surface|dg-bg-)/.test(name))) return;
    if (hasContent($, node)) return;

    const height = declaredHeightPx(classes, variables);
    const width = declaredWidthPx(classes, variables);
    if (height === null || width === null) return;
    if (Math.min(height, width) < FABRICATED_ART_MIN_DIMENSION_PX) return;

    findings.push({
      code: "fabricated_object_art",
      selector: selectorFor($, element as never),
      detail: `A ${width}x${height}px solid floating shape with no content is CSS-drawn object art. Use an approved asset slot or an intentional placeholder surface instead.`,
      severity: "high",
    });
  });
};

/**
 * A screen whose declared chrome and first regions already exceed the frame
 * has no first fold left. Only counts explicit heights, so it under-reports
 * rather than guessing at auto heights.
 */
const checkAboveFoldBudget = (
  $: CheerioAPI,
  variables: Map<string, string>,
  findings: DesignCriticFinding[],
) => {
  const root = $("body").children().first().length > 0 ? $("body").children().first() : $.root().children().first();
  const sections = root.children().toArray();
  let consumed = 0;
  let counted = 0;

  for (const section of sections) {
    const height = declaredHeightPx(classList($(section as never).attr("class")), variables);
    if (height === null) continue;
    consumed += height;
    counted += 1;
    if (consumed > MOBILE_FRAME_HEIGHT_PX) break;
  }

  if (counted >= 2 && consumed > MOBILE_FRAME_HEIGHT_PX) {
    findings.push({
      code: "above_fold_budget_exceeded",
      selector: null,
      detail: `The first ${counted} declared-height regions total ${consumed}px against an ${MOBILE_FRAME_HEIGHT_PX}px frame. The first fold is spent before the content begins.`,
      severity: "medium",
    });
  }
};

const RAW_SURFACE_CLASS = /^(?:bg|text)-(?:white|black|gray|slate|zinc|neutral|stone)(?:-(?:50|100|200|300|400|500|600|700|800|900|950))?$/;

const checkRawSurfaceColors = (
  $: CheerioAPI,
  findings: DesignCriticFinding[],
  repairEnabled: boolean,
) => {
  $("[class]").each((_, element) => {
    const node = $(element as never);
    const classes = classList(node.attr("class"));
    const offenders = classes.filter((className) => RAW_SURFACE_CLASS.test(className));
    if (offenders.length === 0) return;

    if (repairEnabled) {
      const replaced = classes.map((className) => {
        if (!RAW_SURFACE_CLASS.test(className)) return className;
        return className.startsWith("bg-") ? "dg-surface-card" : "dg-text-high";
      });
      node.attr("class", [...new Set(replaced)].join(" "));
    }

    findings.push({
      code: "raw_surface_color",
      selector: selectorFor($, element as never),
      detail: `System surface uses a raw palette color (${offenders.join(", ")}) while an approved token role exists.${repairEnabled ? " Replaced with the token role." : ""}`,
      severity: "medium",
    });
  });
};

/**
 * Counts only radii that sit *outside* the token system. The concentric law
 * legitimately produces several distinct values on one screen (a 32px card, a
 * 24px well inset 8px, a 16px row inset 16px) — that is one geometry language
 * expressed correctly, not drift. Drift is arbitrary and Tailwind-named radii
 * chosen per element, which is what makes corners look randomly assigned.
 */
const checkRadiusVocabulary = ($: CheerioAPI, findings: DesignCriticFinding[]) => {
  const offSystem = new Set<string>();
  $("[class]").each((_, element) => {
    for (const className of classList($(element as never).attr("class"))) {
      const arbitrary = className.match(/^rounded(?:-(?:t|r|b|l|tl|tr|br|bl|s|e))?-\[(.+)\]$/);
      if (arbitrary && !/var\(--dg-radii-/.test(arbitrary[1]) && !/9999/.test(arbitrary[1])) {
        offSystem.add(arbitrary[1]);
      }
      const named = className.match(/^rounded-(none|sm|md|lg|xl|2xl|3xl)$/);
      if (named) offSystem.add(named[1]);
    }
  });

  if (offSystem.size > MAX_RADIUS_VOCABULARY) {
    findings.push({
      code: "radius_vocabulary_drift",
      selector: null,
      detail: `${offSystem.size} distinct off-system radii on one screen (${[...offSystem].slice(0, 8).join(", ")}). Corners must come from the token ladder, not be chosen per element.`,
      severity: "medium",
    });
  }
};

const checkSurfaceTextContrast = (
  $: CheerioAPI,
  designTokens: DesignTokens | null | undefined,
  findings: DesignCriticFinding[],
) => {
  const tokens = designTokens?.tokens;
  const cardSurface = tokens?.color?.surface?.card;
  const lowText = tokens?.color?.text?.low_emphasis;
  if (typeof cardSurface !== "string" || typeof lowText !== "string") return;

  const ratio = contrastRatio(lowText, cardSurface);
  if (ratio === null || ratio >= 3) return;

  const usesLowOnCard = $("[class]").toArray().some((element) => {
    const classes = classList($(element as never).attr("class"));
    return classes.includes("dg-text-low") || classes.some((name) => name.includes("text-low-emphasis"));
  });
  if (!usesLowOnCard) return;

  findings.push({
    code: "surface_text_contrast",
    selector: null,
    detail: `Low-emphasis text is ${ratio.toFixed(2)}:1 on the card surface and is used on this screen. The metadata tier floor is 3:1.`,
    severity: "medium",
  });
};

export function runDesignCritic({
  $,
  designTokens,
  repairEnabled,
}: {
  $: CheerioAPI;
  designTokens?: DesignTokens | null;
  repairEnabled: boolean;
}): DesignCriticReportV1 {
  const variables = buildTokenVariableMap(designTokens);
  const findings: DesignCriticFinding[] = [];

  checkSiblingBalance($, variables, findings);
  checkDecorativeDeadSpace($, variables, findings);
  checkFabricatedObjectArt($, variables, findings);
  checkAboveFoldBudget($, variables, findings);
  checkRawSurfaceColors($, findings, repairEnabled);
  checkRadiusVocabulary($, findings);
  checkSurfaceTextContrast($, designTokens, findings);

  const deduped = findings.filter((finding, index) => findings.findIndex((other) =>
    other.code === finding.code && other.selector === finding.selector) === index);

  return {
    version: 1,
    findings: deduped,
    highSeverityCount: deduped.filter((finding) => finding.severity === "high").length,
  };
}
