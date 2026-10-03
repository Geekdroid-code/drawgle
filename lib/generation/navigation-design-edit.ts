import "server-only";
import { z } from "zod";
import { load } from "cheerio";
import { generateScreenBuilderContent } from "@/lib/ai/provider";
import { buildTokenPromptContext } from "@/lib/token-runtime";
import { extractKitNavigation } from "./kit-navigation-extraction";
import { defaultNavigationDesignContract, renderDeterministicNavigationShell, validateNavigationShell } from "@/lib/project-navigation";
import { DRAWGLE_GENERATION_COMPLETE_SENTINEL, normalizeStaticDrawgleHtml, stripGenerationCompleteSentinel, validateSourceCompletion } from "./screen-quality";
import type { DesignTokens, NavigationPlan, ProjectCharter } from "@/lib/types";
import { navigationEditIntent } from "@/lib/navigation-edit-intent";

export type NavigationDesignContext = {
  prompt: string;
  designTokens: DesignTokens | null;
  projectCharter: ProjectCharter | null;
  screens: Array<{ id: string; name: string; code: string }>;
  currentShellCode?: string;
};
const parseJson = (text: string) => JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
const appearance = (html: string) => {
  const $ = load(html, {}, false);
  return $("*").map((_, node) => `${"tagName" in node ? node.tagName : ""}:${$(node).attr("class") ?? ""}:${$(node).attr("style") ?? ""}`).get().join("|");
};
const actionIcons = (html: string) => {
  const $ = load(html, {}, false);
  return $("[data-lucide]").map((_, node) => $(node).attr("data-lucide")).get().sort().join(",");
};

/** Resolve semantic tab membership; the output can only reference the supplied screens and existing tab IDs. */
export async function resolveNavigationMembership(context: NavigationDesignContext, plan: NavigationPlan | null, targetScreenIds: string[]) {
  const result = await generateScreenBuilderContent({
    task: "navigation_build",
    contents: JSON.stringify({ request: context.prompt, charter: context.projectCharter,
      existingItems: plan?.items ?? null, screens: context.screens.map(({ id, name }) => ({ id, name })), targetScreenIds }),
    configOverride: { temperature: 0.1, systemInstruction: [
      "Resolve shared bottom navigation destinations. Return JSON only: {items:[{id,label,icon,role,linkedScreenName}], assignments:[{screenId,itemId}]}.",
      "If existingItems is supplied, copy it exactly; NEVER rename, reorder, add, remove, or change any icon. Assign requested screens to the closest semantic existing tab. A secondary screen may belong to a tab without replacing that tab's root destination.",
      "Otherwise create 3-5 meaningful product destinations grounded in the project and requested screens; use kebab-case Lucide icon names and stable lowercase IDs. Do not turn every detail screen into a tab. linkedScreenName is an exact supplied screen name or null for a planned destination.",
      "Return assignments for targetScreenIds only. If a screen's destination is genuinely ambiguous, omit its assignment. Never assign arbitrarily just to complete the result.",
    ].join("\n") },
  });
  const schema = z.object({
    items: plan ? z.unknown() : z.array(z.object({ id: z.string().regex(/^[a-z0-9-]+$/), label: z.string().min(1).max(40), icon: z.string().regex(/^[a-z0-9-]+$/), role: z.string(), linkedScreenName: z.string().nullable() })).min(3).max(5),
    assignments: z.array(z.object({ screenId: z.string(), itemId: z.string() })),
  });
  const parsed = schema.parse(parseJson(result));
  const items = plan?.items ?? (parsed.items as NavigationPlan["items"]).map(item => ({ ...item, availability: item.linkedScreenName ? "generated" as const : "planned" as const }));
  if (new Set(items.map(item => item.id)).size !== items.length
    || (!plan && items.some(item => item.linkedScreenName && !context.screens.some(screen => screen.name === item.linkedScreenName)))) {
    throw new Error("The navigation destinations could not be matched to this project.");
  }
  const assignments = targetScreenIds.map(screenId => {
    const matches = parsed.assignments.filter(item => item.screenId === screenId && items.some(tab => tab.id === item.itemId));
    if (matches.length !== 1) throw new Error("I found the shared navigation, but could not determine which tab this screen belongs to. Specify the active tab.");
    return matches[0];
  });
  return { items, assignments };
}

/** Only the appearance is generated. Destinations and icons remain owned by the saved plan. */
export async function redesignNavigation(context: NavigationDesignContext, plan: NavigationPlan): Promise<NavigationPlan> {
  let feedback = "";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const output = await generateScreenBuilderContent({
      task: "navigation_build",
      contents: [
        `Request: ${context.prompt}`,
        `Project style: ${JSON.stringify(context.projectCharter)}`,
        buildTokenPromptContext(context.designTokens, "compact_visual"),
        `Stable destinations: ${JSON.stringify(plan.items)}`,
        `Current bar: ${context.currentShellCode || renderDeterministicNavigationShell(plan)}`,
        ...context.screens.slice(0, 2).map(screen => `Screen style evidence (${screen.name}):\n${screen.code.slice(0, 12000)}`),
        feedback,
      ].join("\n\n"),
      configOverride: { temperature: 0.45, systemInstruction: [
        "Design ONLY the project's shared bottom navigation, as static HTML. Return one <nav data-dg-nav=\"bar\"> and no screen content, scripts, style tags, markdown or fixed positioning.",
        "Use project token utility classes and Tailwind classes, matching the screen's colors, typography, shape language and density. No arbitrary new palette.",
        "All destination buttons must be siblings, marked data-dg-nav-item=\"exact label\". Mark one data-active=\"true\" with its active appearance; draw the others with the inactive appearance. Use <i data-lucide=\"saved-icon\"> for icons. Do not add or change destinations, icons, order, or independent action buttons.",
        "A redesign request (new, premium, modern, better) requires a visible change in composition, spacing, surface and active treatment appropriate to this product. Returning the old bar with minor class changes is not a redesign. For a specific small edit, preserve unrelated styling.",
        "Give all destinations the same reusable tab structure, with balanced touch targets at least 44px high. Labels may be always visible, active-only or omitted to suit the request. The renderer applies the active style to the correct tab on each screen.",
        `Finish with ${DRAWGLE_GENERATION_COMPLETE_SENTINEL}`,
      ].join("\n") },
    });
    try {
      const completion = validateSourceCompletion({ code: output, requireSentinel: true });
      if (!completion.valid) throw new Error("The navigation output was incomplete.");
      const normalized = normalizeStaticDrawgleHtml(stripGenerationCompleteSentinel(output));
      if (!normalized.valid) throw new Error("The navigation output was not valid static HTML.");
      const kit = extractKitNavigation(normalized.code).navigation;
      if (!kit) throw new Error("The navigation did not expose reusable active and inactive tabs.");
      const previousKit = plan.design?.kit;
      if (previousKit) {
        const changedParts = (Object.keys(kit) as Array<keyof typeof kit>).filter(key => appearance(kit[key]) !== appearance(previousKit[key])).length;
        const minimumChanges = navigationEditIntent(context.prompt, true) === "redesign" ? 2 : 1;
        if (changedParts < minimumChanges) throw new Error("The requested redesign did not materially change the navigation's composition and tab treatment.");
        if (actionIcons(kit.bar) !== actionIcons(previousKit.bar)) throw new Error("Preserve the existing independent navigation actions and their icons.");
      }
      const next = { ...plan, version: 2 as const, design: { ...(plan.design ?? defaultNavigationDesignContract()), kit } };
      if (!validateNavigationShell(renderDeterministicNavigationShell(next), next)) throw new Error("The navigation failed destination validation.");
      return next;
    } catch (error) {
      feedback = `Correct this problem in your replacement: ${error instanceof Error ? error.message : "Invalid navigation"}`;
      if (attempt === 1) throw error;
    }
  }
  throw new Error("Could not produce a valid shared navigation design.");
}
