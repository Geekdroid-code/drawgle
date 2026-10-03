import "server-only";
import { ensureDrawgleIds } from "@/lib/drawgle-dom";
import { replaceSelectedDrawgleElement } from "@/lib/drawgle-dom-server";
import { tokenizeStaticDrawgleHtml } from "@/lib/token-runtime";
import { validateNavigationShell } from "@/lib/project-navigation";
import { findRepairTarget } from "./screen-repair";
import { buildSourceRegionReplacementCode, editNavigationShellCode } from "./service";
import type { DesignTokens, NavigationPlan, ProjectCharter } from "@/lib/types";

/** Keep exact selected-element editing for older HTML shells; reuse/redesign use the shared component path. */
export async function editLegacyNavigation(input: {
  prompt: string; shell: string; plan: NavigationPlan; designTokens: DesignTokens | null;
  projectCharter: ProjectCharter | null; drawgleId?: string | null;
}) {
  const { prompt, plan, designTokens, projectCharter, drawgleId } = input;
  const shell = ensureDrawgleIds(input.shell, "dg-nav").code;
  let code: string;
  if (drawgleId) {
    const target = findRepairTarget({ code: shell, drawgleId, allowFallback: false });
    if (!target) throw new Error("The selected navigation element is stale. Reselect it before editing.");
    let rawReplacement = "";
    const replacement = await buildSourceRegionReplacementCode({
      screenName: "Navigation", screenPrompt: `Shared navigation plan: ${JSON.stringify(plan)}`,
      userPrompt: prompt, currentCode: shell, repairTarget: target, editOperation: "restyle_region",
      requiredRootDrawgleId: drawgleId, designTokens, projectCharter,
      navigationArchitecture: projectCharter?.navigationArchitecture,
      onRawResponse: raw => { rawReplacement = raw; },
    });
    code = replaceSelectedDrawgleElement({ sourceCode: shell, replacementHtml: replacement,
      rawReplacementHtml: rawReplacement || replacement, drawgleId }).code;
  } else {
    code = await editNavigationShellCode({ prompt, currentShellCode: shell, navigationPlan: plan, designTokens, projectCharter });
  }
  code = ensureDrawgleIds(tokenizeStaticDrawgleHtml(code, designTokens).code, "dg-nav").code;
  if (!validateNavigationShell(code, plan)) throw new Error("The edit would break the shared navigation; no changes were saved.");
  return code;
}
