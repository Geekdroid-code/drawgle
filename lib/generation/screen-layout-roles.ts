import { load } from "cheerio";

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
};

const addClass = (node: SelectedNode, className: string) => {
  const classes = new Set((node.attr("class") ?? "").split(/\s+/).filter(Boolean));
  const before = classes.size;
  classes.add(className);
  node.attr("class", [...classes].join(" "));
  return classes.size !== before;
};

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
 * Composition-neutral normalizer for newly generated screens. It only adds
 * canonical spacing utility classes to containers the builder explicitly
 * marks. Markers are optional and repeatable: absence or a different topology
 * is never a reason to reject an otherwise usable design.
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

  $("[data-drawgle-content-rail='true']").each((_index, element) => {
    changed = addClass($(element), "dg-screen-padding") || changed;
  });

  $("[data-drawgle-section-stack='true']").each((_index, element) => {
    changed = addClass($(element), "dg-section-gap") || changed;
  });

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
