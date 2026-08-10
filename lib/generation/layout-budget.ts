/**
 * Layout Contract v3 — the planner's spatial arithmetic.
 *
 * The v2 contract was five prose fields. It read well and constrained nothing:
 * a brief could say "asymmetric grid" and the builder would answer with two
 * cards of different widths, different media heights, a manual 24px offset on
 * one of them, and a decorative blob centered in each hole. Every quantity in
 * the brief was a *style* quantity (rail, gap, radius); not one described how
 * much vertical space a region gets or how much content fits inside it.
 *
 * v3 adds two numeric structures and validates them deterministically, so the
 * builder receives "two columns, equal height, identical anatomy, title <= 22
 * chars, body <= 2 lines" instead of "asymmetric grid".
 *
 * Nothing here fails a plan. Missing or incoherent values are derived, because
 * a plan that is 90% right is worth more than a rejected one.
 */

import type {
  ScreenLayoutRegion,
  ScreenRegionArrangement,
  ScreenRegionContract,
  ScreenSiblingBalance,
  ScreenViewportBudget,
  ScreenViewportBudgetRegion,
} from "@/lib/types";

/** iPhone-class logical frame. Every budget is measured against this. */
export const MOBILE_FRAME_HEIGHT_PX = 844;

/** Status bar plus top safe area the renderer always consumes. */
const CHROME_RESERVE_PX = 44;

/** Clearance the renderer adds under content when shared navigation is on. */
const SHARED_NAV_RESERVE_PX = 96;

/**
 * A region taller than this must justify its height with declared content.
 * Below it, empty space is padding; above it, empty space is a hole.
 */
export const CONTENT_JUSTIFICATION_HEIGHT_PX = 120;

const MIN_REGION_HEIGHT_PX = 48;
const MAX_REGION_HEIGHT_PX = 720;

const PRIORITY_ORDER: Record<ScreenViewportBudgetRegion["priority"], number> = {
  focal: 0,
  primary: 1,
  secondary: 2,
};

const MULTI_ITEM_ARRANGEMENTS = new Set<ScreenRegionArrangement>([
  "two-column",
  "three-column",
  "grid",
]);

/** Content kinds whose height is inherently carried by non-text content. */
const SELF_JUSTIFYING_KINDS = new Set(["media", "chart", "focal"]);

const DEFAULT_COPY_BUDGET_BY_ARRANGEMENT: Record<string, { titleMaxChars: number; bodyMaxLines: number }> = {
  "two-column": { titleMaxChars: 22, bodyMaxLines: 2 },
  "three-column": { titleMaxChars: 14, bodyMaxLines: 1 },
  grid: { titleMaxChars: 20, bodyMaxLines: 2 },
  "horizontal-scroll": { titleMaxChars: 24, bodyMaxLines: 2 },
  "stacked-rows": { titleMaxChars: 38, bodyMaxLines: 2 },
  single: { titleMaxChars: 56, bodyMaxLines: 3 },
};

export interface LayoutBudgetDiagnostic {
  code:
    | "budget_derived"
    | "region_demoted_below_fold"
    | "region_height_clamped"
    | "unknown_region_dropped"
    | "sibling_balance_defaulted"
    | "copy_budget_defaulted"
    | "contentless_region_clamped";
  regionId: string | null;
  detail: string;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const priorityFor = (region: ScreenLayoutRegion, index: number): ScreenViewportBudgetRegion["priority"] => {
  if (region.contentKind === "focal" || index === 0) return "focal";
  if (region.contentKind === "supporting" || region.contentKind === "other") return "secondary";
  return "primary";
};

/** Rough vertical cost of a region when the planner supplied no number. */
const derivedHeightFor = (region: ScreenLayoutRegion): [number, number] => {
  switch (region.contentKind) {
    case "header": return [56, 96];
    case "focal": return [220, 360];
    case "chart": return [200, 280];
    case "media": return [180, 300];
    case "list": return [180, 420];
    case "form": return [160, 320];
    case "action": return [56, 96];
    case "supporting": return [80, 200];
    default: return [96, 240];
  }
};

const derivedArrangementFor = (region: ScreenLayoutRegion): ScreenRegionArrangement => {
  switch (region.contentKind) {
    case "list": return "stacked-rows";
    case "media": return "horizontal-scroll";
    default: return "single";
  }
};

/**
 * Builds a coherent viewport budget from whatever the planner supplied,
 * deriving anything missing rather than rejecting the brief.
 */
export function resolveViewportBudget({
  supplied,
  regions,
  navigationEnabled,
  diagnostics,
}: {
  supplied?: Partial<ScreenViewportBudget> | null;
  regions: ScreenLayoutRegion[];
  navigationEnabled: boolean;
  diagnostics: LayoutBudgetDiagnostic[];
}): ScreenViewportBudget {
  const regionIds = new Set(regions.map((region) => region.id));

  const suppliedRegions = (supplied?.regions ?? []).filter((region) => {
    if (region && regionIds.has(region.id)) return true;
    diagnostics.push({
      code: "unknown_region_dropped",
      regionId: region?.id ?? null,
      detail: "Budget entry does not match any declared layout region.",
    });
    return false;
  });

  const byId = new Map(suppliedRegions.map((region) => [region.id, region]));

  const budgetRegions: ScreenViewportBudgetRegion[] = regions.map((region, index) => {
    const entry = byId.get(region.id);
    const [derivedMin, derivedMax] = derivedHeightFor(region);
    let minHPx = clamp(Math.round(entry?.minHPx ?? derivedMin), MIN_REGION_HEIGHT_PX, MAX_REGION_HEIGHT_PX);
    let maxHPx = clamp(Math.round(entry?.maxHPx ?? derivedMax), MIN_REGION_HEIGHT_PX, MAX_REGION_HEIGHT_PX);

    if (maxHPx < minHPx) {
      diagnostics.push({
        code: "region_height_clamped",
        regionId: region.id,
        detail: `maxHPx (${maxHPx}) was below minHPx (${minHPx}); widened to match.`,
      });
      maxHPx = minHPx;
    }

    // Every region that tall must earn its height with content. A tall region
    // with no inherent content is where decorative filler comes from.
    if (minHPx > CONTENT_JUSTIFICATION_HEIGHT_PX && !SELF_JUSTIFYING_KINDS.has(region.contentKind)) {
      const hasListLikeContent = region.contentKind === "list" || region.contentKind === "form";
      if (!hasListLikeContent) {
        diagnostics.push({
          code: "contentless_region_clamped",
          regionId: region.id,
          detail: `A ${region.contentKind} region reserved ${minHPx}px without content that carries it; clamped to ${CONTENT_JUSTIFICATION_HEIGHT_PX}px.`,
        });
        minHPx = CONTENT_JUSTIFICATION_HEIGHT_PX;
        maxHPx = Math.max(maxHPx, minHPx);
      }
    }

    return { id: region.id, minHPx, maxHPx, priority: entry?.priority ?? priorityFor(region, index) };
  });

  const budgetById = new Map(budgetRegions.map((region) => [region.id, region]));
  const suppliedAboveFold = (supplied?.aboveFoldRegionIds ?? []).filter((id) => budgetById.has(id));
  let aboveFold = suppliedAboveFold.length > 0
    ? [...suppliedAboveFold]
    : budgetRegions.slice(0, Math.min(2, budgetRegions.length)).map((region) => region.id);

  if (suppliedAboveFold.length === 0) {
    diagnostics.push({
      code: "budget_derived",
      regionId: null,
      detail: "Planner supplied no above-fold selection; the first two regions were used.",
    });
  }

  // The first fold is a fixed resource. Demote the lowest-priority regions
  // until the declared minimums actually fit inside it.
  const reserve = CHROME_RESERVE_PX + (navigationEnabled ? SHARED_NAV_RESERVE_PX : 0);
  const available = MOBILE_FRAME_HEIGHT_PX - reserve;
  const total = () => aboveFold.reduce((sum, id) => sum + (budgetById.get(id)?.minHPx ?? 0), 0);

  while (aboveFold.length > 1 && total() > available) {
    const demoted = [...aboveFold].sort((left, right) => {
      const leftPriority = PRIORITY_ORDER[budgetById.get(left)!.priority];
      const rightPriority = PRIORITY_ORDER[budgetById.get(right)!.priority];
      if (leftPriority !== rightPriority) return rightPriority - leftPriority;
      return aboveFold.indexOf(right) - aboveFold.indexOf(left);
    })[0];
    aboveFold = aboveFold.filter((id) => id !== demoted);
    diagnostics.push({
      code: "region_demoted_below_fold",
      regionId: demoted,
      detail: `Above-fold minimums exceeded the ${available}px available in the first fold; this region moves below it.`,
    });
  }

  return {
    frameHeightPx: MOBILE_FRAME_HEIGHT_PX,
    aboveFoldRegionIds: aboveFold,
    regions: budgetRegions,
  };
}

/**
 * Normalizes per-region content contracts. Any multi-column arrangement is
 * forced to declare sibling balance and a copy budget, because "two cards in a
 * row" without those two facts is the single most reliable way to produce a
 * ragged, half-empty row.
 */
export function resolveRegionContracts({
  supplied,
  regions,
  diagnostics,
}: {
  supplied?: Array<Partial<ScreenRegionContract>> | null;
  regions: ScreenLayoutRegion[];
  diagnostics: LayoutBudgetDiagnostic[];
}): ScreenRegionContract[] {
  const regionIds = new Set(regions.map((region) => region.id));
  const byId = new Map(
    (supplied ?? [])
      .filter((entry): entry is Partial<ScreenRegionContract> & { id: string } => {
        if (entry?.id && regionIds.has(entry.id)) return true;
        if (entry?.id) {
          diagnostics.push({
            code: "unknown_region_dropped",
            regionId: entry.id,
            detail: "Region contract does not match any declared layout region.",
          });
        }
        return false;
      })
      .map((entry) => [entry.id, entry]),
  );

  return regions.map((region) => {
    const entry = byId.get(region.id);
    const arrangement: ScreenRegionArrangement = entry?.arrangement ?? derivedArrangementFor(region);
    const isMultiItem = MULTI_ITEM_ARRANGEMENTS.has(arrangement);

    let siblingBalance: ScreenSiblingBalance = entry?.siblingBalance ?? "equal-height";
    if (isMultiItem && siblingBalance !== "equal-height") {
      diagnostics.push({
        code: "sibling_balance_defaulted",
        regionId: region.id,
        detail: `A ${arrangement} region cannot use independent sibling heights; items in one row are read as a set.`,
      });
      siblingBalance = "equal-height";
    }
    if (!entry?.siblingBalance && isMultiItem) {
      diagnostics.push({
        code: "sibling_balance_defaulted",
        regionId: region.id,
        detail: "Multi-column region did not declare sibling balance; defaulted to equal-height.",
      });
    }

    const itemCount = Math.max(1, Math.round(entry?.itemCount ?? (arrangement === "two-column" ? 2 : arrangement === "three-column" ? 3 : 1)));

    let copyBudget = entry?.copyBudget ?? null;
    if (!copyBudget && (isMultiItem || arrangement === "horizontal-scroll")) {
      copyBudget = DEFAULT_COPY_BUDGET_BY_ARRANGEMENT[arrangement] ?? DEFAULT_COPY_BUDGET_BY_ARRANGEMENT.single;
      diagnostics.push({
        code: "copy_budget_defaulted",
        regionId: region.id,
        detail: `A ${arrangement} region needs a copy budget so siblings cannot rag; defaulted to ${copyBudget.titleMaxChars} title chars and ${copyBudget.bodyMaxLines} body lines.`,
      });
    }

    return {
      id: region.id,
      arrangement,
      siblingBalance,
      itemCount,
      itemAnatomy: (entry?.itemAnatomy ?? []).filter((value): value is string => typeof value === "string" && value.trim().length > 0),
      copyBudget,
    };
  });
}

/** Renders the v3 contract for the builder prompt. */
export function formatLayoutBudgetContract({
  budget,
  regionContracts,
}: {
  budget?: ScreenViewportBudget | null;
  regionContracts?: ScreenRegionContract[] | null;
}): string | null {
  if (!budget && !regionContracts?.length) return null;

  const lines: string[] = [];

  if (budget) {
    lines.push(
      `- Vertical budget (${budget.frameHeightPx}px frame). Above the fold, in order: ${budget.aboveFoldRegionIds.join(" -> ") || "none declared"}.`,
      ...budget.regions.map((region) =>
        `  - ${region.id}: ${region.minHPx}-${region.maxHPx}px, ${region.priority}.`),
      "- Stay inside these heights. If content will not fit, cut copy or move it below the fold; do not grow the region.",
    );
  }

  for (const contract of regionContracts ?? []) {
    const parts = [`  - ${contract.id}: ${contract.arrangement}`];
    if (contract.itemCount > 1) parts.push(`${contract.itemCount} items`);
    if (contract.siblingBalance === "equal-height" && contract.itemCount > 1) {
      parts.push("equal height, identical internal anatomy in every item");
    }
    if (contract.itemAnatomy.length > 0) parts.push(`anatomy: ${contract.itemAnatomy.join(" / ")}`);
    if (contract.copyBudget) {
      parts.push(`title <= ${contract.copyBudget.titleMaxChars} chars, body <= ${contract.copyBudget.bodyMaxLines} lines`);
    }
    lines.push(parts.join("; ") + ".");
  }

  if ((regionContracts ?? []).some((contract) => contract.itemCount > 1 && contract.siblingBalance === "equal-height")) {
    lines.push(
      "- In an equal-height region every item uses the same media aspect ratio, the same element order, and the same number of text lines. Never offset one item vertically to fake asymmetry, and never give siblings different media heights.",
    );
  }

  return lines.length > 0 ? lines.join("\n") : null;
}
