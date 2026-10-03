import { DRAWGLE_TAILWIND_THEME_EXTEND, type TailwindThemeExtend } from "@/lib/drawgle-html-runtime";
import { KIT_TAB_STATE_RULE } from "@/lib/project-navigation";

/**
 * The export a person downloads, copies or reads in the code view carries only what its screen uses. The canvas
 * runtime ships every token, every dg class, the alias variables and the Tailwind config, because any screen may use
 * any of them and a token edit must reach every screen live. One exported screen needs a fraction of that.
 *
 * Nothing here renames anything: every class, variable and element the screen draws stays as generated, so the export
 * renders as the canvas does (scripts/export-fidelity checks it in Chromium). Only what nothing in the page refers to
 * is left out: :root variables nothing reaches, dg rules no element carries, Tailwind entries no class can use, data
 * attributes no rule, class or script reads, and the copy of each kit tab that its state hides.
 */

/** The contents of style, script and textarea elements, and comments, are text, not markup, and are never edited. */
const PROTECTED_REGION = /(<(style|script|textarea)\b[^>]*>)([\s\S]*?)(<\/\2\s*>)|<!--[\s\S]*?-->/gi;
const START_TAG = /<([A-Za-z][\w:-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)(\s*\/?)>/g;
const ATTRIBUTE = /\s+([^\s"'>/=]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'=<>`]+))?/g;
const CUSTOM_PROPERTY = /--[A-Za-z0-9_-]+/g;

type Attribute = { name: string; value: string | null; raw: string };

const decodeAttribute = (value: string) => value
  .replace(/^["']|["']$/g, "")
  .replace(/&quot;/g, "\"").replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

function mapOutsideProtected(html: string, map: (markup: string) => string) {
  let result = "";
  let last = 0;
  for (const region of html.matchAll(PROTECTED_REGION)) {
    const index = region.index ?? 0;
    // An element's own start tag is markup; only its contents are protected.
    result += map(html.slice(last, index)) + (region[1] === undefined ? region[0] : `${map(region[1])}${region[3]}${region[4]}`);
    last = index + region[0].length;
  }
  return result + map(html.slice(last));
}

/** Rewrites each start tag's attributes, leaving the rest of the markup byte for byte. */
function mapStartTags(html: string, map: (tag: string, attributes: Attribute[]) => Attribute[]) {
  return mapOutsideProtected(html, (markup) => markup.replace(START_TAG, (whole, tag: string, attributeText: string, close: string) => {
    const attributes = Array.from(attributeText.matchAll(ATTRIBUTE), (match) => ({
      name: match[1].toLowerCase(),
      value: match[2] === undefined ? null : decodeAttribute(match[2]),
      raw: match[0],
    }));
    const next = map(tag, attributes);
    if (next.length === attributes.length && next.every((attribute, index) => attribute === attributes[index])) return whole;
    return `<${tag}${next.map((attribute) => attribute.raw).join("")}${close}>`;
  }));
}

export type MarkupFacts = {
  classTokens: Set<string>;
  classValues: string[];
  ids: Set<string>;
  css: string;
  scripts: string;
};

/** What a page's markup refers to: its classes, ids, and the text of its own style and script elements. */
export function collectMarkupFacts(html: string): MarkupFacts {
  const facts: MarkupFacts = { classTokens: new Set(), classValues: [], ids: new Set(), css: "", scripts: "" };
  mapStartTags(html, (_tag, attributes) => {
    for (const attribute of attributes) {
      if (attribute.name === "class" && attribute.value) {
        facts.classValues.push(attribute.value);
        for (const token of attribute.value.split(/\s+/)) if (token) facts.classTokens.add(token);
      } else if (attribute.name === "id" && attribute.value) {
        facts.ids.add(attribute.value);
      }
    }
    return attributes;
  });
  for (const region of html.matchAll(/<(style|script)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi)) {
    if (region[1].toLowerCase() === "style") facts.css += `${region[2]}\n`;
    else facts.scripts += `${region[2]}\n`;
  }
  return facts;
}

/**
 * Sets each navigation tab's state as the canvas and the old export script did: data-active and aria-current on every
 * element with a data-nav-item-id, the current one "true" and "page".
 */
export function settleNavigationState(html: string, activeNavigationItemId: string) {
  return mapStartTags(html, (_tag, attributes) => {
    const item = attributes.find((attribute) => attribute.name === "data-nav-item-id");
    if (!item) return attributes;
    const active = (item.value ?? "") === activeNavigationItemId;
    return [
      ...attributes.filter((attribute) => attribute.name !== "data-active" && attribute.name !== "aria-current"),
      { name: "data-active", value: String(active), raw: ` data-active="${active}"` },
      { name: "aria-current", value: active ? "page" : "false", raw: ` aria-current="${active ? "page" : "false"}"` },
    ];
  });
}

/**
 * A kit tab is drawn as the current one and as another, and a rule hides the copy its state does not show. With the
 * state settled, the export writes the shown copy only and drops the rule. Without a DOM parser, or with a shell from an
 * older renderer, both copies and the rule stay, which renders the same.
 */
export function writeKitTabsOnce(navigationHtml: string) {
  if (!navigationHtml.includes(KIT_TAB_STATE_RULE) || typeof DOMParser === "undefined") return navigationHtml;
  const page = new DOMParser().parseFromString(`<!DOCTYPE html><html><body>${navigationHtml}</body></html>`, "text/html");
  for (const item of Array.from(page.querySelectorAll("[data-drawgle-primary-nav] .dg-nav-kit-item"))) {
    const hidden = item.getAttribute("data-active") === "true" ? "inactive" : "active";
    for (const copy of Array.from(item.children)) {
      if (copy.getAttribute("data-dg-nav-state") === hidden) copy.remove();
    }
  }
  for (const style of Array.from(page.querySelectorAll("style"))) {
    if (style.textContent?.includes(KIT_TAB_STATE_RULE)) style.textContent = style.textContent.replace(KIT_TAB_STATE_RULE, "");
  }
  return page.body.innerHTML;
}

/**
 * The project's theme for a developer handoff: every token and dg class, without the alias variables only the
 * canvas's Tailwind config reads and without the canvas frame's #root rule.
 */
export function buildHandoffThemeCss(tokenCss: string) {
  return trimTokenCss(tokenCss, {
    keepRule: (selector) => selector !== "#root",
    references: "",
    seed: (name) => name.startsWith("--dg-"),
  });
}

/** Pieces of a clean export page: the markup without unread attributes, its trimmed CSS and Tailwind config. */
export function trimExportPage({ screenHtml, navigationHtml, tokenCss, baseCss, scripts }: {
  screenHtml: string;
  navigationHtml: string;
  tokenCss: string;
  /** The page's own rules around the tokens (body, export root), which read some tokens too. */
  baseCss: string;
  /** Scripts the page adds after the markup. */
  scripts: string;
}) {
  const markup = `${screenHtml}\n${navigationHtml}`;
  const facts = collectMarkupFacts(markup);
  const theme = pickTailwindTheme(facts.classTokens);
  const trimmedTokenCss = trimTokenCss(tokenCss, {
    keepRule: (selector) => {
      if (selector === "#root") return facts.ids.has("root");
      const singleClass = /^\.([\w-]+)$/.exec(selector);
      return singleClass ? facts.classTokens.has(singleClass[1]) : true;
    },
    // The config's values name alias variables, so they count when the config stays.
    references: `${markup}\n${baseCss}\n${theme ? JSON.stringify(theme) : ""}`,
  });
  const keep = referencedDataAttributes({
    classValues: facts.classValues,
    css: `${facts.css}\n${trimmedTokenCss}\n${baseCss}`,
    scripts: `${facts.scripts}\n${scripts}`,
  });
  return {
    screenHtml: stripUnreadDataAttributes(screenHtml, keep),
    navigationHtml: stripUnreadDataAttributes(navigationHtml, keep),
    tokenCss: trimmedTokenCss,
    theme,
  };
}

/** Data attributes a rule, a Tailwind variant or a script reads. data-lucide names the icons Lucide draws. */
export function referencedDataAttributes(facts: Pick<MarkupFacts, "classValues" | "css" | "scripts">) {
  const names = new Set(["data-lucide"]);
  for (const match of facts.css.matchAll(/\[\s*(data-[\w-]+)/gi)) names.add(match[1].toLowerCase());
  for (const value of facts.classValues) {
    for (const match of value.matchAll(/data-\[([\w-]+)/g)) names.add(`data-${match[1]}`.toLowerCase());
    for (const match of value.matchAll(/\[(data-[\w-]+)/g)) names.add(match[1].toLowerCase());
  }
  for (const match of facts.scripts.matchAll(/data-[\w-]+/g)) names.add(match[0].toLowerCase());
  return names;
}

/** Removes data attributes nothing reads: asset provenance, navigation bookkeeping, editor markers. */
export function stripUnreadDataAttributes(html: string, keep: Set<string>) {
  return mapStartTags(html, (_tag, attributes) => {
    const next = attributes.filter((attribute) => !attribute.name.startsWith("data-") || keep.has(attribute.name));
    return next.length === attributes.length ? attributes : next;
  });
}

type CssBlock = { prelude: string; body: string; text: string };

/** Splits flat CSS into its top-level blocks, at-rules whole. Returns null for CSS it cannot read safely. */
export function splitCssBlocks(css: string): CssBlock[] | null {
  const blocks: CssBlock[] = [];
  let index = 0;
  while (index < css.length) {
    const open = css.indexOf("{", index);
    if (open < 0) return css.slice(index).replace(/\/\*[\s\S]*?\*\//g, "").trim() ? null : blocks;
    const start = index;
    let depth = 0;
    let quote: string | null = null;
    let cursor = open;
    for (; cursor < css.length; cursor += 1) {
      const character = css[cursor];
      if (quote) {
        if (character === "\\") cursor += 1;
        else if (character === quote) quote = null;
      } else if (character === "\"" || character === "'") quote = character;
      else if (character === "{") depth += 1;
      else if (character === "}" && --depth === 0) break;
    }
    if (depth !== 0) return null;
    const prelude = css.slice(start, open).replace(/\/\*[\s\S]*?\*\//g, "").trim();
    if (!prelude) return null;
    blocks.push({ prelude, body: css.slice(open + 1, cursor), text: css.slice(start, cursor + 1).trim() });
    index = cursor + 1;
  }
  return blocks;
}

function splitDeclarations(body: string) {
  const declarations: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let start = 0;
  for (let cursor = 0; cursor < body.length; cursor += 1) {
    const character = body[cursor];
    if (quote) {
      if (character === "\\") cursor += 1;
      else if (character === quote) quote = null;
    } else if (character === "\"" || character === "'") quote = character;
    else if (character === "(") depth += 1;
    else if (character === ")") depth -= 1;
    else if (character === ";" && depth === 0) {
      declarations.push(body.slice(start, cursor));
      start = cursor + 1;
    }
  }
  declarations.push(body.slice(start));
  return declarations.map((declaration) => declaration.trim()).filter(Boolean);
}

/**
 * Keeps the rules `keepRule` accepts and the :root declarations they, `references` or `seed` reach, directly or
 * through other variables. Declarations that are not custom properties always stay. CSS it cannot read stays whole.
 */
export function trimTokenCss(css: string, options: {
  keepRule: (selector: string) => boolean;
  references: string;
  seed?: (name: string) => boolean;
}) {
  const blocks = splitCssBlocks(css);
  if (!blocks) return css;
  const isRoot = (block: CssBlock) => block.prelude === ":root";
  const kept = blocks.filter((block) => isRoot(block) || block.prelude.startsWith("@") || options.keepRule(block.prelude));
  const definitions = new Map<string, string>();
  for (const block of kept.filter(isRoot)) {
    for (const declaration of splitDeclarations(block.body)) {
      const colon = declaration.indexOf(":");
      if (declaration.startsWith("--") && colon > 0) definitions.set(declaration.slice(0, colon).trim(), declaration.slice(colon + 1));
    }
  }

  const reached = new Set<string>();
  const pending = [
    ...Array.from(definitions.keys()).filter((name) => options.seed?.(name)),
    ...(options.references.match(CUSTOM_PROPERTY) ?? []),
    ...kept.filter((block) => !isRoot(block)).flatMap((block) => block.text.match(CUSTOM_PROPERTY) ?? []),
  ];
  while (pending.length) {
    const name = pending.pop()!;
    if (reached.has(name)) continue;
    reached.add(name);
    pending.push(...(definitions.get(name)?.match(CUSTOM_PROPERTY) ?? []));
  }

  return kept.map((block) => {
    if (!isRoot(block)) return block.text;
    const declarations = splitDeclarations(block.body).filter((declaration) => {
      const name = declaration.slice(0, declaration.indexOf(":")).trim();
      return !declaration.startsWith("--") || reached.has(name);
    });
    return `:root {\n${declarations.map((declaration) => `  ${declaration};`).join("\n")}\n}`;
  }).join("\n\n");
}

/** A class token without its variants, important mark, negative sign or opacity modifier: md:-mt-4/50 is mt-4. */
function utilityName(token: string) {
  let depth = 0;
  let start = 0;
  for (let index = 0; index < token.length; index += 1) {
    if (token[index] === "[") depth += 1;
    else if (token[index] === "]") depth -= 1;
    else if (token[index] === ":" && depth === 0) start = index + 1;
  }
  let name = token.slice(start).replace(/^!/, "").replace(/^-/, "");
  const slash = name.lastIndexOf("/");
  if (slash > 0 && !name.slice(slash).includes("]")) name = name.slice(0, slash);
  return name;
}

type ThemeNode = TailwindThemeExtend[string][string];

/**
 * The Tailwind entries a page's classes could use, nested as in the theme, or null when none. An entry stays when any
 * class ends with its name (bg-card, rounded-lg, text-screen-title), which keeps a few unused ones but never drops a
 * used one. dg classes are the token CSS's own rules: no Tailwind utility starts with dg-, so they use no entry.
 */
export function pickTailwindTheme(classTokens: Iterable<string>, theme: TailwindThemeExtend = DRAWGLE_TAILWIND_THEME_EXTEND) {
  const utilities = Array.from(new Set(Array.from(classTokens, utilityName))).filter((utility) => !utility.startsWith("dg-"));
  const used = (suffix: string) => utilities.some((utility) => utility.endsWith(`-${suffix}`));
  const prune = (node: ThemeNode, path: string[]): ThemeNode | undefined => {
    if (typeof node === "string" || Array.isArray(node)) {
      return used(path.filter((key) => key !== "DEFAULT").join("-")) ? node : undefined;
    }
    const entries = Object.entries(node).flatMap(([key, child]) => {
      const kept = prune(child, [...path, key]);
      return kept === undefined ? [] : [[key, kept] as const];
    });
    return entries.length ? Object.fromEntries(entries) : undefined;
  };

  const picked: TailwindThemeExtend = {};
  for (const [group, entries] of Object.entries(theme)) {
    const kept = Object.entries(entries).flatMap(([key, node]) => {
      const value = prune(node, [key]);
      return value === undefined ? [] : [[key, value] as const];
    });
    if (kept.length) picked[group] = Object.fromEntries(kept);
  }
  return Object.keys(picked).length ? picked : null;
}
