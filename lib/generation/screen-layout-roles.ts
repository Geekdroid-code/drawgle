import { load } from "cheerio";

import { validateProductRequirementCoverage } from "@/lib/generation/product-contract";
import { findSourceContentQuarantineLeaks } from "@/lib/generation/reference-transfer";
import type { ScreenPlan } from "@/lib/types";

export type ScreenLayoutRoleIssueCode =
  | "missing_content_rail"
  | "duplicate_content_rail"
  | "missing_section_stack"
  | "duplicate_section_stack"
  | "section_stack_not_flow"
  | "missing_planned_region"
  | "duplicate_planned_region"
  | "empty_planned_region"
  | "product_requirement_coverage"
  | "source_content_leak";

export type ScreenLayoutRoleResult = {
  code: string;
  valid: boolean;
  changed: boolean;
  issues: string[];
  codes: ScreenLayoutRoleIssueCode[];
};

type SelectedNode = {
  attr(name: string): string | undefined;
  attr(name: string, value: string): unknown;
  find(selector: string): { length: number };
  text(): string;
};

const addClass = (node: SelectedNode, className: string) => {
  const classes = new Set((node.attr("class") ?? "").split(/\s+/).filter(Boolean));
  const before = classes.size;
  classes.add(className);
  node.attr("class", [...classes].join(" "));
  return classes.size !== before;
};

const hasMeaningfulContent = (node: SelectedNode) =>
  node.text().replace(/\s+/g, " ").trim().length >= 2
  || node.find("img,svg,canvas,video,[role='img'],i[data-lucide]").length > 0;

const visibleText = ($: ReturnType<typeof load>) => {
  const copy = $.root().clone();
  copy.find("style,script").remove();
  const attributeCopy: string[] = [];
  copy.find("[aria-label],[placeholder],[alt],[title]").each((_index, element) => {
    const node = $(element);
    for (const attribute of ["aria-label", "placeholder", "alt", "title"]) {
      const value = node.attr(attribute);
      if (value) attributeCopy.push(value);
    }
  });
  return `${copy.text()} ${attributeCopy.join(" ")}`.replace(/\s+/g, " ").trim().toLowerCase();
};

const allowedProductText = (screenPlan: ScreenPlan) => {
  const targetLanguage = [
    screenPlan.name,
    screenPlan.productContract?.userJob,
    screenPlan.productContract?.entryCondition,
    screenPlan.productContract?.actionOutcome,
    screenPlan.productContract?.nextStep,
    ...(screenPlan.productContract?.requirements.map((requirement) => requirement.purpose) ?? []),
  ].filter(Boolean).join(" ").toLowerCase();

  return targetLanguage;
};

/**
 * Narrow deterministic normalizer for newly generated screens. It only adds
 * the two canonical spacing utility classes to explicitly marked containers;
 * it never guesses a wrapper, rewrites layout, or mutates arbitrary margins.
 */
export const normalizeAndValidateScreenLayoutRoles = ({
  code,
  screenPlan,
}: {
  code: string;
  screenPlan: ScreenPlan;
}): ScreenLayoutRoleResult => {
  if (process.env.DRAWGLE_LAYOUT_ROLE_ENFORCEMENT_DISABLED === "true" || !screenPlan.productContract) {
    return { code, valid: true, changed: false, issues: [], codes: [] };
  }

  const $ = load(code, {}, false);
  const issues: string[] = [];
  const codes: ScreenLayoutRoleIssueCode[] = [];
  let changed = false;
  const report = (issueCode: ScreenLayoutRoleIssueCode, message: string) => {
    codes.push(issueCode);
    issues.push(message);
  };

  const rails = $("[data-drawgle-content-rail='true']");
  if (rails.length === 0) report("missing_content_rail", "Missing data-drawgle-content-rail=\"true\" on the normal-width content rail.");
  else if (rails.length > 1) report("duplicate_content_rail", `Expected one content rail marker; found ${rails.length}.`);
  else changed = addClass(rails.eq(0), "dg-screen-padding") || changed;

  const stacks = $("[data-drawgle-section-stack='true']");
  if (stacks.length === 0) report("missing_section_stack", "Missing data-drawgle-section-stack=\"true\" on the macro-section parent.");
  else if (stacks.length > 1) report("duplicate_section_stack", `Expected one section stack marker; found ${stacks.length}.`);
  else {
    const stack = stacks.eq(0);
    const className = stack.attr("class") ?? "";
    const style = stack.attr("style") ?? "";
    const classes = new Set(className.split(/\s+/).filter(Boolean));
    const verticalFlow = classes.has("grid")
      || classes.has("flex") && classes.has("flex-col")
      || /display\s*:\s*grid/i.test(style)
      || /display\s*:\s*flex/i.test(style) && /flex-direction\s*:\s*column/i.test(style);
    if (!verticalFlow) report("section_stack_not_flow", "The section stack marker must use a vertical flex/grid flow.");
    else changed = addClass(stack, "dg-section-gap") || changed;
  }

  const plannedRegions = screenPlan.layoutContract?.regions ?? [];
  for (const region of plannedRegions) {
    const nodes = $(`[data-drawgle-region="${region.id.replace(/"/g, "\\\"")}"]`);
    if (nodes.length === 0) report("missing_planned_region", `Missing planned region marker: ${region.id}.`);
    else if (nodes.length > 1) report("duplicate_planned_region", `Planned region ${region.id} appears ${nodes.length} times.`);
    else if (!hasMeaningfulContent(nodes.eq(0))) report("empty_planned_region", `Planned region ${region.id} has no meaningful visible content.`);
  }

  for (const issue of validateProductRequirementCoverage(screenPlan)) {
    report("product_requirement_coverage", issue);
  }

  const text = visibleText($);
  const leaked = findSourceContentQuarantineLeaks({
    text,
    contract: screenPlan.referenceTransfer,
    allowedProductText: allowedProductText(screenPlan),
  }).slice(0, 8);
  if (leaked.length > 0) {
    report("source_content_leak", `Source-reference content leaked into target copy: ${leaked.join(", ")}.`);
  }

  return {
    code: ($.root().html() ?? "").trim(),
    valid: issues.length === 0,
    changed,
    issues,
    codes: [...new Set(codes)],
  };
};
