import "server-only";
import { z } from "zod";
import { load } from "cheerio";
import { generateScreenBuilderContent } from "@/lib/ai/provider";
import { buildTokenPromptContext } from "@/lib/token-runtime";
import { extractKitNavigation } from "./kit-navigation-extraction";
import {
  defaultNavigationDesignContract, lucideIconName, minimumNavigationItems, renderDeterministicNavigationShell,
  sanitizeScreenCodeForSharedNavigation, validateNavigationShell,
} from "@/lib/project-navigation";
import { DRAWGLE_GENERATION_COMPLETE_SENTINEL, normalizeStaticDrawgleHtml, stripGenerationCompleteSentinel, validateSourceCompletion } from "./screen-quality";
import type { DesignTokens, NavigationPlan, ProjectCharter } from "@/lib/types";

export type NavigationDesignScreen = {
  id: string; name: string; code: string;
  /** What the screen is for, from the roadmap. */
  role?: string | null;
  navigationItemId?: string | null;
  chrome?: string | null;
  parentScreenId?: string | null;
};
export type NavigationRoadmapScreen = { name: string; description: string | null };
export type NavigationDesignContext = {
  prompt: string;
  designTokens: DesignTokens | null;
  projectCharter: ProjectCharter | null;
  screens: NavigationDesignScreen[];
  /** Screens the product plans but has not built: candidates for a tab before their screen exists. */
  plannedScreens?: NavigationRoadmapScreen[];
  currentShellCode?: string;
};
/** create: the project's first bar. restyle: an edit of the current bar's look. redesign: a new bar, tabs included. */
export type NavigationDesignMode = "create" | "restyle" | "redesign";
/** The designer's own account of what it made, shown to the person as the edit's card. */
export type NavigationDesignNotes = { title: string | null; summary: string | null };
export type NavigationDesignResult = { plan: NavigationPlan; notes: NavigationDesignNotes };

const MAX_DESTINATIONS = 5;
const FILLER_LABEL = /^(?:tab|item|menu|page|section|destination)(?:\s*\d+)?$/i;

const parseJson = (text: string) => JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
const appearance = (html: string) => {
  const $ = load(html, {}, false);
  return $("*").map((_, node) => `${"tagName" in node ? node.tagName : ""}:${$(node).attr("class") ?? ""}:${$(node).attr("style") ?? ""}`).get().join("|");
};
const actionIcons = (html: string) => {
  const $ = load(html, {}, false);
  return $("[data-lucide]").map((_, node) => $(node).attr("data-lucide")).get().sort().join(",");
};
const clip = (value: unknown, limit: number) => {
  const text = typeof value === "string" ? value.trim() : value == null ? "" : JSON.stringify(value);
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
};
const line = (label: string, value: unknown, limit: number) => {
  const text = clip(value, limit);
  return text && text !== "null" && text !== "[]" && text !== "{}" ? `${label}: ${text}` : "";
};
const destinationsJson = (plan: NavigationPlan) =>
  JSON.stringify(plan.items.map(({ id, label, icon, role, linkedScreenName }) => ({ id, label, icon, role, linkedScreenName })));

/** A tab must open a top-level screen: not a state of another screen, and not a detail or form reached by going back. */
const canBeTab = (screen: NavigationDesignScreen) => !screen.parentScreenId && screen.chrome !== "top-bar-back" && screen.chrome !== "modal-sheet";

/** What decides which tabs belong in the bar: what the app is for, what is built, and what is planned. */
export function navigationProductBrief(context: NavigationDesignContext, plan: NavigationPlan | null) {
  const charter = context.projectCharter;
  const tab = (screen: NavigationDesignScreen) => plan?.items.find(item => item.id === screen.navigationItemId)?.label;
  const built = context.screens.filter(screen => !screen.parentScreenId).map(screen => [
    `- ${screen.name}`,
    screen.role ? `: ${clip(screen.role, 160)}` : "",
    tab(screen) ? ` (opens from the ${tab(screen)} tab)` : canBeTab(screen) ? " (top-level, no tab)" : " (detail or form, never a tab)",
  ].join(""));
  const planned = (context.plannedScreens ?? []).map(screen => `- ${screen.name}${screen.description ? `: ${clip(screen.description, 160)}` : ""}`);
  return [
    line("App", charter?.appType, 300),
    line("Audience", charter?.targetAudience, 200),
    line("Key features", charter?.keyFeatures?.join("; "), 600),
    line("Why it has a bottom bar", charter?.navigationArchitecture?.rationale, 400),
    `Built screens:\n${built.join("\n") || "- none"}`,
    planned.length ? `Planned screens, not built yet:\n${planned.join("\n")}` : "",
  ].filter(Boolean).join("\n");
}

/** The project's visual language in its own words; the full charter is mostly planning data the bar does not need. */
const styleBrief = (charter: ProjectCharter | null) => [
  line("Design signals", charter?.designSystemSignals, 1400),
  line("Design rationale", charter?.designRationale, 700),
  line("Visual direction", charter?.imageReferenceSummary, 500),
  line("Creative direction", charter?.creativeDirection, 900),
  line("Design style", charter?.designStyle, 900),
].filter(Boolean).join("\n");

/** The screens the bar sits on, without any bar of their own, so their content is the evidence and not an old nav. */
const screenEvidence = (screens: NavigationDesignScreen[]) => {
  const evidence = screens.filter(screen => !screen.parentScreenId)
    .sort((a, b) => Number(Boolean(b.navigationItemId)) - Number(Boolean(a.navigationItemId)))
    .slice(0, 2);
  return evidence.map(screen => {
    const code = sanitizeScreenCodeForSharedNavigation(screen.code, { name: screen.name, type: "root", description: "" }, { projectNavigationEnabled: true });
    return `Screen the bar sits on (${screen.name}):\n${code.slice(0, 12000)}`;
  });
};

const rootClasses = (html: string) => load(html, {}, false).root().children().first().attr("class") ?? "";
/** The rejected bar in a sentence: enough to steer away from, without handing over markup to copy. */
const describeCurrentBar = (plan: NavigationPlan) => {
  const design = plan.design;
  const tabs = `${plan.items.length} tabs (${plan.items.map(item => item.label).join(", ")})`;
  if (design?.kit) return `a custom bar with ${tabs}; bar classes "${rootClasses(design.kit.bar)}"; active tab classes "${rootClasses(design.kit.activeItem)}"`;
  if (!design) return `a plain default bar with ${tabs}`;
  return `a ${design.anatomy} bar with ${tabs}, a ${design.surface} surface, labels ${design.labels}, and a ${design.activeTreatment} active tab`;
};

const destinationSchema = z.object({
  id: z.string().trim().regex(/^[a-z0-9-]+$/).max(40),
  label: z.string().trim().min(1).max(18),
  icon: z.string().trim().min(1).max(60),
  role: z.string().trim().min(1).max(160),
  linkedScreenName: z.string().trim().min(1).nullable().optional(),
});

/**
 * Checks proposed tabs against the project. Destinations that open a built screen are kept unless removal is
 * allowed (an explicit tab change), and a redesign keeps their labels and icons. New tabs open a built top-level
 * screen or wait, planned, for theirs.
 */
export function acceptDestinations(proposed: unknown, plan: NavigationPlan, screens: NavigationDesignScreen[], mode: "redesign" | "destinations"): NavigationPlan["items"] {
  const parsed = z.array(destinationSchema).safeParse(proposed);
  if (!parsed.success) throw new Error("Return destinations as an array of {id, label, icon, role, linkedScreenName}, with kebab-case ids and labels of at most 18 characters.");
  const minimum = minimumNavigationItems(plan.decision, plan.version, plan.evidence?.source);
  if (parsed.data.length < minimum || parsed.data.length > MAX_DESTINATIONS) throw new Error(`Use between ${minimum} and ${MAX_DESTINATIONS} destinations.`);
  if (mode === "redesign") {
    const dropped = plan.items.find(item => item.linkedScreenName && item.availability !== "planned" && !parsed.data.some(next => next.id === item.id));
    if (dropped) throw new Error(`Keep the ${dropped.label} destination (id ${dropped.id}); it opens the built ${dropped.linkedScreenName} screen.`);
  }
  const items = parsed.data.map((next): NavigationPlan["items"][number] => {
    const existing = plan.items.find(item => item.id === next.id);
    if (existing && mode === "redesign") return existing;
    const linkName = existing?.linkedScreenName ?? next.linkedScreenName ?? null;
    const screen = linkName ? screens.find(candidate => candidate.name === linkName) : null;
    if (linkName && !screen) throw new Error(`"${linkName}" is not a built screen. Use linkedScreenName null for a destination whose screen is not built yet.`);
    if (screen && screen.name !== existing?.linkedScreenName && !canBeTab(screen)) throw new Error(`${screen.name} is a detail, form or state screen and cannot be a tab.`);
    if (FILLER_LABEL.test(next.label)) throw new Error(`"${next.label}" is a filler label; name the product area.`);
    return {
      id: next.id, label: next.label, icon: lucideIconName(next.icon), role: next.role,
      linkedScreenName: screen?.name ?? null, availability: screen ? "generated" : "planned",
    };
  });
  const unique = (values: string[]) => new Set(values).size === values.length;
  if (!unique(items.map(item => item.id)) || !unique(items.map(item => item.label.toLowerCase()))) throw new Error("Destination ids and labels must be unique.");
  if (!unique(items.flatMap(item => item.linkedScreenName ? [item.linkedScreenName] : []))) throw new Error("Each built screen can open from one tab only.");
  return items;
}

const notesFrom = (value: unknown): NavigationDesignNotes => {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const text = (key: string, limit: number) => typeof record[key] === "string" && record[key] ? clip(record[key], limit) : null;
  return { title: text("title", 60), summary: text("summary", 300) };
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

const DESTINATION_RULES = [
  "Primary tabs are the top-level areas a person moves between often. Use the fewest that cover the product's main areas; add one only when the product clearly has that area (a built top-level screen, a planned screen, or a key feature), never to fill space.",
  "Never make a form, flow, detail screen, state, or one-off action (such as adding an item) a tab.",
  "A new destination is {\"id\": new kebab-case id, \"label\": at most 18 characters, \"icon\": a Lucide icon name in kebab case, \"role\": what the area is for, \"linkedScreenName\": the exact name of a built top-level screen with no tab, or null when its screen is not built yet}.",
];

const CRAFT_RULES = [
  "Make it belong to this product. Study the screens first: where their strongest contrast sits, how the accent colour is used (fills, rings, chips), the shape language and radii, how icon buttons and controls are drawn, and how surfaces separate (tone, borders, shadow). Build the bar and its active tab out of those same moves, so it looks drawn with the screens rather than added to them.",
  "Commit to one clear idea for the active tab (for example the screens' accent as a filled shape behind the icon, an expanding labelled capsule, or an inverted pill), so the current tab is obvious at a glance. Inactive tabs are quiet but readable.",
  "The bar floats over screen content: keep it compact, give its tabs generous room, and give it a surface that separates from the screen behind it. Labels may be always shown, shown only on the active tab, or omitted, whichever suits the product.",
  "A plain white rounded bar with grey icons and a faint grey highlight behind the active one is the generic default; do not settle for it.",
];

/**
 * Designs the shared bar's appearance, and in a redesign also which tabs the app needs. A create or restyle keeps the
 * saved destinations, labels and icons; a redesign may add tabs and reorder them, but keeps the ones that open built
 * screens. The renderer, not the model, places the bar and moves the active tab per screen.
 */
export async function redesignNavigation(context: NavigationDesignContext, plan: NavigationPlan, mode: NavigationDesignMode): Promise<NavigationDesignResult> {
  const previousKit = plan.design?.kit;
  const independentActions = previousKit ? actionIcons(previousKit.bar) : "";
  const reviewDestinations = mode === "redesign";
  const modeRules = mode === "restyle" ? [
    "This is an edit of the current bar shown below. Make the requested change clearly visible and keep what the request does not touch. Do not add, remove, rename, reorder or re-icon destinations.",
  ] : mode === "redesign" ? [
    `This is a redesign. The person rejected the current bar: ${describeCurrentBar(plan)}. Make a different composition, surface and active treatment, not a variation of it.`,
    "Decide which tabs this app's bar should have, from the product brief. Keep every current destination that opens a built screen, with its id, label and icon; you may reorder destinations and add new ones.",
    ...DESTINATION_RULES,
    "List \"destinations\" in nav-notes in the order the tabs appear, and draw one tab for each.",
  ] : [
    "This project has no shared bar yet; design its first one for the destinations below. Do not add, remove, rename, reorder or re-icon them.",
  ];
  const systemInstruction = [
    "You design the ONE shared bottom navigation bar of a mobile app, as static HTML that appears at the bottom of every main screen.",
    `Output exactly, in order: <nav-notes>{"title": "a 2-6 word name for the design", "summary": "one sentence on what you made and why it suits this app"${reviewDestinations ? ', "destinations": [...]' : ""}}</nav-notes>, then one <nav data-dg-nav="bar"> element, then ${DRAWGLE_GENERATION_COMPLETE_SENTINEL}.`,
    "The <nav> has no screen content, scripts, style tags, markdown, or fixed, absolute or sticky positioning; the renderer places it.",
    "Destination tabs are sibling elements marked data-dg-nav-item=\"exact label\", in destination order. Mark exactly one data-active=\"true\" and draw it in the active appearance; draw the others in the inactive appearance. The renderer copies these two appearances to every tab and moves the active one per screen, so every tab shares one structure with touch targets at least 44px. Icons are <i data-lucide=\"icon-name\"> with each destination's icon.",
    independentActions ? `The current bar also has independent action buttons (icons: ${independentActions}). Keep them, with those icons, outside the tabs.` : "Do not add action buttons that are not destinations.",
    "Use the project's token utility classes and Tailwind classes. Every colour comes from the project's palette.",
    ...CRAFT_RULES,
    ...modeRules,
  ].join("\n");

  let feedback = "";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const output = await generateScreenBuilderContent({
      task: "navigation_build",
      contents: [
        `Request: ${context.prompt}`,
        `Product brief:\n${navigationProductBrief(context, plan)}`,
        `${reviewDestinations ? "Current destinations" : "Destinations"}: ${destinationsJson(plan)}`,
        line("Original direction for the bar", plan.visualBrief, 400),
        styleBrief(context.projectCharter),
        buildTokenPromptContext(context.designTokens, "compact_visual"),
        mode === "restyle" ? `Current bar:\n${context.currentShellCode || renderDeterministicNavigationShell(plan)}` : "",
        ...screenEvidence(context.screens),
        feedback,
      ].filter(Boolean).join("\n\n"),
      // No temperature override: like the screen build, Gemini 3 forced below its default collapses into the most
      // common, dated designs, which for a bar is the generic one this redesign exists to replace.
      configOverride: { systemInstruction },
    });
    try {
      const notesMatch = /<nav-notes>([\s\S]*?)<\/nav-notes>/i.exec(output);
      let rawNotes: unknown = null;
      try { rawNotes = notesMatch ? parseJson(notesMatch[1]) : null; } catch { rawNotes = null; }
      if (reviewDestinations && !rawNotes) throw new Error("Start with <nav-notes> holding valid JSON that includes the destinations.");
      const items = reviewDestinations
        ? acceptDestinations((rawNotes as Record<string, unknown>).destinations, plan, context.screens, "redesign")
        : plan.items;
      const code = output.replace(/<nav-notes>[\s\S]*?<\/nav-notes>/i, "");
      const completion = validateSourceCompletion({ code, requireSentinel: true });
      if (!completion.valid) throw new Error("The navigation output was incomplete.");
      const normalized = normalizeStaticDrawgleHtml(stripGenerationCompleteSentinel(code));
      if (!normalized.valid) throw new Error("The navigation output was not valid static HTML.");
      const kit = extractKitNavigation(normalized.code).navigation;
      if (!kit) throw new Error("The navigation did not expose reusable active and inactive tabs.");
      if (previousKit) {
        const changedParts = (Object.keys(kit) as Array<keyof typeof kit>).filter(key => appearance(kit[key]) !== appearance(previousKit[key])).length;
        if (changedParts < (mode === "redesign" ? 2 : 1)) throw new Error("The requested redesign did not materially change the navigation's composition and tab treatment.");
        if (actionIcons(kit.bar) !== independentActions) throw new Error("Preserve the existing independent navigation actions and their icons.");
      }
      const next = { ...plan, version: 2 as const, items, design: { ...(plan.design ?? defaultNavigationDesignContract()), kit } };
      if (!validateNavigationShell(renderDeterministicNavigationShell(next), next)) throw new Error("The navigation failed destination validation.");
      return { plan: next, notes: notesFrom(rawNotes) };
    } catch (error) {
      feedback = `Correct this problem in your replacement: ${error instanceof Error ? error.message : "Invalid navigation"}`;
      if (attempt === 1) throw error;
    }
  }
  throw new Error("Could not produce a valid shared navigation design.");
}

/** A specific tab change (add, remove, rename, reorder, re-icon). Only the destinations change; the bar keeps its look. */
export async function reviseNavigationDestinations(context: NavigationDesignContext, plan: NavigationPlan): Promise<NavigationDesignResult> {
  let feedback = "";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const output = await generateScreenBuilderContent({
      task: "navigation_build",
      contents: [
        `Request: ${context.prompt}`,
        `Product brief:\n${navigationProductBrief(context, plan)}`,
        `Current destinations: ${destinationsJson(plan)}`,
        feedback,
      ].filter(Boolean).join("\n\n"),
      configOverride: { temperature: 0.2, systemInstruction: [
        "You maintain the tabs of an app's shared bottom navigation. Return JSON only: {\"title\": \"a 2-6 word name for the change\", \"summary\": \"one sentence on what changed\", \"destinations\": [...]}.",
        "Apply exactly the requested tab change. Keep every other destination as it is, with the same id, label, icon and linkedScreenName, in the same order unless reordering was asked.",
        ...DESTINATION_RULES,
      ].join("\n") },
    });
    try {
      let raw: unknown;
      try { raw = parseJson(output); } catch { throw new Error("Return valid JSON only."); }
      const items = acceptDestinations((raw as Record<string, unknown>)?.destinations, plan, context.screens, "destinations");
      const next = { ...plan, items };
      if (!validateNavigationShell(renderDeterministicNavigationShell(next), next)) throw new Error("The navigation failed destination validation.");
      return { plan: next, notes: notesFrom(raw) };
    } catch (error) {
      feedback = `Correct this problem in your replacement: ${error instanceof Error ? error.message : "Invalid destinations"}`;
      if (attempt === 1) throw error;
    }
  }
  throw new Error("Could not update the navigation tabs.");
}
